'use client'

import dynamic from 'next/dynamic'

// اپلیکیشن کامل مدیریت گردش کالا — فقط سمت کلاینت رندر می‌شود (Dexie/IndexedDB)
const InventoryApp = dynamic(
  () => import('@/inventory/InventoryApp').then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen w-full bg-[#ded7c8] flex items-center justify-center">
        <div className="w-10 h-10 border-[3px] border-[#D9541E]/30 border-t-[#D9541E] rounded-full animate-spin" />
      </div>
    ),
  }
)

export default function Home() {
  return <InventoryApp />
}
