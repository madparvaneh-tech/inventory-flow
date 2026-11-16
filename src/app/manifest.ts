import type { MetadataRoute } from "next";

// Manifest اپلیکیشن وب پیش‌رونده (PWA) — قابل نصب روی اندروید/iOS از مرورگر
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "مدیریت گردش کالا",
    short_name: "گردش کالا",
    description:
      "سامانهٔ مدیریت موجودی انبار، حواله‌ها، هزینه‌ها، قیمت‌گذاری و گزارش‌های سودآوری — کاملاً آفلاین",
    dir: "rtl",
    lang: "fa-IR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#DED7C8",
    theme_color: "#D9541E",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
