import { type ReactNode } from 'react';
import { useThemeStore } from '../../stores/themeStore';
import { Icon } from '../ui/Icon';

interface TopBarProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightSlot?: ReactNode;
  showTheme?: boolean;
}

export function TopBar({ title, subtitle, onBack, rightSlot, showTheme = false }: TopBarProps) {
  const { theme, toggle } = useThemeStore();
  return (
    <div className="px-4 pt-4 pb-3 flex items-center gap-2.5 bg-cream dark:bg-[#0E0D0B] border-b border-black/5 dark:border-cream/10 flex-shrink-0">
      {onBack && (
        <button
          onClick={onBack}
          className="w-[38px] h-[38px] rounded-btn bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 flex items-center justify-center text-ink dark:text-cream flex-shrink-0"
        >
          <Icon name="back" size={16} />
        </button>
      )}
      <div className="flex-1 min-w-0 text-center">
        <h1 className="text-base font-extrabold text-ink dark:text-cream truncate">{title}</h1>
        {subtitle && (
          <div className="text-[10px] text-muted-light dark:text-muted-dark mt-0.5 font-medium truncate">
            {subtitle}
          </div>
        )}
      </div>
      {rightSlot}
      {showTheme && (
        <button
          onClick={toggle}
          className="w-[38px] h-[38px] rounded-btn bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 flex items-center justify-center text-ink dark:text-cream flex-shrink-0"
        >
          <Icon name={theme === 'light' ? 'sun' : 'moon'} size={16} />
        </button>
      )}
    </div>
  );
}