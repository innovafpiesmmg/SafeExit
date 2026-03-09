import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Building2, MapPin, Plus, Trash2, Loader2, UserCheck, Save, Shield } from "lucide-react";
import { DAYS_OF_WEEK, DEFAULT_TIME_SLOTS, type GuardZone, type GuardDutyAssignment, type User, type TimeSlotConfig } from "@shared/schema";

export default function GuardDutyAdminPage() {
  const [activeSection, setActiveSection] = useState<"zones" | "assignments">("zones");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-guard-duty-title">Guardias de Profesores</h1>
        <p className="text-muted-foreground">Configurar zonas de guardia y asignar profesores</p>
      </div>

      <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as any)}>
        <TabsList className="grid w-full grid-cols-2" data-testid="tabs-guard-duty-sections">
          <TabsTrigger value="zones" data-testid="tab-zones">
            <MapPin className="w-4 h-4 mr-2" />
            Zonas
          </TabsTrigger>
          <TabsTrigger value="assignments" data-testid="tab-assignments">
            <UserCheck className="w-4 h-4 mr-2" />
            Asignaciones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="zones" className="mt-4">
          <ZoneManagement />
        </TabsContent>

        <TabsContent value="assignments" className="mt-4">
          <AssignmentManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ZoneManagement() {
  const { toast } = useToast();
  const [selectedBuilding, setSelectedBuilding] = useState(1);
  const [newZoneName, setNewZoneName] = useState("");

  const { data: zones = [], isLoading } = useQuery<GuardZone[]>({
    queryKey: ["/api/guard-zones"],
  });

  const buildingZones = zones.filter(z => z.buildingNumber === selectedBuilding);

  const createZone = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/guard-zones", {
        buildingNumber: selectedBuilding,
        zoneName: newZoneName.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guard-zones"] });
      setNewZoneName("");
      toast({ title: "Zona creada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteZone = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/guard-zones/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guard-zones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/guard-duty-assignments"] });
      toast({ title: "Zona eliminada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Zonas de Guardia por Edificio
        </CardTitle>
        <CardDescription>Defina las zonas de guardia para cada edificio (máximo 6 por edificio)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={String(selectedBuilding)} onValueChange={(v) => setSelectedBuilding(parseInt(v))}>
          <TabsList className="grid w-full grid-cols-3" data-testid="tabs-buildings">
            <TabsTrigger value="1" data-testid="tab-building-1">Edificio 1</TabsTrigger>
            <TabsTrigger value="2" data-testid="tab-building-2">Edificio 2</TabsTrigger>
            <TabsTrigger value="3" data-testid="tab-building-3">Edificio 3</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-2">
          {buildingZones.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No hay zonas configuradas para este edificio</p>
          ) : (
            buildingZones.map((zone) => (
              <div
                key={zone.id}
                className="flex items-center justify-between p-3 rounded-lg border"
                data-testid={`zone-item-${zone.id}`}
              >
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="font-medium">{zone.zoneName}</span>
                  <Badge variant="outline" className="text-xs">Orden: {zone.zoneOrder}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteZone.mutate(zone.id)}
                  disabled={deleteZone.isPending}
                  data-testid={`button-delete-zone-${zone.id}`}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>

        {buildingZones.length < 6 && (
          <div className="flex gap-2">
            <Input
              placeholder="Nombre de la zona..."
              value={newZoneName}
              onChange={(e) => setNewZoneName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newZoneName.trim()) createZone.mutate();
              }}
              data-testid="input-new-zone-name"
            />
            <Button
              onClick={() => createZone.mutate()}
              disabled={!newZoneName.trim() || createZone.isPending}
              data-testid="button-add-zone"
            >
              {createZone.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </Button>
          </div>
        )}

        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Shield className="w-3 h-3" />
          Total zonas: {zones.length} (Ed.1: {zones.filter(z => z.buildingNumber === 1).length}, Ed.2: {zones.filter(z => z.buildingNumber === 2).length}, Ed.3: {zones.filter(z => z.buildingNumber === 3).length})
        </div>
      </CardContent>
    </Card>
  );
}

function AssignmentManagement() {
  const { toast } = useToast();
  const [selectedDay, setSelectedDay] = useState(1);

  const { data: zones = [] } = useQuery<GuardZone[]>({
    queryKey: ["/api/guard-zones"],
  });

  const { data: teachers = [] } = useQuery<User[]>({
    queryKey: ["/api/guards"],
  });

  const { data: assignments = [], isLoading } = useQuery<GuardDutyAssignment[]>({
    queryKey: ["/api/guard-duty-assignments", selectedDay],
    queryFn: async () => {
      const res = await fetch(`/api/guard-duty-assignments?day=${selectedDay}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error al cargar asignaciones");
      return res.json();
    },
  });

  const { data: timeSlotsData } = useQuery<{ slots: TimeSlotConfig[] }>({
    queryKey: ["/api/settings/time-slots", selectedDay],
    queryFn: async () => {
      const res = await fetch("/api/settings", { credentials: "include" });
      if (!res.ok) throw new Error("Error");
      const settings = await res.json();
      if (settings.timeSlots) {
        const config = JSON.parse(settings.timeSlots);
        return { slots: config[String(selectedDay)] || DEFAULT_TIME_SLOTS };
      }
      return { slots: DEFAULT_TIME_SLOTS };
    },
  });

  const classSlots = (timeSlotsData?.slots || DEFAULT_TIME_SLOTS).filter(s => !s.isBreak);

  const addAssignment = useMutation({
    mutationFn: async (data: { userId: number; timeSlotId: number; zoneId: number }) => {
      return apiRequest("POST", "/api/guard-duty-assignments", {
        ...data,
        dayOfWeek: selectedDay,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guard-duty-assignments", selectedDay] });
      toast({ title: "Asignación guardada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteAssignment = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/guard-duty-assignments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guard-duty-assignments", selectedDay] });
      toast({ title: "Asignación eliminada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (zones.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <MapPin className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Primero configure las zonas de guardia en la pestaña "Zonas"</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="w-5 h-5" />
          Asignaciones por Día
        </CardTitle>
        <CardDescription>Asigne profesores a las zonas y periodos de guardia</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={String(selectedDay)} onValueChange={(v) => setSelectedDay(parseInt(v))}>
          <TabsList className="grid w-full grid-cols-5" data-testid="tabs-days">
            {DAYS_OF_WEEK.map(d => (
              <TabsTrigger key={d.id} value={String(d.id)} data-testid={`tab-day-${d.id}`}>
                {d.label.slice(0, 3)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-assignments">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2 font-medium w-24">Periodo</th>
                {zones.map(z => (
                  <th key={z.id} className="text-left p-2 font-medium">
                    <div className="flex flex-col">
                      <span>{z.zoneName}</span>
                      <span className="text-xs text-muted-foreground font-normal">Ed. {z.buildingNumber}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {classSlots.map(slot => (
                <tr key={slot.id} className="border-b hover:bg-muted/50">
                  <td className="p-2">
                    <div className="text-xs font-medium">{slot.start}-{slot.end}</div>
                  </td>
                  {zones.map(zone => {
                    const cellAssignments = assignments.filter(
                      a => a.timeSlotId === slot.id && a.zoneId === zone.id
                    );
                    return (
                      <td key={zone.id} className="p-2">
                        <AssignmentCell
                          slotId={slot.id}
                          zoneId={zone.id}
                          assignments={cellAssignments}
                          teachers={teachers}
                          onAdd={(userId) => addAssignment.mutate({ userId, timeSlotId: slot.id, zoneId: zone.id })}
                          onRemove={(id) => deleteAssignment.mutate(id)}
                          adding={addAssignment.isPending}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function AssignmentCell({
  slotId,
  zoneId,
  assignments,
  teachers,
  onAdd,
  onRemove,
  adding,
}: {
  slotId: number;
  zoneId: number;
  assignments: GuardDutyAssignment[];
  teachers: User[];
  onAdd: (userId: number) => void;
  onRemove: (id: number) => void;
  adding: boolean;
}) {
  const [showSelect, setShowSelect] = useState(false);

  return (
    <div className="space-y-1 min-w-[120px]">
      {assignments.map(a => {
        const teacher = teachers.find(t => t.id === a.userId);
        return (
          <div key={a.id} className="flex items-center gap-1 bg-primary/10 rounded px-2 py-1">
            <span className="text-xs truncate flex-1">{teacher?.fullName || "?"}</span>
            <button
              onClick={() => onRemove(a.id)}
              className="text-destructive hover:text-destructive/80 flex-shrink-0"
              data-testid={`button-remove-assignment-${a.id}`}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        );
      })}

      {showSelect ? (
        <Select
          onValueChange={(val) => {
            onAdd(parseInt(val));
            setShowSelect(false);
          }}
        >
          <SelectTrigger className="h-7 text-xs" data-testid={`select-teacher-${slotId}-${zoneId}`}>
            <SelectValue placeholder="Profesor..." />
          </SelectTrigger>
          <SelectContent>
            {teachers.map(t => (
              <SelectItem key={t.id} value={String(t.id)}>{t.fullName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <button
          onClick={() => setShowSelect(true)}
          className="w-full text-xs text-muted-foreground hover:text-primary flex items-center justify-center gap-1 py-1 border border-dashed rounded hover:border-primary transition-colors"
          data-testid={`button-add-assignment-${slotId}-${zoneId}`}
        >
          <Plus className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
