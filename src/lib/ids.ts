export const uid = (): string => crypto.randomUUID();

// پیشوند کوتاه هر نوع سند (فقط برای نمایش، نه شماره)
export const DOC_PREFIX = {
  receipt: 'R',
  issue: 'I',
  transfer: 'T',
  return: 'RT',
  count: 'C',
  adjustment: 'A',
  'status-change': 'S',
} as const;

// تولید شماره سند بعدی — شمارنده مستقل از 1 برای هر نوع
export async function generateDocNumber(
  countFn: () => Promise<number>
): Promise<string> {
  const count = await countFn();
  return String(count + 1);
}