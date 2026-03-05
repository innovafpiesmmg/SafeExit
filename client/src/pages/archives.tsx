import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Archive, Trash2, Eye, Users, GraduationCap, LogOut, Clock, AlertTriangle, Loader2, ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ArchiveSummary {
  id: number;
  yearName: string;
  archivedAt: string;
  stats: {
    students: number;
    groups: number;
    exitLogs: number;
    lateArrivals: number;
    incidents: number;
    users: number;
  };
}

interface ArchiveData {
  id: number;
  yearName: string;
  archivedAt: string;
  data: {
    students: any[];
    groups: any[];
    exitLogs: any[];
    lateArrivals: any[];
    incidents: any[];
    users: any[];
    authorizedPickups: any[];
    settings: any[];
  };
}

export default function ArchivesPage() {
  const { toast } = useToast();
  const [viewingArchive, setViewingArchive] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const { data: archives, isLoading } = useQuery<ArchiveSummary[]>({ queryKey: ["/api/admin/archives"] });

  const { data: archiveDetail, isLoading: loadingDetail } = useQuery<ArchiveData>({
    queryKey: ["/api/admin/archives", viewingArchive],
    enabled: viewingArchive !== null,
    queryFn: async () => {
      const res = await fetch(`/api/admin/archives/${viewingArchive}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error cargando archivo");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/archives/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/archives"] });
      toast({ title: "Archivo eliminado permanentemente" });
      setDeleteId(null);
      setDeleteConfirmation("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (viewingArchive !== null && archiveDetail) {
    return <ArchiveViewer archive={archiveDetail} onBack={() => setViewingArchive(null)} />;
  }

  if (viewingArchive !== null && loadingDetail) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-archives-title">Cursos Archivados</h1>
        <p className="text-muted-foreground text-sm mt-1">Consulta los datos de cursos académicos anteriores</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : !archives?.length ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Archive className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="font-medium text-lg">No hay cursos archivados</p>
            <p className="text-sm mt-1">Cuando archives un curso académico desde Ajustes, aparecerá aquí</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {archives.map(archive => (
            <Card key={archive.id} data-testid={`card-archive-${archive.id}`}>
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold" data-testid={`text-archive-year-${archive.id}`}>{archive.yearName}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Archivado el {format(new Date(archive.archivedAt), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="secondary"><Users className="w-3 h-3 mr-1" />{archive.stats.students} alumnos</Badge>
                      <Badge variant="secondary"><GraduationCap className="w-3 h-3 mr-1" />{archive.stats.groups} grupos</Badge>
                      <Badge variant="secondary"><LogOut className="w-3 h-3 mr-1" />{archive.stats.exitLogs} salidas</Badge>
                      <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />{archive.stats.lateArrivals} tardías</Badge>
                      {archive.stats.incidents > 0 && (
                        <Badge variant="secondary"><AlertTriangle className="w-3 h-3 mr-1" />{archive.stats.incidents} incidencias</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button onClick={() => setViewingArchive(archive.id)} data-testid={`button-view-archive-${archive.id}`}>
                      <Eye className="w-4 h-4 mr-2" /> Consultar
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => setDeleteId(archive.id)} data-testid={`button-delete-archive-${archive.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={() => { setDeleteId(null); setDeleteConfirmation(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Eliminar Archivo Permanentemente
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente todos los datos de este curso archivado. No se podrá recuperar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-sm">Escribe <span className="font-bold text-destructive">ELIMINAR</span> para confirmar:</Label>
            <Input
              value={deleteConfirmation}
              onChange={e => setDeleteConfirmation(e.target.value)}
              placeholder="ELIMINAR"
              data-testid="input-delete-archive-confirmation"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-archive">Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteConfirmation !== "ELIMINAR" || deleteMutation.isPending}
              onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}
              data-testid="button-confirm-delete-archive"
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar Permanentemente"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ArchiveViewer({ archive, onBack }: { archive: ArchiveData; onBack: () => void }) {
  const { data } = archive;
  const [selectedTab, setSelectedTab] = useState("students");
  const [searchFilter, setSearchFilter] = useState("");

  const groupMap = new Map(data.groups.map(g => [g.id, g]));
  const studentMap = new Map(data.students.map(s => [s.id, s]));
  const userMap = new Map(data.users.map(u => [u.id, u]));

  const filteredStudents = data.students.filter(s =>
    !searchFilter || `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const filteredExitLogs = data.exitLogs.filter(log => {
    if (!searchFilter) return true;
    const student = studentMap.get(log.studentId);
    return student && `${student.firstName} ${student.lastName}`.toLowerCase().includes(searchFilter.toLowerCase());
  });

  const filteredLateArrivals = data.lateArrivals.filter(la => {
    if (!searchFilter) return true;
    const student = studentMap.get(la.studentId);
    return student && `${student.firstName} ${student.lastName}`.toLowerCase().includes(searchFilter.toLowerCase());
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back-archives">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-archive-detail-title">{archive.yearName}</h1>
          <p className="text-muted-foreground text-sm">
            Archivado el {format(new Date(archive.archivedAt), "d 'de' MMMM 'de' yyyy", { locale: es })}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Buscar por nombre..."
          value={searchFilter}
          onChange={e => setSearchFilter(e.target.value)}
          className="max-w-xs"
          data-testid="input-archive-search"
        />
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList data-testid="tabs-archive-sections">
          <TabsTrigger value="students" data-testid="tab-archive-students">
            Alumnos ({data.students.length})
          </TabsTrigger>
          <TabsTrigger value="groups" data-testid="tab-archive-groups">
            Grupos ({data.groups.length})
          </TabsTrigger>
          <TabsTrigger value="exitLogs" data-testid="tab-archive-exits">
            Salidas ({data.exitLogs.length})
          </TabsTrigger>
          <TabsTrigger value="lateArrivals" data-testid="tab-archive-late">
            Tardías ({data.lateArrivals.length})
          </TabsTrigger>
          <TabsTrigger value="incidents" data-testid="tab-archive-incidents">
            Incidencias ({data.incidents.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[500px]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-medium">Nombre</th>
                      <th className="text-left p-3 font-medium">Apellidos</th>
                      <th className="text-left p-3 font-medium">Grupo</th>
                      <th className="text-left p-3 font-medium">Fecha Nac.</th>
                      <th className="text-center p-3 font-medium">Aut. Parental</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Sin resultados</td></tr>
                    ) : filteredStudents.map((s, i) => {
                      const group = groupMap.get(s.groupId);
                      return (
                        <tr key={i} className="border-t" data-testid={`row-archive-student-${i}`}>
                          <td className="p-3">{s.firstName}</td>
                          <td className="p-3">{s.lastName}</td>
                          <td className="p-3">{group ? `${group.name} - ${group.course}` : "-"}</td>
                          <td className="p-3">{s.dateOfBirth || "-"}</td>
                          <td className="p-3 text-center">{s.parentalAuthorization ? "Sí" : "No"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="groups" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.groups.map((g, i) => {
              const studentCount = data.students.filter(s => s.groupId === g.id).length;
              return (
                <Card key={i} data-testid={`card-archive-group-${i}`}>
                  <CardContent className="p-4">
                    <p className="text-lg font-bold">{g.name}</p>
                    <p className="text-sm text-muted-foreground">{g.course}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary"><Users className="w-3 h-3 mr-1" />{studentCount} alumnos</Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {g.schedule === "afternoon" ? "Tarde" : g.schedule === "full" ? "Completo" : "Mañana"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="exitLogs" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[500px]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-medium">Fecha/Hora</th>
                      <th className="text-left p-3 font-medium">Alumno</th>
                      <th className="text-left p-3 font-medium">Grupo</th>
                      <th className="text-center p-3 font-medium">Resultado</th>
                      <th className="text-left p-3 font-medium">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExitLogs.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Sin resultados</td></tr>
                    ) : filteredExitLogs.slice(0, 200).map((log, i) => {
                      const student = studentMap.get(log.studentId);
                      const group = student ? groupMap.get(student.groupId) : undefined;
                      return (
                        <tr key={i} className="border-t" data-testid={`row-archive-exit-${i}`}>
                          <td className="p-3 whitespace-nowrap">{log.timestamp ? format(new Date(log.timestamp), "dd/MM/yyyy HH:mm", { locale: es }) : "-"}</td>
                          <td className="p-3">{student ? `${student.firstName} ${student.lastName}` : "Desconocido"}</td>
                          <td className="p-3">{group?.name || "-"}</td>
                          <td className="p-3 text-center">
                            <Badge variant={log.result === "authorized" ? "default" : "destructive"} className="text-[10px]">
                              {log.result === "authorized" ? "Autorizado" : "Denegado"}
                            </Badge>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">{log.reason}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredExitLogs.length > 200 && (
                  <p className="text-center text-xs text-muted-foreground py-3">Mostrando 200 de {filteredExitLogs.length} registros</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lateArrivals" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[500px]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-medium">Fecha/Hora</th>
                      <th className="text-left p-3 font-medium">Alumno</th>
                      <th className="text-left p-3 font-medium">Grupo</th>
                      <th className="text-left p-3 font-medium">Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLateArrivals.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">Sin resultados</td></tr>
                    ) : filteredLateArrivals.slice(0, 200).map((la, i) => {
                      const student = studentMap.get(la.studentId);
                      const group = student ? groupMap.get(student.groupId) : undefined;
                      return (
                        <tr key={i} className="border-t" data-testid={`row-archive-late-${i}`}>
                          <td className="p-3 whitespace-nowrap">{la.timestamp ? format(new Date(la.timestamp), "dd/MM/yyyy HH:mm", { locale: es }) : "-"}</td>
                          <td className="p-3">{student ? `${student.firstName} ${student.lastName}` : "Desconocido"}</td>
                          <td className="p-3">{group?.name || "-"}</td>
                          <td className="p-3 text-xs text-muted-foreground">{la.notes || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incidents" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[500px]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-medium">Fecha</th>
                      <th className="text-left p-3 font-medium">Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.incidents.length === 0 ? (
                      <tr><td colSpan={2} className="text-center py-8 text-muted-foreground">Sin incidencias</td></tr>
                    ) : data.incidents.map((inc, i) => (
                      <tr key={i} className="border-t" data-testid={`row-archive-incident-${i}`}>
                        <td className="p-3 whitespace-nowrap">{inc.createdAt ? format(new Date(inc.createdAt), "dd/MM/yyyy HH:mm", { locale: es }) : "-"}</td>
                        <td className="p-3">{inc.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
