import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../../lib/db';
import { Sheet } from '../../../../components/ui/Sheet';
import { Icon } from '../../../../components/ui/Icon';
import { getVariantAverageCost, getVariantTotalQuantity } from '../../../../lib/inventory';
import { fmt } from '../../../../lib/format';

interface ProductPickerSheetProps {
  open: boolean;
  onClose: () => void;
  onSelect: (variantId: string) => void;
  mode?: 'in' | 'out' | 'transfer' | 'count';
  warehouseId?: string | null;
}

export function ProductPickerSheet({
  open,
  onClose,
  onSelect,
  mode = 'in',
  warehouseId,
}: ProductPickerSheetProps) {
  const [search, setSearch] = useState('');
  const variants = useLiveQuery(() => db.variants.toArray(), []) ?? [];
  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];
  const [stockMap, setStockMap] = useState<Record<string, { qty: number; avg: number }>>({});

  // ✅ اصلاح باگ: بارگذاری موجودی‌ها با useEffect (به‌جای useState) و
  // به‌روزرسانی هنگام تغییر واریانت‌ها یا هر بار باز شدن شیت
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const map: Record<string, { qty: number; avg: number }> = {};
      for (const v of variants) {
        const qty = await getVariantTotalQuantity(v.id);
        const avg = await getVariantAverageCost(v.id);
        map[v.id] = { qty, avg };
      }
      if (!cancelled) setStockMap(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [variants, open]);

  const filtered = variants.filter((v) => {
    // کالاهای غیرفعال برای عملیات جدید قابل انتخاب نیستند
    const p = products.find((x) => x.id === v.productId);
    if (!v.isActive || (p && !p.isActive)) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return v.name.toLowerCase().includes(s) || v.sku.includes(s) || (p?.name.toLowerCase().includes(s) ?? false);
  });

  return (
    <Sheet open={open} onClose={onClose} title="انتخاب کالا" maxHeight="85%">
      <div className="px-4 pb-3">
        <div className="bg-white dark:bg-surface-dark-2 border-[1.5px] border-black/5 dark:border-cream/10 rounded-btn px-3 py-2.5 flex items-center gap-2 focus-within:border-orange">
          <Icon name="search" size={15} className="text-muted-light dark:text-muted-dark" />
          <input
            type="text"
            placeholder="جستجو..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-[12.5px] font-medium text-ink dark:text-cream"
            autoFocus
          />
        </div>
      </div>
      <div className="px-4 flex flex-col gap-2 pb-4">
        {filtered.length === 0 && (
          <div className="text-center py-8 text-[11.5px] text-muted-light dark:text-muted-dark">
            کالایی یافت نشد
          </div>
        )}
        {filtered.map((v) => {
          const p = products.find((x) => x.id === v.productId);
          const stock = stockMap[v.id] ?? { qty: 0, avg: 0 };
          // در انبارگردانی و ورود، کالای بدون موجودی هم قابل انتخاب است
          const disabled = mode === 'out' || mode === 'transfer' ? stock.qty <= 0 : false;
          return (
            <button
              key={v.id}
              onClick={() => {
                if (disabled) return;
                onSelect(v.id);
                onClose();
              }}
              disabled={disabled}
              className={`bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card p-3 flex items-center gap-3 text-right transition-all ${
                disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98]'
              }`}
            >
              <div className="w-10 h-10 rounded-btn bg-orange-soft text-orange flex items-center justify-center flex-shrink-0">
                <Icon name="box" size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-bold text-ink dark:text-cream truncate">
                  {p?.name ?? v.name}
                </div>
                <div className="text-[10px] text-muted-light dark:text-muted-dark mt-0.5 flex flex-wrap gap-x-2">
                  <span>کد: {v.sku}</span>
                  <span className={stock.qty <= 0 ? 'text-red-600 font-bold' : 'text-orange font-bold'}>
                    موجودی: {fmt(stock.qty)}
                  </span>
                  {stock.avg > 0 && <span>میانگین: {fmt(stock.avg)}</span>}
                </div>
              </div>
              <Icon name="chevron-left" size={16} className="text-muted-light dark:text-muted-dark flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
