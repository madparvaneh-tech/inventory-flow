import { useEffect, useMemo, useState } from 'react';
import {
  buildReportDataset,
  shortageReport,
  type ReportDataset,
  type ShortageFilters,
  type ShortageStatus,
} from '../../lib/reports';
import { exportToExcel, loadReportFilters, saveReportFilters } from '../../lib/exporters';
import { fmt, errMsg } from '../../lib/format';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Icon } from '../../components/ui/Icon';
import { ReportShell, ReportTable, SummaryBox } from './ReportShell';

const FALLBACK: ShortageFilters = {
  storeId: 'all',
  warehouseId: 'all',
  categoryId: 'all',
  productId: 'all',
  minStockOnly: true,
  marginPercent: 10,
};

const STATUS_LABEL: Record<ShortageStatus, string> = {
  zero: 'موجودی صفر',
  'below-min': 'زیر حداقل',
  'at-reorder': 'نقطه سفارش',
  'defective-only': 'دارای معیوب',
  ok: 'نرمال',
};

export function ShortageReport() {
  const [ds, setDs] = useState<ReportDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ShortageFilters>(() =>
    loadReportFilters<ShortageFilters>('low', FALLBACK)
  );
  const [excelBusy, setExcelBusy] = useState(false);

  useEffect(() => {
    buildReportDataset().then(setDs).catch((e) => setError(errMsg(e)));
  }, []);

  useEffect(() => {
    saveReportFilters('low', filters);
  }, [filters]);

  const products = ds?.products ?? [];
  const categories = ds?.categories ?? [];
  const stores = ds?.stores ?? [];
  const warehouses = ds?.warehouses.filter((w) => filters.storeId === 'all' || w.storeId === filters.storeId) ?? [];

  const rows = useMemo(() => (ds ? shortageReport(ds, filters) : []), [ds, filters]);

  const belowMin = rows.filter((r) => r.status === 'zero' || r.status === 'below-min');
  const atReorder = rows.filter((r) => r.status === 'at-reorder');
  const coveredWarnings = rows.filter((r) => r.storeHasCoverage);
  const totalShortfall = rows.reduce((s, r) => s + r.shortfall, 0);

  const filterMeta = [
    `فروشگاه: ${filters.storeId === 'all' ? 'همه' : stores.find((s) => s.id === filters.storeId)?.name ?? ''}`,
    `انبار: ${filters.warehouseId === 'all' ? 'همه' : warehouses.find((w) => w.id === filters.warehouseId)?.name ?? ''}`,
    `حاشیه اطمینان سفارش پیشنهادی: ${filters.marginPercent}٪`,
  ];

  const handleExcel = async () => {
    if (!ds) return;
    setExcelBusy(true);
    try {
      await exportToExcel({
        fileName: `shortage-${new Date().toISOString().slice(0, 10)}`,
        sheetName: 'کمبود و نقطه سفارش',
        title: 'گزارش کمبود و نقطه سفارش',
        meta: filterMeta,
        headers: ['کالا', 'کد', 'فروشگاه', 'انبار', 'موجودی سالم', 'معیوب', 'حداقل', 'نقطه سفارش', 'وضعیت', 'کسری', 'سفارش پیشنهادی', 'هشدار'],
        rows: rows.map((r) => [
          r.productName,
          r.variantSku,
          r.storeName,
          r.warehouseName,
          r.healthy,
          r.defective,
          r.minStock,
          r.reorderPoint,
          STATUS_LABEL[r.status],
          r.shortfall,
          r.suggestedOrder,
          r.storeHasCoverage ? 'پوشش در سطح فروشگاه' : '',
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
      title="کمبود و نقطه سفارش"
      subtitle="کالاهای زیر حداقل و سفارش پیشنهادی"
      excelBusy={excelBusy}
      onExcel={handleExcel}
      printTitle="گزارش کمبود و نقطه سفارش"
      printMeta={filterMeta}
      printHeaders={['کالا', 'کد', 'فروشگاه', 'انبار', 'سالم', 'معیوب', 'حداقل', 'نقطه سفارش', 'وضعیت', 'کسری', 'سفارش پیشنهادی', 'هشدار']}
      printRows={rows.map((r) => [
        r.productName,
        r.variantSku,
        r.storeName,
        r.warehouseName,
        r.healthy,
        r.defective,
        r.minStock,
        r.reorderPoint,
        STATUS_LABEL[r.status],
        r.shortfall,
        r.suggestedOrder,
        r.storeHasCoverage ? 'پوشش در سطح فروشگاه' : '',
      ])}
      filters={
        <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-3 flex flex-col gap-2">
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
          <div className="grid grid-cols-2 gap-2">
            <Select
              label="فروشگاه"
              value={filters.storeId}
              onChange={(e) => setFilters({ ...filters, storeId: e.target.value, warehouseId: 'all' })}
              options={[{ value: 'all', label: 'کل شرکت' }, ...stores.map((s) => ({ value: s.id, label: s.name }))]}
            />
            <Select
              label="انبار"
              value={filters.warehouseId}
              onChange={(e) => setFilters({ ...filters, warehouseId: e.target.value })}
              options={[{ value: 'all', label: 'همه انبارها' }, ...warehouses.map((w) => ({ value: w.id, label: w.name }))]}
            />
          </div>
          <Input
            type="number"
            label="حاشیه اطمینان سفارش پیشنهادی (٪)"
            value={String(filters.marginPercent)}
            onChange={(e) => setFilters({ ...filters, marginPercent: Number(e.target.value) || 0 })}
            placeholder="مثلاً ۱۰"
          />
          <label className="flex items-center gap-2 text-[11px] font-semibold text-ink dark:text-cream pt-0.5">
            <input
              type="checkbox"
              checked={filters.minStockOnly}
              onChange={(e) => setFilters({ ...filters, minStockOnly: e.target.checked })}
              className="w-4 h-4 accent-[#D9541E]"
            />
            فقط کالاهای دارای کمبود
          </label>
        </div>
      }
      summary={
        <div className="grid grid-cols-3 gap-2">
          <SummaryBox label="زیر حداقل / صفر" value={fmt(belowMin.length)} tone="down" />
          <SummaryBox label="رسیده به نقطه سفارش" value={fmt(atReorder.length)} tone="orange" />
          <SummaryBox label="جمع کسری" value={fmt(totalShortfall)} />
        </div>
      }
    >
      {error && (
        <div className="mb-2 text-[11px] text-red-600 bg-red-500/10 rounded-md px-3 py-2">{error}</div>
      )}

      {/* هشدار پوشش فروشگاه — انبار کمبود دارد ولی کل فروشگاه کافی است */}
      {coveredWarnings.length > 0 && (
        <div className="mb-2 bg-orange-soft border border-orange/20 rounded-card p-3 flex items-start gap-2">
          <Icon name="warning" size={14} className="text-orange flex-shrink-0 mt-[1px]" />
          <div className="text-[10.5px] text-orange font-semibold leading-relaxed">
            در {coveredWarnings.length} ردیف، موجودی کل فروشگاه کافی است ولی انبار مربوطه کمبود دارد — جابه‌جایی داخلی می‌تواند کسری را پوشش دهد.
          </div>
        </div>
      )}

      {!ds ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-8 h-8 border-[3px] border-orange/30 border-t-orange rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-10 text-[12px] text-muted-light dark:text-muted-dark">
          موردی با این فیلترها یافت نشد — همه کالاها بالای حداقل هستند
        </div>
      ) : (
        <ReportTable
          headers={['کالا', 'کد', 'فروشگاه', 'انبار', 'سالم', 'معیوب', 'حداقل', 'وضعیت', 'کسری', 'سفارش پیشنهادی']}
          rows={rows.map((r) => [
            r.productName,
            r.variantSku,
            r.storeName,
            r.warehouseName,
            r.healthy,
            r.defective,
            r.minStock,
            STATUS_LABEL[r.status],
            r.shortfall > 0 ? fmt(r.shortfall) : '—',
            r.suggestedOrder > 0 ? fmt(r.suggestedOrder) : '—',
          ])}
          minWidth={780}
        />
      )}
    </ReportShell>
  );
}
