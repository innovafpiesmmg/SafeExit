import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { SignaturePad } from "@/components/signature-pad";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { playSuccessSound, playErrorSound } from "@/lib/sounds";
import { PwaInstallBanner } from "@/components/pwa-install-banner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Camera, QrCode, ShieldCheck, ShieldX, AlertTriangle,
  RotateCcw, Send, LogOut, Wifi, WifiOff, Settings, ArrowLeft, SwitchCamera, XCircle,
  Search, Users, UserCheck, CreditCard, Loader2, CheckCircle2,
} from "lucide-react";
import type { Student, Group } from "@shared/schema";

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

interface GuardViewProps {
  tutorMode?: boolean;
  embedded?: boolean;
  onFullscreenChange?: (fullscreen: boolean) => void;
}

export default function GuardView({ tutorMode, embedded, onFullscreenChange }: GuardViewProps = {}) {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const now = useCurrentTime();
  const online = useOnlineStatus();
  useWakeLock();

  const [qrInput, setQrInput] = useState("");
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incidentNote, setIncidentNote] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [guardTab, setGuardTab] = useState("qr");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [searchStudent, setSearchStudent] = useState("");
  const [accompGroupId, setAccompGroupId] = useState("");
  const [accompSearchStudent, setAccompSearchStudent] = useState("");
  const [accompSelectedStudent, setAccompSelectedStudent] = useState<Student | null>(null);
  const [accompDni, setAccompDni] = useState("");
  const [accompResult, setAccompResult] = useState<any>(null);
  const [accompSignaturePending, setAccompSignaturePending] = useState(false);
  const [accompScanning, setAccompScanning] = useState(false);
  const accompScannerRef = useRef<any>(null);
  const accompVideoRef = useRef<HTMLDivElement>(null);
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

  const { data: groups } = useQuery<Group[]>({ queryKey: ["/api/groups"] });
  const { data: groupStudents, isLoading: loadingStudents } = useQuery<Student[]>({
    queryKey: [`/api/groups/${selectedGroupId}/students`],
    enabled: !!selectedGroupId,
  });

  const filteredStudents = groupStudents?.filter(s =>
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchStudent.toLowerCase())
  ) || [];

  const { data: accompGroupStudents, isLoading: loadingAccompStudents } = useQuery<Student[]>({
    queryKey: [`/api/groups/${accompGroupId}/students`],
    enabled: !!accompGroupId,
  });

  const filteredAccompStudents = accompGroupStudents?.filter(s =>
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(accompSearchStudent.toLowerCase())
  ) || [];

  const handleStudentVerify = (student: Student) => {
    verifyMutation.mutate(student.qrCode);
  };

  const accompaniedMutation = useMutation({
    mutationFn: async (data: { studentId: number; documentId: string }) => {
      const res = await apiRequest("POST", "/api/accompanied-exit", data);
      return res.json();
    },
    onSuccess: (data) => {
      setAccompResult(data);
      if (data.result === "AUTORIZADO") {
        setAccompSignaturePending(true);
        playSuccessSound();
      } else {
        playErrorSound();
      }
      queryClient.invalidateQueries({ queryKey: ["/api/exit-stats"] });
    },
    onError: (e: any) => {
      playErrorSound();
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const signatureMutation = useMutation({
    mutationFn: async ({ logId, signatureData }: { logId: number; signatureData: string }) => {
      const res = await apiRequest("PATCH", `/api/exit-logs/${logId}/signature`, { signatureData });
      return res.json();
    },
    onSuccess: () => {
      setAccompSignaturePending(false);
      toast({ title: "Firma registrada correctamente" });
    },
    onError: (e: any) => {
      toast({ title: "Error al guardar firma", description: e.message, variant: "destructive" });
    },
  });

  const handleAccompaniedVerify = () => {
    if (!accompSelectedStudent || !accompDni.trim()) return;
    accompaniedMutation.mutate({ studentId: accompSelectedStudent.id, documentId: accompDni.trim() });
  };

  const resetAccompanied = () => {
    setAccompResult(null);
    setAccompSignaturePending(false);
    setAccompDni("");
    setAccompSelectedStudent(null);
    stopAccompCamera();
  };

  const startAccompCamera = async () => {
    setAccompScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (accompVideoRef.current) {
        const scanner = new Html5Qrcode("accomp-dni-reader");
        accompScannerRef.current = scanner;
        const cameraConfig = selectedCameraId
          ? { deviceId: { exact: selectedCameraId } }
          : { facingMode: "environment" };
        await scanner.start(
          cameraConfig as any,
          {
            fps: 10,
            qrbox: { width: 280, height: 100 },
            formatsToSupport: [0, 2, 3, 4, 7, 8, 10],
          },
          (decodedText) => {
            const dniMatch = decodedText.match(/[0-9]{8}[A-Z]/i) || decodedText.match(/[XYZ][0-9]{7}[A-Z]/i);
            const result = dniMatch ? dniMatch[0] : decodedText;
            setAccompDni(result);
            scanner.stop().catch(() => {});
            setAccompScanning(false);
          },
          () => {}
        );
      }
    } catch {
      toast({ title: "No se pudo acceder a la cámara", variant: "destructive" });
      setAccompScanning(false);
    }
  };

  const stopAccompCamera = () => {
    if (accompScannerRef.current) {
      accompScannerRef.current.stop().catch(() => {});
      accompScannerRef.current = null;
    }
    setAccompScanning(false);
  };

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

  const startCamera = async (cameraId?: string) => {
    setScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (videoRef.current) {
        const scanner = new Html5Qrcode("guard-qr-reader");
        scannerRef.current = scanner;
        const cameraConfig = cameraId || selectedCameraId
          ? { deviceId: { exact: cameraId || selectedCameraId } }
          : { facingMode: "environment" };
        await scanner.start(
          cameraConfig as any,
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

  const switchCamera = async (newCameraId: string) => {
    setSelectedCameraId(newCameraId);
    if (scanning && scannerRef.current) {
      await scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
      setScanning(false);
      setTimeout(() => startCamera(newCameraId), 300);
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
    import("html5-qrcode").then(({ Html5Qrcode }) => {
      Html5Qrcode.getCameras().then(devices => {
        if (devices.length > 0) {
          setCameras(devices.map((d, i) => ({
            id: d.id,
            label: d.label || `Cámara ${i + 1}`,
          })));
          const backCam = devices.find(d =>
            d.label.toLowerCase().includes("back") ||
            d.label.toLowerCase().includes("trasera") ||
            d.label.toLowerCase().includes("rear") ||
            d.label.toLowerCase().includes("environment")
          );
          setSelectedCameraId(backCam?.id || devices[devices.length - 1].id);
        }
      }).catch(() => {});
    });
    return () => {
      if (scannerRef.current) scannerRef.current.stop().catch(() => {});
      if (accompScannerRef.current) accompScannerRef.current.stop().catch(() => {});
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  useEffect(() => {
    if (!scanResult) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [scanResult]);

  useEffect(() => {
    onFullscreenChange?.(!!scanResult);
  }, [scanResult, onFullscreenChange]);

  const isAuthorized = scanResult?.result === "AUTORIZADO";

  const timeStr = now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  if (scanResult) {
    return (
      <div
        className={`${embedded ? "fixed inset-0 z-[60]" : "min-h-[100dvh]"} flex flex-col ${
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

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 text-white">
          {scanResult.student?.photoUrl ? (
            <div className="w-44 h-44 sm:w-52 sm:h-52 md:w-60 md:h-60 rounded-2xl overflow-hidden mb-4 border-4 border-white/50 shadow-2xl">
              <img
                src={scanResult.student.photoUrl}
                alt={`${scanResult.student.firstName} ${scanResult.student.lastName}`}
                className="w-full h-full object-cover"
                data-testid="img-guard-student-photo"
              />
            </div>
          ) : scanResult.student ? (
            <div className="w-44 h-44 sm:w-52 sm:h-52 md:w-60 md:h-60 rounded-2xl flex items-center justify-center mb-4 border-4 border-white/50 shadow-2xl bg-white/20" data-testid="avatar-guard-student-fallback">
              <span className="text-6xl sm:text-7xl md:text-8xl font-bold text-white/90">
                {scanResult.student.firstName[0]}{scanResult.student.lastName[0]}
              </span>
            </div>
          ) : (
            <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl flex items-center justify-center mb-4 bg-white/20">
              {isAuthorized
                ? <ShieldCheck className="w-20 h-20 sm:w-24 sm:h-24" />
                : <ShieldX className="w-20 h-20 sm:w-24 sm:h-24" />
              }
            </div>
          )}

          {scanResult.student && (
            <p className="font-bold text-2xl sm:text-3xl leading-tight text-center mb-1" data-testid="text-guard-student-name">
              {scanResult.student.firstName} {scanResult.student.lastName}
            </p>
          )}

          {scanResult.student && (
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="text-white/70 text-base">{scanResult.student.course}</span>
              <Badge className="bg-white/20 text-white border-white/30 text-sm">
                {scanResult.student.age} años
              </Badge>
              {scanResult.student.age >= 18 && (
                <Badge className="bg-white/30 text-white border-white/40 text-sm">+18</Badge>
              )}
            </div>
          )}

          <h1
            className="text-5xl sm:text-7xl md:text-8xl font-black tracking-tight text-center leading-none"
            data-testid="text-guard-result"
          >
            {scanResult.result}
          </h1>

          <p className="text-lg sm:text-xl mt-2 text-white/80 text-center font-medium" data-testid="text-guard-reason">
            {scanResult.reason}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mt-6 w-full max-w-lg">
            <Button
              onClick={(e) => { e.stopPropagation(); resetScan(); }}
              className="flex-1 h-14 text-base font-bold bg-white/20 hover:bg-white/30 text-white border border-white/30"
              variant="ghost"
              data-testid="button-guard-new-scan"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Nueva Verificación
            </Button>

            <Button
              variant="ghost"
              onClick={(e) => { e.stopPropagation(); pauseAutoReturn(); setIncidentOpen(true); }}
              className="flex-1 h-14 text-base font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20"
              data-testid="button-guard-incident"
            >
              <AlertTriangle className="w-5 h-5 mr-2" />
              Incidencia
            </Button>
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

  const studentSearchPanel = (
    <div className="space-y-3">
      <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
        <SelectTrigger className={embedded ? "h-10 text-sm" : "h-12"} data-testid="select-group-guard">
          <SelectValue placeholder="Seleccionar grupo..." />
        </SelectTrigger>
        <SelectContent>
          {groups?.map(g => (
            <SelectItem key={g.id} value={String(g.id)}>{g.name} ({g.course})</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedGroupId && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className={`pl-9 ${embedded ? "h-10 text-sm" : "h-12"}`}
            placeholder="Buscar alumno..."
            value={searchStudent}
            onChange={e => setSearchStudent(e.target.value)}
            data-testid="input-search-student-guard"
          />
        </div>
      )}

      {selectedGroupId && loadingStudents ? (
        <div className="text-center py-6 text-muted-foreground">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm">Cargando alumnos...</p>
        </div>
      ) : selectedGroupId && filteredStudents.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{searchStudent ? "No se encontraron alumnos" : "No hay alumnos en este grupo"}</p>
        </div>
      ) : selectedGroupId ? (
        <div className={`space-y-1.5 overflow-y-auto ${embedded ? "max-h-[calc(100dvh-300px)]" : "max-h-[350px]"}`}>
          {filteredStudents.map(student => (
            <button
              key={student.id}
              onClick={() => handleStudentVerify(student)}
              disabled={verifyMutation.isPending}
              className="w-full flex items-center gap-2.5 p-2.5 rounded-lg border hover:bg-accent transition-colors text-left disabled:opacity-50"
              data-testid={`button-guard-student-${student.id}`}
            >
              <Avatar className={embedded ? "w-9 h-9" : "w-10 h-10"}>
                <AvatarImage src={student.photoUrl || undefined} />
                <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                  {student.firstName[0]}{student.lastName[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{student.firstName} {student.lastName}</p>
                <p className="text-xs text-muted-foreground">{student.course}</p>
              </div>
              <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" />
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-muted-foreground">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Selecciona un grupo para ver los alumnos</p>
        </div>
      )}
    </div>
  );

  const accompaniedPanel = (isEmbedded: boolean) => (
    <div className="space-y-3">
      {accompResult ? (
        accompSignaturePending && accompResult.result === "AUTORIZADO" ? (
          <div className="rounded-xl p-4 bg-emerald-500/10 border border-emerald-500/30 space-y-3">
            {accompResult.student && (
              <div className="flex items-center gap-3 mb-2">
                <Avatar className="w-14 h-14 border-2 border-emerald-300 shadow" data-testid="avatar-accomp-sign-student">
                  <AvatarImage src={accompResult.student.photoUrl || undefined} />
                  <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
                    {accompResult.student.firstName[0]}{accompResult.student.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <p className="font-semibold text-sm">{accompResult.student.firstName} {accompResult.student.lastName}</p>
                  <p className="text-xs text-muted-foreground">{accompResult.student.course}</p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mt-0.5">{accompResult.reason}</p>
                </div>
              </div>
            )}
            <SignaturePad
              onSave={(dataUrl) => signatureMutation.mutate({ logId: accompResult.logId, signatureData: dataUrl })}
              saving={signatureMutation.isPending}
              signerName={accompResult.authorizedPerson ? `${accompResult.authorizedPerson.firstName} ${accompResult.authorizedPerson.lastName}` : undefined}
            />
            <Button onClick={() => setAccompSignaturePending(false)} variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" data-testid="button-skip-signature">
              Omitir firma
            </Button>
          </div>
        ) : (
        <div className={`rounded-xl p-4 text-center ${accompResult.result === "AUTORIZADO" ? "bg-emerald-500/10 border border-emerald-500/30" : "bg-red-500/10 border border-red-500/30"}`}>
          {accompResult.student && (
            <div className="flex justify-center mb-3">
              <Avatar className="w-20 h-20 border-2 border-white/50 shadow-lg" data-testid="avatar-accomp-student">
                <AvatarImage src={accompResult.student.photoUrl || undefined} />
                <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                  {accompResult.student.firstName[0]}{accompResult.student.lastName[0]}
                </AvatarFallback>
              </Avatar>
            </div>
          )}
          <div className="flex items-center justify-center gap-2 mb-2">
            {accompResult.result === "AUTORIZADO" ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            ) : (
              <ShieldX className="w-8 h-8 text-red-600" />
            )}
          </div>
          <p className={`text-lg font-bold ${accompResult.result === "AUTORIZADO" ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`} data-testid="text-accomp-result">
            {accompResult.result}
          </p>
          <p className="text-sm font-medium mt-1" data-testid="text-accomp-student-name">
            {accompResult.student?.firstName} {accompResult.student?.lastName}
          </p>
          <p className="text-xs text-muted-foreground">{accompResult.student?.course}</p>
          <p className="text-sm mt-2" data-testid="text-accomp-reason">{accompResult.reason}</p>
          {accompResult.incidentCreated && (
            <Badge variant="destructive" className="mt-2 text-xs">Incidencia registrada automáticamente</Badge>
          )}
          <Button onClick={resetAccompanied} variant="outline" className="w-full mt-3" data-testid="button-accomp-reset">
            <RotateCcw className="w-4 h-4 mr-2" /> Nueva verificación
          </Button>
        </div>
        )
      ) : !accompSelectedStudent ? (
        <>
          <Select value={accompGroupId} onValueChange={setAccompGroupId}>
            <SelectTrigger className={isEmbedded ? "h-10 text-sm" : "h-12"} data-testid="select-group-accomp">
              <SelectValue placeholder="Seleccionar grupo..." />
            </SelectTrigger>
            <SelectContent>
              {groups?.map(g => (
                <SelectItem key={g.id} value={String(g.id)}>{g.name} ({g.course})</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {accompGroupId && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className={`pl-9 ${isEmbedded ? "h-10 text-sm" : "h-12"}`}
                placeholder="Buscar alumno..."
                value={accompSearchStudent}
                onChange={e => setAccompSearchStudent(e.target.value)}
                data-testid="input-search-student-accomp"
              />
            </div>
          )}

          {accompGroupId && loadingAccompStudents ? (
            <div className="text-center py-6 text-muted-foreground">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm">Cargando alumnos...</p>
            </div>
          ) : accompGroupId && filteredAccompStudents.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{accompSearchStudent ? "No se encontraron alumnos" : "No hay alumnos en este grupo"}</p>
            </div>
          ) : accompGroupId ? (
            <div className={`space-y-1.5 overflow-y-auto ${isEmbedded ? "max-h-[calc(100dvh-300px)]" : "max-h-[300px]"}`}>
              {filteredAccompStudents.map(student => (
                <button
                  key={student.id}
                  onClick={() => { setAccompSelectedStudent(student); setAccompDni(""); }}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-lg border hover:bg-accent transition-colors text-left"
                  data-testid={`button-accomp-student-${student.id}`}
                >
                  <Avatar className={isEmbedded ? "w-9 h-9" : "w-10 h-10"}>
                    <AvatarImage src={student.photoUrl || undefined} />
                    <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                      {student.firstName[0]}{student.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{student.firstName} {student.lastName}</p>
                    <p className="text-xs text-muted-foreground">{student.course}</p>
                  </div>
                  <UserCheck className="w-4 h-4 text-primary flex-shrink-0" />
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Selecciona un grupo para ver los alumnos</p>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
            <Avatar className="w-12 h-12">
              <AvatarImage src={accompSelectedStudent.photoUrl || undefined} />
              <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">
                {accompSelectedStudent.firstName[0]}{accompSelectedStudent.lastName[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-semibold" data-testid="text-accomp-selected-student">
                {accompSelectedStudent.firstName} {accompSelectedStudent.lastName}
              </p>
              <p className="text-xs text-muted-foreground">{accompSelectedStudent.course}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setAccompSelectedStudent(null)} data-testid="button-accomp-change-student">
              <XCircle className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">DNI/NIE de la persona que recoge:</p>
            <div className="flex gap-2">
              <Input
                value={accompDni}
                onChange={e => setAccompDni(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleAccompaniedVerify(); }}
                placeholder="12345678A o X1234567A"
                className={isEmbedded ? "text-base h-10" : "text-lg h-14"}
                data-testid="input-accomp-dni"
                autoFocus
              />
              <Button
                onClick={handleAccompaniedVerify}
                disabled={!accompDni.trim() || accompaniedMutation.isPending}
                className={isEmbedded ? "min-w-[48px] h-10" : "min-w-[60px] h-14"}
                data-testid="button-accomp-verify"
              >
                {accompaniedMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className={isEmbedded ? "w-5 h-5" : "w-6 h-6"} />}
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">o escanea el DNI/NIE</span>
            </div>
          </div>

          {accompScanning ? (
            <div className="space-y-2">
              <div
                id="accomp-dni-reader"
                ref={accompVideoRef}
                className="rounded-lg overflow-hidden"
                style={isEmbedded ? { maxHeight: "180px" } : undefined}
              />
              <Button onClick={stopAccompCamera} variant="destructive" className="w-full text-sm font-semibold h-10" data-testid="button-accomp-stop-camera">
                Detener Cámara
              </Button>
            </div>
          ) : (
            <Button onClick={startAccompCamera} variant="secondary" className="w-full text-sm font-semibold h-10" data-testid="button-accomp-start-camera">
              <CreditCard className="w-4 h-4 mr-2" />
              Escanear DNI/NIE
            </Button>
          )}
        </div>
      )}
    </div>
  );

  const qrScanPanel = (isEmbedded: boolean) => (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          data-testid="input-guard-qr"
          placeholder="Código QR..."
          value={qrInput}
          onChange={e => setQrInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className={isEmbedded ? "text-base h-10" : "text-lg h-14"}
          autoFocus
        />
        <Button
          onClick={handleManualScan}
          data-testid="button-guard-verify"
          disabled={verifyMutation.isPending || !qrInput.trim()}
          className={isEmbedded ? "min-w-[48px] h-10" : "min-w-[60px] h-14"}
        >
          <ShieldCheck className={isEmbedded ? "w-5 h-5" : "w-6 h-6"} />
        </Button>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">o usa la cámara</span>
        </div>
      </div>

      {scanning ? (
        <div className="space-y-2">
          <div
            id="guard-qr-reader"
            ref={videoRef}
            className="rounded-lg overflow-hidden"
            style={isEmbedded ? { maxHeight: "220px" } : undefined}
          />
          {cameras.length > 1 && (
            <Select value={selectedCameraId} onValueChange={switchCamera}>
              <SelectTrigger className="h-9 text-xs" data-testid="select-camera-guard">
                <SwitchCamera className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
                <SelectValue placeholder="Cámara" />
              </SelectTrigger>
              <SelectContent>
                {cameras.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={stopCamera} variant="destructive" className={`w-full text-sm font-semibold ${isEmbedded ? "h-10" : "h-12"}`} data-testid="button-guard-stop-camera">
            Detener Cámara
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {cameras.length > 1 && (
            <Select value={selectedCameraId} onValueChange={setSelectedCameraId}>
              <SelectTrigger className="h-9 text-xs" data-testid="select-camera-guard-idle">
                <SwitchCamera className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
                <SelectValue placeholder="Cámara" />
              </SelectTrigger>
              <SelectContent>
                {cameras.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={() => startCamera()} variant="secondary" className={`w-full text-sm font-semibold ${isEmbedded ? "h-10" : "h-12"}`} data-testid="button-guard-start-camera">
            <Camera className="w-5 h-5 mr-2" />
            Activar Cámara
          </Button>
        </div>
      )}
    </div>
  );

  const guardTabs = (isEmbedded: boolean) => (
    <Tabs value={guardTab} onValueChange={(v) => { setGuardTab(v); if (v !== "accomp") stopAccompCamera(); }}>
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="qr" data-testid="tab-guard-qr" className="text-xs sm:text-sm">
          <QrCode className="w-3.5 h-3.5 mr-1" /> QR
        </TabsTrigger>
        <TabsTrigger value="search" data-testid="tab-guard-search" className="text-xs sm:text-sm">
          <Search className="w-3.5 h-3.5 mr-1" /> Buscar
        </TabsTrigger>
        <TabsTrigger value="accomp" data-testid="tab-guard-accomp" className="text-xs sm:text-sm">
          <UserCheck className="w-3.5 h-3.5 mr-1" /> Acompañada
        </TabsTrigger>
      </TabsList>
      <TabsContent value="qr" className="mt-3">
        {qrScanPanel(isEmbedded)}
      </TabsContent>
      <TabsContent value="search" className="mt-3">
        {studentSearchPanel}
      </TabsContent>
      <TabsContent value="accomp" className="mt-3">
        {accompaniedPanel(isEmbedded)}
      </TabsContent>
    </Tabs>
  );

  if (embedded) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-3 max-w-2xl mx-auto w-full">
        <div className="w-full space-y-3">
          <div className="text-center">
            <h1 className="text-xl font-bold" data-testid="text-guard-title">Verificación de Salida</h1>
            <p className="text-muted-foreground text-xs mt-0.5">Escanea el QR del carnet o busca al alumno por nombre</p>
          </div>

          <Card>
            <CardContent className="p-3">
              {guardTabs(true)}
            </CardContent>
          </Card>

          {verifyMutation.isPending && (
            <div className="text-center py-3">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
              <p className="text-xs text-muted-foreground mt-1">Verificando...</p>
            </div>
          )}

          {stats && (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-muted/50 p-2 text-center">
                <p className="text-lg font-bold" data-testid="text-guard-stat-total">{stats.today || 0}</p>
                <p className="text-[10px] text-muted-foreground">Hoy</p>
              </div>
              <div className="rounded-xl bg-emerald-500/10 p-2 text-center">
                <p className="text-lg font-bold text-emerald-600" data-testid="text-guard-stat-ok">{stats.authorized || 0}</p>
                <p className="text-[10px] text-muted-foreground">Permitidas</p>
              </div>
              <div className="rounded-xl bg-red-500/10 p-2 text-center">
                <p className="text-lg font-bold text-red-600" data-testid="text-guard-stat-denied">{stats.denied || 0}</p>
                <p className="text-[10px] text-muted-foreground">Denegadas</p>
              </div>
            </div>
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
            <p className="text-muted-foreground text-sm mt-1">Escanea el QR del carnet o busca al alumno por nombre</p>
          </div>

          <Card>
            <CardContent className="p-5">
              {guardTabs(false)}
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
