import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export function PushPermissionBanner() {
  const [visible, setVisible] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (window.location.protocol !== "https:") return;

    if (Notification.permission === "default") {
      const dismissed = sessionStorage.getItem("push_banner_dismissed");
      if (!dismissed) {
        setVisible(true);
      }
    }
  }, []);

  const handleEnable = async () => {
    setRequesting(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        const res = await fetch("/api/push/vapid-public-key");
        const { publicKey } = await res.json();
        if (publicKey) {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
          const subJson = subscription.toJSON();
          await apiRequest("POST", "/api/push/subscribe", {
            endpoint: subJson.endpoint,
            keys: subJson.keys,
          });
        }
      }
      setVisible(false);
    } catch (err) {
      console.error("Push permission error:", err);
      setVisible(false);
    }
    setRequesting(false);
  };

  const handleDismiss = () => {
    sessionStorage.setItem("push_banner_dismissed", "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="mx-3 mt-2 p-3 rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 flex items-center gap-3" data-testid="banner-push-permission">
      <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Activar notificaciones</p>
        <p className="text-xs text-blue-700 dark:text-blue-300">Recibe avisos y mensajes aunque la app esté cerrada</p>
      </div>
      <Button
        size="sm"
        onClick={handleEnable}
        disabled={requesting}
        data-testid="button-enable-push"
        className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white"
      >
        {requesting ? "..." : "Activar"}
      </Button>
      <button onClick={handleDismiss} className="shrink-0 p-1 text-blue-400 hover:text-blue-600" data-testid="button-dismiss-push">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
