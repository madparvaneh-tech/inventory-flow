import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { Icon } from '../../components/ui/Icon';
import { useThemeStore } from '../../stores/themeStore';
import { formatJalaliLong } from '../../lib/jalali';
import { fmt } from '../../lib/format';
import { HeroCard } from './components/HeroCard';
import { KpiCard } from './components/KpiCard';
import { WideMetricCard } from './components/WideMetricCard';
import { WeeklyChart } from './components/WeeklyChart';
import { RecentTransactions } from './components/RecentTransactions';

export function DashboardPage() {
  const { theme, toggle } = useThemeStore();

  const stats = useLiveQuery(async () => {
    const inventory = await db.inventory.toArray();
    const docs = await db.documents.toArray();
    const products = await db.products.toArray();

    // ارزش کل موجودی سالم
    const totalValue = inventory
      .filter((i) => i.status === 'healthy')
      .reduce((sum, i) => sum + i.quantity * i.averageCost, 0);

    // تعداد اقلام موجود
    const distinctVariants = new Set(
      inventory.filter((i) => i.quantity > 0).map((i) => i.variantId)
    );

    // هشدار کمبود (زیر حداقل)
    let lowStock = 0;
    for (const p of products) {
      const variants = await db.variants.where('productId').equals(p.id).toArray();
      const variantIds = variants.map((v) => v.id);
      const totalQty = inventory
        .filter((i) => variantIds.includes(i.variantId) && i.status === 'healthy')
        .reduce((s, i) => s + i.quantity, 0);
      if (totalQty < p.minStock) lowStock++;
    }

    // ورود/خروج امروز
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayDocs = docs.filter((d) => d.dateEpoch >= todayStart.getTime() && d.status === 'confirmed');

    let inQty = 0;
    let outQty = 0;
    for (const d of todayDocs) {
      const lines = await db.documentLines.where('documentId').equals(d.id).toArray();
      const sum = lines.reduce((s, l) => s + l.quantity, 0);
      if (d.type === 'receipt') inQty += sum;
      if (d.type === 'issue') outQty += sum;
    }

    // داده نمودار 7 روز اخیر
    const weekData = [0, 0, 0, 0, 0, 0, 0];
    for (const d of docs) {
      if (d.status !== 'confirmed') continue;
      const daysAgo = Math.floor((Date.now() - d.dateEpoch) / 86400000);
      if (daysAgo < 7) {
        const dayIdx = (new Date(d.dateEpoch).getDay() + 1) % 7;
        weekData[dayIdx] += d.totalAmount;
      }
    }
    const avg = weekData.reduce((s, v) => s + v, 0) / 7;

    return {
      totalValue,
      distinctCount: distinctVariants.size,
      lowStock,
      inQty,
      outQty,
      weekData,
      avg,
    };
  }, []) ?? {
    totalValue: 0, distinctCount: 0, lowStock: 0, inQty: 0, outQty: 0,
    weekData: [0, 0, 0, 0, 0, 0, 0], avg: 0,
  };

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="px-5 pt-6 pb-3 flex justify-between items-center bg-cream dark:bg-[#0E0D0B] sticky top-0 z-10">
        <div>
          <h1 className="text-[22px] font-extrabold text-ink dark:text-cream tracking-tight">داشبورد</h1>
          <div className="text-xs text-muted-light dark:text-muted-dark mt-1 font-medium">
            {formatJalaliLong()}
          </div>
        </div>
        <button
          onClick={toggle}
          className="w-[42px] h-[42px] rounded-btn bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 flex items-center justify-center text-ink dark:text-cream"
        >
          <Icon name={theme === 'light' ? 'sun' : 'moon'} size={18} />
        </button>
      </div>

      <div className="px-5">
        <HeroCard totalValue={stats.totalValue} trendPercent={12} />

        <div className="grid grid-cols-2 gap-3 mb-3.5">
          <KpiCard
            icon={<Icon name="box" size={20} />}
            label="اقلام موجود"
            value={fmt(stats.distinctCount)}
            unit="قلم"
            variant="orange"
          />
          <KpiCard
            icon={<Icon name="warning" size={20} />}
            label="هشدار کمبود"
            value={fmt(stats.lowStock)}
            unit="قلم"
            variant="ink"
          />
        </div>

        <WideMetricCard
          icon={<Icon name="plus" size={26} />}
          iconVariant="orange"
          label="ورود امروز"
          value={fmt(stats.inQty)}
          unit="عدد"
        />

        <WideMetricCard
          icon={<Icon name="minus" size={26} />}
          iconVariant="ink"
          label="خروج امروز"
          value={fmt(stats.outQty)}
          unit="عدد"
        />

        <WeeklyChart
          data={stats.weekData}
          averageLabel={`میانگین ${fmt(stats.avg)} / روز`}
        />
      </div>

      <RecentTransactions />
    </div>
  );
}
