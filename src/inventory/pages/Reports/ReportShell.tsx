import { type ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../../components/layout/TopBar';
import { Icon } from '../../components/ui/Icon';
import { openPrintPortal, closePrintPortal } from '../../lib/print';

// ============================================================
// شِل مشترک صفحات گزارش
// - نوار خروجی Excel و PDF (چاپ) برای همهٔ گزارش‌ها
// - PDF: پورتال مستقل چاپ با تشخیص خودکار افقی/عمودی، تکرار سرستون
//   و تقسیم منطقی جدول‌های عریض — هیچ ستونی بریده نمی‌شود
// ============================================================

export interface ReportShellProps {
  title: string;
  subtitle?: string;
  filters: ReactNode;
  summary?: ReactNode;
  onExcel: () => void;
  excelBusy?: boolean;
  printTitle: string;
  printMeta: string[];
  printHeaders: string[];
  printRows: (string | number)[][];
  /** جهت صفحهٔ چاپ — auto یعنی بر اساس عرض جدول تشخیص داده شود */
  printOrientation?: 'portrait' | 'landscape' | 'auto';
  children: ReactNode;
}

export function ReportShell({
  title,
  subtitle,
  filters,
  summary,
  onExcel,
  excelBusy,
  printTitle,
  printMeta,
  printHeaders,
  printRows,
  printOrientation = 'auto',
  children,
}: ReportShellProps) {
  const navigate = useNavigate();
  const [printing, setPrinting] = useState(false);

  const handlePrint = () => {
    setPrinting(true);
    try {
      openPrintPortal({
        title: printTitle,
        meta: printMeta,
        tables: [{ headers: printHeaders, rows: printRows }],
        orientation: printOrientation,
      });
      // اجازهٔ رندر پورتال سپس فراخوانی دیالوگ چاپ مرورگر
      setTimeout(() => {
        window.print();
        // پاکسازی پس از بسته شدن دیالوگ
        setTimeout(() => {
          closePrintPortal();
          setPrinting(false);
        }, 500);
      }, 120);
    } catch {
      closePrintPortal();
      setPrinting(false);
    }
  };

  return (
    <div className="pb-24">
      <TopBar title={title} subtitle={subtitle} onBack={() => navigate('/reports')} showTheme />

      {/* دکمه‌های خروجی */}
      <div className="px-5 pt-3 flex gap-2 no-print">
        <button
          onClick={onExcel}
          disabled={excelBusy}
          className="flex-1 py-2.5 rounded-btn bg-green-500/10 text-green-700 dark:text-green-400 text-[11.5px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {excelBusy ? (
            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Icon name="download" size={14} />
          )}
          خروجی Excel
        </button>
        <button
          onClick={handlePrint}
          disabled={printing}
          className="flex-1 py-2.5 rounded-btn bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 text-ink dark:text-cream text-[11.5px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {printing ? (
            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Icon name="print" size={14} />
          )}
          PDF / چاپ
        </button>
      </div>

      {/* فیلترها */}
      <div className="px-5 pt-3 no-print">{filters}</div>

      {/* خلاصه */}
      {summary && <div className="px-5 pt-3 no-print">{summary}</div>}

      {/* محتوای گزارش */}
      <div className="px-5 pt-3 no-print">{children}</div>
    </div>
  );
}

// جدول نمایش گزارش در موبایل — اسکرول افقی و عمودی مستقل داخل باکس خود
// سرستون هنگام اسکرول عمودی ثابت می‌ماند (Sticky Header)
export function ReportTable({
  headers,
  rows,
  minWidth = 640,
  maxHeight,
}: {
  headers: string[];
  rows: ReactNode[][];
  minWidth?: number;
  maxHeight?: number;
}) {
  return (
    <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card shadow-card overflow-hidden">
      <div
        className="overflow-auto"
        style={{ maxHeight: maxHeight ?? 420, overscrollBehavior: 'contain' }}
      >
        <table
          className="w-full text-right [border-collapse:separate] [border-spacing:0]"
          style={{ minWidth }}
        >
          <thead>
            <tr className="bg-surface-light-2 dark:bg-surface-dark-2">
              {headers.map((h, i) => (
                <th
                  key={i}
                  className="sticky top-0 z-10 px-2.5 py-2 text-[9.5px] font-bold text-muted-light dark:text-muted-dark whitespace-nowrap border-b border-black/5 dark:border-cream/10 bg-surface-light-2 dark:bg-surface-dark-2"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} className="border-b border-black/5 dark:border-cream/10 last:border-b-0">
                {r.map((c, ci) => (
                  <td
                    key={ci}
                    className="px-2.5 py-2 text-[10.5px] font-semibold text-ink dark:text-cream whitespace-nowrap"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// چیپ فیلتر
export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3 py-1.5 rounded-full text-[10.5px] font-semibold whitespace-nowrap transition-all flex-shrink-0
        ${
          active
            ? 'bg-ink text-cream dark:bg-orange dark:text-white'
            : 'bg-surface-light dark:bg-surface-dark text-muted-light dark:text-muted-dark border border-black/5 dark:border-cream/10'
        }
      `}
    >
      {children}
    </button>
  );
}

// ردیف خلاصه آماری
export function SummaryBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'up' | 'down' | 'orange';
}) {
  const toneClass =
    tone === 'up'
      ? 'text-green-700 dark:text-green-400'
      : tone === 'down'
        ? 'text-red-600'
        : tone === 'orange'
          ? 'text-orange'
          : 'text-ink dark:text-cream';
  return (
    <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card p-2.5 text-center shadow-card">
      <div className="text-[9.5px] text-muted-light dark:text-muted-dark font-medium">{label}</div>
      <div className={`text-[13px] font-extrabold mt-0.5 ${toneClass}`}>{value}</div>
    </div>
  );
}
