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

const ENTITY_PALETTE = [
  { bg: "hsl(210, 80%, 92%)", bgDark: "hsl(210, 50%, 18%)", text: "hsl(210, 70%, 35%)", textDark: "hsl(210, 70%, 75%)" },
  { bg: "hsl(150, 70%, 90%)", bgDark: "hsl(150, 40%, 18%)", text: "hsl(150, 60%, 30%)", textDark: "hsl(150, 60%, 70%)" },
  { bg: "hsl(280, 65%, 92%)", bgDark: "hsl(280, 40%, 18%)", text: "hsl(280, 55%, 40%)", textDark: "hsl(280, 55%, 75%)" },
  { bg: "hsl(30, 85%, 90%)", bgDark: "hsl(30, 50%, 18%)", text: "hsl(30, 70%, 35%)", textDark: "hsl(30, 70%, 70%)" },
  { bg: "hsl(340, 75%, 92%)", bgDark: "hsl(340, 45%, 18%)", text: "hsl(340, 60%, 38%)", textDark: "hsl(340, 60%, 72%)" },
  { bg: "hsl(180, 65%, 90%)", bgDark: "hsl(180, 40%, 18%)", text: "hsl(180, 55%, 30%)", textDark: "hsl(180, 55%, 70%)" },
  { bg: "hsl(60, 70%, 88%)", bgDark: "hsl(60, 40%, 16%)", text: "hsl(60, 55%, 28%)", textDark: "hsl(60, 55%, 68%)" },
  { bg: "hsl(240, 65%, 93%)", bgDark: "hsl(240, 40%, 18%)", text: "hsl(240, 50%, 42%)", textDark: "hsl(240, 50%, 75%)" },
  { bg: "hsl(0, 70%, 93%)", bgDark: "hsl(0, 40%, 18%)", text: "hsl(0, 55%, 38%)", textDark: "hsl(0, 55%, 72%)" },
  { bg: "hsl(90, 60%, 90%)", bgDark: "hsl(90, 35%, 18%)", text: "hsl(90, 50%, 30%)", textDark: "hsl(90, 50%, 68%)" },
  { bg: "hsl(320, 60%, 92%)", bgDark: "hsl(320, 35%, 18%)", text: "hsl(320, 50%, 40%)", textDark: "hsl(320, 50%, 72%)" },
  { bg: "hsl(195, 75%, 90%)", bgDark: "hsl(195, 45%, 18%)", text: "hsl(195, 60%, 30%)", textDark: "hsl(195, 60%, 70%)" },
  { bg: "hsl(45, 80%, 88%)", bgDark: "hsl(45, 45%, 16%)", text: "hsl(45, 65%, 28%)", textDark: "hsl(45, 65%, 65%)" },
  { bg: "hsl(260, 55%, 93%)", bgDark: "hsl(260, 35%, 18%)", text: "hsl(260, 45%, 42%)", textDark: "hsl(260, 45%, 75%)" },
  { bg: "hsl(120, 55%, 90%)", bgDark: "hsl(120, 30%, 18%)", text: "hsl(120, 45%, 28%)", textDark: "hsl(120, 45%, 68%)" },
  { bg: "hsl(15, 80%, 91%)", bgDark: "hsl(15, 45%, 18%)", text: "hsl(15, 65%, 35%)", textDark: "hsl(15, 65%, 70%)" },
  { bg: "hsl(225, 70%, 93%)", bgDark: "hsl(225, 40%, 18%)", text: "hsl(225, 55%, 40%)", textDark: "hsl(225, 55%, 75%)" },
  { bg: "hsl(165, 60%, 90%)", bgDark: "hsl(165, 35%, 18%)", text: "hsl(165, 50%, 28%)", textDark: "hsl(165, 50%, 68%)" },
  { bg: "hsl(300, 50%, 92%)", bgDark: "hsl(300, 30%, 18%)", text: "hsl(300, 40%, 40%)", textDark: "hsl(300, 40%, 72%)" },
  { bg: "hsl(75, 65%, 88%)", bgDark: "hsl(75, 35%, 16%)", text: "hsl(75, 50%, 28%)", textDark: "hsl(75, 50%, 65%)" },
];

