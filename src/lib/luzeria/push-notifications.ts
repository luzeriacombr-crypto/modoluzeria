// OneSignal Web Push integration
// Docs: https://documentation.onesignal.com/docs/web-push-quickstart

declare global {
  interface Window {
    OneSignalDeferred?: ((OneSignal: any) => void)[];
  }
}

export function initOneSignal(appId: string) {
  if (typeof window === "undefined") return;
  window.OneSignalDeferred = window.OneSignalDeferred ?? [];
  window.OneSignalDeferred.push(async (OneSignal: any) => {
    await OneSignal.init({
      appId,
      notifyButton: { enable: false },
      allowLocalhostAsSecureOrigin: true,
    });
  });
}

export async function setOneSignalUserId(userId: string) {
  if (typeof window === "undefined") return;
  window.OneSignalDeferred = window.OneSignalDeferred ?? [];
  window.OneSignalDeferred.push(async (OneSignal: any) => {
    await OneSignal.login(userId);
  });
}

/** Must run on sign-out, before supabase.auth.signOut(). Without this,
 * OneSignal's external ID stays tied to this device/browser — the next
 * person who logs in on the same device can keep receiving the previous
 * user's push notifications (or vice versa) until login() overwrites it,
 * which OneSignal doesn't guarantee happens cleanly without a prior logout(). */
export async function clearOneSignalUserId() {
  if (typeof window === "undefined") return;
  window.OneSignalDeferred = window.OneSignalDeferred ?? [];
  window.OneSignalDeferred.push(async (OneSignal: any) => {
    await OneSignal.logout();
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export function getMobileOS(): "ios" | "android" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

/** iOS Safari only supports Web Push when the site was added to the Home
 * Screen and is running standalone (no browser chrome) — asking for
 * permission from a regular Safari tab silently does nothing on iOS. */
export function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true;
}
