import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Mail, Server, Lock, Send, CheckCircle2, XCircle, Loader2, AlertTriangle, Trash2, CalendarDays, UserCheck, Clock, Archive, Plus, X, Coffee } from "lucide-react";
import { type TimeSlotsConfig, type TimeSlotConfig, getDefaultTimeSlotsConfig } from "@shared/schema";

export default function SettingsPage() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery<Record<string, string>>({ queryKey: ["/api/settings"] });

  const [smtp, setSmtp] = useState({
    host: "",
    port: "587",
    user: "",
    pass: "",
    from: "",
    secure: false,
  });
  const [schoolName, setSchoolName] = useState("");
  const [accompaniedExitEmailEnabled, setAccompaniedExitEmailEnabled] = useState(false);
  const [academicYear, setAcademicYear] = useState(() => {
    const now = new Date();
    const y = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    return `${y}-${y + 1}`;
  });
  const [timeSlots, setTimeSlots] = useState<TimeSlotsConfig>(getDefaultTimeSlotsConfig());
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveConfirmation, setArchiveConfirmation] = useState("");
  const [archiveYearName, setArchiveYearName] = useState("");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState("");

  useEffect(() => {
    if (settings) {
      setSmtp({
        host: settings.smtpHost || "",
        port: settings.smtpPort || "587",
        user: settings.smtpUser || "",
        pass: settings.smtpPass || "",
        from: settings.smtpFrom || "",
        secure: settings.smtpSecure === "true",
      });
      setSchoolName(settings.schoolName || "");
      setAccompaniedExitEmailEnabled(settings.accompaniedExitEmailEnabled === "true");
      if (settings.academicYear) {
        setAcademicYear(settings.academicYear);
      }
      if (settings.timeSlots) {
        try {
          setTimeSlots(JSON.parse(settings.timeSlots));
        } catch {}
      }
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const entries: Record<string, string> = {
        smtpHost: smtp.host,
        smtpPort: smtp.port,
        smtpUser: smtp.user,
        smtpPass: smtp.pass,
        smtpFrom: smtp.from,
        smtpSecure: smtp.secure ? "true" : "false",
        schoolName,
        academicYear,
        accompaniedExitEmailEnabled: accompaniedExitEmailEnabled ? "true" : "false",
        timeSlots: JSON.stringify(timeSlots),
      };
      for (const [key, value] of Object.entries(entries)) {
        await apiRequest("PUT", "/api/settings", { key, value });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Configuración guardada correctamente" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const testMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/settings/test-smtp").then(r => r.json()),
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: "Conexión exitosa", description: data.message });
      } else {
        toast({ title: "Error de conexión", description: data.message, variant: "destructive" });
      }
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const archiveMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/archive-academic-year", { confirmation: archiveConfirmation, yearName: archiveYearName }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: "Curso archivado correctamente", description: `Los datos de "${archiveYearName}" se han guardado. Puedes consultarlos en "Cursos Archivados".` });
      setArchiveDialogOpen(false);
      setArchiveConfirmation("");
      setArchiveYearName("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/reset-academic-year", { confirmation: resetConfirmation }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: "Curso académico reiniciado", description: "Todos los datos han sido eliminados." });
      setResetDialogOpen(false);
      setResetConfirmation("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const smtpConfigured = !!(settings?.smtpHost && settings?.smtpUser && settings?.smtpPass && settings?.smtpFrom);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-settings-title">Ajustes</h1>
        <p className="text-muted-foreground text-sm mt-1">Configuración del centro y correo electrónico</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Server className="w-5 h-5" />
            Nombre del Centro
          </CardTitle>
          <CardDescription>Se usará en las notificaciones por correo</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            value={schoolName}
            onChange={e => setSchoolName(e.target.value)}
            placeholder="IES Ejemplo"
            data-testid="input-school-name"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarDays className="w-5 h-5" />
            Curso Académico
          </CardTitle>
          <CardDescription>Se muestra en los carnets de alumno para indicar su validez</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            value={academicYear}
            onChange={e => setAcademicYear(e.target.value)}
            placeholder="2025-2026"
            data-testid="input-academic-year"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="w-5 h-5" />
            Tramos Horarios
          </CardTitle>
          <CardDescription>Define las horas de inicio y fin de cada tramo para cada día de la semana</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="1">
            <TabsList className="w-full grid grid-cols-5" data-testid="tabs-timeslots-days">
              {[
                { key: "1", label: "Lunes" },
                { key: "2", label: "Martes" },
                { key: "3", label: "Miércoles" },
                { key: "4", label: "Jueves" },
                { key: "5", label: "Viernes" },
              ].map(day => (
                <TabsTrigger key={day.key} value={day.key} data-testid={`tab-day-${day.key}`}>
                  <span className="hidden sm:inline">{day.label}</span>
                  <span className="sm:hidden">{day.label.slice(0, 3)}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            {["1", "2", "3", "4", "5"].map(dayKey => (
              <TabsContent key={dayKey} value={dayKey} className="mt-4">
                <div className="space-y-2">
                  <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] gap-2 items-center text-xs font-medium text-muted-foreground px-1">
                    <span className="w-20">Tramo</span>
                    <span>Inicio</span>
                    <span className="w-4" />
                    <span>Fin</span>
                    <span className="w-8" />
                  </div>
                  {(timeSlots[dayKey] || []).map((slot: TimeSlotConfig, idx: number) => {
                    const isBreak = !!slot.isBreak;
                    let slotLabel: string;
                    if (isBreak) {
                      slotLabel = slot.label || "Recreo";
                    } else {
                      const classSlots = (timeSlots[dayKey] || []).filter(s => !s.isBreak);
                      const classIdx = classSlots.findIndex(s => s.id === slot.id);
                      slotLabel = classIdx < 6 ? `M${classIdx + 1}` : `T${classIdx - 5}`;
                    }
                    return (
                    <div key={`${slot.id}-${idx}`} className={`grid grid-cols-[auto_1fr_auto_1fr_auto] gap-2 items-center ${isBreak ? "bg-amber-50 dark:bg-amber-900/10 rounded-md px-1 py-0.5 border border-amber-200/50 dark:border-amber-800/30" : ""}`}>
                      <span className={`text-sm font-medium w-20 flex items-center gap-1 ${isBreak ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} data-testid={`text-slot-label-${dayKey}-${slot.id}`}>
                        {isBreak && <Coffee className="w-3 h-3" />}
                        {isBreak ? (
                          <Input
                            value={slot.label || "Recreo"}
                            onChange={e => {
                              const updated = { ...timeSlots };
                              updated[dayKey] = [...updated[dayKey]];
                              updated[dayKey][idx] = { ...slot, label: e.target.value };
                              setTimeSlots(updated);
                            }}
                            className="h-6 text-xs w-16 px-1 border-amber-300 dark:border-amber-700"
                            data-testid={`input-break-label-${dayKey}-${slot.id}`}
                          />
                        ) : slotLabel}
                      </span>
                      <Input
                        type="time"
                        value={slot.start}
                        onChange={e => {
                          const updated = { ...timeSlots };
                          updated[dayKey] = [...updated[dayKey]];
                          updated[dayKey][idx] = { ...slot, start: e.target.value };
                          setTimeSlots(updated);
                        }}
                        className={`h-8 text-sm ${isBreak ? "border-amber-300 dark:border-amber-700" : ""}`}
                        data-testid={`input-slot-start-${dayKey}-${slot.id}`}
                      />
                      <span className="text-muted-foreground text-sm w-4 text-center">—</span>
                      <Input
                        type="time"
                        value={slot.end}
                        onChange={e => {
                          const updated = { ...timeSlots };
                          updated[dayKey] = [...updated[dayKey]];
                          updated[dayKey][idx] = { ...slot, end: e.target.value };
                          setTimeSlots(updated);
                        }}
                        className={`h-8 text-sm ${isBreak ? "border-amber-300 dark:border-amber-700" : ""}`}
                        data-testid={`input-slot-end-${dayKey}-${slot.id}`}
                      />
                      {isBreak ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => {
                            const updated = { ...timeSlots };
                            updated[dayKey] = updated[dayKey].filter((_, i) => i !== idx);
                            setTimeSlots(updated);
                          }}
                          data-testid={`button-remove-break-${dayKey}-${slot.id}`}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      ) : <span className="w-8" />}
                    </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const updated = { ...timeSlots };
                      const slots = updated[dayKey] || [];
                      const maxBreakId = slots.reduce((max, s) => s.isBreak && s.id > max ? s.id : max, 99);
                      const newBreak: TimeSlotConfig = {
                        id: maxBreakId + 1,
                        start: "10:00",
                        end: "10:20",
                        isBreak: true,
                        label: "Recreo",
                      };
                      const lastNonBreak = slots.reduce((last, s, i) => !s.isBreak ? i : last, -1);
                      const insertIdx = Math.min(lastNonBreak + 1, slots.length);
                      updated[dayKey] = [...slots.slice(0, insertIdx), newBreak, ...slots.slice(insertIdx)];
                      setTimeSlots(updated);
                    }}
                    data-testid={`button-add-break-${dayKey}`}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Añadir recreo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const updated = { ...timeSlots };
                      const defaultConfig = getDefaultTimeSlotsConfig();
                      updated[dayKey] = defaultConfig[dayKey].map(s => ({ ...s }));
                      setTimeSlots(updated);
                      toast({ title: `Tramos del ${["", "lunes", "martes", "miércoles", "jueves", "viernes"][Number(dayKey)]} restaurados a valores por defecto` });
                    }}
                    data-testid={`button-reset-slots-${dayKey}`}
                  >
                    Restaurar por defecto
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const source = timeSlots[dayKey];
                      const updated = { ...timeSlots };
                      for (let d = 1; d <= 5; d++) {
                        updated[String(d)] = source.map(s => ({ ...s }));
                      }
                      setTimeSlots(updated);
                      toast({ title: "Horario aplicado a todos los días de la semana" });
                    }}
                    data-testid={`button-apply-all-days-${dayKey}`}
                  >
                    Aplicar a todos los días
                  </Button>
                </div>
              </TabsContent>
            ))}
          </Tabs>
          <p className="text-xs text-muted-foreground mt-4">
            M = tramo de mañana, T = tramo de tarde. ☕ = recreo (no se permite salida). Puedes añadir, editar o eliminar recreos. Recuerda pulsar "Guardar configuración" abajo del todo para aplicar los cambios.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="w-5 h-5" />
                Servidor de Correo (SMTP)
              </CardTitle>
              <CardDescription className="mt-1">
                Configuración para enviar notificaciones de entradas tardías
              </CardDescription>
            </div>
            <Badge variant={smtpConfigured ? "default" : "secondary"} className="flex-shrink-0">
              {smtpConfigured ? (
                <><CheckCircle2 className="w-3 h-3 mr-1" /> Configurado</>
              ) : (
                <><XCircle className="w-3 h-3 mr-1" /> Sin configurar</>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Servidor SMTP</Label>
              <Input
                value={smtp.host}
                onChange={e => setSmtp(s => ({ ...s, host: e.target.value }))}
                placeholder="smtp.gmail.com"
                data-testid="input-smtp-host"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Puerto</Label>
              <Input
                value={smtp.port}
                onChange={e => setSmtp(s => ({ ...s, port: e.target.value }))}
                placeholder="587"
                data-testid="input-smtp-port"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Usuario</Label>
              <Input
                value={smtp.user}
                onChange={e => setSmtp(s => ({ ...s, user: e.target.value }))}
                placeholder="usuario@ejemplo.com"
                data-testid="input-smtp-user"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Contraseña</Label>
              <div className="relative">
                <Input
                  type="password"
                  value={smtp.pass}
                  onChange={e => setSmtp(s => ({ ...s, pass: e.target.value }))}
                  placeholder="••••••••"
                  data-testid="input-smtp-pass"
                />
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Dirección de envío (From)</Label>
            <Input
              value={smtp.from}
              onChange={e => setSmtp(s => ({ ...s, from: e.target.value }))}
              placeholder='"Centro Educativo" <no-reply@ejemplo.com>'
              data-testid="input-smtp-from"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Conexión segura (SSL/TLS)</Label>
              <p className="text-xs text-muted-foreground">Activar para puerto 465, desactivar para 587 con STARTTLS</p>
            </div>
            <Switch
              checked={smtp.secure}
              onCheckedChange={v => setSmtp(s => ({ ...s, secure: v }))}
              data-testid="switch-smtp-secure"
            />
          </div>

          <div className="pt-2">
            <Button
              variant="outline"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending || !smtp.host}
              data-testid="button-test-smtp"
            >
              {testMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Probando...</>
              ) : (
                <><Send className="w-4 h-4 mr-2" /> Probar conexión</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserCheck className="w-5 h-5" />
            Salida Acompañada
          </CardTitle>
          <CardDescription>Opciones para la recogida de alumnos por personas autorizadas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Enviar correo en salida acompañada</Label>
              <p className="text-xs text-muted-foreground">Notificar por email cuando un alumno sale acompañado por una persona autorizada</p>
            </div>
            <Switch
              checked={accompaniedExitEmailEnabled}
              onCheckedChange={setAccompaniedExitEmailEnabled}
              data-testid="switch-accompanied-email"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          size="lg"
          data-testid="button-save-settings"
        >
          {saveMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</>
          ) : (
            "Guardar configuración"
          )}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Archive className="w-5 h-5" />
            Nuevo Curso Académico
          </CardTitle>
          <CardDescription>
            Archiva los datos del curso actual para consultarlos en el futuro, y comienza un nuevo curso con datos limpios.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={() => { setArchiveYearName(academicYear); setArchiveDialogOpen(true); }}
            data-testid="button-archive-year"
          >
            <Archive className="w-4 h-4 mr-2" />
            Archivar y Comenzar Nuevo Curso
          </Button>
          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground mb-2">Si prefieres eliminar todos los datos sin archivar:</p>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setResetDialogOpen(true)}
              data-testid="button-reset-year"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Eliminar sin archivar
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={archiveDialogOpen} onOpenChange={o => { if (!o) { setArchiveConfirmation(""); setArchiveYearName(""); } setArchiveDialogOpen(o); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5" />
              Archivar Curso Académico
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">
                Se guardarán todos los datos actuales en un archivo consultable y luego se limpiará la base de datos para el nuevo curso.
              </span>
              <span className="block text-sm">
                Se archivará: alumnos, grupos, horarios, historial de salidas, entradas tardías, profesores, incidencias y ajustes.
              </span>
              <span className="block font-medium text-foreground">
                Podrás consultar los datos archivados desde "Cursos Archivados" en el menú lateral.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Nombre del curso a archivar:</Label>
              <Input
                value={archiveYearName}
                onChange={e => setArchiveYearName(e.target.value)}
                placeholder="2024-2025"
                data-testid="input-archive-year-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Escribe <span className="font-bold">ARCHIVAR CURSO</span> para confirmar:</Label>
              <Input
                value={archiveConfirmation}
                onChange={e => setArchiveConfirmation(e.target.value)}
                placeholder="ARCHIVAR CURSO"
                data-testid="input-archive-confirmation"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-archive">Cancelar</AlertDialogCancel>
            <Button
              disabled={archiveConfirmation !== "ARCHIVAR CURSO" || !archiveYearName.trim() || archiveMutation.isPending}
              onClick={() => archiveMutation.mutate()}
              data-testid="button-confirm-archive"
            >
              {archiveMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Archivando...</>
              ) : (
                <><Archive className="w-4 h-4 mr-2" /> Archivar y Limpiar</>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Eliminar Datos sin Archivar
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">
                Esta acción eliminará permanentemente todos los datos SIN crear archivo:
              </span>
              <span className="block text-sm">
                - Todos los alumnos y sus datos
                <br />- Todos los grupos y horarios
                <br />- Todo el historial de salidas
                <br />- Todas las entradas tardías
                <br />- Todos los profesores de guardia y tutores
                <br />- Todos los ajustes de la aplicación
                <br />- Todas las incidencias
              </span>
              <span className="block font-medium text-foreground">
                Solo se conservará tu usuario administrador. Los datos NO se podrán recuperar.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-sm">Escribe <span className="font-bold text-destructive">NUEVO CURSO</span> para confirmar:</Label>
            <Input
              value={resetConfirmation}
              onChange={e => setResetConfirmation(e.target.value)}
              placeholder="NUEVO CURSO"
              data-testid="input-reset-confirmation"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setResetConfirmation("")} data-testid="button-cancel-reset">Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={resetConfirmation !== "NUEVO CURSO" || resetMutation.isPending}
              onClick={() => resetMutation.mutate()}
              data-testid="button-confirm-reset"
            >
              {resetMutation.isPending ? "Eliminando..." : "Eliminar Todo"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
