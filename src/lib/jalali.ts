// تبدیل تاریخ میلادی به شمسی (الگوریتم استاندارد)
const g_days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const j_days_in_month = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];

export function toJalali(date: Date): { year: number; month: number; day: number } {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();

  let gy2 = gm > 2 ? gy + 1 : gy;
  let days = 0;

  for (let i = 0; i < gm - 1; i++) days += g_days_in_month[i];
  days += gd - 1;

  let jy = gy2 - 621;

  if (gy2 % 4 === 0) {
    if (days > 78) days -= 1;
  } else {
    if (days > 79) days -= 1;
  }

  let jm = 0;
  let jd = 0;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }

  return { year: jy, month: jm, day: jd };
}

export function toJalaliString(date: Date | number = new Date()): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  const j = toJalali(d);
  return `${j.year}/${String(j.month).padStart(2, '0')}/${String(j.day).padStart(2, '0')}`;
}

// از رشته شمسی به Date
export function jalaliToDate(jStr: string): Date {
  const parts = jStr.split('/').map(Number);
  if (parts.length !== 3) return new Date();
  const [jy, jm, jd] = parts;
  
  const gy = jy + 621;
  let days = 0;
  
  if (jm <= 7) {
    days = (jm - 1) * 31 + (jd - 1);
  } else {
    days = 186 + (jm - 7) * 30 + (jd - 1);
  }
  
  const gDate = new Date(gy, 0, 1);
  const leapAdjust = (gy % 4 === 0 && (gy % 100 !== 0 || gy % 400 === 0)) ? 0 : 1;
  gDate.setDate(gDate.getDate() + days + leapAdjust + 79);
  return gDate;
}

const JALALI_MONTHS = [
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