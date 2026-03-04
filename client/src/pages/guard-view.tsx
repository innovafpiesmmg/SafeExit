import { useState, useRef, useEffect } from "react";
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
import {
  Camera, QrCode, ShieldCheck, ShieldX, AlertTriangle,
  RotateCcw, Send, LogOut, Wifi, WifiOff, Clock,
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

export default function GuardView() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const now = useCurrentTime();
  const online = useOnlineStatus();

  const [qrInput, setQrInput] = useState("");
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incidentNote, setIncidentNote] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<any>(null);
  const videoRef = useRef<HTMLDivElement>(null);

  const { data: stats } = useQuery<{ today: number; authorized: number; denied: number }>({
    queryKey: ["/api/exit-stats"],
    refetchInterval: 30000,
  });

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

  const handleManualScan = () => {
    if (!qrInput.trim()) return;
    verifyMutation.mutate(qrInput.trim());
    setQrInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleManualScan();
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

  const resetScan = () => {
    setScanResult(null);
    setQrInput("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  useEffect(() => {
    return () => { if (scannerRef.current) scannerRef.current.stop().catch(() => {}); };
  }, []);

  const isAuthorized = scanResult?.result === "AUTORIZADO";

  const timeStr = now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

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
          <Button size="icon" variant="ghost" onClick={logout} data-testid="button-guard-logout" className="min-h-[44px] min-w-[44px]">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 max-w-xl mx-auto w-full">
        {!scanResult ? (
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
        ) : (
          <div className="w-full space-y-5">
            <Card className={`border-2 ${isAuthorized ? "border-emerald-500 bg-emerald-500/5" : "border-red-500 bg-red-500/5"}`}>
              <CardContent className="p-6">
                <div className={`w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center ${isAuthorized ? "bg-emerald-500/20" : "bg-red-500/20"}`}>
                  {isAuthorized
                    ? <ShieldCheck className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
                    : <ShieldX className="w-12 h-12 text-red-600 dark:text-red-400" />
                  }
                </div>

                <div className="text-center mb-4">
                  <h2 className={`text-4xl font-black tracking-tight ${isAuthorized ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-guard-result">
                    {scanResult.result}
                  </h2>
                  <p className="text-muted-foreground mt-1 text-base" data-testid="text-guard-reason">{scanResult.reason}</p>
                </div>

                {scanResult.student && (
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-background/80 mt-4">
                    <Avatar className="w-20 h-20 border-2 border-border">
                      <AvatarImage src={scanResult.student.photoUrl || undefined} />
                      <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">
                        {scanResult.student.firstName[0]}{scanResult.student.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold text-xl" data-testid="text-guard-student-name">
                        {scanResult.student.firstName} {scanResult.student.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">{scanResult.student.course}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant="secondary">{scanResult.student.age} años</Badge>
                        {scanResult.student.age >= 18 && <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">+18</Badge>}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3">
              <Button
                onClick={resetScan}
                className="w-full h-16 text-lg font-bold"
                data-testid="button-guard-new-scan"
              >
                <RotateCcw className="w-6 h-6 mr-2" />
                Nueva Verificación
              </Button>

              {isAuthorized && (
                <Button
                  variant="secondary"
                  onClick={() => setIncidentOpen(true)}
                  className="w-full h-14 text-base"
                  data-testid="button-guard-incident"
                >
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  Registrar Incidencia
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <Dialog open={incidentOpen} onOpenChange={setIncidentOpen}>
        <DialogContent>
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
