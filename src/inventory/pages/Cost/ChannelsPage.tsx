import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { saveChannel, deleteChannel } from '../../lib/pricingData';
import { TopBar } from '../../components/layout/TopBar';
import { Icon } from '../../components/ui/Icon';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { SegmentedToggle } from '../../components/ui/SegmentedToggle';
import { EntitySheet } from '../../components/ui/EntitySheet';
import { FeeEditor } from './shared/FeeEditor';
import { fmt } from '../../lib/format';
import type { FeeConfig, SalesChannel } from '../../types';

// ============================================================
// کانال‌های فروش — هر کانال چند هزینه با مبنای مستقل دارد
// ============================================================

interface ChannelFormState {
  name: string;
  isActive: boolean;
  fees: FeeConfig[];
}

const EMPTY_FORM: ChannelFormState = {
  name: '',
  isActive: true,
  fees: [],
};

export function ChannelsPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ChannelFormState>(EMPTY_FORM);

  const channels = useLiveQuery(() => db.salesChannels.toArray(), []) ?? [];
  const docs = useLiveQuery(() => db.documents.toArray(), []) ?? [];

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setSheetOpen(true);
  };

  const openEdit = (c: SalesChannel) => {
    setForm({
      name: c.name,
      isActive: c.isActive,
      fees: (c.fees ?? []).map((f) => ({ ...f })),
    });
    setEditingId(c.id);
    setSheetOpen(true);
  };

  const handleSave = async () => {
    await saveChannel({
      id: editingId ?? undefined,
      name: form.name,
      isActive: form.isActive,
      fees: form.fees,
    });
  };

  const handleDelete = async () => {
    if (!editingId) return;
    await deleteChannel(editingId);
  };

  const salesCount = (channelId: string) =>
    docs.filter((d) => d.type === 'issue' && d.channelId === channelId).length;

  const canSave = !!form.name.trim();

  return (
    <div className="pb-24">
      <TopBar
        title="کانال‌های فروش"
        subtitle="هزینه‌های درصدی و ثابت هر کانال"
        onBack={() => window.history.back()}
        showTheme
      />

      <div className="px-5 pt-3">
        <button
          onClick={openCreate}
          className="w-full bg-orange text-white rounded-btn py-3 font-bold text-[12.5px] flex items-center justify-center gap-1.5 mb-3 transition-all active:scale-[0.98] shadow-[0_6px_20px_rgba(217,84,30,0.35)]"
        >
          <Icon name="plus" size={15} />
          کانال جدید
        </button>

        <div className="flex flex-col gap-2">
          {channels.length === 0 && (
            <div className="text-center py-10 text-[12px] text-muted-light dark:text-muted-dark">
              هنوز کانالی ثبت نشده است
            </div>
          )}
          {channels.map((c) => (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              onClick={() => openEdit(c)}
              onKeyDown={(e) => e.key === 'Enter' && openEdit(c)}
              className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card p-3 shadow-card text-right w-full transition-all active:scale-[0.98] cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-btn bg-orange-soft text-orange flex items-center justify-center flex-shrink-0">
                  <Icon name="store" size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-bold text-ink dark:text-cream flex items-center gap-1.5 flex-wrap">
                    {c.name}
                    {!c.isActive && <Badge variant="muted" size="sm">غیرفعال</Badge>}
                  </div>
                  <div className="text-[10px] text-muted-light dark:text-muted-dark mt-1 flex flex-wrap gap-x-2">
                    <span>{(c.fees ?? []).length} هزینهٔ فروش</span>
                    <span>•</span>
                    <span>{salesCount(c.id)} حوالهٔ فروش</span>
                  </div>
                </div>
                <Icon name="chevron-left" size={14} className="text-muted-light dark:text-muted-dark flex-shrink-0" />
              </div>

              {(c.fees ?? []).length > 0 && (
                <div className="mt-2 pt-2 border-t border-dashed border-black/5 dark:border-cream/10 flex flex-col gap-1">
                  {c.fees.map((f) => (
                    <div key={f.id} className="flex justify-between text-[10px]">
                      <span className="text-muted-light dark:text-muted-dark truncate max-w-[60%]">
                        {f.title}
                      </span>
                      <span className="font-bold text-ink dark:text-cream">
                        {f.calcType === 'percent' ? `${f.value}٪` : `${fmt(f.value)} ریال`}
                        {' '}
                        {f.calcType === 'percent' ? 'از مبلغ' : '/ واحد'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <EntitySheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editingId ? 'ویرایش کانال' : 'کانال جدید'}
        onSave={handleSave}
        onDelete={editingId ? handleDelete : undefined}
        deleteTitle="حذف کانال؟"
        deleteMessage="کانال‌های استفاده‌شده در حواله‌های فروش یا محاسبات ذخیره‌شده قابل حذف نیستند."
        canSave={canSave}
      >
        <Input
          label="نام کانال"
          required
          leadingIcon={<Icon name="store" size={14} />}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="مثلاً دیجی‌کالا"
        />

        <FeeEditor fees={form.fees} onChange={(fees) => setForm({ ...form, fees })} />

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
