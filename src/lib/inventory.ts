import { db } from './db';
import type { Inventory, StockStatus } from '../types';

// ساخت ID یکتا برای ردیف موجودی
function invId(variantId: string, warehouseId: string, status: StockStatus) {
  return `${variantId}__${warehouseId}__${status}`;
}

// خواندن ردیف موجودی یا ساخت مقدار صفر
export async function getOrCreateInventory(
  variantId: string,
  warehouseId: string,
  status: StockStatus = 'healthy'
): Promise<Inventory> {
  const id = invId(variantId, warehouseId, status);
  const existing = await db.inventory.get(id);
  if (existing) return existing;

  const newInv: Inventory = {
    id,
    variantId,
    warehouseId,
    status,
    quantity: 0,
    averageCost: 0,
    lastMovementAt: Date.now(),
  };
  await db.inventory.put(newInv);
  return newInv;
}

// محاسبه موجودی کل شرکت (سراسری) برای یک Variant
export async function getVariantTotalQuantity(variantId: string): Promise<number> {
  const list = await db.inventory.where('variantId').equals(variantId).toArray();
  return list.filter((i) => i.status === 'healthy').reduce((s, i) => s + i.quantity, 0);
}

// میانگین موزون سراسری برای یک Variant
export async function getVariantAverageCost(variantId: string): Promise<number> {
  const list = await db.inventory.where('variantId').equals(variantId).toArray();
  const healthy = list.filter((i) => i.status === 'healthy' && i.quantity > 0);
  const totalQty = healthy.reduce((s, i) => s + i.quantity, 0);
  if (totalQty === 0) {
    // اگر هیچ موجودی‌ای نبود، آخرین averageCost موجود را برگردان
    const any = list.find((i) => i.averageCost > 0);
    return any?.averageCost ?? 0;
  }
  const totalValue = healthy.reduce((s, i) => s + i.quantity * i.averageCost, 0);
  return totalValue / totalQty;
}

// موجودی یک Variant در یک انبار مشخص
export async function getWarehouseStock(
  variantId: string,
  warehouseId: string,
  status: StockStatus = 'healthy'
): Promise<number> {
  const inv = await db.inventory.get(invId(variantId, warehouseId, status));
  return inv?.quantity ?? 0;
}

// اعمال اثر ورود (رسید)
// - موجودی انبار مقصد افزایش
// - میانگین موزون سراسری آپدیت
export async function applyInbound(
  variantId: string,
  warehouseId: string,
  quantity: number,
  unitCost: number
) {
  if (quantity <= 0) return;

  // 1) آپدیت میانگین موزون سراسری (قبل از افزایش موجودی این انبار)
  const globalQtyBefore = await getVariantTotalQuantity(variantId);
  const globalAvgBefore = await getVariantAverageCost(variantId);

  let newAvg: number;
  if (globalQtyBefore <= 0) {
    newAvg = unitCost;
  } else {
    newAvg =
      (globalQtyBefore * globalAvgBefore + quantity * unitCost) /
      (globalQtyBefore + quantity);
  }

  // 2) آپدیت موجودی این انبار
  const inv = await getOrCreateInventory(variantId, warehouseId, 'healthy');
  inv.quantity += quantity;
  inv.lastMovementAt = Date.now();
  await db.inventory.put(inv);

  // 3) آپدیت averageCost همه ردیف‌های سالم این Variant (سراسری)
  const allInv = await db.inventory.where('variantId').equals(variantId).toArray();
  for (const row of allInv) {
    if (row.status === 'healthy') {
      row.averageCost = newAvg;
      await db.inventory.put(row);
    }
  }
}

// اعمال اثر خروج (حواله)
// - موجودی انبار مبدأ کاهش
// - میانگین موزون تغییر نمی‌کند
export async function applyOutbound(
  variantId: string,
  warehouseId: string,
  quantity: number,
  stockStatus: StockStatus = 'healthy'
) {
  if (quantity <= 0) return;
  const inv = await getOrCreateInventory(variantId, warehouseId, stockStatus);
  inv.quantity = Math.max(0, inv.quantity - quantity);
  inv.lastMovementAt = Date.now();
  await db.inventory.put(inv);
}

