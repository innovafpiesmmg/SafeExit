import nodemailer from "nodemailer";
import { storage } from "./storage";
import type { Student } from "@shared/schema";

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const settings = await storage.getAllSettings();
  const host = settings.smtpHost;
  const port = settings.smtpPort;
  const user = settings.smtpUser;
  const pass = settings.smtpPass;
  const from = settings.smtpFrom;

  if (!host || !port || !user || !pass || !from) return null;

  return {
    host,
    port: parseInt(port),
    secure: settings.smtpSecure === "true",
    user,
    pass,
    from,
  };
}

function createTransport(config: SmtpConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}

export async function testSmtpConnection(): Promise<{ success: boolean; message: string }> {
  const config = await getSmtpConfig();
  if (!config) return { success: false, message: "Configuración SMTP incompleta" };

  try {
    const transporter = createTransport(config);
    await transporter.verify();
    return { success: true, message: "Conexión SMTP verificada correctamente" };
  } catch (error: any) {
    return { success: false, message: `Error de conexión: ${error.message}` };
  }
}

export async function sendEarlyExitEmail(student: Student, reason: string, timestamp: Date): Promise<boolean> {
  if (!student.email) return false;

  const config = await getSmtpConfig();
  if (!config) return false;

  try {
    const transporter = createTransport(config);

    const schoolName = (await storage.getSetting("schoolName")) || "Centro Educativo";
    const dateStr = timestamp.toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const timeStr = timestamp.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });

    await transporter.sendMail({
      from: config.from,
      to: student.email,
      subject: `Salida autorizada - ${student.firstName} ${student.lastName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #059669; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h2 style="margin: 0;">Notificación de Salida Autorizada</h2>
            <p style="margin: 5px 0 0; opacity: 0.9;">${schoolName}</p>
          </div>
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
            <p>Estimada familia,</p>
            <p>Les informamos que el/la alumno/a ha salido del centro de forma autorizada:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold; width: 40%;">Alumno/a:</td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${student.firstName} ${student.lastName}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Curso:</td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${student.course}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Motivo:</td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${reason}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Fecha:</td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${dateStr}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Hora de salida:</td>
                <td style="padding: 8px;">${timeStr}</td>
              </tr>
            </table>
            <p style="color: #6b7280; font-size: 13px;">Este es un mensaje automático del sistema SafeExit. Por favor, no responda a este correo.</p>
          </div>
        </div>
      `,
    });

    return true;
  } catch (error: any) {
    console.error("Error sending early exit email:", error.message);
    return false;
  }
}

export async function sendLateArrivalEmail(student: Student, timestamp: Date): Promise<boolean> {
  if (!student.email) return false;

  const config = await getSmtpConfig();
  if (!config) return false;

  try {
    const transporter = createTransport(config);

    const schoolName = (await storage.getSetting("schoolName")) || "Centro Educativo";
    const dateStr = timestamp.toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const timeStr = timestamp.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });

    await transporter.sendMail({
      from: config.from,
      to: student.email,
      subject: `Entrada tardía - ${student.firstName} ${student.lastName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #1e40af; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h2 style="margin: 0;">Notificación de Entrada Tardía</h2>
            <p style="margin: 5px 0 0; opacity: 0.9;">${schoolName}</p>
          </div>
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
            <p>Estimada familia,</p>
            <p>Les informamos que el/la alumno/a ha llegado tarde al centro:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold; width: 40%;">Alumno/a:</td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${student.firstName} ${student.lastName}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Curso:</td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${student.course}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Fecha:</td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${dateStr}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Hora de llegada:</td>
                <td style="padding: 8px;">${timeStr}</td>
              </tr>
            </table>
            <p style="color: #6b7280; font-size: 13px;">Este es un mensaje automático del sistema SafeExit. Por favor, no responda a este correo.</p>
          </div>
        </div>
      `,
    });

    return true;
  } catch (error: any) {
    console.error("Error sending late arrival email:", error.message);
    return false;
  }
}
