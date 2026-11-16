import { useEffect, useMemo, useState } from 'react';
import { buildPricingDataset, pricedSales, withinDays, type PricingDataset } from '../../lib/pricingReports';
import { exportToExcel } from '../../lib/exporters';
import { fmt, errMsg } from '../../lib/format';
import { Select } from '../../components/ui/Select';
import { FilterChip, ReportShell, ReportTable, SummaryBox } from './ReportShell';

// گزارش ۹ — سود و حاشیه سود به تفکیک کالا و کانال فروش (بر اساس فروش واقعی)
interface ProfitRow {
  productName: string;
  channelName: string;
  orders: number;
  qty: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  fees: number;
  netProfit: number;
  margin: number;
}

export function ProfitAnalysisReport() {
  const [ds, setDs] = useState<PricingDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [channelId, setChannelId] = useState('all');
  const [productId, setProductId] = useState('all');
  const [days, setDays] = useState<number | null>(null);
  const [excelBusy, setExcelBusy] = useState(false);

  useEffect(() => {
    buildPricingDataset().then(setDs).catch((e) => setError(errMsg(e)));
  }, []);

  const rows = useMemo<ProfitRow[]>(() => {
    if (!ds) return [];
    const sales = pricedSales(ds).filter(
      (s) =>
        (channelId === 'all' || (channelId === 'none' ? !s.channel : s.channel?.id === channelId)) &&
        (productId === 'all' || s.product.id === productId) &&
        withinDays(s.soldAt, days)
    );
    const groups = new Map<string, { orders: Set<string>; qty: number; revenue: number; cogs: number; fees: number }>();
    for (const s of sales) {
      const key = `${s.product.name}__${s.channel?.name ?? 'بدون کانال'}`;
      const cur = groups.get(key) ?? { orders: new Set<string>(), qty: 0, revenue: 0, cogs: 0, fees: 0 };
      cur.orders.add(s.doc.id);
      cur.qty += s.quantity;
      cur.revenue += s.revenue;
      cur.cogs += s.cogs;
      cur.fees += s.fees;
      groups.set(key, cur);
    }
    return [...groups.entries()]
      .map(([key, g]) => {
        const [productName, channelName] = key.split('__');
        const grossProfit = g.revenue - g.cogs;
        const netProfit = grossProfit - g.fees;
        return {
          productName,
          channelName,
          orders: g.orders.size,
          qty: g.qty,
          revenue: g.revenue,
          cogs: g.cogs,
          grossProfit,
          fees: g.fees,
          netProfit,
          margin: g.revenue > 0 ? (netProfit / g.revenue) * 100 : 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [ds, channelId, productId, days]);

  const totals = rows.reduce(
    (acc, r) => {
      acc.revenue += r.revenue;
      acc.gross += r.grossProfit;
      acc.net += r.netProfit;
      return acc;
    },
    { revenue: 0, gross: 0, net: 0 }
  );

  const headers = ['کالا', 'کانال', 'سند فروش', 'تعداد اقلام', 'درآمد', 'بهای تمام‌شده', 'سود ناخالص', 'هزینه‌های فروش (برآوردی)', 'سود خالص (برآوردی)', 'حاشیه سود'];

  const handleExcel = async () => {
    setExcelBusy(true);
    try {
      await exportToExcel({
        fileName: `profit-analysis-${new Date().toISOString().slice(0, 10)}`,
        sheetName: 'سود به تفکیک کالا و کانال',
        title: 'گزارش سود و حاشیه سود به تفکیک کالا و کانال',
        meta: ['هزینه‌های فروش بر اساس تنظیمات فعلی کانال برآورد شده‌اند'],
        headers,
        rows: rows.map((r) => [
          r.productName, r.channelName, r.orders, r.qty,
          Math.round(r.revenue), Math.round(r.cogs), Math.round(r.grossProfit),
          Math.round(r.fees), Math.round(r.netProfit), `${Math.round(r.margin * 100) / 100}٪`,
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
      title="سود به تفکیک کالا و کانال"
      subtitle="سود ناخالص و برآوردی خالص"
      excelBusy={excelBusy}
      onExcel={handleExcel}
      printTitle="گزارش سود و حاشیه سود به تفکیک کالا و کانال"
      printMeta={['هزینه‌های فروش برآوردی (تنظیمات فعلی کانال)']}
      printHeaders={headers}
      printRows={rows.map((r) => [
        r.productName, r.channelName, r.orders, r.qty,
        Math.round(r.revenue), Math.round(r.cogs), Math.round(r.grossProfit),
        Math.round(r.fees), Math.round(r.netProfit), `${Math.round(r.margin * 100) / 100}٪`,
      ])}
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
        <div className="grid grid-cols-3 gap-2">
          <SummaryBox label="درآمد فروش" value={fmt(Math.round(totals.revenue))} />
          <SummaryBox label="سود ناخالص" value={fmt(Math.round(totals.gross))} tone={totals.gross >= 0 ? 'up' : 'down'} />
          <SummaryBox label="سود خالص برآوردی" value={fmt(Math.round(totals.net))} tone={totals.net >= 0 ? 'up' : 'down'} />
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
          فروش قیمت‌داری یافت نشد — در حوالهٔ فروش، «قیمت فروش واحد» اقلام را ثبت کنید
        </div>
      ) : (
        <ReportTable
          headers={headers}
          rows={rows.map((r) => [
            r.productName,
            r.channelName,
            fmt(r.orders),
            fmt(r.qty),
            fmt(Math.round(r.revenue)),
            fmt(Math.round(r.cogs)),
            <span key="g" className={r.grossProfit >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600'}>{fmt(Math.round(r.grossProfit))}</span>,
            fmt(Math.round(r.fees)),
            <span key="n" className={r.netProfit >= 0 ? 'text-green-700 dark:text-green-400 font-bold' : 'text-red-600 font-bold'}>{fmt(Math.round(r.netProfit))}</span>,
            `${Math.round(r.margin * 100) / 100}٪`,
          ])}
          minWidth={980}
        />
      )}
    </ReportShell>
  );
}
