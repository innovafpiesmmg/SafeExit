import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { playSuccessSound, playErrorSound } from "@/lib/sounds";
import { PwaInstallBanner } from "@/components/pwa-install-banner";
import {
  Camera, QrCode, ShieldCheck, ShieldX, AlertTriangle,
  RotateCcw, Send, LogOut, Wifi, WifiOff, Settings, ArrowLeft,
} from "lucide-react";

function useCurrentTime() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return time;
}

function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const h1 = () => setOnline(true);
    const h2 = () => setOnline(false);
    window.addEventListener("online", h1);
    window.addEventListener("offline", h2);
    return () => { window.removeEventListener("online", h1); window.removeEventListener("offline", h2); };
  }, []);
  return online;
}

export default function GuardView({ tutorMode }: { tutorMode?: boolean } = {}) {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const now = useCurrentTime();
  const online = useOnlineStatus();

  const [qrInput, setQrInput] = useState("");
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incidentNote, setIncidentNote] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<any>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
    refetchInterval: 60000,
  });

  const autoReturnEnabled = settings?.autoReturnEnabled === "true";
  const autoReturnSeconds = parseInt(settings?.autoReturnSeconds || "5") || 5;

  const { data: stats } = useQuery<{ today: number; authorized: number; denied: number }>({
    queryKey: ["/api/exit-stats"],
    refetchInterval: 30000,
  });

  const resetScan = useCallback(() => {
    setScanResult(null);
    setQrInput("");
    setCountdown(null);
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const startAutoReturn = useCallback(() => {
    if (!autoReturnEnabled) return;
    setCountdown(autoReturnSeconds);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          resetScan();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [autoReturnEnabled, autoReturnSeconds, resetScan]);

  const verifyMutation = useMutation({
    mutationFn: async (qrCode: string) => {
      const res = await apiRequest("POST", "/api/verify", { qrCode });
      return res.json();
    },
    onSuccess: (data) => {
      setScanResult(data);
      if (data.result === "AUTORIZADO") {
        playSuccessSound();
      } else {
        playErrorSound();
      }
      queryClient.invalidateQueries({ queryKey: ["/api/exit-stats"] });
      startAutoReturn();
    },
    onError: (e: any) => {
      playErrorSound();
      toast({ title: "Error de verificación", description: e.message, variant: "destructive" });
    },
  });

  const incidentMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/incidents", data),
    onSuccess: () => {
      toast({ title: "Incidencia registrada" });
      setIncidentOpen(false);
      setIncidentNote("");
    },
  });

  const handleManualScan = useCallback(() => {
    if (!qrInput.trim()) return;
    verifyMutation.mutate(qrInput.trim());
    setQrInput("");
  }, [qrInput, verifyMutation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleManualScan();
    }
  };

  const startCamera = async () => {
    setScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (videoRef.current) {
        const scanner = new Html5Qrcode("guard-qr-reader");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 280, height: 280 } },
          (decodedText) => {
            verifyMutation.mutate(decodedText);
            scanner.stop().catch(() => {});
            setScanning(false);
          },
          () => {}
        );
      }
    } catch {
      toast({ title: "No se pudo acceder a la cámara", variant: "destructive" });
      setScanning(false);
    }
  };

  const stopCamera = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const pauseAutoReturn = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdown(null);
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) scannerRef.current.stop().catch(() => {});
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  useEffect(() => {
    if (!scanResult) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [scanResult]);

  const isAuthorized = scanResult?.result === "AUTORIZADO";

  const timeStr = now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  if (scanResult) {
    return (
      <div
        className={`min-h-[100dvh] flex flex-col ${
          isAuthorized
            ? "bg-emerald-500 dark:bg-emerald-600"
            : "bg-red-500 dark:bg-red-600"
        }`}
        onClick={resetScan}
        data-testid="div-result-fullscreen"
      >
        <div className="flex items-center justify-between px-6 py-3 bg-black/10">
          <div className="flex items-center gap-3 text-white/90">
            <ShieldCheck className="w-6 h-6" />
            <span className="font-bold">SafeExit</span>
          </div>
          <div className="flex items-center gap-4 text-white/80">
            <span className="font-mono text-sm">{timeStr}</span>
            {countdown !== null && (
              <Badge className="bg-white/20 text-white border-white/30 text-sm font-mono" data-testid="badge-countdown">
                {countdown}s
              </Badge>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 text-white">
          {scanResult.student?.photoUrl ? (
            <div className={`w-36 h-36 sm:w-44 sm:h-44 rounded-full overflow-hidden mb-5 border-4 ${
              isAuthorized ? "border-white/40" : "border-white/40"
            } shadow-2xl`}>
              <img
                src={scanResult.student.photoUrl}
                alt={`${scanResult.student.firstName} ${scanResult.student.lastName}`}
                className="w-full h-full object-cover"
                data-testid="img-guard-student-photo"
              />
            </div>
          ) : (
            <div className={`w-32 h-32 sm:w-40 sm:h-40 rounded-full flex items-center justify-center mb-5 bg-white/20`}>
              {isAuthorized
                ? <ShieldCheck className="w-20 h-20 sm:w-24 sm:h-24" />
                : <ShieldX className="w-20 h-20 sm:w-24 sm:h-24" />
              }
            </div>
          )}

          <h1
            className="text-6xl sm:text-8xl md:text-9xl font-black tracking-tight text-center leading-none"
            data-testid="text-guard-result"
          >
            {scanResult.result}
          </h1>

          <p className="text-xl sm:text-2xl mt-4 text-white/80 text-center font-medium" data-testid="text-guard-reason">
            {scanResult.reason}
          </p>

          {scanResult.student && (
            <div className="flex items-center gap-5 mt-6 p-5 rounded-2xl bg-white/15 backdrop-blur-sm max-w-lg w-full">
              <div className="flex-1 text-center">
                <p className="font-bold text-2xl sm:text-3xl leading-tight" data-testid="text-guard-student-name">
                  {scanResult.student.firstName} {scanResult.student.lastName}
                </p>
                <p className="text-lg text-white/70 mt-1">{scanResult.student.course}</p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Badge className="bg-white/20 text-white border-white/30 text-sm">
                    {scanResult.student.age} años
                  </Badge>
                  {scanResult.student.age >= 18 && (
                    <Badge className="bg-white/30 text-white border-white/40 text-sm">+18</Badge>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 mt-8 w-full max-w-lg">
            <Button
              onClick={(e) => { e.stopPropagation(); resetScan(); }}
              className="flex-1 h-16 text-lg font-bold bg-white/20 hover:bg-white/30 text-white border border-white/30"
              variant="ghost"
              data-testid="button-guard-new-scan"
            >
              <RotateCcw className="w-6 h-6 mr-2" />
              Nueva Verificación
            </Button>

            {isAuthorized && (
              <Button
                variant="ghost"
                onClick={(e) => { e.stopPropagation(); pauseAutoReturn(); setIncidentOpen(true); }}
                className="flex-1 h-16 text-lg font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20"
                data-testid="button-guard-incident"
              >
                <AlertTriangle className="w-6 h-6 mr-2" />
                Incidencia
              </Button>
            )}
          </div>

          {countdown !== null && (
            <p className="text-white/60 text-sm mt-4" data-testid="text-auto-return">
              Vuelve automáticamente en {countdown}s — toca para volver ahora
            </p>
          )}
        </div>

        <Dialog open={incidentOpen} onOpenChange={(open) => { setIncidentOpen(open); if (!open && autoReturnEnabled) startAutoReturn(); }}>
          <DialogContent onClick={e => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>Registrar Incidencia</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                data-testid="textarea-guard-incident"
                placeholder="Describe la incidencia..."
                value={incidentNote}
                onChange={e => setIncidentNote(e.target.value)}
                rows={4}
                className="text-base"
              />
              <Button
                onClick={() => incidentMutation.mutate({ exitLogId: scanResult?.logId, note: incidentNote })}
                disabled={!incidentNote.trim() || incidentMutation.isPending}
                className="w-full h-14 text-base font-semibold"
                data-testid="button-guard-submit-incident"
              >
                <Send className="w-5 h-5 mr-2" />
                Enviar Incidencia
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight" data-testid="text-guard-app-name">SafeExit</p>
            <p className="text-xs text-muted-foreground">{user?.fullName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-mono font-bold" data-testid="text-guard-time">{timeStr}</p>
            <p className="text-xs text-muted-foreground capitalize">{dateStr}</p>
          </div>
          <div className="flex items-center gap-1">
            {online
              ? <Wifi className="w-4 h-4 text-emerald-500" />
              : <WifiOff className="w-4 h-4 text-red-500" />
            }
          </div>
          {autoReturnEnabled && (
            <Badge variant="secondary" className="text-[10px] hidden sm:inline-flex" data-testid="badge-auto-return-status">
              Auto {autoReturnSeconds}s
            </Badge>
          )}
          {tutorMode && (
            <Button size="icon" variant="ghost" onClick={() => { sessionStorage.removeItem("safeexit_view_mode"); setLocation("/"); }} data-testid="button-back-tutor" className="min-h-[44px] min-w-[44px]">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <Button size="icon" variant="ghost" onClick={logout} data-testid="button-guard-logout" className="min-h-[44px] min-w-[44px]">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <PwaInstallBanner />

      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 max-w-xl mx-auto w-full">
        <div className="w-full space-y-5">
          <div className="text-center">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <QrCode className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-2xl font-bold" data-testid="text-guard-title">Verificación de Salida</h1>
            <p className="text-muted-foreground text-sm mt-1">Escanea o introduce el código QR del carnet</p>
          </div>

          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  data-testid="input-guard-qr"
                  placeholder="Código QR..."
                  value={qrInput}
                  onChange={e => setQrInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="text-lg h-14"
                  autoFocus
                />
                <Button
                  onClick={handleManualScan}
                  data-testid="button-guard-verify"
                  disabled={verifyMutation.isPending || !qrInput.trim()}
                  className="min-w-[60px] h-14"
                >
                  <ShieldCheck className="w-6 h-6" />
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">o usa la cámara</span>
                </div>
              </div>

              {scanning ? (
                <div className="space-y-3">
                  <div id="guard-qr-reader" ref={videoRef} className="rounded-lg overflow-hidden" />
                  <Button onClick={stopCamera} variant="destructive" className="w-full h-14 text-base font-semibold" data-testid="button-guard-stop-camera">
                    Detener Cámara
                  </Button>
                </div>
              ) : (
                <Button onClick={startCamera} variant="secondary" className="w-full h-14 text-base font-semibold" data-testid="button-guard-start-camera">
                  <Camera className="w-5 h-5 mr-2" />
                  Activar Cámara
                </Button>
              )}
            </CardContent>
          </Card>

          {verifyMutation.isPending && (
            <div className="text-center py-4">
              <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground mt-2">Verificando...</p>
            </div>
          )}

          {stats && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <p className="text-2xl font-bold" data-testid="text-guard-stat-total">{stats.today || 0}</p>
                <p className="text-xs text-muted-foreground">Hoy</p>
              </div>
              <div className="rounded-xl bg-emerald-500/10 p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600" data-testid="text-guard-stat-ok">{stats.authorized || 0}</p>
                <p className="text-xs text-muted-foreground">Permitidas</p>
              </div>
              <div className="rounded-xl bg-red-500/10 p-3 text-center">
                <p className="text-2xl font-bold text-red-600" data-testid="text-guard-stat-denied">{stats.denied || 0}</p>
                <p className="text-xs text-muted-foreground">Denegadas</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
