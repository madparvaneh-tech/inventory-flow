import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../../components/layout/TopBar';
import { ProductsTab } from './tabs/ProductsTab';
import { CategoriesTab } from './tabs/CategoriesTab';
import { UnitsTab } from './tabs/UnitsTab';
import { WarehousesTab } from './tabs/WarehousesTab';
import { StoresTab } from './tabs/StoresTab';

type TabKey = 'products' | 'categories' | 'units' | 'warehouses' | 'stores';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'products', label: 'کالاها' },
  { key: 'categories', label: 'دسته‌ها' },
  { key: 'units', label: 'واحدها' },
  { key: 'warehouses', label: 'انبارها' },
  { key: 'stores', label: 'فروشگاه‌ها' },
];

interface MasterDataPageProps {
  initialTab?: TabKey;
}

export function MasterDataPage({ initialTab = 'products' }: MasterDataPageProps) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>(initialTab);

  return (
    <div className="pb-24">
      <TopBar
        title="اطلاعات پایه"
        subtitle="مدیریت موجودیت‌های اصلی"
        onBack={() => navigate('/flows')}
        showTheme
      />

      {/* Tab Bar */}
      <div className="sticky top-0 z-10 bg-cream dark:bg-[#0E0D0B] px-3 py-2.5 border-b border-black/5 dark:border-cream/10">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`
                px-3.5 py-1.5 rounded-full text-[11.5px] font-semibold whitespace-nowrap transition-all
                ${tab === t.key
                  ? 'bg-orange text-white shadow-[0_2px_8px_rgba(217,84,30,0.3)]'
                  : 'bg-surface-light dark:bg-surface-dark text-muted-light dark:text-muted-dark border border-black/5 dark:border-cream/10'
                }
              `}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-3">
        {tab === 'products' && <ProductsTab />}
        {tab === 'categories' && <CategoriesTab />}
        {tab === 'units' && <UnitsTab />}
        {tab === 'warehouses' && <WarehousesTab />}
        {tab === 'stores' && <StoresTab />}
      </div>
    </div>
  );
}
