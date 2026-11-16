export type FlowType = 'IN' | 'OUT' | 'TRANSFER';
export type DocumentStatus = 'draft' | 'confirmed' | 'reversed';
export type FlowOperation =
  | 'receipt'
  | 'issue'
  | 'transfer'
  | 'return'
  | 'count'
  | 'adjustment'
  | 'status-change';

export type StockStatus = 'healthy' | 'defective' | 'in-transit';

export interface Store {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export interface Warehouse {
  id: string;
  storeId: string;
  name: string;
  code: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface Category {
  id: string;
  parentId: string | null;
  name: string;
  code: string;
  isActive: boolean;
}

export interface Unit {
  id: string;
  name: string;
  symbol: string;
  type: 'count' | 'weight' | 'volume' | 'length' | 'area' | 'other';
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  categoryId: string;
  brand: string | null;
  model: string | null;
  description: string | null;
  mainUnitId: string;
  subUnitId: string | null;
  conversionFactor: number;
  minStock: number;
  reorderPoint: number;
  isActive: boolean;
  imageUrl: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Variant {
  id: string;
  productId: string;
  name: string;
  sku: string;
  attributes: Record<string, string>;
  isActive: boolean;
}

export interface Barcode {
  id: string;
  variantId: string;
  code: string;
}

export interface Inventory {
  id: string;
  variantId: string;
  warehouseId: string;
  status: StockStatus;
  quantity: number;
  averageCost: number;
  lastMovementAt: number;
}

export interface Document {
  id: string;
  number: string;
  type: FlowOperation;
  status: DocumentStatus;
  storeId: string;
  sourceWarehouseId: string | null;
  destinationWarehouseId: string | null;
  dateJalali: string;
  dateEpoch: number;
  referenceDocId: string | null;
  note: string | null;
  supplier: string | null;
  referenceNumber: string | null;
  recipient: string | null;
  issueType: string | null;
  shippingCost: number;
  discountTotal: number;
  totalAmount: number;
  createdAt: number;
  confirmedAt: number | null;
  reversedAt: number | null;
}

export interface DocumentLine {
  id: string;
  documentId: string;
  variantId: string;
  quantity: number;
  unitId: string;
  unitCost: number;
  discount: number;
  lineTotal: number;
  stockStatus: StockStatus;
  note: string | null;
}