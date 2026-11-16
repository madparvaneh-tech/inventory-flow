import { type ReactNode } from 'react';
import { Icon } from './Icon';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'تأیید',
  cancelText = 'انصراف',
  variant = 'primary',
  loading = false,
}: ConfirmDialogProps) {
  if (!open) return null;

  const confirmBg =
    variant === 'danger'
      ? 'bg-red-600 text-white'
      : 'bg-orange text-white shadow-[0_6px_20px_rgba(217,84,30,0.35)]';

  return (
    <div
      className="absolute inset-0 z-[60] bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-5"
      onClick={onClose}
    >
      <div
        className="bg-cream dark:bg-[#1A1815] rounded-2xl p-5 w-full max-w-[330px] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${
            variant === 'danger'
              ? 'bg-red-500/10 text-red-600'
              : 'bg-orange-soft text-orange'
          }`}
        >
          <Icon name={variant === 'danger' ? 'warning' : 'check'} size={24} />
        </div>
        <h3 className="text-[15px] font-extrabold text-ink dark:text-cream">{title}</h3>
        <div className="text-[12px] text-muted-light dark:text-muted-dark mt-2 leading-relaxed">
          {message}
        </div>
        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-btn bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 text-[12.5px] font-bold text-ink dark:text-cream"
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-btn text-[12.5px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 ${confirmBg}`}
          >
            {loading && (
              <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            )}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}