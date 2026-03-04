import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, ShieldCheck, ShieldX, CalendarDays, Clock, TrendingUp, Tablet, Copy, Check, QrCode, Settings, Timer } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import QRCodeLib from "qrcode";

function GuardPwaCard() {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const appUrl = window.location.origin;

  useEffect(() => {
    QRCodeLib.toDataURL(appUrl, {
      width: 200,
      margin: 2,
      color: { dark: "#1a1a2e", light: "#ffffff" },
    }).then(setQrDataUrl).catch(() => {});
  }, [appUrl]);

  const handleCopy = () => {
    navigator.clipboard.writeText(appUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Tablet className="w-5 h-5 text-primary" />
          Instalar App en Tablet (Profesor de Guardia)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="flex-shrink-0">
            {qrDataUrl ? (
              <div className="rounded-xl border-2 border-dashed border-muted-foreground/20 p-3 bg-white">
                <img
                  src={qrDataUrl}
                  alt="QR para instalar la app"
                  className="w-[180px] h-[180px]"
                  data-testid="img-pwa-qr"
                />
              </div>
            ) : (
              <div className="w-[204px] h-[204px] rounded-xl border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
                <QrCode className="w-10 h-10 text-muted-foreground/30" />
              </div>
            )}
          </div>
          <div className="flex-1 space-y-3 text-center sm:text-left">
            <p className="text-sm text-muted-foreground">
              Escanea este código QR desde la tablet del profesor de guardia para abrir la aplicación. 
              Luego pulsa <strong>"Añadir a pantalla de inicio"</strong> en el menú del navegador para instalar la PWA.
            </p>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dirección de la aplicación</p>
              <div className="flex gap-2">
                <Input
                  value={appUrl}
                  readOnly
                  className="font-mono text-sm bg-muted/50"
                  data-testid="input-pwa-url"
                />
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={handleCopy}
                  data-testid="button-copy-pwa-url"
                  className="flex-shrink-0"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 space-y-1">
              <p className="text-xs font-medium">Credenciales del profesor de guardia:</p>
              <p className="text-xs text-muted-foreground font-mono">Usuario: <strong>profesor1</strong> — Contraseña: <strong>guard123</strong></p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function GuardSettingsCard() {
  const { toast } = useToast();
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
  });

  const updateSetting = useMutation({
    mutationFn: (data: { key: string; value: string }) => apiRequest("PUT", "/api/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Configuración guardada" });
    },
  });

  const autoReturnEnabled = settings?.autoReturnEnabled === "true";
  const autoReturnSeconds = settings?.autoReturnSeconds || "5";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          Configuración del Escáner
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
          <div className="flex items-center gap-3">
            <Switch
              checked={autoReturnEnabled}
              onCheckedChange={(checked) =>
                updateSetting.mutate({ key: "autoReturnEnabled", value: String(checked) })
              }
              data-testid="switch-auto-return"
            />
            <div>
              <Label className="font-medium">Auto-retorno tras verificación</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Vuelve al campo de lectura automáticamente
              </p>
            </div>
          </div>

          {autoReturnEnabled && (
            <div className="flex items-center gap-3">
              <Timer className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm whitespace-nowrap">Segundos:</Label>
              <Select
                value={autoReturnSeconds}
                onValueChange={(val) =>
                  updateSetting.mutate({ key: "autoReturnSeconds", value: val })
                }
              >
                <SelectTrigger className="w-20" data-testid="select-auto-return-seconds">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3s</SelectItem>
                  <SelectItem value="5">5s</SelectItem>
                  <SelectItem value="7">7s</SelectItem>
                  <SelectItem value="10">10s</SelectItem>
                  <SelectItem value="15">15s</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GuardPwaCard />
        <GuardSettingsCard />
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
