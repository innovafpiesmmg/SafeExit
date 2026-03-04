import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners: Set<() => void> = new Set();

function notify() {
  listeners.forEach(fn => fn());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(!!deferredPrompt);
  const [isInstalled, setIsInstalled] = useState(
    typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches
  );

  useEffect(() => {
    const update = () => {
      setCanInstall(!!deferredPrompt);
      if (!deferredPrompt && !isInstalled) {
        setIsInstalled(window.matchMedia("(display-mode: standalone)").matches);
      }
    };
    listeners.add(update);
    update();
    return () => { listeners.delete(update); };
  }, [isInstalled]);

  const install = async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      deferredPrompt = null;
      setCanInstall(false);
      setIsInstalled(true);
    }
    return outcome === "accepted";
  };

  const dismissed = () => {
    sessionStorage.setItem("safeexit_pwa_dismissed", "1");
    setCanInstall(false);
  };

  const wasDismissed = typeof window !== "undefined" && sessionStorage.getItem("safeexit_pwa_dismissed") === "1";

  return { canInstall: canInstall && !wasDismissed && !isInstalled, isInstalled, install, dismissed };
}
