import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LogIn, Eye, EyeOff, Tablet, GraduationCap, Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Footer } from "@/components/footer";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import logoPath from "@assets/escudo_1772663810749.png";

export default function LoginPage() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const searchParams = new URLSearchParams(window.location.search);
  const mode = searchParams.get("mode");

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      await apiRequest("POST", "/api/auth/forgot-password", { email: forgotEmail });
      setForgotSent(true);
    } catch {
      toast({ title: "Error", description: "No se pudo enviar el correo de recuperación", variant: "destructive" });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      if (mode === "guard") {
        sessionStorage.setItem("safeexit_view_mode", "guard");
        setLocation("/guard");
      } else if (mode === "tutor") {
        sessionStorage.setItem("safeexit_view_mode", "tutor");
        setLocation("/");
      }
    } catch {
      toast({ title: "Error", description: "Credenciales inválidas", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div className="mx-auto w-20 h-20 rounded-2xl overflow-hidden shadow-lg">
            <img src={logoPath} alt="SafeExit" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">SafeExit</h1>
          <p className="text-muted-foreground text-sm">
            Sistema de Control de Salida Escolar
          </p>
        </div>

        {mode && (
          <div className={`flex items-center justify-center gap-2 p-3 rounded-lg text-sm font-medium ${
            mode === "guard"
              ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
          }`} data-testid="badge-login-mode">
            {mode === "guard" ? <Tablet className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />}
            {mode === "guard" ? "Acceso Profesor de Guardia" : "Acceso Tutor"}
          </div>
        )}

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-center">Iniciar Sesión</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Usuario</Label>
                <Input
                  id="username"
                  data-testid="input-username"
                  placeholder="Nombre de usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    data-testid="input-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    data-testid="button-toggle-password"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                data-testid="button-login"
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Entrando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <LogIn className="w-4 h-4" />
                    Entrar
                  </span>
                )}
              </Button>
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => { setShowForgotPassword(true); setForgotSent(false); setForgotEmail(""); }}
                  className="text-sm text-primary hover:underline"
                  data-testid="link-forgot-password"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            </form>
          </CardContent>
        </Card>

        {showForgotPassword && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Recuperar contraseña
              </CardTitle>
            </CardHeader>
            <CardContent>
              {forgotSent ? (
                <div className="text-center space-y-3">
                  <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
                  <p className="text-sm text-muted-foreground" data-testid="text-forgot-sent">
                    Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña.
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => setShowForgotPassword(false)} data-testid="button-close-forgot">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Volver
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Introduce tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="forgotEmail">Correo electrónico</Label>
                    <Input
                      id="forgotEmail"
                      type="email"
                      data-testid="input-forgot-email"
                      placeholder="tu@correo.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={forgotLoading} data-testid="button-send-reset">
                      {forgotLoading ? "Enviando..." : "Enviar enlace"}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowForgotPassword(false)} data-testid="button-cancel-forgot">
                      Cancelar
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        )}
        <Footer />
      </div>
    </div>
  );
}
