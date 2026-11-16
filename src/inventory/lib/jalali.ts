// تبدیل تاریخ میلادی به شمسی و برعکس — الگوریتم استاندارد و دقیق (Jalaali)
// این پیاده‌سازی مبناي الگوریتم مرجع jalaali-js است و برای تقویم انتخابی
// و اعتبارسنجی تاریخ به‌کار می‌رود.

function div(a: number, b: number): number {
  return ~~(a / b);
}
function mod(a: number, b: number): number {
  return a - ~~(a / b) * b;
}

// نقاط شکست چرخه‌های ۳۳ ساله (دقت برای بازه ۱۱۷۸ تا ۵۳۳۳ شمسی)
const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2061, 2097,
  2492, 2630, 2786, 2830, 2853, 2835, 2933, 2965, 3105, 3147, 3306, 3351,
  3396, 3616, 3712, 3816, 3884, 3962, 4060, 4110, 4175, 4229, 4307, 4357,
  4420, 4461, 4509, 4562, 4620, 4672, 4730, 4772, 4820, 4868, 4916, 4964,
  5012, 5064, 5108, 5113, 5137, 5151, 5169, 5193,
];

interface JalCalResult {
  leap: number;
  gy: number;
  march: number;
}

function jalCal(jy: number): JalCalResult {
  const bl = BREAKS.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];
  let jump = 0;
  if (jy < jp || jy >= BREAKS[bl - 1]) {
    throw new Error('سال شمسی خارج از محدوده پشتیبانی است');
  }
  for (let i = 1; i < bl; i += 1) {
    const jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

// تبدیل تاریخ میلادی به عدد روز (JDN)
function g2d(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

// تبدیل عدد روز به تاریخ میلادی
function d2g(jdn: number): { gy: number; gm: number; gd: number } {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

// تبدیل تاریخ شمسی به عدد روز
function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

// تبدیل عدد روز به تاریخ شمسی
function d2j(jdn: number): { jy: number; jm: number; jd: number } {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let k = jdn - jdn1f;

  if (k >= 0) {
    if (k <= 185) {
      return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

// آیا سال شمسی کبیسه است؟
export function isJalaliLeap(jy: number): boolean {
  return jalCal(jy).leap === 0;
}

// تعداد روزهای یک ماه شمسی
export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeap(jy) ? 30 : 29;
}

// میلادی → شمسی
export function toJalali(date: Date | number = new Date()): {
  year: number;
  month: number;
  day: number;
} {
  const d = typeof date === 'number' ? new Date(date) : date;
  const j = d2j(g2d(d.getFullYear(), d.getMonth() + 1, d.getDate()));
  return { year: j.jy, month: j.jm, day: j.jd };
}

// شمسی → میلادی (نسخه عددی — برای تقویم)
export function jalaliToGregorianDate(jy: number, jm: number, jd: number): Date {
  const g = d2g(j2d(jy, jm, jd));
  return new Date(g.gy, g.gm - 1, g.gd);
}

// از رشته شمسی «YYYY/MM/DD» به Date
export function jalaliToDate(jStr: string): Date {
  const parts = jStr.split('/').map(Number);
  if (parts.length !== 3 || parts.some((p) => isNaN(p))) return new Date();
  return jalaliToGregorianDate(parts[0], parts[1], parts[2]);
}

export function toJalaliString(date: Date | number = new Date()): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  const j = toJalali(d);
  return `${j.year}/${String(j.month).padStart(2, '0')}/${String(j.day).padStart(2, '0')}`;
}

export const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

const WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

export function formatJalaliLong(date: Date | number = new Date()): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  const j = toJalali(d);
  const weekday = WEEKDAYS[d.getDay()];
  return `${weekday}، ${j.day} ${JALALI_MONTHS[j.month - 1]}`;
}

export function formatTime(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export const formatJalaliString = toJalaliString;

// اعتبارسنجی رشته تاریخ شمسی «YYYY/MM/DD» — null یعنی معتبر
export function validateJalaliString(v: string): string | null {
  if (!v) return null;
  const digits = v.replace(/[^0-9]/g, '');
  if (digits.length === 0) return 'تاریخ را وارد کنید';
  if (digits.length < 8) return null; // در حال تایپ — فعلاً خطا نمی‌گیریم
  const y = Number(digits.slice(0, 4));
  const m = Number(digits.slice(4, 6));
  const d = Number(digits.slice(6, 8));
  if (y < 1300 || y > 1500) return 'سال باید بین ۱۳۰۰ تا ۱۵۰۰ باشد';
  if (m < 1 || m > 12) return 'ماه باید بین ۰۱ تا ۱۲ باشد';
  if (d < 1 || d > jalaliMonthLength(y, m)) return 'روز با ماه انتخابی همخوانی ندارد';
  return null;
}
