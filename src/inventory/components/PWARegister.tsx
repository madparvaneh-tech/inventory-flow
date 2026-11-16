'use client'

import { useEffect } from 'react'

// ثبت Service Worker برای نصب‌پذیری PWA و پشتیبانی آفلاین
export default function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // در محیط‌های بدون HTTPS معتبر یا با تداخل، بی‌صدا رد می‌شود
      })
    }

    if (document.readyState === 'complete') {
      register()
    } else {
      window.addEventListener('load', register, { once: true })
    }
  }, [])

  return null
}
