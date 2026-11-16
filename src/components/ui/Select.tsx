import { forwardRef, type SelectHTMLAttributes, type ReactNode } from 'react';
import { Icon } from './Icon';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  required?: boolean;
  leadingIcon?: ReactNode;
  error?: string;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, required, leadingIcon, error, options, placeholder, className = '', id, ...rest },
  ref
) {
  const selectId = id || `select-${Math.random().toString(36).slice(2, 9)}`;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-[10px] font-semibold text-muted-light dark:text-muted-dark pr-1 flex items-center gap-1">
          {label}
          {required && <span className="text-orange">*</span>}
        </label>
      )}
      <div
        className={`
          bg-white dark:bg-surface-dark-2
          border-[1.5px] rounded-btn px-3 py-2.5
          flex items-center gap-2 min-h-[42px]
          transition-all relative
          focus-within:border-orange focus-within:shadow-[0_0_0_3px_rgba(217,84,30,0.10)]
          ${error ? 'border-red-500' : 'border-black/5 dark:border-cream/10'}
        `}
      >
        {leadingIcon && <span className="text-muted-light dark:text-muted-dark flex-shrink-0">{leadingIcon}</span>}
        <select
          id={selectId}
          ref={ref}
          className={`flex-1 bg-transparent border-none outline-none font-medium text-[13px] text-ink dark:text-cream min-w-0 appearance-none pr-6 cursor-pointer ${className}`}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="absolute left-3 pointer-events-none text-orange">
          <Icon name="chevron-down" size={14} />
        </span>
      </div>
      {error && <span className="text-[10px] text-red-600 pr-1">{error}</span>}
    </div>
  );
});