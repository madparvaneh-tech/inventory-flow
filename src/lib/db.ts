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

  constructor() {
    super('inventory-flow-db');
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
  }
}

export const db = new InventoryDB();

// پاک کردن دیتابیس (برای dev)
export async function resetDb() {
  await db.delete();
  await db.open();
}