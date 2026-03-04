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
import { Mail, Server, Lock, Send, CheckCircle2, XCircle, Loader2, AlertTriangle, Trash2 } from "lucide-react";

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

          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              data-testid="button-save-settings"
            >
              {saveMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</>
              ) : (
                "Guardar configuración"
              )}
            </Button>
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
