import { useNavigate } from 'react-router-dom';
import { TopBar } from '../../components/layout/TopBar';
import { Icon } from '../../components/ui/Icon';

const REPORTS = [
  { key: 'stock', title: 'وضعیت موجودی', desc: 'موجودی سالم، معیوب و در حال انتقال', icon: 'box' as const },
  { key: 'low', title: 'کمبود و نقطه سفارش', desc: 'کالاهای زیر حداقل موجودی', icon: 'warning' as const },
  { key: 'dead', title: 'کالاهای بدون گردش', desc: 'کالاهایی که مدتی جابه‌جا نشده‌اند', icon: 'refresh' as const },
  { key: 'movement', title: 'گردش کالا', desc: 'ورود و خروج در بازه زمانی', icon: 'flow' as const },
  { key: 'value', title: 'ارزش موجودی', desc: 'ارزش به تفکیک فروشگاه و انبار', icon: 'money' as const },
];

export function ReportsPage() {
  const navigate = useNavigate();

  return (
    <div className="pb-24">
      <TopBar
        title="گزارش‌ها"
        subtitle="۵ گزارش مدیریتی"
        onBack={() => navigate('/flows')}
        showTheme
      />

      <div className="px-5 pt-4 flex flex-col gap-2.5">
        {REPORTS.map((r) => (
          <button
            key={r.key}
            disabled
            className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card p-3.5 shadow-card flex items-center gap-3 text-right opacity-60 cursor-not-allowed"
          >
            <div className="w-11 h-11 rounded-btn bg-orange-soft text-orange flex items-center justify-center flex-shrink-0">
              <Icon name={r.icon} size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-ink dark:text-cream">{r.title}</div>
              <div className="text-[10.5px] text-muted-light dark:text-muted-dark mt-0.5">{r.desc}</div>
            </div>
            <Icon name="chevron-left" size={16} className="text-muted-light dark:text-muted-dark" />
          </button>
        ))}

        <div className="mt-3 p-3 rounded-card bg-orange-soft border border-orange/20 text-center">
          <div className="text-[11px] font-semibold text-orange">
            گزارش‌ها در بسته چهارم فعال می‌شوند
          </div>
        </div>
      </div>
    </div>
  );
}