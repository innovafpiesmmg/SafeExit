import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bell, Send, Trash2, Users, User, GraduationCap, Paperclip, FileIcon, Eye, X } from "lucide-react";
import type { Group } from "@shared/schema";

interface SentNotification {
  id: number;
  senderId: number;
  title: string;
  message: string;
  targetType: string;
  targetId: number | null;
  fileUrl: string | null;
  fileName: string | null;
  createdAt: string;
  senderName: string;
  readCount: number;
  totalRecipients: number;
  targetName: string;
}

export default function NotificationsAdminPage() {
  const { toast } = useToast();
  const [composeOpen, setComposeOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetType, setTargetType] = useState("all");
  const [targetId, setTargetId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [detailNotif, setDetailNotif] = useState<SentNotification | null>(null);

  const { data: sentNotifications = [], isLoading } = useQuery<SentNotification[]>({
    queryKey: ["/api/notifications/sent"],
    refetchInterval: 10000,
  });

  const { data: allGroups = [] } = useQuery<Group[]>({
    queryKey: ["/api/groups"],
  });

  const { data: allStaff = [] } = useQuery<{ id: number; fullName: string }[]>({
    queryKey: ["/api/staff-list"],
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("message", message);
      formData.append("targetType", targetType);
      if (targetId) formData.append("targetId", targetId);
      if (file) formData.append("file", file);
      const res = await fetch("/api/notifications", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Notificación enviada" });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/sent"] });
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/notifications/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Notificación eliminada" });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/sent"] });
      setDetailNotif(null);
    },
  });

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setTargetType("all");
    setTargetId("");
    setFile(null);
    setComposeOpen(false);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    sendMutation.mutate();
  };

  const getTargetIcon = (type: string) => {
    switch (type) {
      case "all": return <Users className="w-4 h-4" />;
      case "group": return <GraduationCap className="w-4 h-4" />;
      case "user": return <User className="w-4 h-4" />;
      default: return <Users className="w-4 h-4" />;
    }
  };

  const getTargetLabel = (type: string) => {
    switch (type) {
      case "all": return "Todos";
      case "group": return "Grupo";
      case "user": return "Profesor";
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-notifications-title">
            <Bell className="w-6 h-6" />
            Notificaciones
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Envía avisos a profesores y grupos</p>
        </div>
        <Button onClick={() => setComposeOpen(true)} data-testid="button-compose-notification">
          <Send className="w-4 h-4 mr-2" />
          Nueva notificación
        </Button>
      </div>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva notificación</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSend} className="space-y-4">
            <div className="space-y-2">
              <Label>Destinatario</Label>
              <Select value={targetType} onValueChange={(v) => { setTargetType(v); setTargetId(""); }}>
                <SelectTrigger data-testid="select-target-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los profesores</SelectItem>
                  <SelectItem value="group">Un grupo específico</SelectItem>
                  <SelectItem value="user">Un profesor específico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {targetType === "group" && (
              <div className="space-y-2">
                <Label>Grupo</Label>
                <Select value={targetId} onValueChange={setTargetId}>
                  <SelectTrigger data-testid="select-target-group">
                    <SelectValue placeholder="Seleccionar grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    {allGroups.map(g => (
                      <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {targetType === "user" && (
              <div className="space-y-2">
                <Label>Profesor</Label>
                <Select value={targetId} onValueChange={setTargetId}>
                  <SelectTrigger data-testid="select-target-user">
                    <SelectValue placeholder="Seleccionar profesor" />
                  </SelectTrigger>
                  <SelectContent>
                    {allStaff.map(g => (
                      <SelectItem key={g.id} value={String(g.id)}>{g.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Asunto de la notificación"
                required
                data-testid="input-notification-title"
              />
            </div>

            <div className="space-y-2">
              <Label>Mensaje</Label>
              <Textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Escribe el contenido del aviso..."
                rows={4}
                required
                data-testid="input-notification-message"
              />
            </div>

            <div className="space-y-2">
              <Label>Archivo adjunto (opcional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                  className="flex-1"
                  data-testid="input-notification-file"
                />
                {file && (
                  <Button type="button" size="icon" variant="ghost" onClick={() => setFile(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={sendMutation.isPending} data-testid="button-send-notification">
              {sendMutation.isPending ? "Enviando..." : "Enviar notificación"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : sentNotifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Bell className="w-12 h-12 text-muted-foreground" />
            <p className="text-muted-foreground">No hay notificaciones enviadas</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sentNotifications.map(notif => (
            <Card key={notif.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setDetailNotif(notif)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getTargetIcon(notif.targetType)}
                      <Badge variant="outline" className="text-xs">{notif.targetName || getTargetLabel(notif.targetType)}</Badge>
                      {notif.fileUrl && <Paperclip className="w-3 h-3 text-muted-foreground" />}
                    </div>
                    <h3 className="font-medium text-sm" data-testid={`text-notif-title-${notif.id}`}>{notif.title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{notif.message}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-muted-foreground">
                      {new Date(notif.createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <Eye className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{notif.readCount}/{notif.totalRecipients}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!detailNotif} onOpenChange={() => setDetailNotif(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailNotif && getTargetIcon(detailNotif.targetType)}
              {detailNotif?.title}
            </DialogTitle>
          </DialogHeader>
          {detailNotif && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">{detailNotif.targetName || getTargetLabel(detailNotif.targetType)}</Badge>
                <span>·</span>
                <span>{new Date(detailNotif.createdAt).toLocaleString("es-ES")}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{detailNotif.message}</p>
              {detailNotif.fileUrl && (
                <a
                  href={detailNotif.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                  data-testid="link-notif-file"
                >
                  <FileIcon className="w-4 h-4" />
                  {detailNotif.fileName || "Archivo adjunto"}
                </a>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Eye className="w-4 h-4" />
                  <span>Leída por {detailNotif.readCount} de {detailNotif.totalRecipients}</span>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteMutation.mutate(detailNotif.id)}
                  disabled={deleteMutation.isPending}
                  data-testid="button-delete-notification"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Eliminar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
