import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";

function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
    setTimeout(() => ctx.close(), 500);
  } catch {}
}

export function useInAppAlert() {
  const { user } = useAuth();
  const isStaff = user && user.role !== "admin";

  const prevUnreadNotifRef = useRef<number | null>(null);
  const prevUnreadChatRef = useRef<number | null>(null);

  const { data: unreadNotifData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 10000,
    enabled: !!isStaff,
  });

  const { data: chatUnreadData } = useQuery<Record<string, number>>({
    queryKey: ["/api/chat/unread-counts"],
    refetchInterval: 10000,
    enabled: !!isStaff,
  });

  const currentNotifCount = unreadNotifData?.count ?? 0;
  const currentChatCount = Object.values(chatUnreadData || {}).reduce((s, v) => s + v, 0);

  useEffect(() => {
    if (!isStaff) return;

    if (prevUnreadNotifRef.current === null) {
      prevUnreadNotifRef.current = currentNotifCount;
      return;
    }

    if (currentNotifCount > prevUnreadNotifRef.current) {
      playAlertSound();
      if (Notification.permission === "granted" && document.hidden) {
        try {
          new Notification("SafeExit — Nuevo aviso", {
            body: "Tienes un nuevo aviso del administrador",
            icon: "/icons/icon-192.png",
            tag: "in-app-notif",
          });
        } catch {}
      }
    }

    prevUnreadNotifRef.current = currentNotifCount;
  }, [currentNotifCount, isStaff]);

  useEffect(() => {
    if (!isStaff) return;

    if (prevUnreadChatRef.current === null) {
      prevUnreadChatRef.current = currentChatCount;
      return;
    }

    if (currentChatCount > prevUnreadChatRef.current) {
      playAlertSound();
      if (Notification.permission === "granted" && document.hidden) {
        try {
          new Notification("SafeExit — Nuevo mensaje", {
            body: "Tienes un nuevo mensaje de chat",
            icon: "/icons/icon-192.png",
            tag: "in-app-chat",
          });
        } catch {}
      }
    }

    prevUnreadChatRef.current = currentChatCount;
  }, [currentChatCount, isStaff]);
}
