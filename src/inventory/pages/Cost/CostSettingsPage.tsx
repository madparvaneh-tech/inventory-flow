import { useEffect, useState } from 'react';
import { TopBar } from '../../components/layout/TopBar';
import { Icon } from '../../components/ui/Icon';
import { getRoundingStep, setRoundingStep } from '../../lib/pricingData';
import { ROUNDING_STEPS } from '../../types';
import { fmt } from '../../lib/format';

// ============================================================
// تنظیمات قیمت‌گذاری — گام گرد کردن قیمت نهایی
// گرد کردن فقط روی قیمت پایهٔ پیشنهادی و قیمت ثبت‌شده اعمال می‌شود؛
// مقادیر دقیق موتور محاسبات همیشه کنارش نمایش داده می‌شوند
// ============================================================

const OPTIONS: Array<{ value: number; label: string; example?: number }> = [
  { value: 0, label: 'بدون گرد کردن' },
  { value: 100, label: 'نزدیک‌ترین ۱۰۰', example: 123456 },
  { value: 500, label: 'نزدیک‌ترین ۵۰۰', example: 123456 },
  { value: 1000, label: 'نزدیک‌ترین ۱٬۰۰۰', example: 1234567 },
  { value: 5000, label: 'نزدیک‌ترین ۵٬۰۰۰', example: 1234567 },
  { value: 10000, label: 'نزدیک‌ترین ۱۰٬۰۰۰', example: 12345678 },
];

function roundTo(value: number, step: number): number {
  if (!step) return value;
  return Math.round(value / step) * step;
}

export function CostSettingsPage() {
  const [step, setStep] = useState<number>(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getRoundingStep().then(setStep).catch(() => {});
  }, []);

  const handleSelect = async (value: number) => {
    setStep(value);
    await setRoundingStep(value);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="pb-24">
      <TopBar
        title="تنظیمات قیمت‌گذاری"
        subtitle="گام گرد کردن قیمت نهایی"
        onBack={() => window.history.back()}
        showTheme
      />

      <div className="px-5 pt-3 flex flex-col gap-2.5">
        {saved && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-card p-3 flex items-center gap-2">
            <Icon name="check" size={15} className="text-green-700 dark:text-green-400 flex-shrink-0" />
            <div className="text-[11px] text-green-700 dark:text-green-400 font-semibold">تنظیمات ذخیره شد</div>
          </div>
        )}

        <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card p-3 flex flex-col gap-1.5">
          <div className="text-[11px] font-bold text-ink dark:text-cream flex items-center gap-1 mb-1">
            <Icon name="money" size={13} className="text-orange" />
            گرد کردن قیمت پیشنهادی
          </div>
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => handleSelect(o.value)}
              className={`rounded-btn p-2.5 text-right border transition-all flex items-center gap-2.5 ${
                step === o.value
                  ? 'bg-orange-soft border-orange/40'
                  : 'bg-surface-light-2 dark:bg-surface-dark-2 border-black/5 dark:border-cream/10 active:scale-[0.98]'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border-[1.5px] ${
                  step === o.value ? 'bg-orange border-orange text-white' : 'border-black/20 dark:border-cream/25'
                }`}
              >
                {step === o.value && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11.5px] font-bold text-ink dark:text-cream">{o.label}</div>
                {o.example !== undefined && (
                  <div className="text-[9.5px] text-muted-light dark:text-muted-dark mt-0.5 tabular-nums">
                    مثال: {fmt(o.example)} ← {fmt(roundTo(o.example, o.value))} ریال
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="bg-orange-soft border border-orange/20 rounded-card p-3">
          <div className="text-[10px] font-semibold text-orange leading-relaxed">
            گرد کردن فقط روی «قیمت پایهٔ پیشنهادی» و «قیمت فروش ثبت‌شده» اعمال می‌شود.
            مقادیر دقیق موتور محاسبات، بهای تمام‌شده و اجزای سناریوها هرگز با گرد کردن بازنویسی نمی‌شوند
            و در جزئیات محاسبه کنار مقدار گردشده نمایش داده می‌شوند.
          </div>
        </div>
      </div>
    </div>
  );
}
