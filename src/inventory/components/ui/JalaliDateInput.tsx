import { useState } from 'react';
import {
  JALALI_MONTHS,
  jalaliMonthLength,
  jalaliToGregorianDate,
  toJalali,
  toJalaliString,
  validateJalaliString,
} from '../../lib/jalali';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

// ============================================
// ورودی تاریخ شمسی با درج خودکار «/»، اعتبارسنجی
// و تقویم انتخابی هماهنگ با زبان بصری برنامه
// ============================================

interface JalaliDateInputProps {
  label?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

// قالب‌بندی تایپ تدریجی: 1403 → 1403/ → 1403/08 → 1403/08/24
function formatJalaliTyped(raw: string): string {
  const d = raw.replace(/[^0-9]/g, '').slice(0, 8);
  let out = d.slice(0, 4);
  if (d.length > 4) out += '/' + d.slice(4, 6);
  if (d.length > 6) out += '/' + d.slice(6, 8);
  return out;
}

export function JalaliDateInput({
  label,
  required,
  value,
  onChange,
  error,
  disabled,
}: JalaliDateInputProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const validationError = validateJalaliString(value);
  const displayError = error || validationError || undefined;

  return (
    <>
      <div className="flex flex-col gap-1.5">
        {label && (
          <span className="text-[10px] font-semibold text-muted-light dark:text-muted-dark pr-1 flex items-center gap-1">
            {label}
            {required && <span className="text-orange">*</span>}
          </span>
        )}
        <div
          className={`
            bg-white dark:bg-surface-dark-2
            border-[1.5px] rounded-btn px-3 py-2.5
            flex items-center gap-2 min-h-[42px]
            transition-all
            focus-within:border-orange focus-within:shadow-[0_0_0_3px_rgba(217,84,30,0.10)]
            ${displayError ? 'border-red-500' : 'border-black/5 dark:border-cream/10'}
            ${disabled ? 'opacity-60' : ''}
          `}
        >
          <span className="text-muted-light dark:text-muted-dark flex-shrink-0">
            <Icon name="calendar" size={14} />
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={value}
            onChange={(e) => onChange(formatJalaliTyped(e.target.value))}
            placeholder="1403/08/24"
            disabled={disabled}
            className="flex-1 bg-transparent border-none outline-none font-medium text-[13px] text-ink dark:text-cream min-w-0 placeholder:text-muted-light/60 dark:placeholder:text-muted-dark/60"
          />
          <button
            type="button"
            onClick={() => !disabled && setPickerOpen(true)}
            className="w-7 h-7 rounded-btn bg-orange-soft text-orange flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
            title="انتخاب از تقویم"
          >
            <Icon name="calendar" size={14} />
          </button>
        </div>
        {displayError && <span className="text-[10px] text-red-600 pr-1">{displayError}</span>}
      </div>

      <JalaliCalendarSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        value={value}
        onSelect={(v) => {
          onChange(v);
          setPickerOpen(false);
        }}
      />
    </>
  );
}

// ============================================
// شیت تقویم شمسی
// ============================================

interface JalaliCalendarSheetProps {
  open: boolean;
  onClose: () => void;
  value: string;
  onSelect: (value: string) => void;
}

function parseJalaliStr(v: string): { y: number; m: number; d: number } | null {
  const digits = v.replace(/[^0-9]/g, '');
  if (digits.length !== 8) return null;
  const y = Number(digits.slice(0, 4));
  const m = Number(digits.slice(4, 6));
  const d = Number(digits.slice(6, 8));
  if (y < 1300 || y > 1500 || m < 1 || m > 12 || d < 1 || d > jalaliMonthLength(y, m)) return null;
  return { y, m, d };
}

function JalaliCalendarSheet({ open, onClose, value, onSelect }: JalaliCalendarSheetProps) {
  const today = toJalali(new Date());
  const parsed = parseJalaliStr(value);
  const [viewY, setViewY] = useState<number>(parsed?.y ?? today.year);
  const [viewM, setViewM] = useState<number>(parsed?.m ?? today.month);
  const [prevOpen, setPrevOpen] = useState(open);

  // با هر بار باز شدن، تقویم روی تاریخ انتخاب‌شده یا امروز قرار می‌گیرد
  // (الگوی رسمی React — تنظیم state هنگام رندر)
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      const p = parseJalaliStr(value);
      setViewY(p?.y ?? today.year);
      setViewM(p?.m ?? today.month);
    }
  }

  const daysInMonth = jalaliMonthLength(viewY, viewM);
  const firstOffset = (jalaliToGregorianDate(viewY, viewM, 1).getDay() + 1) % 7; // شنبه = 0

  const goPrevMonth = () => {
    if (viewM === 1) {
      if (viewY <= 1300) return;
      setViewY(viewY - 1);
      setViewM(12);
    } else {
      setViewM(viewM - 1);
    }
  };
  const goNextMonth = () => {
    if (viewM === 12) {
      if (viewY >= 1500) return;
      setViewY(viewY + 1);
      setViewM(1);
    } else {
      setViewM(viewM + 1);
    }
  };

  const isSameDay = (d: number) =>
    parsed && parsed.y === viewY && parsed.m === viewM && parsed.d === d;
  const isToday = (d: number) => today.year === viewY && today.month === viewM && today.day === d;

  const WEEK_LABELS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

  return (
    <Sheet open={open} onClose={onClose} title="انتخاب تاریخ" maxHeight="80%">
      <div className="px-4">
        {/* هدر ناوبری ماه */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={goNextMonth}
            className="w-9 h-9 rounded-btn bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 flex items-center justify-center text-ink dark:text-cream transition-all active:scale-95"
            aria-label="ماه بعد"
          >
            <Icon name="chevron-left" size={15} />
          </button>
          <div className="text-[13.5px] font-extrabold text-ink dark:text-cream">
            {JALALI_MONTHS[viewM - 1]} {viewY}
          </div>
          <button
            onClick={goPrevMonth}
            className="w-9 h-9 rounded-btn bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 flex items-center justify-center text-ink dark:text-cream transition-all active:scale-95"
            aria-label="ماه قبل"
          >
            <Icon name="chevron-right" size={15} />
          </button>
        </div>

        {/* دکمه امروز */}
        <button
          onClick={() => onSelect(toJalaliString(new Date()))}
          className="w-full mb-3 py-2 rounded-btn bg-orange-soft text-orange text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
        >
          <Icon name="calendar" size={12} />
          امروز
        </button>

        {/* روزهای هفته */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEK_LABELS.map((w, i) => (
            <div
              key={i}
              className="text-center text-[9.5px] font-bold text-muted-light dark:text-muted-dark py-1"
            >
              {w}
            </div>
          ))}
        </div>

        {/* شبکه روزهای ماه */}
        <div className="grid grid-cols-7 gap-1 pb-2">
          {Array.from({ length: firstOffset }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1;
            const selected = isSameDay(d);
            const todayCell = isToday(d);
            return (
              <button
                key={d}
                onClick={() => onSelect(`${viewY}/${String(viewM).padStart(2, '0')}/${String(d).padStart(2, '0')}`)}
                className={`
                  h-9 rounded-btn text-[11.5px] font-bold flex items-center justify-center transition-all active:scale-90
                  ${selected
                    ? 'bg-orange text-white shadow-[0_2px_8px_rgba(217,84,30,0.35)]'
                    : todayCell
                      ? 'bg-orange-soft text-orange'
                      : 'bg-surface-light dark:bg-surface-dark text-ink dark:text-cream border border-black/5 dark:border-cream/10'
                  }
                `}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}
