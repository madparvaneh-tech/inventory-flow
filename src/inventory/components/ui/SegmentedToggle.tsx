interface SegmentedToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
  trueLabel: string;
  falseLabel: string;
  disabled?: boolean;
}

// انتخابگر دوحالته — همان الگوی دکمه‌های «سالم / معیوب» برنامه
export function SegmentedToggle({ value, onChange, trueLabel, falseLabel, disabled }: SegmentedToggleProps) {
  return (
    <div className="flex gap-1.5">
      <button
        type="button"
        onClick={() => onChange(true)}
        disabled={disabled}
        className={`flex-1 py-1.5 rounded-btn text-[10.5px] font-bold transition-all ${
          value
            ? 'bg-orange text-white'
            : 'bg-surface-light-2 dark:bg-surface-dark-2 text-muted-light dark:text-muted-dark'
        }`}
      >
        {trueLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        disabled={disabled}
        className={`flex-1 py-1.5 rounded-btn text-[10.5px] font-bold transition-all ${
          !value
            ? 'bg-orange text-white'
            : 'bg-surface-light-2 dark:bg-surface-dark-2 text-muted-light dark:text-muted-dark'
        }`}
      >
        {falseLabel}
      </button>
    </div>
  );
}
