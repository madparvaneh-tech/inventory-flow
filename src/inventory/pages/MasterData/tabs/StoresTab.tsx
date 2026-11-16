import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../lib/db';
import { saveStore, deleteStore } from '../../../lib/masterData';
import { Icon } from '../../../components/ui/Icon';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';
import { SegmentedToggle } from '../../../components/ui/SegmentedToggle';
import { EntitySheet } from '../../../components/ui/EntitySheet';

interface StoreFormState {
  name: string;
  code: string;
  isActive: boolean;
}

const EMPTY_FORM: StoreFormState = { name: '', code: '', isActive: true };

export function StoresTab() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StoreFormState>(EMPTY_FORM);

  const stores = useLiveQuery(() => db.stores.toArray(), []) ?? [];
  const warehouses = useLiveQuery(() => db.warehouses.toArray(), []) ?? [];

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setSheetOpen(true);
  };

  const openEdit = (id: string) => {
    const s = stores.find((x) => x.id === id);
    if (!s) return;
    setForm({ name: s.name, code: s.code, isActive: s.isActive });
    setEditingId(s.id);
    setSheetOpen(true);
  };

  const handleSave = async () => {
    await saveStore({
      id: editingId ?? undefined,
      name: form.name,
      code: form.code,
      isActive: form.isActive,
    });
  };

  const handleDelete = async () => {
    if (!editingId) return;
    await deleteStore(editingId);
  };

  const canSave = !!(form.name.trim() && form.code.trim());

  return (
    <div className="px-5">
      <button
        onClick={openCreate}
        className="w-full bg-orange text-white rounded-btn py-3 font-bold text-[12.5px] flex items-center justify-center gap-1.5 mb-3 transition-all active:scale-[0.98] shadow-[0_6px_20px_rgba(217,84,30,0.35)]"
      >
        <Icon name="plus" size={15} />
        فروشگاه جدید
      </button>

      <div className="flex flex-col gap-2 pb-4">
        {stores.map((s) => {
          const whCount = warehouses.filter((w) => w.storeId === s.id).length;
          return (
            <button
              key={s.id}
              onClick={() => openEdit(s.id)}
              className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card p-3 shadow-card flex items-center gap-3 text-right w-full transition-all active:scale-[0.98]"
            >
              <div className="w-11 h-11 rounded-btn bg-orange-soft text-orange flex items-center justify-center flex-shrink-0">
                <Icon name="store" size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-ink dark:text-cream">{s.name}</div>
                <div className="text-[10.5px] text-muted-light dark:text-muted-dark mt-0.5">
                  کد: {s.code} • {whCount} انبار
                </div>
              </div>
              {s.isActive ? (
                <Badge variant="success" size="sm">فعال</Badge>
              ) : (
                <Badge variant="muted" size="sm">غیرفعال</Badge>
              )}
              <Icon name="chevron-left" size={14} className="text-muted-light dark:text-muted-dark flex-shrink-0" />
            </button>
          );
        })}
      </div>

      <EntitySheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editingId ? 'ویرایش فروشگاه' : 'فروشگاه جدید'}
        onSave={handleSave}
        onDelete={editingId ? handleDelete : undefined}
        deleteTitle="حذف فروشگاه؟"
        deleteMessage="فروشگاه‌های دارای انبار یا سند ثبت‌شده قابل حذف نیستند."
        canSave={canSave}
      >
        <Input
          label="نام فروشگاه"
          required
          leadingIcon={<Icon name="store" size={14} />}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="مثلاً فروشگاه مرکزی"
        />
        <Input
          label="کد فروشگاه"
          required
          leadingIcon={<Icon name="tag" size={14} />}
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
          placeholder="مثلاً S001"
        />
        <div>
          <div className="text-[10px] font-semibold text-muted-light dark:text-muted-dark pr-1 mb-1">
            وضعیت
          </div>
          <SegmentedToggle
            value={form.isActive}
            onChange={(v) => setForm({ ...form, isActive: v })}
            trueLabel="فعال"
            falseLabel="غیرفعال"
          />
        </div>
      </EntitySheet>
    </div>
  );
}
