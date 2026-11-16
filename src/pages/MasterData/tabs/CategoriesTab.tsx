import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../lib/db';
import { Icon } from '../../../components/ui/Icon';

interface CategoryNode {
  id: string;
  name: string;
  code: string;
  children: CategoryNode[];
  productCount: number;
}

export function CategoriesTab() {
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

  const renderNode = (node: CategoryNode, depth = 0) => (
    <div key={node.id}>
      <div
        className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card p-3 shadow-card flex items-center gap-3 mb-2"
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
      </div>
      {node.children.map((c) => renderNode(c, depth + 1))}
    </div>
  );

  return (
    <div className="px-5">
      <button
        disabled
        className="w-full bg-orange text-white rounded-btn py-3 font-bold text-[12.5px] flex items-center justify-center gap-1.5 opacity-50 mb-3 cursor-not-allowed"
        title="در فاز بعدی"
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
    </div>
  );
}