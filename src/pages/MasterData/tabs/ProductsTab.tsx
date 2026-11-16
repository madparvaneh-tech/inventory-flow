import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../lib/db';
import { Icon } from '../../../components/ui/Icon';
import { Badge } from '../../../components/ui/Badge';

export function ProductsTab() {
  const [search, setSearch] = useState('');
  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];

  const filtered = products.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return p.name.toLowerCase().includes(s) || p.sku.includes(s);
  });

  const getCategoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? '—';

  return (
    <div className="px-5">
      {/* Search */}
      <div className="bg-white dark:bg-surface-dark-2 border-[1.5px] border-black/5 dark:border-cream/10 rounded-btn px-3 py-2.5 flex items-center gap-2 mb-3">
        <Icon name="search" size={15} className="text-muted-light dark:text-muted-dark" />
        <input
          type="text"
          placeholder="جستجوی کالا بر اساس نام یا کد..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent border-none outline-none text-[12.5px] font-medium text-ink dark:text-cream placeholder:text-muted-light/60 dark:placeholder:text-muted-dark/60"
        />
      </div>

      {/* Add button */}
      <button
        disabled
        className="w-full bg-orange text-white rounded-btn py-3 font-bold text-[12.5px] flex items-center justify-center gap-1.5 opacity-50 mb-3 cursor-not-allowed"
        title="در فاز بعدی"
      >
        <Icon name="plus" size={15} />
        کالای جدید
      </button>

      {/* List */}
      <div className="flex flex-col gap-2 pb-4">
        {filtered.length === 0 && (
          <div className="text-center py-10 text-[12px] text-muted-light dark:text-muted-dark">
            کالایی یافت نشد
          </div>
        )}
        {filtered.map((p) => (
          <div
            key={p.id}
            className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card p-3 shadow-card flex items-center gap-3"
          >
            <div className="w-11 h-11 rounded-btn bg-orange-soft text-orange flex items-center justify-center flex-shrink-0">
              <Icon name="box" size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-ink dark:text-cream truncate">
                {p.name}
              </div>
              <div className="text-[10.5px] text-muted-light dark:text-muted-dark mt-0.5 flex flex-wrap gap-x-2">
                <span>کد: {p.sku}</span>
                <span>•</span>
                <span>{getCategoryName(p.categoryId)}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              {p.isActive ? (
                <Badge variant="success" size="sm">فعال</Badge>
              ) : (
                <Badge variant="muted" size="sm">غیرفعال</Badge>
              )}
              <span className="text-[9.5px] text-muted-light dark:text-muted-dark">
                حداقل: {p.minStock}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}