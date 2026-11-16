import { type ReactNode } from 'react';

interface WideMetricCardProps {
  icon: ReactNode;
  iconVariant?: 'orange' | 'ink';
  label: string;
  value: string;
  unit?: string;
}

export function WideMetricCard({ icon, iconVariant = 'orange', label, value, unit }: WideMetricCardProps) {
  const iconBg =
    iconVariant === 'orange'
      ? 'bg-orange-soft text-orange'
      : 'bg-black/5 dark:bg-cream/10 text-ink dark:text-cream';

  return (
    <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card-lg p-[18px] shadow-card flex items-center gap-3.5 mb-3">
      <div className={`w-13 h-13 min-w-[52px] h-[52px] rounded-btn flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-xs text-muted-light dark:text-muted-dark font-medium">{label}</div>
        <div className="text-[22px] font-extrabold text-ink dark:text-cream mt-1 tracking-tight">
          {value}
          {unit && <small className="text-xs font-medium text-muted-light dark:text-muted-dark mr-1">{unit}</small>}
        </div>
      </div>
    </div>
  );
}
