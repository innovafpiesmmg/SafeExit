import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, GraduationCap } from "lucide-react";
import { differenceInYears } from "date-fns";
import QRCode from "qrcode";

interface CarnetData {
  firstName: string;
  lastName: string;
  course: string;
  groupName: string;
  photoUrl: string | null;
  qrCode: string;
  dateOfBirth: string;
}

export default function CarnetPublicPage() {
  const [, params] = useRoute("/carnet/:token");
  const token = params?.token;
  const [data, setData] = useState<CarnetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

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
            <div className="flex items-center justify-center gap-2 mb-1">
              <Shield className="w-5 h-5" />
              <span className="font-bold text-lg tracking-wide">SafeExit</span>
            </div>
            <p className="text-xs opacity-80">Carnet Digital de Alumno</p>
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

            <div className="flex justify-center">
              {qrDataUrl && (
                <div className="bg-white p-3 rounded-xl shadow-inner border" data-testid="img-carnet-qr">
                  <img src={qrDataUrl} alt="Código QR" className="w-56 h-56" />
                </div>
              )}
            </div>

            <p className="text-[10px] text-center text-muted-foreground leading-relaxed">
              Presenta este código QR al profesor de guardia para verificar tu salida del centro.
            </p>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground mt-4 text-center">
        Guarda este enlace en favoritos o añádelo a tu pantalla de inicio
      </p>
    </div>
  );
}
