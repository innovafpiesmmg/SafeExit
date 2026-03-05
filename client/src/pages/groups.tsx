import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Users, Sun, Moon } from "lucide-react";
import type { Group } from "@shared/schema";

export default function GroupsPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [form, setForm] = useState({ name: "", course: "", schedule: "morning" });

  const { data: groups, isLoading } = useQuery<Group[]>({ queryKey: ["/api/groups"] });
  const { data: students } = useQuery<any[]>({ queryKey: ["/api/students"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/groups", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({ title: "Grupo creado" });
      resetForm();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/groups/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({ title: "Grupo actualizado" });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/groups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({ title: "Grupo eliminado" });
    },
  });

  const resetForm = () => { setForm({ name: "", course: "", schedule: "morning" }); setEditing(null); setDialogOpen(false); };

  const handleEdit = (g: Group) => { setEditing(g); setForm({ name: g.name, course: g.course, schedule: g.schedule || "morning" }); setDialogOpen(true); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-groups-title">Grupos</h1>
          <p className="text-muted-foreground text-sm mt-1">{groups?.length || 0} grupos configurados</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-group"><Plus className="w-4 h-4 mr-2" />Nuevo Grupo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Grupo" : "Nuevo Grupo"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nombre del Grupo</Label>
                <Input data-testid="input-group-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: 1A" required />
              </div>
              <div className="space-y-1.5">
                <Label>Curso</Label>
                <Input data-testid="input-group-course" value={form.course} onChange={e => setForm(f => ({ ...f, course: e.target.value }))} placeholder="Ej: 1 ESO" required />
              </div>
              <div className="space-y-1.5">
                <Label>Horario</Label>
                <Select value={form.schedule} onValueChange={v => setForm(f => ({ ...f, schedule: v }))}>
                  <SelectTrigger data-testid="select-group-schedule">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning"><span className="flex items-center gap-2"><Sun className="w-4 h-4 text-amber-500" /> Mañana (tramos 1-6)</span></SelectItem>
                    <SelectItem value="afternoon"><span className="flex items-center gap-2"><Moon className="w-4 h-4 text-indigo-500" /> Tarde (tramos 7-12)</span></SelectItem>
                    <SelectItem value="full"><span className="flex items-center gap-2"><Sun className="w-4 h-4 text-amber-500" /> Completo (tramos 1-12)</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={resetForm} className="flex-1">Cancelar</Button>
                <Button type="submit" data-testid="button-save-group" className="flex-1">{editing ? "Guardar" : "Crear"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : !groups?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">No hay grupos</p>
            <p className="text-sm mt-1">Crea un grupo para empezar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {groups.map(group => {
            const count = students?.filter(s => s.groupId === group.id).length || 0;
            return (
              <Card key={group.id} data-testid={`card-group-${group.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-lg font-bold" data-testid={`text-group-name-${group.id}`}>{group.name}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground">{group.course}</p>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0" data-testid={`badge-schedule-${group.id}`}>
                          {group.schedule === "morning" ? <><Sun className="w-3 h-3 mr-0.5 text-amber-500" />Mañana</> :
                           group.schedule === "afternoon" ? <><Moon className="w-3 h-3 mr-0.5 text-indigo-500" />Tarde</> :
                           <><Sun className="w-3 h-3 mr-0.5 text-amber-500" />Completo</>}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Users className="w-4 h-4" />
                      {count}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="secondary" onClick={() => handleEdit(group)} className="flex-1" data-testid={`button-edit-group-${group.id}`}>
                      <Pencil className="w-3 h-3 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => { if (confirm("¿Eliminar grupo?")) deleteMutation.mutate(group.id); }} className="flex-1" data-testid={`button-delete-group-${group.id}`}>
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
