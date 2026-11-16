import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../lib/db';
import {
  createDraftDocument,
  updateDraftDocument,
  confirmDraftDocument,
  getDocumentWithLines,
  getReturnableByVariant,
  type ReturnableInfo,
} from '../../../lib/documents';
import { toJalaliString as formatJalaliString, validateJalaliString } from '../../../lib/jalali';
import { fmt, errMsg } from '../../../lib/format';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Icon } from '../../../components/ui/Icon';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { JalaliDateInput } from '../../../components/ui/JalaliDateInput';
import { SegmentedToggle } from '../../../components/ui/SegmentedToggle';
import { DocumentFormShell } from './shared/DocumentFormShell';
import { ReferenceDocPickerSheet } from './shared/ReferenceDocPickerSheet';
import type { Document, StockStatus, Warehouse } from '../../../types';

const RETURN_TYPES = [
  { value: 'sale', label: 'برگشت فروش' },
  { value: 'consumption', label: 'برگشت مصرف' },
  { value: 'consignment', label: 'برگشت امانی' },
  { value: 'other', label: 'برگشت سایر' },
];

const ISSUE_TYPE_LABELS: Record<string, string> = {
  sale: 'فروش',
  consumption: 'مصرف',
  consignment: 'امانی',
  other: 'سایر',
};

// وضعیت برگشت هر واریانت در فرم
interface ReturnLineState {
  variantId: string;
  qty: number;
  stockStatus: StockStatus;
  note: string;
}

