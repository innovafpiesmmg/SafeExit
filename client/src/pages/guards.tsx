import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import type { Group } from "@shared/schema";

type Guard = { id: number; username: string; fullName: string; role: string; groupId: number | null };

export default function GuardsPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Guard | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ firstName: "", lastName: "", isTutor: false, groupId: "" });

  const { data: guards, isLoading } = useQuery<Guard[]>({ queryKey: ["/api/guards"] });
  const { data: settings } = useQuery<Record<string, string>>({ queryKey: ["/api/settings"] });
  const { data: groups } = useQuery<Group[]>({ queryKey: ["/api/groups"] });

  const hasPassword = !!settings?.guardPassword;

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
          <Button variant="outline" onClick={() => setPasswordDialogOpen(true)} data-testid="button-guard-password">
            <Key className="w-4 h-4 mr-2" />
            Contraseña
          </Button>
          <Button variant="secondary" onClick={() => setImportDialogOpen(true)} data-testid="button-import-guards">
            <Upload className="w-4 h-4 mr-2" />
            Importar Excel
          </Button>
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
        </div>
      </div>

      {!hasPassword && (
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
            <Card key={guard.id} data-testid={`card-guard-${guard.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10 flex-shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {guard.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
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
                <div className="flex gap-1 mt-3 pt-3 border-t">
                  <Button size="sm" variant="secondary" data-testid={`button-edit-guard-${guard.id}`} onClick={() => handleEdit(guard)} className="flex-1">
                    <Pencil className="w-3 h-3 mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="destructive" data-testid={`button-delete-guard-${guard.id}`} onClick={() => { if (confirm("¿Eliminar este profesor?")) deleteMutation.mutate(guard.id); }} className="flex-1">
                    <Trash2 className="w-3 h-3 mr-1" /> Eliminar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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

      <Card className="border-destructive/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Nuevo Curso Académico
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Elimina todos los datos (alumnos, grupos, horarios, historial, profesores y ajustes) excepto tu usuario administrador. Esta acción es irreversible.
          </p>
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
                <br />- Todos los profesores de guardia
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
