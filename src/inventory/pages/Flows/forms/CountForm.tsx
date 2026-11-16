import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../lib/db';
import {
  createCountDraft,
  updateCountDraft,
  confirmCountDocument,
  countLinesFor,
  type CountLineInput,
} from '../../../lib/documents';
import { getWarehouseStock } from '../../../lib/inventory';
import { toJalaliString as formatJalaliString, validateJalaliString } from '../../../lib/jalali';
import { fmt, toEnglishDigits, errMsg } from '../../../lib/format';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Icon } from '../../../components/ui/Icon';
import { JalaliDateInput } from '../../../components/ui/JalaliDateInput';
import { SegmentedToggle } from '../../../components/ui/SegmentedToggle';
import { DocumentFormShell } from './shared/DocumentFormShell';
import { ProductPickerSheet } from './shared/ProductPickerSheet';
import type { StockStatus, Variant, Product, Unit, Warehouse } from '../../../types';

// ============================================================
// ورودی تعداد شمارش — تفکیک «خالی» (شمارش‌نشده = null) از «صفر»
// ============================================================
function fmtQty(n: number): string {
  if (n === null || n === undefined || !isFinite(n)) return '';
  const fixed = String(n);
  const [ip, fp] = fixed.split('.');
  const grouped = ip.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fp !== undefined ? `${grouped}.${fp}` : grouped;
}