// اعمال اثر انتقال — مرحله اول (خروج از مبدأ + ورود به in-transit)
export async function applyTransferStart(
  variantId: string,
  sourceWarehouseId: string,
  quantity: number
) {
  if (quantity <= 0) return;

  // کاهش از مبدأ
  const srcInv = await getOrCreateInventory(variantId, sourceWarehouseId, 'healthy');
  srcInv.quantity = Math.max(0, srcInv.quantity - quantity);
  srcInv.lastMovementAt = Date.now();
  await db.inventory.put(srcInv);

  // افزایش در in-transit (روی مبدأ نگه داشته می‌شود)
  const transitInv = await getOrCreateInventory(variantId, sourceWarehouseId, 'in-transit');
  transitInv.quantity += quantity;
  transitInv.averageCost = srcInv.averageCost;
  transitInv.lastMovementAt = Date.now();
  await db.inventory.put(transitInv);
}

// اعمال اثر انتقال — مرحله دوم (تکمیل: خروج از in-transit + ورود به مقصد)
export async function applyTransferComplete(
  variantId: string,
  sourceWarehouseId: string,
  destinationWarehouseId: string,
  quantity: number
) {
  if (quantity <= 0) return;

  // کاهش از in-transit
  const transitInv = await getOrCreateInventory(variantId, sourceWarehouseId, 'in-transit');
  transitInv.quantity = Math.max(0, transitInv.quantity - quantity);
  transitInv.lastMovementAt = Date.now();
  await db.inventory.put(transitInv);

  // افزایش در مقصد — میانگین تغییر نمی‌کند چون ورود داخلی است
  const destInv = await getOrCreateInventory(variantId, destinationWarehouseId, 'healthy');
  destInv.quantity += quantity;
  destInv.lastMovementAt = Date.now();
  await db.inventory.put(destInv);

  // همگام‌سازی averageCost مقصد با میانگین سراسری
  const globalAvg = await getVariantAverageCost(variantId);
  const allInv = await db.inventory.where('variantId').equals(variantId).toArray();
  for (const row of allInv) {
    if (row.status === 'healthy') {
      row.averageCost = globalAvg;
      await db.inventory.put(row);
    }
  }
}

// برگشت اثر یک سند تأییدشده (برای حذف یا برگشت از تأیید)
// این تابع فقط اثر موجودی را خنثی می‌کند — خود سند را حذف یا تغییر وضعیت نمی‌دهد
export async function revertDocumentEffects(docId: string) {
  const doc = await db.documents.get(docId);
  if (!doc || doc.status !== 'confirmed') return;

  const lines = await db.documentLines.where('documentId').equals(docId).toArray();

  for (const line of lines) {
    if (doc.type === 'receipt') {
      // ورود → باید موجودی را کاهش دهیم
      const inv = await getOrCreateInventory(
        line.variantId,
        doc.destinationWarehouseId!,
        'healthy'
      );
      inv.quantity = Math.max(0, inv.quantity - line.quantity);
      inv.lastMovementAt = Date.now();
      await db.inventory.put(inv);
    } else if (doc.type === 'issue') {
      // خروج → موجودی را افزایش دهیم
      const inv = await getOrCreateInventory(
        line.variantId,
        doc.sourceWarehouseId!,
        'healthy'
      );
      inv.quantity += line.quantity;
      inv.lastMovementAt = Date.now();
      await db.inventory.put(inv);
    } else if (doc.type === 'transfer') {
      // انتقال → از مقصد کم کنیم، به مبدأ برگردانیم
      const destInv = await getOrCreateInventory(
        line.variantId,
        doc.destinationWarehouseId!,
        'healthy'
      );
      destInv.quantity = Math.max(0, destInv.quantity - line.quantity);
      destInv.lastMovementAt = Date.now();
      await db.inventory.put(destInv);

      const srcInv = await getOrCreateInventory(
        line.variantId,
        doc.sourceWarehouseId!,
        'healthy'
      );
      srcInv.quantity += line.quantity;
      srcInv.lastMovementAt = Date.now();
      await db.inventory.put(srcInv);
    }
  }
}

// بررسی کفایت موجودی برای خروج/انتقال
export async function checkSufficientStock(
  variantId: string,
  warehouseId: string,
  quantity: number,
  stockStatus: StockStatus = 'healthy'
): Promise<{ ok: boolean; available: number }> {
  const available = await getWarehouseStock(variantId, warehouseId, stockStatus);
  return { ok: available >= quantity, available };
}