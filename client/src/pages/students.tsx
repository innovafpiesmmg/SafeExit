import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Pencil, Trash2, UserPlus, GraduationCap, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, Share2, Copy, Check, QrCode, Mail, UserCheck, Loader2, XCircle } from "lucide-react";
import { differenceInYears } from "date-fns";
import QRCode from "qrcode";
import type { Student, Group } from "@shared/schema";

export default function StudentsPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [shareStudent, setShareStudent] = useState<Student | null>(null);
  const [shareQrUrl, setShareQrUrl] = useState<string>("");
  const [pickupStudent, setPickupStudent] = useState<Student | null>(null);
  const [pickupList, setPickupList] = useState<{ firstName: string; lastName: string; documentId: string }[]>([]);
  const [savingPickups, setSavingPickups] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    firstName: "", lastName: "", dateOfBirth: "", course: "", groupId: 0,
    parentalAuthorization: false, busAuthorization: false, photoUrl: "", email: "",
  });

  const { data: students, isLoading } = useQuery<Student[]>({ queryKey: ["/api/students"] });
  const { data: groups } = useQuery<Group[]>({ queryKey: ["/api/groups"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/students", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      toast({ title: "Alumno creado correctamente" });
      resetForm();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/students/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      toast({ title: "Alumno actualizado" });
      resetForm();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/students/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      toast({ title: "Alumno eliminado" });
    },
  });

  const resetForm = () => {
    setForm({ firstName: "", lastName: "", dateOfBirth: "", course: "", groupId: 0, parentalAuthorization: false, busAuthorization: false, photoUrl: "", email: "" });
    setEditing(null);
    setDialogOpen(false);
  };

  const handleEdit = (s: Student) => {
    setEditing(s);
    setForm({
      firstName: s.firstName, lastName: s.lastName, dateOfBirth: s.dateOfBirth,
      course: s.course, groupId: s.groupId, parentalAuthorization: s.parentalAuthorization,
      busAuthorization: s.busAuthorization, photoUrl: s.photoUrl || "", email: s.email || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("photo", file);
    try {
      const res = await fetch("/api/upload-photo", { method: "POST", body: fd, credentials: "include" });
      const data = await res.json();
      setForm(f => ({ ...f, photoUrl: data.url }));
    } catch {
      toast({ title: "Error subiendo imagen", variant: "destructive" });
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
      const res = await fetch("/api/students/import", { method: "POST", body: fd, credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setImportResult({ imported: data.imported, errors: data.errors || [] });
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({ title: data.message });
    } catch (err: any) {
      toast({ title: "Error en la importación", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const openPickupDialog = async (student: Student) => {
    setPickupStudent(student);
    try {
      const res = await fetch(`/api/students/${student.id}/authorized-pickups`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setPickupList(data.map((p: any) => ({ firstName: p.firstName, lastName: p.lastName, documentId: p.documentId })));
      } else {
        setPickupList([]);
      }
    } catch {
      setPickupList([]);
    }
  };

  const savePickups = async () => {
    if (!pickupStudent) return;
    setSavingPickups(true);
    try {
      await apiRequest("PUT", `/api/students/${pickupStudent.id}/authorized-pickups`, { pickups: pickupList });
      toast({ title: "Personas autorizadas guardadas" });
      setPickupStudent(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSavingPickups(false);
    }
  };

  const addPickupRow = () => {
    if (pickupList.length >= 10) {
      toast({ title: "Máximo 10 personas autorizadas", variant: "destructive" });
      return;
    }
    setPickupList([...pickupList, { firstName: "", lastName: "", documentId: "" }]);
  };

  const removePickupRow = (index: number) => {
    setPickupList(pickupList.filter((_, i) => i !== index));
  };

  const updatePickupRow = (index: number, field: string, value: string) => {
    setPickupList(pickupList.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const handleShare = async (student: Student) => {
    setShareStudent(student);
    setCopied(false);
    const carnetUrl = `${window.location.origin}/carnet/${student.carnetToken}`;
    const qr = await QRCode.toDataURL(carnetUrl, { width: 300, margin: 2 });
    setShareQrUrl(qr);
  };

  const copyLink = () => {
    if (!shareStudent) return;
    navigator.clipboard.writeText(`${window.location.origin}/carnet/${shareStudent.carnetToken}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filtered = students?.filter(s => {
    const matchSearch = `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase());
    const matchGroup = groupFilter === "all" || s.groupId === parseInt(groupFilter);
    return matchSearch && matchGroup;
  }) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-students-title">Alumnos</h1>
          <p className="text-muted-foreground text-sm mt-1">{students?.length || 0} alumnos registrados</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setImportDialogOpen(true)} data-testid="button-import-excel">
            <Upload className="w-4 h-4 mr-2" />
            Importar Excel
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-student">
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Alumno
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Alumno" : "Nuevo Alumno"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nombre</Label>
                  <Input data-testid="input-first-name" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Apellidos</Label>
                  <Input data-testid="input-last-name" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Fecha de Nacimiento</Label>
                <Input data-testid="input-dob" type="date" value={form.dateOfBirth} onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Curso</Label>
                  <Input data-testid="input-course" value={form.course} onChange={e => setForm(f => ({ ...f, course: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Grupo</Label>
                  <Select value={form.groupId ? String(form.groupId) : ""} onValueChange={v => setForm(f => ({ ...f, groupId: parseInt(v) }))}>
                    <SelectTrigger data-testid="select-group"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {groups?.map(g => <SelectItem key={g.id} value={String(g.id)}>{g.name} - {g.course}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Email (para notificaciones)</Label>
                <Input data-testid="input-email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="familia@ejemplo.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Foto</Label>
                <Input data-testid="input-photo" type="file" accept="image/*" onChange={handlePhotoUpload} />
                {form.photoUrl && <img src={form.photoUrl} alt="Preview" className="w-16 h-16 rounded-md object-cover mt-2" />}
              </div>
              <div className="flex items-center gap-3">
                <Switch data-testid="switch-parental-auth" checked={form.parentalAuthorization} onCheckedChange={v => setForm(f => ({ ...f, parentalAuthorization: v }))} />
                <Label>Autorización paterna</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch data-testid="switch-bus-auth" checked={form.busAuthorization} onCheckedChange={v => setForm(f => ({ ...f, busAuthorization: v }))} />
                <Label>Autorización salida por guagua (6a hora)</Label>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={resetForm} className="flex-1">Cancelar</Button>
                <Button type="submit" data-testid="button-save-student" className="flex-1" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editing ? "Guardar Cambios" : "Crear Alumno"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input data-testid="input-search-students" placeholder="Buscar alumno..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={groupFilter} onValueChange={setGroupFilter}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-filter-group">
            <SelectValue placeholder="Todos los grupos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los grupos</SelectItem>
            {groups?.map(g => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : !filtered.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <UserPlus className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">No se encontraron alumnos</p>
            <p className="text-sm mt-1">Añade un nuevo alumno para comenzar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(student => {
            const age = differenceInYears(new Date(), new Date(student.dateOfBirth));
            const groupName = groups?.find(g => g.id === student.groupId)?.name || "";
            return (
              <Card key={student.id} data-testid={`card-student-${student.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="w-14 h-14 flex-shrink-0">
                      <AvatarImage src={student.photoUrl || undefined} />
                      <AvatarFallback className="text-sm font-medium bg-primary/10 text-primary">
                        {student.firstName[0]}{student.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm truncate" data-testid={`text-student-name-${student.id}`}>
                          {student.firstName} {student.lastName}
                        </p>
                        {age >= 18 && <Badge variant="secondary" className="text-xs flex-shrink-0">+18</Badge>}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          <GraduationCap className="w-3 h-3 mr-1" />
                          {groupName}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{student.course}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <Badge variant={student.parentalAuthorization ? "default" : "destructive"} className="text-xs">
                          {student.parentalAuthorization ? "Autorizado" : "No autorizado"}
                        </Badge>
                        {student.busAuthorization && (
                          <Badge variant="secondary" className="text-xs">Guagua</Badge>
                        )}
                        {student.email && (
                          <Badge variant="outline" className="text-xs"><Mail className="w-3 h-3 mr-1" />Email</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">{age} años</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 mt-3 pt-3 border-t">
                    <Button size="sm" variant="secondary" data-testid={`button-edit-student-${student.id}`} onClick={() => handleEdit(student)} className="flex-1">
                      <Pencil className="w-3 h-3 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="outline" data-testid={`button-pickups-student-${student.id}`} onClick={() => openPickupDialog(student)} className="flex-1">
                      <UserCheck className="w-3 h-3 mr-1" /> Autorizados
                    </Button>
                    {student.carnetToken && (
                      <Button size="sm" variant="outline" data-testid={`button-share-student-${student.id}`} onClick={() => handleShare(student)} className="flex-1">
                        <Share2 className="w-3 h-3 mr-1" /> Carnet
                      </Button>
                    )}
                    <Button size="sm" variant="destructive" data-testid={`button-delete-student-${student.id}`} onClick={() => { if (confirm("¿Eliminar alumno?")) deleteMutation.mutate(student.id); }} className="flex-1">
                      <Trash2 className="w-3 h-3 mr-1" /> Eliminar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <Dialog open={!!shareStudent} onOpenChange={(open) => { if (!open) setShareStudent(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Carnet Digital
            </DialogTitle>
          </DialogHeader>
          {shareStudent && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="font-semibold" data-testid="text-share-student-name">
                  {shareStudent.firstName} {shareStudent.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{shareStudent.course}</p>
              </div>

              {shareQrUrl && (
                <div className="flex justify-center">
                  <div className="bg-white p-3 rounded-xl border shadow-inner">
                    <img src={shareQrUrl} alt="QR del enlace al carnet" className="w-48 h-48" data-testid="img-share-qr" />
                  </div>
                </div>
              )}

              <p className="text-xs text-center text-muted-foreground">
                El alumno puede escanear este QR con su móvil para acceder a su carnet digital
              </p>

              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`${window.location.origin}/carnet/${shareStudent.carnetToken}`}
                  className="text-xs"
                  data-testid="input-share-link"
                />
                <Button size="icon" variant="outline" onClick={copyLink} data-testid="button-copy-link">
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>

              <Button className="w-full" variant="outline" data-testid="button-open-carnet" onClick={() => window.open(`/carnet/${shareStudent.carnetToken}`, "_blank")}>
                <Share2 className="w-4 h-4 mr-2" />
                Abrir carnet en nueva pestaña
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={(open) => { setImportDialogOpen(open); if (!open) setImportResult(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Importar Alumnos desde Excel
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Descarga la plantilla, rellénala con los datos de los alumnos y súbela aquí. Los grupos se crean automáticamente si no existen.
              </p>
              <Button variant="outline" className="w-full" data-testid="button-download-template" asChild>
                <a href="/api/students/template" download>
                  <Download className="w-4 h-4 mr-2" />
                  Descargar Plantilla Excel
                </a>
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Subir archivo Excel (.xlsx)</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                data-testid="input-import-file"
                onChange={handleImportFile}
                disabled={importing}
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
                  {importResult.imported} alumno(s) importado(s) correctamente
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

      <Dialog open={!!pickupStudent} onOpenChange={(open) => { if (!open) setPickupStudent(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5" />
              Personas Autorizadas para Recogida
            </DialogTitle>
          </DialogHeader>
          {pickupStudent && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={pickupStudent.photoUrl || undefined} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {pickupStudent.firstName[0]}{pickupStudent.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{pickupStudent.firstName} {pickupStudent.lastName}</p>
                  <p className="text-xs text-muted-foreground">{pickupStudent.course}</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Padres, tutores legales y personas autorizadas a recoger a este alumno (máximo 10). El guardia verificará el DNI/NIE al recoger.
              </p>

              <div className="space-y-2">
                {pickupList.map((p, i) => (
                  <div key={i} className="flex items-center gap-2" data-testid={`row-pickup-${i}`}>
                    <Input
                      placeholder="Nombre"
                      value={p.firstName}
                      onChange={e => updatePickupRow(i, "firstName", e.target.value)}
                      className="text-sm h-9"
                      data-testid={`input-pickup-firstname-${i}`}
                    />
                    <Input
                      placeholder="Apellido"
                      value={p.lastName}
                      onChange={e => updatePickupRow(i, "lastName", e.target.value)}
                      className="text-sm h-9"
                      data-testid={`input-pickup-lastname-${i}`}
                    />
                    <Input
                      placeholder="DNI/NIE"
                      value={p.documentId}
                      onChange={e => updatePickupRow(i, "documentId", e.target.value)}
                      className="text-sm h-9 w-32 flex-shrink-0"
                      data-testid={`input-pickup-document-${i}`}
                    />
                    <Button size="icon" variant="ghost" onClick={() => removePickupRow(i)} className="h-9 w-9 flex-shrink-0" data-testid={`button-remove-pickup-${i}`}>
                      <XCircle className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button variant="outline" onClick={addPickupRow} className="w-full" data-testid="button-add-pickup" disabled={pickupList.length >= 10}>
                <Plus className="w-4 h-4 mr-2" />
                Añadir persona ({pickupList.length}/10)
              </Button>

              <Button onClick={savePickups} disabled={savingPickups} className="w-full" data-testid="button-save-pickups">
                {savingPickups ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</> : "Guardar personas autorizadas"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
