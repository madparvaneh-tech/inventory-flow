import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { TopBar } from '../../components/layout/TopBar';
import { Icon } from '../../components/ui/Icon';
import { Badge } from '../../components/ui/Badge';
import { HubCard } from './components/HubCard';

export function FlowsPage() {
  const navigate = useNavigate();

  const stats = useLiveQuery(async () => {
    const [drafts, inTransit, pendingReturns, totalDocs] = await Promise.all([
      db.documents.where('status').equals('draft').count(),
      db.inventory.where('status').equals('in-transit').count(),
      db.documents.where('type').equals('return').and((d) => d.status === 'draft').count(),
      db.documents.count(),
    ]);
    return { drafts, inTransit, pendingReturns, totalDocs };
  }, []) ?? { drafts: 0, inTransit: 0, pendingReturns: 0, totalDocs: 0 };

  return (
    <div className="pb-24">
      <TopBar
        title="گردش کالا"
        subtitle="مدیریت عملیات و اطلاعات پایه"
        showTheme
      />

      {/* هشدار پیش‌نویس‌ها */}
      {stats.drafts > 0 && (
        <div className="px-5 pt-3">
          <button
            onClick={() => navigate('/records?status=draft')}
            className="w-full bg-orange-soft border border-orange/20 rounded-card p-3 flex items-center gap-2.5 text-right"
          >
            <div className="w-9 h-9 rounded-btn bg-orange text-white flex items-center justify-center flex-shrink-0">
              <Icon name="draft" size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-bold text-ink dark:text-cream">
                {stats.drafts} سند پیش‌نویس در انتظار تأیید
              </div>
              <div className="text-[10.5px] text-muted-light dark:text-muted-dark mt-0.5">
                برای تأیید یا ویرایش ضربه بزنید
              </div>
            </div>
            <Icon name="chevron-left" size={16} className="text-orange flex-shrink-0" />
          </button>
        </div>
      )}

      {/* عملیات اصلی */}
      <div className="px-5 pt-4">
        <div className="flex items-center gap-1.5 mb-3">
          <Icon name="flow" size={14} className="text-orange" />
          <div className="text-[12.5px] font-bold text-ink dark:text-cream">عملیات</div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <HubCard
            icon={<Icon name="plus" size={20} />}
            label="رسید کالا"
            desc="ثبت ورود کالا از تامین‌کننده"
            variant="orange"
            onClick={() => navigate('/flows/receipt/new')}
          />
          <HubCard
            icon={<Icon name="minus" size={20} />}
            label="حواله کالا"
            desc="خروج کالا برای فروش/مصرف"
            variant="ink"
            onClick={() => navigate('/flows/issue/new')}
          />
          <HubCard
            icon={<Icon name="flow" size={20} />}
            label="انتقال"
            desc="بین انبارها یا فروشگاه‌ها"
            variant="ink"
            onClick={() => navigate('/flows/transfer/new')}
          />
          <HubCard
            icon={<Icon name="refresh" size={20} />}
            label="برگشت"
            desc="برگشت از سند مرجع"
            variant="ink"
            onClick={() => navigate('/flows/return/new')}
          />
          <HubCard
            icon={<Icon name="list" size={20} />}
            label="انبارگردانی"
            desc="شمارش و اصلاح مغایرت"
            variant="ink"
            onClick={() => navigate('/flows/count/new')}
          />
          <HubCard
            icon={<Icon name="edit" size={20} />}
            label="اصلاح موجودی"
            desc="افزایش یا کاهش دستی"
            variant="ink"
            onClick={() => navigate('/flows/adjustment/new')}
          />
        </div>
      </div>

      {/* اطلاعات پایه */}
      <div className="px-5 pt-5">
        <div className="flex items-center gap-1.5 mb-3">
          <Icon name="list" size={14} className="text-orange" />
          <div className="text-[12.5px] font-bold text-ink dark:text-cream">اطلاعات پایه</div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <HubCard
            icon={<Icon name="box" size={20} />}
            label="کالاها"
            desc="مدیریت کالا و تنوع"
            variant="orange"
            onClick={() => navigate('/master/products')}
          />
          <HubCard
            icon={<Icon name="tag" size={20} />}
            label="دسته‌بندی"
            desc="ساختار درختی دسته‌ها"
            variant="ink"
            onClick={() => navigate('/master/categories')}
          />
          <HubCard
            icon={<Icon name="list" size={20} />}
            label="واحدها"
            desc="واحدهای اندازه‌گیری"
            variant="ink"
            onClick={() => navigate('/master/units')}
          />
          <HubCard
            icon={<Icon name="warehouse" size={20} />}
            label="انبارها"
            desc="انبارهای هر فروشگاه"
            variant="ink"
            onClick={() => navigate('/master/warehouses')}
          />
          <HubCard
            icon={<Icon name="store" size={20} />}
            label="فروشگاه‌ها"
            desc="مدیریت فروشگاه‌ها"
            variant="ink"
            onClick={() => navigate('/master/stores')}
          />
        </div>
      </div>

      {/* سوابق و گزارش‌ها */}
      <div className="px-5 pt-5">
        <div className="flex items-center gap-1.5 mb-3">
          <Icon name="chart" size={14} className="text-orange" />
          <div className="text-[12.5px] font-bold text-ink dark:text-cream">مرکز اطلاعات</div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <HubCard
            icon={<Icon name="list" size={20} />}
            label="مرکز سوابق"
            desc={`${stats.totalDocs} سند ثبت‌شده`}
            variant="orange"
            onClick={() => navigate('/records')}
          />
          <HubCard
            icon={<Icon name="chart" size={20} />}
            label="گزارش‌ها"
            desc="۵ گزارش مدیریتی"
            variant="orange"
            onClick={() => navigate('/reports')}
          />
        </div>
      </div>

      {/* هشدار انتقال‌های در حال انجام */}
      {stats.inTransit > 0 && (
        <div className="px-5 pt-5">
          <div className="bg-orange-soft border border-orange/20 rounded-card p-3 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-btn bg-orange text-white flex items-center justify-center flex-shrink-0">
              <Icon name="flow" size={18} />
            </div>
            <div className="flex-1">
              <div className="text-[12px] font-bold text-ink dark:text-cream">
                {stats.inTransit} انتقال در حال انجام
              </div>
              <div className="text-[10px] text-muted-light dark:text-muted-dark mt-0.5">
                کالاها در وضعیت «در حال انتقال» هستند
              </div>
            </div>
            <Badge variant="orange" size="sm">در انتظار</Badge>
          </div>
        </div>
      )}
    </div>
  );
}
