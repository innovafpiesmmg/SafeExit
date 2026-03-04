import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, ShieldCheck, ShieldX, CalendarDays, Clock, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery<{ total: number; authorized: number; denied: number; today: number }>({
    queryKey: ["/api/exit-stats"],
  });

  const { data: students } = useQuery<any[]>({ queryKey: ["/api/students"] });
  const { data: groups } = useQuery<any[]>({ queryKey: ["/api/groups"] });
  const { data: recentLogs, isLoading: logsLoading } = useQuery<any[]>({ queryKey: ["/api/exit-logs/recent"] });

  const statCards = [
    { label: "Salidas Hoy", value: stats?.today || 0, icon: CalendarDays, color: "text-blue-600 dark:text-blue-400" },
    { label: "Total Salidas", value: stats?.total || 0, icon: TrendingUp, color: "text-indigo-600 dark:text-indigo-400" },
    { label: "Autorizadas", value: stats?.authorized || 0, icon: ShieldCheck, color: "text-emerald-600 dark:text-emerald-400" },
    { label: "Denegadas", value: stats?.denied || 0, icon: ShieldX, color: "text-red-600 dark:text-red-400" },
    { label: "Alumnos", value: students?.length || 0, icon: Users, color: "text-amber-600 dark:text-amber-400" },
    { label: "Grupos", value: groups?.length || 0, icon: Clock, color: "text-violet-600 dark:text-violet-400" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-dashboard-title">Panel de Control</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              {statsLoading ? (
                <Skeleton className="h-10 w-16" />
              ) : (
                <>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  <div className="text-2xl font-bold" data-testid={`text-stat-${stat.label}`}>{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Actividad Reciente</CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !recentLogs?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No hay actividad registrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentLogs.slice(0, 10).map((log: any) => (
                <div key={log.id} className="flex items-center gap-3 p-3 rounded-md bg-muted/50" data-testid={`row-log-${log.id}`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${log.result === "AUTORIZADO" ? "bg-emerald-500" : "bg-red-500"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{log.studentName}</p>
                    <p className="text-xs text-muted-foreground truncate">{log.reason}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <Badge variant={log.result === "AUTORIZADO" ? "default" : "destructive"} className="text-xs">
                      {log.result}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(log.timestamp), "HH:mm")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
