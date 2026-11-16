// رجیستری میزبان پورتال‌ها داخل قاب گوشی
// Sheet و ConfirmDialog از طریق useSyncExternalStore به آن متصل می‌شوند

let host: HTMLElement | null = null;
const listeners = new Set<() => void>();

export function setOverlayHost(el: HTMLElement | null) {
  host = el;
  listeners.forEach((l) => l());
}

export function subscribeOverlayHost(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getOverlayHost(): HTMLElement | null {
  return host;
}

export function getOverlayHostServerSnapshot(): HTMLElement | null {
  return null;
}
