// ============================================================
// خروجی گزارش‌ها: Excel واقعی (.xlsx) و چاپ/PDF
// ============================================================

export interface ExcelExportInput {
  fileName: string;
  sheetName: string;
  title?: string;
  meta?: string[];
  headers: string[];
  rows: (string | number)[][];
}

// خروجی Excel سمت کلاینت با SheetJS — شیت راست‌به‌چپ
export async function exportToExcel(input: ExcelExportInput): Promise<void> {
  const XLSX = await import('xlsx');

  const aoa: (string | number)[][] = [];
  if (input.title) aoa.push([input.title]);
  if (input.meta && input.meta.length > 0) {
    for (const m of input.meta) aoa.push([m]);
  }
  if (input.title || (input.meta && input.meta.length > 0)) aoa.push([]);
  aoa.push(input.headers);
  aoa.push(...input.rows);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // راست‌به‌چپ کردن شیت (در نسخه‌های پشتیبان‌کننده)
  (ws as unknown as Record<string, unknown>)['!views'] = [{ RTL: true }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, (input.sheetName || 'گزارش').slice(0, 31));
  XLSX.writeFile(wb, `${input.fileName}.xlsx`);
}

// ذخیره آخرین فیلتر اعمال‌شده هر گزارش
export function loadReportFilters<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`report-filters-${key}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<T>;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

export function saveReportFilters(key: string, filters: unknown): void {
  try {
    localStorage.setItem(`report-filters-${key}`, JSON.stringify(filters));
  } catch {
    // حافظه در دسترس نیست — بی‌صدا رد شود
  }
}
