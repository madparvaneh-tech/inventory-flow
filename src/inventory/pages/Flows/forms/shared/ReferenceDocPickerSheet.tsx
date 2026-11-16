import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../../lib/db';
import { Sheet } from '../../../../components/ui/Sheet';
import { Icon } from '../../../../components/ui/Icon';
import { Badge } from '../../../../components/ui/Badge';
import { fmt } from '../../../../lib/format';
import { formatTime } from '../../../../lib/jalali';
import type { Document } from '../../../../types';

const ISSUE_TYPE_LABELS: Record<string, string> = {
  sale: 'فروش',
  consumption: 'مصرف',
  consignment: 'امانی',
  other: 'سایر',
};

interface ReferenceDocPickerSheetProps {
  open: boolean;
  onClose: () => void;
  onPick: (doc: Document) => void;
  excludeDocId?: string;
}

// انتخابگر سند مرجع برگشت — فقط حواله‌های تأییدشده و قابل برگشت
export function ReferenceDocPickerSheet({
  open,
  onClose,
  onPick,
  excludeDocId,
}: ReferenceDocPickerSheetProps) {
  const issueDocs = useLiveQuery(async () => {
    const docs = await db.documents
      .where('type')
      .equals('issue')
      .filter((d) => d.status === 'confirmed' && d.id !== excludeDocId)
      .toArray();
    return docs.sort((a, b) => b.dateEpoch - a.dateEpoch);
  }, [open, excludeDocId]) ?? [];

  const warehouses = useLiveQuery(() => db.warehouses.toArray(), []) ?? [];
  const stores = useLiveQuery(() => db.stores.toArray(), []) ?? [];

  const lineCounts = useLiveQuery(async () => {
    const ids = issueDocs.map((d) => d.id);
    const map: Record<string, number> = {};
    for (const id of ids) {
      map[id] = await db.documentLines.where('documentId').equals(id).count();
    }
    return map;
  }, [issueDocs]) ?? {};

  return (
    <Sheet open={open} onClose={onClose} title="انتخاب سند مرجع (حواله)" maxHeight="85%">
      <div className="px-4 pb-2 text-[10.5px] text-muted-light dark:text-muted-dark flex items-start gap-1.5">
        <Icon name="warning" size={12} className="text-orange flex-shrink-0 mt-[1px]" />
        <span>فقط حواله‌های تأییدشده به‌عنوان سند مرجع برگشت قابل انتخاب هستند.</span>
      </div>
      <div className="px-4 flex flex-col gap-2 pb-4">
        {issueDocs.length === 0 && (
          <div className="text-center py-8 text-[11.5px] text-muted-light dark:text-muted-dark">
            حواله تأییدشده‌ای یافت نشد
          </div>
        )}
        {issueDocs.map((d) => {
          const wh = warehouses.find((w) => w.id === d.sourceWarehouseId);
          const store = stores.find((s) => s.id === d.storeId);
          return (
            <button
              key={d.id}
              onClick={() => {
                onPick(d);
                onClose();
              }}
              className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card p-3 flex items-center gap-3 text-right transition-all active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-btn bg-orange-soft text-orange flex items-center justify-center flex-shrink-0">
                <Icon name="minus" size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[12.5px] font-bold text-ink dark:text-cream">
                    حواله #{d.number}
                  </span>
                  {d.issueType && (
                    <Badge variant="muted" size="sm">
                      {ISSUE_TYPE_LABELS[d.issueType] ?? d.issueType}
                    </Badge>
                  )}
                </div>
                <div className="text-[10px] text-muted-light dark:text-muted-dark mt-0.5 flex flex-wrap gap-x-2">
                  <span>{d.dateJalali}</span>
                  {wh && <span>• {wh.name}</span>}
                  {store && <span>• {store.name}</span>}
                </div>
                <div className="text-[10px] text-muted-light dark:text-muted-dark mt-0.5">
                  {lineCounts[d.id] ?? 0} قلم • {formatTime(d.dateEpoch)}
                </div>
              </div>
              <div className="text-left flex-shrink-0">
                <div className="text-[12px] font-extrabold text-orange">{fmt(d.totalAmount)}</div>
                <div className="text-[9px] text-muted-light dark:text-muted-dark mt-0.5">ریال</div>
              </div>
              <Icon name="chevron-left" size={16} className="text-muted-light dark:text-muted-dark flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
