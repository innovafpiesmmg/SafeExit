import { useEffect, useRef } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications(isAuthenticated: boolean, userId: number | null) {
  const lastUserIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (window.location.protocol !== "https:") return;

    if (!isAuthenticated || !userId) {
      if (lastUserIdRef.current !== null) {
        lastUserIdRef.current = null;
      }
      return;
    }

    if (userId === lastUserIdRef.current) return;
    lastUserIdRef.current = userId;

    ensureSubscription();
  }, [isAuthenticated, userId]);
}

async function ensureSubscription() {
  try {
    if (Notification.permission !== "granted") return;

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const res = await fetch("/api/push/vapid-public-key");
      const { publicKey } = await res.json();
      if (!publicKey) return;

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      console.log("[PUSH] Created new push subscription");
    }

    const subJson = subscription.toJSON();
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subJson.endpoint, keys: subJson.keys }),
      credentials: "include",
    });
    if (res.ok) {
      console.log("[PUSH] Subscription registered with server");
    } else {
      console.error("[PUSH] Server rejected subscription:", res.status);
    }
  } catch (err) {
    console.error("[PUSH] ensureSubscription failed:", err);
  }
}
