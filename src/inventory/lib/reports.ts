import { db } from './db';
import type {
  Category,
  Document,
  DocumentLine,
  FlowOperation,
  Inventory,
  Product,
  StockStatus,
  Store,
  Unit,
  Variant,
  Warehouse,
} from '../types';

// ============================================================
// موتور گزارش‌های مدیریتی
// - فقط از اسناد تأییدشده و داده واقعی موجودی استفاده می‌کند
// - با موتور میانگین موزون برنامه هماهنگ است
// - انتقال داخلی در سطح شرکت/فروشگاه گردش واقعی نیست ولی
//   در سطح انبار به‌صورت خروج از مبدأ و ورود به مقصد دیده می‌شود
// ============================================================

export interface ReportDataset {
  docs: Document[];
  linesByDoc: Map<string, DocumentLine[]>;
  products: Product[];
  variants: Variant[];
  categories: Category[];
  stores: Store[];
  warehouses: Warehouse[];
  units: Unit[];
  inventory: Inventory[];
  // نگاشت‌های کمکی
  variantById: Map<string, Variant>;
  productById: Map<string, Product>;
  categoryById: Map<string, Category>;
  storeById: Map<string, Store>;
  warehouseById: Map<string, Warehouse>;
  unitById: Map<string, Unit>;
}

export async function buildReportDataset(): Promise<ReportDataset> {
  const [docs, lines, products, variants, categories, stores, warehouses, units, inventory] =
    await Promise.all([
      db.documents.toArray(),
      db.documentLines.toArray(),
      db.products.toArray(),
      db.variants.toArray(),
      db.categories.toArray(),
      db.stores.toArray(),
      db.warehouses.toArray(),
      db.units.toArray(),
      db.inventory.toArray(),
    ]);

  const linesByDoc = new Map<string, DocumentLine[]>();
  for (const l of lines) {
    const arr = linesByDoc.get(l.documentId);
    if (arr) arr.push(l);
    else linesByDoc.set(l.documentId, [l]);
  }

  return {
    docs,
    linesByDoc,
    products,
    variants,
    categories,
    stores,
    warehouses,
    units,
    inventory,
    variantById: new Map(variants.map((v) => [v.id, v])),
    productById: new Map(products.map((p) => [p.id, p])),
    categoryById: new Map(categories.map((c) => [c.id, c])),
    storeById: new Map(stores.map((s) => [s.id, s])),
    warehouseById: new Map(warehouses.map((w) => [w.id, w])),
    unitById: new Map(units.map((u) => [u.id, u])),
  };
}

// بهای موثر خط — با effectiveCost ثبت‌شده در تأیید و fallback مناسب
export function lineEffectiveCost(l: DocumentLine): number {
  if (l.effectiveCost !== null && l.effectiveCost !== undefined) return l.effectiveCost;
  return l.unitCost || 0;
}

// ============================================================
// ۱) گزارش وضعیت موجودی
// ============================================================
export interface StockStatusRow {
  variantId: string;
  productName: string;
  productSku: string;
  variantSku: string;
  categoryName: string;
  storeId: string;
  storeName: string;
  warehouseId: string;
  warehouseName: string;
  healthy: number;
  defective: number;
  inTransit: number;
  minStock: number;
  reorderPoint: number;
  unitName: string;
  productActive: boolean;
}

export interface StockStatusFilters {
  productId: string; // 'all'
  variantId: string;
  categoryId: string;
  storeId: string;
  warehouseId: string;
  activeFilter: 'all' | 'active' | 'inactive';
  stockFilter: 'all' | 'with-stock' | 'without-stock';
}

