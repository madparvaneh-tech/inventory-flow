import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../lib/db';
import {
  createDraftDocument,
  updateDraftDocument,
  confirmDraftDocument,
  getDocumentWithLines,
  saveAdjustmentReason,
  deleteAdjustmentReason,
} from '../../../lib/documents';
import { getWarehouseStock, getVariantAverageCost } from '../../../lib/inventory';
import { toJalaliString as formatJalaliString, validateJalaliString } from '../../../lib/jalali';
import { fmt, errMsg } from '../../../lib/format';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Icon } from '../../../components/ui/Icon';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { JalaliDateInput } from '../../../components/ui/JalaliDateInput';
import { SegmentedToggle } from '../../../components/ui/SegmentedToggle';
import { Sheet } from '../../../components/ui/Sheet';
import { DocumentFormShell } from './shared/DocumentFormShell';
import { ProductPickerSheet } from './shared/ProductPickerSheet';
import type { AdjustmentDirection, StockStatus, Warehouse } from '../../../types';

// وضعیت هر ردیف اصلاح در فرم
interface AdjustLineState {
  tempId: string;
  variantId: string;
  quantity: number;
  stockStatus: StockStatus;
  unitCost: number; // فقط برای افزایش — پیش‌فرض میانگین جاری
  note: string;
  before: number; // موجودی فعلی همان وضعیت
  avgCost: number; // میانگین جاری (پیشنهاد بهای ورود)
}

const EMPTY_LINE_WARNING = 'موجودی کافی نیست';

