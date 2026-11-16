import { type ReactNode } from 'react';

interface BadgeProps {
  variant?: 'orange' | 'ink' | 'success' | 'danger' | 'muted';
  size?: 'sm' | 'md';
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = 'orange', size = 'md', children, className = '' }: BadgeProps) {
  const variants = {
    orange: 'bg-orange-soft text-orange',
    ink: 'bg-black/5 dark:bg-cream/10 text-ink dark:text-cream',
    success: 'bg-green-500/10 text-green-700 dark:text-green-400',
    danger: 'bg-red-500/10 text-red-600 dark:text-red-400',
    muted: 'bg-black/5 dark:bg-cream/10 text-muted-light dark:text-muted-dark',
  };
  
  const sizes = {
    sm: 'px-2 py-0.5 text-[9.5px]',
    md: 'px-2.5 py-1 text-[10px]',
  };
  
  return (
    <span className={`inline-flex items-center gap-1 font-bold rounded-md ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </span>
  );
}