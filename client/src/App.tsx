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
import GuardView from "@/pages/guard-view";
import GuardsPage from "@/pages/guards";
import TutorView from "@/pages/tutor-view";
import LateArrivalsPage from "@/pages/late-arrivals";
import LateArrivalsHistoryPage from "@/pages/late-arrivals-history";
import SettingsPage from "@/pages/settings";
import CarnetPublicPage from "@/pages/carnet-public";
import { Footer } from "@/components/footer";

function AdminRouter() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/students" component={StudentsPage} />
      <Route path="/groups" component={GroupsPage} />
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/scan" component={ScannerPage} />
      <Route path="/guards" component={GuardsPage} />
      <Route path="/late-arrivals" component={LateArrivalsPage} />
      <Route path="/late-arrivals-history" component={LateArrivalsHistoryPage} />
      <Route path="/history" component={HistoryPage} />
      <Route path="/print" component={PrintPage} />
      <Route path="/settings" component={SettingsPage} />
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
    setLocation("/");
    return null;
  }

  if (user.role === "guard") {
    return <GuardView />;
  }

  if (user.role === "tutor") {
    if (location === "/guard") {
      return <GuardView tutorMode />;
    }
    return <TutorView />;
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
