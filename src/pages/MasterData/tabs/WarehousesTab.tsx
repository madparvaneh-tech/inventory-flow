import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../lib/db';
import { Icon } from '../../../components/ui/Icon';
import { Badge } from '../../../components/ui/Badge';

export function WarehousesTab() {
  const warehouses = useLiveQuery(() => db.warehouses.toArray(), []) ?? [];
  const stores = useLiveQuery(() => db.stores.toArray(), []) ?? [];

  const getStoreName = (id: string) => stores.find((s) => s.id === id)?.name ?? '—';

  // گروه‌بندی بر اساس فروشگاه
  const grouped = stores.map((s) => ({
    store: s,
    warehouses: warehouses.filter((w) => w.storeId === s.id),
  }));

  return (
    <div className="px-5">
      <button
        disabled
        className="w-full bg-orange text-white rounded-btn py-3 font-bold text-[12.5px] flex items-center justify-center gap-1.5 opacity-50 mb-3 cursor-not-allowed"
      >
        <Icon name="plus" size={15} />
        انبار جدید
      </button>

      <div className="flex flex-col gap-4 pb-4">
        {grouped.map(({ store, warehouses: whs }) => (
          <div key={store.id}>
            <div className="flex items-center gap-1.5 mb-2 px-1">
              <Icon name="store" size={13} className="text-orange" />
              <span className="text-[11.5px] font-bold text-ink dark:text-cream">{store.name}</span>
              <span className="text-[10px] text-muted-light dark:text-muted-dark">
                ({whs.length} انبار)
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {whs.length === 0 && (
                <div className="text-[11px] text-muted-light dark:text-muted-dark pr-4">
                  انباری تعریف نشده
                </div>
              )}
              {whs.map((w) => (
                <div
                  key={w.id}
                  className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card p-3 shadow-card flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-btn bg-orange-soft text-orange flex items-center justify-center flex-shrink-0">
                    <Icon name="warehouse" size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-ink dark:text-cream">{w.name}</div>
                    <div className="text-[10.5px] text-muted-light dark:text-muted-dark mt-0.5">
                      کد: {w.code}
                    </div>
                  </div>
                  {w.isDefault && <Badge variant="orange" size="sm">پیش‌فرض</Badge>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}