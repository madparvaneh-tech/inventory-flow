import { type ReactNode } from 'react';
import { TopBar } from '../../../../components/layout/TopBar';
import { Icon } from '../../../../components/ui/Icon';

interface DocumentFormShellProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  error?: string | null;
  onDraft: () => void;
  onConfirm: () => void;
  saving?: boolean;
  canSave?: boolean;
  children: ReactNode;
}

export function DocumentFormShell({
  title,
  subtitle,
  onBack,
  error,
  onDraft,
  onConfirm,
  saving,
  canSave = true,
  children,
}: DocumentFormShellProps) {
  return (
    // ستون با حداقل ارتفاع کامل — دکمه‌ها با sticky همیشه ثابت در انتهای صفحه می‌مانند
    <div className="min-h-full flex flex-col">
      <TopBar title={title} subtitle={subtitle} onBack={onBack} showTheme />

      <div className="px-5 pt-3 flex-1">{children}</div>

      <div className="sticky bottom-0 z-30 px-4 pb-5 pt-3 bg-cream/90 dark:bg-[#0E0D0B]/90 backdrop-blur-xl border-t border-black/5 dark:border-cream/10">
        {error && (
          <div className="mb-2 text-[11px] text-red-600 bg-red-500/10 rounded-md px-3 py-2 flex items-center gap-1.5">
            <Icon name="warning" size={14} />
            {error}
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={onDraft}
            disabled={saving || !canSave}
            className="flex-1 py-3 rounded-btn bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 text-[12.5px] font-bold text-ink dark:text-cream flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Icon name="draft" size={15} />
            ذخیره پیش‌نویس
          </button>
          <button
            onClick={onConfirm}
            disabled={saving || !canSave}
            className="flex-1 py-3 rounded-btn bg-orange text-white text-[12.5px] font-bold flex items-center justify-center gap-1.5 shadow-[0_6px_20px_rgba(217,84,30,0.35)] disabled:opacity-50"
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Icon name="check" size={15} />
            )}
            ثبت و تأیید
          </button>
        </div>
      </div>
    </div>
  );
}
