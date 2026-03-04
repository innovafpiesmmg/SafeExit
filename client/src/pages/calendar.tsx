import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Save, CalendarDays } from "lucide-react";
import { TIME_SLOTS, DAYS_OF_WEEK, type Group, type GroupSchedule } from "@shared/schema";

export default function CalendarPage() {
  const { toast } = useToast();
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [grid, setGrid] = useState<Record<string, boolean>>({});

  const { data: groups } = useQuery<Group[]>({ queryKey: ["/api/groups"] });
  const { data: schedules, isLoading } = useQuery<GroupSchedule[]>({
    queryKey: ["/api/schedules", selectedGroup],
    enabled: !!selectedGroup,
    queryFn: async () => {
      const res = await fetch(`/api/schedules/${selectedGroup}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error fetching schedules");
      return res.json();
    },
  });

  useEffect(() => {
    if (schedules) {
      const newGrid: Record<string, boolean> = {};
      schedules.forEach(s => {
        newGrid[`${s.dayOfWeek}-${s.timeSlot}`] = s.exitAllowed;
      });
      setGrid(newGrid);
    }
  }, [schedules]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/schedules", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules", selectedGroup] });
      toast({ title: "Horarios guardados correctamente" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleCell = (day: number, slot: number) => {
    const key = `${day}-${slot}`;
    setGrid(g => ({ ...g, [key]: !g[key] }));
  };

  const handleSave = () => {
    if (!selectedGroup) return;
    const schedulesList: any[] = [];
    DAYS_OF_WEEK.forEach(day => {
      TIME_SLOTS.forEach(slot => {
        schedulesList.push({
          groupId: parseInt(selectedGroup),
          dayOfWeek: day.id,
          timeSlot: slot.id,
          exitAllowed: !!grid[`${day.id}-${slot.id}`],
        });
      });
    });
    saveMutation.mutate({ schedules: schedulesList });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-calendar-title">Calendario de Salidas</h1>
          <p className="text-muted-foreground text-sm mt-1">Configura los tramos horarios de salida por grupo</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="w-48" data-testid="select-calendar-group">
              <SelectValue placeholder="Seleccionar grupo" />
            </SelectTrigger>
            <SelectContent>
              {groups?.map(g => <SelectItem key={g.id} value={String(g.id)}>{g.name} - {g.course}</SelectItem>)}
            </SelectContent>
          </Select>
          {selectedGroup && (
            <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-calendar">
              <Save className="w-4 h-4 mr-2" />
              Guardar
            </Button>
          )}
        </div>
      </div>

      {!selectedGroup ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <CalendarDays className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="font-medium text-lg">Selecciona un grupo</p>
            <p className="text-sm mt-1">Elige un grupo para configurar su calendario de salidas</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <Card>
          <CardContent className="p-4 overflow-x-auto">
            <table className="w-full border-collapse min-w-[600px]">
              <thead>
                <tr>
                  <th className="p-2 text-left text-xs font-semibold text-muted-foreground w-32">Tramo</th>
                  {DAYS_OF_WEEK.map(day => (
                    <th key={day.id} className="p-2 text-center text-xs font-semibold text-muted-foreground">{day.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map((slot, idx) => (
                  <>
                    {idx === 6 && (
                      <tr key="divider">
                        <td colSpan={6} className="py-2">
                          <div className="border-t-2 border-dashed border-muted-foreground/20" />
                          <p className="text-center text-xs text-muted-foreground mt-1 mb-1">Tarde</p>
                        </td>
                      </tr>
                    )}
                    {idx === 0 && (
                      <tr key="morning-label">
                        <td colSpan={6}>
                          <p className="text-center text-xs text-muted-foreground mb-1">Mañana</p>
                        </td>
                      </tr>
                    )}
                    <tr key={slot.id}>
                      <td className="p-1">
                        <div className="text-xs font-mono text-muted-foreground px-2 py-1.5">{slot.label}</div>
                      </td>
                      {DAYS_OF_WEEK.map(day => {
                        const key = `${day.id}-${slot.id}`;
                        const allowed = !!grid[key];
                        return (
                          <td key={day.id} className="p-1">
                            <button
                              data-testid={`cell-${day.id}-${slot.id}`}
                              onClick={() => toggleCell(day.id, slot.id)}
                              className={`w-full h-10 rounded-md text-xs font-medium transition-colors ${
                                allowed
                                  ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                  : "bg-muted/50 text-muted-foreground/50 border border-transparent"
                              }`}
                            >
                              {allowed ? "Permitido" : "-"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  </>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
