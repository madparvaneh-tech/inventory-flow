import { useNavigate } from 'react-router-dom';
import { TopBar } from '../../components/layout/TopBar';
import { Icon } from '../../components/ui/Icon';
import type { IconName } from '../../components/ui/Icon';

interface ReportItem {
  key: string;
  title: string;
  desc: string;
  icon: IconName;
}

const MANAGEMENT_REPORTS: ReportItem[] = [
  { key: 'stock', title: 'وضعیت موجودی', desc: 'موجودی سالم، معیوب و در حال انتقال به تفکیک انبار', icon: 'box' as const },
  { key: 'low', title: 'کمبود و نقطه سفارش', desc: 'کالاهای زیر حداقل، کسری و سفارش پیشنهادی', icon: 'warning' as const },
  { key: 'dead', title: 'بدون گردش و کم‌گردش', desc: 'کالاهای راکد و آخرین تاریخ ورود/خروج', icon: 'refresh' as const },
  { key: 'movement', title: 'گردش کالا و ورود/خروج', desc: 'اول و آخر دوره با تفکیک نوع عملیات', icon: 'flow' as const },
  { key: 'value', title: 'ارزش موجودی و بهای خرید', desc: 'ارزش به تفکیک فروشگاه، انبار و کالا', icon: 'money' as const },
];

const PRICING_REPORTS: ReportItem[] = [
  { key: 'channel-compare', title: 'مقایسه کانال‌های فروش', desc: 'هزینه، دریافتی و سود هر کانال بر اساس فروش واقعی', icon: 'compare' as const },
  { key: 'template-compare', title: 'مقایسه الگوهای محاسباتی', desc: 'خروجی قیمت‌گذاری هر الگو روی کالای مرجع', icon: 'doc' as const },
  { key: 'template-products', title: 'کالاهای متصل به الگو', desc: 'با موجودی واقعی سالم/معیوب/انتقال و قیمت ثبت‌شده', icon: 'link' as const },
  { key: 'below-breakeven', title: 'فروش زیر سربه‌سر', desc: 'فروش‌های پایین‌تر از نقطه سربه‌سر و زیان آن‌ها', icon: 'warning' as const },
  { key: 'price-gap', title: 'فاصله تا قیمت هدف', desc: 'قیمت فعلی در برابر قیمت لازم برای حاشیهٔ سود هدف', icon: 'chart' as const },
  { key: 'price-history', title: 'تاریخچه قیمت‌ها', desc: 'قیمت‌های پیشنهادی سیستم و قیمت‌های ثبت‌شده', icon: 'history' as const },
  { key: 'calc-history', title: 'تاریخچه محاسبات', desc: 'محاسبات ذخیره‌شده با اسنپ‌شات کامل پارامترها', icon: 'list' as const },
  { key: 'cost-value', title: 'بهای تمام‌شده و ارزش موجودی', desc: 'میانگین موزون، آخرین خرید و جایگزینی کنار هم', icon: 'money' as const },
  { key: 'profit-analysis', title: 'سود به تفکیک کالا و کانال', desc: 'سود ناخالص و خالص برآوردی از فروش واقعی', icon: 'chart' as const },
];

function ReportGroup({
  title,
  items,
  navigate,
}: {
  title: string;
  items: typeof MANAGEMENT_REPORTS;
  navigate: (path: string) => void;
}) {
  return (
    <>
      <div className="flex items-center gap-1.5 mb-2.5 mt-1">
        <Icon name="list" size={13} className="text-orange" />
        <div className="text-[12px] font-bold text-ink dark:text-cream">{title}</div>
      </div>
      {items.map((r) => (
        <button
          key={r.key}
          onClick={() => navigate(`/reports/${r.key}`)}
          className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card p-3.5 shadow-card flex items-center gap-3 text-right transition-all active:scale-[0.98]"
        >
          <div className="w-11 h-11 rounded-btn bg-orange-soft text-orange flex items-center justify-center flex-shrink-0">
            <Icon name={r.icon} size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold text-ink dark:text-cream">{r.title}</div>
            <div className="text-[10.5px] text-muted-light dark:text-muted-dark mt-0.5">{r.desc}</div>
          </div>
          <Icon name="chevron-left" size={16} className="text-orange" />
        </button>
      ))}
    </>
  );
}

export function ReportsPage() {
  const navigate = useNavigate();

  return (
    <div className="pb-24">
      <TopBar
        title="گزارش‌ها"
        subtitle="۵ گزارش مدیریتی + ۹ گزارش قیمت‌گذاری"
        onBack={() => navigate('/flows')}
        showTheme
      />

      <div className="px-5 pt-4 flex flex-col gap-2.5">
        <ReportGroup title="گزارش‌های مدیریتی موجودی" items={MANAGEMENT_REPORTS} navigate={navigate} />
        <ReportGroup title="قیمت‌گذاری و سودآوری" items={PRICING_REPORTS} navigate={navigate} />

        <div className="mt-3 p-3 rounded-card bg-orange-soft border border-orange/20 text-center">
          <div className="text-[10.5px] font-semibold text-orange leading-relaxed">
            همهٔ گزارش‌ها فقط از اسناد تأییدشده و دادهٔ واقعی موتور موجودی محاسبه می‌شوند و امکان خروجی Excel و PDF دارند.
          </div>
        </div>
      </div>
    </div>
  );
}
