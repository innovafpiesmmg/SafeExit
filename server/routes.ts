import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { differenceInYears } from "date-fns";
import session from "express-session";
import memorystore from "memorystore";
import bcrypt from "bcrypt";
import { TIME_SLOTS, getDefaultTimeSlotsConfig, getTimeSlotsForDay, type TimeSlotsConfig, type TimeSlotConfig, type User, exitLogs, students, groups, users, teacherAbsencePeriods, teacherAbsences } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { sendLateArrivalEmail, sendEarlyExitEmail, testSmtpConnection, sendPasswordResetEmail } from "./email";
import multer from "multer";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";

const uploadsDir = process.env.NODE_ENV === "production"
  ? path.resolve("uploads")
  : path.resolve("client/public/uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const multerStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `photo-${Date.now()}${ext}`);
  },
});
const upload = multer({ storage: multerStorage });

const audioStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const type = (_req as any).params?.type || "sound";
    cb(null, `sound-${type}-${Date.now()}${ext}`);
  },
});
const audioUpload = multer({
  storage: audioStorage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("audio/")) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten archivos de audio") as any, false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

function normalizeUsername(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function getCurrentTimeSlotFromConfig(slotsForDay: TimeSlotConfig[]): number {
  const now = new Date();
  const totalMinutes = now.getHours() * 60 + now.getMinutes();

  for (const slot of slotsForDay) {
    const start = timeToMinutes(slot.start);
    const end = timeToMinutes(slot.end);
    if (totalMinutes >= start && totalMinutes < end) {
      return slot.id;
    }
  }
  return -1;
}

function getCurrentDayOfWeek(): number {
  const day = new Date().getDay();
  return day === 0 ? 7 : day;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const MemoryStore = memorystore(session);

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "safeexit-secret-key",
      resave: false,
      saveUninitialized: false,
      store: new MemoryStore({ checkPeriod: 86400000 }),
      cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        secure: process.env.SECURE_COOKIES === "true",
        sameSite: "lax",
      },
    })
  );

  async function requireAuth(req: Request, res: Response, next: Function) {
    if (!(req.session as any).userId) {
      return res.status(401).json({ message: "No autenticado" });
    }
    const user = await storage.getUser((req.session as any).userId);
    if (!user) {
      return res.status(401).json({ message: "Usuario no encontrado" });
    }
    (req as any).user = user;
    next();
  }

  function requireAdmin(req: Request, res: Response, next: Function) {
    const user = (req as any).user;
    if (user?.role === "admin") return next();
    return res.status(403).json({ message: "Acceso denegado" });
  }

  function requirePermission(...permissions: string[]) {
    return (req: Request, res: Response, next: Function) => {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ message: "No autenticado" });
      if (user.role === "admin") return next();
      const userPerms: string[] = user.permissions || [];
      if (permissions.some(p => userPerms.includes(p))) return next();
      return res.status(403).json({ message: "No tienes permiso para esta acción" });
    };
  }

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(401).json({ message: "Credenciales inválidas" });

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ message: "Credenciales inválidas" });

      (req.session as any).userId = user.id;
      (req.session as any).role = user.role;
      res.json({ id: user.id, username: user.username, fullName: user.fullName, role: user.role, groupId: user.groupId, permissions: user.permissions || [], guardTabVisible: user.guardTabVisible ?? null });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ message: "Sesión cerrada" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!(req.session as any).userId) {
      return res.status(401).json({ message: "No autenticado" });
    }
    const user = await storage.getUser((req.session as any).userId);
    if (!user) return res.status(401).json({ message: "No autenticado" });
    res.json({ id: user.id, username: user.username, fullName: user.fullName, role: user.role, groupId: user.groupId, email: user.email, permissions: user.permissions || [], guardTabVisible: user.guardTabVisible ?? null });
  });

  app.put("/api/auth/password", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as User;
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) return res.status(400).json({ message: "Contraseña actual y nueva requeridas" });
      if (newPassword.length < 6) return res.status(400).json({ message: "La nueva contraseña debe tener al menos 6 caracteres" });

      const fullUser = await storage.getUser(user.id);
      if (!fullUser) return res.status(404).json({ message: "Usuario no encontrado" });

      const valid = await bcrypt.compare(currentPassword, fullUser.password);
      if (!valid) return res.status(401).json({ message: "La contraseña actual es incorrecta" });

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(user.id, { password: hashedPassword });
      res.json({ message: "Contraseña actualizada correctamente" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/auth/email", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as User;
      const { email } = req.body;
      const normalizedEmail = email ? email.trim().toLowerCase() : null;
      await storage.updateUser(user.id, { email: normalizedEmail });
      res.json({ message: "Correo electrónico actualizado" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: "Correo electrónico requerido" });

      const user = await storage.getUserByEmail(email.trim().toLowerCase());
      if (!user) {
        return res.json({ message: "Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña" });
      }

      const { randomUUID } = await import("crypto");
      const token = randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await storage.createPasswordResetToken(user.id, token, expiresAt);

      const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;

      await sendPasswordResetEmail(user, token, baseUrl);

      res.json({ message: "Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) return res.status(400).json({ message: "Token y nueva contraseña requeridos" });
      if (newPassword.length < 6) return res.status(400).json({ message: "La contraseña debe tener al menos 6 caracteres" });

      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) return res.status(400).json({ message: "Enlace inválido o expirado" });
      if (resetToken.used) return res.status(400).json({ message: "Este enlace ya ha sido utilizado" });
      if (new Date() > resetToken.expiresAt) return res.status(400).json({ message: "Este enlace ha expirado" });

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(resetToken.userId, { password: hashedPassword });
      await storage.markPasswordResetTokenUsed(token);

      res.json({ message: "Contraseña restablecida correctamente" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/guards", requireAuth, requirePermission("teachers", "schedules", "absences", "guard_duty", "guard_registry"), async (_req, res) => {
    const guards = await storage.getGuards();
    res.json(guards.map(g => ({ id: g.id, username: g.username, fullName: g.fullName, role: g.role, groupId: g.groupId, photoUrl: g.photoUrl, email: g.email, permissions: g.permissions || [], guardTabVisible: g.guardTabVisible ?? null })));
  });

  app.get("/api/staff-list", requireAuth, async (_req, res) => {
    const allUsers = await storage.getAllUsers();
    const staff = allUsers.filter(u => u.role !== "admin");
    res.json(staff.map(g => ({ id: g.id, fullName: g.fullName })));
  });

  app.get("/api/guards/template", requireAuth, requireAdmin, (_req, res) => {
    const wb = XLSX.utils.book_new();
    const headers = [
      ["Nombre", "Apellidos"],
      ["María", "García Fernández"],
      ["Carlos", "López Martín"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    ws["!cols"] = [{ wch: 20 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, "Profesores");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=plantilla_profesores.xlsx");
    res.send(Buffer.from(buf));
  });

  app.post("/api/guards/import", requireAuth, requireAdmin, upload.single("file"), async (req, res) => {
    const filePath = req.file?.path;
    try {
      if (!req.file || !filePath) return res.status(400).json({ message: "No se subió archivo" });

      const guardPassword = await storage.getSetting("guardPassword");
      if (!guardPassword) return res.status(400).json({ message: "Primero define la contraseña común de los profesores de guardia en la sección de contraseña." });

      const wb = XLSX.readFile(filePath);
      const sheetName = wb.SheetNames[0];
      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);

      if (!rows.length) return res.status(400).json({ message: "El archivo está vacío" });

      const requiredCols = ["Nombre", "Apellidos"];
      const headers = Object.keys(rows[0]);
      const missing = requiredCols.filter(c => !headers.includes(c));
      if (missing.length) {
        return res.status(400).json({ message: `Columnas requeridas no encontradas: ${missing.join(", ")}. Descarga la plantilla para ver el formato correcto.` });
      }

      const hashedPassword = await bcrypt.hash(guardPassword, 10);
      const created: any[] = [];
      const errors: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;
        const firstName = String(row["Nombre"] || "").trim();
        const lastName = String(row["Apellidos"] || "").trim();

        if (!firstName || !lastName) {
          errors.push(`Fila ${rowNum}: Nombre o Apellidos vacíos`);
          continue;
        }

        const fullName = `${firstName} ${lastName}`;
        const base = normalizeUsername(`${firstName.toLowerCase()}${lastName.toLowerCase().split(" ")[0]}`);
        let username = base;
        let counter = 1;
        while (await storage.getUserByUsername(username)) {
          username = `${base}${counter}`;
          counter++;
        }

        try {
          const user = await storage.createUser({ username, password: hashedPassword, fullName, role: "guard" });
          created.push({ id: user.id, username: user.username, fullName: user.fullName });
        } catch (err: any) {
          errors.push(`Fila ${rowNum}: ${err.message}`);
        }
      }

      res.json({
        message: `${created.length} profesor(es) importado(s) correctamente`,
        imported: created.length,
        errors,
      });
    } catch (error: any) {
      res.status(500).json({ message: `Error procesando archivo: ${error.message}` });
    } finally {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  });

  app.put("/api/guards/password", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { password } = req.body;
      if (!password || password.length < 4) return res.status(400).json({ message: "La contraseña debe tener al menos 4 caracteres" });
      await storage.setSetting("guardPassword", password);
      const hashedPassword = await bcrypt.hash(password, 10);
      await storage.updateAllGuardPasswords(hashedPassword);
      res.json({ message: "Contraseña actualizada para todos los profesores de guardia" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/guards", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { firstName, lastName, role, groupId } = req.body;
      if (!firstName || !lastName) return res.status(400).json({ message: "Nombre y apellidos requeridos" });

      const guardPassword = await storage.getSetting("guardPassword");
      if (!guardPassword) return res.status(400).json({ message: "Primero define la contraseña común de los profesores de guardia" });

      const userRole = role === "tutor" ? "tutor" : "guard";
      let assignedGroupId: number | null = null;
      if (userRole === "tutor" && groupId) {
        const group = await storage.getGroup(parseInt(groupId));
        if (!group) return res.status(400).json({ message: "El grupo seleccionado no existe" });
        assignedGroupId = group.id;
      }
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const base = normalizeUsername(`${firstName.trim().toLowerCase()}${lastName.trim().toLowerCase().split(" ")[0]}`);
      let username = base;
      let counter = 1;
      while (await storage.getUserByUsername(username)) {
        username = `${base}${counter}`;
        counter++;
      }

      const hashedPassword = await bcrypt.hash(guardPassword, 10);
      const user = await storage.createUser({ username, password: hashedPassword, fullName, role: userRole, groupId: assignedGroupId });
      res.json({ id: user.id, username: user.username, fullName: user.fullName, role: user.role, groupId: user.groupId });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/guards/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { firstName, lastName, role, groupId } = req.body;
      if (!firstName || !lastName) return res.status(400).json({ message: "Nombre y apellidos requeridos" });
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const userRole = role === "tutor" ? "tutor" : "guard";
      let assignedGroupId: number | null = null;
      if (userRole === "tutor" && groupId) {
        const group = await storage.getGroup(parseInt(groupId));
        if (!group) return res.status(400).json({ message: "El grupo seleccionado no existe" });
        assignedGroupId = group.id;
      }
      const updateData: any = { fullName, role: userRole, groupId: assignedGroupId };
      const user = await storage.updateUser(id, updateData);
      if (!user) return res.status(404).json({ message: "Profesor no encontrado" });
      res.json({ id: user.id, username: user.username, fullName: user.fullName, role: user.role, groupId: user.groupId });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/guards/:id", requireAuth, requireAdmin, async (req, res) => {
    await storage.deleteUser(parseInt(req.params.id));
    res.json({ message: "Profesor eliminado" });
  });

  app.put("/api/guards/:id/permissions", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { permissions } = req.body;
      if (!Array.isArray(permissions)) return res.status(400).json({ message: "Permisos inválidos" });
      const user = await storage.getUser(id);
      if (!user) return res.status(404).json({ message: "Profesor no encontrado" });
      if (user.role === "admin") return res.status(400).json({ message: "No se pueden modificar permisos del administrador" });
      await storage.updateUser(id, { permissions });
      res.json({ message: "Permisos actualizados" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/guards/:id/guard-tab", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { guardTabVisible } = req.body;
      if (typeof guardTabVisible !== "boolean" && guardTabVisible !== null) {
        return res.status(400).json({ message: "Valor inválido" });
      }
      const user = await storage.getUser(id);
      if (!user) return res.status(404).json({ message: "Profesor no encontrado" });
      if (user.role === "admin") return res.status(400).json({ message: "No se puede modificar para el administrador" });
      await storage.updateUser(id, { guardTabVisible });
      res.json({ message: "Configuración actualizada" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const guardPhotoUpload = multer({
    storage: multerStorage,
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith("image/")) cb(null, true);
      else cb(new Error("Solo se permiten imágenes"));
    },
    limits: { fileSize: 5 * 1024 * 1024 },
  });

  app.patch("/api/guards/:id/photo", requireAuth, requireAdmin, guardPhotoUpload.single("photo"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "ID inválido" });
      if (!req.file) return res.status(400).json({ message: "No se recibió imagen" });
      const user = await storage.getUser(id);
      if (!user) return res.status(404).json({ message: "Profesor no encontrado" });
      if (user.photoUrl) {
        const oldPath = path.join(uploadsDir, path.basename(user.photoUrl));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      const photoUrl = `/uploads/${req.file.filename}`;
      await storage.updateUser(id, { photoUrl });
      res.json({ photoUrl });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/guards/:id/photo", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "ID inválido" });
      const user = await storage.getUser(id);
      if (!user) return res.status(404).json({ message: "Profesor no encontrado" });
      if (user.photoUrl) {
        const filePath = path.join(uploadsDir, path.basename(user.photoUrl));
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      await storage.updateUser(id, { photoUrl: null });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/groups", requireAuth, async (_req, res) => {
    const allGroups = await storage.getAllGroups();
    res.json(allGroups);
  });

  app.post("/api/groups", requireAuth, requirePermission("groups"), async (req, res) => {
    try {
      const group = await storage.createGroup(req.body);
      res.json(group);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/groups/:id/students", requireAuth, async (req, res) => {
    try {
      const groupStudents = await storage.getStudentsByGroup(parseInt(req.params.id));
      res.json(groupStudents);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/groups/:id", requireAuth, requirePermission("groups"), async (req, res) => {
    const isAdmin = req.user?.role === "admin";
    const { chatBidirectional, ...rest } = req.body;
    const updateData = isAdmin ? req.body : rest;
    const group = await storage.updateGroup(parseInt(req.params.id), updateData);
    if (!group) return res.status(404).json({ message: "Grupo no encontrado" });
    res.json(group);
  });

  app.delete("/api/groups/:id", requireAuth, requirePermission("groups"), async (req, res) => {
    await storage.deleteGroup(parseInt(req.params.id));
    res.json({ message: "Grupo eliminado" });
  });

  app.get("/api/students", requireAuth, async (_req, res) => {
    const allStudents = await storage.getAllStudents();
    res.json(allStudents);
  });

  app.get("/api/students/template", requireAuth, requirePermission("students"), (_req, res) => {
    const wb = XLSX.utils.book_new();
    const headers = [
      [
        "Nombre", "Apellidos", "Fecha_Nacimiento", "Curso", "Grupo", "Autorizacion_Paterna", "Autorizacion_Guagua", "Minutos_Guagua", "Email",
        "Autorizado1_Nombre", "Autorizado1_Apellidos", "Autorizado1_DNI",
        "Autorizado2_Nombre", "Autorizado2_Apellidos", "Autorizado2_DNI",
        "Autorizado3_Nombre", "Autorizado3_Apellidos", "Autorizado3_DNI",
      ],
      ["María", "García Fernández", "2010-03-15", "1 ESO", "1A", "SI", "NO", "", "familia.garcia@ejemplo.com", "Ana", "Fernández López", "12345678A", "Pedro", "García Ruiz", "87654321B", "", "", ""],
      ["Carlos", "López Martín", "2005-07-22", "2 BACH", "2 BACH B", "SI", "SI", "10", "", "", "", "", "", "", "", "", ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    ws["!cols"] = [
      { wch: 15 }, { wch: 25 }, { wch: 18 },
      { wch: 15 }, { wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 30 },
      { wch: 18 }, { wch: 22 }, { wch: 15 },
      { wch: 18 }, { wch: 22 }, { wch: 15 },
      { wch: 18 }, { wch: 22 }, { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Alumnos");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=plantilla_alumnos.xlsx");
    res.send(Buffer.from(buf));
  });

  app.post("/api/students/import", requireAuth, requirePermission("students"), upload.single("file"), async (req, res) => {
    const filePath = req.file?.path;
    try {
      if (!req.file || !filePath) return res.status(400).json({ message: "No se subió archivo" });

      const wb = XLSX.readFile(filePath);
      const sheetName = wb.SheetNames[0];
      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);

      if (!rows.length) return res.status(400).json({ message: "El archivo está vacío" });

      const requiredCols = ["Nombre", "Apellidos", "Fecha_Nacimiento", "Curso", "Grupo"];
      const headers = Object.keys(rows[0]);
      const missing = requiredCols.filter(c => !headers.includes(c));
      if (missing.length) {
        return res.status(400).json({ message: `Columnas requeridas no encontradas: ${missing.join(", ")}. Descarga la plantilla para ver el formato correcto.` });
      }

      const allGroups = await storage.getAllGroups();
      const created: any[] = [];
      const errors: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;

        const firstName = String(row["Nombre"] || "").trim();
        const lastName = String(row["Apellidos"] || "").trim();
        const rawDob = row["Fecha_Nacimiento"];
        let dob = "";
        if (typeof rawDob === "number") {
          const excelEpoch = new Date(1899, 11, 30);
          const date = new Date(excelEpoch.getTime() + rawDob * 86400000);
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, "0");
          const d = String(date.getDate()).padStart(2, "0");
          dob = `${y}-${m}-${d}`;
        } else if (rawDob instanceof Date) {
          dob = rawDob.toISOString().split("T")[0];
        } else {
          dob = String(rawDob || "").trim();
          if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(dob)) {
            const parts = dob.split(/[\/\-]/);
            dob = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
          }
        }
        const course = String(row["Curso"] || "").trim();
        const groupName = String(row["Grupo"] || "").trim();
        const parentalAuth = String(row["Autorizacion_Paterna"] || "").trim().toUpperCase();
        const busAuth = String(row["Autorizacion_Guagua"] || "").trim().toUpperCase();
        const busMinutesRaw = row["Minutos_Guagua"];
        const busExitMinutes = Math.max(5, Math.min(30, busMinutesRaw ? parseInt(String(busMinutesRaw).trim()) || 5 : 5));
        const email = String(row["Email"] || "").trim() || null;

        if (!firstName || !lastName) {
          errors.push(`Fila ${rowNum}: Nombre o Apellidos vacíos`);
          continue;
        }
        if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
          errors.push(`Fila ${rowNum}: Fecha inválida (usar YYYY-MM-DD). Valor: "${rawDob}"`);
          continue;
        }
        if (!course) {
          errors.push(`Fila ${rowNum}: Curso vacío`);
          continue;
        }

        let group = allGroups.find(g => g.name.toLowerCase() === groupName.toLowerCase());
        if (!group && groupName) {
          group = await storage.createGroup({ name: groupName, course });
          allGroups.push(group);
        }
        if (!group) {
          errors.push(`Fila ${rowNum}: Grupo vacío`);
          continue;
        }

        try {
          const student = await storage.createStudent({
            firstName,
            lastName,
            dateOfBirth: dob,
            course,
            groupId: group.id,
            photoUrl: null,
            parentalAuthorization: parentalAuth === "SI" || parentalAuth === "SÍ" || parentalAuth === "TRUE" || parentalAuth === "1",
            busAuthorization: busAuth === "SI" || busAuth === "SÍ" || busAuth === "TRUE" || busAuth === "1",
            busExitMinutes,
            email,
          });

          const pickups: { studentId: number; firstName: string; lastName: string; documentId: string }[] = [];
          for (let p = 1; p <= 10; p++) {
            const pName = String(row[`Autorizado${p}_Nombre`] || "").trim();
            const pLast = String(row[`Autorizado${p}_Apellidos`] || "").trim();
            const pDoc = String(row[`Autorizado${p}_DNI`] || "").trim();
            if (pName && pLast && pDoc) {
              pickups.push({ studentId: student.id, firstName: pName, lastName: pLast, documentId: pDoc });
            }
          }
          if (pickups.length > 0) {
            await storage.setAuthorizedPickups(student.id, pickups);
          }

          created.push(student);
        } catch (err: any) {
          errors.push(`Fila ${rowNum}: ${err.message}`);
        }
      }

      res.json({
        message: `${created.length} alumno(s) importado(s) correctamente`,
        imported: created.length,
        errors,
      });
    } catch (error: any) {
      res.status(500).json({ message: `Error procesando archivo: ${error.message}` });
    } finally {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  });

  app.get("/api/students/:id", requireAuth, async (req, res) => {
    const student = await storage.getStudent(parseInt(req.params.id));
    if (!student) return res.status(404).json({ message: "Alumno no encontrado" });
    res.json(student);
  });

  app.post("/api/students", requireAuth, requirePermission("students"), async (req, res) => {
    try {
      if (req.body.busExitMinutes !== undefined) {
        req.body.busExitMinutes = Math.max(5, Math.min(30, parseInt(req.body.busExitMinutes) || 5));
      }
      const student = await storage.createStudent(req.body);
      res.json(student);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/students/:id", requireAuth, requirePermission("students"), async (req, res) => {
    if (req.body.busExitMinutes !== undefined) {
      req.body.busExitMinutes = Math.max(5, Math.min(30, parseInt(req.body.busExitMinutes) || 5));
    }
    const student = await storage.updateStudent(parseInt(req.params.id), req.body);
    if (!student) return res.status(404).json({ message: "Alumno no encontrado" });
    res.json(student);
  });

  app.delete("/api/students/:id", requireAuth, requirePermission("students"), async (req, res) => {
    await storage.deleteStudent(parseInt(req.params.id));
    res.json({ message: "Alumno eliminado" });
  });

  app.post("/api/upload-photo", requireAuth, upload.single("photo"), (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No se subió imagen" });
    res.json({ url: `/uploads/${req.file.filename}` });
  });

  app.post("/api/upload-sound/:type", requireAuth, requirePermission("settings"), audioUpload.single("audio"), async (req, res) => {
    try {
      const type = req.params.type;
      if (type !== "authorized" && type !== "denied") {
        return res.status(400).json({ message: "Tipo inválido. Usar 'authorized' o 'denied'" });
      }
      if (!req.file) return res.status(400).json({ message: "No se subió archivo de audio" });

      const oldSound = await storage.getSetting(`sound_${type}`);
      if (oldSound) {
        const oldPath = path.join(uploadsDir, path.basename(oldSound));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      const url = `/uploads/${req.file.filename}`;
      await storage.setSetting(`sound_${type}`, url);
      res.json({ url });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/upload-sound/:type", requireAuth, requirePermission("settings"), async (req, res) => {
    try {
      const type = req.params.type;
      if (type !== "authorized" && type !== "denied") {
        return res.status(400).json({ message: "Tipo inválido" });
      }
      const currentSound = await storage.getSetting(`sound_${type}`);
      if (currentSound) {
        const filePath = path.join(uploadsDir, path.basename(currentSound));
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        await storage.setSetting(`sound_${type}`, "");
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/tutor/students", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(403).json({ message: "Usuario no encontrado" });

      let groupId: number | null = null;
      if (user.role === "admin") {
        groupId = req.query.groupId ? parseInt(req.query.groupId as string) : null;
        if (!groupId) {
          const groups = await storage.getAllGroups();
          if (groups.length > 0) groupId = groups[0].id;
        }
      } else if (user.role === "tutor" && user.groupId) {
        groupId = user.groupId;
      } else {
        return res.status(403).json({ message: "No tienes un grupo asignado" });
      }

      if (!groupId) return res.json({ students: [], group: null });
      const groupStudents = await storage.getStudentsByGroup(groupId);
      const group = await storage.getGroup(groupId);
      res.json({ students: groupStudents, group });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/tutor/students/:id/photo", requireAuth, upload.single("photo"), async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user || (user.role !== "tutor" && user.role !== "admin")) {
        return res.status(403).json({ message: "Acceso denegado" });
      }
      if (!req.file) return res.status(400).json({ message: "No se subió imagen" });
      const studentId = parseInt(req.params.id);
      const student = await storage.getStudent(studentId);
      if (!student) return res.status(404).json({ message: "Alumno no encontrado" });
      if (user.role === "tutor" && student.groupId !== user.groupId) {
        return res.status(403).json({ message: "Este alumno no pertenece a tu grupo" });
      }
      const photoUrl = `/uploads/${req.file.filename}`;
      const updated = await storage.updateStudent(studentId, { photoUrl });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/schedules/:groupId", requireAuth, async (req, res) => {
    const { date } = req.query;
    if (date && typeof date === "string") {
      const schedules = await storage.getGroupSchedulesByDate(parseInt(req.params.groupId), date);
      return res.json(schedules);
    }
    const schedules = await storage.getGroupSchedules(parseInt(req.params.groupId));
    res.json(schedules);
  });

  app.get("/api/schedules/:groupId/dates", requireAuth, async (req, res) => {
    const dates = await storage.getScheduleDates(parseInt(req.params.groupId));
    res.json(dates);
  });

  app.post("/api/schedules", requireAuth, requirePermission("calendar"), async (req, res) => {
    try {
      const { schedules } = req.body;
      await storage.bulkSetGroupSchedules(schedules);
      res.json({ message: "Horarios actualizados" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/verify", requireAuth, async (req, res) => {
    try {
      const rawQrCode = req.body.qrCode;
      const qrCode = typeof rawQrCode === "string" ? rawQrCode.trim() : rawQrCode;
      const userId = (req.session as any).userId;

      const student = await storage.getStudentByQr(qrCode);
      if (!student) {
        console.log(`[verify] Código no reconocido: "${qrCode}" (longitud: ${qrCode?.length})`);
        const log = await storage.createExitLog({
          studentId: 0,
          result: "DENEGADO",
          reason: "QR no reconocido en el sistema",
          verifiedBy: userId,
        });
        return res.json({
          result: "DENEGADO",
          reason: "QR no reconocido en el sistema",
          student: null,
          logId: log.id,
        });
      }

      const dob = new Date(student.dateOfBirth);
      const age = differenceInYears(new Date(), dob);

      if (age >= 18) {
        const log = await storage.createExitLog({
          studentId: student.id,
          result: "AUTORIZADO",
          reason: "Mayor de edad",
          verifiedBy: userId,
        });
        return res.json({
          result: "AUTORIZADO",
          reason: "Mayor de edad",
          student: { id: student.id, firstName: student.firstName, lastName: student.lastName, photoUrl: student.photoUrl, course: student.course, groupId: student.groupId, age },
          logId: log.id,
        });
      }

      if (!student.parentalAuthorization) {
        const log = await storage.createExitLog({
          studentId: student.id,
          result: "DENEGADO",
          reason: "Sin autorización paterna",
          verifiedBy: userId,
        });
        return res.json({
          result: "DENEGADO",
          reason: "Sin autorización paterna",
          student: { id: student.id, firstName: student.firstName, lastName: student.lastName, photoUrl: student.photoUrl, course: student.course, groupId: student.groupId, age },
          logId: log.id,
        });
      }

      const dayOfWeek = getCurrentDayOfWeek();
      const todayStr = new Date().toISOString().split("T")[0];

      const timeSlotsJson = await storage.getSetting("timeSlots");
      const timeSlotsConfig: TimeSlotsConfig = timeSlotsJson ? JSON.parse(timeSlotsJson) : getDefaultTimeSlotsConfig();
      const slotsForDay = getTimeSlotsForDay(timeSlotsConfig, dayOfWeek);
      const timeSlot = getCurrentTimeSlotFromConfig(slotsForDay);

      if (dayOfWeek > 5) {
        const log = await storage.createExitLog({
          studentId: student.id,
          result: "DENEGADO",
          reason: "Fin de semana - No hay horario escolar",
          verifiedBy: userId,
        });
        return res.json({
          result: "DENEGADO",
          reason: "Fin de semana - No hay horario escolar",
          student: { id: student.id, firstName: student.firstName, lastName: student.lastName, photoUrl: student.photoUrl, course: student.course, groupId: student.groupId, age },
          logId: log.id,
        });
      }

      if (student.busAuthorization) {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const busMinutes = student.busExitMinutes || 5;

        const classSlots = slotsForDay.filter(s => !s.isBreak);
        const morningSlots = classSlots.filter(s => s.id <= 6);
        const afternoonSlots = classSlots.filter(s => s.id > 6);

        const lastMorning = morningSlots.length > 0 ? morningSlots[morningSlots.length - 1] : null;
        const lastAfternoon = afternoonSlots.length > 0 ? afternoonSlots[afternoonSlots.length - 1] : null;

        let busAllowed = false;
        let busLabel = "";

        if (lastMorning) {
          const morningEnd = timeToMinutes(lastMorning.end);
          if (currentMinutes >= morningEnd - busMinutes && currentMinutes <= morningEnd) {
            busAllowed = true;
            busLabel = `${busMinutes} min antes del fin de mañana (${lastMorning.end})`;
          }
        }
        if (!busAllowed && lastAfternoon) {
          const afternoonEnd = timeToMinutes(lastAfternoon.end);
          if (currentMinutes >= afternoonEnd - busMinutes && currentMinutes <= afternoonEnd) {
            busAllowed = true;
            busLabel = `${busMinutes} min antes del fin de tarde (${lastAfternoon.end})`;
          }
        }

        if (busAllowed) {
          const reason = `Salida por guagua - ${busLabel}`;
          const log = await storage.createExitLog({
            studentId: student.id,
            result: "AUTORIZADO",
            reason,
            verifiedBy: userId,
          });
          sendEarlyExitEmail(student, reason, new Date()).catch(() => {});
          return res.json({
            result: "AUTORIZADO",
            reason,
            student: { id: student.id, firstName: student.firstName, lastName: student.lastName, photoUrl: student.photoUrl, course: student.course, groupId: student.groupId, age },
            logId: log.id,
          });
        }
      }

      if (timeSlot === -1) {
        const log = await storage.createExitLog({
          studentId: student.id,
          result: "DENEGADO",
          reason: "Fuera de horario escolar",
          verifiedBy: userId,
        });
        return res.json({
          result: "DENEGADO",
          reason: "Fuera de horario escolar",
          student: { id: student.id, firstName: student.firstName, lastName: student.lastName, photoUrl: student.photoUrl, course: student.course, groupId: student.groupId, age },
          logId: log.id,
        });
      }

      const currentSlotConfig = slotsForDay.find(s => s.id === timeSlot);
      if (currentSlotConfig?.isBreak) {
        const breakLabel = currentSlotConfig.label || "Recreo";
        const log = await storage.createExitLog({
          studentId: student.id,
          result: "DENEGADO",
          reason: `${breakLabel} - No se permite salida`,
          verifiedBy: userId,
        });
        return res.json({
          result: "DENEGADO",
          reason: `${breakLabel} - No se permite salida`,
          student: { id: student.id, firstName: student.firstName, lastName: student.lastName, photoUrl: student.photoUrl, course: student.course, groupId: student.groupId, age },
          logId: log.id,
        });
      }

      const schedules = await storage.getGroupSchedulesByDate(student.groupId, todayStr);
      const currentSchedule = schedules.find(
        (s) => s.timeSlot === timeSlot
      );

      if (currentSchedule && currentSchedule.exitAllowed) {
        const reason = `Permiso grupal - ${todayStr} Tramo ${timeSlot}`;
        const log = await storage.createExitLog({
          studentId: student.id,
          result: "AUTORIZADO",
          reason,
          verifiedBy: userId,
        });
        sendEarlyExitEmail(student, reason, new Date()).catch(() => {});
        return res.json({
          result: "AUTORIZADO",
          reason,
          student: { id: student.id, firstName: student.firstName, lastName: student.lastName, photoUrl: student.photoUrl, course: student.course, groupId: student.groupId, age },
          logId: log.id,
        });
      }

      const log = await storage.createExitLog({
        studentId: student.id,
        result: "DENEGADO",
        reason: "Salida no permitida en este tramo horario",
        verifiedBy: userId,
      });
      return res.json({
        result: "DENEGADO",
        reason: "Salida no permitida en este tramo horario",
        student: { id: student.id, firstName: student.firstName, lastName: student.lastName, photoUrl: student.photoUrl, course: student.course, groupId: student.groupId, age },
        logId: log.id,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/exit-logs", requireAuth, requirePermission("history"), async (req, res) => {
    const { dateFrom, dateTo, groupId, studentName } = req.query;
    const logs = await storage.getExitLogs({
      dateFrom: dateFrom as string,
      dateTo: dateTo as string,
      groupId: groupId ? parseInt(groupId as string) : undefined,
      studentName: studentName as string,
    });
    res.json(logs);
  });

  app.get("/api/tutor/exit-logs", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(403).json({ message: "Usuario no encontrado" });

      let groupId: number | null = null;
      if (user.role === "admin") {
        groupId = req.query.groupId ? parseInt(req.query.groupId as string) : null;
      } else if (user.role === "tutor" && user.groupId) {
        groupId = user.groupId;
      } else {
        return res.status(403).json({ message: "No tienes un grupo asignado" });
      }

      if (!groupId) return res.json([]);
      const logs = await storage.getExitLogs({
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        groupId,
        studentName: req.query.studentName as string,
      });
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/tutor/late-arrivals", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(403).json({ message: "Usuario no encontrado" });

      let groupId: number | null = null;
      if (user.role === "admin") {
        groupId = req.query.groupId ? parseInt(req.query.groupId as string) : null;
      } else if (user.role === "tutor" && user.groupId) {
        groupId = user.groupId;
      } else {
        return res.status(403).json({ message: "No tienes un grupo asignado" });
      }

      if (!groupId) return res.json([]);
      const arrivals = await storage.getLateArrivals({
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        groupId,
        studentName: req.query.studentName as string,
      });
      res.json(arrivals);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/exit-stats", requireAuth, async (_req, res) => {
    const stats = await storage.getExitStats();
    res.json(stats);
  });

  app.get("/api/exit-logs/recent", requireAuth, async (_req, res) => {
    const logs = await storage.getRecentExitLogs(20);
    res.json(logs);
  });

  app.post("/api/incidents", requireAuth, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const incident = await storage.createIncident({ ...req.body, createdBy: userId });
      res.json(incident);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/incidents", requireAuth, async (_req, res) => {
    const allIncidents = await storage.getIncidents();
    res.json(allIncidents);
  });

  app.get("/api/settings", requireAuth, async (req, res) => {
    const settings = await storage.getAllSettings();
    if ((req.session as any).role !== "admin") {
      delete settings.guardPassword;
    }
    res.json(settings);
  });

  app.put("/api/settings", requireAuth, requirePermission("settings"), async (req, res) => {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ message: "Clave requerida" });
    await storage.setSetting(key, String(value));
    const settings = await storage.getAllSettings();
    res.json(settings);
  });

  app.get("/api/exit-logs/export", requireAuth, requirePermission("history"), async (req, res) => {
    const { dateFrom, dateTo, groupId, studentName } = req.query;
    const format = (req.query.format as string) || "xlsx";
    const logs = await storage.getExitLogs({
      dateFrom: dateFrom as string,
      dateTo: dateTo as string,
      groupId: groupId ? parseInt(groupId as string) : undefined,
      studentName: studentName as string,
    });

    const rows = logs.map(log => {
      const date = new Date(log.timestamp);
      return {
        "ID": log.id,
        "Alumno": log.studentName,
        "Grupo": log.groupName,
        "Fecha": date.toLocaleDateString("es-ES"),
        "Hora": date.toLocaleTimeString("es-ES"),
        "Resultado": log.result,
        "Motivo": log.reason,
        "Verificado por": log.verifierName,
      };
    });

    if (format === "csv") {
      const csvHeader = "ID,Alumno,Grupo,Fecha,Hora,Resultado,Motivo,Verificado por\n";
      const csvRows = rows.map(r => `${r.ID},"${r.Alumno}","${r.Grupo}","${r.Fecha}","${r.Hora}","${r.Resultado}","${r.Motivo}","${r["Verificado por"]}"`).join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="salidas_${new Date().toISOString().split("T")[0]}.csv"`);
      res.send("\uFEFF" + csvHeader + csvRows);
    } else {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Salidas");
      ws["!cols"] = [{ wch: 6 }, { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 40 }, { wch: 20 }];
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="salidas_${new Date().toISOString().split("T")[0]}.xlsx"`);
      res.send(buf);
    }
  });

  app.get("/api/carnet/:token", async (req, res) => {
    try {
      const student = await storage.getStudentByCarnetToken(req.params.token);
      if (!student) return res.status(404).json({ message: "Carnet no encontrado" });
      const group = await storage.getGroup(student.groupId);
      const schoolName = await storage.getSetting("schoolName");
      const academicYear = await storage.getSetting("academicYear");

      let busExitTime: string | null = null;
      if (student.busAuthorization && group) {
        const timeSlotsRaw = await storage.getSetting("timeSlots");
        const timeSlotsConfig = timeSlotsRaw ? JSON.parse(timeSlotsRaw) : null;
        const { getDefaultTimeSlotsConfig } = await import("@shared/schema");
        const config = timeSlotsConfig || getDefaultTimeSlotsConfig();
        const daySlots: any[] = config["1"] || [];
        const classSlots = daySlots.filter((s: any) => !s.isBreak);
        const busMinutes = student.busExitMinutes || 5;

        const schedule = group.schedule || "morning";
        if (schedule === "morning" || schedule === "full") {
          const morningSlots = classSlots.filter((s: any) => s.id <= 6);
          const lastMorning = morningSlots.length > 0 ? morningSlots[morningSlots.length - 1] : null;
          if (lastMorning) {
            const [h, m] = lastMorning.end.split(":").map(Number);
            const totalMin = h * 60 + m - busMinutes;
            busExitTime = `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
          }
        } else if (schedule === "afternoon") {
          const afternoonSlots = classSlots.filter((s: any) => s.id > 6);
          const lastAfternoon = afternoonSlots.length > 0 ? afternoonSlots[afternoonSlots.length - 1] : null;
          if (lastAfternoon) {
            const [h, m] = lastAfternoon.end.split(":").map(Number);
            const totalMin = h * 60 + m - busMinutes;
            busExitTime = `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
          }
        }
      }

      res.json({
        firstName: student.firstName,
        lastName: student.lastName,
        course: student.course,
        groupName: group?.name || "",
        photoUrl: student.photoUrl,
        qrCode: student.qrCode,
        dateOfBirth: student.dateOfBirth,
        schoolName: schoolName || "",
        academicYear: academicYear || "",
        parentalAuthorization: student.parentalAuthorization,
        busAuthorization: student.busAuthorization,
        busExitMinutes: student.busExitMinutes,
        busExitTime,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/students/generate-tokens", requireAuth, requirePermission("students"), async (_req, res) => {
    try {
      const count = await storage.generateCarnetTokens();
      res.json({ message: `Tokens generados para ${count} alumno(s)`, count });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/archive-academic-year", requireAuth, requirePermission("archives"), async (req, res) => {
    try {
      const { confirmation, yearName } = req.body;
      if (confirmation !== "ARCHIVAR CURSO") {
        return res.status(400).json({ message: "Confirmación incorrecta. Escribe 'ARCHIVAR CURSO' para continuar." });
      }
      if (!yearName || typeof yearName !== "string" || yearName.trim().length === 0) {
        return res.status(400).json({ message: "Debes indicar el nombre del curso académico a archivar." });
      }
      const adminUserId = (req.session as any).userId;
      const archive = await storage.archiveAcademicYear(adminUserId, yearName.trim());
      res.json({ message: `Curso "${yearName}" archivado correctamente.`, archiveId: archive.id });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/reset-academic-year", requireAuth, requirePermission("archives"), async (req, res) => {
    try {
      const { confirmation } = req.body;
      if (confirmation !== "NUEVO CURSO") {
        return res.status(400).json({ message: "Confirmación incorrecta. Escribe 'NUEVO CURSO' para continuar." });
      }
      const adminUserId = (req.session as any).userId;
      await storage.resetAcademicYear(adminUserId);
      res.json({ message: "Curso académico reiniciado correctamente. Todos los datos han sido eliminados." });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/archives", requireAuth, requirePermission("archives"), async (_req, res) => {
    try {
      const archives = await storage.getAcademicArchives();
      const summary = archives.map(a => ({
        id: a.id,
        yearName: a.yearName,
        archivedAt: a.archivedAt,
        stats: {
          students: (a.data as any)?.students?.length || 0,
          groups: (a.data as any)?.groups?.length || 0,
          exitLogs: (a.data as any)?.exitLogs?.length || 0,
          lateArrivals: (a.data as any)?.lateArrivals?.length || 0,
          incidents: (a.data as any)?.incidents?.length || 0,
          users: (a.data as any)?.users?.length || 0,
        },
      }));
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/archives/:id", requireAuth, requirePermission("archives"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "ID inválido" });
      const archive = await storage.getAcademicArchive(id);
      if (!archive) return res.status(404).json({ message: "Archivo no encontrado" });
      res.json(archive);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/archives/:id", requireAuth, requirePermission("archives"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "ID inválido" });
      await storage.deleteAcademicArchive(id);
      res.json({ message: "Archivo eliminado permanentemente" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/late-arrivals", requireAuth, async (req, res) => {
    try {
      const { qrCode, studentId, notes } = req.body;
      if (!qrCode && !studentId) {
        return res.status(400).json({ message: "Debes escanear un QR o seleccionar un alumno" });
      }
      if (notes && typeof notes !== "string") {
        return res.status(400).json({ message: "Las notas deben ser texto" });
      }
      const userId = (req.session as any).userId;
      let student;

      if (qrCode) {
        if (typeof qrCode !== "string") return res.status(400).json({ message: "Código QR inválido" });
        student = await storage.getStudentByQr(qrCode);
        if (!student) return res.status(404).json({ message: "QR no reconocido" });
      } else {
        const id = parseInt(studentId);
        if (isNaN(id)) return res.status(400).json({ message: "ID de alumno inválido" });
        student = await storage.getStudent(id);
        if (!student) return res.status(404).json({ message: "Alumno no encontrado" });
      }

      let emailSent = false;
      if (student.email) {
        emailSent = await sendLateArrivalEmail(student, new Date());
      }

      const arrival = await storage.createLateArrival({
        studentId: student.id,
        registeredBy: userId,
        emailSent,
        notes: notes || null,
      });

      const group = await storage.getGroup(student.groupId);
      res.json({
        ...arrival,
        studentName: `${student.firstName} ${student.lastName}`,
        studentPhoto: student.photoUrl,
        groupName: group?.name || "Sin grupo",
        course: student.course,
        emailSent,
        studentEmail: student.email,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/late-arrivals", requireAuth, async (req, res) => {
    try {
      const filters: any = {};
      if (req.query.dateFrom) filters.dateFrom = req.query.dateFrom;
      if (req.query.dateTo) filters.dateTo = req.query.dateTo;
      if (req.query.groupId) filters.groupId = parseInt(req.query.groupId as string);
      if (req.query.studentName) filters.studentName = req.query.studentName;
      const arrivals = await storage.getLateArrivals(filters);
      res.json(arrivals);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/late-arrivals/today", requireAuth, async (_req, res) => {
    try {
      const arrivals = await storage.getTodayLateArrivals();
      res.json(arrivals);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/late-arrivals/export", requireAuth, requirePermission("late_history"), async (req, res) => {
    try {
      const filters: any = {};
      if (req.query.dateFrom) filters.dateFrom = req.query.dateFrom;
      if (req.query.dateTo) filters.dateTo = req.query.dateTo;
      if (req.query.groupId) filters.groupId = parseInt(req.query.groupId as string);
      if (req.query.studentName) filters.studentName = req.query.studentName;
      const format = (req.query.format as string) || "xlsx";
      const arrivals = await storage.getLateArrivals(filters);

      const rows = arrivals.map((a: any) => {
        const date = new Date(a.timestamp);
        return {
          "ID": a.id,
          "Alumno": a.studentName,
          "Grupo": a.groupName,
          "Curso": a.course,
          "Fecha": date.toLocaleDateString("es-ES"),
          "Hora": date.toLocaleTimeString("es-ES"),
          "Registrado por": a.registrarName,
          "Email enviado": a.emailSent ? "Sí" : "No",
          "Notas": a.notes || "",
        };
      });

      if (format === "csv") {
        const csvHeader = "ID,Alumno,Grupo,Curso,Fecha,Hora,Registrado por,Email enviado,Notas\n";
        const csvRows = rows.map(r => `${r.ID},"${r.Alumno}","${r.Grupo}","${r.Curso}","${r.Fecha}","${r.Hora}","${r["Registrado por"]}","${r["Email enviado"]}","${(r.Notas || "").replace(/"/g, '""')}"`).join("\n");
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="entradas_tardias_${new Date().toISOString().split("T")[0]}.csv"`);
        res.send("\uFEFF" + csvHeader + csvRows);
      } else {
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Entradas Tardías");
        ws["!cols"] = [{ wch: 6 }, { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 14 }, { wch: 30 }];
        const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="entradas_tardias_${new Date().toISOString().split("T")[0]}.xlsx"`);
        res.send(buf);
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/settings/test-smtp", requireAuth, requirePermission("settings"), async (_req, res) => {
    try {
      const result = await testSmtpConnection();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/students/:id/authorized-pickups", requireAuth, requirePermission("students"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "ID inválido" });
      const pickups = await storage.getAuthorizedPickups(id);
      res.json(pickups);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/students/:id/authorized-pickups", requireAuth, requirePermission("students"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "ID inválido" });
      const student = await storage.getStudent(id);
      if (!student) return res.status(404).json({ message: "Alumno no encontrado" });
      const { pickups } = req.body;
      if (!Array.isArray(pickups)) return res.status(400).json({ message: "Formato inválido" });
      if (pickups.length > 10) return res.status(400).json({ message: "Máximo 10 personas autorizadas" });
      for (const p of pickups) {
        if (!p.firstName?.trim() || !p.lastName?.trim() || !p.documentId?.trim()) {
          return res.status(400).json({ message: "Nombre, apellido y DNI/NIE son obligatorios" });
        }
      }
      const result = await storage.setAuthorizedPickups(id, pickups.map((p: any) => ({
        studentId: id,
        firstName: p.firstName.trim(),
        lastName: p.lastName.trim(),
        documentId: p.documentId.trim(),
      })));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/accompanied-exit", requireAuth, async (req, res) => {
    try {
      const { studentId, documentId, extraordinary, extraordinaryName, extraordinaryReason } = req.body;
      const userId = (req.session as any).userId;
      if (!studentId || (!documentId && !extraordinary)) {
        return res.status(400).json({ message: "Alumno y DNI/NIE son obligatorios" });
      }
      const id = parseInt(studentId);
      if (isNaN(id)) return res.status(400).json({ message: "ID de alumno inválido" });
      const student = await storage.getStudent(id);
      if (!student) return res.status(404).json({ message: "Alumno no encontrado" });

      const group = await storage.getGroup(student.groupId);
      const age = Math.floor((Date.now() - new Date(student.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));

      if (extraordinary) {
        const extraordinaryEnabled = await storage.getSetting("extraordinaryExitEnabled");
        if (extraordinaryEnabled !== "true") {
          return res.status(403).json({ message: "La autorización extraordinaria no está habilitada" });
        }
        if (!extraordinaryName || !extraordinaryReason) {
          return res.status(400).json({ message: "Nombre del acompañante y motivo son obligatorios" });
        }

        const reasonText = `Salida extraordinaria con ${extraordinaryName} (DNI: ${documentId || "no facilitado"}). Motivo: ${extraordinaryReason}`;
        const exitLog = await storage.createExitLog({
          studentId: student.id,
          result: "AUTORIZADO",
          reason: reasonText,
          verifiedBy: userId,
        });

        await storage.createIncident({
          exitLogId: exitLog.id,
          note: `Autorización extraordinaria. Acompañante: ${extraordinaryName}. DNI/NIE: ${documentId || "no facilitado"}. Motivo: ${extraordinaryReason}. Alumno: ${student.firstName} ${student.lastName}.`,
          createdBy: userId,
        });

        const accompaniedEmailEnabled = await storage.getSetting("accompaniedExitEmailEnabled");
        if (student.email && accompaniedEmailEnabled === "true") {
          sendEarlyExitEmail(student, `Salida extraordinaria con ${extraordinaryName}. Motivo: ${extraordinaryReason}`, new Date()).catch(() => {});
        }

        return res.json({
          result: "AUTORIZADO",
          reason: `Autorización extraordinaria: ${extraordinaryName}`,
          student: {
            firstName: student.firstName,
            lastName: student.lastName,
            course: student.course,
            photoUrl: student.photoUrl,
            age,
          },
          authorizedPerson: {
            firstName: extraordinaryName,
            lastName: "",
            documentId: documentId || "",
          },
          logId: exitLog.id,
          extraordinary: true,
        });
      }

      const authorizedPerson = await storage.verifyPickupAuthorization(id, documentId.trim());

      if (authorizedPerson) {
        const exitLog = await storage.createExitLog({
          studentId: student.id,
          result: "AUTORIZADO",
          reason: `Salida acompañada por ${authorizedPerson.firstName} ${authorizedPerson.lastName} (${authorizedPerson.documentId})`,
          verifiedBy: userId,
        });

        const accompaniedEmailEnabled = await storage.getSetting("accompaniedExitEmailEnabled");
        if (student.email && accompaniedEmailEnabled === "true") {
          sendEarlyExitEmail(student, `Salida acompañada por ${authorizedPerson.firstName} ${authorizedPerson.lastName}`, new Date()).catch(() => {});
        }

        res.json({
          result: "AUTORIZADO",
          reason: `Persona autorizada: ${authorizedPerson.firstName} ${authorizedPerson.lastName}`,
          student: {
            firstName: student.firstName,
            lastName: student.lastName,
            course: student.course,
            photoUrl: student.photoUrl,
            age,
          },
          authorizedPerson: {
            firstName: authorizedPerson.firstName,
            lastName: authorizedPerson.lastName,
            documentId: authorizedPerson.documentId,
          },
          logId: exitLog.id,
        });
      } else {
        res.json({
          result: "DENEGADO",
          reason: `DNI/NIE ${documentId.trim()} no figura como padre, tutor legal o persona autorizada`,
          student: {
            firstName: student.firstName,
            lastName: student.lastName,
            course: student.course,
            photoUrl: student.photoUrl,
            age,
          },
          documentId: documentId.trim(),
        });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/exit-logs/:id/pdf", requireAuth, requirePermission("history"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "ID inválido" });

      const log = await storage.getExitLog(id);
      if (!log) return res.status(404).json({ message: "Registro no encontrado" });

      const allStudents = await db.select().from(students);
      const allGroups = await db.select().from(groups);
      const allUsers = await db.select().from(users);

      const student = allStudents.find(s => s.id === log.studentId);
      const group = student ? allGroups.find(g => g.id === student.groupId) : undefined;
      const verifier = log.verifiedBy ? allUsers.find(u => u.id === log.verifiedBy) : undefined;

      const schoolName = (await storage.getSetting("schoolName")) || "Centro Educativo";
      const ts = new Date(log.timestamp);
      const dateStr = ts.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
      const timeStr = ts.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const studentName = student ? `${student.firstName} ${student.lastName}` : "Desconocido";

      const PDFDocument = (await import("pdfkit")).default;
      const doc = new PDFDocument({ size: "A4", margin: 50 });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="salida_${id}_${dateStr.replace(/\//g, "-")}.pdf"`);
      doc.pipe(res);

      const primaryColor = "#4472C4";
      const textColor = "#1a1a2e";

      doc.rect(0, 0, doc.page.width, 100).fill(primaryColor);
      doc.fontSize(22).fillColor("#ffffff").text(schoolName, 50, 30, { align: "center" });
      doc.fontSize(12).text("DOCUMENTO DE REGISTRO DE SALIDA", 50, 60, { align: "center" });

      doc.fillColor(textColor);
      let y = 130;

      doc.fontSize(10).fillColor("#666666").text(`Documento nº: SAL-${String(id).padStart(6, "0")}`, 50, y);
      doc.text(`Fecha de emisión: ${dateStr} ${timeStr}`, 50, y, { align: "right" });
      y += 30;

      doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor("#e0e0e0").stroke();
      y += 20;

      doc.fontSize(14).fillColor(primaryColor).text("DATOS DEL ALUMNO/A", 50, y);
      y += 25;

      const labelX = 50;
      const valueX = 200;

      const addField = (label: string, value: string) => {
        doc.fontSize(10).fillColor("#666666").text(label, labelX, y);
        doc.fontSize(11).fillColor(textColor).text(value, valueX, y);
        y += 22;
      };

      addField("Nombre completo:", studentName);
      addField("Grupo:", group?.name || "Sin grupo");
      addField("Curso:", student?.course || "—");
      if (student?.qrCode) addField("Código QR:", student.qrCode);

      y += 10;
      doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor("#e0e0e0").stroke();
      y += 20;

      doc.fontSize(14).fillColor(primaryColor).text("DATOS DE LA SALIDA", 50, y);
      y += 25;

      addField("Fecha:", dateStr);
      addField("Hora:", timeStr);

      const resultColor = log.result === "AUTORIZADO" ? "#16a34a" : "#dc2626";
      doc.fontSize(10).fillColor("#666666").text("Resultado:", labelX, y);
      doc.fontSize(11).fillColor(resultColor).font("Helvetica-Bold").text(log.result, valueX, y);
      doc.font("Helvetica");
      y += 22;

      addField("Motivo:", log.reason || "—");
      addField("Verificado por:", verifier?.fullName || "Sistema");

      if (log.signatureData) {
        y += 10;
        doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor("#e0e0e0").stroke();
        y += 20;

        doc.fontSize(14).fillColor(primaryColor).text("FIRMA DEL ACOMPAÑANTE", 50, y);
        y += 25;

        try {
          const base64Data = log.signatureData.replace(/^data:image\/\w+;base64,/, "");
          const imgBuffer = Buffer.from(base64Data, "base64");
          doc.image(imgBuffer, 50, y, { width: 300, height: 120 });
          y += 130;
        } catch {
          doc.fontSize(10).fillColor("#999999").text("[Firma no disponible]", 50, y);
          y += 20;
        }
      }

      y += 30;
      doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor("#e0e0e0").stroke();
      y += 15;

      doc.fontSize(8).fillColor("#999999").text(
        `Este documento ha sido generado automáticamente por ${schoolName} — SafeExit. ` +
        `Registro ID: SAL-${String(id).padStart(6, "0")}. Fecha de generación: ${new Date().toLocaleString("es-ES")}.`,
        50, y, { width: doc.page.width - 100, align: "center" }
      );

      doc.end();
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.patch("/api/exit-logs/:id/signature", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "ID inválido" });
      const { signatureData } = req.body;
      if (!signatureData || typeof signatureData !== "string") {
        return res.status(400).json({ message: "Firma requerida" });
      }
      await db.update(exitLogs).set({ signatureData }).where(eq(exitLogs.id, id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== GUARD DUTY ZONES ====================

  app.get("/api/guard-zones", requireAuth, async (_req, res) => {
    try {
      const zones = await storage.getAllGuardZones();
      res.json(zones);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/guard-zones", requireAuth, requirePermission("guard_duty"), async (req, res) => {
    try {
      const { buildingNumber, zoneName, zoneOrder } = req.body;
      if (!buildingNumber || !zoneName) {
        return res.status(400).json({ message: "Edificio y nombre de zona requeridos" });
      }
      if (buildingNumber < 1 || buildingNumber > 3) {
        return res.status(400).json({ message: "Edificio debe ser 1, 2 o 3" });
      }
      const existing = await storage.getGuardZonesByBuilding(buildingNumber);
      if (existing.length >= 6) {
        return res.status(400).json({ message: "Máximo 6 zonas por edificio" });
      }
      const zone = await storage.createGuardZone({
        buildingNumber,
        zoneName,
        zoneOrder: zoneOrder ?? existing.length + 1,
      });
      res.json(zone);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/guard-zones/:id", requireAuth, requirePermission("guard_duty"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "ID inválido" });
      const updated = await storage.updateGuardZone(id, req.body);
      if (!updated) return res.status(404).json({ message: "Zona no encontrada" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/guard-zones/:id", requireAuth, requirePermission("guard_duty"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "ID inválido" });
      await storage.deleteGuardZone(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== GUARD DUTY ASSIGNMENTS ====================

  app.get("/api/guard-duty-assignments", requireAuth, async (req, res) => {
    try {
      const day = req.query.day ? parseInt(req.query.day as string) : undefined;
      if (day !== undefined) {
        const assignments = await storage.getGuardDutyAssignments(day);
        return res.json(assignments);
      }
      const all = await storage.getAllGuardDutyAssignments();
      res.json(all);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/guard-duty-assignments", requireAuth, requirePermission("guard_duty"), async (req, res) => {
    try {
      const { userId, dayOfWeek, timeSlotId, zoneId } = req.body;
      if (!userId || !dayOfWeek || !timeSlotId || !zoneId) {
        return res.status(400).json({ message: "Todos los campos son requeridos" });
      }
      const assignment = await storage.createGuardDutyAssignment({ userId, dayOfWeek, timeSlotId, zoneId });
      res.json(assignment);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/guard-duty-assignments/:id", requireAuth, requirePermission("guard_duty"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "ID inválido" });
      await storage.deleteGuardDutyAssignment(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/guard-duty-assignments/day/:day", requireAuth, requirePermission("guard_duty"), async (req, res) => {
    try {
      const day = parseInt(req.params.day);
      if (isNaN(day) || day < 1 || day > 5) {
        return res.status(400).json({ message: "Día inválido (1-5)" });
      }
      const { assignments } = req.body;
      if (!Array.isArray(assignments)) {
        return res.status(400).json({ message: "Se requiere un array de asignaciones" });
      }
      const result = await storage.bulkSetGuardDutyAssignments(day, assignments.map((a: any) => ({
        userId: a.userId,
        dayOfWeek: day,
        timeSlotId: a.timeSlotId,
        zoneId: a.zoneId,
      })));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== GUARD DUTY REGISTRATIONS ====================

  app.get("/api/guard-duty-registrations", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const isAdmin = user.role === "admin";

      if (!isAdmin) {
        const today = new Date().toISOString().split("T")[0];
        const regs = await storage.getGuardDutyRegistrations({ dateFrom: today, dateTo: today });
        const sanitized = regs.map(({ signatureData, ...rest }: any) => rest);
        return res.json(sanitized);
      }

      const filters: any = {};
      if (req.query.dateFrom) filters.dateFrom = req.query.dateFrom;
      if (req.query.dateTo) filters.dateTo = req.query.dateTo;
      if (req.query.buildingNumber) filters.buildingNumber = parseInt(req.query.buildingNumber as string);
      if (req.query.zoneId) filters.zoneId = parseInt(req.query.zoneId as string);
      if (req.query.userId) filters.userId = parseInt(req.query.userId as string);
      const regs = await storage.getGuardDutyRegistrations(filters);
      res.json(regs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/guard-duty-registrations", requireAuth, async (req, res) => {
    try {
      const { userId, zoneId, timeSlotId, signatureData, substitutionPlan } = req.body;
      if (!userId || !zoneId || !timeSlotId) {
        return res.status(400).json({ message: "Usuario, zona y periodo son requeridos" });
      }
      if (!signatureData) {
        return res.status(400).json({ message: "La firma es obligatoria" });
      }

      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const settingsRaw = await storage.getSetting("timeSlots");
      const timeSlotsConfig: TimeSlotsConfig = settingsRaw ? JSON.parse(settingsRaw) : getDefaultTimeSlotsConfig();
      const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
      const daySlots = getTimeSlotsForDay(timeSlotsConfig, dayOfWeek);
      const slot = daySlots.find(s => s.id === timeSlotId);

      if (!slot) {
        return res.status(400).json({ message: "Periodo no válido" });
      }

      const isSubstitution = !!substitutionPlan;

      const dayAssignments = await storage.getGuardDutyAssignments(dayOfWeek);

      if (!isSubstitution) {
        const validAssignment = dayAssignments.find(
          a => a.userId === userId && a.zoneId === zoneId && a.timeSlotId === timeSlotId
        );
        if (!validAssignment) {
          return res.status(400).json({ message: "Este profesor no está asignado a esta zona/periodo" });
        }
      } else {
        const trimmed = substitutionPlan.trim();
        if (trimmed.length < 3) {
          return res.status(400).json({ message: "El plan de sustitución debe tener al menos 3 caracteres" });
        }
        const hasAssignment = dayAssignments.some(
          a => a.userId === userId && a.timeSlotId === timeSlotId
        );
        if (hasAssignment) {
          return res.status(400).json({ message: "Este profesor ya tiene asignación para este periodo. Use el fichaje normal." });
        }
      }

      const [slotStartH, slotStartM] = slot.start.split(":").map(Number);
      const [slotEndH, slotEndM] = slot.end.split(":").map(Number);
      const slotStart = slotStartH * 60 + slotStartM;
      const slotEnd = slotEndH * 60 + slotEndM;

      if (currentMinutes < slotStart || currentMinutes > slotEnd + 5) {
        return res.status(400).json({ message: "Solo puede fichar durante el periodo de guardia (con un margen de 5 minutos)" });
      }

      const existing = await storage.getGuardDutyRegistrationsByUserAndDate(userId, today);
      if (existing.some(r => r.timeSlotId === timeSlotId)) {
        return res.status(400).json({ message: "Ya ha fichado para este periodo hoy" });
      }

      const reg = await storage.createGuardDutyRegistration({
        userId,
        zoneId,
        date: today,
        timeSlotId,
        signatureData,
        substitutionPlan: isSubstitution ? substitutionPlan.trim() : null,
      });
      res.json(reg);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/guard-duty/my-assignments", requireAuth, async (req, res) => {
    try {
      const now = new Date();
      const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
      if (dayOfWeek > 5) {
        return res.json([]);
      }
      const assignments = await storage.getGuardDutyAssignments(dayOfWeek);
      const zones = await storage.getAllGuardZones();
      const allUsers = await storage.getAllUsers();

      const enriched = assignments.map(a => {
        const user = allUsers.find(u => u.id === a.userId);
        const zone = zones.find(z => z.id === a.zoneId);
        return {
          ...a,
          userName: user?.fullName || "Desconocido",
          zoneName: zone?.zoneName || "Zona eliminada",
          buildingNumber: zone?.buildingNumber || 0,
        };
      });
      res.json(enriched);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/guard-duty-registrations/:id/pdf", requireAuth, requirePermission("guard_registry"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "ID inválido" });

      const allRegs = await storage.getGuardDutyRegistrations();
      const reg = allRegs.find((r: any) => r.id === id);
      if (!reg) return res.status(404).json({ message: "Registro no encontrado" });

      const schoolName = (await storage.getSetting("schoolName")) || "Centro Educativo";

      const settingsRaw = await storage.getSetting("timeSlots");
      const timeSlotsConfig: TimeSlotsConfig = settingsRaw ? JSON.parse(settingsRaw) : getDefaultTimeSlotsConfig();
      const regDate = new Date(reg.date + "T12:00:00");
      const regDayOfWeek = regDate.getDay() === 0 ? 7 : regDate.getDay();
      const daySlots = getTimeSlotsForDay(timeSlotsConfig, regDayOfWeek);
      const slot = daySlots.find((s: TimeSlotConfig) => s.id === reg.timeSlotId);
      const slotLabel = slot ? `${slot.start} - ${slot.end}` : `Periodo ${reg.timeSlotId}`;

      const dayNames = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
      const dayName = dayNames[regDayOfWeek] || "";

      const ts = new Date(reg.timestamp);
      const dateStr = ts.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
      const timeStr = ts.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

      const PDFDocument = (await import("pdfkit")).default;
      const doc = new PDFDocument({ size: "A4", margin: 50 });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="guardia_${id}_${reg.date}.pdf"`);
      doc.pipe(res);

      const primaryColor = "#4472C4";
      const textColor = "#1a1a2e";

      doc.rect(0, 0, doc.page.width, 100).fill(primaryColor);
      doc.fontSize(22).fillColor("#ffffff").text(schoolName, 50, 25, { align: "center" });
      doc.fontSize(12).text("DECLARACIÓN DE INCORPORACIÓN A GUARDIA", 50, 58, { align: "center" });

      doc.fillColor(textColor);
      let y = 130;

      doc.fontSize(10).fillColor("#666666").text(`Documento nº: GRD-${String(id).padStart(6, "0")}`, 50, y);
      doc.text(`Fecha de emisión: ${new Date().toLocaleString("es-ES")}`, 50, y, { align: "right" });
      y += 30;

      doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor("#e0e0e0").stroke();
      y += 30;

      doc.fontSize(12).fillColor(textColor).text(
        `D./Dña. ${reg.userName}, profesor/a del ${schoolName}, declara haberse incorporado ` +
        `a su puesto de guardia según los datos que se detallan a continuación:`,
        50, y, { width: doc.page.width - 100, align: "justify", lineGap: 4 }
      );
      y += 70;

      doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor("#e0e0e0").stroke();
      y += 20;

      doc.fontSize(14).fillColor(primaryColor).text("DATOS DE LA GUARDIA", 50, y);
      y += 30;

      const labelX = 50;
      const valueX = 220;

      const addField = (label: string, value: string) => {
        doc.fontSize(10).fillColor("#666666").text(label, labelX, y);
        doc.fontSize(11).fillColor(textColor).text(value, valueX, y);
        y += 24;
      };

      addField("Fecha:", `${dayName}, ${dateStr}`);
      addField("Hora de fichaje:", timeStr);
      addField("Periodo:", slotLabel);
      addField("Edificio:", `Edificio ${reg.buildingNumber}`);
      addField("Zona:", reg.zoneName);
      addField("Profesor/a:", reg.userName);

      if (reg.substitutionPlan) {
        y += 5;
        doc.fontSize(10).fillColor("#666666").text("Plan de sustitución:", labelX, y);
        doc.fontSize(11).fillColor("#2563eb").text(reg.substitutionPlan, valueX, y, {
          width: doc.page.width - valueX - 50,
        });
        y += 30;
      }

      if (reg.signatureData) {
        y += 15;
        doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor("#e0e0e0").stroke();
        y += 20;

        doc.fontSize(14).fillColor(primaryColor).text("FIRMA DEL PROFESOR/A", 50, y);
        y += 25;

        try {
          const base64Data = reg.signatureData.replace(/^data:image\/\w+;base64,/, "");
          const imgBuffer = Buffer.from(base64Data, "base64");
          doc.image(imgBuffer, 50, y, { width: 300, height: 120 });
          y += 130;
        } catch {
          doc.fontSize(10).fillColor("#999999").text("[Firma no disponible]", 50, y);
          y += 20;
        }
      }

      y += 30;
      doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor("#e0e0e0").stroke();
      y += 15;

      doc.fontSize(8).fillColor("#999999").text(
        `Este documento ha sido generado automáticamente por ${schoolName} — SafeExit. ` +
        `Registro ID: GRD-${String(id).padStart(6, "0")}. Fecha de generación: ${new Date().toLocaleString("es-ES")}.`,
        50, y, { width: doc.page.width - 100, align: "center" }
      );

      doc.end();
    } catch (error: any) {
      console.error("Error generating guard duty PDF:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: error.message });
      }
    }
  });

  // ==================== TEACHER ABSENCES ====================

  const absenceFileStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `absence-${Date.now()}${ext}`);
    },
  });
  const absenceUpload = multer({
    storage: absenceFileStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  app.post("/api/teacher-absences", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const { userId, date, notes, periods } = req.body;

      const targetUserId = user.role === "admin" ? (userId || user.id) : user.id;

      if (user.role !== "admin") {
        const absenceDate = new Date(date + "T00:00:00");
        const now = new Date();
        const diffMs = absenceDate.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        if (diffHours < 12) {
          return res.status(400).json({ message: "Las ausencias deben registrarse con al menos 12 horas de antelación. Contacte con un administrador." });
        }
      }

      if (!date || !periods || !Array.isArray(periods) || periods.length === 0) {
        return res.status(400).json({ message: "Fecha y periodos son obligatorios" });
      }

      const absence = await storage.createTeacherAbsence(
        { userId: targetUserId, date, createdBy: user.id, status: user.role === "admin" ? "confirmed" : "pending", notes: notes || null },
        periods
      );

      res.json(absence);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/teacher-absences", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const filters: any = {};
      if (req.query.dateFrom) filters.dateFrom = req.query.dateFrom;
      if (req.query.dateTo) filters.dateTo = req.query.dateTo;
      if (req.query.status) filters.status = req.query.status;

      if (user.role !== "admin") {
        filters.userId = user.id;
      } else if (req.query.userId) {
        filters.userId = Number(req.query.userId);
      }

      const absences = await storage.getTeacherAbsences(filters);
      res.json(absences);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/teacher-absences/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const absence = await storage.getTeacherAbsenceById(Number(req.params.id));
      if (!absence) return res.status(404).json({ message: "Ausencia no encontrada" });
      if (user.role !== "admin" && absence.userId !== user.id) {
        return res.status(403).json({ message: "No autorizado" });
      }
      res.json(absence);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/teacher-absences/:id/status", requireAuth, requirePermission("absences"), async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      if (!["pending", "confirmed", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Estado no válido" });
      }
      const updated = await storage.updateTeacherAbsenceStatus(Number(req.params.id), status);
      if (!updated) return res.status(404).json({ message: "Ausencia no encontrada" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/teacher-absences/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const absence = await storage.getTeacherAbsenceById(Number(req.params.id));
      if (!absence) return res.status(404).json({ message: "Ausencia no encontrada" });

      if (user.role !== "admin") {
        if (absence.userId !== user.id || absence.status !== "pending") {
          return res.status(403).json({ message: "No autorizado" });
        }
        const absenceDate = new Date(absence.date + "T00:00:00");
        const diffHours = (absenceDate.getTime() - Date.now()) / (1000 * 60 * 60);
        if (diffHours < 12) {
          return res.status(403).json({ message: "No se puede eliminar una ausencia con menos de 12 horas de antelación. Contacte con un administrador." });
        }
      }

      for (const att of (absence.attachments || [])) {
        const filePath = path.join(uploadsDir, path.basename(att.fileUrl));
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }

      await storage.deleteTeacherAbsence(Number(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/teacher-absences/:id/attachments", requireAuth, absenceUpload.single("file"), async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      if (!req.file) return res.status(400).json({ message: "No se ha subido ningún archivo" });
      const absence = await storage.getTeacherAbsenceById(Number(req.params.id));
      if (!absence) return res.status(404).json({ message: "Ausencia no encontrada" });
      if (user.role !== "admin" && absence.userId !== user.id) {
        return res.status(403).json({ message: "No autorizado" });
      }
      if (user.role !== "admin") {
        const absenceDate = new Date(absence.date + "T00:00:00");
        const diffHours = (absenceDate.getTime() - Date.now()) / (1000 * 60 * 60);
        if (diffHours < 12) {
          return res.status(403).json({ message: "No se puede modificar una ausencia con menos de 12 horas de antelación. Contacte con un administrador." });
        }
      }

      const fileUrl = `/uploads/${req.file.filename}`;
      const attachment = await storage.addAbsenceAttachment({
        absenceId: Number(req.params.id),
        fileName: req.file.originalname,
        fileUrl,
      });
      res.json(attachment);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/teacher-absence-attachments/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const attId = Number(req.params.id);
      const { teacherAbsenceAttachments } = await import("@shared/schema");
      const attachments = await db.select().from(teacherAbsenceAttachments).where(eq(teacherAbsenceAttachments.id, attId));
      
      if (attachments.length === 0) return res.status(404).json({ message: "Archivo no encontrado" });

      const absence = await storage.getTeacherAbsenceById(attachments[0].absenceId);
      if (absence && user.role !== "admin" && absence.userId !== user.id) {
        return res.status(403).json({ message: "No autorizado" });
      }
      if (absence && user.role !== "admin") {
        const absenceDate = new Date(absence.date + "T00:00:00");
        const diffHours = (absenceDate.getTime() - Date.now()) / (1000 * 60 * 60);
        if (diffHours < 12) {
          return res.status(403).json({ message: "No se puede modificar una ausencia con menos de 12 horas de antelación. Contacte con un administrador." });
        }
      }

      const filePath = path.join(uploadsDir, path.basename(attachments[0].fileUrl));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      await storage.deleteAbsenceAttachment(attId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/absences/unattended", requireAuth, requirePermission("absences"), async (req: Request, res: Response) => {
    try {
      const date = req.query.date as string;
      if (!date) return res.status(400).json({ message: "Fecha requerida" });
      const slots = await storage.getUnattendedSlots(date);
      res.json(slots);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/guard-coverages", requireAuth, requirePermission("absences"), async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const { absencePeriodId, guardUserId, date } = req.body;
      if (!absencePeriodId || !guardUserId || !date) {
        return res.status(400).json({ message: "Datos incompletos" });
      }
      const coverage = await storage.createGuardCoverage({
        absencePeriodId,
        guardUserId,
        date,
        assignedBy: user.id,
      });

      try {
        const allPeriods = await db.select().from(teacherAbsencePeriods);
        const period = allPeriods.find(p => p.id === absencePeriodId);
        if (period) {
          const allAbsences = await db.select().from(teacherAbsences);
          const absence = allAbsences.find(a => a.id === period.absenceId);
          const absentTeacher = absence ? await storage.getUser(absence.userId) : null;
          const group = await storage.getGroup(period.groupId);
          const settingsData = await storage.getAllSettings();
          let timeSlotsConfig = getDefaultTimeSlotsConfig();
          if (settingsData.timeSlots) {
            try { timeSlotsConfig = JSON.parse(settingsData.timeSlots); } catch {}
          }
          const d = new Date(date + "T00:00:00");
          const dayOfWeek = d.getDay() === 0 ? 7 : d.getDay();
          const daySlots = getTimeSlotsForDay(timeSlotsConfig, dayOfWeek);
          const slot = daySlots.find(s => s.id === period.timeSlotId);
          const slotLabel = slot ? `${slot.start} - ${slot.end}` : `Tramo ${period.timeSlotId}`;
          const groupName = group?.name || "?";
          const absentName = absentTeacher?.fullName || "profesor ausente";
          const dayNames = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
          const dateStr = `${dayNames[dayOfWeek] || ""} ${date.split("-").reverse().join("/")}`;

          await storage.createNotification({
            senderId: user.id,
            title: `Guardia asignada — ${groupName}`,
            message: `Se te ha asignado cubrir la guardia del grupo ${groupName} en el tramo ${slotLabel} (${dateStr}), sustituyendo a ${absentName}.`,
            targetType: "user",
            targetId: guardUserId,
          });
        }
      } catch (notifErr) {
        console.error("Error sending guard coverage notification:", notifErr);
      }

      res.json(coverage);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/guard-coverages", requireAuth, async (req: Request, res: Response) => {
    try {
      const date = req.query.date as string;
      if (!date) return res.status(400).json({ message: "Fecha requerida" });
      const coverages = await storage.getGuardCoverages(date);
      res.json(coverages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/guard-coverages/:id", requireAuth, requirePermission("absences"), async (req: Request, res: Response) => {
    try {
      await storage.deleteGuardCoverage(Number(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== HOUR ADVANCEMENTS ====================

  app.post("/api/hour-advancements", requireAuth, requirePermission("absences"), async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const { date, groupId, originalSlotId, targetSlotId, teacherUserId, absencePeriodId } = req.body;
      if (!date || !groupId || !originalSlotId || !targetSlotId || !teacherUserId) {
        return res.status(400).json({ message: "Datos incompletos" });
      }
      if (originalSlotId === targetSlotId) {
        return res.status(400).json({ message: "El tramo origen y destino no pueden ser iguales" });
      }
      if (targetSlotId <= originalSlotId) {
        return res.status(400).json({ message: "El tramo destino debe ser posterior al tramo origen" });
      }

      const group = await storage.getGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Grupo no encontrado" });
      }
      if (group.allowAdvancement === false) {
        return res.status(400).json({ message: `El grupo "${group.name}" no permite adelantos de horas` });
      }

      const existing = await storage.getHourAdvancements(date);
      const conflict = existing.find((a: any) =>
        a.groupId === groupId && (a.originalSlotId === originalSlotId || a.targetSlotId === targetSlotId)
      );
      if (conflict) {
        return res.status(400).json({ message: "Ya existe un adelanto que afecta a uno de esos tramos para este grupo" });
      }

      const advancement = await storage.createHourAdvancement({
        date,
        groupId,
        originalSlotId,
        targetSlotId,
        teacherUserId,
        absencePeriodId: absencePeriodId || null,
        createdBy: user.id,
      });
      res.json(advancement);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/hour-advancements", requireAuth, async (req: Request, res: Response) => {
    try {
      const date = req.query.date as string;
      if (!date) return res.status(400).json({ message: "Fecha requerida" });
      const advancements = await storage.getHourAdvancements(date);
      res.json(advancements);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/hour-advancements/:id", requireAuth, requirePermission("absences"), async (req: Request, res: Response) => {
    try {
      await storage.deleteHourAdvancement(Number(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/group-free-slots", requireAuth, async (req: Request, res: Response) => {
    try {
      const date = req.query.date as string;
      const groupId = Number(req.query.groupId);
      if (!date || !groupId) return res.status(400).json({ message: "Fecha y grupo requeridos" });
      const freeSlots = await storage.getGroupFreeSlots(date, groupId);
      res.json(freeSlots);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/authorize-early-exit", requireAuth, requirePermission("absences"), async (req: Request, res: Response) => {
    try {
      const { date, groupId, fromSlot } = req.body;
      if (!date || !groupId || !fromSlot) {
        return res.status(400).json({ message: "Datos incompletos" });
      }

      const freeSlots = await storage.getGroupFreeSlots(date, groupId);
      const allClassSlots = (await import("@shared/schema")).DEFAULT_TIME_SLOTS
        .filter((s: any) => !s.isBreak)
        .map((s: any) => s.id)
        .sort((a: number, b: number) => a - b);

      const fromIndex = allClassSlots.indexOf(fromSlot);
      if (fromIndex === -1) {
        return res.status(400).json({ message: "Tramo no válido" });
      }

      const slotsToAuthorize = allClassSlots.slice(fromIndex);
      const allFree = slotsToAuthorize.every((s: number) => freeSlots.includes(s));
      if (!allFree) {
        return res.status(400).json({ message: "No todas las horas desde ese tramo están libres" });
      }

      const todayStr = date;
      const group = await storage.getGroup(groupId);
      if (!group) return res.status(404).json({ message: "Grupo no encontrado" });

      for (const slotId of slotsToAuthorize) {
        await storage.setGroupSchedule(groupId, todayStr, slotId, true);
      }

      res.json({
        success: true,
        message: `Salida autorizada para ${group.name} desde el tramo ${fromSlot}`,
        authorizedSlots: slotsToAuthorize,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== TEACHER SCHEDULES ====================

  app.get("/api/teacher-schedules", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const userId = req.query.userId ? Number(req.query.userId) : undefined;
      if (userId && user.role !== "admin") {
        return res.status(403).json({ message: "No autorizado" });
      }
      const schedules = userId
        ? await storage.getTeacherSchedulesByUser(userId)
        : user.role === "admin"
          ? await storage.getAllTeacherSchedules()
          : await storage.getTeacherSchedulesByUser(user.id);
      const allUsers = await storage.getAllUsers();
      const allGroups = await storage.getAllGroups();
      const enriched = schedules.map(s => ({
        ...s,
        teacherName: allUsers.find(u => u.id === s.userId)?.fullName || "?",
        groupName: allGroups.find(g => g.id === s.groupId)?.name || "?",
      }));
      res.json(enriched);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/teacher-schedules/:userId", requireAuth, requirePermission("schedules"), async (req: Request, res: Response) => {
    try {
      const userId = Number(req.params.userId);
      const entries = req.body;
      if (!Array.isArray(entries)) {
        return res.status(400).json({ message: "Se esperaba un array de entradas" });
      }
      for (const entry of entries) {
        if (!entry.dayOfWeek || !entry.timeSlotId || !entry.groupId) {
          return res.status(400).json({ message: "Cada entrada necesita dayOfWeek, timeSlotId y groupId" });
        }
        if (entry.dayOfWeek < 1 || entry.dayOfWeek > 5) {
          return res.status(400).json({ message: "dayOfWeek debe ser entre 1 (lunes) y 5 (viernes)" });
        }
      }
      const mapped = entries.map((e: any) => ({
        userId,
        dayOfWeek: e.dayOfWeek,
        timeSlotId: e.timeSlotId,
        groupId: e.groupId,
      }));
      const result = await storage.setTeacherSchedules(userId, mapped);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/teacher-schedules/:userId", requireAuth, requirePermission("schedules"), async (req: Request, res: Response) => {
    try {
      await storage.deleteTeacherSchedulesByUser(Number(req.params.userId));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/teacher-schedules/template", requireAuth, requirePermission("schedules"), (_req: Request, res: Response) => {
    const wb = XLSX.utils.book_new();
    const headers = [
      ["Profesor", "Día", "Tramo", "Grupo"],
      ["María García Fernández", "Lunes", "1", "1A"],
      ["María García Fernández", "Lunes", "2", "2B"],
      ["María García Fernández", "Martes", "1", "1A"],
      ["Carlos López Martín", "Miércoles", "3", "3A"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    ws["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 10 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws, "Horarios");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=plantilla_horarios.xlsx");
    res.send(Buffer.from(buf));
  });

  app.post("/api/teacher-schedules/import", requireAuth, requirePermission("schedules"), upload.single("file"), async (req: Request, res: Response) => {
    const filePath = req.file?.path;
    try {
      if (!req.file || !filePath) return res.status(400).json({ message: "No se subió archivo" });

      const wb = XLSX.readFile(filePath);
      const sheetName = wb.SheetNames[0];
      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);

      if (!rows.length) return res.status(400).json({ message: "El archivo está vacío" });

      const requiredCols = ["Profesor", "Día", "Tramo", "Grupo"];
      const headersFound = Object.keys(rows[0]);
      const missing = requiredCols.filter(c => !headersFound.includes(c));
      if (missing.length) {
        return res.status(400).json({ message: `Columnas requeridas no encontradas: ${missing.join(", ")}. Descarga la plantilla para ver el formato correcto.` });
      }

      const dayNameMap: Record<string, number> = {
        "lunes": 1, "martes": 2, "miércoles": 3, "miercoles": 3,
        "jueves": 4, "viernes": 5,
      };

      const allUsers = await storage.getAllUsers();
      const allGroups = await storage.getAllGroups();

      const byTeacher = new Map<number, { dayOfWeek: number; timeSlotId: number; groupId: number; userId: number }[]>();
      const errors: string[] = [];
      let imported = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;
        const teacherName = String(row["Profesor"] || "").trim();
        const dayStr = String(row["Día"] || row["Dia"] || "").trim().toLowerCase();
        const slotId = parseInt(String(row["Tramo"] || ""));
        const groupName = String(row["Grupo"] || "").trim();

        if (!teacherName || !dayStr || !slotId || !groupName) {
          errors.push(`Fila ${rowNum}: campos incompletos`);
          continue;
        }

        const dayOfWeek = dayNameMap[dayStr] || parseInt(dayStr);
        if (!dayOfWeek || dayOfWeek < 1 || dayOfWeek > 5) {
          errors.push(`Fila ${rowNum}: día no válido "${row["Día"] || row["Dia"]}"`);
          continue;
        }

        const teacher = allUsers.find(u => u.fullName.toLowerCase() === teacherName.toLowerCase());
        if (!teacher) {
          errors.push(`Fila ${rowNum}: profesor "${teacherName}" no encontrado`);
          continue;
        }

        const group = allGroups.find(g => g.name.toLowerCase() === groupName.toLowerCase());
        if (!group) {
          errors.push(`Fila ${rowNum}: grupo "${groupName}" no encontrado`);
          continue;
        }

        if (!byTeacher.has(teacher.id)) {
          byTeacher.set(teacher.id, []);
        }
        byTeacher.get(teacher.id)!.push({
          userId: teacher.id,
          dayOfWeek,
          timeSlotId: slotId,
          groupId: group.id,
        });
      }

      for (const [userId, entries] of byTeacher) {
        await storage.setTeacherSchedules(userId, entries);
        imported += entries.length;
      }

      res.json({
        message: `${imported} entrada(s) de horario importada(s) para ${byTeacher.size} profesor(es)`,
        imported,
        teachers: byTeacher.size,
        errors,
      });
    } catch (error: any) {
      res.status(500).json({ message: `Error procesando archivo: ${error.message}` });
    } finally {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  });

  const ALLOWED_UPLOAD_TYPES = [
    "application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain", "text/csv",
  ];
  const safeFileFilter = (_req: any, file: any, cb: any) => {
    if (ALLOWED_UPLOAD_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de archivo no permitido") as any, false);
    }
  };

  const notifUpload = multer({
    storage: multerStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: safeFileFilter,
  });

  app.post("/api/notifications", requireAuth, requirePermission("notifications"), notifUpload.single("file"), async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const { title, message, targetType, targetId } = req.body;
      if (!title || !message || !targetType) return res.status(400).json({ message: "Título, mensaje y destinatario requeridos" });
      if (!["all", "group", "user"].includes(targetType)) return res.status(400).json({ message: "Tipo de destinatario inválido" });
      if ((targetType === "group" || targetType === "user") && !targetId) return res.status(400).json({ message: "Se requiere ID de destinatario" });
      const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;
      const fileName = req.file ? req.file.originalname : null;
      const notif = await storage.createNotification({
        senderId: user.id,
        title,
        message,
        targetType,
        targetId: targetId ? parseInt(targetId) : null,
        fileUrl,
        fileName,
      });
      res.json(notif);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/notifications", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const notifs = await storage.getNotificationsForUser(user.id, user.role, user.groupId);
      res.json(notifs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/notifications/sent", requireAuth, requirePermission("notifications"), async (_req: Request, res: Response) => {
    try {
      const notifs = await storage.getSentNotifications();
      res.json(notifs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/notifications/:id/read", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const notifId = parseInt(req.params.id);
      const userNotifs = await storage.getNotificationsForUser(user.id, user.role, user.groupId);
      if (!userNotifs.find(n => n.id === notifId)) {
        return res.status(403).json({ message: "Sin acceso a esta notificación" });
      }
      await storage.markNotificationRead(notifId, user.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/notifications/unread-count", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const count = await storage.getUnreadNotificationCount(user.id, user.role, user.groupId);
      res.json({ count });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/notifications/:id", requireAuth, requirePermission("notifications"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteNotification(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const chatUpload = multer({
    storage: multerStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: safeFileFilter,
  });

  app.get("/api/chat/groups", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const groupIds = await storage.getGroupsForChat(user.id, user.role, user.groupId);
      const allGroups = await storage.getAllGroups();
      const chatGroups = allGroups.filter(g => groupIds.includes(g.id));
      const unreadCounts = await storage.getUnreadChatCounts(user.id, groupIds);
      res.json(chatGroups.map(g => ({
        ...g,
        unreadCount: unreadCounts[g.id] || 0,
      })));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/chat/:groupId/messages", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const groupId = parseInt(req.params.groupId);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const beforeId = req.query.beforeId ? parseInt(req.query.beforeId as string) : undefined;
      const groupIds = await storage.getGroupsForChat(user.id, user.role, user.groupId);
      if (!groupIds.includes(groupId)) return res.status(403).json({ message: "Sin acceso a este grupo" });
      const messages = await storage.getChatMessages(groupId, limit, beforeId);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/chat/:groupId/messages", requireAuth, chatUpload.single("file"), async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const groupId = parseInt(req.params.groupId);
      const { message } = req.body;
      const groupIds = await storage.getGroupsForChat(user.id, user.role, user.groupId);
      if (!groupIds.includes(groupId)) return res.status(403).json({ message: "Sin acceso a este grupo" });
      if (user.role !== "admin") {
        const group = await storage.getGroup(groupId);
        if (group && !group.chatBidirectional) {
          return res.status(403).json({ message: "El chat de este grupo es solo lectura para profesores" });
        }
      }
      if (!message && !req.file) return res.status(400).json({ message: "Mensaje o archivo requerido" });
      const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;
      const fileName = req.file ? req.file.originalname : null;
      const chatMsg = await storage.createChatMessage({
        groupId,
        senderId: user.id,
        message: message || "",
        fileUrl,
        fileName,
      });
      res.json(chatMsg);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/chat/:groupId/read", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const groupId = parseInt(req.params.groupId);
      const groupIds = await storage.getGroupsForChat(user.id, user.role, user.groupId);
      if (!groupIds.includes(groupId)) {
        return res.status(403).json({ message: "Sin acceso a este grupo" });
      }
      await storage.markChatRead(groupId, user.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/chat/unread-counts", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const groupIds = await storage.getGroupsForChat(user.id, user.role, user.groupId);
      const counts = await storage.getUnreadChatCounts(user.id, groupIds);
      res.json(counts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/groups/:id/chat-bidirectional", requireAuth, requirePermission("chat"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { chatBidirectional } = req.body;
      if (typeof chatBidirectional !== "boolean") return res.status(400).json({ message: "Valor inválido" });
      const updated = await storage.updateGroup(id, { chatBidirectional });
      if (!updated) return res.status(404).json({ message: "Grupo no encontrado" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
