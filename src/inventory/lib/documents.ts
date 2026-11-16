import { db } from './db';
import { uid } from './ids';
import type {
  Document,
  DocumentLine,
  CountLine,
  FlowOperation,
  StockStatus,
  CountMode,
  AdjustmentDirection,
} from '../types';
import {
  applyInbound,
  applyOutbound,
  applyTransferStart,
  applyTransferComplete,
  revertDocumentEffects,
  getWarehouseStock,
  getVariantAverageCost,
  peekInventory,
  assertNoOpenCount,
} from './inventory';

// شماره سند بعدی = بیشترین شماره موجود + ۱ (مقاوم در برابر حذف اسناد)
async function nextNumberFor(type: FlowOperation): Promise<string> {
  const docs = await db.documents.where('type').equals(type).toArray();
  const max = docs.reduce((m, d) => {
    const n = parseInt(d.number, 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return String(max + 1);
}

// نام کالاها برای پیام‌های خطای گویا
async function variantNameMap(variantIds: string[]) {
  const unique = [...new Set(variantIds)];
  const variantRows = await db.variants.bulkGet(unique);
  const productIdSet = new Set(variantRows.filter(Boolean).map((v) => v!.productId));
  const productRows = await db.products.bulkGet([...productIdSet]);
  const nameOf = (variantId: string): string => {
    const v = variantRows.find((x) => x?.id === variantId);
    const p = v ? productRows.find((x) => x?.id === v.productId) : undefined;
    return p?.name ?? v?.name ?? variantId;
  };
  return { nameOf };
}

// میانگین جاری متناسب با وضعیت ردیف — معیوب میانگین مستقل خودش را دارد
async function statusAwareAvg(
  variantId: string,
  warehouseId: string,
  status: StockStatus
): Promise<number> {
  if (status === 'healthy') return getVariantAverageCost(variantId);
  const row = await peekInventory(variantId, warehouseId, 'defective');
  const healthyAvg = await getVariantAverageCost(variantId);
  return row && row.averageCost > 0 ? row.averageCost : healthyAvg;
}

// ====== ایجاد پیش‌نویس ======
export async function createDraftDocument(input: {
  type: FlowOperation;
  storeId: string;
  sourceWarehouseId: string | null;
  destinationWarehouseId: string | null;
  dateJalali: string;
  dateEpoch: number;
  note: string | null;
  supplier: string | null;
  referenceNumber: string | null;
  recipient: string | null;
  issueType: string | null;
  channelId?: string | null;
  shippingCost: number;
  otherExpenses: number;
  referenceDocId?: string | null;
  adjustmentDirection?: AdjustmentDirection | null;
  adjustmentReason?: string | null;
  countMode?: CountMode | null;
  lines: Omit<DocumentLine, 'id' | 'documentId'>[];
}): Promise<Document> {
  const number = await nextNumberFor(input.type);
  const discountTotal = input.lines.reduce((s, l) => s + l.discount, 0);
  const linesTotal = input.lines.reduce((s, l) => s + l.lineTotal, 0);
  // مبلغ نهایی سند = جمع اقلام + هزینه حمل + سایر هزینه‌ها
  const totalAmount = linesTotal + (input.shippingCost || 0) + (input.otherExpenses || 0);

  const doc: Document = {
    id: uid(),
    number,
    type: input.type,
    status: 'draft',
    storeId: input.storeId,
    sourceWarehouseId: input.sourceWarehouseId,
    destinationWarehouseId: input.destinationWarehouseId,
    dateJalali: input.dateJalali,
    dateEpoch: input.dateEpoch,
    referenceDocId: input.referenceDocId ?? null,
    note: input.note,
    supplier: input.supplier,
    referenceNumber: input.referenceNumber,
    recipient: input.recipient,
    issueType: input.issueType,
    channelId: input.channelId ?? null,
    shippingCost: input.shippingCost || 0,
    otherExpenses: input.otherExpenses || 0,
    discountTotal,
    totalAmount,
    adjustmentDirection: input.adjustmentDirection ?? null,
    adjustmentReason: input.adjustmentReason ?? null,
    countMode: input.countMode ?? null,
    createdAt: Date.now(),
    confirmedAt: null,
    reversedAt: null,
  };
  await db.documents.add(doc);

  const lines: DocumentLine[] = input.lines.map((l) => ({
    ...l,
    id: uid(),
    documentId: doc.id,
  }));
  await db.documentLines.bulkAdd(lines);

  return doc;
}

// ====== به‌روزرسانی پیش‌نویس ======
export async function updateDraftDocument(
  docId: string,
  input: Partial<Omit<Document, 'id' | 'status' | 'number'>> & {
    lines?: Omit<DocumentLine, 'id' | 'documentId'>[];
  }
): Promise<void> {
  const doc = await db.documents.get(docId);
  if (!doc || doc.status !== 'draft') {
    throw new Error('فقط پیش‌نویس‌ها قابل ویرایش هستند');
  }

  const { lines, ...rest } = input;

  // حذف تمام ردیف‌های قبلی و درج جدید
  if (lines) {
    await db.documentLines.where('documentId').equals(docId).delete();
    const newLines: DocumentLine[] = lines.map((l) => ({
      ...l,
      id: uid(),
      documentId: docId,
    }));
    await db.documentLines.bulkAdd(newLines);

    const discountTotal = newLines.reduce((s, l) => s + l.discount, 0);
    const linesTotal = newLines.reduce((s, l) => s + l.lineTotal, 0);
    const shippingCost = rest.shippingCost ?? doc.shippingCost ?? 0;
    const otherExpenses = rest.otherExpenses ?? doc.otherExpenses ?? 0;

    await db.documents.update(docId, {
      ...rest,
      shippingCost,
      otherExpenses,
      discountTotal,
      totalAmount: linesTotal + shippingCost + otherExpenses,
    });
  } else {
    await db.documents.update(docId, rest);
  }
}

// توزیع تناسبی هزینه‌های سند رسید (حمل + سایر) بین اقلام بر مبنای ارزش خالص ردیف‌ها
// خروجی: بهای موثر هر ردیف برای ورود به موجودی
function allocateExpenses(
  lines: Omit<DocumentLine, 'id' | 'documentId'>[],
  shippingCost: number,
  otherExpenses: number
): number[] {
  const totalExtra = (shippingCost || 0) + (otherExpenses || 0);
  const basis = lines.map((l) => Math.max(0, l.lineTotal));
  const totalBasis = basis.reduce((s, v) => s + v, 0);

  if (totalExtra <= 0 || totalBasis <= 0) {
    return lines.map((l) => (l.quantity > 0 ? l.lineTotal / l.quantity : l.unitCost));
  }

  const result: number[] = [];
  let allocated = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    // خط آخر باقیمانده را می‌گیرد تا جمع تخصیص دقیقاً برابر کل هزینه شود
    const share =
      i === lines.length - 1
        ? totalExtra - allocated
        : totalExtra * (basis[i] / totalBasis);
    if (i < lines.length - 1) allocated += share;
    const effective = l.quantity > 0 ? (l.lineTotal + share) / l.quantity : l.unitCost;
    result.push(effective);
  }
  return result;
}

// ====== مقدار قابل برگشت هر Variant از سند مرجع ======
// قابل برگشت = مقدار خروج اولیه − مجموع برگشت‌های تأییدشده قبلی
export interface ReturnableInfo {
  initial: number;
  returned: number;
  remaining: number;
  refCost: number;
}

export async function getReturnableByVariant(
  refDocId: string,
  excludeReturnDocId?: string
): Promise<Map<string, ReturnableInfo>> {
  const map = new Map<string, ReturnableInfo>();
  const ref = await db.documents.get(refDocId);
  if (!ref) return map;

  const refLines = await db.documentLines.where('documentId').equals(refDocId).toArray();
  for (const l of refLines) {
    const cur = map.get(l.variantId) ?? { initial: 0, returned: 0, remaining: 0, refCost: 0 };
    cur.initial += l.quantity;
    if (cur.refCost === 0 && l.unitCost > 0) cur.refCost = l.unitCost;
    map.set(l.variantId, cur);
  }

  const returns = await db.documents
    .where('referenceDocId')
    .equals(refDocId)
    .filter((d) => d.type === 'return' && d.status === 'confirmed' && d.id !== excludeReturnDocId)
    .toArray();

  for (const r of returns) {
    const rLines = await db.documentLines.where('documentId').equals(r.id).toArray();
    for (const l of rLines) {
      const cur = map.get(l.variantId);
      if (cur) cur.returned += l.quantity;
    }
  }

  for (const v of map.values()) v.remaining = Math.max(0, v.initial - v.returned);
  return map;
}

// ====== تأیید پیش‌نویس (اعمال اثر موجودی) ======
export async function confirmDraftDocument(docId: string): Promise<void> {
  const doc = await db.documents.get(docId);
  if (!doc || doc.status !== 'draft') {
    throw new Error('سند برای تأیید معتبر نیست');
  }

  const lines = await db.documentLines.where('documentId').equals(docId).toArray();
  if (lines.length === 0 && doc.type !== 'count') throw new Error('سند بدون قلم قابل تأیید نیست');

  // اعمال اثر موجودی
  if (doc.type === 'receipt') {
    await assertNoOpenCount([doc.destinationWarehouseId], doc.id);
    // هزینه حمل و سایر هزینه‌ها به‌صورت تناسبی در بهای تمام‌شده اقلام توزیع می‌شود
    const effectiveCosts = allocateExpenses(lines, doc.shippingCost, doc.otherExpenses);
    for (let i = 0; i < lines.length; i++) {
      await applyInbound(
        lines[i].variantId,
        doc.destinationWarehouseId!,
        lines[i].quantity,
        effectiveCosts[i],
        'healthy'
      );
      await db.documentLines.update(lines[i].id, { effectiveCost: effectiveCosts[i] });
    }
  } else if (doc.type === 'issue') {
    await assertNoOpenCount([doc.sourceWarehouseId], doc.id);
    const { nameOf } = await variantNameMap(lines.map((l) => l.variantId));
    // چک موجودی بر اساس وضعیت هر ردیف (سالم/معیوب)
    for (const l of lines) {
      const st = l.stockStatus || 'healthy';
      const avail = await getWarehouseStock(l.variantId, doc.sourceWarehouseId!, st);
      if (avail < l.quantity) {
        throw new Error(
          `موجودی «${nameOf(l.variantId)}» در انبار کافی نیست (موجودی: ${avail.toLocaleString('en-US')})`
        );
      }
    }
    for (const l of lines) {
      const st = l.stockStatus || 'healthy';
      // بهای موثر خروج = میانگین موزون جاری همان وضعیت
      const cost = await statusAwareAvg(l.variantId, doc.sourceWarehouseId!, st);
      await applyOutbound(l.variantId, doc.sourceWarehouseId!, l.quantity, st);
      await db.documentLines.update(l.id, { effectiveCost: cost });
    }
  } else if (doc.type === 'transfer') {
    await assertNoOpenCount([doc.sourceWarehouseId, doc.destinationWarehouseId], doc.id);
    for (const l of lines) {
      await applyTransferStart(l.variantId, doc.sourceWarehouseId!, l.quantity);
    }
    // در این نسخه، انتقال بلافاصله تکمیل می‌شود (بدون مرحله در انتظار)
    for (const l of lines) {
      await applyTransferComplete(
        l.variantId,
        doc.sourceWarehouseId!,
        doc.destinationWarehouseId!,
        l.quantity
      );
      // انتقال اثر مالی ندارد؛ بهای موثر = میانگین جاری برای گزارش‌ها
      const avg = await getVariantAverageCost(l.variantId);
      await db.documentLines.update(l.id, { effectiveCost: avg });
    }
  } else if (doc.type === 'return') {
    // ====== برگشت کالا ======
    await assertNoOpenCount([doc.destinationWarehouseId], doc.id);

    if (!doc.referenceDocId) throw new Error('برگشت بدون سند مرجع مجاز نیست');
    const ref = await db.documents.get(doc.referenceDocId);
    if (!ref || ref.type !== 'issue' || ref.status !== 'confirmed') {
      throw new Error('سند مرجع معتبر نیست (باید حواله تأییدشده باشد)');
    }
    if (ref.storeId !== doc.storeId) {
      throw new Error('فروشگاه سند برگشت باید با فروشگاه سند مرجع یکسان باشد');
    }

    // کنترل نهایی سقف برگشت در لحظه تأیید (پیش‌نویس‌های دیگر رزرو نمی‌کنند)
    const returnable = await getReturnableByVariant(doc.referenceDocId, doc.id);
    const { nameOf } = await variantNameMap(lines.map((l) => l.variantId));
    for (const l of lines) {
      if (l.quantity <= 0) throw new Error('تعداد برگشت هر ردیف باید بزرگتر از صفر باشد');
      const info = returnable.get(l.variantId);
      if (!info) throw new Error(`کالای «${nameOf(l.variantId)}» در سند مرجع وجود ندارد`);
      if (l.quantity > info.remaining) {
        throw new Error(
          `مجموع برگشت «${nameOf(l.variantId)}» از مقدار قابل برگشت بیشتر است (باقی‌مانده مجاز: ${info.remaining.toLocaleString('en-US')})`
        );
      }
    }

    // ورود به انبار مقصد در وضعیت سالم یا معیوب (مستقل) با بهای سند مرجع
    for (const l of lines) {
      await applyInbound(
        l.variantId,
        doc.destinationWarehouseId!,
        l.quantity,
        l.unitCost,
        l.stockStatus || 'healthy'
      );
      await db.documentLines.update(l.id, { effectiveCost: l.unitCost });
    }
  } else if (doc.type === 'adjustment') {
    // ====== اصلاح موجودی ======
    const direction = doc.adjustmentDirection;
    if (!direction) throw new Error('نوع اصلاح (افزایش/کاهش) مشخص نیست');
    if (!doc.adjustmentReason) throw new Error('علت اصلاح الزامی است');

    await assertNoOpenCount([doc.sourceWarehouseId], doc.id);

    const { nameOf } = await variantNameMap(lines.map((l) => l.variantId));

    // اعتبارسنجی و محاسبه بهای موثر + موجودی قبل/بعد در لحظه ثبت نهایی
    interface AdjustPlan {
      line: DocumentLine;
      effective: number;
      before: number;
      after: number;
    }
    const plans: AdjustPlan[] = [];

    for (const l of lines) {
      const st = l.stockStatus || 'healthy';
      if (l.quantity <= 0) throw new Error('تعداد اصلاح باید بزرگتر از صفر باشد');
      const before = await getWarehouseStock(l.variantId, doc.sourceWarehouseId!, st);

      if (direction === 'increase') {
        if (l.unitCost <= 0) {
          throw new Error(
            `بهای واحد برای اصلاح افزایشی کالای «${nameOf(l.variantId)}» الزامی است`
          );
        }
        plans.push({ line: l, effective: l.unitCost, before, after: before + l.quantity });
      } else {
        if (l.quantity > before) {
          throw new Error(
            `موجودی «${nameOf(l.variantId)}» برای کسر کافی نیست (موجودی فعلی: ${before.toLocaleString('en-US')})`
          );
        }
        const cost = await statusAwareAvg(l.variantId, doc.sourceWarehouseId!, st);
        plans.push({ line: l, effective: cost, before, after: before - l.quantity });
      }
    }

    // اعمال اثر و ثبت ممیزی
    let total = 0;
    for (const p of plans) {
      const st = p.line.stockStatus || 'healthy';
      if (direction === 'increase') {
        await applyInbound(
          p.line.variantId,
          doc.sourceWarehouseId!,
          p.line.quantity,
          p.effective,
          st
        );
      } else {
        await applyOutbound(
          p.line.variantId,
          doc.sourceWarehouseId!,
          p.line.quantity,
          st
        );
      }
      const lineTotal = p.line.quantity * p.effective;
      total += lineTotal;
      await db.documentLines.update(p.line.id, {
        effectiveCost: p.effective,
        balanceBefore: p.before,
        balanceAfter: p.after,
        lineTotal,
      });
    }
    await db.documents.update(docId, { totalAmount: total });
  } else if (doc.type === 'count') {
    throw new Error('انبارگردانی از مسیر تأیید اختصاصی خود ثبت می‌شود');
  }

  await db.documents.update(docId, {
    status: 'confirmed',
    confirmedAt: Date.now(),
  });
}

// ============================================================
// انبارگردانی — ایجاد و ویرایش پیش‌نویس شمارش
// ============================================================
export interface CountLineInput {
  variantId: string;
  unitId: string;
  systemHealthy: number;
  countedHealthy: number | null;
  systemDefective: number;
  countedDefective: number | null;
  note: string | null;
}

export async function createCountDraft(input: {
  storeId: string;
  warehouseId: string;
  dateJalali: string;
  dateEpoch: number;
  note: string | null;
  countMode: CountMode;
  lines: CountLineInput[];
}): Promise<Document> {
  // فقط یک انبارگردانی باز برای هر انبار
  const open = await db.documents
    .where('type')
    .equals('count')
    .filter((d) => d.status === 'draft' && d.sourceWarehouseId === input.warehouseId)
    .toArray();
  if (open.length > 0) {
    throw new Error(
      `برای این انبار یک انبارگردانی باز وجود دارد (سند #${open[0].number}). ابتدا آن را تأیید یا حذف کنید.`
    );
  }

  const number = await nextNumberFor('count');
  const doc: Document = {
    id: uid(),
    number,
    type: 'count',
    status: 'draft',
    storeId: input.storeId,
    sourceWarehouseId: input.warehouseId,
    destinationWarehouseId: null,
    dateJalali: input.dateJalali,
    dateEpoch: input.dateEpoch,
    referenceDocId: null,
    note: input.note,
    supplier: null,
    referenceNumber: null,
    recipient: null,
    issueType: null,
    channelId: null,
    shippingCost: 0,
    otherExpenses: 0,
    discountTotal: 0,
    totalAmount: 0,
    adjustmentDirection: null,
    adjustmentReason: null,
    countMode: input.countMode,
    createdAt: Date.now(),
    confirmedAt: null,
    reversedAt: null,
  };
  await db.documents.add(doc);

  const lines: CountLine[] = input.lines.map((l) => ({
    ...l,
    id: uid(),
    documentId: doc.id,
  }));
  await db.countLines.bulkAdd(lines);
  return doc;
}

export async function updateCountDraft(
  docId: string,
  input: {
    dateJalali: string;
    dateEpoch: number;
    note: string | null;
    lines: CountLineInput[];
  }
): Promise<void> {
  const doc = await db.documents.get(docId);
  if (!doc || doc.type !== 'count' || doc.status !== 'draft') {
    throw new Error('فقط پیش‌نویس انبارگردانی قابل ویرایش است');
  }
  await db.documents.update(docId, {
    dateJalali: input.dateJalali,
    dateEpoch: input.dateEpoch,
    note: input.note,
  });
  await db.countLines.where('documentId').equals(docId).delete();
  const lines: CountLine[] = input.lines.map((l) => ({
    ...l,
    id: uid(),
    documentId: docId,
  }));
  await db.countLines.bulkAdd(lines);
}

export async function countLinesFor(docId: string): Promise<CountLine[]> {
  return db.countLines.where('documentId').equals(docId).toArray();
}

// ============================================================
// تأیید انبارگردانی — اتمیک: ایجاد اسناد اصلاح + اعمال + تغییر وضعیت
// ============================================================
export async function confirmCountDocument(docId: string): Promise<string[]> {
  const doc = await db.documents.get(docId);
  if (!doc || doc.type !== 'count') throw new Error('سند انبارگردانی معتبر نیست');
  if (doc.status !== 'draft') throw new Error('فقط پیش‌نویس انبارگردانی قابل تأیید است');

  const wh = doc.sourceWarehouseId!;
  const lines = await db.countLines.where('documentId').equals(docId).toArray();
  const counted = lines.filter((l) => l.countedHealthy !== null || l.countedDefective !== null);
  if (counted.length === 0) {
    throw new Error('هیچ ردیفی شمارش نشده است. تعداد شمارش‌شده را وارد کنید.');
  }

  const { nameOf } = await variantNameMap(lines.map((l) => l.variantId));

  // اعتبارسنجی نسخه موجودی: مبنای شمارش نباید از زمان ایجاد تغییر کرده باشد
  for (const l of lines) {
    const sysH = await getWarehouseStock(l.variantId, wh, 'healthy');
    const sysD = await getWarehouseStock(l.variantId, wh, 'defective');
    if (sysH !== l.systemHealthy || sysD !== l.systemDefective) {
      throw new Error(
        `مبنای شمارش کالای «${nameOf(l.variantId)}» تغییر کرده است. این پیش‌نویس را حذف و انبارگردانی را دوباره ایجاد کنید.`
      );
    }
  }

  // اختلاف‌های مثبت و منفی به‌صورت جداگانه برای وضعیت سالم و معیوب
  interface Diff {
    variantId: string;
    unitId: string;
    status: StockStatus;
    qty: number; // مثبت = افزایش، منفی = کاهش
    before: number;
    after: number;
  }
  const diffs: Diff[] = [];
  for (const l of lines) {
    if (l.countedHealthy !== null) {
      const dh = l.countedHealthy - l.systemHealthy;
      if (dh !== 0) {
        diffs.push({
          variantId: l.variantId,
          unitId: l.unitId,
          status: 'healthy',
          qty: dh,
          before: l.systemHealthy,
          after: l.countedHealthy,
        });
      }
    }
    if (l.countedDefective !== null) {
      const dd = l.countedDefective - l.systemDefective;
      if (dd !== 0) {
        diffs.push({
          variantId: l.variantId,
          unitId: l.unitId,
          status: 'defective',
          qty: dd,
          before: l.systemDefective,
          after: l.countedDefective,
        });
      }
    }
  }

  const createdIds: string[] = [];

  await db.transaction(
    'rw',
    db.documents,
    db.documentLines,
    db.countLines,
    db.inventory,
    async () => {
      for (const direction of ['increase', 'decrease'] as const) {
        const rows = direction === 'increase' ? diffs.filter((d) => d.qty > 0) : diffs.filter((d) => d.qty < 0);
        if (rows.length === 0) continue;

        const number = await nextNumberFor('adjustment');
        const nowTs = Date.now();
        const newLines: DocumentLine[] = [];
        let total = 0;

        for (const d of rows) {
          const qty = Math.abs(d.qty);
          // مبنای ارزش‌گذاری معتبر: میانگین جاری همان وضعیت (با میانگین موزون سازگار است)
          const cost = await statusAwareAvg(d.variantId, wh, d.status);
          const lineTotal = qty * cost;
          total += lineTotal;
          newLines.push({
            id: uid(),
            documentId: '',
            variantId: d.variantId,
            quantity: qty,
            unitId: d.unitId,
            unitCost: cost,
            discount: 0,
            lineTotal,
            stockStatus: d.status,
            note: null,
            effectiveCost: cost,
            balanceBefore: d.before,
            balanceAfter: d.after,
            salePrice: null,
          });
          if (direction === 'increase') {
            await applyInbound(d.variantId, wh, qty, cost, d.status);
          } else {
            await applyOutbound(d.variantId, wh, qty, d.status);
          }
        }

        const adjDoc: Document = {
          id: uid(),
          number,
          type: 'adjustment',
          status: 'confirmed',
          storeId: doc.storeId,
          sourceWarehouseId: wh,
          destinationWarehouseId: null,
          dateJalali: doc.dateJalali,
          dateEpoch: nowTs,
          referenceDocId: docId,
          note:
            direction === 'increase'
              ? 'اصلاح افزایشی حاصل انبارگردانی'
              : 'اصلاح کاهشی حاصل انبارگردانی',
          supplier: null,
          referenceNumber: null,
          recipient: null,
          issueType: null,
          channelId: null,
          shippingCost: 0,
          otherExpenses: 0,
          discountTotal: 0,
          totalAmount: total,
          adjustmentDirection: direction,
          adjustmentReason: 'اصلاح کسری شمارش',
          countMode: null,
          createdAt: nowTs,
          confirmedAt: nowTs,
          reversedAt: null,
        };
        await db.documents.add(adjDoc);
        await db.documentLines.bulkAdd(newLines.map((l) => ({ ...l, documentId: adjDoc.id })));
        createdIds.push(adjDoc.id);
      }

      await db.documents.update(docId, { status: 'confirmed', confirmedAt: Date.now() });
    }
  );

  return createdIds;
}

// ============================================================
// برگشت انبارگردانی — ابطال سند + ابطال اسناد اصلاح متصل
// ============================================================
export async function reverseCountDocument(docId: string): Promise<void> {
  const doc = await db.documents.get(docId);
  if (!doc || doc.type !== 'count') throw new Error('سند انبارگردانی معتبر نیست');
  if (doc.status !== 'confirmed') throw new Error('فقط اسناد تأییدشده قابل برگشت هستند');

  const deps = await db.documents.where('referenceDocId').equals(docId).toArray();
  const active = deps.filter((d) => d.status === 'confirmed');

  for (const adj of active) {
    await revertDocumentEffects(adj.id);
    await db.documents.update(adj.id, { status: 'reversed', reversedAt: Date.now() });
  }

  await db.documents.update(docId, { status: 'reversed', reversedAt: Date.now() });
}

// ====== برگشت از تأیید ======
export async function reverseDocument(docId: string): Promise<void> {
  const doc = await db.documents.get(docId);
  if (!doc || doc.status !== 'confirmed') {
    throw new Error('فقط اسناد تأییدشده قابل برگشت هستند');
  }

  if (doc.type === 'count') {
    throw new Error('برای برگشت انبارگردانی از مسیر اختصاصی سند انبارگردانی استفاده کنید');
  }

  if (doc.type === 'adjustment' && doc.referenceDocId) {
    const ref = await db.documents.get(doc.referenceDocId);
    if (ref && ref.type === 'count') {
      throw new Error(
        'این سند اصلاح به انبارگردانی متصل است و فقط از طریق برگشت سند انبارگردانی قابل ابطال است'
      );
    }
  }

  // چک وابستگی: آیا سند دیگری به این سند ارجاع دارد؟
  const dependents = await db.documents.where('referenceDocId').equals(docId).toArray();
  const confirmedDeps = dependents.filter((d) => d.status !== 'reversed');
  if (confirmedDeps.length > 0) {
    throw new Error('این سند توسط سند دیگری استفاده شده و قابل برگشت نیست');
  }

  // خنثی‌سازی اثر موجودی
  await revertDocumentEffects(docId);

  await db.documents.update(docId, {
    status: 'reversed',
    reversedAt: Date.now(),
  });
}

// ====== حذف سند ======
export async function deleteDocument(docId: string): Promise<void> {
  const doc = await db.documents.get(docId);
  if (!doc) throw new Error('سند یافت نشد');

  if (doc.type === 'adjustment' && doc.referenceDocId) {
    const ref = await db.documents.get(doc.referenceDocId);
    if (ref && ref.type === 'count') {
      throw new Error(
        'این سند اصلاح به انبارگردانی متصل است و فقط از طریق برگشت سند انبارگردانی قابل حذف است'
      );
    }
  }

  if (doc.type === 'count' && doc.status === 'confirmed') {
    throw new Error('برای حذف، ابتدا سند انبارگردانی را برگشت از تأیید کنید');
  }

  if (doc.status === 'confirmed') {
    // چک وابستگی
    const dependents = await db.documents.where('referenceDocId').equals(docId).toArray();
    const confirmedDeps = dependents.filter((d) => d.status !== 'reversed');
    if (confirmedDeps.length > 0) {
      throw new Error('این سند توسط سند دیگری استفاده شده و قابل حذف نیست');
    }
    // خنثی‌سازی اثر موجودی
    await revertDocumentEffects(docId);
  }

  // حذف ردیف‌ها و خود سند
  await db.documentLines.where('documentId').equals(docId).delete();
  await db.countLines.where('documentId').equals(docId).delete();
  await db.documents.delete(docId);
}

// ====== خواندن سند + ردیف‌ها ======
export async function getDocumentWithLines(docId: string) {
  const doc = await db.documents.get(docId);
  if (!doc) return null;
  const lines = await db.documentLines.where('documentId').equals(docId).toArray();
  return { doc, lines };
}

// ====== علت‌های اصلاح موجودی ======
export async function saveAdjustmentReason(input: { id?: string; name: string }): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new Error('متن علت الزامی است');
  const all = await db.adjustmentReasons.toArray();
  if (all.some((r) => r.name === name && r.id !== input.id)) {
    throw new Error('این علت قبلاً ثبت شده است');
  }
  if (input.id) {
    await db.adjustmentReasons.update(input.id, { name });
    return input.id;
  }
  const id = uid();
  await db.adjustmentReasons.add({ id, name });
  return id;
}

export async function deleteAdjustmentReason(id: string): Promise<void> {
  await db.adjustmentReasons.delete(id);
}
