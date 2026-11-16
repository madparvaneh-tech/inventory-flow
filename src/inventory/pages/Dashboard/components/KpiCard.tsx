import { type ReactNode } from 'react';

interface KpiCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  unit?: string;
  variant?: 'orange' | 'ink';
}

export function KpiCard({ icon, label, value, unit, variant = 'orange' }: KpiCardProps) {
  const iconBg =
    variant === 'orange'
      ? 'bg-orange-soft text-orange'
      : 'bg-black/5 dark:bg-cream/10 text-ink dark:text-cream';

  return (
    <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card-lg p-4 shadow-card">
      <div className={`w-[38px] h-[38px] rounded-btn flex items-center justify-center mb-3 ${iconBg}`}>
        {icon}
      </div>
      <div className="text-xs text-muted-light dark:text-muted-dark font-medium">{label}</div>
      <div className="text-xl font-extrabold text-ink dark:text-cream mt-1 tracking-tight">
        {value}
        {unit && <small className="text-[11px] font-medium text-muted-light dark:text-muted-dark mr-1">{unit}</small>}
      </div>
    </div>
  );
}
