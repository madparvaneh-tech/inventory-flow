import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { TopBar } from '../../components/layout/TopBar';
import { Icon } from '../../components/ui/Icon';
import { getRoundingStep } from '../../lib/pricingData';

const SECTIONS = [
  {
    key: 'calculator',
    title: 'ماشین‌حساب قیمت‌گذاری',
    desc: 'قیمت پایهٔ پیشنهادی، سناریوهای تخفیف، سود و نقطهٔ سربه‌سر',
    icon: 'cost' as const,
  },
  {
    key: 'templates',
    title: 'الگوهای محاسباتی',
    desc: 'مبنای بهای تمام‌شده، تخفیف‌ها، سود هدف و هزینه‌های فروش',
    icon: 'doc' as const,
  },
  {
    key: 'channels',
    title: 'کانال‌های فروش',
    desc: 'هزینه‌های درصدی و ثابت هر کانال با مبنای مستقل',
    icon: 'store' as const,
  },
  {
    key: 'history',
    title: 'تاریخچه محاسبات',
    desc: 'محاسبات ذخیره‌شده، جزئیات فرمول و مقایسه',
    icon: 'history' as const,
  },
  {
    key: 'settings',
    title: 'تنظیمات قیمت‌گذاری',
    desc: 'گام گرد کردن قیمت نهایی',
    icon: 'list' as const,
  },
];

function roundingLabel(step: number): string {
  if (!step) return 'بدون گرد کردن';
  return `نزدیک‌ترین ${step.toLocaleString('en-US')}`;
}

export function CostPage() {
  const navigate = useNavigate();
  const [rounding, setRounding] = useState<number>(0);

  useEffect(() => {
    getRoundingStep().then(setRounding).catch(() => {});
  }, []);

  const templates = useLiveQuery(() => db.calcTemplates.toArray(), []) ?? [];
  const channels = useLiveQuery(() => db.salesChannels.toArray(), []) ?? [];

  return (
    <div className="pb-24">
      <TopBar
        title="بهای تمام‌شده و قیمت‌گذاری"
        subtitle="قیمت‌گذاری دقیق بر اساس بهای تمام‌شده"
        showTheme
      />

      <div className="px-5 pt-4 flex flex-col gap-2.5">
        {/* خلاصه وضعیت */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card p-2.5 text-center shadow-card">
            <div className="text-[9.5px] text-muted-light dark:text-muted-dark font-medium">الگوها</div>
            <div className="text-[13px] font-extrabold mt-0.5 text-ink dark:text-cream">
              {templates.length}
            </div>
          </div>
          <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card p-2.5 text-center shadow-card">
            <div className="text-[9.5px] text-muted-light dark:text-muted-dark font-medium">کانال‌ها</div>
            <div className="text-[13px] font-extrabold mt-0.5 text-ink dark:text-cream">
              {channels.length}
            </div>
          </div>
          <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card p-2.5 text-center shadow-card">
            <div className="text-[9.5px] text-muted-light dark:text-muted-dark font-medium">گرد کردن</div>
            <div className="text-[11px] font-extrabold mt-1 text-ink dark:text-cream">
              {roundingLabel(rounding)}
            </div>
          </div>
        </div>

        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => navigate(`/cost/${s.key}`)}
            className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card p-3.5 shadow-card flex items-center gap-3 text-right transition-all active:scale-[0.98]"
          >
            <div className="w-11 h-11 rounded-btn bg-orange-soft text-orange flex items-center justify-center flex-shrink-0">
              <Icon name={s.icon} size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-ink dark:text-cream">{s.title}</div>
              <div className="text-[10.5px] text-muted-light dark:text-muted-dark mt-0.5">{s.desc}</div>
            </div>
            <Icon name="chevron-left" size={16} className="text-orange" />
          </button>
        ))}

        <div className="mt-3 p-3 rounded-card bg-orange-soft border border-orange/20 text-center">
          <div className="text-[10.5px] font-semibold text-orange leading-relaxed">
            روش ارزش‌گذاری موجودی میانگین موزون متحرک است؛ اما مبنای قیمت‌گذاری فروش
            می‌تواند میانگین موزون، آخرین قیمت خرید یا قیمت جایگزینی باشد.
            قیمت پیشنهادی سیستم همیشه قیمت پایه قبل از تخفیف است.
          </div>
        </div>
      </div>
    </div>
  );
}
