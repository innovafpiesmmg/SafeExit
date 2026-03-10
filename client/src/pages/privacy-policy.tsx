import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function PrivacyPolicyPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <button
          onClick={() => setLocation("/login")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-testid="button-back-login"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al inicio de sesión
        </button>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold" data-testid="text-privacy-title">Política de Privacidad</h1>
          <p className="text-sm text-muted-foreground">Última actualización: marzo 2026</p>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-lg font-semibold">1. Responsable del Tratamiento</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              El responsable del tratamiento de los datos personales es el centro educativo que utiliza la
              aplicación SafeExit. Los datos de contacto del responsable están disponibles en la secretaría
              del centro educativo. El Delegado de Protección de Datos (DPD) del centro está a disposición
              de los interesados para cualquier consulta relacionada con el tratamiento de datos personales.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">2. Datos Personales Recogidos</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              SafeExit recoge y trata los siguientes datos personales:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li><strong>Alumnos:</strong> Nombre, apellidos, fecha de nacimiento, curso, grupo, fotografía, correo electrónico, autorizaciones de salida.</li>
              <li><strong>Personal del centro:</strong> Nombre de usuario, nombre completo, correo electrónico, fotografía, rol y permisos de acceso.</li>
              <li><strong>Personas autorizadas para recogida:</strong> Nombre, apellidos y documento de identidad (DNI/NIE).</li>
              <li><strong>Registros de actividad:</strong> Registros de entrada/salida, incidencias, tardanzas, firmas digitales.</li>
              <li><strong>Comunicaciones:</strong> Mensajes de chat grupal, mensajes directos, notificaciones.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold">3. Finalidad del Tratamiento</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Los datos personales se tratan con las siguientes finalidades:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li>Control de acceso y salida de alumnos del centro educativo.</li>
              <li>Verificación de autorizaciones de salida y recogida de menores.</li>
              <li>Registro de tardanzas y ausencias del alumnado y profesorado.</li>
              <li>Gestión de guardias y coberturas del personal docente.</li>
              <li>Comunicación interna entre los miembros del equipo educativo.</li>
              <li>Generación de carnés digitales de identificación.</li>
              <li>Cumplimiento de las obligaciones legales del centro educativo.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold">4. Base Legal del Tratamiento</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              El tratamiento de datos se fundamenta en:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li><strong>Interés legítimo</strong> (Art. 6.1.f RGPD): Garantizar la seguridad de los alumnos mediante el control de acceso.</li>
              <li><strong>Obligación legal</strong> (Art. 6.1.c RGPD): Cumplimiento de la normativa educativa sobre custodia y control de menores.</li>
              <li><strong>Interés público</strong> (Art. 6.1.e RGPD): Ejercicio de funciones de interés público en el ámbito educativo.</li>
              <li><strong>Consentimiento</strong> (Art. 6.1.a RGPD): Para el envío de notificaciones push al dispositivo del usuario.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold">5. Conservación de los Datos</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Los datos personales se conservan durante el tiempo necesario para cumplir con la finalidad para la
              que fueron recogidos. En concreto:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li>Los registros de salida, tardanzas e incidencias se conservan un máximo de <strong>3 años</strong>, tras lo cual se eliminan automáticamente.</li>
              <li>Los mensajes de chat y notificaciones se eliminan automáticamente tras <strong>3 años</strong>.</li>
              <li>Los datos de alumnos se eliminan al archivar el curso académico.</li>
              <li>Los datos del personal se mantienen mientras dure su vinculación con el centro.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold">6. Destinatarios de los Datos</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Los datos personales no se ceden a terceros, salvo obligación legal. Los datos son accesibles
              únicamente por el personal autorizado del centro educativo según su rol y permisos asignados.
              El acceso a los datos se rige por el principio de minimización: cada usuario solo accede a la
              información estrictamente necesaria para el desempeño de sus funciones.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">7. Derechos de los Interesados</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              De acuerdo con el RGPD y la LOPDGDD, los interesados tienen derecho a:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li><strong>Acceso:</strong> Conocer qué datos personales se tratan.</li>
              <li><strong>Rectificación:</strong> Solicitar la corrección de datos inexactos.</li>
              <li><strong>Supresión:</strong> Solicitar la eliminación de los datos cuando ya no sean necesarios.</li>
              <li><strong>Limitación:</strong> Solicitar la limitación del tratamiento en determinadas circunstancias.</li>
              <li><strong>Portabilidad:</strong> Recibir los datos en un formato estructurado y de uso común.</li>
              <li><strong>Oposición:</strong> Oponerse al tratamiento de los datos en determinadas circunstancias.</li>
            </ul>
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              Para ejercer estos derechos, los interesados pueden dirigirse a la secretaría del centro educativo
              o al Delegado de Protección de Datos. También tienen derecho a presentar una reclamación ante la
              Agencia Española de Protección de Datos (AEPD) en <a href="https://www.aepd.es" target="_blank" rel="noreferrer" className="text-primary hover:underline">www.aepd.es</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">8. Medidas de Seguridad</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              SafeExit implementa las siguientes medidas técnicas y organizativas para proteger los datos personales:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li>Autenticación obligatoria con sesiones seguras (cookies httpOnly).</li>
              <li>Control de acceso basado en roles con permisos granulares.</li>
              <li>Comunicaciones cifradas mediante HTTPS/TLS.</li>
              <li>Registro de auditoría de las acciones realizadas en el sistema.</li>
              <li>Borrado automático de registros antiguos según la política de retención.</li>
              <li>Principio de minimización de datos en cada vista del sistema.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold">9. Menores de Edad</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              De conformidad con el artículo 7 de la LOPDGDD, el tratamiento de datos de menores de 14 años
              requiere el consentimiento del titular de la patria potestad o tutela. En centros de bachillerato
              y formación profesional, los alumnos son generalmente mayores de 14 años. Para alumnos menores de
              14 años, el centro debe obtener el consentimiento informado de sus tutores legales.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">10. Notificaciones Push</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              SafeExit utiliza notificaciones push para informar al personal del centro sobre eventos relevantes
              (coberturas de guardia, mensajes, avisos). La activación de las notificaciones push es voluntaria
              y requiere el consentimiento explícito del usuario a través de su navegador. El usuario puede
              revocar este consentimiento en cualquier momento desde la configuración de su navegador.
            </p>
          </section>
        </div>

        <div className="pt-4 border-t text-center">
          <p className="text-xs text-muted-foreground">
            SafeExit - Sistema de Control de Salida Escolar
          </p>
        </div>
      </div>
    </div>
  );
}
