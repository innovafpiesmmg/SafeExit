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
import { MessageSquare, Send, Paperclip, FileIcon, X, ArrowUpDown } from "lucide-react";
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

export default function ChatAdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (selectedGroupId) {
      fetch(`/api/chat/${selectedGroupId}/read`, { method: "POST", credentials: "include" });
    }
  }, [selectedGroupId, messages.length]);

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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-chat-title">
          <MessageSquare className="w-6 h-6" />
          Mensajería de Grupos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Chat con el equipo educativo de cada grupo</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: "calc(100vh - 220px)" }}>
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

              <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: "calc(100vh - 380px)" }}>
                {messages.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">No hay mensajes aún</p>
                )}
                {messages.map(msg => {
                  const isMe = msg.senderId === user?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`} data-testid={`chat-msg-${msg.id}`}>
                      <div className={`max-w-[75%] rounded-xl px-3 py-2 ${isMe ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {!isMe && (
                          <p className="text-xs font-semibold mb-1 opacity-80">
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
                            className={`flex items-center gap-1 text-xs mt-1 ${isMe ? "text-primary-foreground/80 hover:text-primary-foreground" : "text-primary hover:underline"}`}
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
    </div>
  );
}
