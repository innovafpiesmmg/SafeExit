import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, GraduationCap, Clock, LogOut, ArrowLeft, Wifi, WifiOff, FileText, Shield,
} from "lucide-react";
import GuardView from "./guard-view";
import TutorView from "./tutor-view";
import LateArrivalsPage from "./late-arrivals";
import TutorRecords from "./tutor-records";
import GuardDutySignIn from "./guard-duty-signin";
import { PwaInstallBanner } from "@/components/pwa-install-banner";

type TabId = "group" | "guard" | "late" | "records" | "duty";

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

export default function StaffView({ showGroupTab, showBackToAdmin }: StaffViewProps) {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const online = useOnlineStatus();

  const defaultTab: TabId = showGroupTab ? "group" : "guard";
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);
  const [guardFullscreen, setGuardFullscreen] = useState(false);

  const tabs: { id: TabId; label: string; icon: typeof ShieldCheck }[] = [];
  if (showGroupTab) {
    tabs.push({ id: "group", label: "Mi Grupo", icon: GraduationCap });
  }
  tabs.push({ id: "guard", label: "Guardia", icon: ShieldCheck });
  tabs.push({ id: "late", label: "Tardías", icon: Clock });
  tabs.push({ id: "duty", label: "Fichar", icon: Shield });
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
    </div>
  );
}