export function stockStatusReport(ds: ReportDataset, f: StockStatusFilters): StockStatusRow[] {
  const rows = new Map<string, StockStatusRow>();

  const ensureRow = (variantId: string, warehouseId: string): StockStatusRow | null => {
    const key = `${variantId}|${warehouseId}`;
    if (rows.has(key)) return rows.get(key)!;
    const v = ds.variantById.get(variantId);
    const p = v ? ds.productById.get(v.productId) : undefined;
    const w = ds.warehouseById.get(warehouseId);
    if (!v || !p || !w) return null;
    const store = ds.storeById.get(w.storeId);
    const category = ds.categoryById.get(p.categoryId);
    const unit = ds.unitById.get(p.mainUnitId);
    const row: StockStatusRow = {
      variantId,
      productName: p.name,
      productSku: p.sku,
      variantSku: v.sku,
      categoryName: category?.name ?? '—',
      storeId: w.storeId,
      storeName: store?.name ?? '—',
      warehouseId,
      warehouseName: w.name,
      healthy: 0,
      defective: 0,
      inTransit: 0,
      minStock: p.minStock,
      reorderPoint: p.reorderPoint,
      unitName: unit?.name ?? '',
      productActive: p.isActive,
    };
    rows.set(key, row);
    return row;
  };

  for (const inv of ds.inventory) {
    const row = ensureRow(inv.variantId, inv.warehouseId);
    if (!row) continue;
    if (inv.status === 'healthy') row.healthy += inv.quantity;
    else if (inv.status === 'defective') row.defective += inv.quantity;
    else if (inv.status === 'in-transit') row.inTransit += inv.quantity;
  }

  // ردیف‌های بدون هیچ موجودی برای کالاهای فعال هم دیده شوند (در سطح انبارهای ثبت‌شده)
  if (f.stockFilter === 'all' || f.stockFilter === 'without-stock') {
    for (const w of ds.warehouses) {
      for (const v of ds.variants) {
        const p = ds.productById.get(v.productId);
        if (!p) continue;
        const key = `${v.id}|${w.id}`;
        if (!rows.has(key)) {
          ensureRow(v.id, w.id);
        }
      }
    }
  }

  let result = [...rows.values()];

  result = result.filter((r) => {
    if (f.productId !== 'all') {
      const v = ds.variantById.get(r.variantId);
      if (!v || v.productId !== f.productId) return false;
    }
    if (f.variantId !== 'all' && r.variantId !== f.variantId) return false;
    if (f.categoryId !== 'all') {
      const v = ds.variantById.get(r.variantId);
      const p = v ? ds.productById.get(v.productId) : undefined;
      if (!p || p.categoryId !== f.categoryId) return false;
    }
    if (f.storeId !== 'all' && r.storeId !== f.storeId) return false;
    if (f.warehouseId !== 'all' && r.warehouseId !== f.warehouseId) return false;
    if (f.activeFilter === 'active' && !r.productActive) return false;
    if (f.activeFilter === 'inactive' && r.productActive) return false;
    const total = r.healthy + r.defective + r.inTransit;
    if (f.stockFilter === 'with-stock' && total <= 0) return false;
    if (f.stockFilter === 'without-stock' && total > 0) return false;
    return true;
  });

  result.sort(
    (a, b) =>
      a.productName.localeCompare(b.productName, 'fa') ||
      a.warehouseName.localeCompare(b.warehouseName, 'fa')
  );
  return result;
}

// ============================================================
// ۲) گزارش کمبود و نقطه سفارش
// ============================================================
export type ShortageStatus = 'zero' | 'below-min' | 'at-reorder' | 'defective-only' | 'ok';

export interface ShortageRow {
  variantId: string;
  productName: string;
  variantSku: string;
  categoryId: string;
  categoryName: string;
  storeId: string;
  storeName: string;
  warehouseId: string;
  warehouseName: string;
  healthy: number;
  defective: number;
  minStock: number;
  reorderPoint: number;
  unitName: string;
  status: ShortageStatus;
  shortfall: number;
  suggestedOrder: number;
  storeHasCoverage: boolean; // فروشگاه کلش کافی است ولی این انبار کمبود دارد
}

export interface ShortageFilters {
  storeId: string;
  warehouseId: string;
  categoryId: string;
  productId: string;
  minStockOnly: boolean; // فقط کمبودها
  marginPercent: number; // حاشیه اطمینان
}

