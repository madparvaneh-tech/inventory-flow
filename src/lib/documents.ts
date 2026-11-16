import { db } from './db';
import { uid, generateDocNumber } from './ids';
import type { Document, DocumentLine, FlowOperation, DocumentStatus } from '../types';
import {
  applyInbound,
  applyOutbound,
  applyTransferStart,
  applyTransferComplete,
  revertDocumentEffects,
} from './inventory';

// بررسی شماره موجود بودن سند (شماره‌گذاری از 1)
async function nextNumberFor(type: FlowOperation): Promise<string> {
  const count = await db.documents.where('type').equals(type).count();
  return String(count + 1);
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
  shippingCost: number;
  lines: Omit<DocumentLine, 'id' | 'documentId'>[];
}): Promise<Document> {
  const number = await nextNumberFor(input.type);
  const discountTotal = input.lines.reduce((s, l) => s + l.discount, 0);
  const totalAmount = input.lines.reduce((s, l) => s + l.lineTotal, 0);

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
    referenceDocId: null,
    note: input.note,
    supplier: input.supplier,
    referenceNumber: input.referenceNumber,
    recipient: input.recipient,
    issueType: input.issueType,
    shippingCost: input.shippingCost,
    discountTotal,
    totalAmount,
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
    const totalAmount = newLines.reduce((s, l) => s + l.lineTotal, 0);

    await db.documents.update(docId, {
      ...rest,
      discountTotal,
      totalAmount,
    });
  } else {
    await db.documents.update(docId, rest);
  }
}

// ====== تأیید پیش‌نویس (اعمال اثر موجودی) ======
export async function confirmDraftDocument(docId: string): Promise<void> {
  const doc = await db.documents.get(docId);
  if (!doc || doc.status !== 'draft') {
    throw new Error('سند برای تأیید معتبر نیست');
  }

  const lines = await db.documentLines.where('documentId').equals(docId).toArray();
  if (lines.length === 0) throw new Error('سند بدون قلم قابل تأیید نیست');

  // اعمال اثر موجودی
  if (doc.type === 'receipt') {
    for (const l of lines) {
      await applyInbound(l.variantId, doc.destinationWarehouseId!, l.quantity, l.unitCost);
    }
  } else if (doc.type === 'issue') {
    // چک موجودی
    const { getWarehouseStock } = await import('./inventory');
    for (const l of lines) {
      const avail = await getWarehouseStock(l.variantId, doc.sourceWarehouseId!, 'healthy');
      if (avail < l.quantity) {
        throw new Error(`موجودی کافی نیست برای ${l.variantId}`);
      }
    }
    for (const l of lines) {
      await applyOutbound(l.variantId, doc.sourceWarehouseId!, l.quantity, 'healthy');
    }
  } else if (doc.type === 'transfer') {
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
    }
  }

  await db.documents.update(docId, {
    status: 'confirmed',
    confirmedAt: Date.now(),
  });
}

// ====== برگشت از تأیید ======
export async function reverseDocument(docId: string): Promise<void> {
  const doc = await db.documents.get(docId);
  if (!doc || doc.status !== 'confirmed') {
    throw new Error('فقط اسناد تأییدشده قابل برگشت هستند');
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
  await db.documents.delete(docId);
}

// ====== خواندن سند + ردیف‌ها ======
export async function getDocumentWithLines(docId: string) {
  const doc = await db.documents.get(docId);
  if (!doc) return null;
  const lines = await db.documentLines.where('documentId').equals(docId).toArray();
  return { doc, lines };
}