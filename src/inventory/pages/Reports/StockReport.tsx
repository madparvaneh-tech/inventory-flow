import { useEffect, useMemo, useState } from 'react';
import { buildReportDataset, stockStatusReport, type ReportDataset, type StockStatusFilters } from '../../lib/reports';
import { exportToExcel, loadReportFilters, saveReportFilters } from '../../lib/exporters';
import { fmt, errMsg } from '../../lib/format';
import { Select } from '../../components/ui/Select';
import { Icon } from '../../components/ui/Icon';
import { FilterChip, ReportShell, ReportTable, SummaryBox } from './ReportShell';

const FALLBACK: StockStatusFilters = {
  productId: 'all',
  variantId: 'all',
  categoryId: 'all',
  storeId: 'all',
  warehouseId: 'all',
  activeFilter: 'all',
  stockFilter: 'with-stock',
};

export function StockReport() {
  const [ds, setDs] = useState<ReportDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<StockStatusFilters>(() =>
    loadReportFilters<StockStatusFilters>('stock', FALLBACK)
  );
  const [excelBusy, setExcelBusy] = useState(false);

  useEffect(() => {
    buildReportDataset().then(setDs).catch((e) => setError(errMsg(e)));
  }, []);

  useEffect(() => {
    saveReportFilters('stock', filters);
  }, [filters]);

  const variants = ds?.variants ?? [];
  const products = ds?.products ?? [];
  const categories = ds?.categories ?? [];
  const stores = ds?.stores ?? [];
  const warehouses = ds?.warehouses.filter((w) => filters.storeId === 'all' || w.storeId === filters.storeId) ?? [];

  const rows = useMemo(() => (ds ? stockStatusReport(ds, filters) : []), [ds, filters]);

  const totals = rows.reduce(
    (acc, r) => {
      acc.healthy += r.healthy;
      acc.defective += r.defective;
      acc.inTransit += r.inTransit;
      return acc;
    },
    { healthy: 0, defective: 0, inTransit: 0 }
  );

  const filterMeta = [
    `دسته: ${filters.categoryId === 'all' ? 'همه' : categories.find((c) => c.id === filters.categoryId)?.name ?? ''}`,
    `فروشگاه: ${filters.storeId === 'all' ? 'همه' : stores.find((s) => s.id === filters.storeId)?.name ?? ''}`,
    `انبار: ${filters.warehouseId === 'all' ? 'همه' : warehouses.find((w) => w.id === filters.warehouseId)?.name ?? ''}`,
    `فیلتر فعال‌بودن: ${filters.activeFilter === 'all' ? 'همه' : filters.activeFilter === 'active' ? 'فعال' : 'غیرفعال'}`,
  ];

  const handleExcel = async () => {
    if (!ds) return;
    setExcelBusy(true);
    try {
      await exportToExcel({
        fileName: `stock-status-${new Date().toISOString().slice(0, 10)}`,
        sheetName: 'وضعیت موجودی',
        title: 'گزارش وضعیت موجودی',
        meta: filterMeta,
        headers: ['کالا', 'کد کالا', 'تنوع', 'دسته', 'فروشگاه', 'انبار', 'سالم', 'معیوب', 'در انتقال', 'حداقل', 'نقطه سفارش', 'واحد'],
        rows: rows.map((r) => [
          r.productName,
          r.productSku,
          r.variantSku,
          r.categoryName,
          r.storeName,
          r.warehouseName,
          r.healthy,
          r.defective,
          r.inTransit,
          r.minStock,
          r.reorderPoint,
          r.unitName,
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
      title="وضعیت موجودی"
      subtitle="موجودی سالم، معیوب و در حال انتقال"
      excelBusy={excelBusy}
      onExcel={handleExcel}
      printTitle="گزارش وضعیت موجودی"
      printMeta={filterMeta}
      printHeaders={['کالا', 'کد کالا', 'دسته', 'فروشگاه', 'انبار', 'سالم', 'معیوب', 'در انتقال', 'حداقل', 'نقطه سفارش', 'واحد']}
      printRows={rows.map((r) => [
        r.productName,
        r.productSku,
        r.categoryName,
        r.storeName,
        r.warehouseName,
        r.healthy,
        r.defective,
        r.inTransit,
        r.minStock,
        r.reorderPoint,
        r.unitName,
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
              onChange={(e) => setFilters({ ...filters, productId: e.target.value, variantId: 'all' })}
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
          <div>
            <div className="text-[10px] font-semibold text-muted-light dark:text-muted-dark pr-1 mb-1">وضعیت کالا</div>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
              <FilterChip active={filters.activeFilter === 'all'} onClick={() => setFilters({ ...filters, activeFilter: 'all' })}>
                همه
              </FilterChip>
              <FilterChip active={filters.activeFilter === 'active'} onClick={() => setFilters({ ...filters, activeFilter: 'active' })}>
                فعال
              </FilterChip>
              <FilterChip active={filters.activeFilter === 'inactive'} onClick={() => setFilters({ ...filters, activeFilter: 'inactive' })}>
                غیرفعال
              </FilterChip>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-muted-light dark:text-muted-dark pr-1 mb-1">موجودی</div>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
              <FilterChip active={filters.stockFilter === 'all'} onClick={() => setFilters({ ...filters, stockFilter: 'all' })}>
                همه
              </FilterChip>
              <FilterChip active={filters.stockFilter === 'with-stock'} onClick={() => setFilters({ ...filters, stockFilter: 'with-stock' })}>
                دارای موجودی
              </FilterChip>
              <FilterChip active={filters.stockFilter === 'without-stock'} onClick={() => setFilters({ ...filters, stockFilter: 'without-stock' })}>
                بدون موجودی
              </FilterChip>
            </div>
          </div>
        </div>
      }
      summary={
        <div className="grid grid-cols-3 gap-2">
          <SummaryBox label="موجودی سالم" value={fmt(totals.healthy)} tone="up" />
          <SummaryBox label="موجودی معیوب" value={fmt(totals.defective)} tone="down" />
          <SummaryBox label="در حال انتقال" value={fmt(totals.inTransit)} tone="orange" />
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
          ردیفی با این فیلترها یافت نشد
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] text-muted-light dark:text-muted-dark flex items-center gap-1">
              <Icon name="list" size={12} />
              {rows.length} ردیف
            </div>
          </div>
          <ReportTable
            headers={['کالا', 'کد', 'دسته', 'فروشگاه', 'انبار', 'سالم', 'معیوب', 'انتقال', 'حداقل', 'سفارش', 'واحد']}
            rows={rows.map((r) => [
              r.productName,
              r.productSku,
              r.categoryName,
              r.storeName,
              r.warehouseName,
              r.healthy,
              r.defective,
              r.inTransit,
              r.minStock,
              r.reorderPoint,
              r.unitName,
            ])}
            minWidth={820}
          />
        </>
      )}
    </ReportShell>
  );
}
