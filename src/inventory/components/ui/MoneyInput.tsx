import { useRef, useState } from 'react';
import { toEnglishDigits } from '../../lib/format';

interface MoneyInputProps {
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  suffixPosition?: 'inside' | 'outside';
  disabled?: boolean;
  placeholder?: string;
  error?: boolean;
  allowDecimals?: boolean;
  className?: string;
  ariaLabel?: string;
}

// گروه‌بندی سه‌رقمی جزء صحیح
function groupInt(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// عدد را به رشته نمایشی با کاما تبدیل می‌کند (صفر و نامعتبر = خالی)
export function formatMoney(n: number, allowDecimals = false): string {
  if (n === null || n === undefined || !isFinite(n)) return '';
  const abs = Math.abs(n);
  if (abs === 0) return '';
  const fixed = allowDecimals ? String(n) : String(Math.round(n));
  const [ip, fp] = fixed.split('.');
  const grouped = groupInt(ip);
  if (allowDecimals && fp !== undefined && fp !== '') return `${grouped}.${fp}`;
  return grouped;
}

// پارس آزاد ورودی کاربر: ارقام فارسی/عربی، کاما و ممیز
function parseLoose(raw: string, allowDecimals: boolean): number {
  let s = toEnglishDigits(raw).replace(/,/g, '').replace(/٫/g, '.');
  // فقط اولین ممیز معتبر است
  const firstDot = s.indexOf('.');
  if (firstDot >= 0) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
  }
  if (!allowDecimals) s = s.replace(/\./g, '');
  // حذف صفرهای ابتدایی (به‌جز حالت اعشاری «0.»)
  if (!allowDecimals) s = s.replace(/^0+(?=\d)/, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function countDigits(s: string): number {
  return toEnglishDigits(s).replace(/[^0-9]/g, '').length;
}

// اندازه فونت خودکار بر اساس تعداد ارقام — تا هر مبلغی در باکس جا شود
function autoFontSize(formatted: string): number {
  const digits = countDigits(formatted);
  if (digits <= 7) return 13;
  if (digits <= 9) return 12;
  if (digits <= 11) return 11;
  return 10;
}

// موقعیت کارسر بعد از «n» کاراکتر رقم در رشته قالب‌بندی‌شده
function positionAfterDigits(formatted: string, n: number): number {
  let count = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/[0-9]/.test(formatted[i])) {
      count++;
      if (count >= n) return i + 1;
    }
  }
  return formatted.length;
}

export function MoneyInput({
  value,
  onChange,
  suffix,
  suffixPosition = 'inside',
  disabled,
  placeholder = '0',
  error,
  allowDecimals = false,
  className = '',
  ariaLabel,
}: MoneyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // مقدار در حال ویرایش — برای پشتیبانی از تایپ تدریجی مثل «0.»
  const [draft, setDraft] = useState<string>(() => formatMoney(value, allowDecimals));
  const [prevValue, setPrevValue] = useState(value);

  // همگام‌سازی وقتی مقدار بیرونی تغییر می‌کند (الگوی رسمی React — تنظیم state هنگام رندر)
  if (value !== prevValue) {
    setPrevValue(value);
    if (parseLoose(draft, allowDecimals) !== value) {
      setDraft(formatMoney(value, allowDecimals));
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const raw = el.value;
    const caret = el.selectionStart ?? raw.length;
    const digitsBefore = countDigits(raw.slice(0, caret));

    const num = parseLoose(raw, allowDecimals);
    const formatted = formatMoney(num, allowDecimals);
    setDraft(formatted);
    onChange(num);

    // حفظ موقعیت نسبی کرسر پس از قالب‌بندی مجدد
    requestAnimationFrame(() => {
      if (document.activeElement === el) {
        const pos = positionAfterDigits(formatted, digitsBefore);
        el.setSelectionRange(pos, pos);
      }
    });
  };

  const handleBlur = () => {
    // نرمال‌سازی نهایی هنگام خروج از فیلد
    setDraft(formatMoney(parseLoose(draft, allowDecimals), allowDecimals));
  };

  const input = (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={ariaLabel}
      style={{ fontSize: autoFontSize(draft) }}
      className="flex-1 min-w-0 bg-transparent border-none outline-none font-bold text-ink dark:text-cream text-center placeholder:text-muted-light/50 dark:placeholder:text-muted-dark/50 transition-[font-size] duration-150"
    />
  );

  const box = (
    <div
      className={`
        bg-white dark:bg-surface-dark-2
        border-[1.5px] rounded-btn px-2 py-1.5
        flex items-center gap-1 min-w-0
        transition-all focus-within:border-orange focus-within:shadow-[0_0_0_3px_rgba(217,84,30,0.10)]
        ${error ? 'border-red-500' : 'border-black/5 dark:border-cream/10'}
        ${disabled ? 'opacity-60' : ''}
        ${className}
      `}
    >
      {input}
      {suffix && suffixPosition === 'inside' && (
        <span className="text-[9px] text-muted-light dark:text-muted-dark font-medium flex-shrink-0">
          {suffix}
        </span>
      )}
    </div>
  );

  if (suffix && suffixPosition === 'outside') {
    return (
      <div className="flex items-center gap-1 min-w-0">
        {box}
        <span className="text-[9px] text-muted-light dark:text-muted-dark font-medium flex-shrink-0">
          {suffix}
        </span>
      </div>
    );
  }

  return box;
}
