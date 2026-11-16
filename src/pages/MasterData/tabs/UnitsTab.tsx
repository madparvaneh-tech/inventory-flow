import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../lib/db';
import { Icon } from '../../../components/ui/Icon';
import { Badge } from '../../../components/ui/Badge';

const TYPE_LABELS: Record<string, string> = {
  count: 'تعدادی',
  weight: 'وزنی',
  volume: 'حجمی',
  length: 'طولی',
  area: 'سطحی',
  other: 'سایر',
};

export function UnitsTab() {
  const units = useLiveQuery(() => db.units.toArray(), []) ?? [];

  return (
    <div className="px-5">
      <button
        disabled
        className="w-full bg-orange text-white rounded-btn py-3 font-bold text-[12.5px] flex items-center justify-center gap-1.5 opacity-50 mb-3 cursor-not-allowed"
      >
        <Icon name="plus" size={15} />
        واحد جدید
      </button>

      <div className="flex flex-col gap-2 pb-4">
        {units.map((u) => (
          <div
            key={u.id}
            className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card p-3 shadow-card flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-btn bg-orange-soft text-orange flex items-center justify-center flex-shrink-0">
              <Icon name="list" size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-ink dark:text-cream">{u.name}</div>
              <div className="text-[10.5px] text-muted-light dark:text-muted-dark mt-0.5">
                نماد: {u.symbol}
              </div>
            </div>
            <Badge variant="orange" size="sm">{TYPE_LABELS[u.type]}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}