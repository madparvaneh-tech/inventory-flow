import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { saveTemplate, deleteTemplate, assignTemplateProducts, productsOfTemplate } from '../../lib/pricingData';
import { TopBar } from '../../components/layout/TopBar';
import { Icon } from '../../components/ui/Icon';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { SegmentedToggle } from '../../components/ui/SegmentedToggle';
import { EntitySheet } from '../../components/ui/EntitySheet';
import { Sheet } from '../../components/ui/Sheet';
import { FeeEditor } from './shared/FeeEditor';
import { COST_BASIS_LABELS } from '../../types';
import type { CalcTemplate, CostBasis, FeeConfig, Product } from '../../types';

// ============================================================
// الگوهای محاسباتی قیمت‌گذاری
// ============================================================

interface TemplateFormState {
  name: string;
  costBasis: CostBasis;
  targetMarginPercent: number;
  sellerDiscountPercent: number;
  platformDiscountPercent: number;
  jointDiscountPercent: number;
  jointSellerSharePercent: number;
  fees: FeeConfig[];
  isDefault: boolean;
  isActive: boolean;
}

const EMPTY_FORM: TemplateFormState = {
  name: '',
  costBasis: 'avg',
  targetMarginPercent: 20,
  sellerDiscountPercent: 0,
  platformDiscountPercent: 0,
  jointDiscountPercent: 0,
  jointSellerSharePercent: 50,
  fees: [],
  isDefault: false,
  isActive: true,
};

