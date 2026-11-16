import { useEffect, useMemo, useState } from 'react';
import {
  buildReportDataset,
  deadStockReport,
  type ReportDataset,
  type DeadStockFilters,
  type DeadStockClass,
} from '../../lib/reports';
import { exportToExcel, loadReportFilters, saveReportFilters } from '../../lib/exporters';
import { fmt, errMsg } from '../../lib/format';
import { jalaliToDate, toJalaliString } from '../../lib/jalali';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Icon } from '../../components/ui/Icon';
import { JalaliDateInput } from '../../components/ui/JalaliDateInput';
import { FilterChip, ReportShell, ReportTable, SummaryBox } from './ReportShell';

const PRESETS = [30, 60, 90, 180, 365] as const;

const FALLBACK: DeadStockFilters = {
  fromEpoch: Date.now() - 90 * 86400000,
  toEpoch: Date.now(),
  categoryId: 'all',
  productId: 'all',
  exitThreshold: 2,
  onlyWithStock: true,
  includeInactive: false,
};

const CLASS_LABEL: Record<DeadStockClass, string> = {
  'no-movement': 'بدون گردش',
  'low-movement': 'کم‌گردش',
  normal: 'نرمال',
};

export function DeadStockReport() {
  const [ds, setDs] = useState<ReportDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<DeadStockFilters>(() =>
    loadReportFilters<DeadStockFilters>('dead', FALLBACK)
  );
  const [preset, setPreset] = useState<number | 'custom'>(90);
  const [excelBusy, setExcelBusy] = useState(false);

  useEffect(() => {
    buildReportDataset().then(setDs).catch((e) => setError(errMsg(e)));
  }, []);

  useEffect(() => {
    saveReportFilters('dead', filters);
  }, [filters]);

  const products = ds?.products ?? [];
  const categories = ds?.categories ?? [];

  const rows = useMemo(() => (ds ? deadStockReport(ds, filters) : []), [ds, filters]);

  const noMovement = rows.filter((r) => r.classification === 'no-movement');
  const lowMovement = rows.filter((r) => r.classification === 'low-movement');
  const inNoOut = rows.filter((r) => r.hasInNoOut);

  const applyPreset = (days: number | 'custom') => {
    setPreset(days);
    if (days !== 'custom') {
      setFilters((f) => ({
        ...f,
        fromEpoch: Date.now() - days * 86400000,
        toEpoch: Date.now(),
      }));
    }
  };

  const filterMeta = [
    `بازه: ${toJalaliString(filters.fromEpoch)} تا ${toJalaliString(filters.toEpoch)}`,
    `آستانه کم‌گردشی: خروج کمتر از ${filters.exitThreshold} بار`,
    `دسته: ${filters.categoryId === 'all' ? 'همه' : categories.find((c) => c.id === filters.categoryId)?.name ?? ''}`,
  ];

  const handleExcel = async () => {
    if (!ds) return;
    setExcelBusy(true);
    try {
      await exportToExcel({
        fileName: `dead-stock-${new Date().toISOString().slice(0, 10)}`,
        sheetName: 'بدون گردش و کم‌گردش',
        title: 'گزارش کالاهای بدون گردش و کم‌گردش',
        meta: filterMeta,
        headers: [
          'کالا', 'کد', 'دسته', 'موجودی سالم', 'طبقه‌بندی',
          'دفعات ورود', 'مقدار ورود', 'دفعات خروج', 'مقدار خروج',
          'آخرین ورود', 'آخرین خروج', 'روز از آخرین گردش', 'ورود بدون خروج',
        ],
        rows: rows.map((r) => [
          r.productName,
          r.variantSku,
          r.categoryName,
          r.totalHealthy,
          CLASS_LABEL[r.classification],
          r.inboundOps,
          r.inboundQty,
          r.outboundOps,
          r.outboundQty,
          r.lastInDate ? toJalaliString(r.lastInDate) : '—',
          r.lastOutDate ? toJalaliString(r.lastOutDate) : '—',
          r.daysSinceMovement ?? '—',
          r.hasInNoOut ? 'بله' : 'خیر',
        ]),
      });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setExcelBusy(false);
    }
  };

  return (
    <ReportShell
      title="کالاهای بدون گردش و کم‌گردش"
      subtitle="تحلیل گردش واقعی شرکت در بازه زمانی"
      excelBusy={excelBusy}
      onExcel={handleExcel}
      printTitle="گزارش کالاهای بدون گردش و کم‌گردش"
      printMeta={filterMeta}
      printHeaders={[
        'کالا', 'کد', 'دسته', 'موجودی سالم', 'طبقه‌بندی',
        'دفعات ورود', 'مقدار ورود', 'دفعات خروج', 'مقدار خروج',
        'آخرین ورود', 'آخرین خروج', 'روز از آخرین گردش', 'ورود بدون خروج',
      ]}
      printRows={rows.map((r) => [
        r.productName,
        r.variantSku,
        r.categoryName,
        r.totalHealthy,
        CLASS_LABEL[r.classification],
        r.inboundOps,
        r.inboundQty,
        r.outboundOps,
        r.outboundQty,
        r.lastInDate ? toJalaliString(r.lastInDate) : '—',
        r.lastOutDate ? toJalaliString(r.lastOutDate) : '—',
        r.daysSinceMovement ?? '—',
        r.hasInNoOut ? 'بله' : 'خیر',
      ])}
      filters={
        <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-3 flex flex-col gap-2">
          <div>
            <div className="text-[10px] font-semibold text-muted-light dark:text-muted-dark pr-1 mb-1">بازه آماده</div>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
              {PRESETS.map((d) => (
                <FilterChip key={d} active={preset === d} onClick={() => applyPreset(d)}>
                  {d} روز
                </FilterChip>
              ))}
              <FilterChip active={preset === 'custom'} onClick={() => applyPreset('custom')}>
                دلخواه
              </FilterChip>
            </div>
          </div>

          {preset === 'custom' && (
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
          )}

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
              onChange={(e) => setFilters({ ...filters, productId: e.target.value })}
              options={[{ value: 'all', label: 'همه کالاها' }, ...products.map((p) => ({ value: p.id, label: p.name }))]}
            />
          </div>

          <Input
            type="number"
            label="آستانه کم‌گردشی (دفعات خروج کمتر از این عدد)"
            value={String(filters.exitThreshold)}
            onChange={(e) => setFilters({ ...filters, exitThreshold: Math.max(1, Number(e.target.value) || 1) })}
          />

          <div className="flex flex-col gap-1.5 pt-0.5">
            <label className="flex items-center gap-2 text-[11px] font-semibold text-ink dark:text-cream">
              <input
                type="checkbox"
                checked={filters.onlyWithStock}
                onChange={(e) => setFilters({ ...filters, onlyWithStock: e.target.checked })}
                className="w-4 h-4 accent-[#D9541E]"
              />
              فقط کالاهای دارای موجودی
            </label>
            <label className="flex items-center gap-2 text-[11px] font-semibold text-ink dark:text-cream">
              <input
                type="checkbox"
                checked={filters.includeInactive}
                onChange={(e) => setFilters({ ...filters, includeInactive: e.target.checked })}
                className="w-4 h-4 accent-[#D9541E]"
              />
              شامل کالاهای غیرفعال
            </label>
          </div>
        </div>
      }
      summary={
        <div className="grid grid-cols-3 gap-2">
          <SummaryBox label="بدون گردش" value={fmt(noMovement.length)} tone="down" />
          <SummaryBox label="کم‌گردش" value={fmt(lowMovement.length)} tone="orange" />
          <SummaryBox label="ورود بدون خروج" value={fmt(inNoOut.length)} />
        </div>
      }
    >
      {error && (
        <div className="mb-2 text-[11px] text-red-600 bg-red-500/10 rounded-md px-3 py-2">{error}</div>
      )}

      {!ds ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-8 h-8 border-[3px] border-orange/30 border-t-orange rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-10 text-[12px] text-muted-light dark:text-muted-dark">
          موردی با این فیلترها یافت نشد
        </div>
      ) : (
        <ReportTable
          headers={[
            'کالا', 'کد', 'موجودی', 'طبقه', 'ورود (تعداد/مقدار)', 'خروج (تعداد/مقدار)',
            'آخرین ورود', 'آخرین خروج', 'روز از آخرین گردش', 'بدون خروج',
          ]}
          rows={rows.map((r) => [
            r.productName,
            r.variantSku,
            r.totalHealthy,
            CLASS_LABEL[r.classification],
            `${r.inboundOps} / ${fmt(r.inboundQty)}`,
            `${r.outboundOps} / ${fmt(r.outboundQty)}`,
            r.lastInDate ? toJalaliString(r.lastInDate) : '—',
            r.lastOutDate ? toJalaliString(r.lastOutDate) : '—',
            r.daysSinceMovement ?? '—',
            r.hasInNoOut ? (
              <span className="text-orange font-bold">بله</span>
            ) : (
              '—'
            ),
          ])}
          minWidth={900}
        />
      )}
    </ReportShell>
  );
}
