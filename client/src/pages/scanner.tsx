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
import { SignaturePad } from "@/components/signature-pad";
import {
  Camera, QrCode, ShieldCheck, ShieldX, AlertTriangle,
  RotateCcw, Send, Search, Users, UserCheck, CreditCard,
  Clock, Loader2, XCircle, CheckCircle2,
} from "lucide-react";
import type { Student, Group } from "@shared/schema";

export default function ScannerPage() {
  const { toast } = useToast();
  const [mainTab, setMainTab] = useState("autonoma");

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

  const [accompTab, setAccompTab] = useState("search");
  const [accompQrInput, setAccompQrInput] = useState("");
  const [accompGroupId, setAccompGroupId] = useState("");
  const [accompSearchStudent, setAccompSearchStudent] = useState("");
  const [accompSelectedStudent, setAccompSelectedStudent] = useState<Student | null>(null);
  const [accompDni, setAccompDni] = useState("");
  const [accompResult, setAccompResult] = useState<any>(null);
  const [accompSignaturePending, setAccompSignaturePending] = useState(false);
  const [showExtraordinaryForm, setShowExtraordinaryForm] = useState(false);
  const [extraName, setExtraName] = useState("");
  const [extraReason, setExtraReason] = useState("");
  const [accompScanning, setAccompScanning] = useState(false);
  const accompScannerRef = useRef<any>(null);
  const accompVideoRef = useRef<HTMLDivElement>(null);

  const [lateGroupId, setLateGroupId] = useState("");
  const [lateSearchStudent, setLateSearchStudent] = useState("");
  const [lateQrInput, setLateQrInput] = useState("");
  const [lateNotes, setLateNotes] = useState("");
  const [lateResult, setLateResult] = useState<any>(null);
  const [lateConfirmDialog, setLateConfirmDialog] = useState<Student | null>(null);
  const [lateTab, setLateTab] = useState("qr");

  const { data: groups } = useQuery<Group[]>({ queryKey: ["/api/groups"] });
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
    refetchInterval: 60000,
  });
  const extraordinaryEnabled = settings?.extraordinaryExitEnabled === "true";

  const { data: allStudents } = useQuery<Student[]>({ queryKey: ["/api/students"] });

  const { data: groupStudents, isLoading: loadingStudents } = useQuery<Student[]>({
    queryKey: [`/api/groups/${selectedGroupId}/students`],
    enabled: !!selectedGroupId,
  });

  const { data: accompGroupStudents, isLoading: loadingAccompStudents } = useQuery<Student[]>({
    queryKey: [`/api/groups/${accompGroupId}/students`],
    enabled: !!accompGroupId,
  });

  const { data: lateGroupStudents, isLoading: loadingLateStudents } = useQuery<Student[]>({
    queryKey: [`/api/groups/${lateGroupId}/students`],
    enabled: !!lateGroupId,
  });

  const filteredStudents = groupStudents?.filter(s =>
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchStudent.toLowerCase())
  ) || [];

  const filteredAccompStudents = accompGroupStudents?.filter(s =>
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(accompSearchStudent.toLowerCase())
  ) || [];

  const filteredLateStudents = lateGroupStudents?.filter(s =>
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(lateSearchStudent.toLowerCase())
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

  const accompaniedMutation = useMutation({
    mutationFn: async (data: { studentId: number; documentId: string; extraordinary?: boolean; extraordinaryName?: string; extraordinaryReason?: string }) => {
      const res = await apiRequest("POST", "/api/accompanied-exit", data);
      return res.json();
    },
    onSuccess: (data) => {
      setAccompResult(data);
      setShowExtraordinaryForm(false);
      setExtraName("");
      setExtraReason("");
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

  const lateArrivalMutation = useMutation({
    mutationFn: (data: { qrCode?: string; studentId?: number; notes?: string }) =>
      apiRequest("POST", "/api/late-arrivals", data).then(r => r.json()),
    onSuccess: (data: any) => {
      const nameParts = (data.studentName || "").split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";
      setLateResult({
        result: "REGISTRADO",
        reason: "Entrada tardía registrada correctamente",
        student: {
          firstName,
          lastName,
          photoUrl: data.studentPhoto,
          course: data.course,
        },
      });
      setLateQrInput("");
      setLateNotes("");
      setLateConfirmDialog(null);
      queryClient.invalidateQueries({ queryKey: ["/api/late-arrivals/today"] });
      toast({ title: "Entrada tardía registrada" });
      playSuccessSound();
    },
    onError: (e: any) => {
      playErrorSound();
      toast({ title: "Error", description: e.message, variant: "destructive" });
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

  const handleAccompQrLookup = () => {
    if (!accompQrInput.trim() || !allStudents) return;
    const found = allStudents.find(s => s.qrCode === accompQrInput.trim());
    if (found) {
      setAccompSelectedStudent(found);
      setAccompQrInput("");
      setAccompDni("");
    } else {
      playErrorSound();
      toast({ title: "QR no reconocido", description: "No se encontró ningún alumno con ese código QR", variant: "destructive" });
    }
  };

  const handleAccompaniedVerify = () => {
    if (!accompSelectedStudent || !accompDni.trim()) return;
    accompaniedMutation.mutate({ studentId: accompSelectedStudent.id, documentId: accompDni.trim() });
  };

  const handleExtraordinaryExit = () => {
    if (!accompSelectedStudent || !extraName.trim() || !extraReason.trim()) return;
    accompaniedMutation.mutate({
      studentId: accompSelectedStudent.id,
      documentId: accompDni || "",
      extraordinary: true,
      extraordinaryName: extraName.trim(),
      extraordinaryReason: extraReason.trim(),
    });
  };

  const resetAccompanied = () => {
    setAccompResult(null);
    setAccompSignaturePending(false);
    setShowExtraordinaryForm(false);
    setExtraName("");
    setExtraReason("");
    setAccompDni("");
    setAccompSelectedStudent(null);
    stopAccompCamera();
  };

  const resetLate = () => {
    setLateResult(null);
    setLateQrInput("");
    setLateNotes("");
    setLateConfirmDialog(null);
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

  const startAccompCamera = async () => {
    setAccompScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (accompVideoRef.current) {
        const scanner = new Html5Qrcode("accomp-dni-reader-scanner");
        accompScannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" } as any,
          {
            fps: 10,
            qrbox: { width: 280, height: 100 },
            formatsToSupport: [0, 2, 3, 4, 7, 8, 10],
          } as any,
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

  const resetScan = () => {
    setScanResult(null);
    setQrInput("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) scannerRef.current.stop().catch(() => {});
      if (accompScannerRef.current) accompScannerRef.current.stop().catch(() => {});
    };
  }, []);

  const isAuthorized = scanResult?.result === "AUTORIZADO";

  const renderResultCard = (result: any, onReset: () => void, showIncident?: boolean) => {
    const authorized = result?.result === "AUTORIZADO";
    const registered = result?.result === "REGISTRADO";
    const isPositive = authorized || registered;

    return (
      <div className="space-y-4">
        <Card className={`border-2 ${isPositive ? "border-emerald-500" : "border-red-500"}`}>
          <CardContent className="p-6">
            <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${isPositive ? "bg-emerald-500/15" : "bg-red-500/15"}`}>
              {isPositive
                ? <ShieldCheck className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                : <ShieldX className="w-10 h-10 text-red-600 dark:text-red-400" />
              }
            </div>

            <div className="text-center mb-4">
              <h2 className={`text-3xl font-black tracking-tight ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-scan-result">
                {result.result}
              </h2>
              <p className="text-muted-foreground mt-1" data-testid="text-scan-reason">{result.reason || result.message}</p>
              {result.extraordinary && (
                <Badge variant="secondary" className="mt-2 text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Autorización extraordinaria</Badge>
              )}
            </div>

            {result.student && (
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 mt-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={result.student.photoUrl || undefined} />
                  <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
                    {result.student.firstName[0]}{result.student.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold text-lg" data-testid="text-student-full-name">
                    {result.student.firstName} {result.student.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">{result.student.course}</p>
                  {result.student.age != null && (
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">{result.student.age} años</Badge>
                      {result.student.age >= 18 && <Badge className="text-xs">+18</Badge>}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3">
          <Button
            onClick={onReset}
            className="w-full min-h-[56px] text-lg font-semibold"
            data-testid="button-new-scan"
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            Nueva Verificación
          </Button>

          {showIncident && authorized && (
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
    );
  };

  const renderStudentList = (
    students: Student[],
    loading: boolean,
    groupId: string,
    search: string,
    onSelect: (s: Student) => void,
    testIdPrefix: string,
    disabled?: boolean,
  ) => {
    if (groupId && loading) {
      return (
        <div className="text-center py-6 text-muted-foreground">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm">Cargando alumnos...</p>
        </div>
      );
    }
    if (groupId && students.length === 0) {
      return (
        <div className="text-center py-6 text-muted-foreground">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{search ? "No se encontraron alumnos" : "No hay alumnos en este grupo"}</p>
        </div>
      );
    }
    if (groupId) {
      return (
        <div className="space-y-1.5 max-h-[350px] overflow-y-auto">
          {students.map(student => (
            <button
              key={student.id}
              onClick={() => onSelect(student)}
              disabled={disabled}
              className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors text-left disabled:opacity-50"
              data-testid={`button-${testIdPrefix}-student-${student.id}`}
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
      );
    }
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Selecciona un grupo para ver los alumnos</p>
      </div>
    );
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-4 max-w-xl mx-auto">
      <div className="w-full space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <QrCode className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold" data-testid="text-scanner-title">Verificación</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestiona salidas autónomas, acompañadas y entradas tardías</p>
        </div>

        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="autonoma" data-testid="tab-autonoma">
              <QrCode className="w-4 h-4 mr-1.5 hidden sm:inline" /> Autónoma
            </TabsTrigger>
            <TabsTrigger value="acompanada" data-testid="tab-acompanada">
              <UserCheck className="w-4 h-4 mr-1.5 hidden sm:inline" /> Acompañada
            </TabsTrigger>
            <TabsTrigger value="tardia" data-testid="tab-tardia">
              <Clock className="w-4 h-4 mr-1.5 hidden sm:inline" /> Tardía
            </TabsTrigger>
          </TabsList>

          <TabsContent value="autonoma" className="mt-4">
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

                        {renderStudentList(filteredStudents, loadingStudents, selectedGroupId, searchStudent, handleStudentVerify, "scanner", verifyMutation.isPending)}
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
              renderResultCard(scanResult, resetScan, true)
            )}
          </TabsContent>

          <TabsContent value="acompanada" className="mt-4">
            {accompResult ? (
              accompSignaturePending && accompResult.result === "AUTORIZADO" ? (
                <Card>
                  <CardContent className="p-6">
                    <div className="rounded-xl p-4 bg-emerald-500/10 border border-emerald-500/30">
                      {accompResult.student && (
                        <div className="flex items-center gap-3 mb-3">
                          <Avatar className="w-14 h-14 border-2 border-emerald-300 shadow" data-testid="avatar-accomp-sign-student">
                            <AvatarImage src={accompResult.student.photoUrl || undefined} />
                            <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
                              {accompResult.student.firstName[0]}{accompResult.student.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
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
                      <Button onClick={() => setAccompSignaturePending(false)} variant="ghost" size="sm" className="w-full text-xs text-muted-foreground mt-2" data-testid="button-skip-signature">
                        Omitir firma
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  <Card className={`border-2 ${accompResult.result === "AUTORIZADO" ? "border-emerald-500" : "border-red-500"}`}>
                    <CardContent className="p-6">
                      <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${accompResult.result === "AUTORIZADO" ? "bg-emerald-500/15" : "bg-red-500/15"}`}>
                        {accompResult.result === "AUTORIZADO"
                          ? <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                          : <ShieldX className="w-10 h-10 text-red-600 dark:text-red-400" />
                        }
                      </div>

                      <div className="text-center mb-4">
                        <h2 className={`text-3xl font-black tracking-tight ${accompResult.result === "AUTORIZADO" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-accomp-result">
                          {accompResult.result}
                        </h2>
                        <p className="text-muted-foreground mt-1" data-testid="text-accomp-reason">{accompResult.reason}</p>
                        {accompResult.extraordinary && (
                          <Badge variant="secondary" className="mt-2 text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Autorización extraordinaria</Badge>
                        )}
                      </div>

                      {accompResult.student && (
                        <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 mt-4">
                          <Avatar className="w-16 h-16" data-testid="avatar-accomp-student">
                            <AvatarImage src={accompResult.student.photoUrl || undefined} />
                            <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
                              {accompResult.student.firstName[0]}{accompResult.student.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-bold text-lg" data-testid="text-accomp-student-name">
                              {accompResult.student.firstName} {accompResult.student.lastName}
                            </p>
                            <p className="text-sm text-muted-foreground">{accompResult.student.course}</p>
                          </div>
                        </div>
                      )}

                      {accompResult.result === "DENEGADO" && extraordinaryEnabled && !showExtraordinaryForm && (
                        <div className="mt-4 pt-4 border-t">
                          <Button
                            onClick={() => setShowExtraordinaryForm(true)}
                            variant="outline"
                            className="w-full border-amber-400 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/30 h-12"
                            data-testid="button-extraordinary-open"
                          >
                            <AlertTriangle className="w-4 h-4 mr-2" />
                            Autorización extraordinaria
                          </Button>
                          <p className="text-[11px] text-muted-foreground mt-1.5 text-center">Usar solo si los padres/tutores han confirmado por teléfono o email</p>
                        </div>
                      )}

                      {showExtraordinaryForm && (
                        <div className="mt-4 pt-4 border-t space-y-2">
                          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2 mb-1">
                            <p className="text-xs text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                              Quedará registrada como incidencia
                            </p>
                          </div>
                          <Input
                            value={extraName}
                            onChange={e => setExtraName(e.target.value)}
                            placeholder="Nombre completo del acompañante"
                            className="h-10"
                            data-testid="input-extraordinary-name"
                          />
                          <Select value={extraReason} onValueChange={setExtraReason}>
                            <SelectTrigger className="h-10" data-testid="select-extraordinary-reason">
                              <SelectValue placeholder="Medio de confirmación..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Confirmado por teléfono por los padres/tutores">Confirmado por teléfono</SelectItem>
                              <SelectItem value="Confirmado por email por los padres/tutores">Confirmado por email</SelectItem>
                              <SelectItem value="Confirmado presencialmente por los padres/tutores">Confirmado presencialmente</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              onClick={() => { setShowExtraordinaryForm(false); setExtraName(""); setExtraReason(""); }}
                              className="flex-1 h-10"
                              data-testid="button-extraordinary-cancel"
                            >
                              Cancelar
                            </Button>
                            <Button
                              onClick={handleExtraordinaryExit}
                              disabled={!extraName.trim() || !extraReason || accompaniedMutation.isPending}
                              className="flex-1 h-10 bg-amber-600 hover:bg-amber-700 text-white"
                              data-testid="button-extraordinary-confirm"
                            >
                              {accompaniedMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-1.5" />}
                              Autorizar salida
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Button
                    onClick={resetAccompanied}
                    className="w-full min-h-[56px] text-lg font-semibold"
                    data-testid="button-accomp-reset"
                  >
                    <RotateCcw className="w-5 h-5 mr-2" />
                    Nueva Verificación
                  </Button>
                </div>
              )
            ) : !accompSelectedStudent ? (
              <Card>
                <CardContent className="p-6">
                  <Tabs value={accompTab} onValueChange={setAccompTab}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="qr" data-testid="tab-accomp-qr">
                        <QrCode className="w-4 h-4 mr-1.5" /> Escanear QR
                      </TabsTrigger>
                      <TabsTrigger value="search" data-testid="tab-accomp-search">
                        <Search className="w-4 h-4 mr-1.5" /> Buscar alumno
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="qr" className="mt-4 space-y-4">
                      <div className="flex gap-2">
                        <Input
                          data-testid="input-accomp-qr-code"
                          placeholder="Código QR del alumno..."
                          value={accompQrInput}
                          onChange={e => setAccompQrInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") handleAccompQrLookup(); }}
                          className="text-lg"
                        />
                        <Button
                          onClick={handleAccompQrLookup}
                          data-testid="button-accomp-qr-lookup"
                          disabled={!accompQrInput.trim()}
                          className="min-w-[60px] min-h-[48px]"
                        >
                          <UserCheck className="w-5 h-5" />
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="search" className="mt-4 space-y-3">
                      <Select value={accompGroupId} onValueChange={setAccompGroupId}>
                        <SelectTrigger className="h-12" data-testid="select-group-accomp">
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
                            className="pl-9 h-12"
                            placeholder="Buscar alumno..."
                            value={accompSearchStudent}
                            onChange={e => setAccompSearchStudent(e.target.value)}
                            data-testid="input-search-student-accomp"
                          />
                        </div>
                      )}

                      {renderStudentList(filteredAccompStudents, loadingAccompStudents, accompGroupId, accompSearchStudent, (s) => { setAccompSelectedStudent(s); setAccompDni(""); }, "accomp")}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6 space-y-3">
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
                    <p className="text-sm font-medium text-muted-foreground">DNI/NIE del padre, tutor legal o persona autorizada:</p>
                    <div className="flex gap-2">
                      <Input
                        value={accompDni}
                        onChange={e => setAccompDni(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleAccompaniedVerify(); }}
                        placeholder="12345678A o X1234567A"
                        className="text-lg h-14"
                        data-testid="input-accomp-dni"
                        autoFocus
                      />
                      <Button
                        onClick={handleAccompaniedVerify}
                        disabled={!accompDni.trim() || accompaniedMutation.isPending}
                        className="min-w-[60px] h-14"
                        data-testid="button-accomp-verify"
                      >
                        {accompaniedMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-6 h-6" />}
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
                        id="accomp-dni-reader-scanner"
                        ref={accompVideoRef}
                        className="rounded-lg overflow-hidden"
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
                </CardContent>
              </Card>
            )}

            {accompaniedMutation.isPending && !accompResult && (
              <div className="text-center py-4">
                <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">Verificando...</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="tardia" className="mt-4">
            {lateResult ? (
              renderResultCard(lateResult, resetLate, false)
            ) : (
              <>
                <Card>
                  <CardContent className="p-6">
                    <Tabs value={lateTab} onValueChange={setLateTab}>
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="qr" data-testid="tab-late-qr">
                          <QrCode className="w-4 h-4 mr-1.5" /> Escanear QR
                        </TabsTrigger>
                        <TabsTrigger value="search" data-testid="tab-late-search">
                          <Search className="w-4 h-4 mr-1.5" /> Buscar alumno
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="qr" className="mt-4 space-y-4">
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <Input
                              data-testid="input-late-qr-code"
                              placeholder="Código QR..."
                              value={lateQrInput}
                              onChange={e => setLateQrInput(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter" && lateQrInput.trim()) { lateArrivalMutation.mutate({ qrCode: lateQrInput.trim(), notes: lateNotes || undefined }); } }}
                              className="text-lg"
                            />
                            <Button
                              onClick={() => { if (lateQrInput.trim()) lateArrivalMutation.mutate({ qrCode: lateQrInput.trim(), notes: lateNotes || undefined }); }}
                              data-testid="button-late-verify"
                              disabled={lateArrivalMutation.isPending || !lateQrInput.trim()}
                              className="min-w-[60px] min-h-[48px]"
                            >
                              <Clock className="w-5 h-5" />
                            </Button>
                          </div>
                          <Textarea
                            data-testid="textarea-late-notes"
                            placeholder="Notas opcionales (motivo del retraso...)"
                            value={lateNotes}
                            onChange={e => setLateNotes(e.target.value)}
                            rows={2}
                          />
                        </div>
                      </TabsContent>

                      <TabsContent value="search" className="mt-4 space-y-3">
                        <Select value={lateGroupId} onValueChange={setLateGroupId}>
                          <SelectTrigger className="h-12" data-testid="select-group-late">
                            <SelectValue placeholder="Seleccionar grupo..." />
                          </SelectTrigger>
                          <SelectContent>
                            {groups?.map(g => (
                              <SelectItem key={g.id} value={String(g.id)}>{g.name} ({g.course})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {lateGroupId && (
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              className="pl-9 h-12"
                              placeholder="Buscar alumno..."
                              value={lateSearchStudent}
                              onChange={e => setLateSearchStudent(e.target.value)}
                              data-testid="input-search-student-late"
                            />
                          </div>
                        )}

                        {renderStudentList(filteredLateStudents, loadingLateStudents, lateGroupId, lateSearchStudent, (s) => setLateConfirmDialog(s), "late", lateArrivalMutation.isPending)}

                        <Textarea
                          data-testid="textarea-late-notes-search"
                          placeholder="Notas opcionales (motivo del retraso...)"
                          value={lateNotes}
                          onChange={e => setLateNotes(e.target.value)}
                          rows={2}
                          className="mt-2"
                        />
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>

                {lateArrivalMutation.isPending && (
                  <div className="text-center py-4">
                    <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
                    <p className="text-sm text-muted-foreground mt-2">Registrando...</p>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
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

      <Dialog open={!!lateConfirmDialog} onOpenChange={(open) => { if (!open) setLateConfirmDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar entrada tardía</DialogTitle>
          </DialogHeader>
          {lateConfirmDialog && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={lateConfirmDialog.photoUrl || undefined} />
                  <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">
                    {lateConfirmDialog.firstName[0]}{lateConfirmDialog.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold" data-testid="text-late-confirm-student">
                    {lateConfirmDialog.firstName} {lateConfirmDialog.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">{lateConfirmDialog.course}</p>
                </div>
              </div>
              <Textarea
                data-testid="textarea-late-confirm-notes"
                placeholder="Notas opcionales (motivo del retraso...)"
                value={lateNotes}
                onChange={e => setLateNotes(e.target.value)}
                rows={2}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setLateConfirmDialog(null)}
                  className="flex-1"
                  data-testid="button-late-cancel"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => lateArrivalMutation.mutate({ studentId: lateConfirmDialog.id, notes: lateNotes || undefined })}
                  disabled={lateArrivalMutation.isPending}
                  className="flex-1"
                  data-testid="button-late-confirm"
                >
                  {lateArrivalMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Clock className="w-4 h-4 mr-1.5" />}
                  Registrar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
