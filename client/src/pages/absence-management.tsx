import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TIME_SLOTS, DAYS_OF_WEEK, DEFAULT_TIME_SLOTS } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle, ArrowRight, CalendarDays, Check, Clock, DoorOpen, Loader2,
  MoveRight, Plus, Shield, Trash2, UserCheck, Users, X,
} from "lucide-react";

export default function AbsenceManagementPage() {
  const { toast } = useToast();
  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAbsenceUserId, setNewAbsenceUserId] = useState("");
  const [newAbsenceNotes, setNewAbsenceNotes] = useState("");
  const [newAbsenceSlots, setNewAbsenceSlots] = useState<number[]>([]);
  const [newAbsencePeriodGroups, setNewAbsencePeriodGroups] = useState<Record<number, number>>({});

  const classSlots = TIME_SLOTS.filter(s => !s.isBreak);
  const allClassSlotIds = DEFAULT_TIME_SLOTS.filter(s => !s.isBreak).map(s => s.id).sort((a, b) => a - b);

  const { data: absences = [], isLoading: loadingAbsences } = useQuery<any[]>({
    queryKey: ["/api/teacher-absences", `?dateFrom=${selectedDate}&dateTo=${selectedDate}`],
  });

  const { data: unattendedSlots = [], isLoading: loadingSlots } = useQuery<any[]>({
    queryKey: ["/api/absences/unattended", `?date=${selectedDate}`],
  });

  const { data: staffList = [] } = useQuery<any[]>({
    queryKey: ["/api/staff-list"],
  });

  const { data: allGroups = [] } = useQuery<any[]>({
    queryKey: ["/api/groups"],
  });

  const { data: advancements = [] } = useQuery<any[]>({
    queryKey: ["/api/hour-advancements", `?date=${selectedDate}`],
  });

  const selectedDayOfWeek = (() => {
    const d = new Date(selectedDate + "T12:00:00");
    const jsDay = d.getDay();
    return jsDay === 0 ? 7 : jsDay;
  })();

  const { data: groupScheduledSlots = {} } = useQuery<Record<number, number[]>>({
    queryKey: ["/api/group-scheduled-slots", `?day=${selectedDayOfWeek}`],
    enabled: selectedDayOfWeek >= 1 && selectedDayOfWeek <= 5,
  });

  const { data: dutyAssignments = [] } = useQuery<any[]>({
    queryKey: ["/api/guard-duty-assignments", `?day=${selectedDayOfWeek}`],
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("PATCH", `/api/teacher-absences/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher-absences"] });
      queryClient.invalidateQueries({ queryKey: ["/api/absences/unattended"] });
      toast({ title: "Estado actualizado" });
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
      queryClient.invalidateQueries({ queryKey: ["/api/absences/unattended"] });
      toast({ title: "Ausencia eliminada" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/teacher-absences", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher-absences"] });
      queryClient.invalidateQueries({ queryKey: ["/api/absences/unattended"] });
      toast({ title: "Ausencia registrada" });
      setShowCreateForm(false);
      setNewAbsenceUserId("");
      setNewAbsenceNotes("");
      setNewAbsenceSlots([]);
      setNewAbsencePeriodGroups({});
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const coverageMutation = useMutation({
    mutationFn: async (data: { absencePeriodId: number; guardUserId: number; date: string }) => {
      const res = await apiRequest("POST", "/api/guard-coverages", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/absences/unattended"] });
      toast({ title: "Guardia asignada" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const removeCoverageMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/guard-coverages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/absences/unattended"] });
      toast({ title: "Asignación eliminada" });
    },
  });

  const advancementMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/hour-advancements", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hour-advancements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/absences/unattended"] });
      toast({ title: "Adelanto registrado" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteAdvancementMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/hour-advancements/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hour-advancements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/absences/unattended"] });
      toast({ title: "Adelanto eliminado" });
    },
  });

  const earlyExitMutation = useMutation({
    mutationFn: async (data: { date: string; groupId: number; fromSlot: number }) => {
      const res = await apiRequest("POST", "/api/authorize-early-exit", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/absences/unattended"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hour-advancements"] });
      toast({ title: "Salida autorizada", description: data.message });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const absentTeacherIds = new Set(absences.filter((a: any) => a.status !== "rejected").map((a: any) => a.userId));

  const availableGuards = dutyAssignments
    .filter((a: any) => !absentTeacherIds.has(a.userId))
    .map((a: any) => {
      const staff = staffList.find((s: any) => s.id === a.userId);
      return { ...a, fullName: staff?.fullName || `Usuario ${a.userId}` };
    });

  function getAvailableGuardsForSlot(timeSlotId: number) {
    return availableGuards.filter((g: any) => g.timeSlotId === timeSlotId);
  }

  const slotsGroupedByTime: Record<number, any[]> = {};
  for (const slot of unattendedSlots) {
    if (!slotsGroupedByTime[slot.timeSlotId]) {
      slotsGroupedByTime[slot.timeSlotId] = [];
    }
    slotsGroupedByTime[slot.timeSlotId].push(slot);
  }

  const uncoveredCount = unattendedSlots.filter((s: any) => !s.coverage).length;
  const dayLabel = DAYS_OF_WEEK.find(d => d.id === selectedDayOfWeek)?.label || "";

  const affectedGroups = new Map<number, { groupName: string; freeSlots: number[] }>();
  for (const slot of unattendedSlots) {
    if (slot.coverage) continue;
    if (!affectedGroups.has(slot.groupId)) {
      affectedGroups.set(slot.groupId, { groupName: slot.groupName, freeSlots: [] });
    }
    const g = affectedGroups.get(slot.groupId)!;
    if (!g.freeSlots.includes(slot.timeSlotId)) {
      g.freeSlots.push(slot.timeSlotId);
    }
  }
  for (const adv of advancements) {
    if (!affectedGroups.has(adv.groupId)) {
      affectedGroups.set(adv.groupId, { groupName: adv.groupName, freeSlots: [] });
    }
    const g = affectedGroups.get(adv.groupId)!;
    g.freeSlots = g.freeSlots.filter(s => s !== adv.originalSlotId);
    if (!g.freeSlots.includes(adv.targetSlotId)) {
      g.freeSlots.push(adv.targetSlotId);
    }
  }

  function getGroupSlots(groupId: number): number[] {
    const scheduled = groupScheduledSlots[groupId];
    return scheduled && scheduled.length > 0 ? scheduled : allClassSlotIds;
  }

  function canAuthorizeEarlyExit(groupId: number): { canAuthorize: boolean; fromSlot: number | null } {
    const group = affectedGroups.get(groupId);
    if (!group) return { canAuthorize: false, fromSlot: null };

    const freeSlots = group.freeSlots.sort((a, b) => a - b);
    if (freeSlots.length === 0) return { canAuthorize: false, fromSlot: null };

    const groupSlots = getGroupSlots(groupId);

    for (let i = groupSlots.length - 1; i >= 0; i--) {
      const slotId = groupSlots[i];
      if (!freeSlots.includes(slotId)) {
        const fromSlot = groupSlots[i + 1];
        if (fromSlot && freeSlots.includes(fromSlot)) {
          const tail = groupSlots.slice(i + 1);
          const allTailFree = tail.every(s => freeSlots.includes(s));
          if (allTailFree && tail.length > 0) {
            return { canAuthorize: true, fromSlot };
          }
        }
        return { canAuthorize: false, fromSlot: null };
      }
    }

    return { canAuthorize: true, fromSlot: groupSlots[0] };
  }

  function handleCreateAbsence() {
    if (!newAbsenceUserId || newAbsenceSlots.length === 0) {
      toast({ title: "Selecciona profesor y periodos", variant: "destructive" });
      return;
    }
    const periods = newAbsenceSlots.map(slotId => ({
      timeSlotId: slotId,
      groupId: newAbsencePeriodGroups[slotId] || 0,
    }));
    if (periods.some(p => !p.groupId)) {
      toast({ title: "Selecciona un grupo para cada periodo", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      userId: Number(newAbsenceUserId),
      date: selectedDate,
      notes: newAbsenceNotes || undefined,
      periods,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold" data-testid="text-absence-management-title">Gestión de Ausencias</h1>
        <div className="flex items-center gap-3">
          <Input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="w-auto"
            data-testid="input-management-date"
          />
          <Button onClick={() => setShowCreateForm(!showCreateForm)} data-testid="button-admin-new-absence">
            {showCreateForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            {showCreateForm ? "Cancelar" : "Registrar Ausencia"}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarDays className="w-4 h-4" />
        <span>{dayLabel} — {selectedDate}</span>
        {uncoveredCount > 0 && (
          <Badge variant="destructive" data-testid="badge-uncovered-count">
            {uncoveredCount} hora{uncoveredCount !== 1 ? "s" : ""} sin cubrir
          </Badge>
        )}
        {advancements.length > 0 && (
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" data-testid="badge-advancements-count">
            {advancements.length} adelanto{advancements.length !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {showCreateForm && (
        <Card data-testid="card-admin-absence-form">
          <CardHeader>
            <CardTitle className="text-lg">Registrar ausencia (admin)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Profesor</Label>
              <Select value={newAbsenceUserId} onValueChange={setNewAbsenceUserId}>
                <SelectTrigger data-testid="select-absence-teacher">
                  <SelectValue placeholder="Seleccionar profesor..." />
                </SelectTrigger>
                <SelectContent>
                  {staffList.map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Periodos</Label>
              <div className="grid grid-cols-1 gap-2 mt-2">
                {classSlots.map(slot => (
                  <div key={slot.id} className="flex items-center gap-3 p-2 rounded border">
                    <Checkbox
                      checked={newAbsenceSlots.includes(slot.id)}
                      onCheckedChange={() =>
                        setNewAbsenceSlots(prev =>
                          prev.includes(slot.id) ? prev.filter(s => s !== slot.id) : [...prev, slot.id]
                        )
                      }
                      data-testid={`checkbox-admin-slot-${slot.id}`}
                    />
                    <span className="text-sm font-medium min-w-[100px]">{slot.label}</span>
                    {newAbsenceSlots.includes(slot.id) && (
                      <Select
                        value={String(newAbsencePeriodGroups[slot.id] || "")}
                        onValueChange={v => setNewAbsencePeriodGroups(prev => ({ ...prev, [slot.id]: Number(v) }))}
                      >
                        <SelectTrigger className="flex-1 h-8" data-testid={`select-admin-group-${slot.id}`}>
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
              <Label>Notas</Label>
              <Textarea value={newAbsenceNotes} onChange={e => setNewAbsenceNotes(e.target.value)} data-testid="input-admin-absence-notes" />
            </div>
            <Button onClick={handleCreateAbsence} disabled={createMutation.isPending} className="w-full" data-testid="button-admin-submit-absence">
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Registrar
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="engine">
        <TabsList data-testid="tabs-absence-management">
          <TabsTrigger value="engine" data-testid="tab-engine">
            <Shield className="w-4 h-4 mr-2" />
            Motor de Guardias
          </TabsTrigger>
          <TabsTrigger value="advancements" data-testid="tab-advancements">
            <MoveRight className="w-4 h-4 mr-2" />
            Adelantos
          </TabsTrigger>
          <TabsTrigger value="absences" data-testid="tab-absences">
            <Users className="w-4 h-4 mr-2" />
            Ausencias ({absences.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="engine" className="space-y-4 mt-4">
          {loadingSlots ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : Object.keys(slotsGroupedByTime).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Check className="w-10 h-10 mx-auto mb-3 text-emerald-500" />
                <p className="font-medium">No hay horas sin cubrir para este día</p>
              </CardContent>
            </Card>
          ) : (
            Object.entries(slotsGroupedByTime)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([timeSlotId, slots]) => {
                const slotInfo = classSlots.find(s => s.id === Number(timeSlotId));
                const guardsForSlot = getAvailableGuardsForSlot(Number(timeSlotId));

                return (
                  <Card key={timeSlotId} data-testid={`card-slot-${timeSlotId}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {slotInfo?.label || `Hora ${timeSlotId}`}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {slots.map((slot: any) => (
                        <UnattendedSlotRow
                          key={slot.periodId}
                          slot={slot}
                          guardsForSlot={guardsForSlot}
                          coverageMutation={coverageMutation}
                          removeCoverageMutation={removeCoverageMutation}
                          selectedDate={selectedDate}
                          classSlots={classSlots}
                          allClassSlotIds={allClassSlotIds}
                          staffList={staffList}
                          advancementMutation={advancementMutation}
                          unattendedSlots={unattendedSlots}
                        />
                      ))}

                      {guardsForSlot.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Guardias disponibles:</span>{" "}
                          {guardsForSlot.map((g: any) => g.fullName).join(", ")}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
          )}

          {affectedGroups.size > 0 && (
            <Card className="border-blue-200 dark:border-blue-800" data-testid="card-early-exit-suggestions">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DoorOpen className="w-4 h-4 text-blue-600" />
                  Salida anticipada
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Array.from(affectedGroups.entries()).map(([groupId, groupData]) => {
                  const { canAuthorize, fromSlot } = canAuthorizeEarlyExit(groupId);
                  if (!canAuthorize || !fromSlot) return null;

                  const fromSlotInfo = classSlots.find(s => s.id === fromSlot);
                  const gSlots = getGroupSlots(groupId);
                  const freeCount = gSlots.filter(s => s >= fromSlot).length;

                  return (
                    <div
                      key={groupId}
                      className="p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950"
                      data-testid={`early-exit-group-${groupId}`}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="font-medium text-sm">{groupData.groupName}</p>
                          <p className="text-xs text-muted-foreground">
                            {freeCount} hora{freeCount !== 1 ? "s" : ""} libre{freeCount !== 1 ? "s" : ""} al final del horario — desde {fromSlotInfo?.label || `Tramo ${fromSlot}`}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700"
                          onClick={() => earlyExitMutation.mutate({ date: selectedDate, groupId, fromSlot })}
                          disabled={earlyExitMutation.isPending}
                          data-testid={`button-authorize-early-exit-${groupId}`}
                        >
                          {earlyExitMutation.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                          ) : (
                            <DoorOpen className="w-3.5 h-3.5 mr-1" />
                          )}
                          Autorizar salida
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {Array.from(affectedGroups.entries()).every(([gId]) => !canAuthorizeEarlyExit(gId).canAuthorize) && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No hay grupos con horas libres consecutivas al final del horario para autorizar salida anticipada.
                    Use la pestaña "Adelantos" para reorganizar las horas.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="advancements" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MoveRight className="w-4 h-4" />
                ¿Cómo funciona?
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Cuando un profesor falta en una hora intermedia, puede <strong>adelantar</strong> la clase
                de otro profesor que tenga clase con el mismo grupo más tarde. Así la hora libre se desplaza
                al final del horario y el grupo puede salir antes.
              </p>
              <p>
                1. En el "Motor de Guardias", pulse <strong>"Adelantar"</strong> en un hueco sin cubrir.<br />
                2. Seleccione qué profesor adelanta su clase y desde qué tramo posterior.<br />
                3. Cuando las últimas horas queden libres, pulse <strong>"Autorizar salida"</strong>.
              </p>
            </CardContent>
          </Card>

          {advancements.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <MoveRight className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p>No hay adelantos registrados para este día</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {advancements.map((adv: any) => {
                const origSlot = classSlots.find(s => s.id === adv.originalSlotId);
                const targetSlot = classSlots.find(s => s.id === adv.targetSlotId);
                return (
                  <Card key={adv.id} data-testid={`card-advancement-${adv.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">{adv.groupName}</Badge>
                            <span className="font-medium text-sm">{adv.teacherName}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                              {targetSlot?.label || `Tramo ${adv.targetSlotId}`}
                            </Badge>
                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                              {origSlot?.label || `Tramo ${adv.originalSlotId}`}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Clase movida de {targetSlot?.label} a {origSlot?.label} — {targetSlot?.label} queda libre
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => deleteAdvancementMutation.mutate(adv.id)}
                          data-testid={`button-delete-advancement-${adv.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="absences" className="space-y-3 mt-4">
          {loadingAbsences ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : absences.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p>No hay ausencias registradas para este día</p>
              </CardContent>
            </Card>
          ) : (
            absences.map((a: any) => (
              <Card key={a.id} data-testid={`card-admin-absence-${a.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{a.userName}</span>
                        {a.status === "confirmed" && (
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">Confirmada</Badge>
                        )}
                        {a.status === "rejected" && <Badge variant="destructive">Rechazada</Badge>}
                        {a.status === "pending" && <Badge variant="secondary">Pendiente</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {a.periods?.map((p: any) => (
                          <Badge key={p.id} variant="outline" className="text-xs">
                            {classSlots.find(s => s.id === p.timeSlotId)?.label || `Slot ${p.timeSlotId}`} — {p.groupName}
                          </Badge>
                        ))}
                      </div>
                      {a.notes && <p className="text-sm text-muted-foreground">{a.notes}</p>}
                      <p className="text-xs text-muted-foreground">Registrada por: {a.createdByName}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {a.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-emerald-600"
                            onClick={() => statusMutation.mutate({ id: a.id, status: "confirmed" })}
                            disabled={statusMutation.isPending}
                            data-testid={`button-confirm-absence-${a.id}`}
                          >
                            <Check className="w-3.5 h-3.5 mr-1" />
                            Confirmar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive"
                            onClick={() => statusMutation.mutate({ id: a.id, status: "rejected" })}
                            disabled={statusMutation.isPending}
                            data-testid={`button-reject-absence-${a.id}`}
                          >
                            <X className="w-3.5 h-3.5 mr-1" />
                            Rechazar
                          </Button>
                        </>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => deleteMutation.mutate(a.id)}
                        data-testid={`button-admin-delete-absence-${a.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UnattendedSlotRow({
  slot,
  guardsForSlot,
  coverageMutation,
  removeCoverageMutation,
  selectedDate,
  classSlots,
  allClassSlotIds,
  staffList,
  advancementMutation,
  unattendedSlots,
}: {
  slot: any;
  guardsForSlot: any[];
  coverageMutation: any;
  removeCoverageMutation: any;
  selectedDate: string;
  classSlots: any[];
  allClassSlotIds: number[];
  staffList: any[];
  advancementMutation: any;
  unattendedSlots: any[];
}) {
  const [showAdvanceForm, setShowAdvanceForm] = useState(false);
  const [advTeacherId, setAdvTeacherId] = useState("");
  const [advTargetSlot, setAdvTargetSlot] = useState("");

  const laterSlots = allClassSlotIds.filter(s => s > slot.timeSlotId);

  function handleCreateAdvancement() {
    if (!advTeacherId || !advTargetSlot) return;
    advancementMutation.mutate({
      date: selectedDate,
      groupId: slot.groupId,
      originalSlotId: slot.timeSlotId,
      targetSlotId: Number(advTargetSlot),
      teacherUserId: Number(advTeacherId),
      absencePeriodId: slot.periodId,
    });
    setShowAdvanceForm(false);
    setAdvTeacherId("");
    setAdvTargetSlot("");
  }

  return (
    <div
      className={`p-3 rounded-lg border ${
        slot.coverage
          ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800"
          : slot.advancement
          ? "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
          : "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
      }`}
      data-testid={`slot-period-${slot.periodId}`}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="font-medium text-sm">{slot.groupName}</p>
          <p className="text-xs text-muted-foreground">
            Ausente: {slot.absentTeacherName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {slot.coverage ? (
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                <UserCheck className="w-3 h-3 mr-1" />
                {slot.coverage.guardUserName}
              </Badge>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive"
                onClick={() => removeCoverageMutation.mutate(slot.coverage.id)}
                data-testid={`button-remove-coverage-${slot.periodId}`}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : slot.advancement ? (
            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              <MoveRight className="w-3 h-3 mr-1" />
              Adelantada: {slot.advancement.teacherName}
            </Badge>
          ) : (
            <div className="flex items-center gap-1">
              <Select
                onValueChange={v => {
                  coverageMutation.mutate({
                    absencePeriodId: slot.periodId,
                    guardUserId: Number(v),
                    date: selectedDate,
                  });
                }}
              >
                <SelectTrigger className="h-8 w-[150px]" data-testid={`select-coverage-${slot.periodId}`}>
                  <SelectValue placeholder="Asignar guardia" />
                </SelectTrigger>
                <SelectContent>
                  {guardsForSlot.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      No hay guardias disponibles
                    </div>
                  ) : (
                    guardsForSlot.map((g: any) => (
                      <SelectItem key={g.id} value={String(g.userId)}>
                        {g.fullName}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {laterSlots.length > 0 && slot.allowAdvancement !== false && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-blue-600 border-blue-300"
                  onClick={() => setShowAdvanceForm(!showAdvanceForm)}
                  data-testid={`button-advance-${slot.periodId}`}
                >
                  <MoveRight className="w-3.5 h-3.5 mr-1" />
                  Adelantar
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {showAdvanceForm && (
        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800 space-y-2">
          <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
            Adelantar clase al tramo {classSlots.find(s => s.id === slot.timeSlotId)?.label}
          </p>
          <div className="flex gap-2 flex-wrap">
            <Select value={advTeacherId} onValueChange={setAdvTeacherId}>
              <SelectTrigger className="h-8 flex-1 min-w-[140px]" data-testid={`select-adv-teacher-${slot.periodId}`}>
                <SelectValue placeholder="Profesor que adelanta..." />
              </SelectTrigger>
              <SelectContent>
                {staffList.map((s: any) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={advTargetSlot} onValueChange={setAdvTargetSlot}>
              <SelectTrigger className="h-8 w-[140px]" data-testid={`select-adv-slot-${slot.periodId}`}>
                <SelectValue placeholder="Desde tramo..." />
              </SelectTrigger>
              <SelectContent>
                {laterSlots.map(slotId => {
                  const info = classSlots.find(s => s.id === slotId);
                  return (
                    <SelectItem key={slotId} value={String(slotId)}>
                      {info?.label || `Tramo ${slotId}`}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-8 bg-blue-600 hover:bg-blue-700"
              onClick={handleCreateAdvancement}
              disabled={!advTeacherId || !advTargetSlot || advancementMutation.isPending}
              data-testid={`button-confirm-advance-${slot.periodId}`}
            >
              {advancementMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={() => setShowAdvanceForm(false)}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