function buildColorMap(ids: number[]): Record<number, typeof ENTITY_PALETTE[0]> {
  const sorted = [...new Set(ids)].sort((a, b) => a - b);
  const map: Record<number, typeof ENTITY_PALETTE[0]> = {};
  sorted.forEach((id, i) => {
    map[id] = ENTITY_PALETTE[i % ENTITY_PALETTE.length];
  });
  return map;
}

function useIsDark() {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

function EntityColorCell({ color, label }: { color: typeof ENTITY_PALETTE[0]; label: string }) {
  const isDark = useIsDark();
  return (
    <div
      className="rounded-md px-2 py-1.5 text-xs font-medium"
      style={{
        backgroundColor: isDark ? color.bgDark : color.bg,
        color: isDark ? color.textDark : color.text,
      }}
    >
      {label}
    </div>
  );
}

function ColorLegend({ colorMap, nameMap, title }: {
  colorMap: Record<number, typeof ENTITY_PALETTE[0]>;
  nameMap: Record<number, string>;
  title: string;
}) {
  const isDark = useIsDark();
  const entries = Object.entries(colorMap).filter(([id]) => nameMap[Number(id)]);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 px-1 py-2">
      <span className="text-xs text-muted-foreground font-medium">{title}:</span>
      {entries.map(([id, color]) => (
        <span
          key={id}
          className="inline-flex items-center gap-1.5 text-[11px] font-medium rounded-full px-2.5 py-0.5"
          style={{
            backgroundColor: isDark ? color.bgDark : color.bg,
            color: isDark ? color.textDark : color.text,
          }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: isDark ? color.textDark : color.text }}
          />
          {nameMap[Number(id)]}
        </span>
      ))}
    </div>
  );
}

interface CellData {
  slotType: string;
  groupId: number | null;
}

function ScheduleCell({ cell, groups, onChange, groupColorMap }: {
  cell: CellData;
  groups: Group[];
  onChange: (slotType: string, groupId: number | null) => void;
  groupColorMap: Record<number, typeof ENTITY_PALETTE[0]>;
}) {
  const typeInfo = getSlotTypeInfo(cell.slotType);
  const isClass = cell.slotType === "class";
  const isDark = useIsDark();
  const groupColor = isClass && cell.groupId ? groupColorMap[cell.groupId] : null;

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
          <SelectTrigger
            className="h-7 text-[11px] font-medium"
            style={groupColor ? {
              backgroundColor: isDark ? groupColor.bgDark : groupColor.bg,
              color: isDark ? groupColor.textDark : groupColor.text,
              borderColor: isDark ? groupColor.textDark : groupColor.text,
              borderWidth: "1.5px",
            } : undefined}
          >
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

  const teacherColorMap = useMemo(() => {
    const teacherIds = allSchedules
      .filter((s: any) => s.groupId === selectedGroupId && s.slotType === "class")
      .map((s: any) => s.userId);
    return buildColorMap(teacherIds);
  }, [allSchedules, selectedGroupId]);

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
        <>
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
                          {entry && teacherColorMap[entry.userId] ? (
                            <EntityColorCell color={teacherColorMap[entry.userId]} label={entry.teacherName} />
                          ) : entry ? (
                            <div className="rounded-md px-2 py-1.5 text-xs font-medium bg-muted">
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
        {Object.keys(teacherColorMap).length > 0 && (
          <ColorLegend
            colorMap={teacherColorMap}
            nameMap={Object.fromEntries(staffList.map(s => [s.id, s.fullName]))}
            title="Colores de profesores"
          />
        )}
      </>
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

  const groupColorMap = useMemo(() => {
    const groupIds = Object.values(grid)
      .filter(c => c.slotType === "class" && c.groupId)
      .map(c => c.groupId as number);
    return buildColorMap(groupIds);
  }, [grid]);

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
            <>
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
                                  groupColorMap={groupColorMap}
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
              {Object.keys(groupColorMap).length > 0 && (
                <ColorLegend
                  colorMap={groupColorMap}
                  nameMap={Object.fromEntries(groups.map(g => [g.id, g.name]))}
                  title="Colores de grupos"
                />
              )}
            </>
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
