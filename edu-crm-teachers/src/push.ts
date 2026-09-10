import { api } from "./api"

let swReady = false

export type PushEnabled = "on" | "off" | "denied" | "unsupported"

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export function currentPushEnabled(): PushEnabled {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported"
  }
  if (Notification.permission === "granted") return "on"
  if (Notification.permission === "denied") return "denied"
  return "off"
}

async function ensureSubscription(): Promise<boolean> {
  if (!swReady) {
    await navigator.serviceWorker.register("/sw.js").catch(() => null)
    swReady = true
  }
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    const { public_key } = await api.pushVapidPublic()
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(public_key),
    })
  }
  const info = sub.toJSON()
  const keys = (info.keys || {}) as { p256dh?: string; auth?: string }
  await api.pushSubscribe(info.endpoint || "", keys.p256dh || "", keys.auth || "")
  return true
}

/** Tugma bosilganda chaqiriladi — bildirishnoma ruxsatini so'raydi va obuna qiladi. */
export async function enablePush(): Promise<boolean> {
  if (currentPushEnabled() === "unsupported") return false
  try {
    if (Notification.permission !== "granted") {
      const result = await Notification.requestPermission()
      if (result !== "granted") return false
    }
    await ensureSubscription()
    return true
  } catch {
    return false
  }
}

/** Ruxsat allaqachon berilgan bo'lsa, mavjud obunani joriy foydalanuvchiga bog'laydi. */
export async function syncExistingPush(): Promise<void> {
  if (currentPushEnabled() !== "on") return
  try {
    await ensureSubscription()
  } catch {
    // jim o'tamiz
  }
}