export function shortageReport(ds: ReportDataset, f: ShortageFilters): ShortageRow[] {
  const stockRows = stockStatusReport(ds, {
    productId: f.productId,
    variantId: 'all',
    categoryId: f.categoryId,
    storeId: f.storeId,
    warehouseId: f.warehouseId,
    activeFilter: 'all',
    stockFilter: 'all',
  });

  // موجودی کل فروشگاه برای هر واریانت (برای هشدار پوشش فروشگاه)
  const storeTotals = new Map<string, number>();
  for (const r of stockRows) {
    storeTotals.set(`${r.variantId}|${r.storeId}`, (storeTotals.get(`${r.variantId}|${r.storeId}`) ?? 0) + r.healthy);
  }

  const rows: ShortageRow[] = stockRows.map((r) => {
    let status: ShortageStatus;
    if (r.healthy === 0) status = 'zero';
    else if (r.healthy < r.minStock) status = 'below-min';
    else if (r.healthy <= r.reorderPoint && r.reorderPoint > 0) status = 'at-reorder';
    else if (r.defective > 0) status = 'defective-only';
    else status = 'ok';

    const target = r.minStock * (1 + f.marginPercent / 100);
    const storeTotal = storeTotals.get(`${r.variantId}|${r.storeId}`) ?? 0;

    return {
      variantId: r.variantId,
      productName: r.productName,
      variantSku: r.variantSku,
      categoryId: '',
      categoryName: r.categoryName,
      storeId: r.storeId,
      storeName: r.storeName,
      warehouseId: r.warehouseId,
      warehouseName: r.warehouseName,
      healthy: r.healthy,
      defective: r.defective,
      minStock: r.minStock,
      reorderPoint: r.reorderPoint,
      unitName: r.unitName,
      status,
      shortfall: Math.max(0, r.minStock - r.healthy),
      suggestedOrder: Math.max(0, Math.ceil(target - r.healthy)),
      storeHasCoverage: storeTotal >= r.minStock && r.healthy < r.minStock,
    };
  });

  const filtered = f.minStockOnly ? rows.filter((r) => r.status === 'zero' || r.status === 'below-min' || r.status === 'at-reorder') : rows;
  filtered.sort(
    (a, b) =>
      b.shortfall - a.shortfall ||
      a.productName.localeCompare(b.productName, 'fa') ||
      a.warehouseName.localeCompare(b.warehouseName, 'fa')
  );
  return filtered;
}

// ============================================================
// ۳) گزارش کالاهای بدون گردش و کم‌گردش
// ============================================================
export type DeadStockClass = 'no-movement' | 'low-movement' | 'normal';

export interface DeadStockRow {
  variantId: string;
  productName: string;
  variantSku: string;
  categoryName: string;
  unitName: string;
  totalHealthy: number;
  productActive: boolean;
  inboundOps: number;
  inboundQty: number;
  outboundOps: number;
  outboundQty: number;
  lastInDate: number | null;
  lastOutDate: number | null;
  lastMovementDate: number | null;
  daysSinceMovement: number | null;
  hasInNoOut: boolean;
  classification: DeadStockClass;
}

export interface DeadStockFilters {
  fromEpoch: number;
  toEpoch: number;
  categoryId: string;
  productId: string;
  exitThreshold: number; // آستانه کم‌گردشی (دفعات خروج)
  onlyWithStock: boolean;
  includeInactive: boolean;
}

