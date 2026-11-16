import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import {
  confirmDraftDocument,
  reverseDocument,
  deleteDocument,
} from '../../../lib/documents';
import type { Document } from '../../../types';

interface DocumentActionsProps {
  doc: Document;
  onChanged: () => void;
}

export function DocumentActions({ doc, onChanged }: DocumentActionsProps) {
  const [confirming, setConfirming] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await confirmDraftDocument(doc.id);
      setConfirming(false);
      onChanged();
    } catch (e: any) {
      setError(e.message || 'خطا در تأیید');
    } finally {
      setLoading(false);
    }
  };

  const handleReverse = async () => {
    setLoading(true);
    setError(null);
    try {
      await reverseDocument(doc.id);
      setReversing(false);
      onChanged();
    } catch (e: any) {
      setError(e.message || 'خطا در برگشت از تأیید');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      await deleteDocument(doc.id);
      setDeleting(false);
      onChanged();
    } catch (e: any) {
      setError(e.message || 'خطا در حذف');
    } finally {
      setLoading(false);
    }
  };

  if (doc.status === 'reversed') {
    return (
      <div className="px-5 py-3 text-center text-[11px] text-muted-light dark:text-muted-dark">
        این سند ابطال شده و قابل ویرایش نیست
      </div>
    );
  }

  return (
    <>
      <div className="absolute bottom-0 left-0 right-0 z-30 px-4 pb-5 pt-3 bg-cream/90 dark:bg-[#0E0D0B]/90 backdrop-blur-xl border-t border-black/5 dark:border-cream/10">
        {error && (
          <div className="mb-2 text-[11px] text-red-600 bg-red-500/10 rounded-md px-3 py-2">
            {error}
          </div>
        )}
        {doc.status === 'draft' && (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              fullWidth
              icon={<Icon name="trash" size={15} />}
              onClick={() => setDeleting(true)}
            >
              حذف
            </Button>
            <Button
              variant="primary"
              fullWidth
              icon={<Icon name="check" size={15} />}
              onClick={() => setConfirming(true)}
            >
              ثبت و تأیید
            </Button>
          </div>
        )}
        {doc.status === 'confirmed' && (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              fullWidth
              icon={<Icon name="trash" size={15} />}
              onClick={() => setDeleting(true)}
            >
              حذف
            </Button>
            <Button
              variant="primary"
              fullWidth
              icon={<Icon name="refresh" size={15} />}
              onClick={() => setReversing(true)}
            >
              برگشت از تأیید
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={handleConfirm}
        title="ثبت و تأیید سند؟"
        message="با تأیید این سند، اثر آن روی موجودی اعمال می‌شود. این عملیات قابل برگشت است."
        confirmText="تأیید و ثبت"
        loading={loading}
      />

      <ConfirmDialog
        open={reversing}
        onClose={() => setReversing(false)}
        onConfirm={handleReverse}
        title="برگشت از تأیید؟"
        message="با این کار اثر سند روی موجودی خنثی می‌شود و سند به حالت ابطال‌شده می‌رود."
        confirmText="برگشت از تأیید"
        variant="danger"
        loading={loading}
      />

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={handleDelete}
        title="حذف سند؟"
        message={
          doc.status === 'confirmed'
            ? 'این سند تأییدشده است. با حذف، اثر آن روی موجودی خنثی می‌شود و سند کاملاً پاک می‌شود.'
            : 'این پیش‌نویس به طور کامل حذف می‌شود.'
        }
        confirmText="حذف"
        variant="danger"
        loading={loading}
      />
    </>
  );
}