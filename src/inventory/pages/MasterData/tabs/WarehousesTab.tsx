import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../lib/db';
import { saveWarehouse, deleteWarehouse } from '../../../lib/masterData';
import { Icon } from '../../../components/ui/Icon';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { SegmentedToggle } from '../../../components/ui/SegmentedToggle';
import { EntitySheet } from '../../../components/ui/EntitySheet';

interface WarehouseFormState {
  storeId: string;
  name: string;
  code: string;
  isDefault: boolean;
  isActive: boolean;
}

const EMPTY_FORM: WarehouseFormState = {
  storeId: '',
  name: '',
  code: '',
  isDefault: false,
  isActive: true,
};

export function WarehousesTab() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WarehouseFormState>(EMPTY_FORM);

  const warehouses = useLiveQuery(() => db.warehouses.toArray(), []) ?? [];
  const stores = useLiveQuery(() => db.stores.toArray(), []) ?? [];

  const getStoreName = (id: string) => stores.find((s) => s.id === id)?.name ?? '—';

  // گروه‌بندی بر اساس فروشگاه
  const grouped = stores.map((s) => ({
    store: s,
    warehouses: warehouses.filter((w) => w.storeId === s.id),
  }));

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, storeId: stores[0]?.id ?? '' });
    setEditingId(null);
    setSheetOpen(true);
  };

  const openEdit = (id: string) => {
    const w = warehouses.find((x) => x.id === id);
    if (!w) return;
    setForm({
      storeId: w.storeId,
      name: w.name,
      code: w.code,
      isDefault: w.isDefault,
      isActive: w.isActive,
    });
    setEditingId(w.id);
    setSheetOpen(true);
  };

  const handleSave = async () => {
    await saveWarehouse({
      id: editingId ?? undefined,
      storeId: form.storeId,
      name: form.name,
      code: form.code,
      isDefault: form.isDefault,
      isActive: form.isActive,
    });
  };

  const handleDelete = async () => {
    if (!editingId) return;
    await deleteWarehouse(editingId);
  };

  const canSave = !!(form.storeId && form.name.trim() && form.code.trim());

  return (
    <div className="px-5">
      <button
        onClick={openCreate}
        className="w-full bg-orange text-white rounded-btn py-3 font-bold text-[12.5px] flex items-center justify-center gap-1.5 mb-3 transition-all active:scale-[0.98] shadow-[0_6px_20px_rgba(217,84,30,0.35)]"
      >
        <Icon name="plus" size={15} />
        انبار جدید
      </button>

      <div className="flex flex-col gap-4 pb-4">
        {grouped.map(({ store, warehouses: whs }) => (
          <div key={store.id}>
            <div className="flex items-center gap-1.5 mb-2 px-1">
              <Icon name="store" size={13} className="text-orange" />
              <span className="text-[11.5px] font-bold text-ink dark:text-cream">{store.name}</span>
              <span className="text-[10px] text-muted-light dark:text-muted-dark">
                ({whs.length} انبار)
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {whs.length === 0 && (
                <div className="text-[11px] text-muted-light dark:text-muted-dark pr-4">
                  انباری تعریف نشده
                </div>
              )}
              {whs.map((w) => (
                <button
                  key={w.id}
                  onClick={() => openEdit(w.id)}
                  className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card p-3 shadow-card flex items-center gap-3 text-right w-full transition-all active:scale-[0.98]"
                >
                  <div className="w-10 h-10 rounded-btn bg-orange-soft text-orange flex items-center justify-center flex-shrink-0">
                    <Icon name="warehouse" size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-ink dark:text-cream">{w.name}</div>
                    <div className="text-[10.5px] text-muted-light dark:text-muted-dark mt-0.5">
                      کد: {w.code}
                    </div>
                  </div>
                  {w.isDefault && <Badge variant="orange" size="sm">پیش‌فرض</Badge>}
                  <Icon name="chevron-left" size={14} className="text-muted-light dark:text-muted-dark flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <EntitySheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editingId ? 'ویرایش انبار' : 'انبار جدید'}
        onSave={handleSave}
        onDelete={editingId ? handleDelete : undefined}
        deleteTitle="حذف انبار؟"
        deleteMessage="انبارهای دارای موجودی یا استفاده‌شده در اسناد قابل حذف نیستند."
        canSave={canSave}
      >
        <Select
          label="فروشگاه"
          required
          leadingIcon={<Icon name="store" size={14} />}
          value={form.storeId}
          onChange={(e) => setForm({ ...form, storeId: e.target.value })}
          placeholder="انتخاب کنید"
          options={stores.map((s) => ({ value: s.id, label: s.name }))}
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="نام انبار"
            required
            leadingIcon={<Icon name="warehouse" size={14} />}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="مثلاً انبار اصلی"
          />
          <Input
            label="کد انبار"
            required
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="مثلاً W001"
          />
        </div>
        <div>
          <div className="text-[10px] font-semibold text-muted-light dark:text-muted-dark pr-1 mb-1">
            انبار پیش‌فرض فروشگاه
          </div>
          <SegmentedToggle
            value={form.isDefault}
            onChange={(v) => setForm({ ...form, isDefault: v })}
            trueLabel="پیش‌فرض"
            falseLabel="عادی"
          />
        </div>
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