export function deadStockReport(ds: ReportDataset, f: DeadStockFilters): DeadStockRow[] {
  // گردش واقعی شرکت: رسید/حواله/برگشت/اصلاح — انتقال داخلی محسوب نمی‌شود
  const confirmed = ds.docs.filter((d) => d.status === 'confirmed');

  const agg = new Map<
    string,
    {
      inboundOps: number;
      inboundQty: number;
      outboundOps: number;
      outboundQty: number;
      lastIn: number | null;
      lastOut: number | null;
    }
  >();

  const bump = (variantId: string, dir: 'in' | 'out', qty: number, epoch: number) => {
    let a = agg.get(variantId);
    if (!a) {
      a = { inboundOps: 0, inboundQty: 0, outboundOps: 0, outboundQty: 0, lastIn: null, lastOut: null };
      agg.set(variantId, a);
    }
    if (dir === 'in') {
      a.inboundOps += 1;
      a.inboundQty += qty;
      if (a.lastIn === null || epoch > a.lastIn) a.lastIn = epoch;
    } else {
      a.outboundOps += 1;
      a.outboundQty += qty;
      if (a.lastOut === null || epoch > a.lastOut) a.lastOut = epoch;
    }
  };

  for (const d of confirmed) {
    if (d.type === 'transfer') continue; // انتقال داخلی گردش واقعی شرکت نیست
    const lines = ds.linesByDoc.get(d.id) ?? [];
    for (const l of lines) {
      const qty = l.quantity;
      if (d.type === 'receipt') bump(l.variantId, 'in', qty, d.dateEpoch);
      else if (d.type === 'return') bump(l.variantId, 'in', qty, d.dateEpoch);
      else if (d.type === 'adjustment') {
        if (d.adjustmentDirection === 'increase') bump(l.variantId, 'in', qty, d.dateEpoch);
        else bump(l.variantId, 'out', qty, d.dateEpoch);
      } else if (d.type === 'issue') bump(l.variantId, 'out', qty, d.dateEpoch);
    }
  }

  const now = Date.now();
  const rows: DeadStockRow[] = [];

  for (const v of ds.variants) {
    const p = ds.productById.get(v.productId);
    if (!p) continue;
    if (!f.includeInactive && !p.isActive) continue;
    if (f.productId !== 'all' && v.productId !== f.productId) continue;
    if (f.categoryId !== 'all' && p.categoryId !== f.categoryId) continue;

    const a = agg.get(v.id) ?? {
      inboundOps: 0,
      inboundQty: 0,
      outboundOps: 0,
      outboundQty: 0,
      lastIn: null,
      lastOut: null,
    };

    const totalHealthy = ds.inventory
      .filter((i) => i.variantId === v.id && i.status === 'healthy')
      .reduce((s, i) => s + i.quantity, 0);

    if (f.onlyWithStock && totalHealthy <= 0) continue;

    const lastMovement =
      a.lastIn !== null || a.lastOut !== null ? Math.max(a.lastIn ?? 0, a.lastOut ?? 0) : null;
    const daysSince =
      lastMovement !== null ? Math.floor((now - lastMovement) / 86400000) : null;

    let classification: DeadStockClass = 'normal';
    if (a.outboundOps === 0 && a.inboundOps === 0) classification = 'no-movement';
    else if (a.outboundOps < f.exitThreshold) classification = 'low-movement';

    const unit = ds.unitById.get(p.mainUnitId);
    rows.push({
      variantId: v.id,
      productName: p.name,
      variantSku: v.sku,
      categoryName: ds.categoryById.get(p.categoryId)?.name ?? '—',
      unitName: unit?.name ?? '',
      totalHealthy,
      productActive: p.isActive,
      inboundOps: a.inboundOps,
      inboundQty: a.inboundQty,
      outboundOps: a.outboundOps,
      outboundQty: a.outboundQty,
      lastInDate: a.lastIn,
      lastOutDate: a.lastOut,
      lastMovementDate: lastMovement,
      daysSinceMovement: daysSince,
      hasInNoOut: a.inboundOps > 0 && a.outboundOps === 0,
      classification,
    });
  }

  rows.sort((a, b) => (b.daysSinceMovement ?? 999999) - (a.daysSinceMovement ?? 999999));
  return rows;
}

// ============================================================
// ۴) گزارش گردش کالا و ورود/خروج
// ============================================================
export interface MovementEntry {
  docId: string;
  docNumber: string;
  type: FlowOperation;
  dateJalali: string;
  dateEpoch: number;
  qtyIn: number;
  qtyOut: number;
  value: number;
}

