import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  required?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, required, leadingIcon, trailingIcon, error, className = '', id, ...rest },
  ref
) {
  const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-[10px] font-semibold text-muted-light dark:text-muted-dark pr-1 flex items-center gap-1">
          {label}
          {required && <span className="text-orange">*</span>}
        </label>
      )}
      <div
        className={`
          bg-white dark:bg-surface-dark-2
          border-[1.5px] rounded-btn px-3 py-2.5
          flex items-center gap-2 min-h-[42px]
          transition-all
          focus-within:border-orange focus-within:shadow-[0_0_0_3px_rgba(217,84,30,0.10)]
          ${error ? 'border-red-500' : 'border-black/5 dark:border-cream/10'}
        `}
      >
        {leadingIcon && <span className="text-muted-light dark:text-muted-dark flex-shrink-0">{leadingIcon}</span>}
        <input
          id={inputId}
          ref={ref}
          className={`flex-1 bg-transparent border-none outline-none font-medium text-[13px] text-ink dark:text-cream min-w-0 placeholder:text-muted-light/60 dark:placeholder:text-muted-dark/60 ${className}`}
          {...rest}
        />
        {trailingIcon && <span className="text-orange flex-shrink-0">{trailingIcon}</span>}
      </div>
      {error && <span className="text-[10px] text-red-600 pr-1">{error}</span>}
    </div>
  );
});
