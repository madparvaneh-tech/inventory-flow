import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { PhoneFrame } from './components/layout/PhoneFrame';
import { BottomNav } from './components/layout/BottomNav';
import { DashboardPage } from './pages/Dashboard/DashboardPage';
import { FlowsPage } from './pages/Flows/FlowsPage';
import { CostPage } from './pages/Cost/CostPage';
import { PriceCalculator } from './pages/Cost/PriceCalculator';
import { TemplatesPage } from './pages/Cost/TemplatesPage';
import { ChannelsPage } from './pages/Cost/ChannelsPage';
import { CalcHistoryPage } from './pages/Cost/CalcHistoryPage';
import { CostSettingsPage } from './pages/Cost/CostSettingsPage';
import { MasterDataPage } from './pages/MasterData/MasterDataPage';
import { RecordsPage } from './pages/Records/RecordsPage';
import { ReportsPage } from './pages/Reports/ReportsPage';
import { StockReport } from './pages/Reports/StockReport';
import { ShortageReport } from './pages/Reports/ShortageReport';
import { DeadStockReport } from './pages/Reports/DeadStockReport';
import { MovementReport } from './pages/Reports/MovementReport';
import { ValueReport } from './pages/Reports/ValueReport';
import { ChannelCompareReport } from './pages/Reports/ChannelCompareReport';
import { TemplateCompareReport } from './pages/Reports/TemplateCompareReport';
import { TemplateProductsReport } from './pages/Reports/TemplateProductsReport';
import { BelowBreakevenReport } from './pages/Reports/BelowBreakevenReport';
import { PriceGapReport } from './pages/Reports/PriceGapReport';
import { PriceHistoryReport, CalcHistoryReport } from './pages/Reports/PriceHistoryReport';
import { CostValueReport } from './pages/Reports/CostValueReport';
import { ProfitAnalysisReport } from './pages/Reports/ProfitAnalysisReport';
import { DocumentDetailPage } from './pages/Documents/DocumentDetailPage';
import { ReceiptForm } from './pages/Flows/forms/ReceiptForm';
import { IssueForm } from './pages/Flows/forms/IssueForm';
import { TransferForm } from './pages/Flows/forms/TransferForm';
import { ReturnForm } from './pages/Flows/forms/ReturnForm';
import { CountForm } from './pages/Flows/forms/CountForm';
import { AdjustmentForm } from './pages/Flows/forms/AdjustmentForm';
import { seedIfEmpty, seedReasonsIfEmpty, seedPricingIfEmpty } from './lib/seed';

export default function InventoryApp() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // کانال‌ها و الگوهای قیمت‌گذاری باید قبل از seed اسناد نمونه موجود باشند
        // (حواله‌های فروش نمونه به کانال دیجی‌کالا ارجاع دارند)
        await seedPricingIfEmpty();
        await seedIfEmpty();
        // علت‌های پیش‌فرض اصلاح موجودی — برای کاربران قدیمی هم seed می‌شود
        await seedReasonsIfEmpty();
      } catch (err) {
        console.error('Seed failed:', err);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  if (!ready) {
    return (
      <PhoneFrame>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-[3px] border-orange/30 border-t-orange rounded-full animate-spin" />
            <div className="text-xs text-muted-light dark:text-muted-dark font-medium">
              در حال بارگذاری...
            </div>
          </div>
        </div>
      </PhoneFrame>
    );
  }

  return (
    <HashRouter>
      <PhoneFrame>
        <div className="flex-1 overflow-y-auto scrollbar-hide relative">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/flows" element={<FlowsPage />} />
            <Route path="/cost" element={<CostPage />} />
            <Route path="/cost/calculator" element={<PriceCalculator />} />
            <Route path="/cost/templates" element={<TemplatesPage />} />
            <Route path="/cost/channels" element={<ChannelsPage />} />
            <Route path="/cost/history" element={<CalcHistoryPage />} />
            <Route path="/cost/settings" element={<CostSettingsPage />} />
            <Route path="/master/:tab" element={<MasterDataPageWrapper />} />
            <Route path="/records" element={<RecordsPage />} />
            <Route path="/records/:id" element={<DocumentDetailPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/reports/stock" element={<StockReport />} />
            <Route path="/reports/low" element={<ShortageReport />} />
            <Route path="/reports/dead" element={<DeadStockReport />} />
            <Route path="/reports/movement" element={<MovementReport />} />
            <Route path="/reports/value" element={<ValueReport />} />
            <Route path="/reports/channel-compare" element={<ChannelCompareReport />} />
            <Route path="/reports/template-compare" element={<TemplateCompareReport />} />
            <Route path="/reports/template-products" element={<TemplateProductsReport />} />
            <Route path="/reports/below-breakeven" element={<BelowBreakevenReport />} />
            <Route path="/reports/price-gap" element={<PriceGapReport />} />
            <Route path="/reports/price-history" element={<PriceHistoryReport />} />
            <Route path="/reports/calc-history" element={<CalcHistoryReport />} />
            <Route path="/reports/cost-value" element={<CostValueReport />} />
            <Route path="/reports/profit-analysis" element={<ProfitAnalysisReport />} />

            {/* فرم‌ها */}
            <Route path="/flows/receipt/new" element={<ReceiptForm />} />
            <Route path="/flows/receipt/:id/edit" element={<ReceiptForm />} />
            <Route path="/flows/issue/new" element={<IssueForm />} />
            <Route path="/flows/issue/:id/edit" element={<IssueForm />} />
            <Route path="/flows/transfer/new" element={<TransferForm />} />
            <Route path="/flows/transfer/:id/edit" element={<TransferForm />} />
            <Route path="/flows/return/new" element={<ReturnForm />} />
            <Route path="/flows/return/:id/edit" element={<ReturnForm />} />
            <Route path="/flows/count/new" element={<CountForm />} />
            <Route path="/flows/count/:id/edit" element={<CountForm />} />
            <Route path="/flows/adjustment/new" element={<AdjustmentForm />} />
            <Route path="/flows/adjustment/:id/edit" element={<AdjustmentForm />} />
          </Routes>
        </div>
        <BottomNav />
      </PhoneFrame>
    </HashRouter>
  );
}

function MasterDataPageWrapper() {
  const { tab } = useParams<{ tab?: string }>();
  const initialTab = (['products', 'categories', 'units', 'warehouses', 'stores'] as const).includes(
    tab as 'products'
  )
    ? (tab as 'products' | 'categories' | 'units' | 'warehouses' | 'stores')
    : 'products';
  return <MasterDataPage initialTab={initialTab} />;
}
