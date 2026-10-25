/* Instalación de la PWA: guarda el aviso de instalación de Chrome/Android y detecta la plataforma. */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();

export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as InstallEvent; listeners.forEach(f => f()); });
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach(f => f()); });
}
export const canPrompt = () => !!deferred;
export function onInstallChange(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; }
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  listeners.forEach(f => f());
  return outcome === 'accepted';
}
export function isInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}
export function platform(): 'ios' | 'android' | 'desktop' {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}
/** Pide al navegador que no borre los datos locales (Safari los borra si la web no se usa) */
export async function persistStorage(): Promise<boolean> {
  try { return (await navigator.storage?.persisted?.()) || (await navigator.storage?.persist?.()) || false; } catch { return false; }
}