export function AdjustmentForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;

  const [dateJalali, setDateJalali] = useState(formatJalaliString());
  const [storeId, setStoreId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [direction, setDirection] = useState<AdjustmentDirection>('increase');
  const [reasonName, setReasonName] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<AdjustLineState[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reasonSheetOpen, setReasonSheetOpen] = useState(false);
  const [newReason, setNewReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stores = useLiveQuery(() => db.stores.toArray(), []) ?? [];
  const warehouses = useLiveQuery(
    () => (storeId ? db.warehouses.where('storeId').equals(storeId).toArray() : Promise.resolve<Warehouse[]>([])),
    [storeId]
  ) ?? [];
  const variants = useLiveQuery(() => db.variants.toArray(), []) ?? [];
  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];
  const reasons = useLiveQuery(() => db.adjustmentReasons.toArray(), []) ?? [];

  // بارگذاری پیش‌نویس در حالت ویرایش
  useEffect(() => {
    if (isEdit && id) {
      (async () => {
        const data = await getDocumentWithLines(id);
        if (!data) return;
        setDateJalali(data.doc.dateJalali);
        setStoreId(data.doc.storeId);
        setWarehouseId(data.doc.sourceWarehouseId || '');
        setDirection(data.doc.adjustmentDirection || 'increase');
        setReasonName(data.doc.adjustmentReason || '');
        setNote(data.doc.note || '');
        const loaded: AdjustLineState[] = [];
        for (const l of data.lines) {
          const before = await getWarehouseStock(
            l.variantId,
            data.doc.sourceWarehouseId || '',
            l.stockStatus || 'healthy'
          );
          const avg = await getVariantAverageCost(l.variantId);
          loaded.push({
            tempId: l.id,
            variantId: l.variantId,
            quantity: l.quantity,
            stockStatus: l.stockStatus || 'healthy',
            unitCost: l.unitCost || avg,
            note: l.note ?? '',
            before,
            avgCost: avg,
          });
        }
        setLines(loaded);
      })();
    }
  }, [isEdit, id]);

  useEffect(() => {
    if (!storeId && stores.length > 0) setStoreId(stores[0].id);
  }, [stores]);

  useEffect(() => {
    if (warehouses.length > 0 && !warehouseId) {
      const def = warehouses.find((w) => w.isDefault) || warehouses[0];
      setWarehouseId(def.id);
    }
  }, [warehouses]);

  // با تغییر جهت اصلاح، بهای پیشنهادی ردیف‌ها بازمحاسبه شود
  useEffect(() => {
    if (isEdit) return;
    setLines((prev) => prev.map((l) => ({ ...l, unitCost: l.avgCost || l.unitCost })));
  }, [direction]);

  const addVariant = async (variantId: string) => {
    if (lines.some((l) => l.variantId === variantId)) return;
    const before = await getWarehouseStock(variantId, warehouseId, 'healthy');
    const avg = await getVariantAverageCost(variantId);
    setLines((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        variantId,
        quantity: 1,
        stockStatus: 'healthy',
        unitCost: avg,
        note: '',
        before,
        avgCost: avg,
      },
    ]);
  };

  const updateLine = (tempId: string, patch: Partial<AdjustLineState>) => {
    setLines((prev) => prev.map((l) => (l.tempId === tempId ? { ...l, ...patch } : l)));
  };

  const removeLine = (tempId: string) => {
    setLines((prev) => prev.filter((l) => l.tempId !== tempId));
  };

  const afterOf = (l: AdjustLineState) =>
    direction === 'increase' ? l.before + l.quantity : l.before - l.quantity;

  const invalidLines = useMemo(
    () =>
      lines.filter((l) => {
        if (l.quantity <= 0) return true;
        if (direction === 'decrease' && l.quantity > l.before) return true;
        return false;
      }),
    [lines, direction]
  );

  // جمع ارزش (افزایش: بهای ورودی؛ کاهش: میانگین جاری)
  const totalValue = useMemo(
    () =>
      lines.reduce((s, l) => {
        const cost = direction === 'increase' ? l.unitCost : l.avgCost;
        return s + l.quantity * (cost || 0);
      }, 0),
    [lines, direction]
  );

  const validate = (): string | null => {
    if (!dateJalali || validateJalaliString(dateJalali)) return 'تاریخ معتبر وارد کنید';
    if (!storeId) return 'فروشگاه را انتخاب کنید';
    if (!warehouseId) return 'انبار را انتخاب کنید';
    if (!reasonName) return 'علت اصلاح الزامی است';
    if (lines.length === 0) return 'حداقل یک کالا اضافه کنید';
    if (invalidLines.length > 0) {
      if (invalidLines[0].quantity <= 0) return 'تعداد اصلاح هر ردیف باید بزرگتر از صفر باشد';
      return EMPTY_LINE_WARNING;
    }
    if (direction === 'increase' && lines.some((l) => l.unitCost <= 0)) {
      return 'بهای واحد برای اصلاح افزایشی الزامی است';
    }
    return null;
  };

  const buildInput = () => ({
    type: 'adjustment' as const,
    storeId,
    sourceWarehouseId: warehouseId,
    destinationWarehouseId: null,
    dateJalali,
    dateEpoch: new Date().getTime(),
    note: note || null,
    supplier: null,
    referenceNumber: null,
    recipient: null,
    issueType: null,
    shippingCost: 0,
    otherExpenses: 0,
    adjustmentDirection: direction,
    adjustmentReason: reasonName,
    lines: lines.map((l) => ({
      variantId: l.variantId,
      quantity: l.quantity,
      unitId: '',
      unitCost: direction === 'increase' ? l.unitCost : 0,
      discount: 0,
      lineTotal: direction === 'increase' ? l.quantity * l.unitCost : 0,
      stockStatus: l.stockStatus,
      note: l.note || null,
    })),
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

  const handleAddReason = async () => {
    const name = newReason.trim();
    if (!name) return;
    try {
      await saveAdjustmentReason({ name });
      setReasonName(name);
      setNewReason('');
      setReasonSheetOpen(false);
    } catch (e) {
      setError(errMsg(e));
    }
  };

  return (
    <DocumentFormShell
      title={isEdit ? 'ویرایش اصلاح موجودی' : 'اصلاح موجودی'}
      subtitle="افزایش یا کاهش دستی با علت مشخص"
      onBack={() => navigate(-1)}
      onDraft={handleSaveDraft}
      onConfirm={handleConfirm}
      saving={saving}
      error={error}
    >
      {/* اطلاعات سند */}
      <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-3 mb-3">
        <div className="text-[11px] font-bold text-orange mb-2 flex items-center gap-1">
          <Icon name="note" size={12} />
          اطلاعات سند
        </div>

        <div className="grid grid-cols-2 gap-2">
          <JalaliDateInput label="تاریخ" required value={dateJalali} onChange={setDateJalali} />
          <Select
            label="فروشگاه"
            required
            leadingIcon={<Icon name="store" size={14} />}
            value={storeId}
            onChange={(e) => {
              setStoreId(e.target.value);
              setWarehouseId('');
              setLines([]);
            }}
            options={stores.map((s) => ({ value: s.id, label: s.name }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2">
          <Select
            label="انبار"
            required
            leadingIcon={<Icon name="warehouse" size={14} />}
            value={warehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value);
              setLines([]);
            }}
            options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
          />
          <div>
            <div className="text-[10px] font-semibold text-muted-light dark:text-muted-dark pr-1 mb-1">
              نوع اصلاح <span className="text-orange">*</span>
            </div>
            <SegmentedToggle
              value={direction === 'increase'}
              onChange={(v) => setDirection(v ? 'increase' : 'decrease')}
              trueLabel="افزایش"
              falseLabel="کاهش"
            />
          </div>
        </div>

        <div className="mt-2">
          <div className="text-[10px] font-semibold text-muted-light dark:text-muted-dark pr-1 mb-1 flex items-center gap-1">
            علت اصلاح <span className="text-orange">*</span>
          </div>
          <div className="flex gap-1.5">
            <div className="flex-1 min-w-0">
              <Select
                value={reasonName}
                onChange={(e) => setReasonName(e.target.value)}
                placeholder="انتخاب کنید"
                options={reasons.map((r) => ({ value: r.name, label: r.name }))}
                aria-label="علت اصلاح"
              />
            </div>
            <button
              type="button"
              onClick={() => setReasonSheetOpen(true)}
              className="w-[42px] h-[42px] rounded-btn bg-orange-soft text-orange flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
              title="افزودن علت جدید"
            >
              <Icon name="plus" size={16} />
            </button>
          </div>
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

      {/* اقلام */}
      <div className="text-[12px] font-bold text-ink dark:text-cream mb-2 flex items-center gap-1.5">
        <Icon name="box" size={13} className="text-orange" />
        اقلام اصلاح ({lines.length})
      </div>

      <div className="flex flex-col gap-2">
        {lines.length === 0 && (
          <button
            onClick={() => setPickerOpen(true)}
            className="w-full py-3 rounded-btn border-[1.5px] border-dashed border-black/10 dark:border-cream/15 text-muted-light dark:text-muted-dark text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
          >
            <Icon name="plus" size={14} />
            افزودن کالا
          </button>
        )}

        {lines.map((l) => {
          const variant = variants.find((x) => x.id === l.variantId);
          const product = variant ? products.find((x) => x.id === variant.productId) : undefined;
          const after = afterOf(l);
          const negative = after < 0;
          return (
            <div
              key={l.tempId}
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
                    <span className="text-orange font-bold">
                      موجودی فعلی: {fmt(l.before)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => removeLine(l.tempId)}
                  className="w-7 h-7 rounded-btn text-red-600 flex items-center justify-center flex-shrink-0"
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <div className="text-[9px] text-muted-light dark:text-muted-dark font-semibold mb-1 pr-1">
                    تعداد اصلاح
                  </div>
                  <MoneyInput
                    value={l.quantity}
                    onChange={(v) => updateLine(l.tempId, { quantity: v })}
                    allowDecimals
                    ariaLabel="تعداد اصلاح"
                  />
                </div>
                {direction === 'increase' ? (
                  <div>
                    <div className="text-[9px] text-muted-light dark:text-muted-dark font-semibold mb-1 pr-1">
                      بهای واحد (ریال)
                    </div>
                    <MoneyInput
                      value={l.unitCost}
                      onChange={(v) => updateLine(l.tempId, { unitCost: v })}
                      error={l.unitCost <= 0}
                      ariaLabel="بهای واحد"
                    />
                  </div>
                ) : (
                  <div>
                    <div className="text-[9px] text-muted-light dark:text-muted-dark font-semibold mb-1 pr-1">
                      بها (میانگین)
                    </div>
                    <div className="bg-orange-soft border-[1.5px] border-transparent rounded-btn px-2 py-1.5 flex items-center justify-center">
                      <span className="text-[11.5px] font-bold text-orange">{fmt(l.avgCost)}</span>
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-[9px] text-muted-light dark:text-muted-dark font-semibold mb-1 pr-1">
                    {direction === 'increase' ? 'بعد از اصلاح' : 'بعد از اصلاح'}
                  </div>
                  <div
                    className={`border-[1.5px] rounded-btn px-2 py-1.5 flex items-center justify-center ${
                      negative
                        ? 'bg-red-500/10 border-red-500/30'
                        : 'bg-orange-soft border-transparent'
                    }`}
                  >
                    <span className={`text-[11.5px] font-bold ${negative ? 'text-red-600' : 'text-orange'}`}>
                      {negative ? 'منفی مجاز نیست' : fmt(after)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                <div>
                  <div className="text-[9px] text-muted-light dark:text-muted-dark font-semibold mb-1 pr-1">
                    وضعیت موجودی
                  </div>
                  <SegmentedToggle
                    value={l.stockStatus !== 'defective'}
                    onChange={(v) => updateLine(l.tempId, { stockStatus: v ? 'healthy' : 'defective' })}
                    trueLabel="سالم"
                    falseLabel="معیوب"
                  />
                </div>
                <div>
                  <div className="text-[9px] text-muted-light dark:text-muted-dark font-semibold mb-1 pr-1">
                    توضیحات ردیف
                  </div>
                  <Input
                    placeholder="اختیاری"
                    value={l.note}
                    onChange={(e) => updateLine(l.tempId, { note: e.target.value })}
                    className="!text-[11.5px]"
                  />
                </div>
              </div>
            </div>
          );
        })}

        {lines.length > 0 && (
          <button
            onClick={() => setPickerOpen(true)}
            className="w-full py-3 rounded-btn border-[1.5px] border-dashed border-black/10 dark:border-cream/15 text-muted-light dark:text-muted-dark text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
          >
            <Icon name="plus" size={14} />
            افزودن کالا
          </button>
        )}
      </div>

      {/* جمع‌بندی */}
      {lines.length > 0 && (
        <div className="mt-3 bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-3">
          <div className="text-[11px] font-bold text-orange mb-2.5 flex items-center gap-1">
            <Icon name="money" size={12} />
            جمع‌بندی اصلاح
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-dashed border-black/5 dark:border-cream/10">
            <span className="text-[11px] text-muted-light dark:text-muted-dark font-medium">نوع اصلاح</span>
            <span className="text-[11.5px] font-bold text-ink dark:text-cream">
              {direction === 'increase' ? 'افزایش موجودی' : 'کاهش موجودی'}
            </span>
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-dashed border-black/5 dark:border-cream/10">
            <span className="text-[11px] text-muted-light dark:text-muted-dark font-medium">علت</span>
            <span className="text-[11.5px] font-bold text-ink dark:text-cream">{reasonName || '—'}</span>
          </div>
          <div className="flex justify-between items-center pt-2.5">
            <span className="text-[12.5px] font-bold text-ink dark:text-cream">
              {direction === 'increase' ? 'ارزش ورود به موجودی' : 'ارزش کسر از موجودی'}
            </span>
            <span className="text-[15px] font-extrabold text-orange">
              {fmt(totalValue)}{' '}
              <small className="text-[10px] font-medium text-muted-light dark:text-muted-dark">ریال</small>
            </span>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-black/5 dark:border-cream/10 text-[9.5px] text-muted-light dark:text-muted-dark leading-relaxed flex items-start gap-1">
            <Icon name="warning" size={11} className="text-orange flex-shrink-0 mt-[1px]" />
            <span>
              افزایش با بهای وارد‌شده در میانگین موزون لحاظ می‌شود؛ کاهش با میانگین موزون جاری ارزش‌گذاری و کسر می‌گردد. موجودی منفی در هیچ شرایطی مجاز نیست.
            </span>
          </div>
        </div>
      )}

      <ProductPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={addVariant}
        mode="count"
        warehouseId={warehouseId}
      />

      {/* شیت افزودن علت جدید */}
      <Sheet
        open={reasonSheetOpen}
        onClose={() => setReasonSheetOpen(false)}
        title="علت اصلاح جدید"
        maxHeight="70%"
      >
        <div className="px-4 pb-4 flex flex-col gap-3">
          <Input
            label="متن علت"
            required
            leadingIcon={<Icon name="tag" size={14} />}
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            placeholder="مثلاً کسری ارسال تامین‌کننده"
            autoFocus
          />
          <button
            onClick={handleAddReason}
            disabled={!newReason.trim()}
            className="w-full py-3 rounded-btn bg-orange text-white text-[12.5px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-[0_6px_20px_rgba(217,84,30,0.35)]"
          >
            <Icon name="check" size={15} />
            ذخیره علت
          </button>

          <div className="pt-2">
            <div className="text-[10px] font-semibold text-muted-light dark:text-muted-dark mb-2">
              علت‌های موجود
            </div>
            <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto scrollbar-hide">
              {reasons.map((r) => (
                <div
                  key={r.id}
                  className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-btn px-3 py-2 flex items-center gap-2"
                >
                  <span className="flex-1 text-[11.5px] font-semibold text-ink dark:text-cream">{r.name}</span>
                  <button
                    onClick={() => {
                      setReasonName(r.name);
                      setReasonSheetOpen(false);
                    }}
                    className="text-[10px] font-bold text-orange px-2 py-1 rounded-btn bg-orange-soft"
                  >
                    انتخاب
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await deleteAdjustmentReason(r.id);
                        if (reasonName === r.name) setReasonName('');
                      } catch (e) {
                        setError(errMsg(e));
                      }
                    }}
                    className="w-7 h-7 rounded-btn text-red-600 flex items-center justify-center"
                    aria-label={`حذف علت ${r.name}`}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Sheet>
    </DocumentFormShell>
  );
}
