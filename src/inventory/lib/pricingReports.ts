import { db } from './db';
import type {
  Category,
  Document,
  DocumentLine,
  Inventory,
  Product,
  SalesChannel,
  Variant,
} from '../types';
import { breakevenBasePrice, estimateSaleFees } from './pricing';

// ============================================================
// دادهٔ گزارش‌های قیمت‌گذاری و سودآوری
// - فروش واقعی = ردیف حواله‌های تأییدشدهٔ نوع فروش با قیمت ثبت‌شده
// - هزینه‌های فروش روی فروش واقعی «برآوردی» است (تنظیمات فعلی کانال)
// ============================================================

export interface PricingDataset {
  docs: Document[];
  linesByDoc: Map<string, DocumentLine[]>;
  products: Product[];
  variants: Variant[];
  categories: Category[];
  channels: SalesChannel[];
  inventory: Inventory[];
}

export async function buildPricingDataset(): Promise<PricingDataset> {
  const [docs, lines, products, variants, categories, channels, inventory] = await Promise.all([
    db.documents.toArray(),
    db.documentLines.toArray(),
    db.products.toArray(),
    db.variants.toArray(),
    db.categories.toArray(),
    db.salesChannels.toArray(),
    db.inventory.toArray(),
  ]);

  const linesByDoc = new Map<string, DocumentLine[]>();
  for (const l of lines) {
    const arr = linesByDoc.get(l.documentId) ?? [];
    arr.push(l);
    linesByDoc.set(l.documentId, arr);
  }

  return { docs, linesByDoc, products, variants, categories, channels, inventory };
}

// ---------- فروش‌های قیمت‌دار (تأییدشده، نوع فروش، قیمت ثبت‌شده) ----------
export interface PricedSale {
  doc: Document;
  line: DocumentLine;
  variant: Variant;
  product: Product;
  channel: SalesChannel | null;
  quantity: number;
  unitPrice: number;
  revenue: number; // درآمد فروش
  unitCost: number; // بهای موثر ثبت‌شده در لحظهٔ فروش
  cogs: number;
  fees: number; // برآوردی با تنظیمات فعلی کانال
  net: number; // دریافتی خالص برآوردی
  profit: number; // سود برآوردی
  marginPercent: number;
  soldAt: number; // epoch تأیید سند
}

export function pricedSales(ds: PricingDataset): PricedSale[] {
  const variantById = new Map(ds.variants.map((v) => [v.id, v]));
  const productById = new Map(ds.products.map((p) => [p.id, p]));
  const channelById = new Map(ds.channels.map((c) => [c.id, c]));

  const out: PricedSale[] = [];
  for (const doc of ds.docs) {
    if (doc.type !== 'issue' || doc.status !== 'confirmed' || doc.issueType !== 'sale') continue;
    const lines = ds.linesByDoc.get(doc.id) ?? [];
    const channel = doc.channelId ? channelById.get(doc.channelId) ?? null : null;
    const feesConfig = channel?.fees ?? [];

    for (const line of lines) {
      if (!line.salePrice || line.salePrice <= 0) continue;
      const variant = variantById.get(line.variantId);
      if (!variant) continue;
      const product = productById.get(variant.productId);
      if (!product) continue;

      const quantity = line.quantity;
      const unitPrice = line.salePrice;
      const revenue = unitPrice * quantity;
      const unitCost = line.effectiveCost ?? line.unitCost;
      const cogs = unitCost * quantity;
      const fees = estimateSaleFees(feesConfig, unitPrice, quantity);
      const net = revenue - fees;
      const profit = net - cogs;

      out.push({
        doc,
        line,
        variant,
        product,
        channel,
        quantity,
        unitPrice,
        revenue,
        unitCost,
        cogs,
        fees,
        net,
        profit,
        marginPercent: revenue > 0 ? (profit / revenue) * 100 : 0,
        soldAt: doc.confirmedAt ?? doc.dateEpoch,
      });
    }
  }
  out.sort((a, b) => b.soldAt - a.soldAt);
  return out;
}

// ---------- موجودی کل یک تنوع به تفکیک وضعیت ----------
export interface VariantStock {
  healthy: number;
  defective: number;
  inTransit: number;
  avgCost: number;
  value: number; // avgCost × healthy
}

export function variantStock(ds: PricingDataset, variantId: string): VariantStock {
  const rows = ds.inventory.filter((i) => i.variantId === variantId);
  const get = (status: string) =>
    rows.filter((i) => i.status === status).reduce((s, i) => s + i.quantity, 0);
  const healthy = get('healthy');
  const defective = get('defective');
  const inTransit = get('in-transit');
  const healthyRows = rows.filter((i) => i.status === 'healthy' && i.quantity > 0);
  const totalQty = healthyRows.reduce((s, i) => s + i.quantity, 0);
  let avgCost = 0;
  if (totalQty > 0) {
    avgCost = healthyRows.reduce((s, i) => s + i.quantity * i.averageCost, 0) / totalQty;
  } else {
    avgCost = rows.find((i) => i.averageCost > 0)?.averageCost ?? 0;
  }
  return { healthy, defective, inTransit, avgCost, value: avgCost * healthy };
}

// ---------- فیلتر بازهٔ زمانی ----------
export function withinDays(epoch: number, days: number | null): boolean {
  if (!days) return true;
  return epoch >= Date.now() - days * 86400000;
}

export { breakevenBasePrice, estimateSaleFees };
