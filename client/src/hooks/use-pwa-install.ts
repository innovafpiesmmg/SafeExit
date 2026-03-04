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

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isInStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;
}

export function usePwaInstall() {
  const [canInstallNative, setCanInstallNative] = useState(!!deferredPrompt);
  const [isInstalled, setIsInstalled] = useState(isInStandaloneMode());
  const [showIosPrompt, setShowIosPrompt] = useState(false);

  useEffect(() => {
    const update = () => {
      setCanInstallNative(!!deferredPrompt);
      setIsInstalled(isInStandaloneMode());
    };
    listeners.add(update);
    update();

    if (isIos() && !isInStandaloneMode()) {
      setShowIosPrompt(true);
    }

    return () => { listeners.delete(update); };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      deferredPrompt = null;
      setCanInstallNative(false);
      setIsInstalled(true);
    }
    return outcome === "accepted";
  };

  const dismiss = () => {
    sessionStorage.setItem("safeexit_pwa_dismissed", "1");
    setCanInstallNative(false);
    setShowIosPrompt(false);
  };

  const wasDismissed = typeof window !== "undefined" && sessionStorage.getItem("safeexit_pwa_dismissed") === "1";

  const canInstall = !isInstalled && !wasDismissed && (canInstallNative || showIosPrompt);

  return {
    canInstall,
    isInstalled,
    isIos: isIos(),
    install,
    dismiss,
  };
}
