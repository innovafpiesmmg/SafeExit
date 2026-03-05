import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  QrCode, Users, Clock, CheckCircle2, Mail, MailX, Search, Camera,
  AlertCircle, Loader2, ScanLine, SwitchCamera,
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import type { Student, Group } from "@shared/schema";

export default function LateArrivalsPage({ embedded }: { embedded?: boolean } = {}) {
  const { toast } = useToast();
  const [tab, setTab] = useState("scan");
  const [qrInput, setQrInput] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [searchStudent, setSearchStudent] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<Student | null>(null);
  const [result, setResult] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");

  const { data: groups } = useQuery<Group[]>({ queryKey: ["/api/groups"] });
  const { data: groupStudents, isLoading: loadingStudents } = useQuery<Student[]>({
    queryKey: ["/api/groups", selectedGroupId, "students"],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${selectedGroupId}/students`, { credentials: "include" });
      if (!res.ok) throw new Error("Error cargando alumnos del grupo");
      return res.json();
    },
    enabled: !!selectedGroupId,
  });
  const { data: todayArrivals, isLoading: loadingToday } = useQuery<any[]>({
    queryKey: ["/api/late-arrivals/today"],
  });

  const registerMutation = useMutation({
    mutationFn: (data: { qrCode?: string; studentId?: number; notes?: string }) =>
      apiRequest("POST", "/api/late-arrivals", data).then(r => r.json()),
    onSuccess: (data: any) => {
      setResult(data);
      setQrInput("");
      setNotes("");
      setConfirmDialog(null);
      queryClient.invalidateQueries({ queryKey: ["/api/late-arrivals/today"] });
      toast({ title: "Entrada tardía registrada" });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const handleScanQr = (code: string) => {
    registerMutation.mutate({ qrCode: code, notes: notes || undefined });
  };

  const handleSelectStudent = (student: Student) => {
    setConfirmDialog(student);
  };

  const confirmRegister = () => {
    if (!confirmDialog) return;
    registerMutation.mutate({ studentId: confirmDialog.id, notes: notes || undefined });
  };

  useEffect(() => {
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
  }, []);

  const startCamera = async (cameraId?: string) => {
    try {
      const scanner = new Html5Qrcode("late-qr-reader");
      scannerRef.current = scanner;
      setScanning(true);
      const camConfig = cameraId || selectedCameraId
        ? { deviceId: { exact: cameraId || selectedCameraId } }
        : { facingMode: "environment" };
      await scanner.start(
        camConfig as any,
        { fps: 10, qrbox: { width: 200, height: 200 } },
        (decoded) => {
          handleScanQr(decoded);
          scanner.stop().catch(() => {});
          setScanning(false);
        },
        () => {}
      );
    } catch (err: any) {
      toast({ title: "Error de cámara", description: err.message || "No se pudo acceder a la cámara", variant: "destructive" });
      setScanning(false);
    }
  };

  const stopCamera = () => {
    scannerRef.current?.stop().catch(() => {});
    setScanning(false);
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

  useEffect(() => {
    return () => {
      scannerRef.current?.stop().catch(() => {});
    };
  }, []);

  const filteredStudents = groupStudents?.filter(s =>
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchStudent.toLowerCase())
  ) || [];

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  };

  const resultBanner = result && (
    <Card className="border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20">
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-7 h-7 text-emerald-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm" data-testid="text-late-result-name">{result.studentName}</p>
            <p className="text-xs text-muted-foreground">{result.groupName} · {result.course}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {result.emailSent ? (
              <Badge variant="default" className="text-xs">
                <Mail className="w-3 h-3 mr-1" /> Email enviado
              </Badge>
            ) : result.studentEmail ? (
              <Badge variant="destructive" className="text-xs">
                <MailX className="w-3 h-3 mr-1" /> Error email
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">
                <MailX className="w-3 h-3 mr-1" /> Sin email
              </Badge>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" className="mt-1 h-7 text-xs" onClick={() => setResult(null)} data-testid="button-clear-result">
          Registrar otra entrada
        </Button>
      </CardContent>
    </Card>
  );

  const scannerPanel = (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="scan" data-testid="tab-scan">
          <QrCode className="w-4 h-4 mr-1.5" /> Escanear QR
        </TabsTrigger>
        <TabsTrigger value="manual" data-testid="tab-manual">
          <Users className="w-4 h-4 mr-1.5" /> Seleccionar
        </TabsTrigger>
      </TabsList>

      <TabsContent value="scan" className="mt-3 space-y-3">
        <div className={embedded ? "flex gap-3" : "space-y-3"}>
          <div className={embedded ? "flex-1 min-w-0" : ""}>
            <div
              id="late-qr-reader"
              className={scanning ? "rounded-lg overflow-hidden" : "hidden"}
              style={embedded && scanning ? { maxHeight: "220px" } : undefined}
            />
            {!scanning ? (
              <div className="space-y-2">
                {cameras.length > 1 && (
                  <Select value={selectedCameraId} onValueChange={setSelectedCameraId}>
                    <SelectTrigger className="h-9 text-xs" data-testid="select-camera-late-idle">
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
                <Button onClick={() => startCamera()} className="w-full h-12" data-testid="button-start-camera-late">
                  <Camera className="w-5 h-5 mr-2" /> Activar Cámara
                </Button>
              </div>
            ) : (
              <div className="space-y-2 mt-2">
                {cameras.length > 1 && (
                  <Select value={selectedCameraId} onValueChange={switchCamera}>
                    <SelectTrigger className="h-9 text-xs" data-testid="select-camera-late">
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
                <Button variant="destructive" onClick={stopCamera} className="w-full h-9 text-sm" data-testid="button-stop-camera-late">
                  Detener Cámara
                </Button>
              </div>
            )}
          </div>

          <div className={embedded ? "flex-1 min-w-0 flex flex-col justify-center gap-2" : ""}>
            {embedded && (
              <div className="relative my-0">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">o código</span>
                </div>
              </div>
            )}
            {!embedded && (
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">o introducir código</span>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={qrInput}
                onChange={e => setQrInput(e.target.value)}
                placeholder="Código QR"
                className={embedded ? "h-10 text-sm" : ""}
                onKeyDown={e => { if (e.key === "Enter" && qrInput.trim()) handleScanQr(qrInput.trim()); }}
                data-testid="input-qr-late"
              />
              <Button
                onClick={() => handleScanQr(qrInput.trim())}
                disabled={!qrInput.trim() || registerMutation.isPending}
                className={embedded ? "h-10" : ""}
                data-testid="button-verify-qr-late"
              >
                {registerMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
              </Button>
            </div>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notas (opcional)"
              className={embedded ? "text-sm min-h-[40px]" : "min-h-[50px]"}
              rows={1}
              data-testid="textarea-notes-late"
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="manual" className="mt-3 space-y-3">
        <div className="space-y-1.5">
          <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
            <SelectTrigger data-testid="select-group-late" className={embedded ? "h-9 text-sm" : ""}>
              <SelectValue placeholder="Elige un grupo..." />
            </SelectTrigger>
            <SelectContent>
              {groups?.map(g => (
                <SelectItem key={g.id} value={String(g.id)}>{g.name} ({g.course})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedGroupId && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className={`pl-9 ${embedded ? "h-9 text-sm" : ""}`}
              placeholder="Buscar alumno..."
              value={searchStudent}
              onChange={e => setSearchStudent(e.target.value)}
              data-testid="input-search-student-late"
            />
          </div>
        )}

        {loadingStudents ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}
          </div>
        ) : selectedGroupId && filteredStudents.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">{searchStudent ? "No se encontraron alumnos" : "No hay alumnos en este grupo"}</p>
          </div>
        ) : (
          <div className={`space-y-1 overflow-y-auto ${embedded ? "max-h-[calc(100dvh-320px)]" : "max-h-[400px]"}`}>
            {filteredStudents.map(student => (
              <button
                key={student.id}
                onClick={() => handleSelectStudent(student)}
                className="w-full flex items-center gap-2.5 p-2.5 rounded-lg border hover:bg-accent transition-colors text-left"
                data-testid={`button-select-student-${student.id}`}
              >
                <Avatar className="w-9 h-9">
                  <AvatarImage src={student.photoUrl || undefined} />
                  <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                    {student.firstName[0]}{student.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{student.firstName} {student.lastName}</p>
                  <p className="text-xs text-muted-foreground">{student.course}</p>
                </div>
                {student.email && (
                  <Mail className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}

        <Textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notas (opcional)"
          className={embedded ? "text-sm min-h-[40px]" : "min-h-[50px]"}
          rows={1}
          data-testid="textarea-notes-late-manual"
        />
      </TabsContent>
    </Tabs>
  );

  const todayPanel = (
    <Card className={embedded ? "h-full" : ""}>
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="w-4 h-4" /> Entradas de hoy
          {todayArrivals?.length ? (
            <Badge variant="secondary" className="ml-auto text-xs">
              {todayArrivals.length}
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {loadingToday ? (
          <div className="space-y-2">
            {[1, 2].map(i => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : !todayArrivals?.length ? (
          <div className="text-center py-4 text-muted-foreground">
            <CheckCircle2 className="w-7 h-7 mx-auto mb-1.5 opacity-30" />
            <p className="text-xs">Sin entradas tardías hoy</p>
          </div>
        ) : (
          <div className={`space-y-1.5 overflow-y-auto ${embedded ? "max-h-[calc(100dvh-280px)]" : "max-h-[500px]"}`}>
            {todayArrivals.map((a: any) => (
              <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg border text-sm" data-testid={`row-late-${a.id}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-xs">{a.studentName}</p>
                  <p className="text-xs text-muted-foreground">{a.groupName} · {formatTime(a.timestamp)}</p>
                </div>
                {a.emailSent ? (
                  <Mail className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                ) : (
                  <MailX className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (embedded) {
    return (
      <div className="h-full flex flex-col px-3 py-2 overflow-hidden">
        {resultBanner}

        <div className="flex-1 flex gap-3 min-h-0 mt-2">
          <div className="flex-[3] min-w-0 overflow-y-auto">
            <Card className="h-full">
              <CardContent className="p-3">
                {scannerPanel}
              </CardContent>
            </Card>
          </div>

          <div className="flex-[2] min-w-0 overflow-hidden">
            {todayPanel}
          </div>
        </div>

        <Dialog open={!!confirmDialog} onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Confirmar entrada tardía</DialogTitle>
            </DialogHeader>
            {confirmDialog && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={confirmDialog.photoUrl || undefined} />
                    <AvatarFallback className="font-bold bg-primary/10 text-primary">
                      {confirmDialog.firstName[0]}{confirmDialog.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-sm" data-testid="text-confirm-name">{confirmDialog.firstName} {confirmDialog.lastName}</p>
                    <p className="text-xs text-muted-foreground">{confirmDialog.course}</p>
                    {confirmDialog.email ? (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3 text-primary" />
                        <span className="text-xs text-primary">{confirmDialog.email}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 mt-0.5">
                        <MailX className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Sin email</span>
                      </div>
                    )}
                  </div>
                </div>
                {confirmDialog.email && (
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-2.5">
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      Se enviará notificación a <strong>{confirmDialog.email}</strong>
                    </p>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 h-10" onClick={() => setConfirmDialog(null)} data-testid="button-cancel-late">
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1 h-10"
                    onClick={confirmRegister}
                    disabled={registerMutation.isPending}
                    data-testid="button-confirm-late"
                  >
                    {registerMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Registrando...</>
                    ) : (
                      "Registrar"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-late-arrivals-title">Entradas Tardías</h1>
        <p className="text-muted-foreground text-sm mt-1">Registra las llegadas tarde de los alumnos</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {resultBanner}

          {scannerPanel}

        </div>

        <div className="space-y-4">
          {todayPanel}
        </div>
      </div>

      <Dialog open={!!confirmDialog} onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar entrada tardía</DialogTitle>
          </DialogHeader>
          {confirmDialog && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="w-14 h-14">
                  <AvatarImage src={confirmDialog.photoUrl || undefined} />
                  <AvatarFallback className="font-bold bg-primary/10 text-primary">
                    {confirmDialog.firstName[0]}{confirmDialog.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold" data-testid="text-confirm-name">{confirmDialog.firstName} {confirmDialog.lastName}</p>
                  <p className="text-sm text-muted-foreground">{confirmDialog.course}</p>
                  {confirmDialog.email ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3 text-primary" />
                      <span className="text-xs text-primary">{confirmDialog.email}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 mt-0.5">
                      <MailX className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Sin email configurado</span>
                    </div>
                  )}
                </div>
              </div>
              {confirmDialog.email && (
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Se enviará una notificación por correo a <strong>{confirmDialog.email}</strong>
                  </p>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmDialog(null)} data-testid="button-cancel-late">
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={confirmRegister}
                  disabled={registerMutation.isPending}
                  data-testid="button-confirm-late"
                >
                  {registerMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Registrando...</>
                  ) : (
                    "Registrar entrada"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