export interface MovementRow {
  variantId: string;
  productId: string;
  productName: string;
  variantSku: string;
  categoryName: string;
  storeId: string;
  storeName: string;
  warehouseId: string;
  warehouseName: string;
  status: StockStatus;
  opening: number;
  inQty: number;
  outQty: number;
  closing: number;
  // انتقال داخلی: از سمت ورود و خروج جدا نگه داشته می‌شود تا از جمع کل فقط یک‌بار کسر شود
  internalIn: number;
  internalOut: number;
  internalTransferQty: number;
  inValue: number;
  outValue: number;
  inByOp: Partial<Record<FlowOperation, number>>;
  outByOp: Partial<Record<FlowOperation, number>>;
  entries: MovementEntry[];
}

export interface MovementFilters {
  fromEpoch: number;
  toEpoch: number;
  productId: string;
  variantId: string;
  categoryId: string;
  storeId: string;
  warehouseId: string;
  opTypes: FlowOperation[]; // خالی = همه
}

export function movementReport(
  ds: ReportDataset,
  f: MovementFilters
): { rows: MovementRow[]; totals: { opening: number; inQty: number; outQty: number; closing: number; internal: number; inValue: number; outValue: number } } {
  const rows = new Map<string, MovementRow>();
  const passesBaseFilters = (variantId: string) => {
    const v = ds.variantById.get(variantId);
    if (!v) return false;
    if (f.productId !== 'all' && v.productId !== f.productId) return false;
    if (f.variantId !== 'all' && variantId !== f.variantId) return false;
    const p = ds.productById.get(v.productId);
    if (!p) return false;
    if (f.categoryId !== 'all' && p.categoryId !== f.categoryId) return false;
    return true;
  };

  const passesWarehouseScope = (warehouseId: string) => {
    const w = ds.warehouseById.get(warehouseId);
    if (!w) return false;
    if (f.storeId !== 'all' && w.storeId !== f.storeId) return false;
    if (f.warehouseId !== 'all' && warehouseId !== f.warehouseId) return false;
    return true;
  };

  const rowFor = (variantId: string, warehouseId: string, status: StockStatus): MovementRow | null => {
    if (!passesBaseFilters(variantId)) return null;
    if (!passesWarehouseScope(warehouseId)) return null;
    if (status === 'in-transit') return null;
    const key = `${variantId}|${warehouseId}|${status}`;
    if (rows.has(key)) return rows.get(key)!;
    const v = ds.variantById.get(variantId)!;
    const p = ds.productById.get(v.productId)!;
    const w = ds.warehouseById.get(warehouseId)!;
    const row: MovementRow = {
      variantId,
      productId: v.productId,
      productName: p.name,
      variantSku: v.sku,
      categoryName: ds.categoryById.get(p.categoryId)?.name ?? '—',
      storeId: w.storeId,
      storeName: ds.storeById.get(w.storeId)?.name ?? '—',
      warehouseId,
      warehouseName: w.name,
      status,
      opening: 0,
      inQty: 0,
      outQty: 0,
      closing: 0,
      internalIn: 0,
      internalOut: 0,
      internalTransferQty: 0,
      inValue: 0,
      outValue: 0,
      inByOp: {},
      outByOp: {},
      entries: [],
    };
    rows.set(key, row);
    return row;
  };

  // موجودی پایان دوره از داده واقعی موجودی
  for (const inv of ds.inventory) {
    if (inv.status === 'in-transit') continue;
    const row = rowFor(inv.variantId, inv.warehouseId, inv.status);
    if (row) row.closing += inv.quantity;
  }

  // آیا انتقال در این scope داخلی محسوب می‌شود؟
  const transferIsInternal = (doc: Document): boolean => {
    if (f.warehouseId !== 'all') return false; // در scope انبار، انتقال واقعی است
    if (f.storeId === 'all') return true; // scope کل شرکت
    const src = ds.warehouseById.get(doc.sourceWarehouseId ?? '');
    const dst = ds.warehouseById.get(doc.destinationWarehouseId ?? '');
    return !!src && !!dst && src.storeId === f.storeId && dst.storeId === f.storeId;
  };

  const allowedTypes = (t: FlowOperation) => f.opTypes.length === 0 || f.opTypes.includes(t);

  const confirmed = ds.docs
    .filter((d) => d.status === 'confirmed')
    .filter((d) => d.dateEpoch >= f.fromEpoch && d.dateEpoch <= f.toEpoch)
    .filter((d) => allowedTypes(d.type))
    .sort((a, b) => a.dateEpoch - b.dateEpoch);

  for (const d of confirmed) {
    const lines = ds.linesByDoc.get(d.id) ?? [];
    for (const l of lines) {
      const value = l.quantity * lineEffectiveCost(l);
      if (d.type === 'receipt') {
        const row = rowFor(l.variantId, d.destinationWarehouseId ?? '', 'healthy');
        if (row) {
          row.inQty += l.quantity;
          row.inValue += value;
          row.inByOp.receipt = (row.inByOp.receipt ?? 0) + l.quantity;
          row.entries.push({ docId: d.id, docNumber: d.number, type: d.type, dateJalali: d.dateJalali, dateEpoch: d.dateEpoch, qtyIn: l.quantity, qtyOut: 0, value });
        }
      } else if (d.type === 'issue') {
        const row = rowFor(l.variantId, d.sourceWarehouseId ?? '', l.stockStatus || 'healthy');
        if (row) {
          row.outQty += l.quantity;
          row.outValue += value;
          row.outByOp.issue = (row.outByOp.issue ?? 0) + l.quantity;
          row.entries.push({ docId: d.id, docNumber: d.number, type: d.type, dateJalali: d.dateJalali, dateEpoch: d.dateEpoch, qtyIn: 0, qtyOut: l.quantity, value });
        }
      } else if (d.type === 'return') {
        const row = rowFor(l.variantId, d.destinationWarehouseId ?? '', l.stockStatus || 'healthy');
        if (row) {
          row.inQty += l.quantity;
          row.inValue += value;
          row.inByOp.return = (row.inByOp.return ?? 0) + l.quantity;
          row.entries.push({ docId: d.id, docNumber: d.number, type: d.type, dateJalali: d.dateJalali, dateEpoch: d.dateEpoch, qtyIn: l.quantity, qtyOut: 0, value });
        }
      } else if (d.type === 'adjustment') {
        const dir = d.adjustmentDirection ?? 'increase';
        const row = rowFor(l.variantId, d.sourceWarehouseId ?? '', l.stockStatus || 'healthy');
        if (row) {
          if (dir === 'increase') {
            row.inQty += l.quantity;
            row.inValue += value;
            row.inByOp.adjustment = (row.inByOp.adjustment ?? 0) + l.quantity;
            row.entries.push({ docId: d.id, docNumber: d.number, type: d.type, dateJalali: d.dateJalali, dateEpoch: d.dateEpoch, qtyIn: l.quantity, qtyOut: 0, value });
          } else {
            row.outQty += l.quantity;
            row.outValue += value;
            row.outByOp.adjustment = (row.outByOp.adjustment ?? 0) + l.quantity;
            row.entries.push({ docId: d.id, docNumber: d.number, type: d.type, dateJalali: d.dateJalali, dateEpoch: d.dateEpoch, qtyIn: 0, qtyOut: l.quantity, value });
          }
        }
      } else if (d.type === 'transfer') {
        const internal = transferIsInternal(d);
        const srcRow = rowFor(l.variantId, d.sourceWarehouseId ?? '', 'healthy');
        if (srcRow) {
          srcRow.outQty += l.quantity;
          srcRow.outValue += value;
          srcRow.outByOp.transfer = (srcRow.outByOp.transfer ?? 0) + l.quantity;
          if (internal) {
            srcRow.internalOut += l.quantity;
            srcRow.internalTransferQty += l.quantity;
          }
          srcRow.entries.push({ docId: d.id, docNumber: d.number, type: d.type, dateJalali: d.dateJalali, dateEpoch: d.dateEpoch, qtyIn: 0, qtyOut: l.quantity, value });
        }
        const dstRow = rowFor(l.variantId, d.destinationWarehouseId ?? '', 'healthy');
        if (dstRow) {
          dstRow.inQty += l.quantity;
          dstRow.inValue += value;
          dstRow.inByOp.transfer = (dstRow.inByOp.transfer ?? 0) + l.quantity;
          if (internal) {
            dstRow.internalIn += l.quantity;
            dstRow.internalTransferQty += l.quantity;
          }
          dstRow.entries.push({ docId: d.id, docNumber: d.number, type: d.type, dateJalali: d.dateJalali, dateEpoch: d.dateEpoch, qtyIn: l.quantity, qtyOut: 0, value });
        }
      }
    }
  }

  // موجودی اول دوره = پایان دوره − خالص گردش بازه
  const result = [...rows.values()];
  for (const r of result) {
    r.opening = r.closing - (r.inQty - r.outQty);
  }

  // جمع کل — انتقال داخلی از ورود/خروج واقعی تفکیک می‌شود
  const totals = result.reduce(
    (acc, r) => {
      acc.opening += r.opening;
      acc.closing += r.closing;
      acc.inQty += r.inQty - r.internalIn;
      acc.outQty += r.outQty - r.internalOut;
      acc.internal += r.internalIn + r.internalOut;
      acc.inValue += r.inValue;
      acc.outValue += r.outValue;
      return acc;
    },
    { opening: 0, inQty: 0, outQty: 0, closing: 0, internal: 0, inValue: 0, outValue: 0 }
  );

  result.sort(
    (a, b) =>
      a.productName.localeCompare(b.productName, 'fa') ||
      a.warehouseName.localeCompare(b.warehouseName, 'fa')
  );

  return { rows: result, totals };
}

