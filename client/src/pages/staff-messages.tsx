import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, MessageSquare, Send, Paperclip, FileIcon, X, Check, Trash2, Download, User as UserIcon, Search, ArrowLeft } from "lucide-react";
import { EmojiPicker } from "@/components/emoji-picker";

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

interface StaffUser {
  id: number;
  fullName: string;
  role: string;
}

interface Conversation {
  partnerId: number;
  partnerName: string;
  partnerRole: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface DirectMsg {
  id: number;
  senderId: number;
  receiverId: number;
  message: string;
  fileUrl: string | null;
  fileName: string | null;
  readAt: string | null;
  createdAt: string;
  senderName: string;
  senderRole: string;
}

type SubTab = "avisos" | "equipo" | "directo";

export default function StaffMessages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subTab, setSubTab] = useState<SubTab>("avisos");
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dmEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dmFileInputRef = useRef<HTMLInputElement>(null);
  const [expandedNotif, setExpandedNotif] = useState<number | null>(null);
  const [dmPartnerId, setDmPartnerId] = useState<number | null>(null);
  const [dmMessage, setDmMessage] = useState("");
  const [dmFile, setDmFile] = useState<File | null>(null);
  const [dmSearch, setDmSearch] = useState("");
  const [showNewDm, setShowNewDm] = useState(false);

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

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/dm/conversations"],
    refetchInterval: 10000,
  });

  const { data: dmMessages = [] } = useQuery<DirectMsg[]>({
    queryKey: ["/api/dm", dmPartnerId, "messages"],
    enabled: !!dmPartnerId,
    refetchInterval: 5000,
    queryFn: async () => {
      const res = await fetch(`/api/dm/${dmPartnerId}/messages`, { credentials: "include" });
      if (!res.ok) throw new Error("Error");
      return res.json();
    },
  });

  const { data: staffUsers = [] } = useQuery<StaffUser[]>({
    queryKey: ["/api/staff-users"],
    enabled: showNewDm,
  });

  const { data: dmUnread = { count: 0 } } = useQuery<{ count: number }>({
    queryKey: ["/api/dm/unread-count"],
    refetchInterval: 15000,
  });

  const selectedGroup = chatGroups.find(g => g.id === selectedGroupId);
  const dmPartner = conversations.find(c => c.partnerId === dmPartnerId);

  useEffect(() => {
    if (chatGroups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(chatGroups[0].id);
    }
  }, [chatGroups, selectedGroupId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    dmEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dmMessages]);

  useEffect(() => {
    if (selectedGroupId && subTab === "equipo") {
      fetch(`/api/chat/${selectedGroupId}/read`, { method: "POST", credentials: "include" });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/groups"] });
    }
  }, [selectedGroupId, messages.length, subTab]);

  useEffect(() => {
    if (dmPartnerId && subTab === "directo") {
      fetch(`/api/dm/${dmPartnerId}/read`, { method: "POST", credentials: "include" });
      queryClient.invalidateQueries({ queryKey: ["/api/dm/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dm/unread-count"] });
    }
  }, [dmPartnerId, dmMessages.length, subTab]);

  const markReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/notifications/${id}/read`, { method: "POST", credentials: "include" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const dismissNotifMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/notifications/${id}/dismiss`, { method: "POST", credentials: "include" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      toast({ title: "Aviso eliminado" });
    },
  });

  const deleteMsgMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/chat/messages/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const t = await res.json();
        throw new Error(t.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat", selectedGroupId, "messages"] });
      toast({ title: "Mensaje eliminado" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteDmMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/dm/messages/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const t = await res.json();
        throw new Error(t.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dm", dmPartnerId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dm/conversations"] });
      toast({ title: "Mensaje eliminado" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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

  const sendDmMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      if (dmMessage.trim()) formData.append("message", dmMessage.trim());
      if (dmFile) formData.append("file", dmFile);
      const res = await fetch(`/api/dm/${dmPartnerId}/messages`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const t = await res.json();
        throw new Error(t.message);
      }
      return res.json();
    },
    onSuccess: () => {
      setDmMessage("");
      setDmFile(null);
      queryClient.invalidateQueries({ queryKey: ["/api/dm", dmPartnerId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dm/conversations"] });
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

  const handleSendDm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dmMessage.trim() && !dmFile) return;
    if (!dmPartnerId) return;
    sendDmMutation.mutate();
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

  const startNewConversation = (userId: number) => {
    setDmPartnerId(userId);
    setShowNewDm(false);
    setDmSearch("");
  };

  const roleLabel = (role: string) => {
    if (role === "admin") return "Admin";
    if (role === "guard") return "Guardia";
    return "Profesor";
  };

  const unreadNotifs = notifs.filter(n => !n.read).length;
  const totalChatUnread = chatGroups.reduce((sum, g) => sum + g.unreadCount, 0);
  const totalDmUnread = dmUnread.count;

  const filteredStaff = staffUsers.filter(u =>
    u.fullName.toLowerCase().includes(dmSearch.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b bg-card/50">
        <button
          onClick={() => setSubTab("avisos")}
          className={`flex-1 py-3 text-sm font-medium text-center relative transition-colors ${subTab === "avisos" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
          data-testid="subtab-avisos"
        >
          <div className="flex items-center justify-center gap-1.5">
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
          <div className="flex items-center justify-center gap-1.5">
            <MessageSquare className="w-4 h-4" />
            Equipo
            {totalChatUnread > 0 && (
              <Badge className="rounded-full h-5 min-w-[20px] flex items-center justify-center p-0 text-[10px]">
                {totalChatUnread}
              </Badge>
            )}
          </div>
        </button>
        <button
          onClick={() => setSubTab("directo")}
          className={`flex-1 py-3 text-sm font-medium text-center relative transition-colors ${subTab === "directo" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
          data-testid="subtab-directo"
        >
          <div className="flex items-center justify-center gap-1.5">
            <UserIcon className="w-4 h-4" />
            Directo
            {totalDmUnread > 0 && (
              <Badge className="rounded-full h-5 min-w-[20px] flex items-center justify-center p-0 text-[10px]">
                {totalDmUnread}
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
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(notif.createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                          </span>
                          <button
                            onClick={e => { e.stopPropagation(); dismissNotifMutation.mutate(notif.id); }}
                            className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                            title="Eliminar aviso"
                            data-testid={`button-dismiss-notif-${notif.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">De: {notif.senderName}</p>
                      {expandedNotif === notif.id ? (
                        <div className="mt-2 space-y-2">
                          <p className="text-sm whitespace-pre-wrap">{notif.message}</p>
                          {notif.fileUrl && (
                            <a
                              href={`/api/download/${notif.fileUrl.split("/").pop()}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-xs text-primary hover:underline"
                              onClick={e => e.stopPropagation()}
                              data-testid={`link-notif-download-${notif.id}`}
                            >
                              <Download className="w-3 h-3" />
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
                  const canDelete = isMe || user?.role === "admin";
                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} group`} data-testid={`staff-chat-msg-${msg.id}`}>
                      <div className={`max-w-[80%] rounded-xl px-3 py-2 relative ${isMe ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {canDelete && (
                          <button
                            onClick={() => deleteMsgMutation.mutate(msg.id)}
                            className={`absolute -top-2 ${isMe ? "-left-2" : "-right-2"} w-5 h-5 rounded-full bg-destructive text-destructive-foreground items-center justify-center text-[10px] hidden group-hover:flex`}
                            title="Eliminar mensaje"
                            data-testid={`button-delete-msg-${msg.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                        {!isMe && (
                          <p className="text-xs font-semibold mb-0.5 opacity-80">
                            {msg.senderName}
                            {msg.senderRole === "admin" && " (Admin)"}
                          </p>
                        )}
                        {msg.message && <p className="text-sm whitespace-pre-wrap">{msg.message}</p>}
                        {msg.fileUrl && (
                          <a
                            href={`/api/download/${msg.fileUrl.split("/").pop()}`}
                            target="_blank"
                            rel="noreferrer"
                            className={`flex items-center gap-1 text-xs mt-1 ${isMe ? "text-primary-foreground/80" : "text-primary hover:underline"}`}
                            data-testid={`link-chat-download-${msg.id}`}
                          >
                            <Download className="w-3 h-3" />
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
                  <EmojiPicker onSelect={(emoji) => setNewMessage(prev => prev + emoji)} />
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

      {subTab === "directo" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {!dmPartnerId ? (
            <>
              <div className="p-3 border-b flex-shrink-0">
                <Button
                  onClick={() => setShowNewDm(!showNewDm)}
                  size="sm"
                  className="w-full"
                  data-testid="button-new-dm"
                >
                  <UserIcon className="w-4 h-4 mr-2" />
                  Nueva conversación
                </Button>
              </div>

              {showNewDm && (
                <div className="border-b p-3 space-y-2 flex-shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={dmSearch}
                      onChange={e => setDmSearch(e.target.value)}
                      placeholder="Buscar persona..."
                      className="pl-9"
                      data-testid="input-dm-search"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {filteredStaff.map(u => (
                      <button
                        key={u.id}
                        onClick={() => startNewConversation(u.id)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
                        data-testid={`button-start-dm-${u.id}`}
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <UserIcon className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{u.fullName}</p>
                          <p className="text-[10px] text-muted-foreground">{roleLabel(u.role)}</p>
                        </div>
                      </button>
                    ))}
                    {filteredStaff.length === 0 && (
                      <p className="text-center text-xs text-muted-foreground py-2">No se encontraron resultados</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto">
                {conversations.length === 0 && !showNewDm ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <MessageSquare className="w-10 h-10 mb-2 opacity-50" />
                    <p className="text-sm">No hay conversaciones</p>
                    <p className="text-xs mt-1">Pulsa "Nueva conversación" para empezar</p>
                  </div>
                ) : (
                  conversations.map(conv => (
                    <button
                      key={conv.partnerId}
                      onClick={() => setDmPartnerId(conv.partnerId)}
                      className="w-full flex items-center gap-3 px-4 py-3 border-b hover:bg-muted/50 transition-colors text-left"
                      data-testid={`dm-conv-${conv.partnerId}`}
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <UserIcon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium truncate">{conv.partnerName}</p>
                          {conv.lastMessageAt && (
                            <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">
                              {new Date(conv.lastMessageAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-xs text-muted-foreground truncate flex-1">{conv.lastMessage || "Archivo adjunto"}</p>
                          {conv.unreadCount > 0 && (
                            <Badge className="rounded-full h-5 min-w-[20px] flex items-center justify-center p-0 text-[10px] ml-2">
                              {conv.unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <div className="p-3 border-b flex items-center gap-3 flex-shrink-0">
                <button
                  onClick={() => { setDmPartnerId(null); setDmMessage(""); setDmFile(null); }}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                  data-testid="button-dm-back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <UserIcon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" data-testid="text-dm-partner-name">
                    {dmPartner?.partnerName || staffUsers.find(u => u.id === dmPartnerId)?.fullName || "..."}
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {dmMessages.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">No hay mensajes aún. Envía el primero.</p>
                )}
                {dmMessages.map(msg => {
                  const isMe = msg.senderId === user?.id;
                  const canDelete = isMe || user?.role === "admin";
                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} group`} data-testid={`dm-msg-${msg.id}`}>
                      <div className={`max-w-[80%] rounded-xl px-3 py-2 relative ${isMe ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {canDelete && (
                          <button
                            onClick={() => deleteDmMutation.mutate(msg.id)}
                            className={`absolute -top-2 ${isMe ? "-left-2" : "-right-2"} w-5 h-5 rounded-full bg-destructive text-destructive-foreground items-center justify-center text-[10px] hidden group-hover:flex`}
                            title="Eliminar mensaje"
                            data-testid={`button-delete-dm-${msg.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                        {msg.message && <p className="text-sm whitespace-pre-wrap">{msg.message}</p>}
                        {msg.fileUrl && (
                          <a
                            href={`/api/download/${msg.fileUrl.split("/").pop()}`}
                            target="_blank"
                            rel="noreferrer"
                            className={`flex items-center gap-1 text-xs mt-1 ${isMe ? "text-primary-foreground/80" : "text-primary hover:underline"}`}
                            data-testid={`link-dm-download-${msg.id}`}
                          >
                            <Download className="w-3 h-3" />
                            {msg.fileName || "Archivo"}
                          </a>
                        )}
                        <div className={`flex items-center gap-1 mt-1 ${isMe ? "justify-end" : ""}`}>
                          <p className={`text-[10px] ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                            {new Date(msg.createdAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                          {isMe && msg.readAt && (
                            <Check className={`w-3 h-3 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`} />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={dmEndRef} />
              </div>

              <form onSubmit={handleSendDm} className="p-3 border-t flex items-end gap-2 flex-shrink-0">
                <div className="flex-1 space-y-1">
                  {dmFile && (
                    <div className="flex items-center gap-2 text-xs bg-muted rounded px-2 py-1">
                      <Paperclip className="w-3 h-3" />
                      <span className="truncate flex-1">{dmFile.name}</span>
                      <button type="button" onClick={() => setDmFile(null)}>
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <Input
                    value={dmMessage}
                    onChange={e => setDmMessage(e.target.value)}
                    placeholder="Escribe un mensaje..."
                    data-testid="input-dm-message"
                  />
                </div>
                <input
                  type="file"
                  ref={dmFileInputRef}
                  className="hidden"
                  onChange={e => setDmFile(e.target.files?.[0] || null)}
                />
                <EmojiPicker onSelect={(emoji) => setDmMessage(prev => prev + emoji)} />
                <Button type="button" size="icon" variant="ghost" onClick={() => dmFileInputRef.current?.click()} className="min-h-[44px] min-w-[44px]">
                  <Paperclip className="w-4 h-4" />
                </Button>
                <Button type="submit" size="icon" disabled={sendDmMutation.isPending} className="min-h-[44px] min-w-[44px]" data-testid="button-dm-send">
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
