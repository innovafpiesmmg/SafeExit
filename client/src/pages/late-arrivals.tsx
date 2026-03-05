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
  AlertCircle, Loader2, ScanLine,
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

  const startCamera = async () => {
    try {
      const scanner = new Html5Qrcode("late-qr-reader");
      scannerRef.current = scanner;
      setScanning(true);
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
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

  return (
    <div className={embedded ? "px-4 py-4 space-y-4" : "space-y-6"}>
      {!embedded && (
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-late-arrivals-title">Entradas Tardías</h1>
          <p className="text-muted-foreground text-sm mt-1">Registra las llegadas tarde de los alumnos</p>
        </div>
      )}

      <div className={embedded ? "space-y-4" : "grid grid-cols-1 lg:grid-cols-3 gap-6"}>
        <div className={embedded ? "space-y-4" : "lg:col-span-2 space-y-4"}>
          {result && (
            <Card className="border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold" data-testid="text-late-result-name">{result.studentName}</p>
                    <p className="text-sm text-muted-foreground">{result.groupName} · {result.course}</p>
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
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setResult(null)} data-testid="button-clear-result">
                  Registrar otra entrada
                </Button>
              </CardContent>
            </Card>
          )}

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="scan" data-testid="tab-scan">
                <QrCode className="w-4 h-4 mr-2" /> Escanear QR
              </TabsTrigger>
              <TabsTrigger value="manual" data-testid="tab-manual">
                <Users className="w-4 h-4 mr-2" /> Seleccionar alumno
              </TabsTrigger>
            </TabsList>

            <TabsContent value="scan" className="space-y-4">
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div id="late-qr-reader" className={scanning ? "rounded-lg overflow-hidden" : "hidden"} />
                  {!scanning ? (
                    <Button onClick={startCamera} className="w-full h-14" data-testid="button-start-camera-late">
                      <Camera className="w-5 h-5 mr-2" /> Activar Cámara
                    </Button>
                  ) : (
                    <Button variant="destructive" onClick={stopCamera} className="w-full" data-testid="button-stop-camera-late">
                      Detener Cámara
                    </Button>
                  )}

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">o introducir código</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      value={qrInput}
                      onChange={e => setQrInput(e.target.value)}
                      placeholder="Código QR del alumno"
                      onKeyDown={e => { if (e.key === "Enter" && qrInput.trim()) handleScanQr(qrInput.trim()); }}
                      data-testid="input-qr-late"
                    />
                    <Button
                      onClick={() => handleScanQr(qrInput.trim())}
                      disabled={!qrInput.trim() || registerMutation.isPending}
                      data-testid="button-verify-qr-late"
                    >
                      {registerMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="manual" className="space-y-4">
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-1.5">
                    <Label>Seleccionar grupo</Label>
                    <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                      <SelectTrigger data-testid="select-group-late">
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
                        className="pl-9"
                        placeholder="Buscar alumno..."
                        value={searchStudent}
                        onChange={e => setSearchStudent(e.target.value)}
                        data-testid="input-search-student-late"
                      />
                    </div>
                  )}

                  {loadingStudents ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
                    </div>
                  ) : selectedGroupId && filteredStudents.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">{searchStudent ? "No se encontraron alumnos" : "No hay alumnos en este grupo"}</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                      {filteredStudents.map(student => (
                        <button
                          key={student.id}
                          onClick={() => handleSelectStudent(student)}
                          className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors text-left"
                          data-testid={`button-select-student-${student.id}`}
                        >
                          <Avatar className="w-10 h-10">
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
                            <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Card>
            <CardContent className="p-4">
              <Label className="text-sm font-medium">Notas (opcional)</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Motivo del retraso, observaciones..."
                className="mt-1.5"
                rows={2}
                data-testid="textarea-notes-late"
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4" /> Entradas de hoy
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingToday ? (
                <div className="space-y-2">
                  {[1, 2].map(i => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : !todayArrivals?.length ? (
                <div className="text-center py-6 text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Sin entradas tardías hoy</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  <div className="text-xs text-muted-foreground mb-2">
                    {todayArrivals.length} entrada{todayArrivals.length !== 1 ? "s" : ""} tardía{todayArrivals.length !== 1 ? "s" : ""}
                  </div>
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
