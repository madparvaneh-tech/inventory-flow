import { useEffect, useMemo, useState } from 'react';
import { buildPricingDataset, pricedSales, withinDays, breakevenBasePrice, type PricingDataset } from '../../lib/pricingReports';
import { exportToExcel } from '../../lib/exporters';
import { fmt, errMsg } from '../../lib/format';
import { Select } from '../../components/ui/Select';
import { FilterChip, ReportShell, ReportTable, SummaryBox } from './ReportShell';

// گزارش ۴ — کالاهای فروخته‌شده با قیمتی پایین‌تر از نقطه سربه‌سر
export function BelowBreakevenReport() {
  const [ds, setDs] = useState<PricingDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [channelId, setChannelId] = useState('all');
  const [productId, setProductId] = useState('all');
  const [days, setDays] = useState<number | null>(null);
  const [excelBusy, setExcelBusy] = useState(false);

  useEffect(() => {
    buildPricingDataset().then(setDs).catch((e) => setError(errMsg(e)));
  }, []);

  const sales = useMemo(() => {
    if (!ds) return [];
    return pricedSales(ds).filter(
      (s) =>
        (channelId === 'all' || (channelId === 'none' ? !s.channel : s.channel?.id === channelId)) &&
        (productId === 'all' || s.product.id === productId) &&
        withinDays(s.soldAt, days)
    );
  }, [ds, channelId, productId, days]);

  const rows = useMemo(() => {
    return sales
      .map((s) => {
        const feesConfig = s.channel?.fees ?? [];
        // breakevenBasePrice قیمت پایهٔ واحد در سربه‌سر را برمی‌گرداند
        const beUnit = breakevenBasePrice(feesConfig, s.unitCost, s.quantity);
        const below = s.unitPrice < beUnit;
        return {
          date: s.doc.dateJalali,
          docNumber: s.doc.number,
          productName: s.product.name,
          channelName: s.channel?.name ?? 'بدون کانال',
          qty: s.quantity,
          saleUnitPrice: s.unitPrice,
          breakevenUnit: beUnit,
          gap: s.unitPrice - beUnit,
          loss: below ? (beUnit - s.unitPrice) * s.quantity : 0,
          below,
        };
      })
      .filter((r) => r.below);
  }, [sales]);

  const totalLoss = rows.reduce((s, r) => s + r.loss, 0);

  const headers = ['تاریخ', 'سند', 'کالا', 'کانال', 'تعداد', 'قیمت فروش واحد', 'سربه‌سر واحد', 'اختلاف', 'زیان کل'];

  const handleExcel = async () => {
    setExcelBusy(true);
    try {
      await exportToExcel({
        fileName: `below-breakeven-${new Date().toISOString().slice(0, 10)}`,
        sheetName: 'فروش زیر سربه‌سر',
        title: 'فروش‌های زیر نقطه سربه‌سر',
        meta: ['سربه‌سر = قیمت پایه‌ای که با هزینه‌های کانال، سود صفر شود (بهای موثر ثبت‌شده لحظهٔ فروش)'],
        headers,
        rows: rows.map((r) => [r.date, `#${r.docNumber}`, r.productName, r.channelName, r.qty, Math.round(r.saleUnitPrice), Math.round(r.breakevenUnit), Math.round(r.gap), Math.round(r.loss)]),
      });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setExcelBusy(false);
    }
  };

  return (
    <ReportShell
      title="فروش زیر سربه‌سر"
      subtitle="فروش‌های واقعی پایین‌تر از نقطه سربه‌سر"
      excelBusy={excelBusy}
      onExcel={handleExcel}
      printTitle="گزارش فروش‌های زیر نقطه سربه‌سر"
      printMeta={['سربه‌سر بر اساس بهای موثر ثبت‌شده در لحظهٔ فروش و هزینه‌های فعلی کانال']}
      printHeaders={headers}
      printRows={rows.map((r) => [r.date, `#${r.docNumber}`, r.productName, r.channelName, r.qty, Math.round(r.saleUnitPrice), Math.round(r.breakevenUnit), Math.round(r.gap), Math.round(r.loss)])}
      filters={
        <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-3 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Select
              label="کانال"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              options={[
                { value: 'all', label: 'همه کانال‌ها' },
                { value: 'none', label: 'بدون کانال' },
                ...(ds?.channels ?? []).map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <Select
              label="کالا"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              options={[
                { value: 'all', label: 'همه کالاها' },
                ...(ds?.products ?? []).map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
          </div>
          <div>
            <div className="text-[10px] font-semibold text-muted-light dark:text-muted-dark pr-1 mb-1">بازهٔ زمانی</div>
            <div className="flex gap-1.5">
              <FilterChip active={days === null} onClick={() => setDays(null)}>همه</FilterChip>
              <FilterChip active={days === 30} onClick={() => setDays(30)}>۳۰ روز</FilterChip>
              <FilterChip active={days === 90} onClick={() => setDays(90)}>۹۰ روز</FilterChip>
            </div>
          </div>
        </div>
      }
      summary={
        <div className="grid grid-cols-2 gap-2">
          <SummaryBox label="تعداد فروش زیر سربه‌سر" value={fmt(rows.length)} tone="down" />
          <SummaryBox label="جمع زیان" value={fmt(Math.round(totalLoss))} tone="down" />
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
          فروش زیر سربه‌سری یافت نشد
        </div>
      ) : (
        <ReportTable
          headers={headers}
          rows={rows.map((r) => [
            r.date,
            `#${r.docNumber}`,
            r.productName,
            r.channelName,
            fmt(r.qty),
            fmt(Math.round(r.saleUnitPrice)),
            fmt(Math.round(r.breakevenUnit)),
            <span key="g" className="text-red-600">{fmt(Math.round(r.gap))}</span>,
            <span key="l" className="text-red-600 font-bold">{fmt(Math.round(r.loss))}</span>,
          ])}
          minWidth={860}
        />
      )}
    </ReportShell>
  );
}
