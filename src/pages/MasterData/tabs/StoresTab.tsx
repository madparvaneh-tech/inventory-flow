import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../lib/db';
import { Icon } from '../../../components/ui/Icon';
import { Badge } from '../../../components/ui/Badge';

export function StoresTab() {
  const stores = useLiveQuery(() => db.stores.toArray(), []) ?? [];
  const warehouses = useLiveQuery(() => db.warehouses.toArray(), []) ?? [];

  return (
    <div className="px-5">
      <button
        disabled
        className="w-full bg-orange text-white rounded-btn py-3 font-bold text-[12.5px] flex items-center justify-center gap-1.5 opacity-50 mb-3 cursor-not-allowed"
      >
        <Icon name="plus" size={15} />
        فروشگاه جدید
      </button>

      <div className="flex flex-col gap-2 pb-4">
        {stores.map((s) => {
          const whCount = warehouses.filter((w) => w.storeId === s.id).length;
          return (
            <div
              key={s.id}
              className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card p-3 shadow-card flex items-center gap-3"
            >
              <div className="w-11 h-11 rounded-btn bg-orange-soft text-orange flex items-center justify-center flex-shrink-0">
                <Icon name="store" size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-ink dark:text-cream">{s.name}</div>
                <div className="text-[10.5px] text-muted-light dark:text-muted-dark mt-0.5">
                  کد: {s.code} • {whCount} انبار
                </div>
              </div>
              {s.isActive ? (
                <Badge variant="success" size="sm">فعال</Badge>
              ) : (
                <Badge variant="muted" size="sm">غیرفعال</Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}