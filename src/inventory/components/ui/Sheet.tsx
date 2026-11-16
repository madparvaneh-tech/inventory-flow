import { useEffect, type ReactNode, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import {
  subscribeOverlayHost,
  getOverlayHost,
  getOverlayHostServerSnapshot,
} from '../layout/overlayHost';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxHeight?: string;
  footer?: ReactNode;
}

export function Sheet({ open, onClose, title, children, maxHeight = '85%', footer }: SheetProps) {
  // اتصال به میزبان پورتال داخل قاب گوشی (موقعیت ثابت مستقل از اسکرول)
  const host = useSyncExternalStore(
    subscribeOverlayHost,
    getOverlayHost,
    getOverlayHostServerSnapshot
  );

  // قفل اسکرول پس‌زمینه
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // اگر بسته است، اصلاً رندر نشود — جلوی هرگونه اثر روی layout را می‌گیرد
  if (!open) return null;

  const content = (
    <>
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px] z-40 pointer-events-auto"
      />
      <div
        className="absolute bottom-0 left-0 right-0 z-50 bg-cream dark:bg-[#0E0D0B] rounded-t-[24px] shadow-[0_-10px_40px_rgba(0,0,0,0.2)] flex flex-col animate-[slideUp_350ms_cubic-bezier(.32,.72,0,1)] pointer-events-auto"
        style={{ maxHeight }}
      >
        <div className="w-10 h-1 bg-black/10 dark:bg-cream/15 rounded-full mx-auto mt-2.5 mb-1 flex-shrink-0" />
        {title && (
          <div className="px-4 pb-2 flex justify-between items-center flex-shrink-0">
            <h2 className="text-base font-extrabold text-ink dark:text-cream">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-btn bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 flex items-center justify-center text-ink dark:text-cream"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto scrollbar-hide pb-4">{children}</div>
        {footer && <div className="flex-shrink-0">{footer}</div>}
      </div>
    </>
  );

  if (!host) return content;
  return createPortal(content, host);
}
