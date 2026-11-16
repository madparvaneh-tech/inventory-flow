import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  buildReportDataset,
  movementReport,
  movementTotals,
  type MovementRow,
  type MovementEntry,
  type ReportDataset,
  type MovementFilters,
} from '../../lib/reports';
import { exportToExcel, loadReportFilters, saveReportFilters } from '../../lib/exporters';
import { fmt, errMsg } from '../../lib/format';
import { jalaliToDate, toJalaliString } from '../../lib/jalali';
import { Select } from '../../components/ui/Select';
import { Icon } from '../../components/ui/Icon';
import { Badge } from '../../components/ui/Badge';
import { Sheet } from '../../components/ui/Sheet';
import { JalaliDateInput } from '../../components/ui/JalaliDateInput';
import { FilterChip, ReportShell, ReportTable, SummaryBox } from './ReportShell';
import type { FlowOperation } from '../../types';

const OP_LABELS: Record<FlowOperation, string> = {
  receipt: 'رسید',
  issue: 'حواله',
  transfer: 'انتقال',
  return: 'برگشت',
  adjustment: 'اصلاح موجودی',
  count: 'انبارگردانی',
  'status-change': 'تغییر وضعیت',
};

const ALL_OPS: FlowOperation[] = ['receipt', 'issue', 'transfer', 'return', 'adjustment'];

const RANGE_PRESETS = [30, 60, 90] as const;

function defaultFilters(): MovementFilters {
  return {
    fromEpoch: Date.now() - 30 * 86400000,
    toEpoch: Date.now(),
    productId: 'all',
    variantId: 'all',
    categoryId: 'all',
    storeId: 'all',
    warehouseId: 'all',
    opTypes: [],
  };
}

