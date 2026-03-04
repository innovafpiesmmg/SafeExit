import { useAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard, Users, GraduationCap, CalendarDays, QrCode,
  History, Printer, LogOut, ShieldCheck,
} from "lucide-react";

const adminItems = [
  { title: "Panel de Control", url: "/", icon: LayoutDashboard },
  { title: "Alumnos", url: "/students", icon: Users },
  { title: "Grupos", url: "/groups", icon: GraduationCap },
  { title: "Calendario", url: "/calendar", icon: CalendarDays },
  { title: "Historial", url: "/history", icon: History },
  { title: "Imprimir Carnets", url: "/print", icon: Printer },
];

const guardItems = [
  { title: "Verificación", url: "/scan", icon: QrCode },
];

export function AppSidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const items = user?.role === "admin" ? [...adminItems, ...guardItems] : guardItems;

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-primary-foreground" />
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
          <Button size="icon" variant="ghost" onClick={logout} data-testid="button-logout">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
