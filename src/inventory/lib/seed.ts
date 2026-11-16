import { db } from './db';
import { toJalaliString } from './jalali';
import type {
  Store, Warehouse, Category, Unit, Product, Variant, Inventory,
  Document, DocumentLine, AdjustmentReason, SalesChannel, CalcTemplate, PriceLog,
} from '../types';

const uid = () => crypto.randomUUID();
const now = () => Date.now();

// علت‌های پیش‌فرض اصلاح موجودی — برای کاربران جدید و قدیمی seed می‌شود
export const DEFAULT_ADJUSTMENT_REASONS = [
  'اشتباه ثبت',
  'ضایعات',
  'مفقودی/سرقت',
  'مصرف داخلی/هدیه',
  'اصلاح کسری شمارش',
  'سایر',
];

export async function seedReasonsIfEmpty(): Promise<boolean> {
  const count = await db.adjustmentReasons.count();
  if (count > 0) return false;
  const reasons: AdjustmentReason[] = DEFAULT_ADJUSTMENT_REASONS.map((name) => ({
    id: uid(),
    name,
  }));
  await db.adjustmentReasons.bulkAdd(reasons);
  return true;
}

// Seed ماژول قیمت‌گذاری — برای کاربران جدید و قدیمی (فقط اگر جدول خالی باشد)
export async function seedPricingIfEmpty(): Promise<boolean> {
  const channelCount = await db.salesChannels.count();
  const templateCount = await db.calcTemplates.count();
  if (channelCount > 0 && templateCount > 0) return false;

  const channels: SalesChannel[] = [];
  if (channelCount === 0) {
    const digi: SalesChannel = {
      id: uid(),
      name: 'دیجی‌کالا',
      isActive: true,
      createdAt: Date.now(),
      fees: [
        { id: uid(), title: 'کمیسیون فروش', calcType: 'percent', value: 8, basis: 'before_discount' },
        { id: uid(), title: 'هزینهٔ پردازش سفارش', calcType: 'fixed', value: 5000, basis: 'per_unit' },
      ],
    };
    const inPerson: SalesChannel = {
      id: uid(),
      name: 'فروش حضوری',
      isActive: true,
      createdAt: Date.now(),
      fees: [],
    };
    channels.push(digi, inPerson);
    await db.salesChannels.bulkAdd(channels);
  }

  if (templateCount === 0) {
    const ts = Date.now();
    const inPersonTpl: CalcTemplate = {
      id: uid(),
      name: 'فروش حضوری',
      costBasis: 'avg',
      targetMarginPercent: 20,
      sellerDiscountPercent: 0,
      platformDiscountPercent: 0,
      jointDiscountPercent: 0,
      jointSellerSharePercent: 50,
      fees: [],
      isDefault: true,
      isActive: true,
      createdAt: ts,
      updatedAt: ts,
    };
    const onlineTpl: CalcTemplate = {
      id: uid(),
      name: 'فروش آنلاین',
      costBasis: 'avg',
      targetMarginPercent: 25,
      sellerDiscountPercent: 0,
      platformDiscountPercent: 0,
      jointDiscountPercent: 10,
      jointSellerSharePercent: 30,
      fees: [
        { id: uid(), title: 'بسته‌بندی', calcType: 'fixed', value: 2000, basis: 'per_unit' },
      ],
      isDefault: false,
      isActive: true,
      createdAt: ts,
      updatedAt: ts,
    };
    await db.calcTemplates.bulkAdd([inPersonTpl, onlineTpl]);
  }
  return true;
}

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
    salePrice: null,
    replacementPrice: null,
  }));
  await db.variants.bulkAdd(variants);

  // ---------- قیمت‌های دموی قیمت‌گذاری ----------
  // قیمت جایگزینی و قیمت فروش برای چند کالا (مبنای مستقل قیمت‌گذاری)
  const replacementPrices = [1600000, 1300000, 280000, 500000, 135000, 3500000, 1050000, 2000000];
  const salePrices = [2100000, 1700000, 380000, 700000, 180000, 4300000, 1350000, 2600000];
  for (let i = 0; i < variants.length; i++) {
    await db.variants.update(variants[i].id, {
      replacementPrice: replacementPrices[i],
      salePrice: salePrices[i],
    });
  }

  // ---------- Inventory Seed ----------
  // مبالغ به «ریال»
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
  const costs = [1500000, 1200000, 250000, 450000, 120000, 3200000, 950000, 1800000];

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

  // سند 1: رسید دیروز (هزینه حمل در مبلغ نهایی لحاظ شده)
  {
    const d: Document = {
      id: uid(), number: '1001', type: 'receipt', status: 'confirmed',
      storeId: storeMain.id, sourceWarehouseId: null, destinationWarehouseId: whMain.id,
      dateJalali: toJalaliString(now() - 86400000), dateEpoch: now() - 86400000,
      referenceDocId: null, note: 'خرید از تامین‌کننده پارس',
      supplier: 'پارس', referenceNumber: 'P-332',
      recipient: null, issueType: null, channelId: null, shippingCost: 5000000, otherExpenses: 0,
      discountTotal: 0, totalAmount: 805000000,
      adjustmentDirection: null, adjustmentReason: null, countMode: null,
      createdAt: now() - 86400000, confirmedAt: now() - 86400000, reversedAt: null,
    };
    docs.push(d);
    lines.push({
      id: uid(), documentId: d.id, variantId: variants[0].id,
      quantity: 500, unitId: unitPack.id, unitCost: 1500000, discount: 0,
      lineTotal: 750000000, stockStatus: 'healthy', note: null,
      effectiveCost: 1509375, balanceBefore: null, balanceAfter: null,
      salePrice: null,
    });
    lines.push({
      id: uid(), documentId: d.id, variantId: variants[2].id,
      quantity: 200, unitId: unitCount.id, unitCost: 250000, discount: 0,
      lineTotal: 50000000, stockStatus: 'healthy', note: null,
      effectiveCost: 251562.5, balanceBefore: null, balanceAfter: null,
      salePrice: null,
    });
  }

  // سند 2: حواله امروز
  {
    const d: Document = {
      id: uid(), number: '2001', type: 'issue', status: 'confirmed',
      storeId: storeMain.id, sourceWarehouseId: whMain.id, destinationWarehouseId: null,
      dateJalali: toJalaliString(now() - 3600000), dateEpoch: now() - 3600000,
      referenceDocId: null, note: null,
      supplier: null, referenceNumber: null,
      recipient: 'شعبه ۲', issueType: 'sale', channelId: null, shippingCost: 0, otherExpenses: 0,
      discountTotal: 0, totalAmount: 38400000,
      adjustmentDirection: null, adjustmentReason: null, countMode: null,
      createdAt: now() - 3600000, confirmedAt: now() - 3600000, reversedAt: null,
    };
    docs.push(d);
    lines.push({
      id: uid(), documentId: d.id, variantId: variants[5].id,
      quantity: 12, unitId: unitCount.id, unitCost: 3200000, discount: 0,
      lineTotal: 38400000, stockStatus: 'healthy', note: null,
      effectiveCost: 3200000, balanceBefore: null, balanceAfter: null,
      salePrice: null,
    });
  }

  // سند 3: انتقال امروز
  {
    const d: Document = {
      id: uid(), number: '3001', type: 'transfer', status: 'confirmed',
      storeId: storeMain.id, sourceWarehouseId: whMain.id, destinationWarehouseId: whSec.id,
      dateJalali: toJalaliString(now() - 7200000), dateEpoch: now() - 7200000,
      referenceDocId: null, note: 'انتقال بین دو انبار',
      supplier: null, referenceNumber: null,
      recipient: null, issueType: null, channelId: null, shippingCost: 0, otherExpenses: 0,
      discountTotal: 0, totalAmount: 12500000,
      adjustmentDirection: null, adjustmentReason: null, countMode: null,
      createdAt: now() - 7200000, confirmedAt: now() - 7200000, reversedAt: null,
    };
    docs.push(d);
    lines.push({
      id: uid(), documentId: d.id, variantId: variants[2].id,
      quantity: 50, unitId: unitCount.id, unitCost: 250000, discount: 0,
      lineTotal: 12500000, stockStatus: 'healthy', note: null,
      effectiveCost: 250000, balanceBefore: null, balanceAfter: null,
      salePrice: null,
    });
  }

  // سند 4: پیش‌نویس رسید
  {
    const d: Document = {
      id: uid(), number: '1002', type: 'receipt', status: 'draft',
      storeId: storeMain.id, sourceWarehouseId: null, destinationWarehouseId: whMain.id,
      dateJalali: toJalaliString(now()), dateEpoch: now(),
      referenceDocId: null, note: 'پیش‌نویس خرید',
      supplier: null, referenceNumber: null,
      recipient: null, issueType: null, channelId: null, shippingCost: 0, otherExpenses: 0,
      discountTotal: 0, totalAmount: 45000000,
      adjustmentDirection: null, adjustmentReason: null, countMode: null,
      createdAt: now(), confirmedAt: null, reversedAt: null,
    };
    docs.push(d);
    lines.push({
      id: uid(), documentId: d.id, variantId: variants[1].id,
      quantity: 100, unitId: unitPack.id, unitCost: 450000, discount: 0,
      lineTotal: 45000000, stockStatus: 'healthy', note: null,
      effectiveCost: null, balanceBefore: null, balanceAfter: null,
      salePrice: null,
    });
  }

  // سند 5 و 6: حواله‌های فروش قیمت‌دار با کانال (دموی گزارش‌های سودآوری)
  const chDigi = (await db.salesChannels.toArray()).find((c) => c.name === 'دیجی‌کالا');
  {
    const d: Document = {
      id: uid(), number: '2002', type: 'issue', status: 'confirmed',
      storeId: storeMain.id, sourceWarehouseId: whMain.id, destinationWarehouseId: null,
      dateJalali: toJalaliString(now()), dateEpoch: now() - 7200000,
      referenceDocId: null, note: 'فروش آنلاین',
      supplier: null, referenceNumber: null,
      recipient: 'مشتری آنلاین', issueType: 'sale', channelId: chDigi?.id ?? null, shippingCost: 0, otherExpenses: 0,
      discountTotal: 0, totalAmount: 150000000,
      adjustmentDirection: null, adjustmentReason: null, countMode: null,
      createdAt: now() - 7200000, confirmedAt: now() - 7200000, reversedAt: null,
    };
    docs.push(d);
    lines.push({
      id: uid(), documentId: d.id, variantId: variants[0].id,
      quantity: 100, unitId: unitPack.id, unitCost: 1500000, discount: 0,
      lineTotal: 150000000, stockStatus: 'healthy', note: null,
      effectiveCost: 1500000, balanceBefore: null, balanceAfter: null,
      salePrice: 2100000,
    });
  }
  {
    // فروش زیر سربه‌سر (دموی گزارش ۴): بهای ۱۲۰٬۰۰۰ + کمیسیون ۸٪ + پردازش ۵٬۰۰۰/واحد
    // سربه‌سر واحد = (120000 + 5000) / (1 − 0.08) ≈ ۱۳۵٬۸۶۹ > ۱۳۰٬۰۰۰
    const d: Document = {
      id: uid(), number: '2003', type: 'issue', status: 'confirmed',
      storeId: storeMain.id, sourceWarehouseId: whMain.id, destinationWarehouseId: null,
      dateJalali: toJalaliString(now()), dateEpoch: now() - 5400000,
      referenceDocId: null, note: 'فروش زیر سربه‌سر (دمو)',
      supplier: null, referenceNumber: null,
      recipient: 'مشتری عمده', issueType: 'sale', channelId: chDigi?.id ?? null, shippingCost: 0, otherExpenses: 0,
      discountTotal: 0, totalAmount: 6000000,
      adjustmentDirection: null, adjustmentReason: null, countMode: null,
      createdAt: now() - 5400000, confirmedAt: now() - 5400000, reversedAt: null,
    };
    docs.push(d);
    lines.push({
      id: uid(), documentId: d.id, variantId: variants[4].id,
      quantity: 50, unitId: unitCount.id, unitCost: 120000, discount: 0,
      lineTotal: 6000000, stockStatus: 'healthy', note: null,
      effectiveCost: 120000, balanceBefore: null, balanceAfter: null,
      salePrice: 130000,
    });
  }

  await db.documents.bulkAdd(docs);
  await db.documentLines.bulkAdd(lines);

  // تاریخچهٔ قیمت: ثبت اولیهٔ قیمت فروش تنوع‌ها
  const priceLogs: PriceLog[] = variants.map((v, i) => ({
    id: uid(),
    variantId: v.id,
    oldPrice: 0,
    newPrice: salePrices[i],
    source: 'manual' as const,
    calcId: null,
    createdAt: now() - 86400000 * 2,
  }));
  await db.priceLog.bulkAdd(priceLogs);

  return true;
}