export function MovementReport() {
  const navigate = useNavigate();
  const [ds, setDs] = useState<ReportDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<MovementFilters>(() =>
    loadReportFilters<MovementFilters>('movement', defaultFilters())
  );
  const [detailRow, setDetailRow] = useState<MovementRow | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareFrom, setCompareFrom] = useState(Date.now() - 60 * 86400000);
  const [compareTo, setCompareTo] = useState(Date.now() - 30 * 86400000);
  const [excelBusy, setExcelBusy] = useState(false);

  useEffect(() => {
    buildReportDataset().then(setDs).catch((e) => setError(errMsg(e)));
  }, []);

  useEffect(() => {
    saveReportFilters('movement', filters);
  }, [filters]);

  const products = ds?.products ?? [];
  const categories = ds?.categories ?? [];
  const stores = ds?.stores ?? [];
  const warehouses = ds?.warehouses.filter((w) => filters.storeId === 'all' || w.storeId === filters.storeId) ?? [];
  const variantOptions = useMemo(() => {
    if (filters.productId === 'all') return ds?.variants ?? [];
    return (ds?.variants ?? []).filter((v) => v.productId === filters.productId);
  }, [ds, filters.productId]);

  const result = useMemo(
    () => (ds ? movementReport(ds, filters) : { rows: [], totals: { opening: 0, inQty: 0, outQty: 0, closing: 0, internal: 0, inValue: 0, outValue: 0 } }),
    [ds, filters]
  );

  const compare = useMemo(() => {
    if (!ds || !compareOpen) return null;
    return movementTotals(ds, compareFrom, compareTo, filters);
  }, [ds, compareOpen, compareFrom, compareTo, filters]);

  const presetChip = (days: number) => {
    setFilters((f) => ({ ...f, fromEpoch: Date.now() - days * 86400000, toEpoch: Date.now() }));
  };

  const isPresetActive = (days: number) =>
    Math.abs(filters.toEpoch - Date.now()) < 2 * 86400000 &&
    Math.abs(filters.fromEpoch - (Date.now() - days * 86400000)) < 2 * 86400000;

  const filterMeta = [
    `بازه: ${toJalaliString(filters.fromEpoch)} تا ${toJalaliString(filters.toEpoch)}`,
    `فروشگاه: ${filters.storeId === 'all' ? 'همه' : stores.find((s) => s.id === filters.storeId)?.name ?? ''}`,
    `انبار: ${filters.warehouseId === 'all' ? 'همه' : warehouses.find((w) => w.id === filters.warehouseId)?.name ?? ''}`,
    `نوع عملیات: ${filters.opTypes.length === 0 ? 'همه' : filters.opTypes.map((t) => OP_LABELS[t]).join('، ')}`,
  ];

  const handleExcel = async () => {
    if (!ds) return;
    setExcelBusy(true);
    try {
      await exportToExcel({
        fileName: `movement-${new Date().toISOString().slice(0, 10)}`,
        sheetName: 'گردش کالا',
        title: 'گزارش گردش کالا و ورود/خروج',
        meta: filterMeta,
        headers: ['کالا', 'کد', 'دسته', 'فروشگاه', 'انبار', 'وضعیت', 'اول دوره', 'ورود', 'خروج', 'پایان دوره', 'انتقال داخلی', 'ارزش ورود', 'ارزش خروج'],
        rows: result.rows.map((r) => [
          r.productName,
          r.variantSku,
          r.categoryName,
          r.storeName,
          r.warehouseName,
          r.status === 'defective' ? 'معیوب' : 'سالم',
          r.opening,
          r.inQty,
          r.outQty,
          r.closing,
          r.internalTransferQty,
          Math.round(r.inValue),
          Math.round(r.outValue),
        ]),
      });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setExcelBusy(false);
    }
  };

  const toggleOp = (op: FlowOperation) => {
    setFilters((f) => ({
      ...f,
      opTypes: f.opTypes.includes(op) ? f.opTypes.filter((x) => x !== op) : [...f.opTypes, op],
    }));
  };

  return (
    <ReportShell
      title="گردش کالا و ورود/خروج"
      subtitle="اول و آخر دوره با تفکیک نوع عملیات"
      excelBusy={excelBusy}
      onExcel={handleExcel}
      printTitle="گزارش گردش کالا و ورود/خروج"
      printMeta={filterMeta}
      printHeaders={['کالا', 'کد', 'فروشگاه', 'انبار', 'وضعیت', 'اول دوره', 'ورود', 'خروج', 'پایان دوره', 'انتقال داخلی', 'ارزش ورود', 'ارزش خروج']}
      printRows={result.rows.map((r) => [
        r.productName,
        r.variantSku,
        r.storeName,
        r.warehouseName,
        r.status === 'defective' ? 'معیوب' : 'سالم',
        r.opening,
        r.inQty,
        r.outQty,
        r.closing,
        r.internalTransferQty,
        Math.round(r.inValue),
        Math.round(r.outValue),
      ])}
      filters={
        <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-3 flex flex-col gap-2">
          <div>
            <div className="text-[10px] font-semibold text-muted-light dark:text-muted-dark pr-1 mb-1">بازه زمانی</div>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5 mb-2">
              {RANGE_PRESETS.map((d) => (
                <FilterChip key={d} active={isPresetActive(d)} onClick={() => presetChip(d)}>
                  {d} روز
                </FilterChip>
              ))}
              <FilterChip active={!isPresetActive(30) && !isPresetActive(60) && !isPresetActive(90)} onClick={() => presetChip(0)}>
                دلخواه
              </FilterChip>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <JalaliDateInput
                label="از تاریخ"
                value={toJalaliString(filters.fromEpoch)}
                onChange={(v) => {
                  const d = jalaliToDate(v);
                  if (d && !isNaN(d.getTime())) setFilters({ ...filters, fromEpoch: d.getTime() });
                }}
              />
              <JalaliDateInput
                label="تا تاریخ"
                value={toJalaliString(filters.toEpoch)}
                onChange={(v) => {
                  const d = jalaliToDate(v);
                  if (d && !isNaN(d.getTime())) setFilters({ ...filters, toEpoch: d.getTime() + 86399000 });
                }}
              />
            </div>
          </div>

          <div>
            <div className="text-[10px] font-semibold text-muted-light dark:text-muted-dark pr-1 mb-1">نوع عملیات</div>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
              {ALL_OPS.map((op) => (
                <FilterChip key={op} active={filters.opTypes.includes(op)} onClick={() => toggleOp(op)}>
                  {OP_LABELS[op]}
                </FilterChip>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Select
              label="دسته"
              value={filters.categoryId}
              onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
              options={[{ value: 'all', label: 'همه دسته‌ها' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
            />
            <Select
              label="کالا"
              value={filters.productId}
              onChange={(e) => setFilters({ ...filters, productId: e.target.value, variantId: 'all' })}
              options={[{ value: 'all', label: 'همه کالاها' }, ...products.map((p) => ({ value: p.id, label: p.name }))]}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select
              label="تنوع"
              value={filters.variantId}
              onChange={(e) => setFilters({ ...filters, variantId: e.target.value })}
              options={[{ value: 'all', label: 'همه تنوع‌ها' }, ...variantOptions.map((v) => ({ value: v.id, label: `${v.name} (${v.sku})` }))]}
            />
            <Select
              label="فروشگاه"
              value={filters.storeId}
              onChange={(e) => setFilters({ ...filters, storeId: e.target.value, warehouseId: 'all' })}
              options={[{ value: 'all', label: 'کل شرکت' }, ...stores.map((s) => ({ value: s.id, label: s.name }))]}
            />
          </div>
          <Select
            label="انبار"
            value={filters.warehouseId}
            onChange={(e) => setFilters({ ...filters, warehouseId: e.target.value })}
            options={[{ value: 'all', label: 'همه انبارها' }, ...warehouses.map((w) => ({ value: w.id, label: w.name }))]}
          />
        </div>
      }
      summary={
        <div className="grid grid-cols-2 gap-2">
          <SummaryBox label="موجودی اول دوره" value={fmt(result.totals.opening)} />
          <SummaryBox label="موجودی پایان دوره" value={fmt(result.totals.closing)} />
          <SummaryBox label="جمع ورود واقعی" value={fmt(result.totals.inQty)} tone="up" />
          <SummaryBox label="جمع خروج واقعی" value={fmt(result.totals.outQty)} tone="down" />
        </div>
      }
    >
      {error && (
        <div className="mb-2 text-[11px] text-red-600 bg-red-500/10 rounded-md px-3 py-2">{error}</div>
      )}

      {/* انتقال داخلی */}
      {result.totals.internal > 0 && (
        <div className="mb-2 bg-orange-soft border border-orange/20 rounded-card p-3 flex items-start gap-2">
          <Icon name="flow" size={14} className="text-orange flex-shrink-0 mt-[1px]" />
          <div className="text-[10.5px] text-orange font-semibold leading-relaxed">
            {fmt(result.totals.internal)} واحد انتقال داخلی بین انبارها از جمع ورود/خروج واقعی شرکت تفکیک شد و در سطح انبارها به‌صورت خروج از مبدأ و ورود به مقصد نمایش داده می‌شود.
          </div>
        </div>
      )}

      {/* مقایسه بازه‌ها */}
      <button
        onClick={() => setCompareOpen(!compareOpen)}
        className="mb-2 w-full py-2.5 rounded-btn bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 text-[11.5px] font-bold text-ink dark:text-cream flex items-center justify-center gap-1.5"
      >
        <Icon name="compare" size={14} className="text-orange" />
        {compareOpen ? 'بستن مقایسه بازه‌ها' : 'مقایسه ورود و خروج در بازه‌های مختلف'}
      </button>
      {compareOpen && (
        <div className="mb-3 bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-3">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <JalaliDateInput
              label="از تاریخ (بازه دوم)"
              value={toJalaliString(compareFrom)}
              onChange={(v) => {
                const d = jalaliToDate(v);
                if (d && !isNaN(d.getTime())) setCompareFrom(d.getTime());
              }}
            />
            <JalaliDateInput
              label="تا تاریخ (بازه دوم)"
              value={toJalaliString(compareTo)}
              onChange={(v) => {
                const d = jalaliToDate(v);
                if (d && !isNaN(d.getTime())) setCompareTo(d.getTime() + 86399000);
              }}
            />
          </div>
          {compare && (
            <ReportTable
              headers={['بازه', 'جمع ورود', 'جمع خروج', 'خالص']}
              rows={[
                [
                  `فعلی (${toJalaliString(filters.fromEpoch)} تا ${toJalaliString(filters.toEpoch)})`,
                  fmt(result.totals.inQty),
                  fmt(result.totals.outQty),
                  fmt(result.totals.inQty - result.totals.outQty),
                ],
                [
                  `دوم (${toJalaliString(compareFrom)} تا ${toJalaliString(compareTo)})`,
                  fmt(compare.inQty),
                  fmt(compare.outQty),
                  fmt(compare.inQty - compare.outQty),
                ],
              ]}
              minWidth={480}
            />
          )}
        </div>
      )}

      {!ds ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-8 h-8 border-[3px] border-orange/30 border-t-orange rounded-full animate-spin" />
        </div>
      ) : result.rows.length === 0 ? (
        <div className="text-center py-10 text-[12px] text-muted-light dark:text-muted-dark">
          گردشی با این فیلترها یافت نشد
        </div>
      ) : (
        <ReportTable
          headers={['کالا', 'کد', 'انبار', 'وضعیت', 'اول دوره', 'ورود', 'خروج', 'پایان دوره', 'جزئیات']}
          rows={result.rows.map((r) => [
            r.productName,
            r.variantSku,
            r.warehouseName,
            r.status === 'defective' ? 'معیوب' : 'سالم',
            fmt(r.opening),
            fmt(r.inQty),
            fmt(r.outQty),
            fmt(r.closing),
            <button
              key="detail-btn"
              onClick={() => setDetailRow(r)}
              className="text-orange font-bold text-[10.5px] flex items-center gap-1"
            >
              <Icon name="list" size={12} />
              تفکیک و اسناد
            </button>,
          ])}
          minWidth={780}
        />
      )}

      {/* شیت تفکیک نوع عملیات و اسناد ردیف */}
      <Sheet
        open={detailRow !== null}
        onClose={() => setDetailRow(null)}
        title={detailRow ? `گردش ${detailRow.productName}` : ''}
        maxHeight="85%"
      >
        {detailRow && (
          <div className="px-4 pb-4">
            <div className="text-[10.5px] text-muted-light dark:text-muted-dark mb-3">
              {detailRow.storeName} • {detailRow.warehouseName} • وضعیت {detailRow.status === 'defective' ? 'معیوب' : 'سالم'}
            </div>

            {/* تفکیک نوع عملیات */}
            <div className="bg-surface-light-2 dark:bg-surface-dark-2 rounded-card p-3 mb-3">
              <div className="text-[10.5px] font-bold text-ink dark:text-cream mb-2">تفکیک نوع عملیات</div>
              <div className="grid grid-cols-2 gap-1.5">
                {ALL_OPS.map((op) => {
                  const inQ = detailRow.inByOp[op] ?? 0;
                  const outQ = detailRow.outByOp[op] ?? 0;
                  if (inQ === 0 && outQ === 0) return null;
                  return (
                    <div key={op} className="bg-white dark:bg-surface-dark-2 rounded-btn p-2 text-center">
                      <div className="text-[9px] text-muted-light dark:text-muted-dark">{OP_LABELS[op]}</div>
                      {inQ > 0 && <div className="text-[10.5px] font-bold text-green-700 dark:text-green-400">+{fmt(inQ)}</div>}
                      {outQ > 0 && <div className="text-[10.5px] font-bold text-red-600">−{fmt(outQ)}</div>}
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-4 gap-1.5 mt-2">
                <div className="text-center">
                  <div className="text-[9px] text-muted-light dark:text-muted-dark">اول دوره</div>
                  <div className="text-[11px] font-extrabold text-ink dark:text-cream">{fmt(detailRow.opening)}</div>
                </div>
                <div className="text-center">
                  <div className="text-[9px] text-muted-light dark:text-muted-dark">ورود</div>
                  <div className="text-[11px] font-extrabold text-green-700 dark:text-green-400">{fmt(detailRow.inQty)}</div>
                </div>
                <div className="text-center">
                  <div className="text-[9px] text-muted-light dark:text-muted-dark">خروج</div>
                  <div className="text-[11px] font-extrabold text-red-600">{fmt(detailRow.outQty)}</div>
                </div>
                <div className="text-center">
                  <div className="text-[9px] text-muted-light dark:text-muted-dark">پایان دوره</div>
                  <div className="text-[11px] font-extrabold text-orange">{fmt(detailRow.closing)}</div>
                </div>
              </div>
            </div>

            {/* اسناد مرتبط */}
            <div className="text-[10.5px] font-bold text-ink dark:text-cream mb-2">اسناد مرتبط ({detailRow.entries.length})</div>
            <div className="flex flex-col gap-1.5">
              {detailRow.entries
                .slice()
                .sort((a, b) => b.dateEpoch - a.dateEpoch)
                .map((e: MovementEntry, i: number) => (
                  <div
                    key={`${e.docId}-${i}`}
                    className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-btn px-3 py-2 flex items-center gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold text-ink dark:text-cream flex items-center gap-1.5 flex-wrap">
                        {OP_LABELS[e.type]} #{e.docNumber}
                        {e.type === 'transfer' && (
                          <Badge variant="muted" size="sm">داخلی</Badge>
                        )}
                      </div>
                      <div className="text-[9.5px] text-muted-light dark:text-muted-dark mt-0.5">{e.dateJalali}</div>
                    </div>
                    <span className={`text-[11px] font-extrabold ${e.qtyIn > 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600'}`}>
                      {e.qtyIn > 0 ? `+${fmt(e.qtyIn)}` : `−${fmt(e.qtyOut)}`}
                    </span>
                    <button
                      onClick={() => {
                        setDetailRow(null);
                        navigate(`/records/${e.docId}`);
                      }}
                      className="w-8 h-8 rounded-btn bg-orange-soft text-orange flex items-center justify-center flex-shrink-0"
                      title="مشاهده سند"
                      aria-label="مشاهده سند"
                    >
                      <Icon name="doc" size={13} />
                    </button>
                  </div>
                ))}
              {detailRow.entries.length === 0 && (
                <div className="text-center py-6 text-[11px] text-muted-light dark:text-muted-dark">
                  سندی در این بازه یافت نشد
                </div>
              )}
            </div>
          </div>
        )}
      </Sheet>
    </ReportShell>
  );
}
