import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Search, Trash2, ChevronLeft, ChevronRight, Clock } from "lucide-react";

interface AuditLog {
  id: number;
  userId: number | null;
  userName: string | null;
  action: string;
  entity: string;
  entityId: number | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  login: "Inicio de sesión",
  logout: "Cierre de sesión",
  create: "Crear",
  update: "Modificar",
  delete: "Eliminar",
  archive: "Archivar",
  reset: "Reiniciar",
  cleanup: "Limpieza",
  auto_cleanup: "Limpieza automática",
};

const ENTITY_LABELS: Record<string, string> = {
  auth: "Autenticación",
  student: "Alumno",
  user: "Usuario",
  permissions: "Permisos",
  settings: "Ajustes",
  academic_year: "Curso académico",
  system: "Sistema",
};

const ACTION_COLORS: Record<string, string> = {
  login: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  logout: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
  create: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  update: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  delete: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  archive: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
  reset: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  cleanup: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  auto_cleanup: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
};

export default function AuditLogsPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(0);
  const [filterAction, setFilterAction] = useState<string>("");
  const [filterEntity, setFilterEntity] = useState<string>("");
  const [cleanupYears, setCleanupYears] = useState("3");
  const pageSize = 30;

  const queryParams = new URLSearchParams();
  queryParams.set("limit", String(pageSize));
  queryParams.set("offset", String(page * pageSize));
  if (filterAction && filterAction !== "all") queryParams.set("action", filterAction);
  if (filterEntity && filterEntity !== "all") queryParams.set("entity", filterEntity);

  const { data, isLoading } = useQuery<{ logs: AuditLog[]; total: number }>({
    queryKey: ["/api/audit-logs", page, filterAction, filterEntity],
    queryFn: async () => {
      const res = await fetch(`/api/audit-logs?${queryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error");
      return res.json();
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ years: parseInt(cleanupYears) }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Error");
      return res.json();
    },
    onSuccess: (result) => {
      const total = Object.values(result as Record<string, number>).reduce((s, n) => s + n, 0);
      toast({ title: "Limpieza completada", description: `${total} registros eliminados` });
      queryClient.invalidateQueries({ queryKey: ["/api/audit-logs"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Error al ejecutar la limpieza", variant: "destructive" });
    },
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-audit-title">
          <Shield className="w-6 h-6" />
          Auditoría y Mantenimiento
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Registro de actividad y limpieza de datos antiguos</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            Limpieza de Registros Antiguos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Elimina registros de salida, tardanzas, mensajes, notificaciones e incidencias anteriores al período indicado.
            Esta acción es irreversible.
          </p>
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Antigüedad (años)</label>
              <Select value={cleanupYears} onValueChange={setCleanupYears}>
                <SelectTrigger className="w-32" data-testid="select-cleanup-years">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 año</SelectItem>
                  <SelectItem value="2">2 años</SelectItem>
                  <SelectItem value="3">3 años</SelectItem>
                  <SelectItem value="5">5 años</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => {
                if (confirm(`¿Estás seguro de eliminar todos los registros con más de ${cleanupYears} años de antigüedad?`)) {
                  cleanupMutation.mutate();
                }
              }}
              variant="destructive"
              disabled={cleanupMutation.isPending}
              data-testid="button-run-cleanup"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {cleanupMutation.isPending ? "Limpiando..." : "Ejecutar limpieza"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            La limpieza automática se ejecuta diariamente y elimina registros con más de 3 años.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Registro de Auditoría
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Select value={filterAction || "all"} onValueChange={v => { setFilterAction(v); setPage(0); }}>
              <SelectTrigger className="w-44" data-testid="select-filter-action">
                <SelectValue placeholder="Filtrar por acción" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las acciones</SelectItem>
                <SelectItem value="login">Inicio de sesión</SelectItem>
                <SelectItem value="logout">Cierre de sesión</SelectItem>
                <SelectItem value="create">Crear</SelectItem>
                <SelectItem value="update">Modificar</SelectItem>
                <SelectItem value="delete">Eliminar</SelectItem>
                <SelectItem value="archive">Archivar</SelectItem>
                <SelectItem value="reset">Reiniciar</SelectItem>
                <SelectItem value="cleanup">Limpieza</SelectItem>
                <SelectItem value="auto_cleanup">Limpieza automática</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterEntity || "all"} onValueChange={v => { setFilterEntity(v); setPage(0); }}>
              <SelectTrigger className="w-44" data-testid="select-filter-entity">
                <SelectValue placeholder="Filtrar por entidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las entidades</SelectItem>
                <SelectItem value="auth">Autenticación</SelectItem>
                <SelectItem value="student">Alumno</SelectItem>
                <SelectItem value="user">Usuario</SelectItem>
                <SelectItem value="permissions">Permisos</SelectItem>
                <SelectItem value="settings">Ajustes</SelectItem>
                <SelectItem value="academic_year">Curso académico</SelectItem>
                <SelectItem value="system">Sistema</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Cargando...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">No hay registros de auditoría</div>
          ) : (
            <div className="space-y-1">
              {logs.map(log => (
                <div key={log.id} className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors border-b last:border-0" data-testid={`audit-log-${log.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-[10px] px-1.5 py-0 ${ACTION_COLORS[log.action] || "bg-muted"}`}>
                        {ACTION_LABELS[log.action] || log.action}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{ENTITY_LABELS[log.entity] || log.entity}</span>
                      {log.userName && (
                        <span className="text-xs font-medium">{log.userName}</span>
                      )}
                    </div>
                    {log.details && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.details}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0">
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(log.createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(log.createdAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {log.ipAddress && (
                      <span className="text-[9px] text-muted-foreground">{log.ipAddress}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">{total} registros en total</p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                  data-testid="button-audit-prev"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                  data-testid="button-audit-next"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
