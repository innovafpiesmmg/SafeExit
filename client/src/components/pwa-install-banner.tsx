import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { Download, X, Share, ArrowUp } from "lucide-react";

export function PwaInstallBanner() {
  const { canInstall, isIos, install, dismiss } = usePwaInstall();

  if (!canInstall) return null;

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-2.5" data-testid="banner-pwa-install">
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Download className="w-4 h-4 text-primary flex-shrink-0" />
          {isIos ? (
            <p className="text-xs text-primary font-medium">
              Pulsa <Share className="w-3.5 h-3.5 inline-block mx-0.5 align-text-bottom" /> y luego <span className="font-bold">"Añadir a pantalla de inicio"</span>
            </p>
          ) : (
            <p className="text-xs text-primary font-medium truncate">Instala SafeExit para acceso rápido</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!isIos && (
            <Button size="sm" className="h-7 text-xs px-3" onClick={install} data-testid="button-pwa-install">
              Instalar
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={dismiss} data-testid="button-pwa-dismiss">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
