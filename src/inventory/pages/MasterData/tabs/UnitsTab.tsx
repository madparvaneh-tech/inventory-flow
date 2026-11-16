import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../lib/db';
import { saveUnit, deleteUnit } from '../../../lib/masterData';
import { Icon } from '../../../components/ui/Icon';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { EntitySheet } from '../../../components/ui/EntitySheet';
import type { Unit } from '../../../types';

const TYPE_LABELS: Record<string, string> = {
  count: 'تعدادی',
  weight: 'وزنی',
  volume: 'حجمی',
  length: 'طولی',
  area: 'سطحی',
  other: 'سایر',
};

const TYPE_OPTIONS = Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }));

interface UnitFormState {
  name: string;
  symbol: string;
  type: Unit['type'];
}

const EMPTY_FORM: UnitFormState = { name: '', symbol: '', type: 'count' };

export function UnitsTab() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UnitFormState>(EMPTY_FORM);

  const units = useLiveQuery(() => db.units.toArray(), []) ?? [];

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setSheetOpen(true);
  };

  const openEdit = (id: string) => {
    const u = units.find((x) => x.id === id);
    if (!u) return;
    setForm({ name: u.name, symbol: u.symbol, type: u.type });
    setEditingId(u.id);
    setSheetOpen(true);
  };

  const handleSave = async () => {
    await saveUnit({
      id: editingId ?? undefined,
      name: form.name,
      symbol: form.symbol,
      type: form.type,
    });
  };

  const handleDelete = async () => {
    if (!editingId) return;
    await deleteUnit(editingId);
  };

  const canSave = !!(form.name.trim() && form.symbol.trim());

  return (
    <div className="px-5">
      <button
        onClick={openCreate}
        className="w-full bg-orange text-white rounded-btn py-3 font-bold text-[12.5px] flex items-center justify-center gap-1.5 mb-3 transition-all active:scale-[0.98] shadow-[0_6px_20px_rgba(217,84,30,0.35)]"
      >
        <Icon name="plus" size={15} />
        واحد جدید
      </button>

      <div className="flex flex-col gap-2 pb-4">
        {units.map((u) => (
          <button
            key={u.id}
            onClick={() => openEdit(u.id)}
            className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card p-3 shadow-card flex items-center gap-3 text-right w-full transition-all active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-btn bg-orange-soft text-orange flex items-center justify-center flex-shrink-0">
              <Icon name="list" size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-ink dark:text-cream">{u.name}</div>
              <div className="text-[10.5px] text-muted-light dark:text-muted-dark mt-0.5">
                نماد: {u.symbol}
              </div>
            </div>
            <Badge variant="orange" size="sm">{TYPE_LABELS[u.type]}</Badge>
            <Icon name="chevron-left" size={14} className="text-muted-light dark:text-muted-dark flex-shrink-0" />
          </button>
        ))}
      </div>

      <EntitySheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editingId ? 'ویرایش واحد' : 'واحد جدید'}
        onSave={handleSave}
        onDelete={editingId ? handleDelete : undefined}
        deleteTitle="حذف واحد؟"
        deleteMessage="واحدهای استفاده‌شده در کالاها قابل حذف نیستند."
        canSave={canSave}
      >
        <Input
          label="نام واحد"
          required
          leadingIcon={<Icon name="list" size={14} />}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="مثلاً عدد"
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="نماد"
            required
            value={form.symbol}
            onChange={(e) => setForm({ ...form, symbol: e.target.value })}
            placeholder="مثلاً kg"
          />
          <Select
            label="نوع"
            required
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as Unit['type'] })}
            options={TYPE_OPTIONS}
          />
        </div>
      </EntitySheet>
    </div>
  );
}
