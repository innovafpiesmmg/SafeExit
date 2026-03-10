import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { TIME_SLOTS } from "@shared/schema";
import type { Group } from "@shared/schema";
import { Download, Upload, Trash2, Save, Calendar, Users, User, Shield, Clock, Ban } from "lucide-react";

const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const classSlots = TIME_SLOTS.filter(s => !s.isBreak);

type ViewMode = "teacher" | "group";

const SLOT_TYPES = [
  { value: "class", label: "Clase", shortLabel: "Clase", icon: Users, color: "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300" },
  { value: "guard", label: "Guardia", shortLabel: "Guardia", icon: Shield, color: "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300" },
  { value: "permanence", label: "Permanencia", shortLabel: "Perman.", icon: Clock, color: "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300" },
  { value: "blocked", label: "Bloqueada", shortLabel: "Bloq.", icon: Ban, color: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300" },
];

function getSlotTypeInfo(type: string) {
  return SLOT_TYPES.find(s => s.value === type) || SLOT_TYPES[0];
}

interface CellData {
  slotType: string;
  groupId: number | null;
}

function ScheduleCell({ cell, groups, onChange }: {
  cell: CellData;
  groups: Group[];
  onChange: (slotType: string, groupId: number | null) => void;
}) {
  const typeInfo = getSlotTypeInfo(cell.slotType);
  const isClass = cell.slotType === "class";

  return (
    <div className="space-y-1">
      <Select
        value={cell.slotType || "empty"}
        onValueChange={v => {
          if (v === "empty") {
            onChange("empty", null);
          } else {
            onChange(v, v === "class" ? cell.groupId : null);
          }
        }}
      >
        <SelectTrigger
          className={`h-7 text-[11px] ${cell.slotType && cell.slotType !== "empty" ? typeInfo.color : "border-dashed"}`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="empty">—</SelectItem>
          {SLOT_TYPES.map(st => (
            <SelectItem key={st.value} value={st.value}>
              <span className="flex items-center gap-1.5">
                <st.icon className="w-3 h-3" />
                {st.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isClass && (
        <Select
          value={cell.groupId ? String(cell.groupId) : "empty"}
          onValueChange={v => onChange("class", v === "empty" ? null : Number(v))}
        >
          <SelectTrigger className="h-7 text-[11px] bg-blue-50 dark:bg-blue-950 border-blue-200">
            <SelectValue placeholder="Grupo..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="empty">Sin grupo</SelectItem>
            {groups.map(g => (
              <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function GroupScheduleView({ groups, allSchedules, staffList, isLoading }: {
  groups: Group[];
  allSchedules: any[];
  staffList: any[];
  isLoading: boolean;
}) {
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

  const groupsWithSchedule = useMemo(() => {
    const ids = new Set(allSchedules.filter((s: any) => s.groupId).map((s: any) => s.groupId));
    return groups.filter(g => ids.has(g.id));
  }, [groups, allSchedules]);

  const staffMap = useMemo(() => {
    const m: Record<number, string> = {};
    staffList.forEach(t => { m[t.id] = t.fullName; });
    return m;
  }, [staffList]);

  const groupGrid = useMemo(() => {
    if (!selectedGroupId) return {};
    const g: Record<string, { userId: number; teacherName: string } | null> = {};
    for (let day = 1; day <= 5; day++) {
      for (const slot of classSlots) {
        const key = `${day}-${slot.id}`;
        const entry = allSchedules.find((s: any) => s.groupId === selectedGroupId && s.dayOfWeek === day && s.timeSlotId === slot.id && s.slotType === "class");
        g[key] = entry ? { userId: entry.userId, teacherName: entry.teacherName || staffMap[entry.userId] || "—" } : null;
      }
    }
    return g;
  }, [allSchedules, selectedGroupId, staffMap]);

  const totalSlots = useMemo(() => {
    if (!selectedGroupId) return 0;
    return allSchedules.filter((s: any) => s.groupId === selectedGroupId && s.slotType === "class").length;
  }, [allSchedules, selectedGroupId]);

  const teacherColors = useMemo(() => {
    const colors = [
      "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300",
      "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300",
      "bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300",
      "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300",
      "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300",
      "bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300",
      "bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300",
      "bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300",
      "bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300",
      "bg-pink-50 dark:bg-pink-950 text-pink-700 dark:text-pink-300",
    ];
    const map: Record<number, string> = {};
    let idx = 0;
    Object.values(groupGrid).forEach(v => {
      if (v && !(v.userId in map)) {
        map[v.userId] = colors[idx % colors.length];
        idx++;
      }
    });
    return map;
  }, [groupGrid]);

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Seleccionar Grupo</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedGroupId ? String(selectedGroupId) : ""}
            onValueChange={v => setSelectedGroupId(Number(v))}
          >
            <SelectTrigger className="w-[300px]" data-testid="select-group-view">
              <SelectValue placeholder="Selecciona un grupo..." />
            </SelectTrigger>
            <SelectContent>
              {groups.map(g => {
                const hasEntries = groupsWithSchedule.some(gw => gw.id === g.id);
                return (
                  <SelectItem key={g.id} value={String(g.id)}>
                    <span className="flex items-center gap-2">
                      {g.name}
                      {hasEntries && <Badge variant="outline" className="text-[10px] px-1 py-0 text-green-600 border-green-300">horario</Badge>}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedGroupId ? (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base" data-testid="text-group-schedule-title">
                Horario de {groups.find(g => g.id === selectedGroupId)?.name}
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                {totalSlots} clase(s) asignadas
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-group-schedule">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-2 text-left font-medium w-[120px]">Tramo</th>
                  {DAY_NAMES.map((day, i) => (
                    <th key={i} className="p-2 text-center font-medium">{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {classSlots.map(slot => (
                  <tr key={slot.id} className="border-b hover:bg-muted/30">
                    <td className="p-2">
                      <span className="text-xs font-medium">{slot.label}</span>
                      <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">
                        {slot.period === "morning" ? "M" : "T"}{slot.id <= 6 ? slot.id : slot.id - 6}
                      </Badge>
                    </td>
                    {[1, 2, 3, 4, 5].map(day => {
                      const key = `${day}-${slot.id}`;
                      const entry = groupGrid[key];
                      return (
                        <td key={day} className="p-1 text-center" data-testid={`group-cell-${day}-${slot.id}`}>
                          {entry ? (
                            <div className={`rounded-md px-2 py-1.5 text-xs font-medium ${teacherColors[entry.userId] || "bg-muted"}`}>
                              {entry.teacherName}
                            </div>
                          ) : (
                            <div className="rounded-md px-2 py-1.5 text-xs text-muted-foreground border border-dashed">
                              —
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">Selecciona un grupo</p>
            <p className="text-sm mt-1">Elige un grupo del desplegable para ver qué profesores le dan clase en cada tramo horario</p>
          </CardContent>
        </Card>
      )}

      {!selectedGroupId && groupsWithSchedule.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Resumen por Grupo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {groups.map(g => {
                const entries = allSchedules.filter((s: any) => s.groupId === g.id && s.slotType === "class");
                const teachers = new Set(entries.map((e: any) => e.userId));
                return (
                  <div
                    key={g.id}
                    className={`p-3 rounded-lg border cursor-pointer hover:bg-accent transition-colors ${entries.length > 0 ? "border-green-200 bg-green-50/50 dark:bg-green-950/30 dark:border-green-800" : ""}`}
                    onClick={() => setSelectedGroupId(g.id)}
                    data-testid={`summary-group-${g.id}`}
                  >
                    <p className="font-medium text-sm">{g.name}</p>
                    {entries.length > 0 ? (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {entries.length} clase(s) · {teachers.size} profesor(es)
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-0.5">Sin horario asignado</p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function TeacherSchedulesPage() {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("teacher");
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
  const [grid, setGrid] = useState<Record<string, CellData>>({});
  const [dirty, setDirty] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: staffList = [] } = useQuery<any[]>({ queryKey: ["/api/guards"] });
  const { data: groups = [] } = useQuery<Group[]>({ queryKey: ["/api/groups"] });
  const { data: allSchedules = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/teacher-schedules"] });

  useEffect(() => {
    if (selectedTeacherId) {
      const schedules = allSchedules.filter((s: any) => s.userId === selectedTeacherId);
      loadGrid(schedules);
    }
  }, [allSchedules, selectedTeacherId]);

  const loadGrid = (schedules: any[]) => {
    const g: Record<string, CellData> = {};
    for (let day = 1; day <= 5; day++) {
      for (const slot of classSlots) {
        const key = `${day}-${slot.id}`;
        const entry = schedules.find((s: any) => s.dayOfWeek === day && s.timeSlotId === slot.id);
        g[key] = entry
          ? { slotType: entry.slotType || "class", groupId: entry.groupId || null }
          : { slotType: "empty", groupId: null };
      }
    }
    setGrid(g);
    setDirty(false);
  };

  const handleSelectTeacher = (id: string) => {
    setSelectedTeacherId(Number(id));
    setDirty(false);
  };

  const handleCellChange = (day: number, slotId: number, slotType: string, groupId: number | null) => {
    const key = `${day}-${slotId}`;
    setGrid(g => ({ ...g, [key]: { slotType, groupId } }));
    setDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTeacherId) return;
      const entries: any[] = [];
      for (const [key, cell] of Object.entries(grid)) {
        if (!cell.slotType || cell.slotType === "empty") continue;
        if (cell.slotType === "class" && !cell.groupId) continue;
        const [day, slotId] = key.split("-").map(Number);
        entries.push({ dayOfWeek: day, timeSlotId: slotId, groupId: cell.groupId, slotType: cell.slotType });
      }
      return apiRequest("PUT", `/api/teacher-schedules/${selectedTeacherId}`, entries);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher-schedules"] });
      toast({ title: "Horario guardado" });
      setDirty(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTeacherId) return;
      return apiRequest("DELETE", `/api/teacher-schedules/${selectedTeacherId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher-schedules"] });
      loadGrid([]);
      toast({ title: "Horario limpiado" });
    },
  });

  const handleDownloadTemplate = async () => {
    const res = await fetch("/api/teacher-schedules/template", { credentials: "include" });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla_horarios.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/teacher-schedules/import", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      } else {
        toast({ title: data.message });
        if (data.errors?.length) {
          toast({ title: "Errores", description: data.errors.join("; "), variant: "destructive" });
        }
        queryClient.invalidateQueries({ queryKey: ["/api/teacher-schedules"] });
      }
    } catch {
      toast({ title: "Error al importar", variant: "destructive" });
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const teachersWithSchedule = useMemo(() => {
    const ids = new Set(allSchedules.map((s: any) => s.userId));
    return ids.size;
  }, [allSchedules]);

  const getTeacherSummary = (entries: any[]) => {
    const classes = entries.filter((e: any) => (e.slotType || "class") === "class").length;
    const guards = entries.filter((e: any) => e.slotType === "guard").length;
    const permanence = entries.filter((e: any) => e.slotType === "permanence").length;
    const blocked = entries.filter((e: any) => e.slotType === "blocked").length;
    const parts = [];
    if (classes) parts.push(`${classes} clase(s)`);
    if (guards) parts.push(`${guards} guardia(s)`);
    if (permanence) parts.push(`${permanence} perm.`);
    if (blocked) parts.push(`${blocked} bloq.`);
    return parts.join(" · ") || "Sin horario";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-schedules-title">Horarios del Profesorado</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {teachersWithSchedule} profesor(es) con horario · {allSchedules.length} entradas totales
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex rounded-lg border overflow-hidden">
            <button
              onClick={() => { setViewMode("teacher"); setSelectedTeacherId(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${viewMode === "teacher" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
              data-testid="button-view-teacher"
            >
              <User className="w-3.5 h-3.5" />
              Por Profesor
            </button>
            <button
              onClick={() => { setViewMode("group"); setSelectedTeacherId(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${viewMode === "group" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
              data-testid="button-view-group"
            >
              <Users className="w-3.5 h-3.5" />
              Por Grupo
            </button>
          </div>
          {viewMode === "teacher" && (
            <>
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate} data-testid="button-download-template">
                <Download className="w-4 h-4 mr-1" /> Plantilla
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} data-testid="button-import">
                <Upload className="w-4 h-4 mr-1" /> Importar Excel
              </Button>
              <input
                type="file"
                ref={fileRef}
                className="hidden"
                accept=".xlsx,.xls"
                onChange={handleImportFile}
              />
            </>
          )}
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        {SLOT_TYPES.map(st => (
          <div key={st.value} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border ${st.color}`}>
            <st.icon className="w-3 h-3" />
            {st.label}
          </div>
        ))}
      </div>

      {viewMode === "group" ? (
        <GroupScheduleView
          groups={groups}
          allSchedules={allSchedules}
          staffList={staffList}
          isLoading={isLoading}
        />
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Seleccionar Profesor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Select
                  value={selectedTeacherId ? String(selectedTeacherId) : ""}
                  onValueChange={handleSelectTeacher}
                >
                  <SelectTrigger className="w-[300px]" data-testid="select-teacher">
                    <SelectValue placeholder="Selecciona un profesor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {staffList.map(t => {
                      const hasSchedule = allSchedules.some((s: any) => s.userId === t.id);
                      return (
                        <SelectItem key={t.id} value={String(t.id)}>
                          <span className="flex items-center gap-2">
                            {t.fullName}
                            {hasSchedule && <Badge variant="outline" className="text-[10px] px-1 py-0 text-green-600 border-green-300">horario</Badge>}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {selectedTeacherId && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => saveMutation.mutate()}
                      disabled={!dirty || saveMutation.isPending}
                      data-testid="button-save-schedule"
                    >
                      <Save className="w-4 h-4 mr-1" />
                      Guardar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => { if (confirm("¿Limpiar todo el horario de este profesor?")) clearMutation.mutate(); }}
                      data-testid="button-clear-schedule"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Limpiar
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <Skeleton className="h-64" />
          ) : selectedTeacherId ? (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-schedule">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-2 text-left font-medium w-[120px]">Tramo</th>
                      {DAY_NAMES.map((day, i) => (
                        <th key={i} className="p-2 text-center font-medium">{day}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {classSlots.map(slot => (
                      <tr key={slot.id} className="border-b hover:bg-muted/30">
                        <td className="p-2">
                          <span className="text-xs font-medium">{slot.label}</span>
                          <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">
                            {slot.period === "morning" ? "M" : "T"}{slot.id <= 6 ? slot.id : slot.id - 6}
                          </Badge>
                        </td>
                        {[1, 2, 3, 4, 5].map(day => {
                          const key = `${day}-${slot.id}`;
                          const cell = grid[key] || { slotType: "empty", groupId: null };
                          return (
                            <td key={day} className="p-1 text-center" data-testid={`cell-${day}-${slot.id}`}>
                              <ScheduleCell
                                cell={cell}
                                groups={groups}
                                onChange={(st, gid) => handleCellChange(day, slot.id, st, gid)}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium">Selecciona un profesor</p>
                <p className="text-sm mt-1">Elige un profesor del desplegable para ver o editar su horario semanal</p>
              </CardContent>
            </Card>
          )}

          {!selectedTeacherId && staffList.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Resumen de Horarios</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {staffList.map(t => {
                    const entries = allSchedules.filter((s: any) => s.userId === t.id);
                    return (
                      <div
                        key={t.id}
                        className={`p-3 rounded-lg border cursor-pointer hover:bg-accent transition-colors ${entries.length > 0 ? "border-green-200 bg-green-50/50 dark:bg-green-950/30 dark:border-green-800" : ""}`}
                        onClick={() => handleSelectTeacher(String(t.id))}
                        data-testid={`summary-teacher-${t.id}`}
                      >
                        <p className="font-medium text-sm">{t.fullName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {getTeacherSummary(entries)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
