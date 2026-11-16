import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PhoneFrame } from './components/layout/PhoneFrame';
import { BottomNav } from './components/layout/BottomNav';
import { DashboardPage } from './pages/Dashboard/DashboardPage';
import { FlowsPage } from './pages/Flows/FlowsPage';
import { CostPage } from './pages/Cost/CostPage';
import { MasterDataPage } from './pages/MasterData/MasterDataPage';
import { RecordsPage } from './pages/Records/RecordsPage';
import { ReportsPage } from './pages/Reports/ReportsPage';
import { DocumentDetailPage } from './pages/Documents/DocumentDetailPage';
import { ReceiptForm } from './pages/Flows/forms/ReceiptForm';
import { IssueForm } from './pages/Flows/forms/IssueForm';
import { TransferForm } from './pages/Flows/forms/TransferForm';
import { seedIfEmpty } from './lib/seed';

function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    seedIfEmpty()
      .then(() => setReady(true))
      .catch((err) => {
        console.error('Seed failed:', err);
        setReady(true);
      });
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
    <BrowserRouter>
      <PhoneFrame>
        <div className="flex-1 overflow-y-auto scrollbar-hide pb-24 relative">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/flows" element={<FlowsPage />} />
            <Route path="/cost" element={<CostPage />} />
            <Route path="/master/:tab" element={<MasterDataPageWrapper />} />
            <Route path="/records" element={<RecordsPage />} />
            <Route path="/records/:id" element={<DocumentDetailPage />} />
            <Route path="/reports" element={<ReportsPage />} />

            {/* فرم‌ها */}
            <Route path="/flows/receipt/new" element={<ReceiptForm />} />
            <Route path="/flows/receipt/:id/edit" element={<ReceiptForm />} />
            <Route path="/flows/issue/new" element={<IssueForm />} />
            <Route path="/flows/issue/:id/edit" element={<IssueForm />} />
            <Route path="/flows/transfer/new" element={<TransferForm />} />
            <Route path="/flows/transfer/:id/edit" element={<TransferForm />} />

            {/* placeholders */}
            <Route path="/flows/return/new" element={<Placeholder title="فرم برگشت" />} />
            <Route path="/flows/count/new" element={<Placeholder title="فرم انبارگردانی" />} />
            <Route path="/flows/adjustment/new" element={<Placeholder title="فرم اصلاح موجودی" />} />
          </Routes>
        </div>
        <BottomNav />
      </PhoneFrame>
    </BrowserRouter>
  );
}

function MasterDataPageWrapper() {
  const tab = window.location.pathname.split('/').pop() as any;
  return <MasterDataPage initialTab={tab} />;
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-5">
      <h1 className="text-xl font-extrabold text-ink dark:text-cream">{title}</h1>
      <p className="text-muted-light dark:text-muted-dark text-sm mt-2">
        در بسته چهارم پیاده‌سازی می‌شود
      </p>
    </div>
  );
}

export default App;