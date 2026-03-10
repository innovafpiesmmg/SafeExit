import { useEffect, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";

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

    if (!isAuthenticated || !userId) {
      if (lastUserIdRef.current !== null) {
        unsubscribeFromPush();
        lastUserIdRef.current = null;
      }
      return;
    }

    if (userId === lastUserIdRef.current) return;

    lastUserIdRef.current = userId;
    subscribeToPush();
  }, [isAuthenticated, userId]);
}

async function subscribeToPush() {
  try {
    if (window.location.protocol !== "https:") {
      console.log("Push requires HTTPS, skipping subscription");
      return;
    }

    const res = await fetch("/api/push/vapid-public-key");
    const { publicKey } = await res.json();
    if (!publicKey) return;

    const registration = await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const subJson = subscription.toJSON();
      await apiRequest("POST", "/api/push/subscribe", {
        endpoint: subJson.endpoint,
        keys: subJson.keys,
      });
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    const subJson = subscription.toJSON();
    await apiRequest("POST", "/api/push/subscribe", {
      endpoint: subJson.endpoint,
      keys: subJson.keys,
    });
  } catch (err) {
    console.error("Push subscription failed:", err);
  }
}

async function unsubscribeFromPush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      try {
        await apiRequest("POST", "/api/push/unsubscribe", { endpoint });
      } catch {}
    }
  } catch (err) {
    console.error("Push unsubscribe failed:", err);
  }
}
