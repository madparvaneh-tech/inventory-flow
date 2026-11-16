// اعداد را با کاما و همیشه انگلیسی نمایش می‌دهد
export function fmt(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined || isNaN(n)) return '0';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

// نمایش خلاصه (K و M)
export function fmtShort(n: number): string {
  if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return fmt(n);
}

// تبدیل ارقام فارسی/عربی به انگلیسی
export function toEnglishDigits(str: string): string {
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  const arabic = '٠١٢٣٤٥٦٧٨٩';
  return str.replace(/[۰-۹٠-٩]/g, (d) => {
    const pi = persian.indexOf(d);
    if (pi >= 0) return String(pi);
    const ai = arabic.indexOf(d);
    if (ai >= 0) return String(ai);
    return d;
  });
}

// پارس عدد از ورودی کاربر
export function parseNum(str: string): number {
  const cleaned = toEnglishDigits(str).replace(/,/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}