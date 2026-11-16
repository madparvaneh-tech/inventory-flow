import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { buildPricingDataset, variantStock, type PricingDataset } from '../../lib/pricingReports';
import { exportToExcel } from '../../lib/exporters';
import { fmt, errMsg } from '../../lib/format';
import { Select } from '../../components/ui/Select';
import { ReportShell, ReportTable, SummaryBox } from './ReportShell';

// گزارش ۳ — کالاهای متصل به هر الگو + موجودی واقعی موتور موجودی
export function TemplateProductsReport() {
  const [ds, setDs] = useState<PricingDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState('all');
  const [excelBusy, setExcelBusy] = useState(false);

  const templates = useLiveQuery(() => db.calcTemplates.toArray(), []) ?? [];
  const links = useLiveQuery(() => db.templateProducts.toArray(), []) ?? [];

  useEffect(() => {
    buildPricingDataset().then(setDs).catch((e) => setError(errMsg(e)));
  }, []);

  const filteredLinks = links.filter((l) => templateId === 'all' || l.templateId === templateId);

  const rows = useMemo(() => {
    if (!ds) return [];
    return filteredLinks
      .map((l) => {
        const template = templates.find((t) => t.id === l.templateId);
        const product = ds.products.find((p) => p.id === l.productId);
        if (!template || !product) return null;
        const vs = ds.variants.filter((v) => v.productId === product.id);
        const agg = vs.reduce(
          (acc, v) => {
            const s = variantStock(ds, v.id);
            acc.healthy += s.healthy;
            acc.defective += s.defective;
            acc.inTransit += s.inTransit;
            acc.value += s.value;
            return acc;
          },
          { healthy: 0, defective: 0, inTransit: 0, value: 0 }
        );
        const salePrice = vs[0]?.salePrice ?? null;
        return {
          templateName: template.name,
          productName: product.name,
          sku: product.sku,
          variantCount: vs.length,
          ...agg,
          salePrice,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
  }, [ds, filteredLinks, templates]);

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

  const headers = ['الگو', 'کالا', 'کد', 'تنوع‌ها', 'موجودی سالم', 'معیوب', 'در انتقال', 'قیمت فروش ثبت‌شده', 'ارزش موجودی سالم'];

  const handleExcel = async () => {
    setExcelBusy(true);
    try {
      await exportToExcel({
        fileName: `template-products-${new Date().toISOString().slice(0, 10)}`,
        sheetName: 'کالاهای الگو',
        title: 'کالاهای متصل به الگوهای محاسباتی',
        meta: [`الگو: ${templateId === 'all' ? 'همه' : templates.find((t) => t.id === templateId)?.name ?? ''}`],
        headers,
        rows: rows.map((r) => [r.templateName, r.productName, r.sku, r.variantCount, r.healthy, r.defective, r.inTransit, r.salePrice ?? 'ثبت نشده', Math.round(r.value)]),
      });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setExcelBusy(false);
    }
  };

  return (
    <ReportShell
      title="کالاهای متصل به الگو"
      subtitle="با موجودی واقعی و قیمت ثبت‌شده"
      excelBusy={excelBusy}
      onExcel={handleExcel}
      printTitle="گزارش کالاهای متصل به الگوهای محاسباتی"
      printMeta={[`الگو: ${templateId === 'all' ? 'همه' : templates.find((t) => t.id === templateId)?.name ?? ''}`]}
      printHeaders={headers}
      printRows={rows.map((r) => [r.templateName, r.productName, r.sku, r.variantCount, r.healthy, r.defective, r.inTransit, r.salePrice ?? 'ثبت نشده', Math.round(r.value)])}
      filters={
        <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-3">
          <Select
            label="الگو"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            options={[
              { value: 'all', label: 'همه الگوها' },
              ...templates.map((t) => ({ value: t.id, label: t.name })),
            ]}
          />
        </div>
      }
      summary={
        <div className="grid grid-cols-3 gap-2">
          <SummaryBox label="موجودی سالم" value={fmt(totals.healthy)} tone="up" />
          <SummaryBox label="معیوب / انتقال" value={`${fmt(totals.defective)} / ${fmt(totals.inTransit)}`} tone="orange" />
          <SummaryBox label="ارزش موجودی سالم" value={fmt(Math.round(totals.value))} />
        </div>
      }
    >
      {error && <div className="mb-2 text-[11px] text-red-600 bg-red-500/10 rounded-md px-3 py-2">{error}</div>}
      {!ds ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-8 h-8 border-[3px] border-orange/30 border-t-orange rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-10 text-[12px] text-muted-light dark:text-muted-dark">
          کالایی به الگو متصل نیست — از صفحهٔ الگوها دکمهٔ اتصال را استفاده کنید
        </div>
      ) : (
        <ReportTable
          headers={headers}
          rows={rows.map((r) => [
            r.templateName,
            r.productName,
            r.sku,
            fmt(r.variantCount),
            fmt(r.healthy),
            fmt(r.defective),
            fmt(r.inTransit),
            r.salePrice ? fmt(r.salePrice) : 'ثبت نشده',
            fmt(Math.round(r.value)),
          ])}
          minWidth={840}
        />
      )}
    </ReportShell>
  );
}
