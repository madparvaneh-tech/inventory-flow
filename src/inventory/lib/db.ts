import Dexie, { type Table } from 'dexie';
import type {
  Store,
  Warehouse,
  Category,
  Unit,
  Product,
  Variant,
  Barcode,
  Inventory,
  Document,
  DocumentLine,
  CountLine,
  AdjustmentReason,
  SalesChannel,
  CalcTemplate,
  TemplateProduct,
  CalcHistory,
  PriceLog,
  AppSetting,
} from '../types';

export class InventoryDB extends Dexie {
  stores!: Table<Store, string>;
  warehouses!: Table<Warehouse, string>;
  categories!: Table<Category, string>;
  units!: Table<Unit, string>;
  products!: Table<Product, string>;
  variants!: Table<Variant, string>;
  barcodes!: Table<Barcode, string>;
  inventory!: Table<Inventory, string>;
  documents!: Table<Document, string>;
  documentLines!: Table<DocumentLine, string>;
  countLines!: Table<CountLine, string>;
  adjustmentReasons!: Table<AdjustmentReason, string>;
  salesChannels!: Table<SalesChannel, string>;
  calcTemplates!: Table<CalcTemplate, string>;
  templateProducts!: Table<TemplateProduct, string>;
  calcHistory!: Table<CalcHistory, string>;
  priceLog!: Table<PriceLog, string>;
  appSettings!: Table<AppSetting, string>;

  constructor() {
    super('inventory-flow-db');
    // نسخه ۱ — جداول اصلی (سازگار با داده‌های موجود کاربران)
    this.version(1).stores({
      stores: 'id, name, code',
      warehouses: 'id, storeId, name, code',
      categories: 'id, parentId, name, code',
      units: 'id, type',
      products: 'id, sku, categoryId, name',
      variants: 'id, productId, sku',
      barcodes: 'id, variantId, code',
      inventory: 'id, variantId, warehouseId, status, [variantId+warehouseId]',
      documents: 'id, number, type, status, storeId, dateEpoch, referenceDocId',
      documentLines: 'id, documentId, variantId',
    });
    // نسخه ۲ — انبارگردانی و اصلاح موجودی (مهاجرت افزایشی؛ داده‌ها حفظ می‌شوند)
    this.version(2).stores({
      countLines: 'id, documentId, variantId',
      adjustmentReasons: 'id, name',
    });
    // نسخه ۳ — بهای تمام‌شده و قیمت‌گذاری (فقط جداول جدید؛ فیلدهای غیرشاخص
    // مثل salePrice/replacementPrice/channelId نیازی به ایندکس ندارند)
    this.version(3).stores({
      salesChannels: 'id, name',
      calcTemplates: 'id, name, isDefault',
      templateProducts: 'id, templateId, productId, [templateId+productId]',
      calcHistory: 'id, variantId, productId, templateId, createdAt',
      priceLog: 'id, variantId, createdAt',
      appSettings: 'key',
    });
  }
}

export const db = new InventoryDB();

// پاک کردن دیتابیس (برای dev)
export async function resetDb() {
  await db.delete();
  await db.open();
}