function parseQty(raw: string): number | null {
  const s = toEnglishDigits(raw).replace(/,/g, '').replace(/٫/g, '.').trim();
  if (s === '') return null;
  const firstDot = s.indexOf('.');
  const cleaned =
    firstDot >= 0 ? s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '') : s;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function CountQtyInput({
  value,
  onChange,
  disabled,
  ariaLabel,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  const [draft, setDraft] = useState<string>(value === null ? '' : fmtQty(value));
  const [prevValue, setPrevValue] = useState<number | null>(value);

  // همگام‌سازی با مقدار بیرونی (بازنشانی شمارش و بارگذاری خطوط)
  if (value !== prevValue) {
    setPrevValue(value);
    const parsed = parseQty(draft);
    if (parsed !== value) {
      setDraft(value === null ? '' : fmtQty(value));
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const parsed = parseQty(raw);
    if (parsed === null) {
      setDraft('');
      onChange(null);
      return;
    }
    setDraft(fmtQty(parsed));
    onChange(parsed);
  };

  return (
    <div className="bg-white dark:bg-surface-dark-2 border-[1.5px] rounded-btn px-2 py-1.5 flex items-center transition-all focus-within:border-orange focus-within:shadow-[0_0_0_3px_rgba(217,84,30,0.10)] border-black/5 dark:border-cream/10">
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={handleChange}
        disabled={disabled}
        placeholder="—"
        aria-label={ariaLabel}
        style={{ fontSize: draft.replace(/[^0-9]/g, '').length > 9 ? 10 : 12 }}
        className="flex-1 min-w-0 bg-transparent border-none outline-none font-bold text-ink dark:text-cream text-center placeholder:text-muted-light/50 dark:placeholder:text-muted-dark/50"
      />
    </div>
  );
}

// ============================================================
// خط شمارش در فرم
// ============================================================
interface CountEditLine {
  variantId: string;
  unitId: string;
  systemHealthy: number;
  countedHealthy: number | null;
  systemDefective: number;
  countedDefective: number | null;
  note: string;
}

export function CountForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;

  const [dateJalali, setDateJalali] = useState(formatJalaliString());
  const [storeId, setStoreId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [mode, setMode] = useState<'all' | 'selected'>('all');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<CountEditLine[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stores = useLiveQuery(() => db.stores.toArray(), []) ?? [];
  const warehouses = useLiveQuery(
    () => (storeId ? db.warehouses.where('storeId').equals(storeId).toArray() : Promise.resolve<Warehouse[]>([])),
    [storeId]
  ) ?? [];
  const variants = useLiveQuery(() => db.variants.toArray(), []) ?? [];
  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];
  const units = useLiveQuery(() => db.units.toArray(), []) ?? [];

  // انبارگردانی باز موجود برای همین انبار (هشدار + بلاک)
  const openCount = useLiveQuery(
    () =>
      warehouseId && !isEdit
        ? db.documents
            .where('type')
            .equals('count')
            .filter((d) => d.status === 'draft' && d.sourceWarehouseId === warehouseId)
            .count()
        : Promise.resolve(0),
    [warehouseId, isEdit]
  ) ?? 0;

  // بارگذاری پیش‌نویس در حالت ویرایش — مبنای شمارش از داده ذخیره‌شده می‌آید
  useEffect(() => {
    if (isEdit && id) {
      (async () => {
        const doc = await db.documents.get(id);
        if (!doc) return;
        setDateJalali(doc.dateJalali);
        setStoreId(doc.storeId);
        setWarehouseId(doc.sourceWarehouseId || '');
        setMode(doc.countMode || 'all');
        setNote(doc.note || '');
        const saved = await countLinesFor(id);
        setLines(
          saved.map((l) => ({
            variantId: l.variantId,
            unitId: l.unitId,
            systemHealthy: l.systemHealthy,
            countedHealthy: l.countedHealthy,
            systemDefective: l.systemDefective,
            countedDefective: l.countedDefective,
            note: l.note ?? '',
          }))
        );
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

  // اسنپ‌شات موجودی سیستمی — مبنای مقایسه در لحظه شروع شمارش ثابت می‌شود
  const snapshotVariant = async (variantId: string): Promise<CountEditLine> => {
    const v = variants.find((x) => x.id === variantId);
    const p = v ? products.find((x) => x.id === v.productId) : undefined;
    return {
      variantId,
      unitId: p?.mainUnitId ?? '',
      systemHealthy: warehouseId ? await getWarehouseStock(variantId, warehouseId, 'healthy') : 0,
      countedHealthy: null,
      systemDefective: warehouseId ? await getWarehouseStock(variantId, warehouseId, 'defective') : 0,
      countedDefective: null,
      note: '',
    };
  };

  // شمارش تمام کالاهای انبار — حتی کالاهای بدون موجودی
  const prepareAll = async () => {
    if (!warehouseId) return setError('ابتدا انبار را انتخاب کنید');
    setError(null);
    const invRows = await db.inventory.where('warehouseId').equals(warehouseId).toArray();
    const sysOf = (variantId: string, status: StockStatus) =>
      invRows.find((r) => r.variantId === variantId && r.status === status)?.quantity ?? 0;

    const eligible = variants.filter((v) => {
      const p = products.find((x) => x.id === v.productId);
      // همهٔ کالاهای فعال + هر کالای دارای موجودی در این انبار (هرچند غیرفعال باشد)
      if (p?.isActive) return true;
      return sysOf(v.id, 'healthy') > 0 || sysOf(v.id, 'defective') > 0;
    });

    const preparedLines: CountEditLine[] = eligible.map((v) => {
      const p = products.find((x) => x.id === v.productId);
      return {
        variantId: v.id,
        unitId: p?.mainUnitId ?? '',
        systemHealthy: sysOf(v.id, 'healthy'),
        countedHealthy: null,
        systemDefective: sysOf(v.id, 'defective'),
        countedDefective: null,
        note: '',
      };
    });
    setLines(preparedLines);
  };

  const addVariant = async (variantId: string) => {
    if (lines.some((l) => l.variantId === variantId)) return;
    const line = await snapshotVariant(variantId);
    setLines((prev) => [...prev, line]);
  };

  const updateLine = (variantId: string, patch: Partial<CountEditLine>) => {
    setLines((prev) => prev.map((l) => (l.variantId === variantId ? { ...l, ...patch } : l)));
  };

  const removeLine = (variantId: string) => {
    setLines((prev) => prev.filter((l) => l.variantId !== variantId));
  };

  const resetCounting = () => {
    setLines((prev) =>
      prev.map((l) => ({ ...l, countedHealthy: null, countedDefective: null }))
    );
  };

  // ====== خلاصه شمارش ======
  const countedCount = useMemo(
    () => lines.filter((l) => l.countedHealthy !== null || l.countedDefective !== null).length,
    [lines]
  );
  const varianceLines = useMemo(
    () =>
      lines.filter(
        (l) =>
          (l.countedHealthy !== null && l.countedHealthy !== l.systemHealthy) ||
          (l.countedDefective !== null && l.countedDefective !== l.systemDefective)
      ),
    [lines]
  );
  const totalIncrease = useMemo(
    () =>
      varianceLines.reduce((s, l) => {
        let add = 0;
        if (l.countedHealthy !== null && l.countedHealthy > l.systemHealthy)
          add += l.countedHealthy - l.systemHealthy;
        if (l.countedDefective !== null && l.countedDefective > l.systemDefective)
          add += l.countedDefective - l.systemDefective;
        return s + add;
      }, 0),
    [varianceLines]
  );
  const totalDecrease = useMemo(
    () =>
      varianceLines.reduce((s, l) => {
        let sub = 0;
        if (l.countedHealthy !== null && l.countedHealthy < l.systemHealthy)
          sub += l.systemHealthy - l.countedHealthy;
        if (l.countedDefective !== null && l.countedDefective < l.systemDefective)
          sub += l.systemDefective - l.countedDefective;
        return s + sub;
      }, 0),
    [varianceLines]
  );

  // ارزش تقریبی اختلاف بر مبنای میانگین جاری (برای نمایش؛ ارزش نهایی در تأیید محاسبه می‌شود)
  const [estimateValue, setEstimateValue] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (varianceLines.length === 0 || !warehouseId) {
        if (!cancelled) setEstimateValue(varianceLines.length === 0 ? 0 : null);
        return;
      }
      let value = 0;
      for (const l of varianceLines) {
        const invRows = await db.inventory.where('variantId').equals(l.variantId).toArray();
        const healthyAvg =
          invRows.filter((r) => r.status === 'healthy' && r.quantity > 0).reduce((s, r) => s + r.quantity * r.averageCost, 0) /
          (invRows.filter((r) => r.status === 'healthy' && r.quantity > 0).reduce((s, r) => s + r.quantity, 0) || 1);
        const defectiveRow = invRows.find((r) => r.status === 'defective' && r.warehouseId === warehouseId);
        const defectiveAvg = defectiveRow && defectiveRow.averageCost > 0 ? defectiveRow.averageCost : healthyAvg;
        if (l.countedHealthy !== null && l.countedHealthy !== l.systemHealthy) {
          value += Math.abs(l.countedHealthy - l.systemHealthy) * healthyAvg;
        }
        if (l.countedDefective !== null && l.countedDefective !== l.systemDefective) {
          value += Math.abs(l.countedDefective - l.systemDefective) * defectiveAvg;
        }
      }
      if (!cancelled) setEstimateValue(value);
    })();
    return () => {
      cancelled = true;
    };
  }, [varianceLines, warehouseId]);

  // ====== اعتبارسنجی و ذخیره ======
  const buildLineInputs = (): CountLineInput[] =>
    lines.map((l) => ({
      variantId: l.variantId,
      unitId: l.unitId,
      systemHealthy: l.systemHealthy,
      countedHealthy: l.countedHealthy,
      systemDefective: l.systemDefective,
      countedDefective: l.countedDefective,
      note: l.note || null,
    }));

  const validate = (forConfirm: boolean): string | null => {
    if (!dateJalali || validateJalaliString(dateJalali)) return 'تاریخ معتبر وارد کنید';
    if (!storeId) return 'فروشگاه را انتخاب کنید';
    if (!warehouseId) return 'انبار را انتخاب کنید';
    if (lines.length === 0) return 'ابتدا کالاهای شمارش را بارگذاری یا انتخاب کنید';
    if (forConfirm && countedCount === 0)
      return 'هیچ ردیفی شمارش نشده است — حداقل یک تعداد شمارش‌شده وارد کنید';
    return null;
  };

  const handleSaveDraft = async () => {
    const err = validate(false);
    if (err) return setError(err);
    setSaving(true);
    setError(null);
    try {
      if (isEdit && id) {
        await updateCountDraft(id, {
          dateJalali,
          dateEpoch: new Date().getTime(),
          note: note || null,
          lines: buildLineInputs(),
        });
      } else {
        await createCountDraft({
          storeId,
          warehouseId,
          dateJalali,
          dateEpoch: new Date().getTime(),
          note: note || null,
          countMode: mode,
          lines: buildLineInputs(),
        });
      }
      navigate('/records');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    const err = validate(true);
    if (err) return setError(err);
    setSaving(true);
    setError(null);
    try {
      let docId = id;
      if (!isEdit) {
        const doc = await createCountDraft({
          storeId,
          warehouseId,
          dateJalali,
          dateEpoch: new Date().getTime(),
          note: note || null,
          countMode: mode,
          lines: buildLineInputs(),
        });
        docId = doc.id;
      } else {
        await updateCountDraft(id, {
          dateJalali,
          dateEpoch: new Date().getTime(),
          note: note || null,
          lines: buildLineInputs(),
        });
      }
      await confirmCountDocument(docId!);
      navigate('/records');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const unitName = (unitId: string) => units.find((u) => u.id === unitId)?.name ?? '';
  const variantOf = (vid: string): { v?: Variant; p?: Product } => {
    const v = variants.find((x) => x.id === vid);
    const p = v ? products.find((x) => x.id === v.productId) : undefined;
    return { v, p };
  };

  return (
    <DocumentFormShell
      title={isEdit ? 'ویرایش انبارگردانی' : 'انبارگردانی'}
      subtitle="شمارش و اصلاح مغایرت موجودی"
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
          اطلاعات شمارش
        </div>

        <div className="grid grid-cols-2 gap-2">
          <JalaliDateInput label="تاریخ" required value={dateJalali} onChange={setDateJalali} />
          <Select
            label="فروشگاه"
            required
            disabled={isEdit}
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
            label="انبار شمارش"
            required
            disabled={isEdit}
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
              حالت شمارش {isEdit && <span className="text-orange">*غیرقابل تغییر</span>}
            </div>
            <SegmentedToggle
              value={mode === 'all'}
              onChange={(v) => {
                if (isEdit) return;
                setMode(v ? 'all' : 'selected');
                setLines([]);
              }}
              trueLabel="تمام کالاها"
              falseLabel="کالاهای انتخابی"
              disabled={isEdit}
            />
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

        {/* هشدار انبارگردانی باز */}
        {!isEdit && openCount > 0 && (
          <div className="mt-2 text-[10.5px] text-red-600 bg-red-500/10 rounded-md px-3 py-2 flex items-center gap-1.5">
            <Icon name="warning" size={12} />
            برای این انبار یک انبارگردانی باز وجود دارد — ابتدا آن را تأیید یا حذف کنید
          </div>
        )}
      </div>

      {/* بارگذاری اقلام */}
      {!isEdit && lines.length === 0 && (
        <div className="mb-3">
          {mode === 'all' ? (
            <button
              onClick={prepareAll}
              disabled={!warehouseId || openCount > 0}
              className="w-full py-3 rounded-btn bg-orange text-white text-[12px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] shadow-[0_6px_20px_rgba(217,84,30,0.35)] disabled:opacity-50"
            >
              <Icon name="list" size={15} />
              بارگذاری تمام کالاهای انبار و ثبت مبنای شمارش
            </button>
          ) : (
            <button
              onClick={() => warehouseId && openCount === 0 && setPickerOpen(true)}
              disabled={!warehouseId || openCount > 0}
              className="w-full py-3 rounded-btn border-[1.5px] border-dashed border-orange/40 text-orange text-[12px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <Icon name="plus" size={15} />
              انتخاب کالاهای شمارش
            </button>
          )}
        </div>
      )}

      {/* ردیف‌های شمارش */}
      {lines.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[12px] font-bold text-ink dark:text-cream flex items-center gap-1.5">
              <Icon name="box" size={13} className="text-orange" />
              ردیف‌های شمارش ({lines.length})
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={resetCounting}
                className="px-2.5 py-1.5 rounded-btn bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 text-[10px] font-bold text-muted-light dark:text-muted-dark flex items-center gap-1"
              >
                <Icon name="refresh" size={11} />
                شمارش مجدد
              </button>
              {!isEdit && mode === 'selected' && (
                <button
                  onClick={() => setPickerOpen(true)}
                  className="px-2.5 py-1.5 rounded-btn bg-orange-soft text-orange text-[10px] font-bold flex items-center gap-1"
                >
                  <Icon name="plus" size={11} />
                  افزودن
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {lines.map((l) => {
              const { v, p } = variantOf(l.variantId);
              const diffH = l.countedHealthy === null ? null : l.countedHealthy - l.systemHealthy;
              const diffD = l.countedDefective === null ? null : l.countedDefective - l.systemDefective;
              const hasDiff = (diffH !== null && diffH !== 0) || (diffD !== null && diffD !== 0);
              return (
                <div
                  key={l.variantId}
                  className={`bg-surface-light dark:bg-surface-dark border rounded-card p-3 shadow-card ${
                    hasDiff ? 'border-orange/40' : 'border-black/5 dark:border-cream/10'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-9 h-9 rounded-btn bg-orange-soft text-orange flex items-center justify-center flex-shrink-0">
                      <Icon name="box" size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-bold text-ink dark:text-cream truncate">
                        {p?.name ?? 'کالا'}
                      </div>
                      <div className="text-[9.5px] text-muted-light dark:text-muted-dark mt-0.5 flex flex-wrap gap-x-2">
                        <span>کد: {v?.sku ?? '—'}</span>
                        {l.unitId && <span>• {unitName(l.unitId)}</span>}
                      </div>
                    </div>
                    {hasDiff && (
                      <span className="text-[9px] font-bold text-orange bg-orange-soft rounded-md px-1.5 py-0.5 flex-shrink-0">
                        مغایرت
                      </span>
                    )}
                    {!isEdit && (
                      <button
                        onClick={() => removeLine(l.variantId)}
                        className="w-7 h-7 rounded-btn text-red-600 flex items-center justify-center flex-shrink-0"
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    )}
                  </div>

                  {/* سالم */}
                  <div className="grid grid-cols-3 gap-1.5 items-end">
                    <div>
                      <div className="text-[9px] text-muted-light dark:text-muted-dark font-semibold mb-1 pr-1">
                        سیستمی سالم
                      </div>
                      <div className="bg-surface-light-2 dark:bg-surface-dark-2 rounded-btn px-2 py-1.5 text-center text-[11.5px] font-bold text-ink dark:text-cream">
                        {fmt(l.systemHealthy)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-muted-light dark:text-muted-dark font-semibold mb-1 pr-1">
                        شمارش سالم
                      </div>
                      <CountQtyInput
                        value={l.countedHealthy}
                        onChange={(v) => updateLine(l.variantId, { countedHealthy: v })}
                        ariaLabel="شمارش سالم"
                      />
                    </div>
                    <div>
                      <div className="text-[9px] text-muted-light dark:text-muted-dark font-semibold mb-1 pr-1">
                        اختلاف سالم
                      </div>
                      <div
                        className={`rounded-btn px-2 py-1.5 text-center text-[11.5px] font-bold ${
                          diffH === null
                            ? 'bg-surface-light-2 dark:bg-surface-dark-2 text-muted-light dark:text-muted-dark'
                            : diffH === 0
                              ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                              : diffH > 0
                                ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                                : 'bg-red-500/10 text-red-600'
                        }`}
                      >
                        {diffH === null ? '—' : diffH > 0 ? `+${fmt(diffH)}` : fmt(diffH)}
                      </div>
                    </div>
                  </div>

                  {/* معیوب */}
                  <div className="grid grid-cols-3 gap-1.5 items-end mt-1.5">
                    <div>
                      <div className="text-[9px] text-muted-light dark:text-muted-dark font-semibold mb-1 pr-1">
                        سیستمی معیوب
                      </div>
                      <div className="bg-surface-light-2 dark:bg-surface-dark-2 rounded-btn px-2 py-1.5 text-center text-[11.5px] font-bold text-ink dark:text-cream">
                        {fmt(l.systemDefective)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-muted-light dark:text-muted-dark font-semibold mb-1 pr-1">
                        شمارش معیوب
                      </div>
                      <CountQtyInput
                        value={l.countedDefective}
                        onChange={(v) => updateLine(l.variantId, { countedDefective: v })}
                        ariaLabel="شمارش معیوب"
                      />
                    </div>
                    <div>
                      <div className="text-[9px] text-muted-light dark:text-muted-dark font-semibold mb-1 pr-1">
                        اختلاف معیوب
                      </div>
                      <div
                        className={`rounded-btn px-2 py-1.5 text-center text-[11.5px] font-bold ${
                          diffD === null
                            ? 'bg-surface-light-2 dark:bg-surface-dark-2 text-muted-light dark:text-muted-dark'
                            : diffD === 0
                              ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                              : diffD > 0
                                ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                                : 'bg-red-500/10 text-red-600'
                        }`}
                      >
                        {diffD === null ? '—' : diffD > 0 ? `+${fmt(diffD)}` : fmt(diffD)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-1.5">
                    <Input
                      placeholder="توضیحات ردیف (اختیاری)"
                      value={l.note}
                      onChange={(e) => updateLine(l.variantId, { note: e.target.value })}
                      className="!text-[11.5px]"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* خلاصه اختلاف */}
          <div className="mt-3 bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-3">
            <div className="text-[11px] font-bold text-orange mb-2.5 flex items-center gap-1">
              <Icon name="chart" size={12} />
              خلاصه شمارش
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-surface-light-2 dark:bg-surface-dark-2 rounded-btn p-2.5 text-center">
                <div className="text-[9.5px] text-muted-light dark:text-muted-dark">شمارش‌شده</div>
                <div className="text-[13px] font-extrabold text-ink dark:text-cream mt-0.5">
                  {countedCount} از {lines.length}
                </div>
              </div>
              <div className="bg-surface-light-2 dark:bg-surface-dark-2 rounded-btn p-2.5 text-center">
                <div className="text-[9.5px] text-muted-light dark:text-muted-dark">دارای مغایرت</div>
                <div className="text-[13px] font-extrabold text-orange mt-0.5">{varianceLines.length}</div>
              </div>
              <div className="bg-green-500/10 rounded-btn p-2.5 text-center">
                <div className="text-[9.5px] text-green-700 dark:text-green-400">جمع افزایش</div>
                <div className="text-[13px] font-extrabold text-green-700 dark:text-green-400 mt-0.5">
                  +{fmt(totalIncrease)}
                </div>
              </div>
              <div className="bg-red-500/10 rounded-btn p-2.5 text-center">
                <div className="text-[9.5px] text-red-600">جمع کاهش</div>
                <div className="text-[13px] font-extrabold text-red-600 mt-0.5">
                  −{fmt(totalDecrease)}
                </div>
              </div>
            </div>
            {estimateValue !== null && varianceLines.length > 0 && (
              <div className="mt-2.5 pt-2.5 border-t border-black/5 dark:border-cream/10 flex justify-between items-center">
                <span className="text-[10.5px] text-muted-light dark:text-muted-dark font-medium">
                  ارزش مالی اختلاف (بر مبنای میانگین جاری)
                </span>
                <span className="text-[12px] font-extrabold text-orange">{fmt(estimateValue)} ریال</span>
              </div>
            )}
            <div className="mt-2.5 pt-2.5 border-t border-black/5 dark:border-cream/10 text-[9.5px] text-muted-light dark:text-muted-dark leading-relaxed flex items-start gap-1">
              <Icon name="warning" size={11} className="text-orange flex-shrink-0 mt-[1px]" />
              <span>
                خانهٔ خالی یعنی «شمارش‌نشده» و اثری ندارد؛ ثبت عدد صفر یعنی «شمارش صفر» و کل اختلاف کسر می‌شود. با تأیید، اختلاف‌ها از طریق اسناد اصلاح موجودی متصل به این سند اعمال می‌شوند.
              </span>
            </div>
          </div>
        </>
      )}

      <ProductPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={addVariant}
        mode="count"
        warehouseId={warehouseId}
      />
    </DocumentFormShell>
  );
}
