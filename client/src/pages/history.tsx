import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Search, History, Filter, PenLine } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Group } from "@shared/schema";

export default function HistoryPage() {
  const [dateFrom, setDateFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [groupFilter, setGroupFilter] = useState("all");
  const [nameFilter, setNameFilter] = useState("");
  const [signatureView, setSignatureView] = useState<{ open: boolean; data: string; studentName: string; reason: string; date: string } | null>(null);

  const { data: groups } = useQuery<Group[]>({ queryKey: ["/api/groups"] });

  const queryParams = new URLSearchParams();
  if (dateFrom) queryParams.set("dateFrom", dateFrom);
  if (dateTo) queryParams.set("dateTo", dateTo);
  if (groupFilter !== "all") queryParams.set("groupId", groupFilter);
  if (nameFilter) queryParams.set("studentName", nameFilter);

  const { data: logs, isLoading } = useQuery<any[]>({
    queryKey: ["/api/exit-logs", dateFrom, dateTo, groupFilter, nameFilter],
    queryFn: async () => {
      const res = await fetch(`/api/exit-logs?${queryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error fetching logs");
      return res.json();
    },
  });

  const handleExport = () => {
    const exportParams = new URLSearchParams(queryParams);
    window.open(`/api/exit-logs/export?${exportParams.toString()}&format=xlsx`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-history-title">Historial de Salidas</h1>
          <p className="text-muted-foreground text-sm mt-1">{logs?.length || 0} registros encontrados</p>
        </div>
        <Button onClick={handleExport} variant="secondary" data-testid="button-export-excel">
          <Download className="w-4 h-4 mr-2" />
          Exportar Excel
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Desde</Label>
              <Input data-testid="input-date-from" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Hasta</Label>
              <Input data-testid="input-date-to" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Grupo</Label>
              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger data-testid="select-history-group">
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
                <Input data-testid="input-search-history" placeholder="Nombre..." className="pl-9" value={nameFilter} onChange={e => setNameFilter(e.target.value)} />
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
          ) : !logs?.length ? (
            <div className="py-16 text-center text-muted-foreground">
              <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
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
                    <TableHead className="text-xs">Resultado</TableHead>
                    <TableHead className="text-xs">Motivo</TableHead>
                    <TableHead className="text-xs">Verificado por</TableHead>
                    <TableHead className="text-xs text-center">Firma</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log: any) => (
                    <TableRow key={log.id} data-testid={`row-history-${log.id}`}>
                      <TableCell className="text-sm font-medium">{log.studentName}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{log.groupName}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(log.timestamp), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(log.timestamp), "HH:mm:ss")}</TableCell>
                      <TableCell>
                        <Badge variant={log.result === "AUTORIZADO" ? "default" : "destructive"} className="text-xs">
                          {log.result}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{log.reason}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{log.verifierName}</TableCell>
                      <TableCell className="text-center">
                        {log.signatureData ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            data-testid={`button-view-signature-${log.id}`}
                            onClick={() => setSignatureView({
                              open: true,
                              data: log.signatureData,
                              studentName: log.studentName,
                              reason: log.reason || "",
                              date: format(new Date(log.timestamp), "dd/MM/yyyy HH:mm"),
                            })}
                          >
                            <PenLine className="w-4 h-4 text-primary" />
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={signatureView?.open || false} onOpenChange={(open) => !open && setSignatureView(null)}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-signature-view">
          <DialogHeader>
            <DialogTitle>Firma del acompañante</DialogTitle>
          </DialogHeader>
          {signatureView && (
            <div className="space-y-4">
              <div className="space-y-1 text-sm">
                <p><span className="font-medium">Alumno:</span> {signatureView.studentName}</p>
                <p><span className="font-medium">Fecha:</span> {signatureView.date}</p>
                {signatureView.reason && (
                  <p><span className="font-medium">Motivo:</span> {signatureView.reason}</p>
                )}
              </div>
              <div className="border rounded-lg overflow-hidden bg-white p-2">
                <img
                  src={signatureView.data}
                  alt="Firma del acompañante"
                  className="w-full h-auto"
                  data-testid="img-signature"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  data-testid="button-download-signature"
                  onClick={() => {
                    const link = document.createElement("a");
                    link.download = `firma_${signatureView.studentName.replace(/\s/g, "_")}_${signatureView.date.replace(/[\/\s:]/g, "-")}.png`;
                    link.href = signatureView.data;
                    link.click();
                  }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Descargar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
