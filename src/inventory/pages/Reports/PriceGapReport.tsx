import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { buildPricingDataset, variantStock } from '../../lib/pricingReports';
import { resolveCostValue, solveSuggestedBasePrice, paramsFromTemplate } from '../../lib/pricing';
import { exportToExcel, loadReportFilters, saveReportFilters } from '../../lib/exporters';
import { fmt, errMsg } from '../../lib/format';
import { Select } from '../../components/ui/Select';
import { ReportShell, ReportTable, SummaryBox } from './ReportShell';
import { COST_BASIS_LABELS } from '../../types';
import type { CalcTemplate, SalesChannel } from '../../types';

// گزارش ۵ — فاصله قیمت فعلی تا قیمت موردنیاز برای حاشیهٔ سود هدف
interface GapFilters {
  categoryId: string;
  productId: string;
  channelId: string;
}

const FALLBACK: GapFilters = { categoryId: 'all', productId: 'all', channelId: '' };

interface GapRow {
  productName: string;
  sku: string;
  templateName: string;
  basisName: string;
  cost: number;
  healthy: number;
  defective: number;
  inTransit: number;
  currentPrice: number;
  requiredPrice: number;
  gap: number;
  gapPercent: number;
  warning: string | null;
}

export function PriceGapReport() {
  const [error, setError] = useState<string | null>(null);
  const [excelBusy, setExcelBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<GapRow[]>([]);
  const [filters, setFilters] = useState<GapFilters>(() => loadReportFilters('price-gap', FALLBACK));

  const templates = useLiveQuery(() => db.calcTemplates.toArray(), []) ?? [];
  const channels = useLiveQuery(() => db.salesChannels.toArray(), []) ?? [];

  useEffect(() => {
    saveReportFilters('price-gap', filters);
  }, [filters]);

  // محاسبهٔ کامل ردیف‌ها در یک پاس async — فقط وقتی فیلترها تغییر کنند
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const ds = await buildPricingDataset();
        const [tpls, chs] = await Promise.all([
          db.calcTemplates.toArray(),
          db.salesChannels.toArray(),
        ]);
        const out: GapRow[] = [];

        for (const v of ds.variants) {
          if (!v.isActive) continue;
          if ((v.salePrice ?? 0) <= 0) continue;
          const product = ds.products.find((p) => p.id === v.productId);
          if (!product) continue;
          if (filters.productId !== 'all' && product.id !== filters.productId) continue;
          if (filters.categoryId !== 'all' && product.categoryId !== filters.categoryId) continue;

          const template =
            tpls.find((t) => t.isActive && t.isDefault) ?? tpls.find((t) => t.isActive);
          const stock = variantStock(ds, v.id);

          if (!template) {
            out.push({
              productName: product.name,
              sku: v.sku,
              templateName: '—',
              basisName: '—',
              cost: 0,
              healthy: stock.healthy,
              defective: stock.defective,
              inTransit: stock.inTransit,
              currentPrice: v.salePrice ?? 0,
              requiredPrice: 0,
              gap: 0,
              gapPercent: 0,
              warning: 'الگوی فعالی ثبت نشده است',
            });
            continue;
          }

          const basis = await resolveCostValue(v.id, template.costBasis);
          if (!basis.available) {
            out.push({
              productName: product.name,
              sku: v.sku,
              templateName: template.name,
              basisName: COST_BASIS_LABELS[template.costBasis],
              cost: 0,
              healthy: stock.healthy,
              defective: stock.defective,
              inTransit: stock.inTransit,
              currentPrice: v.salePrice ?? 0,
              requiredPrice: 0,
              gap: 0,
              gapPercent: 0,
              warning: basis.warning,
            });
            continue;
          }

          const channel: SalesChannel | null =
            chs.find((c) => c.id === filters.channelId) ?? null;
          const params = paramsFromTemplate(template, channel, 1, basis.value, 0);
          const solved = solveSuggestedBasePrice(params);
          if (!solved.ok) {
            out.push({
              productName: product.name,
              sku: v.sku,
              templateName: template.name,
              basisName: COST_BASIS_LABELS[template.costBasis],
              cost: basis.value,
              healthy: stock.healthy,
              defective: stock.defective,
              inTransit: stock.inTransit,
              currentPrice: v.salePrice ?? 0,
              requiredPrice: 0,
              gap: 0,
              gapPercent: 0,
              warning: solved.reason,
            });
            continue;
          }

          const required = solved.basePrice;
          const gap = (v.salePrice ?? 0) - required;
          out.push({
            productName: product.name,
            sku: v.sku,
            templateName: template.name,
            basisName: COST_BASIS_LABELS[template.costBasis],
            cost: basis.value,
            healthy: stock.healthy,
            defective: stock.defective,
            inTransit: stock.inTransit,
            currentPrice: v.salePrice ?? 0,
            requiredPrice: required,
            gap,
            gapPercent: required > 0 ? (gap / required) * 100 : 0,
            warning: null,
          });
        }

        if (!cancelled) {
          setRows(out.sort((a, b) => a.gap - b.gap));
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(errMsg(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filters.categoryId, filters.productId, filters.channelId]);

  const belowTarget = rows.filter((r) => r.gap < 0).length;

  const headers = ['کالا', 'کد', 'الگو', 'مبنای هزینه', 'بهای تمام‌شده', 'قیمت فعلی', 'قیمت موردنیاز', 'فاصله', 'فاصله ٪', 'سالم', 'معیوب', 'انتقال'];

  const handleExcel = async () => {
    setExcelBusy(true);
    try {
      await exportToExcel({
        fileName: `price-gap-${new Date().toISOString().slice(0, 10)}`,
        sheetName: 'فاصله تا قیمت هدف',
        title: 'فاصله قیمت فعلی تا قیمت هدف (حاشیهٔ سود هدف الگو)',
        meta: [`کانال: ${filters.channelId ? channels.find((c) => c.id === filters.channelId)?.name : 'بدون کانال'}`],
        headers,
        rows: rows.map((r) => [
          r.productName, r.sku, r.templateName, r.basisName,
          Math.round(r.cost), Math.round(r.currentPrice), Math.round(r.requiredPrice),
          Math.round(r.gap), `${Math.round(r.gapPercent * 100) / 100}٪`,
          r.healthy, r.defective, r.inTransit,
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
      title="فاصله تا قیمت هدف"
      subtitle="قیمت فعلی در برابر قیمت لازم برای حاشیهٔ سود هدف"
      excelBusy={excelBusy}
      onExcel={handleExcel}
      printTitle="گزارش فاصله قیمت تا هدف حاشیهٔ سود"
      printMeta={[`کانال: ${filters.channelId ? channels.find((c) => c.id === filters.channelId)?.name : 'بدون کانال'}`]}
      printHeaders={headers}
      printRows={rows.map((r) => [
        r.productName, r.sku, r.templateName, r.basisName,
        Math.round(r.cost), Math.round(r.currentPrice), Math.round(r.requiredPrice),
        Math.round(r.gap), `${Math.round(r.gapPercent * 100) / 100}٪`,
        r.healthy, r.defective, r.inTransit,
      ])}
      filters={
        <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-3 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Select
              label="دسته"
              value={filters.categoryId}
              onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
              options={[{ value: 'all', label: 'همه دسته‌ها' }]}
            />
            <Select
              label="کانال (اختیاری)"
              value={filters.channelId}
              onChange={(e) => setFilters({ ...filters, channelId: e.target.value })}
              placeholder="بدون کانال"
              options={[{ value: '', label: 'بدون کانال' }, ...channels.map((c) => ({ value: c.id, label: c.name }))]}
            />
          </div>
        </div>
      }
      summary={
        <div className="grid grid-cols-3 gap-2">
          <SummaryBox label="کالاهای قیمت‌دار" value={fmt(rows.length)} />
          <SummaryBox label="زیر قیمت هدف" value={fmt(belowTarget)} tone="down" />
          <SummaryBox label="در هدف یا بالاتر" value={fmt(rows.length - belowTarget)} tone="up" />
        </div>
      }
    >
      {error && <div className="mb-2 text-[11px] text-red-600 bg-red-500/10 rounded-md px-3 py-2">{error}</div>}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-8 h-8 border-[3px] border-orange/30 border-t-orange rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-10 text-[12px] text-muted-light dark:text-muted-dark">
          کالای قیمت‌داری یافت نشد — قیمت فروش کالاها را از ماشین‌حساب یا فرم کالا ثبت کنید
        </div>
      ) : (
        <>
          <ReportTable
            headers={headers}
            rows={rows.map((r) => [
              r.productName,
              r.sku,
              r.templateName,
              r.basisName,
              r.warning ? '—' : fmt(Math.round(r.cost)),
              fmt(Math.round(r.currentPrice)),
              r.warning ? '—' : fmt(Math.round(r.requiredPrice)),
              r.warning ? '—' : (
                <span key="g" className={r.gap < 0 ? 'text-red-600' : 'text-green-700 dark:text-green-400'}>
                  {fmt(Math.round(r.gap))}
                </span>
              ),
              r.warning ? '—' : `${Math.round(r.gapPercent * 100) / 100}٪`,
              fmt(r.healthy),
              fmt(r.defective),
              fmt(r.inTransit),
            ])}
            minWidth={1020}
          />
          {rows.some((r) => r.warning) && (
            <div className="mt-2 text-[9.5px] text-red-600">
              {rows.filter((r) => r.warning).map((r) => `${r.productName}: ${r.warning}`).join(' | ')}
            </div>
          )}
        </>
      )}
    </ReportShell>
  );
}
