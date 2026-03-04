import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Footer } from "@/components/footer";
import { QrCode, Users, CalendarDays, ClipboardList, Smartphone, ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import logoPath from "@assets/escudo_1772663810749.png";
import heroImg from "@assets/stock_images/school_hero.jpg";
import securityImg from "@assets/stock_images/school_security.jpg";
import qrImg from "@assets/stock_images/qr_tablet.jpg";
import parentsImg from "@assets/stock_images/parents_school.jpg";

export default function LandingPage() {
  const [, navigate] = useLocation();

  const features = [
    {
      icon: QrCode,
      title: "Verificación por QR",
      description: "Escaneo rápido de carnets con cámara o pistola de códigos de barras para control instantáneo.",
    },
    {
      icon: Users,
      title: "Gestión de Alumnos",
      description: "Alta masiva por Excel, fotos, autorizaciones parentales y de guagua en un solo lugar.",
    },
    {
      icon: CalendarDays,
      title: "Calendario de Salidas",
      description: "Configura los tramos horarios permitidos para cada grupo con un calendario visual.",
    },
    {
      icon: ClipboardList,
      title: "Historial y Auditoría",
      description: "Registro completo de cada salida con exportación a CSV e informes de incidencias.",
    },
    {
      icon: Smartphone,
      title: "App para Tablet",
      description: "Vista optimizada para profesores de guardia: pantalla completa, audio y auto-retorno.",
    },
    {
      icon: ShieldCheck,
      title: "Seguridad Inteligente",
      description: "Verificación automática por edad, autorización y horario. Sin margen de error.",
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden">
              <img src={logoPath} alt="SafeExit" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-lg">SafeExit</span>
          </div>
          <Button onClick={() => navigate("/login")} data-testid="button-goto-login">
            Acceder
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImg} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-background/40" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-32">
          <div className="max-w-xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background/80 backdrop-blur px-3 py-1 text-xs text-muted-foreground">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              Control de salida escolar
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
              La seguridad de tus alumnos, <span className="text-primary">bajo control</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              SafeExit digitaliza el control de salidas de tu instituto o centro de FP con carnets QR, verificación instantánea y trazabilidad completa.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" onClick={() => navigate("/login")} data-testid="button-hero-login">
                Iniciar Sesión
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl font-bold tracking-tight">Todo lo que necesitas</h2>
            <p className="text-muted-foreground mt-3">
              Una solución completa para gestionar las salidas de tu centro de forma segura y eficiente.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => (
              <Card key={f.title} className="group hover:shadow-md transition-shadow">
                <CardContent className="p-5 space-y-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <f.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 space-y-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="rounded-xl overflow-hidden shadow-lg">
              <img src={securityImg} alt="Control de acceso en el centro" className="w-full h-64 md:h-80 object-cover" />
            </div>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight">Control total en la puerta</h2>
              <p className="text-muted-foreground leading-relaxed">
                El profesor de guardia escanea el carnet QR del alumno y en menos de un segundo obtiene la respuesta: autorizado o denegado, con señal sonora y visual a pantalla completa.
              </p>
              <ul className="space-y-2">
                {["Respuesta instantánea", "Audio de confirmación", "Pantalla completa en tablet"].map(t => (
                  <li key={t} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4 md:order-1 order-2">
              <h2 className="text-2xl font-bold tracking-tight">Tecnología QR moderna</h2>
              <p className="text-muted-foreground leading-relaxed">
                Cada alumno recibe un carnet con código QR único. Compatible con cámaras de tablet, móviles y pistolas lectoras de códigos de barras.
              </p>
              <ul className="space-y-2">
                {["Carnets imprimibles en PDF", "QR único por alumno", "Compatible con lector de códigos"].map(t => (
                  <li key={t} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl overflow-hidden shadow-lg md:order-2 order-1">
              <img src={qrImg} alt="Escaneo QR en tablet" className="w-full h-64 md:h-80 object-cover" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="rounded-xl overflow-hidden shadow-lg">
              <img src={parentsImg} alt="Alumnos de bachillerato y FP" className="w-full h-64 md:h-80 object-cover" />
            </div>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight">Trazabilidad y cumplimiento</h2>
              <p className="text-muted-foreground leading-relaxed">
                Registro completo de cada salida. El sistema verifica edad, permiso parental y horario antes de aprobar cualquier salida. Los mayores de edad salen libremente.
              </p>
              <ul className="space-y-2">
                {["Verificación de autorización parental", "Control por tramos horarios", "Registro auditable de cada salida"].map(t => (
                  <li key={t} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 bg-primary text-primary-foreground">
        <div className="max-w-3xl mx-auto px-4 text-center space-y-6">
          <h2 className="text-3xl font-bold tracking-tight">Digitaliza el control de salidas de tu centro</h2>
          <p className="text-primary-foreground/80 text-lg">
            Empieza hoy a gestionar las salidas de forma segura, rápida y sin papeleo.
          </p>
          <Button size="lg" variant="secondary" onClick={() => navigate("/login")} data-testid="button-cta-login">
            Acceder a SafeExit
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
