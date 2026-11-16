import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../lib/db';
import { Icon } from '../../../components/ui/Icon';
import { Badge } from '../../../components/ui/Badge';
import { formatTime } from '../../../lib/jalali';
import { fmt } from '../../../lib/format';
import type { FlowOperation } from '../../../types';

const TYPE_LABELS: Record<FlowOperation, string> = {
  receipt: 'رسید',
  issue: 'حواله',
  transfer: 'انتقال',
  return: 'برگشت',
  count: 'انبارگردانی',
  adjustment: 'اصلاح',
  'status-change': 'تغییر وضعیت',
};

const TYPE_ICONS: Record<FlowOperation, 'plus' | 'minus' | 'flow' | 'edit' | 'list' | 'refresh'> = {
  receipt: 'plus',
  issue: 'minus',
  transfer: 'flow',
  return: 'refresh',
  adjustment: 'edit',
  count: 'list',
  'status-change': 'edit',
};

export function RecentTransactions() {
  const navigate = useNavigate();
  const docs = useLiveQuery(async () => {
    const list = await db.documents.orderBy('dateEpoch').reverse().limit(3).toArray();
    return list;
  }, []) ?? [];

  return (
    <div className="px-5 pb-5">
      <div className="flex justify-between items-center mb-3">
        <div className="text-[15px] font-bold text-ink dark:text-cream">آخرین تراکنش‌ها</div>
        <button
          onClick={() => navigate('/flows')}
          className="text-xs text-orange font-semibold"
        >
          مشاهده همه
        </button>
      </div>
      <div className="flex flex-col gap-2.5">
        {docs.length === 0 && (
          <div className="text-center py-8 text-xs text-muted-light dark:text-muted-dark">
            هنوز تراکنشی ثبت نشده
          </div>
        )}
        {docs.map((doc) => {
          const isIn = doc.type === 'receipt';
          const iconName = TYPE_ICONS[doc.type];
          const iconBg = isIn ? 'bg-orange-soft text-orange' : 'bg-black/5 dark:bg-cream/10 text-ink dark:text-cream';
          const label = TYPE_LABELS[doc.type];
          const statusBadge =
            doc.status === 'draft' ? (
              <Badge variant="muted" size="sm">پیش‌نویس</Badge>
            ) : doc.status === 'reversed' ? (
              <Badge variant="danger" size="sm">ابطال</Badge>
            ) : null;

          return (
            <div
              key={doc.id}
              className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card p-3 flex items-center gap-3 shadow-card"
            >
              <div className={`w-[42px] h-[42px] rounded-btn flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                <Icon name={iconName} size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-ink dark:text-cream truncate">
                    {label} #{doc.number}
                  </span>
                  {statusBadge}
                </div>
                <div className="text-[11px] text-muted-light dark:text-muted-dark mt-0.5">
                  {doc.dateJalali}
                </div>
              </div>
              <div className="text-left flex-shrink-0">
                {doc.type === 'count' ? (
                  <div className="text-[11px] font-bold text-muted-light dark:text-muted-dark">شمارش</div>
                ) : (
                  <>
                    <div className="text-sm font-extrabold text-orange">
                      {fmt(doc.totalAmount)}
                    </div>
                    <div className="text-[10px] text-muted-light dark:text-muted-dark mt-0.5">
                      {formatTime(doc.dateEpoch)}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