export function TemplatesPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateFormState>(EMPTY_FORM);
  const [assignTemplate, setAssignTemplate] = useState<CalcTemplate | null>(null);
  const [assignSelected, setAssignSelected] = useState<Set<string>>(new Set());

  const templates = useLiveQuery(() => db.calcTemplates.toArray(), []) ?? [];
  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];
  const links = useLiveQuery(() => db.templateProducts.toArray(), []) ?? [];

  useEffect(() => {
    if (!assignTemplate) return;
    productsOfTemplate(assignTemplate.id).then((ids) => {
      setAssignSelected(new Set(ids));
    });
  }, [assignTemplate]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setSheetOpen(true);
  };

  const openEdit = (t: CalcTemplate) => {
    setForm({
      name: t.name,
      costBasis: t.costBasis,
      targetMarginPercent: t.targetMarginPercent,
      sellerDiscountPercent: t.sellerDiscountPercent,
      platformDiscountPercent: t.platformDiscountPercent,
      jointDiscountPercent: t.jointDiscountPercent,
      jointSellerSharePercent: t.jointSellerSharePercent,
      fees: t.fees ?? [],
      isDefault: t.isDefault,
      isActive: t.isActive,
    });
    setEditingId(t.id);
    setSheetOpen(true);
  };

  const handleSave = async () => {
    const id = await saveTemplate({
      id: editingId ?? undefined,
      name: form.name,
      costBasis: form.costBasis,
      targetMarginPercent: form.targetMarginPercent,
      sellerDiscountPercent: form.sellerDiscountPercent,
      platformDiscountPercent: form.platformDiscountPercent,
      jointDiscountPercent: form.jointDiscountPercent,
      jointSellerSharePercent: form.jointSellerSharePercent,
      fees: form.fees,
      isDefault: form.isDefault,
      isActive: form.isActive,
    });
    if (!editingId && form.isDefault) {
      // الگوی جدید پیش‌فرض شد — بقیه در saveTemplate غیرپیش‌فرض شده‌اند
      void id;
    }
  };

  const handleDelete = async () => {
    if (!editingId) return;
    await deleteTemplate(editingId);
  };

  const handleAssignSave = async () => {
    if (!assignTemplate) return;
    await assignTemplateProducts(assignTemplate.id, [...assignSelected]);
    setAssignTemplate(null);
  };

  const canSave = !!form.name.trim();

  const connectedCount = (templateId: string) =>
    links.filter((l) => l.templateId === templateId).length;

  return (
    <div className="pb-24">
      <TopBar
        title="الگوهای محاسباتی"
        subtitle="تنظیمات بهای تمام‌شده، تخفیف، هزینه و سود هدف"
        onBack={() => window.history.back()}
        showTheme
      />

      <div className="px-5 pt-3">
        <button
          onClick={openCreate}
          className="w-full bg-orange text-white rounded-btn py-3 font-bold text-[12.5px] flex items-center justify-center gap-1.5 mb-3 transition-all active:scale-[0.98] shadow-[0_6px_20px_rgba(217,84,30,0.35)]"
        >
          <Icon name="plus" size={15} />
          الگوی جدید
        </button>

        <div className="flex flex-col gap-2">
          {templates.length === 0 && (
            <div className="text-center py-10 text-[12px] text-muted-light dark:text-muted-dark">
              هنوز الگویی ثبت نشده است
            </div>
          )}
          {templates.map((t) => (
            <div
              key={t.id}
              role="button"
              tabIndex={0}
              onClick={() => openEdit(t)}
              onKeyDown={(e) => e.key === 'Enter' && openEdit(t)}
              className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card p-3 shadow-card text-right w-full transition-all active:scale-[0.98] cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-btn bg-orange-soft text-orange flex items-center justify-center flex-shrink-0">
                  <Icon name="doc" size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-bold text-ink dark:text-cream flex items-center gap-1.5 flex-wrap">
                    {t.name}
                    {t.isDefault && <Badge variant="orange" size="sm">پیش‌فرض</Badge>}
                    {!t.isActive && <Badge variant="muted" size="sm">غیرفعال</Badge>}
                  </div>
                  <div className="text-[10px] text-muted-light dark:text-muted-dark mt-1 flex flex-wrap gap-x-2">
                    <span>مبنا: {COST_BASIS_LABELS[t.costBasis]}</span>
                    <span>•</span>
                    <span>حاشیهٔ هدف: {t.targetMarginPercent}٪</span>
                    <span>•</span>
                    <span>{(t.fees ?? []).length} هزینهٔ فروش</span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setAssignTemplate(t);
                  }}
                  className="w-9 h-9 rounded-btn bg-black/5 dark:bg-cream/10 text-ink dark:text-cream flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
                  title="کالاهای متصل"
                  aria-label={`کالاهای متصل به ${t.name}`}
                >
                  <Icon name="link" size={15} />
                </button>
                <Icon name="chevron-left" size={14} className="text-muted-light dark:text-muted-dark flex-shrink-0" />
              </div>
              <div className="mt-2 pt-2 border-t border-dashed border-black/5 dark:border-cream/10 text-[10px] text-muted-light dark:text-muted-dark">
                متصل به {connectedCount(t.id)} کالا • تخفیف فروشنده {t.sellerDiscountPercent}٪ • پلتفرم {t.platformDiscountPercent}٪ • مشترک {t.jointDiscountPercent}٪
              </div>
            </div>
          ))}
        </div>
      </div>

      <EntitySheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editingId ? 'ویرایش الگو' : 'الگوی جدید'}
        onSave={handleSave}
        onDelete={editingId ? handleDelete : undefined}
        deleteTitle="حذف الگو؟"
        deleteMessage="الگوهای استفاده‌شده در محاسبات ذخیره‌شده قابل حذف نیستند."
        canSave={canSave}
      >
        <Input
          label="نام الگو"
          required
          leadingIcon={<Icon name="doc" size={14} />}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="مثلاً فروش آنلاین"
        />

        <Select
          label="مبنای بهای تمام‌شده برای قیمت‌گذاری"
          required
          leadingIcon={<Icon name="money" size={14} />}
          value={form.costBasis}
          onChange={(e) => setForm({ ...form, costBasis: e.target.value as CostBasis })}
          options={[
            { value: 'avg', label: COST_BASIS_LABELS.avg },
            { value: 'last_purchase', label: COST_BASIS_LABELS.last_purchase },
            { value: 'replacement', label: COST_BASIS_LABELS.replacement },
          ]}
        />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[10px] font-semibold text-muted-light dark:text-muted-dark pr-1 mb-1">
              حاشیهٔ سود هدف (٪)
            </div>
            <MoneyInput
              value={form.targetMarginPercent}
              onChange={(v) => setForm({ ...form, targetMarginPercent: v })}
              allowDecimals
              suffix="٪"
              ariaLabel="حاشیه سود هدف"
            />
          </div>
          <div>
            <div className="text-[10px] font-semibold text-muted-light dark:text-muted-dark pr-1 mb-1">
              سهم فروشنده از تخفیف مشترک (٪)
            </div>
            <MoneyInput
              value={form.jointSellerSharePercent}
              onChange={(v) => setForm({ ...form, jointSellerSharePercent: v })}
              allowDecimals
              suffix="٪"
              ariaLabel="سهم فروشنده از تخفیف مشترک"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <div>
            <div className="text-[9.5px] font-semibold text-muted-light dark:text-muted-dark pr-1 mb-1">
              تخفیف فروشنده (٪)
            </div>
            <MoneyInput
              value={form.sellerDiscountPercent}
              onChange={(v) => setForm({ ...form, sellerDiscountPercent: v })}
              allowDecimals
              ariaLabel="تخفیف فروشنده"
            />
          </div>
          <div>
            <div className="text-[9.5px] font-semibold text-muted-light dark:text-muted-dark pr-1 mb-1">
              تخفیف پلتفرم (٪)
            </div>
            <MoneyInput
              value={form.platformDiscountPercent}
              onChange={(v) => setForm({ ...form, platformDiscountPercent: v })}
              allowDecimals
              ariaLabel="تخفیف پلتفرم"
            />
          </div>
          <div>
            <div className="text-[9.5px] font-semibold text-muted-light dark:text-muted-dark pr-1 mb-1">
              تخفیف مشترک (٪)
            </div>
            <MoneyInput
              value={form.jointDiscountPercent}
              onChange={(v) => setForm({ ...form, jointDiscountPercent: v })}
              allowDecimals
              ariaLabel="تخفیف مشترک"
            />
          </div>
        </div>

        <FeeEditor fees={form.fees} onChange={(fees) => setForm({ ...form, fees })} />

        <div>
          <div className="text-[10px] font-semibold text-muted-light dark:text-muted-dark pr-1 mb-1">
            الگوی پیش‌فرض سراسری
          </div>
          <SegmentedToggle
            value={form.isDefault}
            onChange={(v) => setForm({ ...form, isDefault: v })}
            trueLabel="بله"
            falseLabel="خیر"
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

      {/* اتصال الگو به کالاها */}
      <Sheet
        open={assignTemplate !== null}
        onClose={() => setAssignTemplate(null)}
        title={`کالاهای متصل: ${assignTemplate?.name ?? ''}`}
        maxHeight="85%"
        footer={
          <div className="px-4 pb-5 pt-3 bg-cream dark:bg-[#0E0D0B] border-t border-black/5 dark:border-cream/10 flex gap-2">
            <button
              onClick={() => setAssignTemplate(null)}
              className="flex-1 py-3 rounded-btn bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 text-[12.5px] font-bold text-ink dark:text-cream"
            >
              انصراف
            </button>
            <button
              onClick={handleAssignSave}
              className="flex-1 py-3 rounded-btn bg-orange text-white text-[12.5px] font-bold flex items-center justify-center gap-1.5"
            >
              <Icon name="check" size={15} />
              ذخیره ({assignSelected.size})
            </button>
          </div>
        }
      >
        <div className="px-4 flex flex-col gap-1.5 pb-4">
          {products.length === 0 && (
            <div className="text-center py-8 text-[11.5px] text-muted-light dark:text-muted-dark">
              کالایی ثبت نشده است
            </div>
          )}
          {products.map((p: Product) => {
            const checked = assignSelected.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => {
                  const next = new Set(assignSelected);
                  if (checked) next.delete(p.id);
                  else next.add(p.id);
                  setAssignSelected(next);
                }}
                className={`w-full rounded-btn p-3 flex items-center gap-2.5 text-right border transition-all ${
                  checked
                    ? 'bg-orange-soft border-orange/30'
                    : 'bg-surface-light dark:bg-surface-dark border-black/5 dark:border-cream/10'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border-[1.5px] ${
                    checked ? 'bg-orange border-orange text-white' : 'border-black/20 dark:border-cream/25'
                  }`}
                >
                  {checked && <Icon name="check" size={12} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-bold text-ink dark:text-cream truncate">{p.name}</div>
                  <div className="text-[9.5px] text-muted-light dark:text-muted-dark mt-0.5">
                    کد: {p.sku}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Sheet>
    </div>
  );
}
