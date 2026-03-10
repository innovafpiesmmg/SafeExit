import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MessageSquare, Send, Paperclip, X, ArrowUpDown, Trash2, Download, User as UserIcon, Search, ArrowLeft, Check } from "lucide-react";
import { EmojiPicker } from "@/components/emoji-picker";
import type { Group } from "@shared/schema";

interface ChatGroup extends Group {
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

type AdminChatTab = "grupos" | "directo";

export default function ChatAdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<AdminChatTab>("grupos");
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dmEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dmFileInputRef = useRef<HTMLInputElement>(null);
  const [dmPartnerId, setDmPartnerId] = useState<number | null>(null);
  const [dmMessage, setDmMessage] = useState("");
  const [dmFile, setDmFile] = useState<File | null>(null);
  const [dmSearch, setDmSearch] = useState("");
  const [showNewDm, setShowNewDm] = useState(false);

  const { data: chatGroups = [] } = useQuery<ChatGroup[]>({
    queryKey: ["/api/chat/groups"],
    refetchInterval: 10000,
  });

  const selectedGroup = chatGroups.find(g => g.id === selectedGroupId);

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

  const dmPartner = conversations.find(c => c.partnerId === dmPartnerId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    dmEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dmMessages]);

  useEffect(() => {
    if (selectedGroupId) {
      fetch(`/api/chat/${selectedGroupId}/read`, { method: "POST", credentials: "include" });
    }
  }, [selectedGroupId, messages.length]);

  useEffect(() => {
    if (dmPartnerId && tab === "directo") {
      fetch(`/api/dm/${dmPartnerId}/read`, { method: "POST", credentials: "include" });
      queryClient.invalidateQueries({ queryKey: ["/api/dm/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dm/unread-count"] });
    }
  }, [dmPartnerId, dmMessages.length, tab]);

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
        const text = await res.text();
        throw new Error(text);
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

  const toggleBidirectional = useMutation({
    mutationFn: async ({ groupId, value }: { groupId: number; value: boolean }) => {
      const res = await fetch(`/api/groups/${groupId}/chat-bidirectional`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatBidirectional: value }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Error al actualizar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
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

  const totalDmUnread = dmUnread.count;
  const totalGroupUnread = chatGroups.reduce((s, g) => s + g.unreadCount, 0);

  const filteredStaff = staffUsers.filter(u =>
    u.fullName.toLowerCase().includes(dmSearch.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-chat-title">
          <MessageSquare className="w-6 h-6" />
          Mensajería
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Chat con el equipo educativo</p>
      </div>

      <div className="flex gap-2 border-b">
        <button
          onClick={() => setTab("grupos")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "grupos" ? "text-primary border-primary" : "text-muted-foreground border-transparent"}`}
          data-testid="tab-admin-grupos"
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Grupos
            {totalGroupUnread > 0 && (
              <Badge className="rounded-full h-5 min-w-[20px] flex items-center justify-center p-0 text-[10px]">
                {totalGroupUnread}
              </Badge>
            )}
          </div>
        </button>
        <button
          onClick={() => setTab("directo")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "directo" ? "text-primary border-primary" : "text-muted-foreground border-transparent"}`}
          data-testid="tab-admin-directo"
        >
          <div className="flex items-center gap-2">
            <UserIcon className="w-4 h-4" />
            Mensajes Directos
            {totalDmUnread > 0 && (
              <Badge className="rounded-full h-5 min-w-[20px] flex items-center justify-center p-0 text-[10px]">
                {totalDmUnread}
              </Badge>
            )}
          </div>
        </button>
      </div>

      {tab === "grupos" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: "calc(100vh - 280px)" }}>
          <div className="lg:col-span-1 space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground px-1">Grupos</h2>
            <div className="space-y-1">
              {chatGroups.map(g => (
                <Card
                  key={g.id}
                  className={`cursor-pointer transition-colors ${selectedGroupId === g.id ? "border-primary bg-accent" : "hover:bg-accent/50"}`}
                  onClick={() => setSelectedGroupId(g.id)}
                  data-testid={`chat-group-${g.id}`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{g.name}</p>
                        <p className="text-xs text-muted-foreground">{g.course}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {g.unreadCount > 0 && (
                          <Badge className="rounded-full h-5 w-5 flex items-center justify-center p-0 text-[10px]">
                            {g.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                      <Label className="text-xs text-muted-foreground cursor-pointer">Bidireccional</Label>
                      <Switch
                        checked={g.chatBidirectional}
                        onCheckedChange={v => {
                          toggleBidirectional.mutate({ groupId: g.id, value: v });
                        }}
                        onClick={e => e.stopPropagation()}
                        data-testid={`switch-bidirectional-${g.id}`}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
              {chatGroups.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No hay grupos</p>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col border rounded-lg bg-card">
            {!selectedGroupId ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Selecciona un grupo para ver el chat</p>
                </div>
              </div>
            ) : (
              <>
                <div className="p-3 border-b flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{selectedGroup?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedGroup?.chatBidirectional ? "Chat bidireccional" : "Solo administrador puede escribir"}
                    </p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: "calc(100vh - 440px)" }}>
                  {messages.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-8">No hay mensajes aún</p>
                  )}
                  {messages.map(msg => {
                    const isMe = msg.senderId === user?.id;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} group`} data-testid={`chat-msg-${msg.id}`}>
                        <div className={`max-w-[75%] rounded-xl px-3 py-2 relative ${isMe ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          <button
                            onClick={() => deleteMsgMutation.mutate(msg.id)}
                            className={`absolute -top-2 ${isMe ? "-left-2" : "-right-2"} w-5 h-5 rounded-full bg-destructive text-destructive-foreground items-center justify-center text-[10px] hidden group-hover:flex`}
                            title="Eliminar mensaje"
                            data-testid={`button-delete-msg-${msg.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                          {!isMe && (
                            <p className="text-xs font-semibold mb-1 opacity-80">
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
                              className={`flex items-center gap-1 text-xs mt-1 ${isMe ? "text-primary-foreground/80 hover:text-primary-foreground" : "text-primary hover:underline"}`}
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

                <form onSubmit={handleSend} className="p-3 border-t flex items-end gap-2">
                  <div className="flex-1 space-y-2">
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
                      data-testid="input-chat-message"
                    />
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={e => setFile(e.target.files?.[0] || null)}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-chat-attach"
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <EmojiPicker onSelect={(emoji) => setNewMessage(prev => prev + emoji)} />
                  <Button type="submit" size="icon" disabled={sendMutation.isPending} data-testid="button-chat-send">
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {tab === "directo" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: "calc(100vh - 280px)" }}>
          <div className="lg:col-span-1 space-y-2">
            <Button
              onClick={() => setShowNewDm(!showNewDm)}
              size="sm"
              className="w-full"
              data-testid="button-admin-new-dm"
            >
              <UserIcon className="w-4 h-4 mr-2" />
              Nueva conversación
            </Button>

            {showNewDm && (
              <div className="border rounded-lg p-3 space-y-2 bg-card">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={dmSearch}
                    onChange={e => setDmSearch(e.target.value)}
                    placeholder="Buscar persona..."
                    className="pl-9"
                    data-testid="input-admin-dm-search"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredStaff.map(u => (
                    <button
                      key={u.id}
                      onClick={() => startNewConversation(u.id)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
                      data-testid={`button-admin-start-dm-${u.id}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <UserIcon className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{u.fullName}</p>
                        <p className="text-[10px] text-muted-foreground">{roleLabel(u.role)}</p>
                      </div>
                    </button>
                  ))}
                  {filteredStaff.length === 0 && (
                    <p className="text-center text-xs text-muted-foreground py-2">Sin resultados</p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-1">
              {conversations.length === 0 && !showNewDm && (
                <p className="text-sm text-muted-foreground text-center py-4">No hay conversaciones directas</p>
              )}
              {conversations.map(conv => (
                <Card
                  key={conv.partnerId}
                  className={`cursor-pointer transition-colors ${dmPartnerId === conv.partnerId ? "border-primary bg-accent" : "hover:bg-accent/50"}`}
                  onClick={() => setDmPartnerId(conv.partnerId)}
                  data-testid={`admin-dm-conv-${conv.partnerId}`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <UserIcon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium truncate">{conv.partnerName}</p>
                          {conv.unreadCount > 0 && (
                            <Badge className="rounded-full h-5 min-w-[20px] flex items-center justify-center p-0 text-[10px]">
                              {conv.unreadCount}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{conv.lastMessage || "Archivo"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col border rounded-lg bg-card">
            {!dmPartnerId ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <UserIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Selecciona una conversación o crea una nueva</p>
                </div>
              </div>
            ) : (
              <>
                <div className="p-3 border-b flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-4 h-4 text-primary" />
                  </div>
                  <p className="font-semibold text-sm" data-testid="text-admin-dm-partner">
                    {dmPartner?.partnerName || staffUsers.find(u => u.id === dmPartnerId)?.fullName || "..."}
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: "calc(100vh - 440px)" }}>
                  {dmMessages.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-8">No hay mensajes aún</p>
                  )}
                  {dmMessages.map(msg => {
                    const isMe = msg.senderId === user?.id;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} group`} data-testid={`admin-dm-msg-${msg.id}`}>
                        <div className={`max-w-[75%] rounded-xl px-3 py-2 relative ${isMe ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          <button
                            onClick={() => deleteDmMutation.mutate(msg.id)}
                            className={`absolute -top-2 ${isMe ? "-left-2" : "-right-2"} w-5 h-5 rounded-full bg-destructive text-destructive-foreground items-center justify-center text-[10px] hidden group-hover:flex`}
                            title="Eliminar mensaje"
                            data-testid={`button-admin-delete-dm-${msg.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                          {msg.message && <p className="text-sm whitespace-pre-wrap">{msg.message}</p>}
                          {msg.fileUrl && (
                            <a
                              href={`/api/download/${msg.fileUrl.split("/").pop()}`}
                              target="_blank"
                              rel="noreferrer"
                              className={`flex items-center gap-1 text-xs mt-1 ${isMe ? "text-primary-foreground/80" : "text-primary hover:underline"}`}
                              data-testid={`link-admin-dm-download-${msg.id}`}
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

                <form onSubmit={handleSendDm} className="p-3 border-t flex items-end gap-2">
                  <div className="flex-1 space-y-2">
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
                      data-testid="input-admin-dm-message"
                    />
                  </div>
                  <input
                    type="file"
                    ref={dmFileInputRef}
                    className="hidden"
                    onChange={e => setDmFile(e.target.files?.[0] || null)}
                  />
                  <Button type="button" size="icon" variant="ghost" onClick={() => dmFileInputRef.current?.click()}>
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <EmojiPicker onSelect={(emoji) => setDmMessage(prev => prev + emoji)} />
                  <Button type="submit" size="icon" disabled={sendDmMutation.isPending} data-testid="button-admin-dm-send">
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
