// ============================================================
// چاپ/PDF ریشه‌ای — پورتال مستقل چاپ در body
// - محتوا در جریان عادی صفحه چاپ می‌شود (صفحه‌بندی درست، تکرار سرستون)
// - تشخیص خودکار افقی/عمودی بر اساس عرض تخمینی جدول
// - جدول‌های بسیار عریض به گروه‌های ستونی منطقی تقسیم می‌شوند
// - هیچ ستون، ردیف یا مقداری حذف یا بریده نمی‌شود
// ============================================================

export interface PrintTableInput {
  headers: string[];
  rows: (string | number)[][];
}

export interface PrintPortalInput {
  title: string;
  meta: string[];
  tables: PrintTableInput[];
  orientation?: 'portrait' | 'landscape' | 'auto';
}

// عرض قابل استفادهٔ صفحه A4 در چاپ (px حدودی در ۹۶dpi)
const PORTRAIT_MAX = 660;
const LANDSCAPE_MAX = 1010;
// عرض تقریبی هر کاراکتر در فونت ۱۰.۵px + پدینگ سلول
const CHAR_W = 7.2;
const CELL_PAD = 14;
const MIN_COL_W = 40;

interface ColumnPlan {
  indexes: number[];
  orientation: 'portrait' | 'landscape';
}

function estimateColWidth(headers: string[], rows: PrintTableInput['rows'], col: number): number {
  let maxLen = String(headers[col] ?? '').length;
  for (const r of rows) {
    const len = String(r[col] ?? '').length;
    if (len > maxLen) maxLen = len;
  }
  // متن‌های فارسی فشرده‌تر هستند؛ ضریب ۰.۸۵ روی طول کاراکتر
  return Math.max(MIN_COL_W, Math.min(260, maxLen * CHAR_W * 0.9 + CELL_PAD));
}

function planColumns(
  headers: string[],
  rows: PrintTableInput['rows'],
  keyCols = 1
): ColumnPlan[] {
  const widths = headers.map((_, c) => estimateColWidth(headers, rows, c));
  const total = widths.reduce((s, w) => s + w, 0);

  if (total <= PORTRAIT_MAX) return [{ indexes: headers.map((_, i) => i), orientation: 'portrait' }];
  if (total <= LANDSCAPE_MAX) return [{ indexes: headers.map((_, i) => i), orientation: 'landscape' }];

  // تقسیم منطقی ستون‌ها در حالت افقی — ستون‌های کلیدی (کالا) در همهٔ بخش‌ها تکرار می‌شود
  const keyIdx = headers.map((_, i) => i).slice(0, Math.min(keyCols, headers.length));
  const rest = headers.map((_, i) => i).filter((i) => !keyIdx.includes(i));
  const keyW = keyIdx.reduce((s, i) => s + widths[i], 0);

  const groups: ColumnPlan[] = [];
  let current: number[] = [];
  let currentW = keyW;

  for (const i of rest) {
    if (current.length > 0 && currentW + widths[i] > LANDSCAPE_MAX) {
      groups.push({ indexes: [...keyIdx, ...current], orientation: 'landscape' });
      current = [];
      currentW = keyW;
    }
    current.push(i);
    currentW += widths[i];
  }
  if (current.length > 0 || groups.length === 0) {
    groups.push({ indexes: [...keyIdx, ...current], orientation: 'landscape' });
  }
  return groups;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildTableHtml(headers: string[], rows: PrintTableInput['rows'], indexes: number[]): string {
  const th = indexes.map((i) => `<th>${esc(String(headers[i] ?? ''))}</th>`).join('');
  const trs = rows
    .map((r) => {
      const tds = indexes
        .map((i) => `<td>${esc(String(r[i] ?? ''))}</td>`)
        .join('');
      return `<tr>${tds}</tr>`;
    })
    .join('');
  return `<table dir="rtl"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
}

export function openPrintPortal(input: PrintPortalInput): void {
  closePrintPortal();

  const groups = planColumns(input.tables[0]?.headers ?? [], input.tables[0]?.rows ?? []);
  const orientation =
    input.orientation && input.orientation !== 'auto'
      ? input.orientation
      : groups[0]?.orientation ?? 'portrait';

  // تنظیم جهت صفحه
  let styleEl = document.getElementById('print-page-style') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'print-page-style';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `@page { size: A4 ${orientation}; margin: 12mm 10mm; }`;

  const parts: string[] = [];
  parts.push(`<div class="pp-title">${esc(input.title)}</div>`);
  for (const m of input.meta) {
    parts.push(`<div class="pp-meta">${esc(m)}</div>`);
  }
  parts.push(`<div class="pp-meta">تاریخ تهیه: ${new Date().toLocaleDateString('fa-IR')} • تعداد ردیف: ${input.tables.reduce((s, t) => s + t.rows.length, 0)}</div>`);

  for (const t of input.tables) {
    const planned = planColumns(t.headers, t.rows);
    planned.forEach((g, gi) => {
      if (planned.length > 1) {
        parts.push(
          `<div class="pp-section">بخش ${gi + 1} از ${planned.length} — ستون‌های کلیدی در همهٔ بخش‌ها تکرار می‌شوند</div>`
        );
      }
      parts.push(buildTableHtml(t.headers, t.rows, g.indexes));
    });
  }

  const portal = document.createElement('div');
  portal.id = 'print-portal';
  portal.className = 'print-portal';
  portal.setAttribute('dir', 'rtl');
  portal.innerHTML = parts.join('');
  document.body.appendChild(portal);
}

export function closePrintPortal(): void {
  const existing = document.getElementById('print-portal');
  if (existing) existing.remove();
}
