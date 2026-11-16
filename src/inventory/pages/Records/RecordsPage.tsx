import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { TopBar } from '../../components/layout/TopBar';
import { Icon } from '../../components/ui/Icon';
import { Badge } from '../../components/ui/Badge';
import { fmt } from '../../lib/format';
import { formatTime } from '../../lib/jalali';
import type { DocumentStatus, FlowOperation } from '../../types';

const TYPE_LABELS: Record<FlowOperation, string> = {
  receipt: 'رسید',
  issue: 'حواله',
  transfer: 'انتقال',
  return: 'برگشت',
  count: 'انبارگردانی',
  adjustment: 'اصلاح',
  'status-change': 'تغییر وضعیت',
};

const FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'همه' },
  { key: 'draft', label: 'پیش‌نویس' },
  { key: 'confirmed', label: 'تأییدشده' },
  { key: 'reversed', label: 'ابطال' },
  { key: 'receipt', label: 'رسید' },
  { key: 'issue', label: 'حواله' },
  { key: 'transfer', label: 'انتقال' },
  { key: 'return', label: 'برگشت' },
  { key: 'adjustment', label: 'اصلاح' },
  { key: 'count', label: 'انبارگردانی' },
];

export function RecordsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');

  const documents = useLiveQuery(async () => {
    return db.documents.orderBy('dateEpoch').reverse().toArray();
  }, []) ?? [];

  const filtered = documents.filter((d) => {
    if (filter === 'all') return true;
    if (filter === 'draft' || filter === 'confirmed' || filter === 'reversed') {
      return d.status === (filter as DocumentStatus);
    }
    return d.type === (filter as FlowOperation);
  });

  const statusBadge = (status: DocumentStatus) => {
    if (status === 'draft') return <Badge variant="muted" size="sm">پیش‌نویس</Badge>;
    if (status === 'confirmed') return <Badge variant="success" size="sm">تأیید</Badge>;
    return <Badge variant="danger" size="sm">ابطال</Badge>;
  };

  return (
    <div className="pb-24">
      <TopBar
        title="مرکز سوابق"
        subtitle={`${documents.length} سند ثبت‌شده`}
        onBack={() => navigate('/flows')}
        showTheme
      />

      {/* Filter chips */}
      <div className="sticky top-0 z-10 bg-cream dark:bg-[#0E0D0B] px-4 py-2.5 border-b border-black/5 dark:border-cream/10">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`
                px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all
                ${filter === f.key
                  ? 'bg-ink text-cream dark:bg-orange dark:text-white'
                  : 'bg-surface-light dark:bg-surface-dark text-muted-light dark:text-muted-dark border border-black/5 dark:border-cream/10'
                }
              `}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pt-3 flex flex-col gap-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-[12px] text-muted-light dark:text-muted-dark">
            سندی با این فیلتر یافت نشد
          </div>
        )}

        {filtered.map((d) => {
          const iconMap: Record<string, 'plus' | 'minus' | 'flow' | 'edit' | 'list' | 'refresh'> = {
            receipt: 'plus',
            issue: 'minus',
            transfer: 'flow',
            return: 'refresh',
            adjustment: 'edit',
            count: 'list',
          };
          const iconName = iconMap[d.type] ?? 'edit';
          const iconBg = d.type === 'receipt'
            ? 'bg-orange-soft text-orange'
            : 'bg-black/5 dark:bg-cream/10 text-ink dark:text-cream';

          return (
            <button
              key={d.id}
              onClick={() => navigate(`/records/${d.id}`)}
              className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card p-3 shadow-card flex items-center gap-3 w-full text-right transition-all active:scale-[0.98]"
            >
              <div className={`w-10 h-10 rounded-btn flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                <Icon name={iconName} size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12.5px] font-bold text-ink dark:text-cream truncate">
                    {TYPE_LABELS[d.type]} #{d.number}
                  </span>
                  {statusBadge(d.status)}
                </div>
                <div className="text-[10px] text-muted-light dark:text-muted-dark mt-0.5">
                  {d.dateJalali} • {formatTime(d.dateEpoch)}
                </div>
              </div>
              <div className="text-left flex-shrink-0">
                {d.type === 'count' ? (
                  <div className="text-[11px] font-bold text-muted-light dark:text-muted-dark">انبارگردانی</div>
                ) : (
                  <>
                    <div className="text-[12px] font-extrabold text-orange">
                      {fmt(d.totalAmount)}
                    </div>
                    <div className="text-[9px] text-muted-light dark:text-muted-dark mt-0.5">ریال</div>
                  </>
                )}
              </div>
              <Icon name="chevron-left" size={14} className="text-muted-light dark:text-muted-dark flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
