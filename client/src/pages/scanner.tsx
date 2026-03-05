import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { playSuccessSound, playErrorSound } from "@/lib/sounds";
import {
  Camera, QrCode, ShieldCheck, ShieldX, AlertTriangle,
  RotateCcw, Send, Search, Users,
} from "lucide-react";
import type { Student, Group } from "@shared/schema";

export default function ScannerPage() {
  const { toast } = useToast();
  const [qrInput, setQrInput] = useState("");
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incidentNote, setIncidentNote] = useState("");
  const [activeTab, setActiveTab] = useState("qr");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [searchStudent, setSearchStudent] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<any>(null);
  const videoRef = useRef<HTMLDivElement>(null);

  const { data: groups } = useQuery<Group[]>({ queryKey: ["/api/groups"] });
  const { data: groupStudents, isLoading: loadingStudents } = useQuery<Student[]>({
    queryKey: [`/api/groups/${selectedGroupId}/students`],
    enabled: !!selectedGroupId,
  });

  const filteredStudents = groupStudents?.filter(s =>
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchStudent.toLowerCase())
  ) || [];

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
      queryClient.invalidateQueries({ queryKey: ["/api/exit-logs/recent"] });
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

  const handleStudentVerify = (student: Student) => {
    verifyMutation.mutate(student.qrCode);
  };

  const startCamera = async () => {
    setScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (videoRef.current) {
        const scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            verifyMutation.mutate(decodedText);
            scanner.stop().catch(() => {});
            setScanning(false);
          },
          () => {}
        );
      }
    } catch (err) {
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

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-4 max-w-xl mx-auto">
      <div className="w-full space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <QrCode className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold" data-testid="text-scanner-title">Verificación de Salida</h1>
          <p className="text-muted-foreground text-sm mt-1">Escanea el QR del carnet o busca al alumno por nombre</p>
        </div>

        {!scanResult ? (
          <>
            <Card>
              <CardContent className="p-6">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="qr" data-testid="tab-scanner-qr">
                      <QrCode className="w-4 h-4 mr-1.5" /> Escanear QR
                    </TabsTrigger>
                    <TabsTrigger value="search" data-testid="tab-scanner-search">
                      <Search className="w-4 h-4 mr-1.5" /> Buscar alumno
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="qr" className="mt-4 space-y-4">
                    <div className="flex gap-2">
                      <Input
                        ref={inputRef}
                        data-testid="input-qr-code"
                        placeholder="Código QR..."
                        value={qrInput}
                        onChange={e => setQrInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="text-lg"
                        autoFocus
                      />
                      <Button
                        onClick={handleManualScan}
                        data-testid="button-verify"
                        disabled={verifyMutation.isPending || !qrInput.trim()}
                        className="min-w-[60px] min-h-[48px]"
                      >
                        <ShieldCheck className="w-5 h-5" />
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
                        <div id="qr-reader" ref={videoRef} className="rounded-lg overflow-hidden" />
                        <Button onClick={stopCamera} variant="destructive" className="w-full min-h-[56px] text-base" data-testid="button-stop-camera">
                          Detener Cámara
                        </Button>
                      </div>
                    ) : (
                      <Button onClick={startCamera} variant="secondary" className="w-full min-h-[56px] text-base" data-testid="button-start-camera">
                        <Camera className="w-5 h-5 mr-2" />
                        Activar Cámara
                      </Button>
                    )}
                  </TabsContent>

                  <TabsContent value="search" className="mt-4 space-y-3">
                    <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                      <SelectTrigger className="h-12" data-testid="select-group-scanner">
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
                          className="pl-9 h-12"
                          placeholder="Buscar alumno..."
                          value={searchStudent}
                          onChange={e => setSearchStudent(e.target.value)}
                          data-testid="input-search-student-scanner"
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
                      <div className="space-y-1.5 max-h-[350px] overflow-y-auto">
                        {filteredStudents.map(student => (
                          <button
                            key={student.id}
                            onClick={() => handleStudentVerify(student)}
                            disabled={verifyMutation.isPending}
                            className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors text-left disabled:opacity-50"
                            data-testid={`button-scanner-student-${student.id}`}
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
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {verifyMutation.isPending && (
              <div className="text-center py-4">
                <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">Verificando...</p>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <Card className={`border-2 ${isAuthorized ? "border-emerald-500" : "border-red-500"}`}>
              <CardContent className="p-6">
                <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${isAuthorized ? "bg-emerald-500/15" : "bg-red-500/15"}`}>
                  {isAuthorized
                    ? <ShieldCheck className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                    : <ShieldX className="w-10 h-10 text-red-600 dark:text-red-400" />
                  }
                </div>

                <div className="text-center mb-4">
                  <h2 className={`text-3xl font-black tracking-tight ${isAuthorized ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-scan-result">
                    {scanResult.result}
                  </h2>
                  <p className="text-muted-foreground mt-1" data-testid="text-scan-reason">{scanResult.reason}</p>
                </div>

                {scanResult.student && (
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 mt-4">
                    <Avatar className="w-16 h-16">
                      <AvatarImage src={scanResult.student.photoUrl || undefined} />
                      <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
                        {scanResult.student.firstName[0]}{scanResult.student.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold text-lg" data-testid="text-student-full-name">
                        {scanResult.student.firstName} {scanResult.student.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">{scanResult.student.course}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">{scanResult.student.age} años</Badge>
                        {scanResult.student.age >= 18 && <Badge className="text-xs">+18</Badge>}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3">
              <Button
                onClick={resetScan}
                className="w-full min-h-[56px] text-lg font-semibold"
                data-testid="button-new-scan"
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                Nueva Verificación
              </Button>

              {isAuthorized && (
                <Button
                  variant="secondary"
                  onClick={() => setIncidentOpen(true)}
                  className="w-full min-h-[56px] text-base"
                  data-testid="button-report-incident"
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
              data-testid="textarea-incident-note"
              placeholder="Describe la incidencia..."
              value={incidentNote}
              onChange={e => setIncidentNote(e.target.value)}
              rows={4}
            />
            <Button
              onClick={() => incidentMutation.mutate({ exitLogId: scanResult?.logId, note: incidentNote })}
              disabled={!incidentNote.trim() || incidentMutation.isPending}
              className="w-full min-h-[48px]"
              data-testid="button-submit-incident"
            >
              <Send className="w-4 h-4 mr-2" />
              Enviar Incidencia
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
