import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { TIME_SLOTS } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle, CalendarDays, Clock, FileUp, Plus, Trash2, X, Loader2, Wand2,
} from "lucide-react";

interface AbsencePeriod {
  timeSlotId: number;
  groupId: number;
}

export default function TeacherAbsencesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedSlots, setSelectedSlots] = useState<number[]>([]);
  const [periodGroups, setPeriodGroups] = useState<Record<number, number>>({});

  const classSlots = TIME_SLOTS.filter(s => !s.isBreak);

  const { data: absences = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/teacher-absences"],
  });

  const { data: allGroups = [] } = useQuery<any[]>({
    queryKey: ["/api/groups"],
  });

  const { data: mySchedule = [] } = useQuery<any[]>({
    queryKey: ["/api/teacher-schedules"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/teacher-absences", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher-absences"] });
      toast({ title: "Ausencia registrada correctamente" });
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/teacher-absences/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher-absences"] });
      toast({ title: "Ausencia eliminada" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setShowForm(false);
    setDate("");
    setNotes("");
    setSelectedSlots([]);
    setPeriodGroups({});
  }

  function toggleSlot(slotId: number) {
    setSelectedSlots(prev =>
      prev.includes(slotId) ? prev.filter(s => s !== slotId) : [...prev, slotId]
    );
  }

  function autoFillFromSchedule() {
    if (!date || mySchedule.length === 0) return;
    const d = new Date(date + "T00:00:00");
    const jsDay = d.getDay();
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;
    const dayEntries = mySchedule.filter((s: any) => s.dayOfWeek === dayOfWeek);
    if (dayEntries.length === 0) {
      toast({ title: "Sin horario", description: "No tiene clases registradas para ese día de la semana", variant: "destructive" });
      return;
    }
    const slots = dayEntries.map((e: any) => e.timeSlotId);
    const groups: Record<number, number> = {};
    dayEntries.forEach((e: any) => { groups[e.timeSlotId] = e.groupId; });
    setSelectedSlots(slots);
    setPeriodGroups(groups);
  }

  function canSubmit12h(): boolean {
    if (!date) return false;
    const absenceDate = new Date(date + "T00:00:00");
    const now = new Date();
    const diffMs = absenceDate.getTime() - now.getTime();
    return diffMs / (1000 * 60 * 60) >= 12;
  }

  function handleSubmit() {
    if (!date || selectedSlots.length === 0) {
      toast({ title: "Selecciona fecha y al menos un periodo", variant: "destructive" });
      return;
    }

    const periods: AbsencePeriod[] = selectedSlots.map(slotId => ({
      timeSlotId: slotId,
      groupId: periodGroups[slotId] || (allGroups[0]?.id ?? 0),
    }));

    const missingGroup = periods.some(p => !p.groupId);
    if (missingGroup) {
      toast({ title: "Selecciona un grupo para cada periodo", variant: "destructive" });
      return;
    }

    createMutation.mutate({ date, notes: notes || undefined, periods });
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" data-testid="badge-confirmed">Confirmada</Badge>;
      case "rejected":
        return <Badge variant="destructive" data-testid="badge-rejected">Rechazada</Badge>;
      default:
        return <Badge variant="secondary" data-testid="badge-pending">Pendiente</Badge>;
    }
  };

  return (
    <div className="space-y-6 p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold" data-testid="text-my-absences-title">Mis Ausencias</h2>
        <Button onClick={() => setShowForm(!showForm)} data-testid="button-new-absence">
          {showForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          {showForm ? "Cancelar" : "Nueva Ausencia"}
        </Button>
      </div>

      {showForm && (
        <Card data-testid="card-absence-form">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              Registrar Ausencia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Fecha</Label>
              <Input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                data-testid="input-absence-date"
              />
            </div>

            {date && !canSubmit12h() && user?.role !== "admin" && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg" data-testid="warning-12h">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium">Plazo de 12 horas excedido</p>
                  <p>No puede registrar ausencias con menos de 12 horas de antelación. Contacte con un administrador.</p>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Periodos de ausencia</Label>
                {date && mySchedule.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={autoFillFromSchedule}
                    className="h-7 text-xs"
                    data-testid="button-autofill-schedule"
                  >
                    <Wand2 className="w-3 h-3 mr-1" />
                    Rellenar desde horario
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 mt-2">
                {classSlots.map(slot => (
                  <div key={slot.id} className="flex items-center gap-3 p-2 rounded border">
                    <Checkbox
                      checked={selectedSlots.includes(slot.id)}
                      onCheckedChange={() => toggleSlot(slot.id)}
                      data-testid={`checkbox-slot-${slot.id}`}
                    />
                    <span className="text-sm font-medium min-w-[100px]">
                      <Clock className="w-3.5 h-3.5 inline mr-1" />
                      {slot.label}
                    </span>
                    {selectedSlots.includes(slot.id) && (
                      <Select
                        value={String(periodGroups[slot.id] || "")}
                        onValueChange={v => setPeriodGroups(prev => ({ ...prev, [slot.id]: Number(v) }))}
                      >
                        <SelectTrigger className="flex-1 h-8" data-testid={`select-group-slot-${slot.id}`}>
                          <SelectValue placeholder="Grupo..." />
                        </SelectTrigger>
                        <SelectContent>
                          {allGroups.map((g: any) => (
                            <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Notas (opcional)</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Motivo u observaciones..."
                data-testid="input-absence-notes"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || (!canSubmit12h() && user?.role !== "admin")}
              className="w-full"
              data-testid="button-submit-absence"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Registrar Ausencia
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : absences.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>No tiene ausencias registradas</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {absences.map((a: any) => (
            <Card key={a.id} data-testid={`card-absence-${a.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium" data-testid={`text-absence-date-${a.id}`}>{a.date}</span>
                      {statusBadge(a.status)}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {a.periods?.map((p: any) => (
                        <Badge key={p.id} variant="outline" className="text-xs">
                          {classSlots.find(s => s.id === p.timeSlotId)?.label || `Slot ${p.timeSlotId}`} — {p.groupName}
                        </Badge>
                      ))}
                    </div>
                    {a.notes && (
                      <p className="text-sm text-muted-foreground mt-1">{a.notes}</p>
                    )}
                  </div>
                  {a.status === "pending" && (() => {
                    const absenceDate = new Date(a.date + "T00:00:00");
                    const diffHours = (absenceDate.getTime() - Date.now()) / (1000 * 60 * 60);
                    const canModify = user?.role === "admin" || diffHours >= 12;
                    return canModify ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => deleteMutation.mutate(a.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-absence-${a.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-300" data-testid={`badge-locked-${a.id}`}>
                        Bloqueada
                      </Badge>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
