import { useEffect, useMemo, useState } from 'react';
import { buildPricingDataset, pricedSales, withinDays, type PricingDataset } from '../../lib/pricingReports';
import { exportToExcel } from '../../lib/exporters';
import { fmt, errMsg } from '../../lib/format';
import { Select } from '../../components/ui/Select';
import { Icon } from '../../components/ui/Icon';
import { FilterChip, ReportShell, ReportTable, SummaryBox } from './ReportShell';

// گزارش ۱ — مقایسه کانال‌های فروش: هزینه، دریافتی و سود (بر اساس فروش واقعی)
interface ChannelRow {
  channelName: string;
  orders: number;
  qty: number;
  revenue: number;
  fees: number;
  net: number;
  cogs: number;
  profit: number;
  margin: number;
}

export function ChannelCompareReport() {
  const [ds, setDs] = useState<PricingDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storeId, setStoreId] = useState('all');
  const [days, setDays] = useState<number | null>(null);
  const [excelBusy, setExcelBusy] = useState(false);

  useEffect(() => {
    buildPricingDataset().then(setDs).catch((e) => setError(errMsg(e)));
  }, []);

  const stores = useMemo(() => {
    const ids = new Set(ds?.docs.map((d) => d.storeId) ?? []);
    return (ds?.docs ?? []).length >= 0 ? ids : ids;
  }, [ds]);

  const storeOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of ds?.docs ?? []) map.set(d.storeId, d.storeId);
    return [...map.keys()];
  }, [ds]);

  const rows = useMemo<ChannelRow[]>(() => {
    if (!ds) return [];
    const sales = pricedSales(ds).filter(
      (s) =>
        (storeId === 'all' || s.doc.storeId === storeId) &&
        withinDays(s.soldAt, days)
    );
    const groups = new Map<string, { orders: Set<string>; qty: number; revenue: number; fees: number; cogs: number }>();
    for (const s of sales) {
      const key = s.channel?.name ?? 'بدون کانال';
      const cur = groups.get(key) ?? { orders: new Set<string>(), qty: 0, revenue: 0, fees: 0, cogs: 0 };
      cur.orders.add(s.doc.id);
      cur.qty += s.quantity;
      cur.revenue += s.revenue;
      cur.fees += s.fees;
      cur.cogs += s.cogs;
      groups.set(key, cur);
    }
    return [...groups.entries()]
      .map(([channelName, g]) => {
        const net = g.revenue - g.fees;
        const profit = net - g.cogs;
        return {
          channelName,
          orders: g.orders.size,
          qty: g.qty,
          revenue: g.revenue,
          fees: g.fees,
          net,
          cogs: g.cogs,
          profit,
          margin: g.revenue > 0 ? (profit / g.revenue) * 100 : 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [ds, storeId, days]);

  const totals = rows.reduce(
    (acc, r) => {
      acc.revenue += r.revenue;
      acc.fees += r.fees;
      acc.profit += r.profit;
      return acc;
    },
    { revenue: 0, fees: 0, profit: 0 }
  );

  const filterMeta = [
    `فروشگاه: ${storeId === 'all' ? 'همه' : storeOptions.find((s) => s === storeId) ?? ''}`,
    `بازه: ${days === null ? 'همهٔ زمان‌ها' : `${days} روز اخیر`}`,
  ];

  const headers = ['کانال', 'سند فروش', 'تعداد اقلام', 'درآمد فروش', 'هزینه‌های فروش (برآوردی)', 'دریافتی خالص (برآوردی)', 'بهای تمام‌شده', 'سود (برآوردی)', 'حاشیه سود'];

  const handleExcel = async () => {
    if (!ds) return;
    setExcelBusy(true);
    try {
      await exportToExcel({
        fileName: `channel-compare-${new Date().toISOString().slice(0, 10)}`,
        sheetName: 'مقایسه کانال‌ها',
        title: 'مقایسه کانال‌های فروش',
        meta: [...filterMeta, 'هزینه‌ها بر اساس تنظیمات فعلی کانال برآورد شده‌اند'],
        headers,
        rows: rows.map((r) => [r.channelName, r.orders, r.qty, Math.round(r.revenue), Math.round(r.fees), Math.round(r.net), Math.round(r.cogs), Math.round(r.profit), `${Math.round(r.margin * 100) / 100}٪`]),
      });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setExcelBusy(false);
    }
  };

  return (
    <ReportShell
      title="مقایسه کانال‌های فروش"
      subtitle="هزینه، دریافتی و سود هر کانال بر اساس فروش واقعی"
      excelBusy={excelBusy}
      onExcel={handleExcel}
      printTitle="گزارش مقایسه کانال‌های فروش"
      printMeta={[...filterMeta, 'هزینه‌های فروش برآوردی (تنظیمات فعلی کانال)']}
      printHeaders={headers}
      printRows={rows.map((r) => [r.channelName, r.orders, r.qty, Math.round(r.revenue), Math.round(r.fees), Math.round(r.net), Math.round(r.cogs), Math.round(r.profit), `${Math.round(r.margin * 100) / 100}٪`])}
      filters={
        <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-3 flex flex-col gap-2">
          <Select
            label="فروشگاه"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            options={[{ value: 'all', label: 'کل شرکت' }, ...storeOptions.map((s) => ({ value: s, label: s }))]}
          />
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
          <SummaryBox label="هزینه‌های فروش" value={fmt(Math.round(totals.fees))} tone="orange" />
          <SummaryBox label="سود برآوردی" value={fmt(Math.round(totals.profit))} tone={totals.profit >= 0 ? 'up' : 'down'} />
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
          فروش قیمت‌داری در این فیلترها یافت نشد — برای ثبت قیمت فروش، در حوالهٔ فروش فیلد قیمت واحد را تکمیل کنید
        </div>
      ) : (
        <ReportTable
          headers={headers}
          rows={rows.map((r) => [
            r.channelName,
            fmt(r.orders),
            fmt(r.qty),
            fmt(Math.round(r.revenue)),
            fmt(Math.round(r.fees)),
            fmt(Math.round(r.net)),
            fmt(Math.round(r.cogs)),
            <span key="p" className={r.profit >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600'}>{fmt(Math.round(r.profit))}</span>,
            `${Math.round(r.margin * 100) / 100}٪`,
          ])}
          minWidth={880}
        />
      )}
      {ds && (
        <div className="mt-2 text-[9.5px] text-muted-light dark:text-muted-dark flex items-center gap-1">
          <Icon name="warning" size={11} />
          ردیف‌های فروش بدون قیمت ثبت‌شده در این گزارش لحاظ نمی‌شوند.
        </div>
      )}
      {stores.size === 0 && null}
    </ReportShell>
  );
}
