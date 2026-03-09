import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { SignaturePad } from "@/components/signature-pad";
import { Shield, Clock, MapPin, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { DEFAULT_TIME_SLOTS, type TimeSlotConfig, type GuardZone } from "@shared/schema";

interface EnrichedAssignment {
  id: number;
  userId: number;
  dayOfWeek: number;
  timeSlotId: number;
  zoneId: number;
  userName: string;
  zoneName: string;
  buildingNumber: number;
}

export default function GuardDutySignIn() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [showSignature, setShowSignature] = useState(false);

  const now = new Date();
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const today = now.toISOString().split("T")[0];

  const { data: assignments = [], isLoading: loadingAssignments } = useQuery<EnrichedAssignment[]>({
    queryKey: ["/api/guard-duty/my-assignments"],
  });

  const { data: zones = [] } = useQuery<GuardZone[]>({
    queryKey: ["/api/guard-zones"],
  });

  const { data: todayRegistrations = [] } = useQuery<any[]>({
    queryKey: ["/api/guard-duty-registrations", today],
    queryFn: async () => {
      const res = await fetch(`/api/guard-duty-registrations?dateFrom=${today}&dateTo=${today}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error");
      return res.json();
    },
  });

  const { data: timeSlotsData } = useQuery<TimeSlotConfig[]>({
    queryKey: ["/api/settings/time-slots-today"],
    queryFn: async () => {
      const res = await fetch("/api/settings", { credentials: "include" });
      if (!res.ok) throw new Error("Error");
      const settings = await res.json();
      if (settings.timeSlots) {
        const config = JSON.parse(settings.timeSlots);
        return config[String(dayOfWeek)] || DEFAULT_TIME_SLOTS;
      }
      return DEFAULT_TIME_SLOTS;
    },
  });

  const allSlots = timeSlotsData || DEFAULT_TIME_SLOTS;

  const currentSlot = useMemo(() => {
    return allSlots.find(s => {
      const [sh, sm] = s.start.split(":").map(Number);
      const [eh, em] = s.end.split(":").map(Number);
      const start = sh * 60 + sm;
      const end = eh * 60 + em;
      return currentMinutes >= start && currentMinutes <= end + 5;
    });
  }, [allSlots, currentMinutes]);

  const currentSlotAssignments = currentSlot
    ? assignments.filter(a => a.timeSlotId === currentSlot.id)
    : [];

  const uniqueTeachers = useMemo(() => {
    const map = new Map<number, string>();
    currentSlotAssignments.forEach(a => map.set(a.userId, a.userName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [currentSlotAssignments]);

  const availableZones = useMemo(() => {
    if (!selectedUserId || !currentSlot) return [];
    const userAssignments = currentSlotAssignments.filter(a => a.userId === selectedUserId);
    return userAssignments.map(a => ({
      zoneId: a.zoneId,
      zoneName: a.zoneName,
      buildingNumber: a.buildingNumber,
    }));
  }, [selectedUserId, currentSlot, currentSlotAssignments]);

  const alreadySigned = (userId: number, slotId: number) => {
    return todayRegistrations.some(r => r.userId === userId && r.timeSlotId === slotId);
  };

  const registerMutation = useMutation({
    mutationFn: async (signatureData: string) => {
      return apiRequest("POST", "/api/guard-duty-registrations", {
        userId: selectedUserId,
        zoneId: selectedZoneId,
        timeSlotId: currentSlot!.id,
        signatureData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guard-duty-registrations"] });
      toast({ title: "Guardia fichada correctamente" });
      setShowSignature(false);
      setSelectedUserId(null);
      setSelectedZoneId(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (!isWeekday) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium">Fin de semana</p>
            <p className="text-muted-foreground">No hay guardias programadas</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loadingAssignments) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="w-5 h-5 text-primary" />
            Fichar Guardia
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Periodo actual:</span>
            </div>
            {currentSlot ? (
              <Badge data-testid="badge-current-slot" className={currentSlot.isBreak ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" : ""}>
                {currentSlot.isBreak ? `☕ ${currentSlot.label || "Recreo"} (${currentSlot.start}-${currentSlot.end})` : `${currentSlot.start} - ${currentSlot.end}`}
              </Badge>
            ) : (
              <Badge variant="outline" data-testid="badge-no-slot">Sin periodo activo</Badge>
            )}
          </div>

          {!currentSlot && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                No se puede fichar fuera del periodo de guardia (margen de 5 min.)
              </p>
            </div>
          )}

          {currentSlot && currentSlotAssignments.length === 0 && (
            <div className="text-center py-4">
              <p className="text-muted-foreground text-sm">No hay profesores asignados para este periodo</p>
            </div>
          )}

          {currentSlot && currentSlotAssignments.length > 0 && !showSignature && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Seleccione su nombre:</label>
                <Select
                  value={selectedUserId ? String(selectedUserId) : undefined}
                  onValueChange={(val) => {
                    setSelectedUserId(parseInt(val));
                    setSelectedZoneId(null);
                  }}
                >
                  <SelectTrigger data-testid="select-teacher">
                    <SelectValue placeholder="Seleccione profesor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueTeachers.map(t => {
                      const signed = alreadySigned(t.id, currentSlot.id);
                      return (
                        <SelectItem key={t.id} value={String(t.id)} disabled={signed}>
                          {t.name} {signed ? "✓ (fichado)" : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {selectedUserId && !alreadySigned(selectedUserId, currentSlot.id) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Seleccione la zona:</label>
                  <Select
                    value={selectedZoneId ? String(selectedZoneId) : undefined}
                    onValueChange={(val) => setSelectedZoneId(parseInt(val))}
                  >
                    <SelectTrigger data-testid="select-zone">
                      <SelectValue placeholder="Seleccione zona..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableZones.map(z => (
                        <SelectItem key={z.zoneId} value={String(z.zoneId)}>
                          {z.zoneName} (Ed. {z.buildingNumber})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedUserId && selectedZoneId && !alreadySigned(selectedUserId, currentSlot.id) && (
                <Button
                  className="w-full"
                  onClick={() => setShowSignature(true)}
                  data-testid="button-proceed-signature"
                >
                  Firmar guardia
                </Button>
              )}

              {selectedUserId && alreadySigned(selectedUserId, currentSlot.id) && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <p className="text-sm text-emerald-800 dark:text-emerald-200">
                    Este profesor ya ha fichado para este periodo
                  </p>
                </div>
              )}
            </>
          )}

          {showSignature && currentSlot && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
                <p><strong>Profesor:</strong> {uniqueTeachers.find(t => t.id === selectedUserId)?.name}</p>
                <p><strong>Zona:</strong> {availableZones.find(z => z.zoneId === selectedZoneId)?.zoneName} (Ed. {availableZones.find(z => z.zoneId === selectedZoneId)?.buildingNumber})</p>
                <p><strong>Periodo:</strong> {currentSlot.isBreak ? `☕ ${currentSlot.label || "Recreo"} (${currentSlot.start}-${currentSlot.end})` : `${currentSlot.start} - ${currentSlot.end}`}</p>
              </div>

              <SignaturePad
                onSave={(sig) => registerMutation.mutate(sig)}
                saving={registerMutation.isPending}
                signerName={uniqueTeachers.find(t => t.id === selectedUserId)?.name}
              />

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowSignature(false)}
                disabled={registerMutation.isPending}
                data-testid="button-cancel-signature"
              >
                Cancelar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {todayRegistrations.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Fichajes de hoy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {todayRegistrations.map((reg: any) => {
                const slot = allSlots.find(s => s.id === reg.timeSlotId);
                return (
                  <div key={reg.id} className="flex items-center justify-between text-sm p-2 rounded border" data-testid={`registration-item-${reg.id}`}>
                    <div>
                      <span className="font-medium">{reg.userName}</span>
                      <span className="text-muted-foreground ml-2">
                        {reg.zoneName} (Ed. {reg.buildingNumber})
                      </span>
                    </div>
                    <Badge variant="outline" className={`text-xs ${slot?.isBreak ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : ""}`}>
                      {slot ? (slot.isBreak ? `☕ ${slot.label || "Recreo"}` : `${slot.start}-${slot.end}`) : `P${reg.timeSlotId}`}
                    </Badge>
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
