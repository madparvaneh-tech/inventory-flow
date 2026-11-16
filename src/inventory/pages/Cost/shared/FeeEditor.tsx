import { Icon } from '../../../components/ui/Icon';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { Select } from '../../../components/ui/Select';
import { Input } from '../../../components/ui/Input';
import { FEE_BASIS_LABELS } from '../../../types';
import type { FeeConfig } from '../../../types';

// ============================================================
// ویرایشگر لیست هزینه‌های فروش — مشترک بین الگو و کانال فروش
// هر هزینه: عنوان، نوع محاسبه، مقدار، مبنای مستقل
// ============================================================

interface FeeEditorProps {
  fees: FeeConfig[];
  onChange: (fees: FeeConfig[]) => void;
}

export function FeeEditor({ fees, onChange }: FeeEditorProps) {
  const addFee = () => {
    onChange([
      ...fees,
      {
        id: crypto.randomUUID(),
        title: '',
        calcType: 'percent',
        value: 0,
        basis: 'before_discount',
      },
    ]);
  };

  const updateFee = (id: string, patch: Partial<FeeConfig>) => {
    onChange(fees.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const removeFee = (id: string) => {
    onChange(fees.filter((f) => f.id !== id));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold text-ink dark:text-cream flex items-center gap-1">
          <Icon name="money" size={13} className="text-orange" />
          هزینه‌های فروش ({fees.length})
        </div>
        <button
          type="button"
          onClick={addFee}
          className="px-2.5 py-1.5 rounded-btn bg-orange-soft text-orange text-[10.5px] font-bold flex items-center gap-1 transition-all active:scale-95"
        >
          <Icon name="plus" size={12} />
          افزودن هزینه
        </button>
      </div>

      {fees.length === 0 && (
        <div className="bg-surface-light dark:bg-surface-dark border border-dashed border-black/10 dark:border-cream/15 rounded-btn p-3 text-center text-[10.5px] text-muted-light dark:text-muted-dark">
          هزینه‌ای تعریف نشده — اختیاری
        </div>
      )}

      {fees.map((f) => (
        <div
          key={f.id}
          className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-btn p-2.5 flex flex-col gap-2"
        >
          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <Input
                value={f.title}
                onChange={(e) => updateFee(f.id, { title: e.target.value })}
                placeholder="عنوان هزینه (مثلاً کمیسیون)"
                aria-label="عنوان هزینه"
              />
            </div>
            <button
              type="button"
              onClick={() => removeFee(f.id)}
              className="w-8 h-8 rounded-btn text-red-600 flex items-center justify-center flex-shrink-0"
              aria-label={`حذف هزینه ${f.title || ''}`}
            >
              <Icon name="trash" size={14} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <Select
              label="نوع"
              value={f.calcType}
              onChange={(e) => {
                const calcType = e.target.value as FeeConfig['calcType'];
                updateFee(f.id, {
                  calcType,
                  basis: calcType === 'fixed' ? 'per_unit' : 'before_discount',
                });
              }}
              options={[
                { value: 'percent', label: 'درصدی' },
                { value: 'fixed', label: 'مبلغ ثابت' },
              ]}
            />
            <Select
              label="مبنای محاسبه"
              value={f.basis}
              onChange={(e) => updateFee(f.id, { basis: e.target.value as FeeConfig['basis'] })}
              options={
                f.calcType === 'percent'
                  ? (['before_discount', 'after_discount', 'customer_paid'] as const).map((b) => ({
                      value: b,
                      label: FEE_BASIS_LABELS[b],
                    }))
                  : [{ value: 'per_unit' as const, label: FEE_BASIS_LABELS.per_unit }]
              }
            />
          </div>

          <div>
            <div className="text-[9.5px] font-semibold text-muted-light dark:text-muted-dark pr-1 mb-1">
              {f.calcType === 'percent' ? 'مقدار (درصد)' : 'مبلغ (ریال)'}
            </div>
            {f.calcType === 'percent' ? (
              <MoneyInput
                value={f.value}
                onChange={(v) => updateFee(f.id, { value: v })}
                allowDecimals
                suffix="٪"
                ariaLabel="مقدار هزینه"
              />
            ) : (
              <MoneyInput
                value={f.value}
                onChange={(v) => updateFee(f.id, { value: v })}
                suffix="ریال"
                ariaLabel="مبلغ هزینه"
              />
            )}
          </div>
        </div>
      ))}

      {fees.length > 0 && (
        <div className="text-[9.5px] text-muted-light dark:text-muted-dark px-1">
          هزینهٔ درصدی = درصدی از مبنای انتخابی • هزینهٔ ثابت = مبلغ به‌ازای هر واحد فروش
        </div>
      )}
    </div>
  );
}
