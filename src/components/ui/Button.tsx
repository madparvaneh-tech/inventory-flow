import { type ButtonHTMLAttributes, type ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  iconPosition?: 'start' | 'end';
  fullWidth?: boolean;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'start',
  fullWidth,
  loading,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 font-bold rounded-btn transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-orange text-white shadow-[0_6px_20px_rgba(217,84,30,0.35)]',
    secondary: 'bg-surface-light dark:bg-surface-dark text-ink dark:text-cream border border-black/5 dark:border-cream/10',
    ghost: 'bg-transparent text-ink dark:text-cream hover:bg-orange-soft',
    danger: 'bg-red-600 text-white',
  };
  
  const sizes = {
    sm: 'px-3 py-2 text-xs',
    md: 'px-4 py-3 text-sm',
    lg: 'px-5 py-4 text-base',
  };
  
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
      ) : (
        <>
          {icon && iconPosition === 'start' && <span className="flex-shrink-0">{icon}</span>}
          {children}
          {icon && iconPosition === 'end' && <span className="flex-shrink-0">{icon}</span>}
        </>
      )}
    </button>
  );
}