import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldOff, QrCode, KeyRound, Copy, CheckCircle2, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export function TotpManagement() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();

  const [phase, setPhase] = useState<"idle" | "setup" | "disable">("idle");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleStartSetup = async () => {
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/totp/setup");
      const data = await res.json();
      setQrDataUrl(data.qrDataUrl);
      setSecret(data.secret);
      setConfirmCode("");
      setPhase("setup");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/totp/confirm", { secret, code: confirmCode });
      await refreshUser();
      toast({ title: "Verificación en dos pasos activada" });
      setPhase("idle");
      setQrDataUrl("");
      setSecret("");
      setConfirmCode("");
    } catch (e: any) {
      toast({ title: "Código incorrecto", description: "Asegúrate de que tu app está sincronizada.", variant: "destructive" });
      setConfirmCode("");
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/totp/disable", { code: disableCode });
      await refreshUser();
      toast({ title: "Verificación en dos pasos desactivada" });
      setPhase("idle");
      setDisableCode("");
    } catch (e: any) {
      toast({ title: "Código incorrecto", description: e.message, variant: "destructive" });
      setDisableCode("");
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totpEnabled = user?.totpEnabled;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Verificación en dos pasos (2FA)</h3>
        <Badge variant={totpEnabled ? "default" : "secondary"} className="text-xs">
          {totpEnabled ? (
            <><ShieldCheck className="w-3 h-3 mr-1" />Activo</>
          ) : (
            <><ShieldOff className="w-3 h-3 mr-1" />Inactivo</>
          )}
        </Badge>
      </div>

      {phase === "idle" && (
        <>
          <p className="text-xs text-muted-foreground">
            {totpEnabled
              ? "Tienes la verificación en dos pasos activada. Cada vez que inicies sesión necesitarás el código de tu app autenticadora."
              : "Añade una capa extra de seguridad usando una app como Google Authenticator, Authy o Microsoft Authenticator."}
          </p>
          {totpEnabled ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setPhase("disable"); setDisableCode(""); }}
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              data-testid="button-start-disable-totp"
            >
              <ShieldOff className="w-4 h-4 mr-2" />
              Desactivar 2FA
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartSetup}
              disabled={loading}
              data-testid="button-start-setup-totp"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
              Activar 2FA
            </Button>
          )}
        </>
      )}

      {phase === "setup" && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Escanea el código QR con tu app autenticadora. Después, introduce el código de 6 dígitos para confirmar.
          </p>

          {qrDataUrl && (
            <div className="flex justify-center">
              <div className="bg-white p-3 rounded-lg border inline-block">
                <img src={qrDataUrl} alt="QR 2FA" className="w-48 h-48" data-testid="img-totp-qr" />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">¿No puedes escanear el QR? Introduce este código manualmente:</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1.5 rounded font-mono flex-1 break-all" data-testid="text-totp-secret">
                {secret}
              </code>
              <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={copySecret} data-testid="button-copy-secret">
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>

          <form onSubmit={handleConfirm} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="confirm-totp-code">Código de verificación</Label>
              <Input
                id="confirm-totp-code"
                data-testid="input-confirm-totp-code"
                placeholder="000 000"
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                className="text-center text-xl tracking-[0.4em] font-mono"
                maxLength={6}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                size="sm"
                disabled={loading || confirmCode.length !== 6}
                data-testid="button-confirm-totp"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <KeyRound className="w-4 h-4 mr-1" />}
                Confirmar activación
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => { setPhase("idle"); setQrDataUrl(""); setSecret(""); setConfirmCode(""); }}
                data-testid="button-cancel-setup-totp"
              >
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      )}

      {phase === "disable" && (
        <form onSubmit={handleDisable} className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Introduce el código actual de tu app autenticadora para desactivar el 2FA.
          </p>
          <div className="space-y-2">
            <Label htmlFor="disable-totp-code">Código de verificación</Label>
            <Input
              id="disable-totp-code"
              data-testid="input-disable-totp-code"
              placeholder="000 000"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              className="text-center text-xl tracking-[0.4em] font-mono"
              maxLength={6}
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              variant="destructive"
              disabled={loading || disableCode.length !== 6}
              data-testid="button-confirm-disable-totp"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              Desactivar 2FA
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => { setPhase("idle"); setDisableCode(""); }}
              data-testid="button-cancel-disable-totp"
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
