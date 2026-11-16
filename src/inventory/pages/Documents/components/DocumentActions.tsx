import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import {
  confirmDraftDocument,
  confirmCountDocument,
  reverseDocument,
  reverseCountDocument,
  deleteDocument,
} from '../../../lib/documents';
import { errMsg } from '../../../lib/format';
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

  const isCount = doc.type === 'count';

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isCount) {
        await confirmCountDocument(doc.id);
      } else {
        await confirmDraftDocument(doc.id);
      }
      setConfirming(false);
      onChanged();
    } catch (e) {
      setError(errMsg(e) || 'خطا در تأیید');
    } finally {
      setLoading(false);
    }
  };

  const handleReverse = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isCount) {
        await reverseCountDocument(doc.id);
      } else {
        await reverseDocument(doc.id);
      }
      setReversing(false);
      onChanged();
    } catch (e) {
      setError(errMsg(e) || 'خطا در برگشت از تأیید');
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
    } catch (e) {
      setError(errMsg(e) || 'خطا در حذف');
    } finally {
      setLoading(false);
    }
  };

  // سند ابطال‌شده
  if (doc.status === 'reversed') {
    return (
      <div className="sticky bottom-0 px-5 py-3 text-center text-[11px] text-muted-light dark:text-muted-dark bg-cream/90 dark:bg-[#0E0D0B]/90 backdrop-blur-xl border-t border-black/5 dark:border-cream/10">
        این سند ابطال شده و قابل ویرایش نیست
      </div>
    );
  }

  return (
    <>
      <div className="sticky bottom-0 z-30 px-4 pb-5 pt-3 bg-cream/90 dark:bg-[#0E0D0B]/90 backdrop-blur-xl border-t border-black/5 dark:border-cream/10">
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
        title={isCount ? 'تأیید انبارگردانی؟' : 'ثبت و تأیید سند؟'}
        message={
          isCount
            ? 'با تأیید انبارگردانی، اختلاف‌ها از طریق اسناد اصلاح موجودی متصل به این سند اعمال می‌شوند. این عملیات اتمیک است و به‌صورت یکجا ثبت می‌شود.'
            : 'با تأیید این سند، اثر آن روی موجودی اعمال می‌شود. این عملیات قابل برگشت است.'
        }
        confirmText={isCount ? 'تأیید انبارگردانی' : 'تأیید و ثبت'}
        loading={loading}
      />

      <ConfirmDialog
        open={reversing}
        onClose={() => setReversing(false)}
        onConfirm={handleReverse}
        title={isCount ? 'برگشت انبارگردانی؟' : 'برگشت از تأیید؟'}
        message={
          isCount
            ? 'با برگشت انبارگردانی، اسناد اصلاح موجودی متصل به این سند نیز ابطال و اثر آن‌ها روی موجودی خنثی می‌شود.'
            : 'با این کار اثر سند روی موجودی خنثی می‌شود و سند به حالت ابطال‌شده می‌رود.'
        }
        confirmText={isCount ? 'برگشت انبارگردانی' : 'برگشت از تأیید'}
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
