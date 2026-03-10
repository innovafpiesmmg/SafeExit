import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  LayoutDashboard, Users, GraduationCap, CalendarDays, QrCode,
  History, Printer, LogOut, UserCheck, Clock, Settings, ClipboardList, Archive, Shield, ClipboardCheck, UserX, CalendarClock, KeyRound, Eye, EyeOff,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import logoPath from "@assets/escudo_1772663810749.png";

const adminItems = [
  { title: "Panel de Control", url: "/", icon: LayoutDashboard },
  { title: "Alumnos", url: "/students", icon: Users },
  { title: "Grupos", url: "/groups", icon: GraduationCap },
  { title: "Profesores", url: "/guards", icon: UserCheck },
  { title: "Calendario", url: "/calendar", icon: CalendarDays },
  { title: "Entradas Tardías", url: "/late-arrivals", icon: Clock },
  { title: "Historial Salidas", url: "/history", icon: History },
  { title: "Historial Entradas", url: "/late-arrivals-history", icon: ClipboardList },
  { title: "Guardias Prof.", url: "/guard-duty", icon: Shield },
  { title: "Reg. Guardias", url: "/guard-duty-registry", icon: ClipboardCheck },
  { title: "Ausencias", url: "/absence-management", icon: UserX },
  { title: "Horarios", url: "/teacher-schedules", icon: CalendarClock },
  { title: "Imprimir Carnets", url: "/print", icon: Printer },
  { title: "Cursos Archivados", url: "/archives", icon: Archive },
  { title: "Ajustes", url: "/settings", icon: Settings },
];

const guardItems = [
  { title: "Verificación", url: "/scan", icon: QrCode },
];

function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "La nueva contraseña debe tener al menos 6 caracteres", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Las contraseñas no coinciden", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await apiRequest("PUT", "/api/auth/password", { currentPassword, newPassword });
      toast({ title: "Contraseña actualizada correctamente" });
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "No se pudo cambiar la contraseña", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            Cambiar contraseña
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="adminCurrentPw">Contraseña actual</Label>
            <div className="relative">
              <Input
                id="adminCurrentPw"
                data-testid="input-admin-current-password"
                type={showPasswords ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowPasswords(!showPasswords)}
                data-testid="button-toggle-admin-passwords"
              >
                {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="adminNewPw">Nueva contraseña</Label>
            <Input
              id="adminNewPw"
              data-testid="input-admin-new-password"
              type={showPasswords ? "text" : "password"}
              placeholder="Mínimo 6 caracteres"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adminConfirmPw">Confirmar nueva contraseña</Label>
            <Input
              id="adminConfirmPw"
              data-testid="input-admin-confirm-password"
              type={showPasswords ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading} data-testid="button-admin-change-password">
            {loading ? "Cambiando..." : "Cambiar contraseña"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AppSidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  const items = user?.role === "admin" ? [...adminItems, ...guardItems] : guardItems;

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0">
            <img src={logoPath} alt="SafeExit" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm truncate">SafeExit</p>
            <p className="text-xs text-muted-foreground truncate">Control de Salida</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild data-active={location === item.url}>
                    <Link href={item.url} data-testid={`nav-${item.url.replace("/", "") || "dashboard"}`}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8 flex-shrink-0">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {user?.fullName?.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.fullName}</p>
            <Badge variant="secondary" className="text-[10px]">
              {user?.role === "admin" ? "Administrador" : "Profesor"}
            </Badge>
          </div>
          <Button size="icon" variant="ghost" onClick={() => setPasswordDialogOpen(true)} data-testid="button-admin-account" title="Cambiar contraseña">
            <KeyRound className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={logout} data-testid="button-logout">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </SidebarFooter>
      <ChangePasswordDialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen} />
    </Sidebar>
  );
}
