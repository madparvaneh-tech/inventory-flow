import { useEffect, useMemo, useState } from 'react';
import { db } from '../../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { resolveAllCostBases, fullCalc, paramsFromTemplate, type CostBasisValue } from '../../lib/pricing';
import { exportToExcel } from '../../lib/exporters';
import { fmt, errMsg } from '../../lib/format';
import { Select } from '../../components/ui/Select';
import { ReportShell, ReportTable } from './ReportShell';
import { COST_BASIS_LABELS } from '../../types';
import type { CalcTemplate, Product, Variant } from '../../types';

// گزارش ۲ — مقایسه الگوهای محاسباتی روی یک کالای مرجع
export function TemplateCompareReport() {
  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];
  const variants = useLiveQuery(() => db.variants.toArray(), []) ?? [];
  const templates = useLiveQuery(() => db.calcTemplates.toArray(), []) ?? [];
  const channels = useLiveQuery(() => db.salesChannels.toArray(), []) ?? [];

  const [productId, setProductId] = useState('');
  const [channelId, setChannelId] = useState('');
  const [bases, setBases] = useState<CostBasisValue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [excelBusy, setExcelBusy] = useState(false);

  useEffect(() => {
    if (!productId && products.length > 0) setProductId(products[0].id);
  }, [products]);

  const productVariants = useMemo(
    () => variants.filter((v) => v.productId === productId && v.isActive),
    [variants, productId]
  );
  const variant = productVariants[0] ?? null;

  useEffect(() => {
    if (!variant) {
      setBases([]);
      return;
    }
    let cancelled = false;
    resolveAllCostBases(variant.id).then((list) => {
      if (!cancelled) setBases(list);
    });
    return () => {
      cancelled = true;
    };
  }, [variant?.id]);

  const channel = channels.find((c) => c.id === channelId) ?? null;

  const rows = useMemo(() => {
    return templates
      .filter((t) => t.isActive)
      .map((t: CalcTemplate) => {
        const basis = bases.find((b) => b.basis === t.costBasis);
        if (!basis || !basis.available) {
          return {
            template: t,
            error: basis?.warning ?? 'مبنای بهای تمام‌شده در دسترس نیست',
            costValue: 0,
            basePrice: 0,
            customerPaid: 0,
            fees: 0,
            profit: 0,
            margin: 0,
            breakeven: 0,
          };
        }
        const params = paramsFromTemplate(t, channel, 1, basis.value, 0);
        const calc = fullCalc(params);
        if (!calc.ok || !calc.breakdown) {
          return {
            template: t,
            error: calc.reason ?? 'محاسبه ممکن نیست',
            costValue: basis.value,
            basePrice: 0,
            customerPaid: 0,
            fees: 0,
            profit: 0,
            margin: 0,
            breakeven: 0,
          };
        }
        const b = calc.breakdown;
        return {
          template: t,
          error: null as string | null,
          costValue: basis.value,
          basePrice: b.roundedBasePrice ?? b.basePrice,
          customerPaid: b.customerPaidUnit,
          fees: b.feesTotal,
          profit: b.profitUnit,
          margin: b.marginPercent,
          breakeven: b.breakevenCustomerPaidUnit,
        };
      });
  }, [templates, bases, channel]);

  const handleExcel = async () => {
    if (!variant) return;
    setExcelBusy(true);
    try {
      await exportToExcel({
        fileName: `template-compare-${new Date().toISOString().slice(0, 10)}`,
        sheetName: 'مقایسه الگوها',
        title: `مقایسه الگوهای محاسباتی — ${products.find((p) => p.id === productId)?.name ?? ''}`,
        meta: [`کانال: ${channel?.name ?? 'بدون کانال'}`, 'تعداد مرجع: ۱ واحد'],
        headers: ['الگو', 'مبنای هزینه', 'بهای تمام‌شده', 'قیمت پایهٔ پیشنهادی', 'پرداختی مشتری', 'هزینه‌های فروش', 'سود', 'حاشیه سود', 'سربه‌سر'],
        rows: rows.map((r) => [
          r.template.name,
          COST_BASIS_LABELS[r.template.costBasis],
          Math.round(r.costValue),
          Math.round(r.basePrice),
          Math.round(r.customerPaid),
          Math.round(r.fees),
          Math.round(r.profit),
          `${Math.round(r.margin * 100) / 100}٪`,
          Math.round(r.breakeven),
        ]),
      });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setExcelBusy(false);
    }
  };

  const headers = ['الگو', 'مبنای هزینه', 'بهای تمام‌شده', 'قیمت پایهٔ پیشنهادی', 'پرداختی مشتری', 'هزینه‌های فروش', 'سود / واحد', 'حاشیه', 'سربه‌سر'];

  return (
    <ReportShell
      title="مقایسه الگوهای محاسباتی"
      subtitle="خروجی هر الگو روی کالای مرجع"
      excelBusy={excelBusy}
      onExcel={handleExcel}
      printTitle="گزارش مقایسه الگوهای محاسباتی"
      printMeta={[`کانال: ${channel?.name ?? 'بدون کانال'}`, 'تعداد مرجع: ۱ واحد']}
      printHeaders={headers}
      printRows={rows.map((r) => [
        r.template.name,
        COST_BASIS_LABELS[r.template.costBasis],
        Math.round(r.costValue),
        Math.round(r.basePrice),
        Math.round(r.customerPaid),
        Math.round(r.fees),
        Math.round(r.profit),
        `${Math.round(r.margin * 100) / 100}٪`,
        Math.round(r.breakeven),
      ])}
      filters={
        <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-3 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Select
              label="کالای مرجع"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              options={products.map((p: Product) => ({ value: p.id, label: p.name }))}
            />
            <Select
              label="کانال (اختیاری)"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              placeholder="بدون کانال"
              options={[{ value: '', label: 'بدون کانال' }, ...channels.map((c) => ({ value: c.id, label: c.name }))]}
            />
          </div>
          {variant && (
            <div className="text-[10px] text-muted-light dark:text-muted-dark">
              تنوع مرجع: {variant.name} • کد: {variant.sku}
              {productVariants.length > 1 && ` (${productVariants.length} تنوع — اولین تنوع فعال)`}
            </div>
          )}
        </div>
      }
    >
      {error && <div className="mb-2 text-[11px] text-red-600 bg-red-500/10 rounded-md px-3 py-2">{error}</div>}
      {templates.filter((t) => t.isActive).length === 0 ? (
        <div className="text-center py-10 text-[12px] text-muted-light dark:text-muted-dark">
          الگوی فعالی ثبت نشده است
        </div>
      ) : (
        <ReportTable
          headers={headers}
          rows={rows.map((r) => [
            <span key="t" className={r.error ? 'text-red-600' : ''}>
              {r.template.name}
              {r.template.isDefault ? ' (پیش‌فرض)' : ''}
              {r.error ? ' ⚠' : ''}
            </span>,
            COST_BASIS_LABELS[r.template.costBasis],
            r.error ? '—' : fmt(Math.round(r.costValue)),
            r.error ? '—' : fmt(Math.round(r.basePrice)),
            r.error ? '—' : fmt(Math.round(r.customerPaid)),
            r.error ? '—' : fmt(Math.round(r.fees)),
            r.error ? '—' : <span key="p" className={r.profit >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600'}>{fmt(Math.round(r.profit))}</span>,
            r.error ? '—' : `${Math.round(r.margin * 100) / 100}٪`,
            r.error ? '—' : fmt(Math.round(r.breakeven)),
          ])}
          minWidth={860}
        />
      )}
      {rows.some((r) => r.error) && (
        <div className="mt-2 text-[9.5px] text-red-600">
          الگوهای دارای علامت ⚠ مبنای هزینهٔ در دسترس ندارند: {rows.filter((r) => r.error).map((r) => `${r.template.name} — ${r.error}`).join(' | ')}
        </div>
      )}
    </ReportShell>
  );
}
