import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Plus, Search, Pencil, Trash2, Upload, Download, FileSpreadsheet,
  AlertCircle, CheckCircle2, Key, ShieldCheck, UserPlus, AlertTriangle, GraduationCap,
  QrCode, Tablet, Smartphone, Copy, Check, Camera, ImagePlus, X, Loader2, ShieldAlert,
} from "lucide-react";
import QRCodeLib from "qrcode";
import type { Group } from "@shared/schema";
import { ADMIN_PERMISSIONS, type AdminPermission } from "@shared/schema";
import { useAuth } from "@/lib/auth";

type Guard = { id: number; username: string; fullName: string; role: string; groupId: number | null; photoUrl: string | null; email: string | null; permissions: string[] };

export default function GuardsPage() {
  const { user: currentUser } = useAuth();
  const isCurrentAdmin = currentUser?.role === "admin";
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Guard | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [permissionsGuard, setPermissionsGuard] = useState<Guard | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ firstName: "", lastName: "", isTutor: false, groupId: "" });

  const [guardQrUrl, setGuardQrUrl] = useState("");
  const [tutorQrUrl, setTutorQrUrl] = useState("");
  const [copiedQr, setCopiedQr] = useState<string | null>(null);

  const { data: guards, isLoading } = useQuery<Guard[]>({ queryKey: ["/api/guards"] });
  const { data: settings } = useQuery<Record<string, string>>({ queryKey: ["/api/settings"] });
  const { data: groups } = useQuery<Group[]>({ queryKey: ["/api/groups"] });

  const hasPassword = !!settings?.guardPassword;

  useEffect(() => {
    const origin = window.location.origin;
    QRCodeLib.toDataURL(`${origin}/login?mode=guard&role=profesorguardia`, { width: 280, margin: 2, color: { dark: "#1e3a5f" }, errorCorrectionLevel: "H" })
      .then(url => setGuardQrUrl(url));
    QRCodeLib.toDataURL(`${origin}/login?mode=tutor&role=tutorgrupo`, { width: 280, margin: 2, color: { dark: "#166534" }, errorCorrectionLevel: "H" })
      .then(url => setTutorQrUrl(url));
  }, []);

  const copyQrImage = async (dataUrl: string, label: string) => {
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopiedQr(label);
      toast({ title: `QR de ${label} copiado al portapapeles` });
      setTimeout(() => setCopiedQr(null), 2000);
    } catch {
      toast({ title: "No se pudo copiar", description: "Tu navegador no soporta copiar imágenes", variant: "destructive" });
    }
  };

  const downloadQrImage = (dataUrl: string, filename: string) => {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    link.click();
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/guards", {
      ...data,
      role: data.isTutor ? "tutor" : "guard",
      groupId: data.isTutor ? (data.groupId ? parseInt(data.groupId) : null) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guards"] });
      toast({ title: "Profesor añadido correctamente" });
      resetForm();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/guards/${id}`, {
      ...data,
      role: data.isTutor ? "tutor" : "guard",
      groupId: data.isTutor ? (data.groupId ? parseInt(data.groupId) : null) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guards"] });
      toast({ title: "Profesor actualizado" });
      resetForm();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/guards/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guards"] });
      toast({ title: "Profesor eliminado" });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: (password: string) => apiRequest("PUT", "/api/guards/password", { password }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Contraseña actualizada para todos los profesores" });
      setPasswordDialogOpen(false);
      setNewPassword("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const permissionsMutation = useMutation({
    mutationFn: ({ id, permissions }: { id: number; permissions: string[] }) =>
      apiRequest("PUT", `/api/guards/${id}/permissions`, { permissions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guards"] });
      toast({ title: "Permisos actualizados" });
      setPermissionsGuard(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openPermissions = (guard: Guard) => {
    setPermissionsGuard(guard);
    setSelectedPermissions(guard.permissions || []);
  };

  const togglePermission = (perm: string) => {
    setSelectedPermissions(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  const resetForm = () => {
    setForm({ firstName: "", lastName: "", isTutor: false, groupId: "" });
    setEditing(null);
    setDialogOpen(false);
  };

  const handleEdit = (guard: Guard) => {
    const parts = guard.fullName.split(" ");
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ") || "";
    setForm({
      firstName,
      lastName,
      isTutor: guard.role === "tutor",
      groupId: guard.groupId ? String(guard.groupId) : "",
    });
    setEditing(guard);
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.isTutor && !form.groupId) {
      toast({ title: "Selecciona un grupo", description: "Los tutores deben tener un grupo asignado", variant: "destructive" });
      return;
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/guards/import", { method: "POST", body: fd, credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setImportResult({ imported: data.imported, errors: data.errors || [] });
      queryClient.invalidateQueries({ queryKey: ["/api/guards"] });
      toast({ title: data.message });
    } catch (err: any) {
      toast({ title: "Error en la importación", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filtered = guards?.filter(g =>
    g.fullName.toLowerCase().includes(search.toLowerCase()) ||
    g.username.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-guards-title">Profesores</h1>
          <p className="text-muted-foreground text-sm mt-1">{guards?.length || 0} profesores registrados (guardias y tutores)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isCurrentAdmin && (
            <>
              <Button variant="outline" onClick={() => setPasswordDialogOpen(true)} data-testid="button-guard-password">
                <Key className="w-4 h-4 mr-2" />
                Contraseña
              </Button>
              <Button variant="secondary" onClick={() => setImportDialogOpen(true)} data-testid="button-import-guards">
                <Upload className="w-4 h-4 mr-2" />
                Importar Excel
              </Button>
            </>
          )}
          {isCurrentAdmin && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-guard" disabled={!hasPassword}>
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Profesor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editing ? "Editar Profesor" : "Nuevo Profesor"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nombre</Label>
                  <Input data-testid="input-guard-first-name" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Apellidos</Label>
                  <Input data-testid="input-guard-last-name" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} required />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Tutor de grupo</Label>
                    <p className="text-xs text-muted-foreground">Puede ver alumnos, sacar fotos y compartir carnets</p>
                  </div>
                  <Switch
                    checked={form.isTutor}
                    onCheckedChange={v => setForm(f => ({ ...f, isTutor: v, groupId: v ? f.groupId : "" }))}
                    data-testid="switch-tutor"
                  />
                </div>
                {form.isTutor && (
                  <div className="space-y-1.5">
                    <Label>Grupo asignado</Label>
                    <Select value={form.groupId} onValueChange={v => setForm(f => ({ ...f, groupId: v }))}>
                      <SelectTrigger data-testid="select-tutor-group">
                        <SelectValue placeholder="Seleccionar grupo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {groups?.map(g => (
                          <SelectItem key={g.id} value={String(g.id)}>{g.name} ({g.course})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-guard">
                  {createMutation.isPending || updateMutation.isPending ? "Guardando..." : editing ? "Actualizar" : "Crear Profesor"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </div>

      {isCurrentAdmin && (
        !hasPassword ? (
          <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Contraseña no definida</p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  Debes definir una contraseña común antes de poder añadir o importar profesores de guardia.
                </p>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => setPasswordDialogOpen(true)} data-testid="button-set-password-cta">
                  <Key className="w-3 h-3 mr-1" /> Definir contraseña
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-emerald-300/50 bg-emerald-50/50 dark:bg-emerald-950/10 dark:border-emerald-800/50">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Contraseña actual: <code className="bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded text-sm font-mono" data-testid="text-current-password">{settings?.guardPassword}</code></p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                  Todos los profesores usan esta contraseña con su usuario asignado para iniciar sesión.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setPasswordDialogOpen(true)} data-testid="button-change-password">
                <Key className="w-3 h-3 mr-1" /> Cambiar
              </Button>
            </CardContent>
          </Card>
        )
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o usuario..."
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
          data-testid="input-search-guards"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">
              {search ? "No se encontraron profesores" : "No hay profesores registrados"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((guard) => (
            <GuardCard
              key={guard.id}
              guard={guard}
              groups={groups}
              onEdit={handleEdit}
              onDelete={(id) => { if (confirm("¿Eliminar este profesor?")) deleteMutation.mutate(id); }}
              onPermissions={openPermissions}
              isAdmin={isCurrentAdmin}
            />
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <QrCode className="w-5 h-5" />
            QR de Acceso a la Aplicación
          </CardTitle>
          <CardDescription>
            Los profesores pueden escanear estos códigos QR con su dispositivo para acceder directamente a la aplicación
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
              <div className="flex items-center gap-2">
                <Tablet className="w-5 h-5 text-blue-700 dark:text-blue-400" />
                <span className="font-semibold text-blue-800 dark:text-blue-300">Profesores de Guardia</span>
              </div>
              <p className="text-xs text-center text-blue-600 dark:text-blue-400">Escáner de salidas en tablet</p>
              {guardQrUrl && (
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <img src={guardQrUrl} alt="QR acceso guardia" className="w-44 h-44" data-testid="img-guard-qr" />
                  <p className="text-center text-[10px] font-bold text-blue-800 mt-1 tracking-wider">GUARDIA</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => copyQrImage(guardQrUrl, "guardia")} disabled={!guardQrUrl} data-testid="button-copy-guard-qr">
                  {copiedQr === "guardia" ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                  {copiedQr === "guardia" ? "Copiado" : "Copiar"}
                </Button>
                <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => downloadQrImage(guardQrUrl, "qr-guardia.png")} disabled={!guardQrUrl} data-testid="button-download-guard-qr">
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Descargar
                </Button>
              </div>
            </div>
            <div className="flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                <span className="font-semibold text-emerald-800 dark:text-emerald-300">Tutores</span>
              </div>
              <p className="text-xs text-center text-emerald-600 dark:text-emerald-400">Gestión de grupo en móvil</p>
              {tutorQrUrl && (
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <img src={tutorQrUrl} alt="QR acceso tutor" className="w-44 h-44" data-testid="img-tutor-qr" />
                  <p className="text-center text-[10px] font-bold text-emerald-800 mt-1 tracking-wider">TUTOR</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => copyQrImage(tutorQrUrl, "tutor")} disabled={!tutorQrUrl} data-testid="button-copy-tutor-qr">
                  {copiedQr === "tutor" ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                  {copiedQr === "tutor" ? "Copiado" : "Copiar"}
                </Button>
                <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => downloadQrImage(tutorQrUrl, "qr-tutor.png")} disabled={!tutorQrUrl} data-testid="button-download-tutor-qr">
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Descargar
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Contraseña Común
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Todos los profesores de guardia usarán la misma contraseña para iniciar sesión. Al cambiarla se actualizará para todos.
            </p>
            <div className="space-y-1.5">
              <Label>Nueva contraseña</Label>
              <Input
                type="password"
                data-testid="input-guard-password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Mínimo 4 caracteres"
              />
            </div>
            <Button
              className="w-full"
              disabled={newPassword.length < 4 || passwordMutation.isPending}
              onClick={() => passwordMutation.mutate(newPassword)}
              data-testid="button-save-password"
            >
              {passwordMutation.isPending ? "Guardando..." : "Guardar Contraseña"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={(open) => { setImportDialogOpen(open); if (!open) setImportResult(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Importar Profesores desde Excel
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Descarga la plantilla, rellénala con Nombre y Apellidos de los profesores y súbela aquí. Se les asignará usuario automáticamente.
              </p>
              <Button variant="outline" className="w-full" data-testid="button-download-guard-template" asChild>
                <a href="/api/guards/template" download>
                  <Download className="w-4 h-4 mr-2" />
                  Descargar Plantilla Excel
                </a>
              </Button>
            </div>

            {!hasPassword && (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300">Define la contraseña común antes de importar.</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Subir archivo Excel (.xlsx)</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                data-testid="input-import-guard-file"
                onChange={handleImportFile}
                disabled={importing || !hasPassword}
              />
            </div>

            {importing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Procesando archivo...
              </div>
            )}

            {importResult && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                  {importResult.imported} profesor(es) importado(s) correctamente
                </div>
                {importResult.errors.length > 0 && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                    <div className="flex items-center gap-1 text-sm font-medium text-destructive">
                      <AlertCircle className="w-4 h-4" />
                      {importResult.errors.length} error(es):
                    </div>
                    <ul className="text-xs text-destructive/80 space-y-0.5 max-h-32 overflow-y-auto">
                      {importResult.errors.map((err, i) => (
                        <li key={i}>• {err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!permissionsGuard} onOpenChange={(v) => { if (!v) setPermissionsGuard(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle data-testid="text-permissions-title">
              Permisos — {permissionsGuard?.fullName}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Selecciona las secciones del panel de administración a las que este profesor tendrá acceso.
          </p>
          <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">
            {Object.entries(ADMIN_PERMISSIONS).map(([key, label]) => (
              <label
                key={key}
                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                  selectedPermissions.includes(key) ? "bg-primary/10 border-primary" : "hover:bg-muted"
                }`}
                data-testid={`checkbox-permission-${key}`}
              >
                <input
                  type="checkbox"
                  checked={selectedPermissions.includes(key)}
                  onChange={() => togglePermission(key)}
                  className="rounded"
                />
                {label}
              </label>
            ))}
          </div>
          <div className="flex justify-between items-center pt-2">
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedPermissions(Object.keys(ADMIN_PERMISSIONS))}
                data-testid="button-select-all-permissions"
              >
                Todos
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedPermissions([])}
                data-testid="button-clear-permissions"
              >
                Ninguno
              </Button>
            </div>
            <Button
              onClick={() => {
                if (permissionsGuard) {
                  permissionsMutation.mutate({ id: permissionsGuard.id, permissions: selectedPermissions });
                }
              }}
              disabled={permissionsMutation.isPending}
              data-testid="button-save-permissions"
            >
              {permissionsMutation.isPending ? "Guardando..." : "Guardar permisos"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

function GuardCard({
  guard,
  groups,
  onEdit,
  onDelete,
  onPermissions,
  isAdmin,
}: {
  guard: Guard;
  groups: Group[] | undefined;
  onEdit: (guard: Guard) => void;
  onDelete: (id: number) => void;
  onPermissions: (guard: Guard) => void;
  isAdmin: boolean;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Error", description: "Solo se permiten imágenes", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch(`/api/guards/${guard.id}/photo`, {
        method: "PATCH",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Error al subir foto");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/guards"] });
      toast({ title: "Foto actualizada" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async () => {
    try {
      const res = await fetch(`/api/guards/${guard.id}/photo`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Error al eliminar foto");
      queryClient.invalidateQueries({ queryKey: ["/api/guards"] });
      toast({ title: "Foto eliminada" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const initials = guard.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <Card data-testid={`card-guard-${guard.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="relative group flex-shrink-0">
            <Avatar className="w-14 h-14">
              {guard.photoUrl ? (
                <img
                  src={guard.photoUrl}
                  alt={guard.fullName}
                  className="w-full h-full object-cover rounded-full"
                  data-testid={`img-guard-photo-${guard.id}`}
                />
              ) : (
                <AvatarFallback className="bg-primary/10 text-primary text-base">
                  {initials}
                </AvatarFallback>
              )}
            </Avatar>
            {uploading && (
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 rounded-full transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <div className="flex gap-1">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1 bg-white/90 rounded-full hover:bg-white"
                  title="Subir foto"
                  data-testid={`button-upload-photo-${guard.id}`}
                >
                  <ImagePlus className="w-3.5 h-3.5 text-gray-700" />
                </button>
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="p-1 bg-white/90 rounded-full hover:bg-white"
                  title="Tomar foto"
                  data-testid={`button-camera-photo-${guard.id}`}
                >
                  <Camera className="w-3.5 h-3.5 text-gray-700" />
                </button>
                {guard.photoUrl && (
                  <button
                    onClick={handleDeletePhoto}
                    className="p-1 bg-white/90 rounded-full hover:bg-white"
                    title="Eliminar foto"
                    data-testid={`button-delete-photo-${guard.id}`}
                  >
                    <X className="w-3.5 h-3.5 text-red-600" />
                  </button>
                )}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePhotoUpload(file);
                e.target.value = "";
              }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePhotoUpload(file);
                e.target.value = "";
              }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate" data-testid={`text-guard-name-${guard.id}`}>{guard.fullName}</p>
            <p className="text-xs text-muted-foreground truncate">@{guard.username}</p>
            {guard.role === "tutor" && guard.groupId && (
              <div className="flex items-center gap-1 mt-0.5">
                <GraduationCap className="w-3 h-3 text-primary" />
                <span className="text-xs text-primary font-medium">
                  {groups?.find(g => g.id === guard.groupId)?.name || ""}
                </span>
              </div>
            )}
          </div>
          <Badge variant={guard.role === "tutor" ? "default" : "secondary"} className="text-xs flex-shrink-0">
            {guard.role === "tutor" ? "Tutor" : "Guardia"}
          </Badge>
        </div>
        {isAdmin && (
          <div className="flex flex-col gap-1 mt-3 pt-3 border-t">
            <div className="flex gap-1">
              <Button size="sm" variant="secondary" data-testid={`button-edit-guard-${guard.id}`} onClick={() => onEdit(guard)} className="flex-1">
                <Pencil className="w-3 h-3 mr-1" /> Editar
              </Button>
              <Button size="sm" variant="destructive" data-testid={`button-delete-guard-${guard.id}`} onClick={() => onDelete(guard.id)} className="flex-1">
                <Trash2 className="w-3 h-3 mr-1" /> Eliminar
              </Button>
            </div>
            <Button
              size="sm"
              variant="outline"
              data-testid={`button-permissions-guard-${guard.id}`}
              onClick={() => onPermissions(guard)}
              className="w-full"
            >
              <ShieldAlert className="w-3 h-3 mr-1" />
              Permisos {guard.permissions?.length ? `(${guard.permissions.length})` : ""}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
