import { useEffect, useState } from 'react';
import { Icon } from '../../../../components/ui/Icon';
import { fmt, parseNum } from '../../../../lib/format';
import { getWarehouseStock, getVariantAverageCost } from '../../../../lib/inventory';
import type { Variant, Product } from '../../../../types';
import { ProductPickerSheet } from './ProductPickerSheet';

export interface EditableLine {
  tempId: string;
  variantId: string;
  quantity: number;
  unitCost: number;
  discount: number;
  stockStatus: 'healthy' | 'defective';
}

interface LineItemsEditorProps {
  lines: EditableLine[];
  onChange: (lines: EditableLine[]) => void;
  mode: 'in' | 'out' | 'transfer';
  warehouseId: string | null;
  variants: Variant[];
  products: Product[];
  disabled?: boolean;
}

export function LineItemsEditor({
  lines,
  onChange,
  mode,
  warehouseId,
  variants,
  products,
  disabled,
}: LineItemsEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const updateLine = (tempId: string, patch: Partial<EditableLine>) => {
    onChange(lines.map((l) => (l.tempId === tempId ? { ...l, ...patch } : l)));
  };

  const removeLine = (tempId: string) => {
    onChange(lines.filter((l) => l.tempId !== tempId));
  };

  const addLine = (variantId: string) => {
    const existing = lines.find((l) => l.variantId === variantId);
    if (existing && mode === 'in') {
      updateLine(existing.tempId, { quantity: existing.quantity + 1 });
      return;
    }
    onChange([
      ...lines,
      {
        tempId: crypto.randomUUID(),
        variantId,
        quantity: 1,
        unitCost: 0,
        discount: 0,
        stockStatus: 'healthy',
      },
    ]);
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        {lines.length === 0 && (
          <div className="bg-surface-light dark:bg-surface-dark border border-dashed border-black/10 dark:border-cream/15 rounded-card p-6 text-center text-[11px] text-muted-light dark:text-muted-dark">
            هنوز کالایی اضافه نشده
          </div>
        )}

        {lines.map((line) => (
          <LineItemRow
            key={line.tempId}
            line={line}
            mode={mode}
            warehouseId={warehouseId}
            variants={variants}
            products={products}
            disabled={disabled}
            onUpdate={(patch) => updateLine(line.tempId, patch)}
            onRemove={() => removeLine(line.tempId)}
          />
        ))}

        {!disabled && (
          <button
            onClick={() => setPickerOpen(true)}
            className="w-full py-3 rounded-btn border-[1.5px] border-dashed border-black/10 dark:border-cream/15 text-muted-light dark:text-muted-dark text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
          >
            <Icon name="plus" size={14} />
            افزودن کالا
          </button>
        )}
      </div>

      <ProductPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={addLine}
        mode={mode}
        warehouseId={warehouseId}
      />
    </>
  );
}

// ===== کامپوننت مستقل هر ردیف (hookها اینجا امن هستند) =====
interface LineItemRowProps {
  line: EditableLine;
  mode: 'in' | 'out' | 'transfer';
  warehouseId: string | null;
  variants: Variant[];
  products: Product[];
  disabled?: boolean;
  onUpdate: (patch: Partial<EditableLine>) => void;
  onRemove: () => void;
}

