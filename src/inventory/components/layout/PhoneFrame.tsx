import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { setOverlayHost } from './overlayHost';

// تشخیص «حالت اپ»: نصب‌شده به‌صورت PWA (standalone) یا صفحهٔ کوچک موبایل
// در این حالت‌ها اپ مثل یک برنامهٔ استاندارد تمام‌صفحه رندر می‌شود — بدون قاب نمایشی
function detectAppMode(): boolean {
  if (typeof window === 'undefined') return false;
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    (navigator as { standalone?: boolean }).standalone === true; // iOS Safari
  const smallScreen = window.matchMedia('(max-width: 767px)').matches;
  return standalone || smallScreen;
}

export function PhoneFrame({ children }: { children: ReactNode }) {
  const hostRef = useCallback((el: HTMLElement | null) => setOverlayHost(el), []);
  const [appMode, setAppMode] = useState(detectAppMode);

  useEffect(() => {
    const update = () => setAppMode(detectAppMode());
    const queries = [
      window.matchMedia('(display-mode: standalone)'),
      window.matchMedia('(display-mode: fullscreen)'),
      window.matchMedia('(display-mode: minimal-ui)'),
      window.matchMedia('(max-width: 767px)'),
    ];
    queries.forEach((q) => q.addEventListener('change', update));
    return () => queries.forEach((q) => q.removeEventListener('change', update));
  }, []);

  if (appMode) {
    // حالت اپ استاندارد: تمام‌صفحه بدون کادر گوشی (PWA نصب‌شده / موبایل)
    return (
      <div
        dir="rtl"
        lang="fa"
        className="inventory-root h-[100dvh] w-full bg-cream dark:bg-[#0E0D0B] relative flex flex-col overflow-hidden"
      >
        {children}
        {/* میزبان پورتال شیت‌ها و دیالوگ‌ها */}
        <div id="phone-overlay-root" ref={hostRef} className="absolute inset-0 z-40 pointer-events-none" />
      </div>
    );
  }

  // حالت نمایش در مرورگر دسکتاپ: قاب گوشی به‌عنوان ویترین
  return (
    <div dir="rtl" lang="fa" className="inventory-root min-h-screen w-full bg-[#ded7c8] dark:bg-black flex justify-center items-center p-5">
      <div className="w-[390px] h-[844px] bg-cream dark:bg-[#0E0D0B] rounded-[44px] overflow-hidden relative shadow-[0_30px_80px_rgba(0,0,0,0.25),0_0_0_10px_#111] flex flex-col">
        {children}
        {/* میزبان پورتال شیت‌ها و دیالوگ‌ها — تضمین موقعیت ثابت نسبت به قاب گوشی */}
        <div id="phone-overlay-root" ref={hostRef} className="absolute inset-0 z-40 pointer-events-none" />
      </div>
    </div>
  );
}
