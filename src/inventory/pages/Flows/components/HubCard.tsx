import { type ReactNode } from 'react';

interface HubCardProps {
  icon: ReactNode;
  label: string;
  desc?: string;
  badge?: string;
  onClick: () => void;
  variant?: 'orange' | 'ink' | 'success' | 'danger' | 'muted';
}

export function HubCard({ icon, label, desc, badge, onClick, variant = 'orange' }: HubCardProps) {
  const variants = {
    orange: 'bg-orange-soft text-orange',
    ink: 'bg-black/5 dark:bg-cream/10 text-ink dark:text-cream',
    success: 'bg-green-500/10 text-green-700 dark:text-green-400',
    danger: 'bg-red-500/10 text-red-600 dark:text-red-400',
    muted: 'bg-black/5 dark:bg-cream/10 text-muted-light dark:text-muted-dark',
  };

  return (
    <button
      onClick={onClick}
      className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card p-3.5 shadow-card flex flex-col items-start gap-2.5 text-right transition-all active:scale-[0.97] w-full"
    >
      <div className={`w-10 h-10 rounded-btn flex items-center justify-center ${variants[variant]}`}>
        {icon}
      </div>
      <div className="w-full">
        <div className="flex items-center justify-between gap-1">
          <div className="text-[13px] font-bold text-ink dark:text-cream truncate">{label}</div>
          {badge && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange text-white">
              {badge}
            </span>
          )}
        </div>
        {desc && (
          <div className="text-[10px] text-muted-light dark:text-muted-dark mt-0.5 leading-tight">
            {desc}
          </div>
        )}
      </div>
    </button>
  );
}
