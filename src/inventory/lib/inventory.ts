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

// خواندن ردیف موجودی بدون ایجاد ردیف (برای خواندن مبلغ/موجودی فعلی)
export async function peekInventory(
  variantId: string,
  warehouseId: string,
  status: StockStatus = 'healthy'
): Promise<Inventory | null> {
  const row = await db.inventory.get(invId(variantId, warehouseId, status));
  return row ?? null;
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

// اعمال اثر ورود (رسید / برگشت / اصلاح افزایشی / تکمیل انتقال)
// - وضعیت سالم: میانگین موزون سراسری آپدیت می‌شود
// - وضعیت معیوب: میانگین ردیف معیوب همان انبار مستقل آپدیت می‌شود
// - unitCost اینجا «بهای تمام‌شده موثر» است (قیمت + سهم هزینه‌های توزیع‌شده)
export async function applyInbound(
  variantId: string,
  warehouseId: string,
  quantity: number,
  unitCost: number,
  stockStatus: StockStatus = 'healthy'
) {
  if (quantity <= 0) return;

  if (stockStatus !== 'healthy') {
    // ورود معیوب — مستقل از موجودی سالم و میانگین سراسری
    const inv = await getOrCreateInventory(variantId, warehouseId, stockStatus);
    const beforeQty = inv.quantity;
    const beforeAvg = inv.averageCost;
    inv.quantity += quantity;
    inv.averageCost =
      beforeQty > 0
        ? (beforeQty * beforeAvg + quantity * unitCost) / (beforeQty + quantity)
        : unitCost;
    inv.lastMovementAt = Date.now();
    await db.inventory.put(inv);
    return;
  }

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

// اعمال اثر خروج (حواله / اصلاح کاهشی)
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

// ============================================================
// قفل عملیاتی انبارگردانی
// تا وقتی انبارگردانی بازی (پیش‌نویس) برای انباری باز است،
// تأیید هر سند دیگری که به همان انبار دست می‌زند مجاز نیست
// ============================================================
export async function assertNoOpenCount(
  warehouseIds: (string | null | undefined)[],
  excludeDocId?: string
): Promise<void> {
  const ids = [...new Set(warehouseIds.filter((x): x is string => !!x))];
  if (ids.length === 0) return;

  const openCounts = await db.documents.where('type').equals('count').toArray();
  const blocking = openCounts.filter(
    (d) =>
      d.status === 'draft' &&
      d.sourceWarehouseId &&
      ids.includes(d.sourceWarehouseId) &&
      d.id !== excludeDocId
  );

  if (blocking.length > 0) {
    const c = blocking[0];
    throw new Error(
      `این انبار در حال انبارگردانی است (سند شمارش #${c.number}). تا تأیید یا حذف سند انبارگردانی، ثبت ورود و خروج برای این انبار مجاز نیست.`
    );
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
      // خروج → موجودی را در همان وضعیت ردیف افزایش دهیم
      const inv = await getOrCreateInventory(
        line.variantId,
        doc.sourceWarehouseId!,
        line.stockStatus || 'healthy'
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
    } else if (doc.type === 'return') {
      // برگشت → مقدار برگشتی را از انبار مقصد در همان وضعیت ردیف کم می‌کنیم
      const inv = await getOrCreateInventory(
        line.variantId,
        doc.destinationWarehouseId!,
        line.stockStatus || 'healthy'
      );
      inv.quantity = Math.max(0, inv.quantity - line.quantity);
      inv.lastMovementAt = Date.now();
      await db.inventory.put(inv);
    } else if (doc.type === 'adjustment') {
      // اصلاح موجودی → خنثی‌سازی بر اساس جهت سند
      if (doc.adjustmentDirection === 'increase') {
        const inv = await getOrCreateInventory(
          line.variantId,
          doc.sourceWarehouseId!,
          line.stockStatus || 'healthy'
        );
        inv.quantity = Math.max(0, inv.quantity - line.quantity);
        inv.lastMovementAt = Date.now();
        await db.inventory.put(inv);
      } else {
        const inv = await getOrCreateInventory(
          line.variantId,
          doc.sourceWarehouseId!,
          line.stockStatus || 'healthy'
        );
        inv.quantity += line.quantity;
        inv.lastMovementAt = Date.now();
        await db.inventory.put(inv);
      }
    }
    // نوع count اثر مستقیم روی موجودی ندارد (اثر آن از مسیر اسناد اصلاح متصل اعمال شده)
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
