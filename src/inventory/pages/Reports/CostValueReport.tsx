import { useEffect, useMemo, useState } from 'react';
import { buildPricingDataset, variantStock, type PricingDataset } from '../../lib/pricingReports';
import { resolveAllCostBases } from '../../lib/pricing';
import { exportToExcel, loadReportFilters, saveReportFilters } from '../../lib/exporters';
import { fmt, errMsg } from '../../lib/format';
import { Select } from '../../components/ui/Select';
import { FilterChip, ReportShell, ReportTable, SummaryBox } from './ReportShell';
import { COST_BASIS_LABELS } from '../../types';
import type { CostBasisValue } from '../../lib/pricing';

// گزارش ۸ — بهای تمام‌شده و ارزش موجودی به تفکیک کالا با هر سه مبنای قیمت‌گذاری
interface ValueFilters {
  categoryId: string;
  storeId: string;
  warehouseId: string;
  stockFilter: 'all' | 'with-stock';
}

const FALLBACK: ValueFilters = {
  categoryId: 'all',
  storeId: 'all',
  warehouseId: 'all',
  stockFilter: 'with-stock',
};

export function CostValueReport() {
  const [ds, setDs] = useState<PricingDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [excelBusy, setExcelBusy] = useState(false);
  const [filters, setFilters] = useState<ValueFilters>(() => loadReportFilters('cost-value', FALLBACK));

  // مبناهای هر تنوع به‌صورت async
  const [basesMap, setBasesMap] = useState<Map<string, CostBasisValue[]>>(new Map());
  const [loadingBases, setLoadingBases] = useState(false);

  useEffect(() => {
    buildPricingDataset().then(setDs).catch((e) => setError(errMsg(e)));
  }, []);

  useEffect(() => {
    saveReportFilters('cost-value', filters);
  }, [filters]);

  useEffect(() => {
    if (!ds) return;
    let cancelled = false;
    setLoadingBases(true);
    (async () => {
      const map = new Map<string, CostBasisValue[]>();
      for (const v of ds.variants) {
        map.set(v.id, await resolveAllCostBases(v.id));
      }
      if (!cancelled) {
        setBasesMap(map);
        setLoadingBases(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ds]);

  interface Row {
    productName: string;
    sku: string;
    variantSku: string;
    categoryName: string;
    healthy: number;
    defective: number;
    inTransit: number;
    avg: number;
    lastPurchase: number;
    replacement: number;
    value: number;
    warnings: string[];
  }

  const stores = useMemo(() => {
    const seen = new Map<string, string>();
    for (const i of ds?.inventory ?? []) seen.set(i.warehouseId, i.warehouseId);
    return seen;
  }, [ds]);

  const rows = useMemo<Row[]>(() => {
    if (!ds) return [];
    const warehouseIds = new Set<string>();
    for (const inv of ds.inventory) warehouseIds.add(inv.warehouseId);
    const out: Row[] = [];
    for (const v of ds.variants) {
      const product = ds.products.find((p) => p.id === v.productId);
      if (!product) continue;
      if (filters.categoryId !== 'all' && product.categoryId !== filters.categoryId) continue;

      const stock = variantStock(ds, v.id);
      if (filters.stockFilter === 'with-stock' && stock.healthy + stock.defective + stock.inTransit === 0) continue;

      const bases = basesMap.get(v.id);
      const avg = bases?.find((b) => b.basis === 'avg');
      const last = bases?.find((b) => b.basis === 'last_purchase');
      const repl = bases?.find((b) => b.basis === 'replacement');
      const warnings: string[] = [];
      if (avg && !avg.available) warnings.push('میانگین موزون ندارند');
      if (last && !last.available) warnings.push('آخرین خرید ندارند');
      if (repl && !repl.available) warnings.push('قیمت جایگزینی ثبت نشده');

      out.push({
        productName: product.name,
        sku: product.sku,
        variantSku: v.sku,
        categoryName: ds.categories.find((c) => c.id === product.categoryId)?.name ?? '—',
        healthy: stock.healthy,
        defective: stock.defective,
        inTransit: stock.inTransit,
        avg: avg?.value ?? 0,
        lastPurchase: last?.value ?? 0,
        replacement: repl?.value ?? 0,
        value: stock.value,
        warnings,
      });
    }
    return out.sort((a, b) => b.value - a.value);
  }, [ds, filters, basesMap]);

  const totals = rows.reduce(
    (acc, r) => {
      acc.healthy += r.healthy;
      acc.defective += r.defective;
      acc.inTransit += r.inTransit;
      acc.value += r.value;
      return acc;
    },
    { healthy: 0, defective: 0, inTransit: 0, value: 0 }
  );

  const headers = ['کالا', 'کد', 'تنوع', 'دسته', 'سالم', 'معیوب', 'انتقال', 'میانگین موزون', 'آخرین خرید', 'جایگزینی', 'ارزش موجودی سالم'];

  const handleExcel = async () => {
    setExcelBusy(true);
    try {
      await exportToExcel({
        fileName: `cost-value-${new Date().toISOString().slice(0, 10)}`,
        sheetName: 'بهای تمام‌شده و ارزش',
        title: 'گزارش بهای تمام‌شده و ارزش موجودی',
        meta: [
          `دسته: ${filters.categoryId === 'all' ? 'همه' : ds?.categories.find((c) => c.id === filters.categoryId)?.name ?? ''}`,
          'ارزش بر مبنای میانگین موزون سراسری محاسبه می‌شود',
        ],
        headers,
        rows: rows.map((r) => [
          r.productName, r.sku, r.variantSku, r.categoryName,
          r.healthy, r.defective, r.inTransit,
          Math.round(r.avg), Math.round(r.lastPurchase), Math.round(r.replacement),
          Math.round(r.value),
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
      title="بهای تمام‌شده و ارزش موجودی"
      subtitle="هر سه مبنای قیمت‌گذاری کنار هم"
      excelBusy={excelBusy}
      onExcel={handleExcel}
      printTitle="گزارش بهای تمام‌شده و ارزش موجودی"
      printMeta={['ارزش بر مبنای میانگین موزون سراسری']}
      printHeaders={headers}
      printRows={rows.map((r) => [
        r.productName, r.sku, r.variantSku, r.categoryName,
        r.healthy, r.defective, r.inTransit,
        Math.round(r.avg), Math.round(r.lastPurchase), Math.round(r.replacement),
        Math.round(r.value),
      ])}
      filters={
        <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-3 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Select
              label="دسته"
              value={filters.categoryId}
              onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
              options={[{ value: 'all', label: 'همه دسته‌ها' }, ...(ds?.categories ?? []).map((c) => ({ value: c.id, label: c.name }))]}
            />
            <div />
          </div>
          <div>
            <div className="text-[10px] font-semibold text-muted-light dark:text-muted-dark pr-1 mb-1">موجودی</div>
            <div className="flex gap-1.5">
              <FilterChip active={filters.stockFilter === 'with-stock'} onClick={() => setFilters({ ...filters, stockFilter: 'with-stock' })}>
                دارای موجودی
              </FilterChip>
              <FilterChip active={filters.stockFilter === 'all'} onClick={() => setFilters({ ...filters, stockFilter: 'all' })}>
                همه
              </FilterChip>
            </div>
          </div>
        </div>
      }
      summary={
        <div className="grid grid-cols-4 gap-2">
          <SummaryBox label="موجودی سالم" value={fmt(totals.healthy)} tone="up" />
          <SummaryBox label="معیوب" value={fmt(totals.defective)} tone="down" />
          <SummaryBox label="در انتقال" value={fmt(totals.inTransit)} tone="orange" />
          <SummaryBox label="ارزش کل (سالم)" value={fmt(Math.round(totals.value))} />
        </div>
      }
    >
      {error && <div className="mb-2 text-[11px] text-red-600 bg-red-500/10 rounded-md px-3 py-2">{error}</div>}
      {!ds || loadingBases ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-8 h-8 border-[3px] border-orange/30 border-t-orange rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-10 text-[12px] text-muted-light dark:text-muted-dark">
          ردیفی با این فیلترها یافت نشد
        </div>
      ) : (
        <>
          <ReportTable
            headers={headers}
            rows={rows.map((r) => [
              r.productName,
              r.sku,
              r.variantSku,
              r.categoryName,
              fmt(r.healthy),
              fmt(r.defective),
              fmt(r.inTransit),
              r.avg > 0 ? fmt(Math.round(r.avg)) : '—',
              r.lastPurchase > 0 ? fmt(Math.round(r.lastPurchase)) : '—',
              r.replacement > 0 ? fmt(Math.round(r.replacement)) : '—',
              fmt(Math.round(r.value)),
            ])}
            minWidth={1000}
          />
          {rows.some((r) => r.warnings.length > 0) && (
            <div className="mt-2 text-[9.5px] text-orange leading-relaxed">
              {rows.filter((r) => r.warnings.length > 0).length} کالا مبنای ناقص دارند ({rows.filter((r) => r.warnings.length > 0).flatMap((r) => r.warnings).slice(0, 2).join('؛ ')}) — برای تکمیل، قیمت جایگزینی را در فرم کالا ثبت کنید یا رسید تأییدشده ثبت کنید.
            </div>
          )}
        </>
      )}
      {stores.size === 0 && null}
    </ReportShell>
  );
}