function LineItemRow({
  line,
  mode,
  warehouseId,
  variants,
  products,
  disabled,
  onUpdate,
  onRemove,
}: LineItemRowProps) {
  const [stockInfo, setStockInfo] = useState<{ available: number; avg: number }>({
    available: 0,
    avg: 0,
  });

  // ✅ اینجا useEffect امن است چون داخل کامپوننت مستقل است، نه loop
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const updates: Partial<{ available: number; avg: number }> = {};
      if (warehouseId && mode !== 'in') {
        updates.available = await getWarehouseStock(line.variantId, warehouseId, 'healthy');
      }
      updates.avg = await getVariantAverageCost(line.variantId);
      if (!cancelled) {
        setStockInfo((s) => ({ ...s, ...updates }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [line.variantId, warehouseId, mode]);

  const variant = variants.find((x) => x.id === line.variantId);
  const product = variant ? products.find((x) => x.id === variant.productId) : undefined;
  const lineTotal = line.quantity * line.unitCost - line.discount;

  return (
    <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card p-3 shadow-card">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-9 h-9 rounded-btn bg-orange-soft text-orange flex items-center justify-center flex-shrink-0">
          <Icon name="box" size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-bold text-ink dark:text-cream truncate">
            {product?.name ?? 'کالا'}
          </div>
          <div className="text-[10px] text-muted-light dark:text-muted-dark mt-0.5 flex flex-wrap gap-x-2">
            <span>کد: {variant?.sku ?? '—'}</span>
            {mode !== 'in' && (
              <span
                className={
                  stockInfo.available < line.quantity
                    ? 'text-red-600 font-bold'
                    : 'text-orange font-bold'
                }
              >
                موجودی: {fmt(stockInfo.available)}
              </span>
            )}
            {mode === 'in' && stockInfo.avg > 0 && (
              <span>میانگین: {fmt(stockInfo.avg)}</span>
            )}
          </div>
        </div>
        {!disabled && (
          <button
            onClick={onRemove}
            className="w-7 h-7 rounded-btn text-red-600 flex items-center justify-center flex-shrink-0"
          >
            <Icon name="trash" size={14} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <div>
          <div className="text-[9px] text-muted-light dark:text-muted-dark font-semibold mb-1 pr-1">
            تعداد
          </div>
          <div className="bg-white dark:bg-surface-dark-2 border-[1.5px] border-black/5 dark:border-cream/10 rounded-btn px-2 py-1.5 focus-within:border-orange">
            <input
              type="text"
              value={line.quantity}
              onChange={(e) =>
                onUpdate({ quantity: Math.max(0, parseNum(e.target.value)) })
              }
              disabled={disabled}
              className="w-full bg-transparent border-none outline-none text-[12px] font-bold text-ink dark:text-cream text-center"
            />
          </div>
        </div>
        <div>
          <div className="text-[9px] text-muted-light dark:text-muted-dark font-semibold mb-1 pr-1">
            {mode === 'in' ? 'قیمت خرید' : 'قیمت واحد'}
          </div>
          <div
            className={`border-[1.5px] rounded-btn px-2 py-1.5 ${
              mode === 'in' && line.unitCost === 0
                ? 'border-red-500 bg-white dark:bg-surface-dark-2'
                : 'bg-white dark:bg-surface-dark-2 border-black/5 dark:border-cream/10 focus-within:border-orange'
            }`}
          >
            <input
              type="text"
              value={line.unitCost === 0 ? '' : line.unitCost}
              placeholder="0"
              onChange={(e) =>
                onUpdate({ unitCost: Math.max(0, parseNum(e.target.value)) })
              }
              disabled={disabled}
              className="w-full bg-transparent border-none outline-none text-[12px] font-bold text-ink dark:text-cream text-center"
            />
          </div>
        </div>
        <div>
          <div className="text-[9px] text-muted-light dark:text-muted-dark font-semibold mb-1 pr-1">
            مبلغ کل
          </div>
          <div className="bg-orange-soft border-[1.5px] border-transparent rounded-btn px-2 py-1.5 flex items-center justify-center">
            <span className="text-[11.5px] font-bold text-orange">
              {fmt(lineTotal)}
            </span>
          </div>
        </div>
      </div>

      {mode === 'in' && (
        <div className="mt-1.5">
          <div className="text-[9px] text-muted-light dark:text-muted-dark font-semibold mb-1 pr-1">
            تخفیف ردیف
          </div>
          <div className="bg-white dark:bg-surface-dark-2 border-[1.5px] border-black/5 dark:border-cream/10 rounded-btn px-2 py-1.5 focus-within:border-orange flex items-center gap-1">
            <input
              type="text"
              value={line.discount || ''}
              placeholder="0"
              onChange={(e) =>
                onUpdate({ discount: Math.max(0, parseNum(e.target.value)) })
              }
              disabled={disabled}
              className="flex-1 bg-transparent border-none outline-none text-[12px] font-bold text-ink dark:text-cream text-center"
            />
            <span className="text-[9px] text-muted-light dark:text-muted-dark font-medium">
              تومان
            </span>
          </div>
        </div>
      )}

      {mode !== 'in' && !disabled && (
        <div className="mt-1.5">
          <div className="text-[9px] text-muted-light dark:text-muted-dark font-semibold mb-1 pr-1">
            وضعیت کالا
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => onUpdate({ stockStatus: 'healthy' })}
              className={`flex-1 py-1.5 rounded-btn text-[10.5px] font-bold ${
                line.stockStatus === 'healthy'
                  ? 'bg-orange text-white'
                  : 'bg-surface-light-2 dark:bg-surface-dark-2 text-muted-light dark:text-muted-dark'
              }`}
            >
              سالم
            </button>
            <button
              onClick={() => onUpdate({ stockStatus: 'defective' })}
              className={`flex-1 py-1.5 rounded-btn text-[10.5px] font-bold ${
                line.stockStatus === 'defective'
                  ? 'bg-orange text-white'
                  : 'bg-surface-light-2 dark:bg-surface-dark-2 text-muted-light dark:text-muted-dark'
              }`}
            >
              معیوب
            </button>
          </div>
        </div>
      )}
    </div>
  );
}