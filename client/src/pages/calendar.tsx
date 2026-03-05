import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Save, CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { TIME_SLOTS, type Group, type GroupSchedule } from "@shared/schema";

function getFilteredSlots(group: Group | undefined) {
  if (!group || group.schedule === "full") return TIME_SLOTS;
  if (group.schedule === "afternoon") return TIME_SLOTS.filter(s => s.id > 6);
  return TIME_SLOTS.filter(s => s.id <= 6);
}
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isToday, isBefore } from "date-fns";
import { es } from "date-fns/locale";

export default function CalendarPage() {
  const { toast } = useToast();
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Record<number, boolean>>({});

  const { data: groups } = useQuery<Group[]>({ queryKey: ["/api/groups"] });

  const { data: scheduleDates } = useQuery<string[]>({
    queryKey: ["/api/schedules", selectedGroup, "dates"],
    enabled: !!selectedGroup,
    queryFn: async () => {
      const res = await fetch(`/api/schedules/${selectedGroup}/dates`, { credentials: "include" });
      if (!res.ok) throw new Error("Error");
      return res.json();
    },
  });

  const { data: dateSchedules, isLoading: loadingSlots } = useQuery<GroupSchedule[]>({
    queryKey: ["/api/schedules", selectedGroup, selectedDate],
    enabled: !!selectedGroup && !!selectedDate,
    queryFn: async () => {
      const res = await fetch(`/api/schedules/${selectedGroup}?date=${selectedDate}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error");
      return res.json();
    },
  });

  useEffect(() => {
    if (dateSchedules) {
      const newSlots: Record<number, boolean> = {};
      dateSchedules.forEach(s => {
        newSlots[s.timeSlot] = s.exitAllowed;
      });
      setSlots(newSlots);
    } else {
      setSlots({});
    }
  }, [dateSchedules]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/schedules", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules", selectedGroup] });
      toast({ title: "Permisos guardados correctamente" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleSlot = (slotId: number) => {
    setSlots(prev => ({ ...prev, [slotId]: !prev[slotId] }));
  };

  const handleSave = () => {
    if (!selectedGroup || !selectedDate) return;
    const schedulesList = filteredSlots.map(slot => ({
      groupId: parseInt(selectedGroup),
      date: selectedDate,
      timeSlot: slot.id,
      exitAllowed: !!slots[slot.id],
    }));
    saveMutation.mutate({ schedules: schedulesList });
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDay = getDay(monthStart);
  const paddingDays = startDay === 0 ? 6 : startDay - 1;

  const datesWithPermissions = new Set(scheduleDates || []);

  const selectedGroupObj = groups?.find(g => String(g.id) === selectedGroup);
  const filteredSlots = getFilteredSlots(selectedGroupObj);
  const hasAnySlotEnabled = Object.values(slots).some(v => v);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-calendar-title">Calendario de Salidas</h1>
          <p className="text-muted-foreground text-sm mt-1">Selecciona una fecha para configurar los tramos de salida</p>
        </div>
        <Select value={selectedGroup} onValueChange={v => { setSelectedGroup(v); setSelectedDate(null); }}>
          <SelectTrigger className="w-56" data-testid="select-calendar-group">
            <SelectValue placeholder="Seleccionar grupo" />
          </SelectTrigger>
          <SelectContent>
            {groups?.map(g => {
              const scheduleLabel = g.schedule === "afternoon" ? "🌙 Tarde" : g.schedule === "full" ? "☀️ Completo" : "☀️ Mañana";
              return <SelectItem key={g.id} value={String(g.id)}>{g.name} - {g.course} ({scheduleLabel})</SelectItem>;
            })}
          </SelectContent>
        </Select>
      </div>

      {!selectedGroup ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <CalendarDays className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="font-medium text-lg">Selecciona un grupo</p>
            <p className="text-sm mt-1">Elige un grupo para configurar su calendario de salidas</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))} data-testid="button-prev-month">
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <CardTitle className="text-lg capitalize" data-testid="text-current-month">
                  {format(currentMonth, "MMMM yyyy", { locale: es })}
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))} data-testid="button-next-month">
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {["L", "M", "X", "J", "V", "S", "D"].map(d => (
                  <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: paddingDays }).map((_, i) => (
                  <div key={`pad-${i}`} />
                ))}
                {days.map(day => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const isSelected = selectedDate === dateStr;
                  const hasPermissions = datesWithPermissions.has(dateStr);
                  const isWeekend = getDay(day) === 0 || getDay(day) === 6;
                  const isPast = isBefore(day, new Date()) && !isToday(day);

                  return (
                    <button
                      key={dateStr}
                      data-testid={`day-${dateStr}`}
                      onClick={() => !isWeekend && setSelectedDate(dateStr)}
                      disabled={isWeekend}
                      className={`
                        relative h-10 rounded-md text-sm font-medium transition-all
                        ${isWeekend ? "text-muted-foreground/30 cursor-not-allowed" : "hover:bg-accent cursor-pointer"}
                        ${isSelected ? "bg-primary text-primary-foreground hover:bg-primary/90 ring-2 ring-primary ring-offset-1" : ""}
                        ${isToday(day) && !isSelected ? "bg-accent font-bold" : ""}
                        ${isPast && !isSelected ? "text-muted-foreground/60" : ""}
                      `}
                    >
                      {format(day, "d")}
                      {hasPermissions && !isSelected && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Con permisos
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  Seleccionado
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {selectedDate ? (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {format(new Date(selectedDate + "T12:00:00"), "EEEE d 'de' MMMM", { locale: es })}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    {loadingSlots ? (
                      <div className="space-y-2">
                        {[1,2,3].map(i => <Skeleton key={i} className="h-9" />)}
                      </div>
                    ) : (
                      <>
                        {filteredSlots.map((slot, idx) => {
                          const showMorningLabel = idx === 0 && slot.id <= 6;
                          const showAfternoonLabel = (idx === 0 && slot.id > 6) || (idx > 0 && slot.id === 7);
                          return (
                          <div key={slot.id}>
                            {showAfternoonLabel && (
                              <div className={`${idx > 0 ? "border-t border-dashed my-2 pt-1" : ""}`}>
                                <p className="text-[10px] text-muted-foreground text-center mb-1">Tarde</p>
                              </div>
                            )}
                            {showMorningLabel && (
                              <p className="text-[10px] text-muted-foreground text-center mb-1">Mañana</p>
                            )}
                            <button
                              data-testid={`slot-${slot.id}`}
                              onClick={() => toggleSlot(slot.id)}
                              className={`w-full text-left px-3 py-2 rounded-md text-xs font-medium transition-colors flex items-center justify-between ${
                                slots[slot.id]
                                  ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                  : "bg-muted/50 text-muted-foreground border border-transparent hover:bg-muted"
                              }`}
                            >
                              <span className="font-mono">{slot.label}</span>
                              {slots[slot.id] && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Permitido</Badge>}
                            </button>
                          </div>
                          );
                        })}
                        <Button
                          className="w-full mt-3"
                          onClick={handleSave}
                          disabled={saveMutation.isPending}
                          data-testid="button-save-calendar"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {saveMutation.isPending ? "Guardando..." : "Guardar"}
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">Selecciona una fecha</p>
                  <p className="text-xs mt-1">Pulsa un día del calendario para configurar sus tramos de salida</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
