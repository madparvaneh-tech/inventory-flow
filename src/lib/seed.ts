import { db } from './db';
import type {
  Store, Warehouse, Category, Unit, Product, Variant, Inventory,
  Document, DocumentLine,
} from '../types';

const uid = () => crypto.randomUUID();
const now = () => Date.now();

export async function seedIfEmpty() {
  const count = await db.stores.count();
  if (count > 0) return false;

  // ---------- Stores ----------
  const storeMain: Store = { id: uid(), name: 'فروشگاه مرکزی', code: 'S001', isActive: true };
  const store2: Store = { id: uid(), name: 'شعبه ۲', code: 'S002', isActive: true };
  const store3: Store = { id: uid(), name: 'شعبه غرب', code: 'S003', isActive: true };
  await db.stores.bulkAdd([storeMain, store2, store3]);

  // ---------- Warehouses ----------
  const whMain: Warehouse = { id: uid(), storeId: storeMain.id, name: 'انبار اصلی', code: 'W001', isDefault: true, isActive: true };
  const whSec: Warehouse = { id: uid(), storeId: storeMain.id, name: 'انبار فرعی', code: 'W002', isDefault: false, isActive: true };
  const whS2: Warehouse = { id: uid(), storeId: store2.id, name: 'انبار شعبه ۲', code: 'W003', isDefault: true, isActive: true };
  const whS3: Warehouse = { id: uid(), storeId: store3.id, name: 'انبار غرب', code: 'W004', isDefault: true, isActive: true };
  await db.warehouses.bulkAdd([whMain, whSec, whS2, whS3]);

  // ---------- Categories ----------
  const catPaper: Category = { id: uid(), parentId: null, name: 'کاغذ و مقوا', code: 'C001', isActive: true };
  const catPen: Category = { id: uid(), parentId: null, name: 'نوشت‌افزار', code: 'C002', isActive: true };
  const catOffice: Category = { id: uid(), parentId: null, name: 'اداری', code: 'C003', isActive: true };
  await db.categories.bulkAdd([catPaper, catPen, catOffice]);

  // ---------- Units ----------
  const unitCount: Unit = { id: uid(), name: 'عدد', symbol: 'عدد', type: 'count' };
  const unitPack: Unit = { id: uid(), name: 'بسته', symbol: 'بسته', type: 'count' };
  const unitKg: Unit = { id: uid(), name: 'کیلوگرم', symbol: 'kg', type: 'weight' };
  await db.units.bulkAdd([unitCount, unitPack, unitKg]);

  // ---------- Products ----------
  const products: Product[] = [
    { id: uid(), name: 'کاغذ A4', sku: '1245', categoryId: catPaper.id, brand: null, model: null, description: null, mainUnitId: unitPack.id, subUnitId: null, conversionFactor: 1, minStock: 100, reorderPoint: 200, isActive: true, imageUrl: null, createdAt: now(), updatedAt: now() },
    { id: uid(), name: 'کاغذ A5', sku: '1246', categoryId: catPaper.id, brand: null, model: null, description: null, mainUnitId: unitPack.id, subUnitId: null, conversionFactor: 1, minStock: 50, reorderPoint: 100, isActive: true, imageUrl: null, createdAt: now(), updatedAt: now() },
    { id: uid(), name: 'پوشه اداری', sku: '0332', categoryId: catOffice.id, brand: null, model: null, description: null, mainUnitId: unitCount.id, subUnitId: null, conversionFactor: 1, minStock: 200, reorderPoint: 400, isActive: true, imageUrl: null, createdAt: now(), updatedAt: now() },
    { id: uid(), name: 'خودکار آبی', sku: '2010', categoryId: catPen.id, brand: 'پارکر', model: 'JB-2000', description: null, mainUnitId: unitCount.id, subUnitId: null, conversionFactor: 1, minStock: 500, reorderPoint: 1000, isActive: true, imageUrl: null, createdAt: now(), updatedAt: now() },
    { id: uid(), name: 'مداد مشکی', sku: '2011', categoryId: catPen.id, brand: null, model: null, description: null, mainUnitId: unitCount.id, subUnitId: null, conversionFactor: 1, minStock: 300, reorderPoint: 600, isActive: true, imageUrl: null, createdAt: now(), updatedAt: now() },
    { id: uid(), name: 'جوهر کارتریج', sku: '0876', categoryId: catOffice.id, brand: null, model: null, description: null, mainUnitId: unitCount.id, subUnitId: null, conversionFactor: 1, minStock: 20, reorderPoint: 50, isActive: true, imageUrl: null, createdAt: now(), updatedAt: now() },
    { id: uid(), name: 'زیردستی', sku: '0410', categoryId: catOffice.id, brand: null, model: null, description: null, mainUnitId: unitCount.id, subUnitId: null, conversionFactor: 1, minStock: 20, reorderPoint: 40, isActive: true, imageUrl: null, createdAt: now(), updatedAt: now() },
    { id: uid(), name: 'منگنه', sku: '0455', categoryId: catOffice.id, brand: null, model: null, description: null, mainUnitId: unitCount.id, subUnitId: null, conversionFactor: 1, minStock: 30, reorderPoint: 60, isActive: true, imageUrl: null, createdAt: now(), updatedAt: now() },
  ];
  await db.products.bulkAdd(products);

  // ---------- Variants (فعلاً یک تنوع پیش‌فرض برای هر محصول) ----------
  const variants: Variant[] = products.map((p) => ({
    id: uid(),
    productId: p.id,
    name: p.name,
    sku: p.sku,
    attributes: {},
    isActive: true,
  }));
  await db.variants.bulkAdd(variants);

  // ---------- Inventory Seed ----------
  const inventories: Inventory[] = [];
  const stockData: Array<[number, number, number]> = [
    // [variantIndex, warehouseIndex, quantity]
    [0, 0, 1250], [0, 1, 300], [0, 2, 120], [0, 3, 80],
    [1, 0, 340],
    [2, 0, 890], [2, 1, 200],
    [3, 0, 500], [3, 2, 150],
    [4, 0, 300],
    [5, 0, 48],
    [6, 0, 25],
    [7, 0, 60],
  ];
  const warehouseList = [whMain, whSec, whS2, whS3];
  const costs = [150000, 120000, 25000, 45000, 12000, 320000, 95000, 180000];

  for (const [vi, wi, qty] of stockData) {
    const v = variants[vi];
    const w = warehouseList[wi];
    inventories.push({
      id: `${v.id}__${w.id}__healthy`,
      variantId: v.id,
      warehouseId: w.id,
      status: 'healthy',
      quantity: qty,
      averageCost: costs[vi],
      lastMovementAt: now() - Math.random() * 86400000 * 3,
    });
  }
  // چند موجودی معیوب
  inventories.push({
    id: `${variants[0].id}__${whMain.id}__defective`,
    variantId: variants[0].id, warehouseId: whMain.id,
    status: 'defective', quantity: 15, averageCost: costs[0],
    lastMovementAt: now() - 86400000,
  });
  await db.inventory.bulkAdd(inventories);

  // ---------- Documents Seed ----------
  const docs: Document[] = [];
  const lines: DocumentLine[] = [];

  // سند 1: رسید دیروز
  {
    const d: Document = {
      id: uid(), number: '1001', type: 'receipt', status: 'confirmed',
      storeId: storeMain.id, sourceWarehouseId: null, destinationWarehouseId: whMain.id,
      dateJalali: '1403/08/23', dateEpoch: now() - 86400000,
      referenceDocId: null, note: 'خرید از تامین‌کننده پارس',
      supplier: 'پارس', referenceNumber: 'P-332',
      recipient: null, issueType: null, shippingCost: 500000,
      discountTotal: 0, totalAmount: 0,
      createdAt: now() - 86400000, confirmedAt: now() - 86400000, reversedAt: null,
    };
    docs.push(d);
    lines.push({
      id: uid(), documentId: d.id, variantId: variants[0].id,
      quantity: 500, unitId: unitPack.id, unitCost: 150000, discount: 0,
      lineTotal: 75000000, stockStatus: 'healthy', note: null,
    });
    lines.push({
      id: uid(), documentId: d.id, variantId: variants[2].id,
      quantity: 200, unitId: unitCount.id, unitCost: 25000, discount: 0,
      lineTotal: 5000000, stockStatus: 'healthy', note: null,
    });
    d.totalAmount = 75000000 + 5000000 + 500000;
  }

  // سند 2: حواله امروز
  {
    const d: Document = {
      id: uid(), number: '2001', type: 'issue', status: 'confirmed',
      storeId: storeMain.id, sourceWarehouseId: whMain.id, destinationWarehouseId: null,
      dateJalali: '1403/08/24', dateEpoch: now() - 3600000,
      referenceDocId: null, note: null,
      supplier: null, referenceNumber: null,
      recipient: 'شعبه ۲', issueType: 'sale', shippingCost: 0,
      discountTotal: 0, totalAmount: 0,
      createdAt: now() - 3600000, confirmedAt: now() - 3600000, reversedAt: null,
    };
    docs.push(d);
    lines.push({
      id: uid(), documentId: d.id, variantId: variants[5].id,
      quantity: 12, unitId: unitCount.id, unitCost: 320000, discount: 0,
      lineTotal: 0, stockStatus: 'healthy', note: null,
    });
  }

  // سند 3: انتقال امروز
  {
    const d: Document = {
      id: uid(), number: '3001', type: 'transfer', status: 'confirmed',
      storeId: storeMain.id, sourceWarehouseId: whMain.id, destinationWarehouseId: whSec.id,
      dateJalali: '1403/08/24', dateEpoch: now() - 7200000,
      referenceDocId: null, note: 'انتقال بین دو انبار',
      supplier: null, referenceNumber: null,
      recipient: null, issueType: null, shippingCost: 0,
      discountTotal: 0, totalAmount: 0,
      createdAt: now() - 7200000, confirmedAt: now() - 7200000, reversedAt: null,
    };
    docs.push(d);
    lines.push({
      id: uid(), documentId: d.id, variantId: variants[2].id,
      quantity: 50, unitId: unitCount.id, unitCost: 25000, discount: 0,
      lineTotal: 0, stockStatus: 'healthy', note: null,
    });
  }

  // سند 4: پیش‌نویس رسید
  {
    const d: Document = {
      id: uid(), number: '1002', type: 'receipt', status: 'draft',
      storeId: storeMain.id, sourceWarehouseId: null, destinationWarehouseId: whMain.id,
      dateJalali: '1403/08/24', dateEpoch: now(),
      referenceDocId: null, note: 'پیش‌نویس خرید',
      supplier: null, referenceNumber: null,
      recipient: null, issueType: null, shippingCost: 0,
      discountTotal: 0, totalAmount: 4500000,
      createdAt: now(), confirmedAt: null, reversedAt: null,
    };
    docs.push(d);
    lines.push({
      id: uid(), documentId: d.id, variantId: variants[1].id,
      quantity: 100, unitId: unitPack.id, unitCost: 45000, discount: 0,
      lineTotal: 4500000, stockStatus: 'healthy', note: null,
    });
  }

  await db.documents.bulkAdd(docs);
  await db.documentLines.bulkAdd(lines);

  return true;
}