// جمع ورود/خروج یک بازه دلخواه (برای مقایسه بازه‌ها) — در سطح scope فعلی
export function movementTotals(
  ds: ReportDataset,
  fromEpoch: number,
  toEpoch: number,
  base: MovementFilters
): { inQty: number; outQty: number; inValue: number; outValue: number } {
  const { rows, totals } = movementReport(ds, { ...base, fromEpoch, toEpoch });
  void rows;
  return {
    inQty: totals.inQty,
    outQty: totals.outQty,
    inValue: totals.inValue,
    outValue: totals.outValue,
  };
}

// ============================================================
// ۵) گزارش ارزش موجودی و بهای خرید
// ============================================================
export interface ValueRow {
  variantId: string;
  productName: string;
  variantSku: string;
  categoryName: string;
  unitName: string;
  healthyQty: number;
  healthyValue: number;
  defectiveQty: number;
  defectiveValue: number;
  inTransitQty: number;
  inTransitValue: number;
  totalValue: number;
  avgCost: number;
  lastPurchasePrice: number | null;
  lastPurchaseDateJalali: string | null;
  sharePercent: number;
}

export interface ValueFilters {
  productId: string;
  categoryId: string;
  storeId: string;
  warehouseId: string;
}

export function valueReport(
  ds: ReportDataset,
  f: ValueFilters
): {
  rows: ValueRow[];
  storeGroups: { name: string; value: number }[];
  warehouseGroups: { name: string; value: number }[];
  totals: { healthy: number; defective: number; inTransit: number; total: number };
} {
  const variantAgg = new Map<
    string,
    { healthyQty: number; healthyValue: number; defectiveQty: number; defectiveValue: number; inTransitQty: number; inTransitValue: number }
  >();
  const storeGroups = new Map<string, number>();
  const warehouseGroups = new Map<string, number>();

  const passesScope = (warehouseId: string) => {
    const w = ds.warehouseById.get(warehouseId);
    if (!w) return false;
    if (f.storeId !== 'all' && w.storeId !== f.storeId) return false;
    if (f.warehouseId !== 'all' && warehouseId !== f.warehouseId) return false;
    return true;
  };

  for (const inv of ds.inventory) {
    if (!passesScope(inv.warehouseId)) continue;
    const v = ds.variantById.get(inv.variantId);
    if (!v) continue;
    const p = ds.productById.get(v.productId);
    if (!p) continue;
    if (f.productId !== 'all' && v.productId !== f.productId) continue;
    if (f.categoryId !== 'all' && p.categoryId !== f.categoryId) continue;

    const value = inv.quantity * inv.averageCost;
    let a = variantAgg.get(inv.variantId);
    if (!a) {
      a = { healthyQty: 0, healthyValue: 0, defectiveQty: 0, defectiveValue: 0, inTransitQty: 0, inTransitValue: 0 };
      variantAgg.set(inv.variantId, a);
    }
    if (inv.status === 'healthy') {
      a.healthyQty += inv.quantity;
      a.healthyValue += value;
    } else if (inv.status === 'defective') {
      a.defectiveQty += inv.quantity;
      a.defectiveValue += value;
    } else {
      a.inTransitQty += inv.quantity;
      a.inTransitValue += value;
    }

    const w = ds.warehouseById.get(inv.warehouseId)!;
    warehouseGroups.set(w.name, (warehouseGroups.get(w.name) ?? 0) + value);
    const storeName = ds.storeById.get(w.storeId)?.name ?? '—';
    storeGroups.set(storeName, (storeGroups.get(storeName) ?? 0) + value);
  }

  // آخرین قیمت خرید ثبت‌شده (رسید تأییدشده با جدیدترین تاریخ)
  const lastPurchase = new Map<string, { price: number; dateJalali: string; epoch: number }>();
  const receiptDocs = ds.docs
    .filter((d) => d.type === 'receipt' && d.status === 'confirmed')
    .sort((a, b) => a.dateEpoch - b.dateEpoch);
  for (const d of receiptDocs) {
    const lines = ds.linesByDoc.get(d.id) ?? [];
    for (const l of lines) {
      const cur = lastPurchase.get(l.variantId);
      if (!cur || d.dateEpoch >= cur.epoch) {
        lastPurchase.set(l.variantId, { price: lineEffectiveCost(l), dateJalali: d.dateJalali, epoch: d.dateEpoch });
      }
    }
  }

  const grandTotal = [...variantAgg.values()].reduce((s, a) => s + a.healthyValue + a.defectiveValue + a.inTransitValue, 0);

  const rows: ValueRow[] = [];
  for (const [variantId, a] of variantAgg) {
    const v = ds.variantById.get(variantId)!;
    const p = ds.productById.get(v.productId)!;
    const totalValue = a.healthyValue + a.defectiveValue + a.inTransitValue;
    const totalQty = a.healthyQty + a.defectiveQty + a.inTransitQty;
    const lp = lastPurchase.get(variantId);
    const unit = ds.unitById.get(p.mainUnitId);
    rows.push({
      variantId,
      productName: p.name,
      variantSku: v.sku,
      categoryName: ds.categoryById.get(p.categoryId)?.name ?? '—',
      unitName: unit?.name ?? '',
      healthyQty: a.healthyQty,
      healthyValue: a.healthyValue,
      defectiveQty: a.defectiveQty,
      defectiveValue: a.defectiveValue,
      inTransitQty: a.inTransitQty,
      inTransitValue: a.inTransitValue,
      totalValue,
      avgCost: totalQty > 0 ? totalValue / totalQty : 0,
      lastPurchasePrice: lp?.price ?? null,
      lastPurchaseDateJalali: lp?.dateJalali ?? null,
      sharePercent: grandTotal > 0 ? (totalValue / grandTotal) * 100 : 0,
    });
  }

  rows.sort((a, b) => b.totalValue - a.totalValue);

  const totals = {
    healthy: [...variantAgg.values()].reduce((s, a) => s + a.healthyValue, 0),
    defective: [...variantAgg.values()].reduce((s, a) => s + a.defectiveValue, 0),
    inTransit: [...variantAgg.values()].reduce((s, a) => s + a.inTransitValue, 0),
    total: grandTotal,
  };

  return {
    rows,
    storeGroups: [...storeGroups.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    warehouseGroups: [...warehouseGroups.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    totals,
  };
}
