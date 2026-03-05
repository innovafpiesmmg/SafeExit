import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, History, Clock, Mail, MailX, MessageSquare, LogOut as LogOutIcon } from "lucide-react";
import { format } from "date-fns";

interface TutorRecordsProps {
  embedded?: boolean;
}

export default function TutorRecords({ embedded }: TutorRecordsProps) {
  const [recordsTab, setRecordsTab] = useState("exits");
  const [dateFrom, setDateFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [nameFilter, setNameFilter] = useState("");

  const exitParams = new URLSearchParams();
  if (dateFrom) exitParams.set("dateFrom", dateFrom);
  if (dateTo) exitParams.set("dateTo", dateTo);
  if (nameFilter) exitParams.set("studentName", nameFilter);

  const { data: exitLogs, isLoading: loadingExits } = useQuery<any[]>({
    queryKey: ["/api/tutor/exit-logs", dateFrom, dateTo, nameFilter],
    queryFn: async () => {
      const res = await fetch(`/api/tutor/exit-logs?${exitParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error cargando registros");
      return res.json();
    },
  });

  const { data: lateArrivals, isLoading: loadingLate } = useQuery<any[]>({
    queryKey: ["/api/tutor/late-arrivals", dateFrom, dateTo, nameFilter],
    queryFn: async () => {
      const res = await fetch(`/api/tutor/late-arrivals?${exitParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error cargando registros");
      return res.json();
    },
  });

  const filters = (
    <Card>
      <CardContent className="p-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Desde</Label>
            <Input data-testid="input-tutor-date-from" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Hasta</Label>
            <Input data-testid="input-tutor-date-to" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Alumno</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input data-testid="input-tutor-search-name" placeholder="Nombre..." className="pl-8 h-9 text-sm" value={nameFilter} onChange={e => setNameFilter(e.target.value)} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const loadingSkeleton = (
    <div className="p-3 space-y-2">
      {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full" />)}
    </div>
  );

  const exitTable = loadingExits ? loadingSkeleton : !exitLogs?.length ? (
    <div className="py-12 text-center text-muted-foreground">
      <History className="w-10 h-10 mx-auto mb-3 opacity-20" />
      <p className="font-medium text-sm">No se encontraron registros de salidas</p>
      <p className="text-xs mt-1">Ajusta las fechas para buscar</p>
    </div>
  ) : (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Alumno</TableHead>
            <TableHead className="text-xs">Fecha</TableHead>
            <TableHead className="text-xs">Hora</TableHead>
            <TableHead className="text-xs">Resultado</TableHead>
            <TableHead className="text-xs">Motivo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {exitLogs.map((log: any) => (
            <TableRow key={log.id} data-testid={`row-tutor-exit-${log.id}`}>
              <TableCell className="text-sm font-medium">{log.studentName}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{format(new Date(log.timestamp), "dd/MM/yyyy")}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{format(new Date(log.timestamp), "HH:mm")}</TableCell>
              <TableCell>
                <Badge variant={log.result === "AUTORIZADO" ? "default" : "destructive"} className="text-[10px]">
                  {log.result}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">{log.reason}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const lateTable = loadingLate ? loadingSkeleton : !lateArrivals?.length ? (
    <div className="py-12 text-center text-muted-foreground">
      <Clock className="w-10 h-10 mx-auto mb-3 opacity-20" />
      <p className="font-medium text-sm">No se encontraron entradas tardías</p>
      <p className="text-xs mt-1">Ajusta las fechas para buscar</p>
    </div>
  ) : (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Alumno</TableHead>
            <TableHead className="text-xs">Fecha</TableHead>
            <TableHead className="text-xs">Hora</TableHead>
            <TableHead className="text-xs">Email</TableHead>
            <TableHead className="text-xs">Notas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lateArrivals.map((a: any) => (
            <TableRow key={a.id} data-testid={`row-tutor-late-${a.id}`}>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={a.studentPhoto || undefined} />
                    <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                      {a.studentName?.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{a.studentName}</span>
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{format(new Date(a.timestamp), "dd/MM/yyyy")}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{format(new Date(a.timestamp), "HH:mm")}</TableCell>
              <TableCell>
                {a.emailSent ? (
                  <Badge variant="default" className="text-[10px]"><Mail className="w-3 h-3 mr-0.5" /> Sí</Badge>
                ) : a.studentEmail ? (
                  <Badge variant="destructive" className="text-[10px]"><MailX className="w-3 h-3 mr-0.5" /> Error</Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                {a.notes ? (
                  <span className="flex items-center gap-0.5"><MessageSquare className="w-3 h-3 flex-shrink-0" />{a.notes}</span>
                ) : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className={`${embedded ? "p-3" : "p-4 md:p-6"} space-y-3`}>
      <div>
        <h1 className={`${embedded ? "text-lg" : "text-2xl"} font-bold tracking-tight`} data-testid="text-tutor-records-title">
          Registros de Mi Grupo
        </h1>
        <p className="text-muted-foreground text-xs mt-0.5">Historial de salidas y entradas tardías</p>
      </div>

      {filters}

      <Tabs value={recordsTab} onValueChange={setRecordsTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="exits" data-testid="tab-tutor-exits" className="text-xs sm:text-sm">
            <LogOutIcon className="w-3.5 h-3.5 mr-1.5" />
            Salidas ({exitLogs?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="late" data-testid="tab-tutor-late" className="text-xs sm:text-sm">
            <Clock className="w-3.5 h-3.5 mr-1.5" />
            Tardías ({lateArrivals?.length || 0})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="exits" className="mt-2">
          <Card>
            <CardContent className="p-0">
              {exitTable}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="late" className="mt-2">
          <Card>
            <CardContent className="p-0">
              {lateTable}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
