import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import LandingPage from "@/pages/landing";
import DashboardPage from "@/pages/dashboard";
import StudentsPage from "@/pages/students";
import GroupsPage from "@/pages/groups";
import CalendarPage from "@/pages/calendar";
import ScannerPage from "@/pages/scanner";
import HistoryPage from "@/pages/history";
import PrintPage from "@/pages/print";
import GuardsPage from "@/pages/guards";
import StaffView from "@/pages/staff-view";
import LateArrivalsPage from "@/pages/late-arrivals";
import LateArrivalsHistoryPage from "@/pages/late-arrivals-history";
import SettingsPage from "@/pages/settings";
import ArchivesPage from "@/pages/archives";
import GuardDutyAdminPage from "@/pages/guard-duty-admin";
import GuardDutyRegistryPage from "@/pages/guard-duty-registry";
import AbsenceManagementPage from "@/pages/absence-management";
import TeacherSchedulesPage from "@/pages/teacher-schedules";
import CarnetPublicPage from "@/pages/carnet-public";
import NotificationsAdminPage from "@/pages/notifications-admin";
import ChatAdminPage from "@/pages/chat-admin";
import ResetPasswordPage from "@/pages/reset-password";
import { Footer } from "@/components/footer";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

function PermissionGate({ permission, children }: { permission: string | null; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === "admin") return <>{children}</>;
  if (permission === null) return <>{children}</>;
  if (user.permissions?.includes(permission)) return <>{children}</>;
  return (
    <Card className="max-w-md mx-auto mt-12">
      <CardContent className="flex flex-col items-center gap-3 py-8">
        <ShieldAlert className="w-12 h-12 text-muted-foreground" />
        <p className="text-lg font-medium" data-testid="text-no-permission">Sin acceso</p>
        <p className="text-sm text-muted-foreground text-center">No tienes permisos para acceder a esta sección.</p>
      </CardContent>
    </Card>
  );
}

function AdminRouter() {
  return (
    <Switch>
      <Route path="/">{() => <PermissionGate permission={null}><DashboardPage /></PermissionGate>}</Route>
      <Route path="/students">{() => <PermissionGate permission="students"><StudentsPage /></PermissionGate>}</Route>
      <Route path="/groups">{() => <PermissionGate permission="groups"><GroupsPage /></PermissionGate>}</Route>
      <Route path="/calendar">{() => <PermissionGate permission="calendar"><CalendarPage /></PermissionGate>}</Route>
      <Route path="/scan">{() => <PermissionGate permission="scan"><ScannerPage /></PermissionGate>}</Route>
      <Route path="/guards">{() => <PermissionGate permission="teachers"><GuardsPage /></PermissionGate>}</Route>
      <Route path="/late-arrivals">{() => <PermissionGate permission="late_arrivals"><LateArrivalsPage /></PermissionGate>}</Route>
      <Route path="/late-arrivals-history">{() => <PermissionGate permission="late_history"><LateArrivalsHistoryPage /></PermissionGate>}</Route>
      <Route path="/history">{() => <PermissionGate permission="history"><HistoryPage /></PermissionGate>}</Route>
      <Route path="/print">{() => <PermissionGate permission="print"><PrintPage /></PermissionGate>}</Route>
      <Route path="/settings">{() => <PermissionGate permission="settings"><SettingsPage /></PermissionGate>}</Route>
      <Route path="/guard-duty">{() => <PermissionGate permission="guard_duty"><GuardDutyAdminPage /></PermissionGate>}</Route>
      <Route path="/guard-duty-registry">{() => <PermissionGate permission="guard_registry"><GuardDutyRegistryPage /></PermissionGate>}</Route>
      <Route path="/absence-management">{() => <PermissionGate permission="absences"><AbsenceManagementPage /></PermissionGate>}</Route>
      <Route path="/teacher-schedules">{() => <PermissionGate permission="schedules"><TeacherSchedulesPage /></PermissionGate>}</Route>
      <Route path="/notifications">{() => <PermissionGate permission="notifications"><NotificationsAdminPage /></PermissionGate>}</Route>
      <Route path="/chat">{() => <PermissionGate permission="chat"><ChatAdminPage /></PermissionGate>}</Route>
      <Route path="/archives">{() => <PermissionGate permission="archives"><ArchivesPage /></PermissionGate>}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppLayout() {
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();

  if (location.startsWith("/carnet/")) {
    return <CarnetPublicPage />;
  }

  if (location.startsWith("/reset-password")) {
    return <ResetPasswordPage />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (location === "/login") return <LoginPage />;
    return <LandingPage />;
  }

  if (location === "/login") {
    const searchParams = new URLSearchParams(window.location.search);
    const mode = searchParams.get("mode");
    if (mode === "guard") {
      sessionStorage.setItem("safeexit_view_mode", "guard");
      setLocation("/guard");
    } else if (mode === "tutor") {
      sessionStorage.setItem("safeexit_view_mode", "tutor");
      setLocation("/tutor");
    } else {
      setLocation("/");
    }
    return null;
  }

  const viewMode = sessionStorage.getItem("safeexit_view_mode");
  const hasAdminPermissions = user.permissions && user.permissions.length > 0;

  if (user.role === "guard" && !hasAdminPermissions) {
    return <StaffView showGroupTab={false} />;
  }

  if (user.role === "tutor" && !hasAdminPermissions) {
    return <StaffView showGroupTab={true} />;
  }

  if (viewMode === "guard") {
    return <StaffView showGroupTab={false} showBackToAdmin />;
  }

  if (viewMode === "tutor") {
    return <StaffView showGroupTab={true} showBackToAdmin />;
  }

  if (viewMode === "staff" && hasAdminPermissions && user.role !== "admin") {
    return <StaffView showGroupTab={user.role === "tutor"} showBackToAdmin />;
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center gap-2 p-3 border-b h-14 flex-shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <AdminRouter />
          </main>
          <Footer />
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppLayout />
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
