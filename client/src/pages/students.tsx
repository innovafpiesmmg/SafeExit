import { useState } from "react";
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
import { Plus, Search, Pencil, Trash2, UserPlus, GraduationCap } from "lucide-react";
import { differenceInYears } from "date-fns";
import type { Student, Group } from "@shared/schema";

export default function StudentsPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);

  const [form, setForm] = useState({
    firstName: "", lastName: "", dateOfBirth: "", course: "", groupId: 0,
    parentalAuthorization: false, photoUrl: "",
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
    setForm({ firstName: "", lastName: "", dateOfBirth: "", course: "", groupId: 0, parentalAuthorization: false, photoUrl: "" });
    setEditing(null);
    setDialogOpen(false);
  };

  const handleEdit = (s: Student) => {
    setEditing(s);
    setForm({
      firstName: s.firstName, lastName: s.lastName, dateOfBirth: s.dateOfBirth,
      course: s.course, groupId: s.groupId, parentalAuthorization: s.parentalAuthorization,
      photoUrl: s.photoUrl || "",
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
                <Label>Foto</Label>
                <Input data-testid="input-photo" type="file" accept="image/*" onChange={handlePhotoUpload} />
                {form.photoUrl && <img src={form.photoUrl} alt="Preview" className="w-16 h-16 rounded-md object-cover mt-2" />}
              </div>
              <div className="flex items-center gap-3">
                <Switch data-testid="switch-parental-auth" checked={form.parentalAuthorization} onCheckedChange={v => setForm(f => ({ ...f, parentalAuthorization: v }))} />
                <Label>Autorización paterna</Label>
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
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant={student.parentalAuthorization ? "default" : "destructive"} className="text-xs">
                          {student.parentalAuthorization ? "Autorizado" : "No autorizado"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{age} años</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 mt-3 pt-3 border-t">
                    <Button size="sm" variant="secondary" data-testid={`button-edit-student-${student.id}`} onClick={() => handleEdit(student)} className="flex-1">
                      <Pencil className="w-3 h-3 mr-1" /> Editar
                    </Button>
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
    </div>
  );
}
