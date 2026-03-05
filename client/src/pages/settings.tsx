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
import { Mail, Server, Lock, Send, CheckCircle2, XCircle, Loader2, AlertTriangle, Trash2, CalendarDays, UserCheck, Clock } from "lucide-react";
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
                  <div className="grid grid-cols-[auto_1fr_auto_1fr] gap-2 items-center text-xs font-medium text-muted-foreground px-1">
                    <span className="w-16">Tramo</span>
                    <span>Inicio</span>
                    <span className="w-4" />
                    <span>Fin</span>
                  </div>
                  {(timeSlots[dayKey] || []).map((slot: TimeSlotConfig, idx: number) => (
                    <div key={slot.id} className="grid grid-cols-[auto_1fr_auto_1fr] gap-2 items-center">
                      <span className="text-sm font-medium w-16 text-muted-foreground" data-testid={`text-slot-label-${dayKey}-${slot.id}`}>
                        {slot.id <= 6 ? `M${slot.id}` : `T${slot.id - 6}`}
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
                        className="h-8 text-sm"
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
                        className="h-8 text-sm"
                        data-testid={`input-slot-end-${dayKey}-${slot.id}`}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-4">
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
            M = tramo de mañana, T = tramo de tarde. Recuerda pulsar "Guardar configuración" abajo del todo para aplicar los cambios.
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

      <Card className="border-destructive/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Nuevo Curso Académico
          </CardTitle>
          <CardDescription>
            Elimina todos los datos (alumnos, grupos, horarios, historial, profesores y ajustes) excepto tu usuario administrador. Esta acción es irreversible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => setResetDialogOpen(true)}
            data-testid="button-reset-year"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Iniciar Nuevo Curso
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Confirmar Nuevo Curso Académico
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">
                Esta acción eliminará permanentemente:
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
                Solo se conservará tu usuario administrador.
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
