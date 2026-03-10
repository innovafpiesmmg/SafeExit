import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, MessageSquare, Send, Paperclip, FileIcon, X, Check } from "lucide-react";

interface Notification {
  id: number;
  senderId: number;
  title: string;
  message: string;
  targetType: string;
  targetId: number | null;
  fileUrl: string | null;
  fileName: string | null;
  createdAt: string;
  read: boolean;
  senderName: string;
}

interface ChatGroup {
  id: number;
  name: string;
  course: string;
  chatBidirectional: boolean;
  unreadCount: number;
}

interface ChatMsg {
  id: number;
  groupId: number;
  senderId: number;
  message: string;
  fileUrl: string | null;
  fileName: string | null;
  createdAt: string;
  senderName: string;
  senderRole: string;
}

type SubTab = "avisos" | "equipo";

export default function StaffMessages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subTab, setSubTab] = useState<SubTab>("avisos");
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedNotif, setExpandedNotif] = useState<number | null>(null);

  const { data: notifs = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 15000,
  });

  const { data: chatGroups = [] } = useQuery<ChatGroup[]>({
    queryKey: ["/api/chat/groups"],
    refetchInterval: 15000,
  });

  const { data: messages = [] } = useQuery<ChatMsg[]>({
    queryKey: ["/api/chat", selectedGroupId, "messages"],
    enabled: !!selectedGroupId,
    refetchInterval: 5000,
  });

  const selectedGroup = chatGroups.find(g => g.id === selectedGroupId);

  useEffect(() => {
    if (chatGroups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(chatGroups[0].id);
    }
  }, [chatGroups, selectedGroupId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (selectedGroupId && subTab === "equipo") {
      fetch(`/api/chat/${selectedGroupId}/read`, { method: "POST", credentials: "include" });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/groups"] });
    }
  }, [selectedGroupId, messages.length, subTab]);

  const markReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/notifications/${id}/read`, { method: "POST", credentials: "include" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      if (newMessage.trim()) formData.append("message", newMessage.trim());
      if (file) formData.append("file", file);
      const res = await fetch(`/api/chat/${selectedGroupId}/messages`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t);
      }
      return res.json();
    },
    onSuccess: () => {
      setNewMessage("");
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["/api/chat", selectedGroupId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/groups"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && !file) return;
    if (!selectedGroupId) return;
    sendMutation.mutate();
  };

  const handleExpandNotif = (notif: Notification) => {
    if (expandedNotif === notif.id) {
      setExpandedNotif(null);
    } else {
      setExpandedNotif(notif.id);
      if (!notif.read) {
        markReadMutation.mutate(notif.id);
      }
    }
  };

  const unreadNotifs = notifs.filter(n => !n.read).length;
  const totalChatUnread = chatGroups.reduce((sum, g) => sum + g.unreadCount, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b bg-card/50">
        <button
          onClick={() => setSubTab("avisos")}
          className={`flex-1 py-3 text-sm font-medium text-center relative transition-colors ${subTab === "avisos" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
          data-testid="subtab-avisos"
        >
          <div className="flex items-center justify-center gap-2">
            <Bell className="w-4 h-4" />
            Avisos
            {unreadNotifs > 0 && (
              <Badge className="rounded-full h-5 min-w-[20px] flex items-center justify-center p-0 text-[10px]">
                {unreadNotifs}
              </Badge>
            )}
          </div>
        </button>
        <button
          onClick={() => setSubTab("equipo")}
          className={`flex-1 py-3 text-sm font-medium text-center relative transition-colors ${subTab === "equipo" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
          data-testid="subtab-equipo"
        >
          <div className="flex items-center justify-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Equipo
            {totalChatUnread > 0 && (
              <Badge className="rounded-full h-5 min-w-[20px] flex items-center justify-center p-0 text-[10px]">
                {totalChatUnread}
              </Badge>
            )}
          </div>
        </button>
      </div>

      {subTab === "avisos" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {notifs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">No hay avisos</p>
            </div>
          ) : (
            notifs.map(notif => (
              <Card
                key={notif.id}
                className={`cursor-pointer transition-colors ${!notif.read ? "border-primary/30 bg-primary/5" : ""}`}
                onClick={() => handleExpandNotif(notif)}
                data-testid={`notif-card-${notif.id}`}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${notif.read ? "bg-transparent" : "bg-primary"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-sm">{notif.title}</h3>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          {new Date(notif.createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">De: {notif.senderName}</p>
                      {expandedNotif === notif.id ? (
                        <div className="mt-2 space-y-2">
                          <p className="text-sm whitespace-pre-wrap">{notif.message}</p>
                          {notif.fileUrl && (
                            <a
                              href={notif.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-xs text-primary hover:underline"
                              onClick={e => e.stopPropagation()}
                            >
                              <FileIcon className="w-3 h-3" />
                              {notif.fileName || "Archivo adjunto"}
                            </a>
                          )}
                          {notif.read && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Check className="w-3 h-3" />
                              Leído
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{notif.message}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {subTab === "equipo" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {chatGroups.length > 1 && (
            <div className="flex gap-2 p-3 overflow-x-auto border-b flex-shrink-0">
              {chatGroups.map(g => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGroupId(g.id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedGroupId === g.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                  data-testid={`chat-group-pill-${g.id}`}
                >
                  {g.name}
                  {g.unreadCount > 0 && (
                    <span className="ml-1.5 bg-destructive text-destructive-foreground rounded-full px-1.5 text-[10px]">
                      {g.unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {chatGroups.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No perteneces a ningún grupo</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {messages.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">No hay mensajes aún</p>
                )}
                {messages.map(msg => {
                  const isMe = msg.senderId === user?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`} data-testid={`staff-chat-msg-${msg.id}`}>
                      <div className={`max-w-[80%] rounded-xl px-3 py-2 ${isMe ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {!isMe && (
                          <p className="text-xs font-semibold mb-0.5 opacity-80">
                            {msg.senderName}
                            {msg.senderRole === "admin" && " (Admin)"}
                          </p>
                        )}
                        {msg.message && <p className="text-sm whitespace-pre-wrap">{msg.message}</p>}
                        {msg.fileUrl && (
                          <a
                            href={msg.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={`flex items-center gap-1 text-xs mt-1 ${isMe ? "text-primary-foreground/80" : "text-primary hover:underline"}`}
                          >
                            <FileIcon className="w-3 h-3" />
                            {msg.fileName || "Archivo"}
                          </a>
                        )}
                        <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                          {new Date(msg.createdAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {selectedGroup && (selectedGroup.chatBidirectional || user?.role === "admin") ? (
                <form onSubmit={handleSend} className="p-3 border-t flex items-end gap-2 flex-shrink-0">
                  <div className="flex-1 space-y-1">
                    {file && (
                      <div className="flex items-center gap-2 text-xs bg-muted rounded px-2 py-1">
                        <Paperclip className="w-3 h-3" />
                        <span className="truncate flex-1">{file.name}</span>
                        <button type="button" onClick={() => setFile(null)}>
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <Input
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      placeholder="Escribe un mensaje..."
                      data-testid="input-staff-chat"
                    />
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={e => setFile(e.target.files?.[0] || null)}
                  />
                  <Button type="button" size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()} className="min-h-[44px] min-w-[44px]">
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <Button type="submit" size="icon" disabled={sendMutation.isPending} className="min-h-[44px] min-w-[44px]" data-testid="button-staff-chat-send">
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              ) : (
                <div className="p-3 border-t text-center text-xs text-muted-foreground">
                  Solo el administrador puede enviar mensajes en este grupo
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
