/* ساخت آیکون‌های PWA از تصویر تولیدشده:
 * 1) برش حاشیهٔ کرم دور مربع نارنجی
 * 2) تولید 512 / 192 / maskable-512 / apple-touch / favicon
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'public/icons/icon-1024.png');

async function main() {
  const inset = 88; // حذف حاشیهٔ کرم و گوشه‌های گرد
  const cropped = await sharp(SRC)
    .extract({ left: inset, top: inset, width: 1024 - inset * 2, height: 1024 - inset * 2 })
    .png()
    .toBuffer();

  // نمونه‌رنگ پس‌زمینه از گوشهٔ داخلی
  const raw = await sharp(cropped).raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => {
    const i = (y * raw.info.width + x) * raw.info.channels;
    return [raw.data[i], raw.data[i + 1], raw.data[i + 2]];
  };
  const bg = px(10, 10);
  console.log('bg color:', bg);

  await sharp(cropped).resize(512, 512).png().toFile(path.join(ROOT, 'public/icons/icon-512.png'));
  await sharp(cropped).resize(192, 192).png().toFile(path.join(ROOT, 'public/icons/icon-192.png'));

  // maskable: گلایف در ~۸۰٪ وسط، بقیه رنگ ثابت پس‌زمینه
  const inner = await sharp(cropped).resize(404, 404).png().toBuffer();
  await sharp({
    create: { width: 512, height: 512, channels: 3, background: { r: bg[0], g: bg[1], b: bg[2] } },
  })
    .composite([{ input: inner, top: 54, left: 54 }])
    .png()
    .toFile(path.join(ROOT, 'public/icons/icon-maskable-512.png'));

  // apple-touch-icon (iOS) و favicon اپ‌روتری
  await sharp(cropped).resize(180, 180).png().toFile(path.join(ROOT, 'public/icons/apple-touch-icon.png'));
  const appDir = path.join(ROOT, 'src/app');
  await sharp(cropped).resize(96, 96).png().toFile(path.join(appDir, 'icon.png'));

  console.log('done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
