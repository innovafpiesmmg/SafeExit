import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardCheck, Loader2, Search, Filter, PenLine, Building2, FileText, Download } from "lucide-react";
import { DEFAULT_TIME_SLOTS, type GuardZone, type User, type TimeSlotConfig } from "@shared/schema";

export default function GuardDutyRegistryPage() {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [filterBuilding, setFilterBuilding] = useState<string>("all");
  const [filterZone, setFilterZone] = useState<string>("all");
  const [filterTeacher, setFilterTeacher] = useState<string>("all");
  const [signatureView, setSignatureView] = useState<string | null>(null);

  const queryParams = new URLSearchParams();
  if (dateFrom) queryParams.set("dateFrom", dateFrom);
  if (dateTo) queryParams.set("dateTo", dateTo);
  if (filterBuilding !== "all") queryParams.set("buildingNumber", filterBuilding);
  if (filterZone !== "all") queryParams.set("zoneId", filterZone);
  if (filterTeacher !== "all") queryParams.set("userId", filterTeacher);

  const { data: registrations = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/guard-duty-registrations", dateFrom, dateTo, filterBuilding, filterZone, filterTeacher],
    queryFn: async () => {
      const res = await fetch(`/api/guard-duty-registrations?${queryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error");
      return res.json();
    },
  });

  const { data: zones = [] } = useQuery<GuardZone[]>({
    queryKey: ["/api/guard-zones"],
  });

  const { data: teachers = [] } = useQuery<User[]>({
    queryKey: ["/api/guards"],
  });

  const { data: timeSlotsData } = useQuery<TimeSlotConfig[]>({
    queryKey: ["/api/settings/time-slots-default"],
    queryFn: async () => {
      const res = await fetch("/api/settings", { credentials: "include" });
      if (!res.ok) throw new Error("Error");
      const settings = await res.json();
      if (settings.timeSlots) {
        const config = JSON.parse(settings.timeSlots);
        return config["1"] || DEFAULT_TIME_SLOTS;
      }
      return DEFAULT_TIME_SLOTS;
    },
  });

  const classSlots = (timeSlotsData || DEFAULT_TIME_SLOTS).filter(s => !s.isBreak);

  const getSlotLabel = (slotId: number) => {
    const slot = classSlots.find(s => s.id === slotId);
    return slot ? `${slot.start}-${slot.end}` : `P${slotId}`;
  };

  const filteredZones = filterBuilding !== "all"
    ? zones.filter(z => z.buildingNumber === parseInt(filterBuilding))
    : zones;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-registry-title">Registro de Guardias</h1>
        <p className="text-muted-foreground">Consultar los fichajes de guardias de profesores</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="w-4 h-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                data-testid="input-date-from"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                data-testid="input-date-to"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Edificio</Label>
              <Select value={filterBuilding} onValueChange={(v) => { setFilterBuilding(v); setFilterZone("all"); }}>
                <SelectTrigger data-testid="select-filter-building">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="1">Edificio 1</SelectItem>
                  <SelectItem value="2">Edificio 2</SelectItem>
                  <SelectItem value="3">Edificio 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Zona</Label>
              <Select value={filterZone} onValueChange={setFilterZone}>
                <SelectTrigger data-testid="select-filter-zone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {filteredZones.map(z => (
                    <SelectItem key={z.id} value={String(z.id)}>{z.zoneName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Profesor</Label>
              <Select value={filterTeacher} onValueChange={setFilterTeacher}>
                <SelectTrigger data-testid="select-filter-teacher">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {teachers.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="w-4 h-4" />
            Fichajes ({registrations.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : registrations.length === 0 ? (
            <div className="text-center py-12">
              <Search className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">No se encontraron fichajes con los filtros seleccionados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-registrations">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">Fecha</th>
                    <th className="text-left p-2 font-medium">Hora</th>
                    <th className="text-left p-2 font-medium">Profesor</th>
                    <th className="text-left p-2 font-medium">Edificio</th>
                    <th className="text-left p-2 font-medium">Zona</th>
                    <th className="text-left p-2 font-medium">Periodo</th>
                    <th className="text-left p-2 font-medium">Firma</th>
                    <th className="text-left p-2 font-medium">Documento</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((reg: any) => (
                    <tr key={reg.id} className="border-b hover:bg-muted/50" data-testid={`row-registration-${reg.id}`}>
                      <td className="p-2">{reg.date}</td>
                      <td className="p-2">{new Date(reg.timestamp).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="p-2 font-medium">{reg.userName}</td>
                      <td className="p-2">
                        <Badge variant="outline" className="text-xs">
                          <Building2 className="w-3 h-3 mr-1" />
                          Ed. {reg.buildingNumber}
                        </Badge>
                      </td>
                      <td className="p-2">{reg.zoneName}</td>
                      <td className="p-2">
                        <Badge variant="secondary" className="text-xs">{getSlotLabel(reg.timeSlotId)}</Badge>
                      </td>
                      <td className="p-2">
                        {reg.signatureData ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => setSignatureView(reg.signatureData)}
                            data-testid={`button-view-signature-${reg.id}`}
                          >
                            <PenLine className="w-3 h-3 mr-1" />
                            Ver
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => {
                            window.open(`/api/guard-duty-registrations/${reg.id}/pdf`, "_blank");
                          }}
                          data-testid={`button-download-pdf-${reg.id}`}
                        >
                          <FileText className="w-3 h-3 mr-1" />
                          PDF
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!signatureView} onOpenChange={() => setSignatureView(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Firma de Guardia</DialogTitle>
          </DialogHeader>
          {signatureView && (
            <div className="bg-white rounded-lg p-2 border">
              <img src={signatureView} alt="Firma" className="w-full" data-testid="img-signature-view" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