export function ReturnForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;

  const [dateJalali, setDateJalali] = useState(formatJalaliString());
  const [refDoc, setRefDoc] = useState<Document | null>(null);
  const [returnType, setReturnType] = useState('sale');
  const [warehouseId, setWarehouseId] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<Record<string, ReturnLineState>>({});
  const [returnable, setReturnable] = useState<Map<string, ReturnableInfo>>(new Map());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refCosts, setRefCosts] = useState<Record<string, number>>({});

  const warehouses = useLiveQuery(
    () =>
      refDoc?.storeId
        ? db.warehouses.where('storeId').equals(refDoc.storeId).toArray()
        : Promise.resolve<Warehouse[]>([]),
    [refDoc?.storeId]
  ) ?? [];

  const variants = useLiveQuery(() => db.variants.toArray(), []) ?? [];
  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];
  const stores = useLiveQuery(() => db.stores.toArray(), []) ?? [];

  // بارگذاری ردیف‌های سند مرجع + مقدار قابل برگشت
  const loadRef = useCallback(
    async (refDocId: string, excludeReturnDocId?: string) => {
      const ref = await db.documents.get(refDocId);
      if (!ref) return;
      setRefDoc(ref);
      const info = await getReturnableByVariant(refDocId, excludeReturnDocId);
      setReturnable(info);
      const refLines = await db.documentLines.where('documentId').equals(refDocId).toArray();
      const costByVariant: Record<string, number> = {};
      for (const l of refLines) {
        if (costByVariant[l.variantId] === undefined || costByVariant[l.variantId] === 0) {
          costByVariant[l.variantId] = l.unitCost;
        }
      }
      // مقدار برگشت قبلی این سند (حالت ویرایش) به‌عنوان مقدار اولیه فرم
      const prev: Record<string, ReturnLineState> = {};
      if (excludeReturnDocId) {
        const own = await db.documentLines.where('documentId').equals(excludeReturnDocId).toArray();
        for (const l of own) {
          prev[l.variantId] = {
            variantId: l.variantId,
            qty: l.quantity,
            stockStatus: l.stockStatus || 'healthy',
            note: l.note ?? '',
          };
        }
      }
      setLines((existing) => {
        const merged = { ...existing };
        for (const [vid, cst] of Object.entries(costByVariant)) {
          if (!merged[vid]) {
            merged[vid] = prev[vid] ?? { variantId: vid, qty: 0, stockStatus: 'healthy' as StockStatus, note: '' };
          }
        }
        return merged;
      });
      // نگهداری بهای مرجع برای ساخت ردیف‌ها
      setRefCosts(costByVariant);
    },
    []
  );

  // حالت ویرایش: بارگذاری سند برگشت و مرجع آن
  useEffect(() => {
    if (isEdit && id) {
      getDocumentWithLines(id).then(async (data) => {
        if (data) {
          setDateJalali(data.doc.dateJalali);
          setReturnType(data.doc.issueType || 'sale');
          setWarehouseId(data.doc.destinationWarehouseId || '');
          setNote(data.doc.note || '');
          if (data.doc.referenceDocId) {
            await loadRef(data.doc.referenceDocId, id);
          }
        }
      });
    }
  }, [isEdit, id, loadRef]);

  // پیش‌فرض انبار مقصد = انبار مبدأ سند مرجع
  useEffect(() => {
    if (refDoc && !warehouseId && warehouses.length > 0) {
      const def = warehouses.find((w) => w.id === refDoc.sourceWarehouseId) || warehouses.find((w) => w.isDefault) || warehouses[0];
      if (def) setWarehouseId(def.id);
    }
  }, [refDoc, warehouses, warehouseId]);

  const activeLines = Object.values(lines).filter((l) => l.qty > 0);
  const totalValue = activeLines.reduce((s, l) => s + l.qty * (refCosts[l.variantId] ?? 0), 0);

  const validate = (): string | null => {
    if (!dateJalali || validateJalaliString(dateJalali)) return 'تاریخ معتبر وارد کنید';
    if (!refDoc) return 'انتخاب سند مرجع الزامی است — برگشت بدون سند مرجع مجاز نیست';
    if (!warehouseId) return 'انبار مقصد را انتخاب کنید';
    if (activeLines.length === 0) return 'حداقل مقدار برگشت یک کالا را وارد کنید';
    for (const l of activeLines) {
      const info = returnable.get(l.variantId);
      if (!info || l.qty > info.remaining) {
        return 'مقدار برگشت نمی‌تواند بیشتر از مقدار باقی‌مانده قابل برگشت باشد';
      }
    }
    return null;
  };

  const buildInput = () => ({
    type: 'return' as const,
    storeId: refDoc!.storeId,
    sourceWarehouseId: null,
    destinationWarehouseId: warehouseId,
    dateJalali,
    dateEpoch: new Date().getTime(),
    note: note || null,
    supplier: null,
    referenceNumber: null,
    recipient: null,
    issueType: returnType,
    shippingCost: 0,
    otherExpenses: 0,
    referenceDocId: refDoc!.id,
    lines: activeLines.map((l) => {
      const cost = refCosts[l.variantId] ?? 0;
      return {
        variantId: l.variantId,
        quantity: l.qty,
        unitId: '',
        unitCost: cost,
        discount: 0,
        lineTotal: l.qty * cost,
        stockStatus: l.stockStatus,
        note: l.note || null,
      };
    }),
  });

  const handleSaveDraft = async () => {
    const err = validate();
    if (err) return setError(err);
    setSaving(true);
    setError(null);
    try {
      if (isEdit && id) {
        const input = buildInput();
        await updateDraftDocument(id, { ...input, lines: input.lines });
      } else {
        await createDraftDocument(buildInput());
      }
      navigate('/records');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    const err = validate();
    if (err) return setError(err);
    setSaving(true);
    setError(null);
    try {
      let docId = id;
      if (!isEdit) {
        const doc = await createDraftDocument(buildInput());
        docId = doc.id;
      } else {
        const input = buildInput();
        await updateDraftDocument(id, { ...input, lines: input.lines });
      }
      await confirmDraftDocument(docId!);
      navigate('/records');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const refStore = refDoc ? stores.find((s) => s.id === refDoc.storeId) : null;
  const refWh = refDoc ? warehouses.find((w) => w.id === refDoc.sourceWarehouseId) : null;

  // ردیف‌های مرجع با اطلاعات قابل برگشت
  const refEntries = Object.entries(lines).filter(([, l]) => {
    const info = returnable.get(l.variantId);
    return info && info.remaining > 0;
  });
  const exhausted = Object.entries(lines).filter(([, l]) => {
    const info = returnable.get(l.variantId);
    return info && info.remaining === 0;
  });

  const updateLine = (variantId: string, patch: Partial<ReturnLineState>) => {
    setLines((prev) => ({
      ...prev,
      [variantId]: { ...prev[variantId], ...patch },
    }));
  };

  return (
    <DocumentFormShell
      title={isEdit ? 'ویرایش برگشت' : 'برگشت کالا'}
      subtitle="برگشت از حواله با سند مرجع"
      onBack={() => navigate(-1)}
      onDraft={handleSaveDraft}
      onConfirm={handleConfirm}
      saving={saving}
      error={error}
    >
      {/* سند مرجع */}
      <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-3 mb-3">
        <div className="text-[11px] font-bold text-orange mb-2 flex items-center gap-1">
          <Icon name="link" size={12} />
          سند مرجع
        </div>

        {!refDoc ? (
          <button
            onClick={() => setPickerOpen(true)}
            className="w-full py-3 rounded-btn border-[1.5px] border-dashed border-orange/40 text-orange text-[12px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
          >
            <Icon name="doc" size={15} />
            انتخاب حواله مرجع (الزامی)
          </button>
        ) : (
          <div className="bg-orange-soft rounded-btn p-2.5 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-btn bg-orange text-white flex items-center justify-center flex-shrink-0">
              <Icon name="minus" size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-bold text-ink dark:text-cream flex items-center gap-1.5">
                حواله #{refDoc.number}
                {refDoc.issueType && (
                  <span className="text-[9.5px] font-semibold text-muted-light dark:text-muted-dark">
                    ({ISSUE_TYPE_LABELS[refDoc.issueType] ?? refDoc.issueType})
                  </span>
                )}
              </div>
              <div className="text-[10px] text-muted-light dark:text-muted-dark mt-0.5">
                {refDoc.dateJalali}
                {refStore ? ` • ${refStore.name}` : ''}
                {refWh ? ` • ${refWh.name}` : ''}
              </div>
            </div>
            {!isEdit && (
              <button
                onClick={() => setPickerOpen(true)}
                className="w-8 h-8 rounded-btn bg-white dark:bg-surface-dark-2 text-orange flex items-center justify-center flex-shrink-0"
                title="تغییر سند مرجع"
              >
                <Icon name="refresh" size={13} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* اطلاعات سند */}
      {refDoc && (
        <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-3 mb-3">
          <div className="text-[11px] font-bold text-orange mb-2 flex items-center gap-1">
            <Icon name="note" size={12} />
            اطلاعات سند
          </div>

          <div className="grid grid-cols-2 gap-2">
            <JalaliDateInput
              label="تاریخ"
              required
              value={dateJalali}
              onChange={setDateJalali}
            />
            <Select
              label="نوع برگشت"
              required
              leadingIcon={<Icon name="tag" size={14} />}
              value={returnType}
              onChange={(e) => setReturnType(e.target.value)}
              options={RETURN_TYPES}
            />
          </div>

          <div className="mt-2">
            <Select
              label="انبار مقصد"
              required
              leadingIcon={<Icon name="warehouse" size={14} />}
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
            />
          </div>

          <div className="mt-2">
            <Input
              label="توضیحات"
              leadingIcon={<Icon name="note" size={14} />}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="اختیاری"
            />
          </div>
        </div>
      )}

      {/* اقلام برگشت */}
      {refDoc && (
        <>
          <div className="text-[12px] font-bold text-ink dark:text-cream mb-2 flex items-center gap-1.5">
            <Icon name="box" size={13} className="text-orange" />
            اقلام قابل برگشت
          </div>
          <div className="flex flex-col gap-2">
            {refEntries.length === 0 && (
              <div className="bg-surface-light dark:bg-surface-dark border border-dashed border-black/10 dark:border-cream/15 rounded-card p-6 text-center text-[11px] text-muted-light dark:text-muted-dark">
                همهٔ اقلام این سند قبلاً برگشت داده شده‌اند
              </div>
            )}

            {refEntries.map(([vid, l]) => {
              const variant = variants.find((x) => x.id === vid);
              const product = variant ? products.find((x) => x.id === variant.productId) : undefined;
              const info = returnable.get(vid);
              if (!info) return null;
              const over = l.qty > info.remaining;
              const returnLine = lines[vid];
              return (
                <div
                  key={vid}
                  className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card p-3 shadow-card"
                >
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-9 h-9 rounded-btn bg-orange-soft text-orange flex items-center justify-center flex-shrink-0">
                      <Icon name="box" size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-bold text-ink dark:text-cream truncate">
                        {product?.name ?? 'کالا'}
                      </div>
                      <div className="text-[10px] text-muted-light dark:text-muted-dark mt-0.5 flex flex-wrap gap-x-2">
                        <span>کد: {variant?.sku ?? '—'}</span>
                        <span className="text-orange font-bold">قابل برگشت: {fmt(info.remaining)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-center mb-2">
                    <div className="bg-surface-light-2 dark:bg-surface-dark-2 rounded-btn py-1.5">
                      <div className="text-[9px] text-muted-light dark:text-muted-dark">خروج اولیه</div>
                      <div className="text-[11px] font-bold text-ink dark:text-cream">{fmt(info.initial)}</div>
                    </div>
                    <div className="bg-surface-light-2 dark:bg-surface-dark-2 rounded-btn py-1.5">
                      <div className="text-[9px] text-muted-light dark:text-muted-dark">برگشت قبلی</div>
                      <div className="text-[11px] font-bold text-ink dark:text-cream">{fmt(info.returned)}</div>
                    </div>
                    <div className="bg-orange-soft rounded-btn py-1.5">
                      <div className="text-[9px] text-orange font-semibold">باقی‌مانده</div>
                      <div className="text-[11px] font-extrabold text-orange">{fmt(info.remaining)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <div className="text-[9px] text-muted-light dark:text-muted-dark font-semibold mb-1 pr-1">
                        مقدار برگشت فعلی
                      </div>
                      <MoneyInput
                        value={l.qty}
                        onChange={(v) => updateLine(vid, { qty: v })}
                        allowDecimals
                        error={over}
                        ariaLabel="مقدار برگشت"
                      />
                    </div>
                    <div>
                      <div className="text-[9px] text-muted-light dark:text-muted-dark font-semibold mb-1 pr-1">
                        وضعیت کالای برگشتی
                      </div>
                      <SegmentedToggle
                        value={returnLine?.stockStatus !== 'defective'}
                        onChange={(v) => updateLine(vid, { stockStatus: v ? 'healthy' : 'defective' })}
                        trueLabel="سالم"
                        falseLabel="معیوب"
                      />
                    </div>
                  </div>

                  {over && (
                    <div className="mt-1.5 text-[10px] text-red-600 font-semibold flex items-center gap-1">
                      <Icon name="warning" size={11} />
                      مقدار برگشت بیشتر از باقی‌مانده مجاز است
                    </div>
                  )}

                  <div className="mt-1.5">
                    <Input
                      placeholder="توضیحات ردیف (اختیاری)"
                      value={returnLine?.note ?? ''}
                      onChange={(e) => updateLine(vid, { note: e.target.value })}
                      className="!text-[11.5px]"
                    />
                  </div>
                </div>
              );
            })}

            {exhausted.length > 0 && (
              <div className="bg-surface-light-2 dark:bg-surface-dark-2 rounded-card p-2.5 text-[10px] text-muted-light dark:text-muted-dark">
                کاملاً برگشت‌شده: {exhausted.length} قلم (مقدار مجاز باقی‌مانده صفر است)
              </div>
            )}
          </div>

          {/* جمع‌بندی */}
          <div className="mt-3 bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-3">
            <div className="text-[11px] font-bold text-orange mb-2.5 flex items-center gap-1">
              <Icon name="money" size={12} />
              جمع‌بندی برگشت
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-dashed border-black/5 dark:border-cream/10">
              <span className="text-[11px] text-muted-light dark:text-muted-dark font-medium">تعداد اقلام برگشتی</span>
              <span className="text-[11.5px] font-bold text-ink dark:text-cream">{activeLines.length} قلم</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-dashed border-black/5 dark:border-cream/10">
              <span className="text-[11px] text-muted-light dark:text-muted-dark font-medium">جمع مقدار برگشت</span>
              <span className="text-[11.5px] font-bold text-ink dark:text-cream">
                {fmt(activeLines.reduce((s, l) => s + l.qty, 0))}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2.5">
              <span className="text-[12.5px] font-bold text-ink dark:text-cream">ارزش برگشت (بهای سند مرجع)</span>
              <span className="text-[15px] font-extrabold text-orange">
                {fmt(totalValue)}{' '}
                <small className="text-[10px] font-medium text-muted-light dark:text-muted-dark">ریال</small>
              </span>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-black/5 dark:border-cream/10 text-[9.5px] text-muted-light dark:text-muted-dark leading-relaxed flex items-start gap-1">
              <Icon name="warning" size={11} className="text-orange flex-shrink-0 mt-[1px]" />
              <span>
                با تأیید سند، اقلام در وضعیت انتخابی (سالم/معیوب) به انبار مقصد برمی‌گردند. کالای معیوب هرگز به موجودی سالم اضافه نمی‌شود. بهای ورود مطابق سند مرجع است.
              </span>
            </div>
          </div>
        </>
      )}

      <ReferenceDocPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(doc) => {
          setRefDoc(doc);
          setWarehouseId('');
          setLines({});
          loadRef(doc.id, isEdit ? id : undefined);
        }}
      />
    </DocumentFormShell>
  );
}
