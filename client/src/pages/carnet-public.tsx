import { useState, useEffect, useCallback } from "react";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Shield, GraduationCap, Download, Bookmark, Bus, CheckCircle2, XCircle } from "lucide-react";
import { differenceInYears } from "date-fns";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";

interface CarnetData {
  firstName: string;
  lastName: string;
  course: string;
  groupName: string;
  photoUrl: string | null;
  qrCode: string;
  dateOfBirth: string;
  schoolName: string;
  academicYear: string;
  parentalAuthorization: boolean;
  busAuthorization: boolean;
  busExitMinutes: number | null;
  busExitTime: string | null;
}

function useDisablePwa() {
  useEffect(() => {
    const manifest = document.querySelector('link[rel="manifest"]');
    const appleMeta = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
    if (manifest) manifest.remove();
    if (appleMeta) appleMeta.remove();

    const beforeInstall = (e: Event) => e.preventDefault();
    window.addEventListener("beforeinstallprompt", beforeInstall);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(r => r.unregister());
      });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
    };
  }, []);
}

export default function CarnetPublicPage() {
  useDisablePwa();
  useWakeLock();
  const [, params] = useRoute("/carnet/:token");
  const token = params?.token;
  const [data, setData] = useState<CarnetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [barcodeDataUrl, setBarcodeDataUrl] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setError("Enlace no válido");
      setLoading(false);
      return;
    }
    fetch(`/api/carnet/${token}`)
      .then(r => {
        if (!r.ok) throw new Error("Carnet no encontrado");
        return r.json();
      })
      .then((d: CarnetData) => {
        setData(d);
        const canvas = document.createElement("canvas");
        try {
          JsBarcode(canvas, d.qrCode, {
            format: "CODE128",
            width: 2,
            height: 40,
            displayValue: false,
            margin: 4,
          });
          setBarcodeDataUrl(canvas.toDataURL("image/png"));
        } catch { }
        return QRCode.toDataURL(d.qrCode, { width: 300, margin: 2 });
      })
      .then(url => setQrDataUrl(url))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary/5 to-background p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-24 w-24 rounded-full mx-auto" />
            <Skeleton className="h-6 w-3/4 mx-auto" />
            <Skeleton className="h-4 w-1/2 mx-auto" />
            <Skeleton className="h-64 w-64 mx-auto" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-destructive/5 to-background p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="p-8 text-center space-y-4">
            <Shield className="w-16 h-16 mx-auto text-destructive/50" />
            <h1 className="text-xl font-bold" data-testid="text-carnet-error">Carnet no encontrado</h1>
            <p className="text-sm text-muted-foreground">
              Este enlace no es válido o el carnet ha sido eliminado.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const age = differenceInYears(new Date(), new Date(data.dateOfBirth));
  const isAdult = age >= 18;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-primary/5 to-background p-4">
      <Card className="w-full max-w-sm shadow-xl border-2" data-testid="card-carnet-digital">
        <CardContent className="p-0">
          <div className="bg-primary text-primary-foreground p-4 text-center rounded-t-lg">
            {data.schoolName && (
              <p className="text-sm font-semibold mb-1 opacity-95" data-testid="text-carnet-school">{data.schoolName}</p>
            )}
            <div className="flex items-center justify-center gap-2 mb-1">
              <img src="/logo-white.png" alt="SafeExit" className="w-6 h-6" />
              <span className="font-bold text-lg tracking-wide">SafeExit</span>
            </div>
            <p className="text-xs opacity-80">
              Carnet Digital de Alumno{data.academicYear ? ` — Curso ${data.academicYear}` : ""}
            </p>
          </div>

          <div className="p-6 space-y-5">
            <div className="flex flex-col items-center">
              <Avatar className="w-24 h-24 border-4 border-primary/20 shadow-lg">
                <AvatarImage src={data.photoUrl || undefined} />
                <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                  {data.firstName[0]}{data.lastName[0]}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="text-center space-y-2">
              <h1 className="text-xl font-bold tracking-tight" data-testid="text-carnet-name">
                {data.firstName} {data.lastName}
              </h1>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  <GraduationCap className="w-3 h-3 mr-1" />
                  {data.groupName}
                </Badge>
                <span className="text-sm text-muted-foreground">{data.course}</span>
                {isAdult && <Badge className="text-xs">+18</Badge>}
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 space-y-2" data-testid="section-carnet-authorizations">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Autorizaciones</p>
              <div className="flex items-center gap-2">
                {data.parentalAuthorization ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                )}
                <span className="text-sm" data-testid="text-carnet-parental-auth">
                  Salida autónoma: {data.parentalAuthorization ? "Autorizada" : "No autorizada"}
                </span>
              </div>
              {data.busAuthorization && (
                <div className="flex items-center gap-2">
                  <Bus className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span className="text-sm" data-testid="text-carnet-bus-auth">
                    Guagua: Salida a las {data.busExitTime || "—"}
                    <span className="text-muted-foreground"> ({data.busExitMinutes || 5} min antes)</span>
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-center">
              {qrDataUrl && (
                <div className="bg-white p-3 rounded-xl shadow-inner border" data-testid="img-carnet-qr">
                  <img src={qrDataUrl} alt="Código QR" className="w-36 h-36" />
                </div>
              )}
            </div>

            {barcodeDataUrl && (
              <div className="flex justify-center">
                <div className="bg-white px-3 py-1.5 rounded-lg shadow-inner border" data-testid="img-carnet-barcode">
                  <img src={barcodeDataUrl} alt="Código de barras" className="h-10 w-auto" />
                </div>
              </div>
            )}

            <p className="text-[10px] text-center text-muted-foreground leading-relaxed">
              Presenta este código QR o de barras al profesor de guardia para verificar tu salida del centro.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 text-center space-y-2">
        <p className="text-xs text-muted-foreground">
          Guarda este enlace en favoritos para acceder rápidamente a tu carnet
        </p>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => {
            const canvas = document.createElement("canvas");
            const img = document.querySelector('[data-testid="img-carnet-qr"] img') as HTMLImageElement;
            if (!img) return;
            canvas.width = img.naturalWidth || 300;
            canvas.height = img.naturalHeight || 300;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            ctx.drawImage(img, 0, 0);
            const link = document.createElement("a");
            link.download = `carnet-${data.firstName}-${data.lastName}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
          }}
          data-testid="button-download-qr"
        >
          <Download className="w-3 h-3 mr-1" />
          Descargar código QR
        </Button>
      </div>
    </div>
  );
}
