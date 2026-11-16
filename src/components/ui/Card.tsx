import { type HTMLAttributes, type ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'flat' | 'bordered';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export function Card({
  variant = 'default',
  padding = 'md',
  children,
  className = '',
  ...rest
}: CardProps) {
  const variants = {
    default: 'bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 shadow-card',
    flat: 'bg-surface-light-2 dark:bg-surface-dark-2',
    bordered: 'bg-surface-light dark:bg-surface-dark border border-black/10 dark:border-cream/15',
  };
  
  const paddings = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-5',
  };
  
  return (
    <div
      className={`rounded-card-lg ${variants[variant]} ${paddings[padding]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}