import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { exportToExcel } from '../../lib/exporters';
import { fmt, errMsg } from '../../lib/format';
import { Select } from '../../components/ui/Select';
import { ReportShell, ReportTable } from './ReportShell';
import { COST_BASIS_LABELS } from '../../types';
import type { CalcHistory, CostBasis, PriceLog } from '../../types';

// گزارش ۶ — تاریخچه قیمت‌های پیشنهادی و قیمت‌های ثبت‌شده
interface UnifiedRow {
  date: number;
  kind: 'suggested' | 'registered';
  productName: string;
  sourceLabel: string;
  templateName: string;
  oldPrice: number | null;
  newPrice: number;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

export function PriceHistoryReport() {
  const [error, setError] = useState<string | null>(null);
  const [productId, setProductId] = useState('all');
  const [excelBusy, setExcelBusy] = useState(false);

  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];
  const variants = useLiveQuery(() => db.variants.toArray(), []) ?? [];
  const priceLogs = useLiveQuery(() => db.priceLog.toArray(), []) ?? [];
  const calcHistories = useLiveQuery(() => db.calcHistory.toArray(), []) ?? [];

  const variantById = new Map(variants.map((v) => [v.id, v]));
  const productName = (variantId: string) => {
    const v = variantById.get(variantId);
    return products.find((p) => p.id === v?.productId)?.name ?? '—';
  };

  const rows = useMemo<UnifiedRow[]>(() => {
    const reg: UnifiedRow[] = (priceLogs as PriceLog[])
      .filter((l) => productId === 'all' || variantById.get(l.variantId)?.productId === productId)
      .map((l) => ({
        date: l.createdAt,
        kind: 'registered' as const,
        productName: productName(l.variantId),
        sourceLabel: l.source === 'calc' ? 'ثبت از محاسبه' : 'ثبت دستی',
        templateName: '—',
        oldPrice: l.oldPrice,
        newPrice: l.newPrice,
      }));
    const sug: UnifiedRow[] = (calcHistories as CalcHistory[])
      .filter((h) => productId === 'all' || h.productId === productId)
      .map((h) => ({
        date: h.createdAt,
        kind: 'suggested' as const,
        productName: productName(h.variantId),
        sourceLabel: 'قیمت پیشنهادی سیستم',
        templateName: `${h.templateName}${h.channelName ? ` + ${h.channelName}` : ''}`,
        oldPrice: null,
        newPrice: h.basePrice,
      }));
    return [...reg, ...sug].sort((a, b) => b.date - a.date);
     
  }, [priceLogs, calcHistories, productId, variants, products]);

  const headers = ['تاریخ', 'کالا', 'نوع', 'منبع / الگو', 'قیمت قبلی', 'قیمت جدید'];

  const handleExcel = async () => {
    setExcelBusy(true);
    try {
      await exportToExcel({
        fileName: `price-history-${new Date().toISOString().slice(0, 10)}`,
        sheetName: 'تاریخچه قیمت',
        title: 'تاریخچه قیمت‌های پیشنهادی و ثبت‌شده',
        meta: [`کالا: ${productId === 'all' ? 'همه' : products.find((p) => p.id === productId)?.name ?? ''}`],
        headers,
        rows: rows.map((r) => [formatDate(r.date), r.productName, r.kind === 'registered' ? 'ثبت‌شده' : 'پیشنهادی', r.sourceLabel, r.oldPrice ?? '—', Math.round(r.newPrice)]),
      });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setExcelBusy(false);
    }
  };

