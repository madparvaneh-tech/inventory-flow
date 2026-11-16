import { useState, type ReactNode } from 'react';
import { Sheet } from './Sheet';
import { ConfirmDialog } from './ConfirmDialog';
import { Icon } from './Icon';
import { errMsg } from '../../lib/format';

// ============================================
// شِل مشترک فرم موجودیت‌های اطلاعات پایه
// ذخیره/انصراف + حذف (فقط حالت ویرایش) با تأیید
// ============================================

interface EntitySheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  onSave: () => Promise<void>;
  onDelete?: () => Promise<void>;
  deleteTitle?: string;
  deleteMessage?: string;
  canSave?: boolean;
}

export function EntitySheet({
  open,
  onClose,
  title,
  children,
  onSave,
  onDelete,
  deleteTitle = 'حذف شود؟',
  deleteMessage = 'این مورد به طور کامل حذف می‌شود.',
  canSave = true,
}: EntitySheetProps) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave();
      onClose();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await onDelete();
      setConfirmDelete(false);
      onClose();
    } catch (e) {
      setError(errMsg(e));
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={title}
        maxHeight="85%"
        footer={
          <div className="px-4 pb-5 pt-3 bg-cream dark:bg-[#0E0D0B] border-t border-black/5 dark:border-cream/10">
            {error && (
              <div className="mb-2 text-[11px] text-red-600 bg-red-500/10 rounded-md px-3 py-2 flex items-center gap-1.5">
                <Icon name="warning" size={14} />
                {error}
              </div>
            )}
            <div className="flex gap-2">
              {onDelete && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={saving || deleting}
                  className="px-3.5 py-3 rounded-btn bg-red-500/10 text-red-600 text-[12px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 flex-shrink-0"
                >
                  <Icon name="trash" size={14} />
                  حذف
                </button>
              )}
              <button
                onClick={onClose}
                disabled={saving || deleting}
                className="flex-1 py-3 rounded-btn bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 text-[12.5px] font-bold text-ink dark:text-cream disabled:opacity-50"
              >
                انصراف
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !canSave}
                className="flex-1 py-3 rounded-btn bg-orange text-white text-[12.5px] font-bold flex items-center justify-center gap-1.5 shadow-[0_6px_20px_rgba(217,84,30,0.35)] disabled:opacity-50"
              >
                {saving ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Icon name="check" size={15} />
                )}
                ذخیره
              </button>
            </div>
          </div>
        }
      >
        <div className="px-4 flex flex-col gap-2.5">{children}</div>
      </Sheet>

      {onDelete && (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
          title={deleteTitle}
          message={deleteMessage}
          confirmText="حذف"
          variant="danger"
          loading={deleting}
        />
      )}
    </>
  );
}
