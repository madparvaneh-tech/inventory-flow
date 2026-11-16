import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../lib/db';
import { saveProduct, deleteProduct } from '../../../lib/masterData';
import { registerSalePrice, registerReplacementPrice } from '../../../lib/pricingData';
import { Icon } from '../../../components/ui/Icon';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { SegmentedToggle } from '../../../components/ui/SegmentedToggle';
import { EntitySheet } from '../../../components/ui/EntitySheet';
import { Sheet } from '../../../components/ui/Sheet';
import { fmt } from '../../../lib/format';
import type { Document, DocumentLine, Variant } from '../../../types';

interface ProductFormState {
  name: string;
  sku: string;
  categoryId: string;
  brand: string;
  model: string;
  description: string;
  mainUnitId: string;
  minStock: number;
  reorderPoint: number;
  isActive: boolean;
}

const EMPTY_FORM: ProductFormState = {
  name: '',
  sku: '',
  categoryId: '',
  brand: '',
  model: '',
  description: '',
  mainUnitId: '',
  minStock: 0,
  reorderPoint: 0,
  isActive: true,
};

export function ProductsTab() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [historyProductId, setHistoryProductId] = useState<string | null>(null);
  // قیمت‌های تنوع‌ها (فقط در ویرایش) — salePrice و replacementPrice
  const [variantPrices, setVariantPrices] = useState<Record<string, { salePrice: number; replacementPrice: number }>>({});

  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const units = useLiveQuery(() => db.units.toArray(), []) ?? [];
  const variants = useLiveQuery(() => db.variants.toArray(), []) ?? [];

  // سوابق اصلاح موجودی کالای انتخابی
  const history = useLiveQuery(async () => {
    if (!historyProductId) return null;
    const vs = (await db.variants.where('productId').equals(historyProductId).toArray()) as Variant[];
    const vIds = new Set(vs.map((v) => v.id));
    const adjDocs = await db.documents.where('type').equals('adjustment').toArray();
    const result: { doc: Document; lines: DocumentLine[] }[] = [];
    for (const d of adjDocs) {
      const ls = await db.documentLines
        .where('documentId')
        .equals(d.id)
        .filter((l) => vIds.has(l.variantId))
        .toArray();
      if (ls.length > 0) result.push({ doc: d, lines: ls });
    }
    result.sort((a, b) => (b.doc.confirmedAt ?? b.doc.dateEpoch) - (a.doc.confirmedAt ?? a.doc.dateEpoch));
    return result;
  }, [historyProductId]) ?? null;

  const filtered = products.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return p.name.toLowerCase().includes(s) || p.sku.includes(s);
  });

  const getCategoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? '—';
  const getUnitName = (id: string) => units.find((u) => u.id === id)?.name ?? '—';

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setSheetOpen(true);
  };

  const openEdit = (id: string) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setForm({
      name: p.name,
      sku: p.sku,
      categoryId: p.categoryId,
      brand: p.brand ?? '',
      model: p.model ?? '',
      description: p.description ?? '',
      mainUnitId: p.mainUnitId,
      minStock: p.minStock,
      reorderPoint: p.reorderPoint,
      isActive: p.isActive,
    });
    const vs = variants.filter((v) => v.productId === id);
    const prices: Record<string, { salePrice: number; replacementPrice: number }> = {};
    for (const v of vs) {
      prices[v.id] = {
        salePrice: v.salePrice ?? 0,
        replacementPrice: v.replacementPrice ?? 0,
      };
    }
    setVariantPrices(prices);
    setEditingId(p.id);
    setSheetOpen(true);
  };

  const handleSave = async () => {
    await saveProduct({
      id: editingId ?? undefined,
      name: form.name,
      sku: form.sku,
      categoryId: form.categoryId,
      brand: form.brand.trim() || null,
      model: form.model.trim() || null,
      description: form.description.trim() || null,
      mainUnitId: form.mainUnitId,
      minStock: form.minStock,
      reorderPoint: form.reorderPoint,
      isActive: form.isActive,
    });
    // ذخیرهٔ قیمت‌های تنوع‌ها (تغییر قیمت فروش در تاریخچه ثبت می‌شود)
    for (const [vid, prices] of Object.entries(variantPrices)) {
      await registerSalePrice(vid, prices.salePrice, 'manual', null);
      await registerReplacementPrice(vid, prices.replacementPrice);
    }
  };

  const handleDelete = async () => {
    if (!editingId) return;
    await deleteProduct(editingId);
  };

  const canSave = !!(form.name.trim() && form.sku.trim() && form.categoryId && form.mainUnitId);

  return (
    <div className="px-5">
      {/* Search */}
      <div className="bg-white dark:bg-surface-dark-2 border-[1.5px] border-black/5 dark:border-cream/10 rounded-btn px-3 py-2.5 flex items-center gap-2 mb-3">
        <Icon name="search" size={15} className="text-muted-light dark:text-muted-dark" />
        <input
          type="text"
          placeholder="جستجوی کالا بر اساس نام یا کد..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent border-none outline-none text-[12.5px] font-medium text-ink dark:text-cream placeholder:text-muted-light/60 dark:placeholder:text-muted-dark/60"
        />
      </div>

      {/* Add button */}
      <button
        onClick={openCreate}
        className="w-full bg-orange text-white rounded-btn py-3 font-bold text-[12.5px] flex items-center justify-center gap-1.5 mb-3 transition-all active:scale-[0.98] shadow-[0_6px_20px_rgba(217,84,30,0.35)]"
      >
        <Icon name="plus" size={15} />
        کالای جدید
      </button>

      {/* List */}
      <div className="flex flex-col gap-2 pb-4">
        {filtered.length === 0 && (
          <div className="text-center py-10 text-[12px] text-muted-light dark:text-muted-dark">
            کالایی یافت نشد
          </div>
        )}
        {filtered.map((p) => (
          <div
            key={p.id}
            role="button"
            tabIndex={0}
            onClick={() => openEdit(p.id)}
            onKeyDown={(e) => e.key === 'Enter' && openEdit(p.id)}
            className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card p-3 shadow-card flex items-center gap-3 text-right w-full transition-all active:scale-[0.98] cursor-pointer"
          >
            <div className="w-11 h-11 rounded-btn bg-orange-soft text-orange flex items-center justify-center flex-shrink-0">
              <Icon name="box" size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-ink dark:text-cream truncate">
                {p.name}
              </div>
              <div className="text-[10.5px] text-muted-light dark:text-muted-dark mt-0.5 flex flex-wrap gap-x-2">
                <span>کد: {p.sku}</span>
                <span>•</span>
                <span>{getCategoryName(p.categoryId)}</span>
                <span>•</span>
                <span>{getUnitName(p.mainUnitId)}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              {p.isActive ? (
                <Badge variant="success" size="sm">فعال</Badge>
              ) : (
                <Badge variant="muted" size="sm">غیرفعال</Badge>
              )}
              <span className="text-[9.5px] text-muted-light dark:text-muted-dark">
                حداقل: {p.minStock}
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setHistoryProductId(p.id);
              }}
              className="w-9 h-9 rounded-btn bg-black/5 dark:bg-cream/10 text-ink dark:text-cream flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
              title="سوابق اصلاح موجودی"
              aria-label={`سوابق اصلاح موجودی ${p.name}`}
            >
              <Icon name="history" size={16} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/cost/calculator?product=${p.id}`);
              }}
              className="w-9 h-9 rounded-btn bg-orange-soft text-orange flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
              title="قیمت‌گذاری این کالا"
              aria-label={`قیمت‌گذاری ${p.name}`}
            >
              <Icon name="cost" size={16} />
            </button>
            <Icon name="chevron-left" size={14} className="text-muted-light dark:text-muted-dark flex-shrink-0" />
          </div>
        ))}
      </div>

      <EntitySheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editingId ? 'ویرایش کالا' : 'کالای جدید'}
        onSave={handleSave}
        onDelete={editingId ? handleDelete : undefined}
        deleteTitle="حذف کالا؟"
        deleteMessage="با حذف کالا، تنوع‌ها و ردیف‌های موجودی آن نیز پاک می‌شوند. کالاهای دارای گردش سند قابل حذف نیستند."
        canSave={canSave}
      >
        <Input
          label="نام کالا"
          required
          leadingIcon={<Icon name="box" size={14} />}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="مثلاً کاغذ A4"
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="کد کالا (SKU)"
            required
            leadingIcon={<Icon name="tag" size={14} />}
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
            placeholder="مثلاً 1245"
          />
          <Select
            label="دسته"
            required
            leadingIcon={<Icon name="tag" size={14} />}
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            placeholder="انتخاب کنید"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="برند"
            leadingIcon={<Icon name="store" size={14} />}
            value={form.brand}
            onChange={(e) => setForm({ ...form, brand: e.target.value })}
            placeholder="اختیاری"
          />
          <Input
            label="مدل"
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            placeholder="اختیاری"
          />
        </div>
        <Select
          label="واحد اصلی"
          required
          leadingIcon={<Icon name="list" size={14} />}
          value={form.mainUnitId}
          onChange={(e) => setForm({ ...form, mainUnitId: e.target.value })}
          placeholder="انتخاب کنید"
          options={units.map((u) => ({ value: u.id, label: `${u.name} (${u.symbol})` }))}
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[10px] font-semibold text-muted-light dark:text-muted-dark pr-1 mb-1">
              حداقل موجودی
            </div>
            <MoneyInput
              value={form.minStock}
              onChange={(v) => setForm({ ...form, minStock: v })}
              ariaLabel="حداقل موجودی"
            />
          </div>
          <div>
            <div className="text-[10px] font-semibold text-muted-light dark:text-muted-dark pr-1 mb-1">
              نقطه سفارش
            </div>
            <MoneyInput
              value={form.reorderPoint}
              onChange={(v) => setForm({ ...form, reorderPoint: v })}
              ariaLabel="نقطه سفارش"
            />
          </div>
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
        <Input
          label="توضیحات"
          leadingIcon={<Icon name="note" size={14} />}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="اختیاری"
        />

        {/* قیمت‌های تنوع‌ها — فقط در ویرایش کالای موجود */}
        {editingId && (
          <div className="bg-surface-light-2 dark:bg-surface-dark-2 rounded-btn p-2.5 flex flex-col gap-2">
            <div className="text-[11px] font-bold text-orange flex items-center gap-1">
              <Icon name="money" size={13} />
              قیمت‌های تنوع‌ها (مبنای قیمت‌گذاری)
            </div>
            {variants
              .filter((v) => v.productId === editingId)
              .map((v) => (
                <div key={v.id} className="flex flex-col gap-1.5">
                  <div className="text-[10px] font-bold text-ink dark:text-cream">
                    {v.name} <span className="text-muted-light dark:text-muted-dark font-medium">• کد: {v.sku}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <div className="text-[9px] text-muted-light dark:text-muted-dark font-semibold mb-1 pr-1">
                        قیمت فروش فعلی
                      </div>
                      <MoneyInput
                        value={variantPrices[v.id]?.salePrice ?? 0}
                        onChange={(val) =>
                          setVariantPrices((prev) => ({
                            ...prev,
                            [v.id]: {
                              salePrice: val,
                              replacementPrice: prev[v.id]?.replacementPrice ?? 0,
                            },
                          }))
                        }
                        suffix="ریال"
                        ariaLabel={`قیمت فروش ${v.name}`}
                      />
                    </div>
                    <div>
                      <div className="text-[9px] text-muted-light dark:text-muted-dark font-semibold mb-1 pr-1">
                        قیمت جایگزینی
                      </div>
                      <MoneyInput
                        value={variantPrices[v.id]?.replacementPrice ?? 0}
                        onChange={(val) =>
                          setVariantPrices((prev) => ({
                            ...prev,
                            [v.id]: {
                              salePrice: prev[v.id]?.salePrice ?? 0,
                              replacementPrice: val,
                            },
                          }))
                        }
                        suffix="ریال"
                        ariaLabel={`قیمت جایگزینی ${v.name}`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            {variants.filter((v) => v.productId === editingId).length === 0 && (
              <div className="text-[10px] text-muted-light dark:text-muted-dark">
                پس از ذخیرهٔ کالا، تنوع‌ها قابل قیمت‌گذاری می‌شوند
              </div>
            )}
            <div className="text-[9px] text-muted-light dark:text-muted-dark leading-relaxed">
              قیمت جایگزینی مبنای مستقل قیمت‌گذاری است. تغییر قیمت فروش در تاریخچهٔ قیمت‌ها ثبت می‌شود.
            </div>
          </div>
        )}
      </EntitySheet>

      {/* سوابق اصلاح موجودی */}
      <Sheet
        open={historyProductId !== null}
        onClose={() => setHistoryProductId(null)}
        title="سوابق اصلاح موجودی"
        maxHeight="80%"
      >
        <div className="px-4 pb-4">
          {history !== null && history.length === 0 && (
            <div className="text-center py-10 text-[11.5px] text-muted-light dark:text-muted-dark">
              سابقه اصلاحی برای این کالا ثبت نشده است
            </div>
          )}
          {history !== null && history.length > 0 && (
            <div className="flex flex-col gap-2">
              {history.map(({ doc, lines }) => (
                <div
                  key={doc.id}
                  className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card p-3"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={`w-8 h-8 rounded-btn flex items-center justify-center flex-shrink-0 ${
                        doc.adjustmentDirection === 'decrease'
                          ? 'bg-red-500/10 text-red-600'
                          : 'bg-green-500/10 text-green-700 dark:text-green-400'
                      }`}
                    >
                      <Icon name={doc.adjustmentDirection === 'decrease' ? 'minus' : 'plus'} size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11.5px] font-bold text-ink dark:text-cream flex items-center gap-1.5">
                        {doc.adjustmentDirection === 'decrease' ? 'اصلاح کاهشی' : 'اصلاح افزایشی'} #{doc.number}
                        {doc.status === 'reversed' && (
                          <Badge variant="danger" size="sm">ابطال</Badge>
                        )}
                      </div>
                      <div className="text-[9.5px] text-muted-light dark:text-muted-dark mt-0.5">
                        {doc.dateJalali} • علت: {doc.adjustmentReason ?? '—'}
                        {doc.referenceDocId ? ' • حاصل انبارگردانی' : ''}
                      </div>
                    </div>
                  </div>
                  {lines.map((l) => {
                    const v = variants.find((x) => x.id === l.variantId);
                    return (
                      <div
                        key={l.id}
                        className="flex items-center justify-between py-1.5 border-t border-dashed border-black/5 dark:border-cream/10 text-[10.5px]"
                      >
                        <span className="font-semibold text-ink dark:text-cream truncate max-w-[45%]">
                          {v?.name ?? 'کالا'}
                        </span>
                        <span className="text-muted-light dark:text-muted-dark flex items-center gap-1.5">
                          <span className="font-bold text-ink dark:text-cream">
                            {fmt(l.balanceBefore ?? 0)} ← {fmt(l.balanceAfter ?? 0)}
                          </span>
                          <span
                            className={
                              l.quantity * (doc.adjustmentDirection === 'decrease' ? -1 : 1) < 0
                                ? 'text-red-600 font-bold'
                                : 'text-green-700 dark:text-green-400 font-bold'
                            }
                          >
                            {doc.adjustmentDirection === 'decrease' ? '−' : '+'}
                            {fmt(l.quantity)}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </Sheet>
    </div>
  );
}
