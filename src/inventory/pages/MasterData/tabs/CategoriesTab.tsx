import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../lib/db';
import { saveCategory, deleteCategory, getDescendantIds } from '../../../lib/masterData';
import { Icon } from '../../../components/ui/Icon';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { SegmentedToggle } from '../../../components/ui/SegmentedToggle';
import { EntitySheet } from '../../../components/ui/EntitySheet';

interface CategoryFormState {
  name: string;
  code: string;
  parentId: string;
  isActive: boolean;
}

const EMPTY_FORM: CategoryFormState = { name: '', code: '', parentId: '', isActive: true };

interface CategoryNode {
  id: string;
  name: string;
  code: string;
  children: CategoryNode[];
  productCount: number;
}

export function CategoriesTab() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryFormState>(EMPTY_FORM);

  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];

  // ساخت درخت
  const buildTree = (parentId: string | null): CategoryNode[] => {
    return categories
      .filter((c) => c.parentId === parentId)
      .map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        children: buildTree(c.id),
        productCount: products.filter((p) => p.categoryId === c.id).length,
      }));
  };
  const tree = buildTree(null);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setSheetOpen(true);
  };

  const openEdit = (id: string) => {
    const c = categories.find((x) => x.id === id);
    if (!c) return;
    setForm({ name: c.name, code: c.code, parentId: c.parentId ?? '', isActive: c.isActive });
    setEditingId(c.id);
    setSheetOpen(true);
  };

  const handleSave = async () => {
    await saveCategory({
      id: editingId ?? undefined,
      parentId: form.parentId || null,
      name: form.name,
      code: form.code,
      isActive: form.isActive,
    });
  };

  const handleDelete = async () => {
    if (!editingId) return;
    await deleteCategory(editingId);
  };

  const canSave = !!(form.name.trim() && form.code.trim());

  // گزینه‌های والد — حذف خودِ دسته و نوادگانش برای جلوگیری از حلقه
  const forbidden = editingId ? [editingId, ...getDescendantIds(categories, editingId)] : [];
  const parentOptions = categories
    .filter((c) => !forbidden.includes(c.id))
    .map((c) => ({ value: c.id, label: c.name }));

  const renderNode = (node: CategoryNode, depth = 0) => (
    <div key={node.id}>
      <button
        onClick={() => openEdit(node.id)}
        className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card p-3 shadow-card flex items-center gap-3 mb-2 text-right w-full transition-all active:scale-[0.98]"
        style={{ marginRight: `${depth * 16}px` }}
      >
        <div className="w-9 h-9 rounded-btn bg-orange-soft text-orange flex items-center justify-center flex-shrink-0">
          <Icon name="tag" size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-bold text-ink dark:text-cream truncate">
            {node.name}
          </div>
          <div className="text-[10px] text-muted-light dark:text-muted-dark mt-0.5">
            کد: {node.code} • {node.productCount} کالا
          </div>
        </div>
        <Icon name="chevron-left" size={14} className="text-muted-light dark:text-muted-dark flex-shrink-0" />
      </button>
      {node.children.map((c) => renderNode(c, depth + 1))}
    </div>
  );

  return (
    <div className="px-5">
      <button
        onClick={openCreate}
        className="w-full bg-orange text-white rounded-btn py-3 font-bold text-[12.5px] flex items-center justify-center gap-1.5 mb-3 transition-all active:scale-[0.98] shadow-[0_6px_20px_rgba(217,84,30,0.35)]"
      >
        <Icon name="plus" size={15} />
        دسته جدید
      </button>

      <div className="pb-4">
        {tree.length === 0 ? (
          <div className="text-center py-10 text-[12px] text-muted-light dark:text-muted-dark">
            دسته‌ای تعریف نشده
          </div>
        ) : (
          tree.map((n) => renderNode(n))
        )}
      </div>

      <EntitySheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editingId ? 'ویرایش دسته' : 'دسته جدید'}
        onSave={handleSave}
        onDelete={editingId ? handleDelete : undefined}
        deleteTitle="حذف دسته؟"
        deleteMessage="دسته‌های دارای زیرشاخه یا کالا قابل حذف نیستند."
        canSave={canSave}
      >
        <Input
          label="نام دسته"
          required
          leadingIcon={<Icon name="tag" size={14} />}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="مثلاً کاغذ و مقوا"
        />
        <Input
          label="کد دسته"
          required
          leadingIcon={<Icon name="list" size={14} />}
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
          placeholder="مثلاً C001"
        />
        <Select
          label="دسته والد"
          value={form.parentId}
          onChange={(e) => setForm({ ...form, parentId: e.target.value })}
          placeholder="بدون والد (دسته اصلی)"
          options={parentOptions}
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
