import { useEffect, useMemo, useState } from 'react';
import {
  buildReportDataset,
  valueReport,
  type ReportDataset,
  type ValueFilters,
  type ValueRow,
} from '../../lib/reports';
import { exportToExcel, loadReportFilters, saveReportFilters } from '../../lib/exporters';
import { fmt, fmtShort, errMsg } from '../../lib/format';
import { Select } from '../../components/ui/Select';
import { Icon } from '../../components/ui/Icon';
import { Sheet } from '../../components/ui/Sheet';
import { ReportShell, ReportTable, SummaryBox } from './ReportShell';

const FALLBACK: ValueFilters = {
  productId: 'all',
  categoryId: 'all',
  storeId: 'all',
  warehouseId: 'all',
};

export function ValueReport() {
  const [ds, setDs] = useState<ReportDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ValueFilters>(() =>
    loadReportFilters<ValueFilters>('value', FALLBACK)
  );
  const [detailRow, setDetailRow] = useState<ValueRow | null>(null);
  const [excelBusy, setExcelBusy] = useState(false);

  useEffect(() => {
    buildReportDataset().then(setDs).catch((e) => setError(errMsg(e)));
  }, []);

  useEffect(() => {
    saveReportFilters('value', filters);
  }, [filters]);

  const products = ds?.products ?? [];
  const categories = ds?.categories ?? [];
  const stores = ds?.stores ?? [];
  const warehouses = ds?.warehouses.filter((w) => filters.storeId === 'all' || w.storeId === filters.storeId) ?? [];

  const result = useMemo(
    () => (ds ? valueReport(ds, filters) : { rows: [], storeGroups: [], warehouseGroups: [], totals: { healthy: 0, defective: 0, inTransit: 0, total: 0 } }),
    [ds, filters]
  );

  const filterMeta = [
    `دسته: ${filters.categoryId === 'all' ? 'همه' : categories.find((c) => c.id === filters.categoryId)?.name ?? ''}`,
    `فروشگاه: ${filters.storeId === 'all' ? 'همه' : stores.find((s) => s.id === filters.storeId)?.name ?? ''}`,
    `انبار: ${filters.warehouseId === 'all' ? 'همه' : warehouses.find((w) => w.id === filters.warehouseId)?.name ?? ''}`,
    'روش ارزش‌گذاری: میانگین موزون متحرک',
  ];

  const handleExcel = async () => {
    if (!ds) return;
    setExcelBusy(true);
    try {
      await exportToExcel({
        fileName: `inventory-value-${new Date().toISOString().slice(0, 10)}`,
        sheetName: 'ارزش موجودی',
        title: 'گزارش ارزش موجودی و بهای خرید',
        meta: filterMeta,
        headers: ['کالا', 'کد', 'دسته', 'ارزش سالم', 'ارزش معیوب', 'ارزش در انتقال', 'جمع ارزش', 'میانگین بهای تمام‌شده', 'آخرین قیمت خرید', 'تاریخ آخرین خرید', 'سهم از کل (٪)'],
        rows: result.rows.map((r) => [
          r.productName,
          r.variantSku,
          r.categoryName,
          Math.round(r.healthyValue),
          Math.round(r.defectiveValue),
          Math.round(r.inTransitValue),
          Math.round(r.totalValue),
          Math.round(r.avgCost),
          r.lastPurchasePrice !== null ? Math.round(r.lastPurchasePrice) : '—',
          r.lastPurchaseDateJalali ?? '—',
          r.sharePercent.toFixed(1),
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
      title="ارزش موجودی و بهای خرید"
      subtitle="ارزش‌گذاری با میانگین موزون متحرک"
      excelBusy={excelBusy}
      onExcel={handleExcel}
      printTitle="گزارش ارزش موجودی و بهای خرید"
      printMeta={filterMeta}
      printHeaders={['کالا', 'کد', 'دسته', 'ارزش سالم', 'ارزش معیوب', 'ارزش در انتقال', 'جمع ارزش', 'میانگین بهای تمام‌شده', 'آخرین قیمت خرید', 'سهم از کل (٪)']}
      printRows={result.rows.map((r) => [
        r.productName,
        r.variantSku,
        r.categoryName,
        Math.round(r.healthyValue),
        Math.round(r.defectiveValue),
        Math.round(r.inTransitValue),
        Math.round(r.totalValue),
        Math.round(r.avgCost),
        r.lastPurchasePrice !== null ? Math.round(r.lastPurchasePrice) : '—',
        r.sharePercent.toFixed(1),
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
        </div>
      }
      summary={
        <div className="grid grid-cols-2 gap-2">
          <SummaryBox label="ارزش موجودی سالم" value={`${fmtShort(result.totals.healthy)} ریال`} tone="up" />
          <SummaryBox label="ارزش موجودی معیوب" value={`${fmtShort(result.totals.defective)} ریال`} tone="down" />
          <SummaryBox label="ارزش در حال انتقال" value={`${fmtShort(result.totals.inTransit)} ریال`} tone="orange" />
          <SummaryBox label="جمع ارزش موجودی" value={`${fmtShort(result.totals.total)} ریال`} />
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
      ) : (
        <>
          {/* ارزش به تفکیک فروشگاه و انبار */}
          {(result.storeGroups.length > 0 || result.warehouseGroups.length > 0) && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {result.storeGroups.length > 0 && (
                <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-3">
                  <div className="text-[10px] font-bold text-orange mb-2 flex items-center gap-1">
                    <Icon name="store" size={12} />
                    به تفکیک فروشگاه
                  </div>
                  {result.storeGroups.map((g) => (
                    <div key={g.name} className="flex justify-between items-center py-1 text-[10.5px]">
                      <span className="text-muted-light dark:text-muted-dark font-medium truncate">{g.name}</span>
                      <span className="font-bold text-ink dark:text-cream">{fmtShort(g.value)}</span>
                    </div>
                  ))}
                </div>
              )}
              {result.warehouseGroups.length > 0 && (
                <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-3">
                  <div className="text-[10px] font-bold text-orange mb-2 flex items-center gap-1">
                    <Icon name="warehouse" size={12} />
                    به تفکیک انبار
                  </div>
                  {result.warehouseGroups.map((g) => (
                    <div key={g.name} className="flex justify-between items-center py-1 text-[10.5px]">
                      <span className="text-muted-light dark:text-muted-dark font-medium truncate">{g.name}</span>
                      <span className="font-bold text-ink dark:text-cream">{fmtShort(g.value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {result.rows.length === 0 ? (
            <div className="text-center py-10 text-[12px] text-muted-light dark:text-muted-dark">
              موردی با این فیلترها یافت نشد
            </div>
          ) : (
            <ReportTable
              headers={['کالا', 'کد', 'ارزش سالم', 'ارزش معیوب', 'جمع ارزش', 'میانگین بها', 'آخرین خرید', 'سهم ٪', 'جزئیات']}
              rows={result.rows.map((r) => [
                r.productName,
                r.variantSku,
                fmtShort(r.healthyValue),
                fmtShort(r.defectiveValue),
                fmtShort(r.totalValue),
                fmt(Math.round(r.avgCost)),
                r.lastPurchasePrice !== null ? fmt(Math.round(r.lastPurchasePrice)) : '—',
                `${r.sharePercent.toFixed(1)}٪`,
                <button
                  key="calc-btn"
                  onClick={() => setDetailRow(r)}
                  className="text-orange font-bold text-[10.5px] flex items-center gap-1"
                >
                  <Icon name="search" size={12} />
                  محاسبه
                </button>,
              ])}
              minWidth={820}
            />
          )}
        </>
      )}

      {/* شیت جزئیات محاسبه بهای تمام‌شده */}
      <Sheet
        open={detailRow !== null}
        onClose={() => setDetailRow(null)}
        title={detailRow ? `جزئیات بهای ${detailRow.productName}` : ''}
        maxHeight="80%"
      >
        {detailRow && (
          <div className="px-4 pb-4">
            <div className="bg-surface-light-2 dark:bg-surface-dark-2 rounded-card p-3 mb-3">
              <div className="flex justify-between items-center py-1.5 text-[11px] border-b border-dashed border-black/5 dark:border-cream/10">
                <span className="text-muted-light dark:text-muted-dark">ارزش موجودی سالم</span>
                <span className="font-bold text-ink dark:text-cream">
                  {fmt(detailRow.healthyQty)} × میانگین = {fmt(Math.round(detailRow.healthyValue))} ریال
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 text-[11px] border-b border-dashed border-black/5 dark:border-cream/10">
                <span className="text-muted-light dark:text-muted-dark">ارزش موجودی معیوب</span>
                <span className="font-bold text-ink dark:text-cream">
                  {fmt(detailRow.defectiveQty)} عدد = {fmt(Math.round(detailRow.defectiveValue))} ریال
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 text-[11px] border-b border-dashed border-black/5 dark:border-cream/10">
                <span className="text-muted-light dark:text-muted-dark">ارزش در حال انتقال</span>
                <span className="font-bold text-ink dark:text-cream">
                  {fmt(detailRow.inTransitQty)} عدد = {fmt(Math.round(detailRow.inTransitValue))} ریال
                </span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-[11.5px] font-bold text-ink dark:text-cream">جمع ارزش موجودی</span>
                <span className="text-[13px] font-extrabold text-orange">
                  {fmt(Math.round(detailRow.totalValue))} ریال
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-btn p-3">
                <div className="text-[9.5px] text-muted-light dark:text-muted-dark font-semibold mb-1">
                  میانگین بهای تمام‌شده (میانگین موزون متحرک)
                </div>
                <div className="text-[13px] font-extrabold text-orange">
                  {fmt(Math.round(detailRow.avgCost))} ریال
                </div>
              </div>
              <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-btn p-3">
                <div className="text-[9.5px] text-muted-light dark:text-muted-dark font-semibold mb-1">
                  آخرین قیمت خرید ثبت‌شده
                </div>
                <div className="text-[13px] font-extrabold text-ink dark:text-cream">
                  {detailRow.lastPurchasePrice !== null
                    ? `${fmt(Math.round(detailRow.lastPurchasePrice))} ریال`
                    : '—'}
                  {detailRow.lastPurchaseDateJalali && (
                    <span className="text-[9.5px] font-medium text-muted-light dark:text-muted-dark mr-1.5">
                      ({detailRow.lastPurchaseDateJalali})
                    </span>
                  )}
                </div>
              </div>
              <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-btn p-3">
                <div className="text-[9.5px] text-muted-light dark:text-muted-dark font-semibold mb-1">
                  سهم از کل ارزش موجودی
                </div>
                <div className="text-[13px] font-extrabold text-orange">
                  {detailRow.sharePercent.toFixed(1)}٪
                </div>
                <div className="mt-2 h-1.5 bg-black/5 dark:bg-cream/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange rounded-full"
                    style={{ width: `${Math.min(100, detailRow.sharePercent)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-3 text-[9.5px] text-muted-light dark:text-muted-dark leading-relaxed flex items-start gap-1">
              <Icon name="warning" size={11} className="text-orange flex-shrink-0 mt-[1px]" />
              <span>
                ارزش موجودی از حاصل‌ضرب موجودی هر ردیف در میانگین موزون آن محاسبه می‌شود. انتقال بین انبارها ارزش کل شرکت را تغییر نمی‌دهد.
              </span>
            </div>
          </div>
        )}
      </Sheet>
    </ReportShell>
  );
}