  return (
    <ReportShell
      title="تاریخچه قیمت‌ها"
      subtitle="قیمت‌های پیشنهادی سیستم و قیمت‌های ثبت‌شده"
      excelBusy={excelBusy}
      onExcel={handleExcel}
      printTitle="گزارش تاریخچه قیمت‌ها"
      printMeta={[`کالا: ${productId === 'all' ? 'همه' : products.find((p) => p.id === productId)?.name ?? ''}`]}
      printHeaders={headers}
      printRows={rows.map((r) => [formatDate(r.date), r.productName, r.kind === 'registered' ? 'ثبت‌شده' : 'پیشنهادی', r.sourceLabel, r.oldPrice ?? '—', Math.round(r.newPrice)])}
      filters={
        <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-3">
          <Select
            label="کالا"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            options={[
              { value: 'all', label: 'همه کالاها' },
              ...products.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
        </div>
      }
    >
      {error && <div className="mb-2 text-[11px] text-red-600 bg-red-500/10 rounded-md px-3 py-2">{error}</div>}
      {rows.length === 0 ? (
        <div className="text-center py-10 text-[12px] text-muted-light dark:text-muted-dark">
          سابقهٔ قیمتی ثبت نشده است
        </div>
      ) : (
        <ReportTable
          headers={headers}
          rows={rows.map((r) => [
            formatDate(r.date),
            r.productName,
            <span key="k" className={r.kind === 'registered' ? 'text-orange font-bold' : ''}>
              {r.kind === 'registered' ? 'ثبت‌شده' : 'پیشنهادی'}
            </span>,
            r.sourceLabel === '—' ? r.templateName : `${r.sourceLabel}${r.templateName !== '—' ? ` • ${r.templateName}` : ''}`,
            r.oldPrice !== null ? fmt(r.oldPrice) : '—',
            <span key="n" className="font-bold">{fmt(Math.round(r.newPrice))}</span>,
          ])}
          minWidth={680}
        />
      )}
    </ReportShell>
  );
}

// گزارش ۷ — تاریخچه محاسبات هر کالا (نسخهٔ گزارش)
export function CalcHistoryReport() {
  const [error, setError] = useState<string | null>(null);
  const [productId, setProductId] = useState('all');
  const [templateId, setTemplateId] = useState('all');
  const [excelBusy, setExcelBusy] = useState(false);

  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];
  const templates = useLiveQuery(() => db.calcTemplates.toArray(), []) ?? [];
  const histories = useLiveQuery(() => db.calcHistory.toArray(), []) ?? [];

  const rows = useMemo(() => {
    return (histories as CalcHistory[])
      .filter(
        (h) =>
          (productId === 'all' || h.productId === productId) &&
          (templateId === 'all' || h.templateId === templateId)
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [histories, productId, templateId]);

  const productName = (pid: string) => products.find((p) => p.id === pid)?.name ?? '—';

  const headers = ['تاریخ', 'کالا', 'الگو', 'کانال', 'مبنای هزینه', 'بهای تمام‌شده', 'قیمت پایهٔ پیشنهادی', 'سود', 'حاشیه'];

  const handleExcel = async () => {
    setExcelBusy(true);
    try {
      await exportToExcel({
        fileName: `calc-history-${new Date().toISOString().slice(0, 10)}`,
        sheetName: 'تاریخچه محاسبات',
        title: 'تاریخچه محاسبات قیمت‌گذاری',
        meta: [
          `کالا: ${productId === 'all' ? 'همه' : productName(productId)}`,
          `الگو: ${templateId === 'all' ? 'همه' : templates.find((t) => t.id === templateId)?.name ?? ''}`,
        ],
        headers,
        rows: rows.map((h) => [
          formatDate(h.createdAt),
          productName(h.productId),
          h.templateName,
          h.channelName ?? '—',
          COST_BASIS_LABELS[h.params.costBasis as CostBasis],
          Math.round(h.params.costValue),
          Math.round(h.basePrice),
          Math.round(h.result.profitTotal),
          `${Math.round(h.result.marginPercent * 100) / 100}٪`,
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
      title="تاریخچه محاسبات"
      subtitle="هر محاسبه با اسنپ‌شات کامل پارامترها"
      excelBusy={excelBusy}
      onExcel={handleExcel}
      printTitle="گزارش تاریخچه محاسبات قیمت‌گذاری"
      printMeta={[
        `کالا: ${productId === 'all' ? 'همه' : productName(productId)}`,
        `الگو: ${templateId === 'all' ? 'همه' : templates.find((t) => t.id === templateId)?.name ?? ''}`,
      ]}
      printHeaders={headers}
      printRows={rows.map((h) => [
        formatDate(h.createdAt),
        productName(h.productId),
        h.templateName,
        h.channelName ?? '—',
        COST_BASIS_LABELS[h.params.costBasis as CostBasis],
        Math.round(h.params.costValue),
        Math.round(h.basePrice),
        Math.round(h.result.profitTotal),
        `${Math.round(h.result.marginPercent * 100) / 100}٪`,
      ])}
      filters={
        <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-3 grid grid-cols-2 gap-2">
          <Select
            label="کالا"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            options={[
              { value: 'all', label: 'همه کالاها' },
              ...products.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
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
    >
      {error && <div className="mb-2 text-[11px] text-red-600 bg-red-500/10 rounded-md px-3 py-2">{error}</div>}
      {rows.length === 0 ? (
        <div className="text-center py-10 text-[12px] text-muted-light dark:text-muted-dark">
          محاسبهٔ ذخیره‌شده‌ای یافت نشد
        </div>
      ) : (
        <ReportTable
          headers={headers}
          rows={rows.map((h) => [
            formatDate(h.createdAt),
            productName(h.productId),
            h.templateName,
            h.channelName ?? '—',
            COST_BASIS_LABELS[h.params.costBasis as CostBasis],
            fmt(Math.round(h.params.costValue)),
            fmt(Math.round(h.basePrice)),
            <span key="p" className={h.result.profitTotal >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600'}>
              {fmt(Math.round(h.result.profitTotal))}
            </span>,
            `${Math.round(h.result.marginPercent * 100) / 100}٪`,
          ])}
          minWidth={880}
        />
      )}
      <div className="mt-2 text-[9.5px] text-muted-light dark:text-muted-dark">
        جزئیات کامل فرمول و مقایسهٔ چند محاسبه در تب «بهای تمام‌شده → تاریخچه محاسبات» موجود است.
      </div>
    </ReportShell>
  );
}
