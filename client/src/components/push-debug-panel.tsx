import { useState } from "react";
import { Bug, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

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

interface StepResult {
  label: string;
  status: "ok" | "fail" | "pending";
  detail: string;
}

export function PushDebugPanel() {
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState<StepResult[]>([]);
  const [running, setRunning] = useState(false);

  const runDiagnostic = async () => {
    setRunning(true);
    const results: StepResult[] = [];

    const addStep = (s: StepResult) => {
      results.push(s);
      setSteps([...results]);
    };

    if (!("serviceWorker" in navigator)) {
      addStep({ label: "Service Worker API", status: "fail", detail: "Tu navegador no soporta Service Workers" });
      setRunning(false);
      return;
    }
    addStep({ label: "Service Worker API", status: "ok", detail: "Disponible" });

    if (!("PushManager" in window)) {
      addStep({ label: "Push API", status: "fail", detail: "Tu navegador no soporta Push API" });
      setRunning(false);
      return;
    }
    addStep({ label: "Push API", status: "ok", detail: "Disponible" });

    if (!("Notification" in window)) {
      addStep({ label: "Notification API", status: "fail", detail: "Tu navegador no soporta Notificaciones" });
      setRunning(false);
      return;
    }
    addStep({ label: "Notification API", status: "ok", detail: `Permiso: ${Notification.permission}` });

    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        addStep({ label: "Service Worker registrado", status: "fail", detail: "No hay SW registrado. Intentando registrar..." });
        try {
          await navigator.serviceWorker.register("/sw.js");
          addStep({ label: "SW re-registrado", status: "ok", detail: "Registrado correctamente" });
        } catch (e: any) {
          addStep({ label: "SW re-registro", status: "fail", detail: e.message });
          setRunning(false);
          return;
        }
      } else {
        addStep({ label: "Service Worker registrado", status: "ok", detail: `Scope: ${reg.scope}, Estado: ${reg.active ? 'activo' : reg.installing ? 'instalando' : reg.waiting ? 'esperando' : 'desconocido'}` });
      }
    } catch (e: any) {
      addStep({ label: "Service Worker", status: "fail", detail: e.message });
      setRunning(false);
      return;
    }

    if (Notification.permission === "default") {
      addStep({ label: "Permiso de notificaciones", status: "pending", detail: "Solicitando permiso..." });
      try {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          addStep({ label: "Permiso de notificaciones", status: "fail", detail: `Permiso: ${perm}` });
          setRunning(false);
          return;
        }
        results[results.length - 1] = { label: "Permiso de notificaciones", status: "ok", detail: "Concedido" };
        setSteps([...results]);
      } catch (e: any) {
        addStep({ label: "Permiso de notificaciones", status: "fail", detail: e.message });
        setRunning(false);
        return;
      }
    } else if (Notification.permission === "denied") {
      addStep({ label: "Permiso de notificaciones", status: "fail", detail: "DENEGADO. Debes habilitarlo en la configuración del navegador" });
      setRunning(false);
      return;
    } else {
      addStep({ label: "Permiso de notificaciones", status: "ok", detail: "Ya concedido" });
    }

    let publicKey = "";
    try {
      const res = await fetch("/api/push/vapid-public-key");
      const data = await res.json();
      publicKey = data.publicKey;
      if (!publicKey) {
        addStep({ label: "VAPID key del servidor", status: "fail", detail: "El servidor no devolvió la clave pública" });
        setRunning(false);
        return;
      }
      addStep({ label: "VAPID key del servidor", status: "ok", detail: `${publicKey.substring(0, 20)}...` });
    } catch (e: any) {
      addStep({ label: "VAPID key del servidor", status: "fail", detail: e.message });
      setRunning(false);
      return;
    }

    let subscription;
    try {
      const registration = await navigator.serviceWorker.ready;
      subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        addStep({ label: "Suscripción push", status: "pending", detail: "Creando nueva suscripción..." });
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
        results[results.length - 1] = { label: "Suscripción push", status: "ok", detail: `Creada: ${subscription.endpoint.substring(0, 60)}...` };
        setSteps([...results]);
      } else {
        addStep({ label: "Suscripción push", status: "ok", detail: `Existente: ${subscription.endpoint.substring(0, 60)}...` });
      }
    } catch (e: any) {
      addStep({ label: "Suscripción push", status: "fail", detail: e.message });
      setRunning(false);
      return;
    }

    try {
      const subJson = subscription.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subJson.endpoint, keys: subJson.keys }),
        credentials: "include",
      });
      if (res.ok) {
        addStep({ label: "Registro en servidor", status: "ok", detail: "Suscripción guardada en el servidor" });
      } else {
        const text = await res.text();
        addStep({ label: "Registro en servidor", status: "fail", detail: `Error ${res.status}: ${text}` });
        setRunning(false);
        return;
      }
    } catch (e: any) {
      addStep({ label: "Registro en servidor", status: "fail", detail: e.message });
      setRunning(false);
      return;
    }

    try {
      const res = await fetch("/api/push/test", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        addStep({ label: "Push de prueba", status: "ok", detail: data.message });
      } else {
        addStep({ label: "Push de prueba", status: "fail", detail: data.message });
      }
    } catch (e: any) {
      addStep({ label: "Push de prueba", status: "fail", detail: e.message });
    }

    setRunning(false);
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "ok") return <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />;
    if (status === "fail") return <XCircle className="w-4 h-4 text-red-600 shrink-0" />;
    return <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0 animate-pulse" />;
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mx-3 mt-2 p-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        data-testid="button-push-debug"
      >
        <Bug className="w-3 h-3" /> Diagnóstico de notificaciones
      </button>
    );
  }

  return (
    <div className="mx-3 mt-2 p-3 rounded-lg border bg-card text-card-foreground" data-testid="panel-push-debug">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-1"><Bug className="w-4 h-4" /> Diagnóstico Push</h3>
        <button onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">Cerrar</button>
      </div>

      <Button size="sm" onClick={runDiagnostic} disabled={running} className="mb-3 w-full" data-testid="button-run-push-diagnostic">
        {running ? "Ejecutando..." : "Ejecutar diagnóstico completo"}
      </Button>

      {steps.length > 0 && (
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <StatusIcon status={step.status} />
              <div>
                <span className="font-medium">{step.label}:</span>{" "}
                <span className="text-muted-foreground break-all">{step.detail}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
