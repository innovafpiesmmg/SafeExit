import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Search, Clock, Mail, MailX, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Group } from "@shared/schema";

export default function LateArrivalsHistoryPage() {
  const [dateFrom, setDateFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [groupFilter, setGroupFilter] = useState("all");
  const [nameFilter, setNameFilter] = useState("");

  const { data: groups } = useQuery<Group[]>({ queryKey: ["/api/groups"] });

  const queryParams = new URLSearchParams();
  if (dateFrom) queryParams.set("dateFrom", dateFrom);
  if (dateTo) queryParams.set("dateTo", dateTo);
  if (groupFilter !== "all") queryParams.set("groupId", groupFilter);
  if (nameFilter) queryParams.set("studentName", nameFilter);

  const { data: arrivals, isLoading } = useQuery<any[]>({
    queryKey: ["/api/late-arrivals", dateFrom, dateTo, groupFilter, nameFilter],
    queryFn: async () => {
      const res = await fetch(`/api/late-arrivals?${queryParams.toString()}`, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Error cargando historial de entradas tardías");
      }
      return res.json();
    },
  });

  const handleExport = () => {
    window.open(`/api/late-arrivals/export?${queryParams.toString()}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-late-history-title">Historial de Entradas Tardías</h1>
          <p className="text-muted-foreground text-sm mt-1">{arrivals?.length || 0} registros encontrados</p>
        </div>
        <Button onClick={handleExport} variant="secondary" data-testid="button-export-late-csv">
          <Download className="w-4 h-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Desde</Label>
              <Input data-testid="input-late-date-from" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Hasta</Label>
              <Input data-testid="input-late-date-to" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Grupo</Label>
              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger data-testid="select-late-history-group">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los grupos</SelectItem>
                  {groups?.map(g => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Alumno</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input data-testid="input-search-late-history" placeholder="Nombre..." className="pl-9" value={nameFilter} onChange={e => setNameFilter(e.target.value)} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !arrivals?.length ? (
            <div className="py-16 text-center text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="font-medium">No se encontraron registros</p>
              <p className="text-sm mt-1">Ajusta los filtros para buscar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Alumno</TableHead>
                    <TableHead className="text-xs">Grupo</TableHead>
                    <TableHead className="text-xs">Fecha</TableHead>
                    <TableHead className="text-xs">Hora</TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">Registrado por</TableHead>
                    <TableHead className="text-xs">Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {arrivals.map((a: any) => (
                    <TableRow key={a.id} data-testid={`row-late-history-${a.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="w-7 h-7">
                            <AvatarImage src={a.studentPhoto || undefined} />
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              {a.studentName?.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{a.studentName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{a.groupName}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(a.timestamp), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(a.timestamp), "HH:mm")}
                      </TableCell>
                      <TableCell>
                        {a.emailSent ? (
                          <Badge variant="default" className="text-[10px]">
                            <Mail className="w-3 h-3 mr-1" /> Enviado
                          </Badge>
                        ) : a.studentEmail ? (
                          <Badge variant="destructive" className="text-[10px]">
                            <MailX className="w-3 h-3 mr-1" /> Error
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.registrarName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {a.notes ? (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3 flex-shrink-0" />
                            {a.notes}
                          </span>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
