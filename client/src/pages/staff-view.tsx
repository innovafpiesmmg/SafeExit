import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ShieldCheck, GraduationCap, Clock, LogOut, ArrowLeft, Wifi, WifiOff, FileText, Shield, UserX, Settings, Eye, EyeOff,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import GuardView from "./guard-view";
import TutorView from "./tutor-view";
import LateArrivalsPage from "./late-arrivals";
import TutorRecords from "./tutor-records";
import GuardDutySignIn from "./guard-duty-signin";
import TeacherAbsencesPage from "./teacher-absences";
import { PwaInstallBanner } from "@/components/pwa-install-banner";

type TabId = "group" | "guard" | "late" | "records" | "duty" | "absences";

interface StaffViewProps {
  showGroupTab: boolean;
  showBackToAdmin?: boolean;
}

function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const h1 = () => setOnline(true);
    const h2 = () => setOnline(false);
    window.addEventListener("online", h1);
    window.addEventListener("offline", h2);
    return () => {
      window.removeEventListener("online", h1);
      window.removeEventListener("offline", h2);
    };
  }, []);
  return online;
}

function AccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [email, setEmail] = useState(user?.email || "");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setEmail(user?.email || "");
    }
  }, [open, user?.email]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "La nueva contraseña debe tener al menos 6 caracteres", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Las contraseñas no coinciden", variant: "destructive" });
      return;
    }
    setPasswordLoading(true);
    try {
      await apiRequest("PUT", "/api/auth/password", { currentPassword, newPassword });
      toast({ title: "Contraseña actualizada correctamente" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "No se pudo cambiar la contraseña", variant: "destructive" });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailLoading(true);
    try {
      await apiRequest("PUT", "/api/auth/email", { email });
      await refreshUser();
      toast({ title: "Correo electrónico actualizado" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "No se pudo actualizar el correo", variant: "destructive" });
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Mi cuenta
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <form onSubmit={handleUpdateEmail} className="space-y-3">
            <h3 className="text-sm font-semibold">Correo electrónico</h3>
            <p className="text-xs text-muted-foreground">
              Necesario para recuperar tu contraseña si la olvidas
            </p>
            <div className="space-y-2">
              <Label htmlFor="accountEmail">Email</Label>
              <Input
                id="accountEmail"
                type="email"
                data-testid="input-account-email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button type="submit" size="sm" disabled={emailLoading} data-testid="button-save-email">
              {emailLoading ? "Guardando..." : "Guardar correo"}
            </Button>
          </form>

          <div className="border-t" />

          <form onSubmit={handleChangePassword} className="space-y-3">
            <h3 className="text-sm font-semibold">Cambiar contraseña</h3>
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Contraseña actual</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  data-testid="input-current-password"
                  type={showPasswords ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPasswords(!showPasswords)}
                  data-testid="button-toggle-passwords"
                >
                  {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPasswordAccount">Nueva contraseña</Label>
              <Input
                id="newPasswordAccount"
                data-testid="input-new-password-account"
                type={showPasswords ? "text" : "password"}
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPasswordAccount">Confirmar nueva contraseña</Label>
              <Input
                id="confirmPasswordAccount"
                data-testid="input-confirm-password-account"
                type={showPasswords ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" size="sm" disabled={passwordLoading} data-testid="button-change-password">
              {passwordLoading ? "Cambiando..." : "Cambiar contraseña"}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function StaffView({ showGroupTab, showBackToAdmin }: StaffViewProps) {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const online = useOnlineStatus();
  const [accountOpen, setAccountOpen] = useState(false);

  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
  });
  const guardTabVisible = settings ? settings.staffGuardTabVisible !== "false" : false;

  const defaultTab: TabId = showGroupTab ? "group" : (guardTabVisible ? "guard" : "duty");
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);
  const [guardFullscreen, setGuardFullscreen] = useState(false);

  useEffect(() => {
    if (!guardTabVisible && activeTab === "guard") {
      setActiveTab(showGroupTab ? "group" : "duty");
    }
    if (guardTabVisible && !showGroupTab && activeTab === "duty" && settings) {
      setActiveTab("guard");
    }
  }, [guardTabVisible, activeTab, showGroupTab, settings]);

  const tabs: { id: TabId; label: string; icon: typeof ShieldCheck }[] = [];
  if (showGroupTab) {
    tabs.push({ id: "group", label: "Mi Grupo", icon: GraduationCap });
  }
  if (guardTabVisible) {
    tabs.push({ id: "guard", label: "Guardia", icon: ShieldCheck });
  }
  tabs.push({ id: "late", label: "Tardías", icon: Clock });
  tabs.push({ id: "duty", label: "Fichar", icon: Shield });
  tabs.push({ id: "absences", label: "Ausencias", icon: UserX });
  if (showGroupTab) {
    tabs.push({ id: "records", label: "Registros", icon: FileText });
  }

  const handleBackToAdmin = () => {
    sessionStorage.removeItem("safeexit_view_mode");
    setLocation("/");
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {!guardFullscreen && (
        <header className="flex items-center justify-between px-4 py-3 border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight" data-testid="text-staff-app-name">SafeExit</p>
              <p className="text-xs text-muted-foreground">{user?.fullName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {online
              ? <Wifi className="w-4 h-4 text-emerald-500" />
              : <WifiOff className="w-4 h-4 text-red-500" />
            }
            {showBackToAdmin && (
              <Button
                size="icon"
                variant="ghost"
                onClick={handleBackToAdmin}
                data-testid="button-back-admin"
                className="min-h-[44px] min-w-[44px]"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setAccountOpen(true)}
              data-testid="button-account-settings"
              className="min-h-[44px] min-w-[44px]"
            >
              <Settings className="w-5 h-5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={logout}
              data-testid="button-staff-logout"
              className="min-h-[44px] min-w-[44px]"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </header>
      )}

      <PwaInstallBanner />

      <div className={`flex-1 overflow-auto ${guardFullscreen ? "" : "pb-16"}`}>
        {activeTab === "group" && showGroupTab && <TutorView embedded />}
        {activeTab === "guard" && (
          <GuardView embedded onFullscreenChange={setGuardFullscreen} />
        )}
        {activeTab === "late" && <LateArrivalsPage embedded />}
        {activeTab === "duty" && <GuardDutySignIn />}
        {activeTab === "absences" && <TeacherAbsencesPage />}
        {activeTab === "records" && <TutorRecords embedded />}
      </div>

      {!guardFullscreen && (
        <nav
          className="fixed bottom-0 left-0 right-0 bg-card border-t z-50"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          data-testid="nav-bottom-tabs"
        >
          <div className="flex">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 transition-colors ${
                    active
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`tab-${tab.id}`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[11px] font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
      <AccountDialog open={accountOpen} onOpenChange={setAccountOpen} />
    </div>
  );
}
