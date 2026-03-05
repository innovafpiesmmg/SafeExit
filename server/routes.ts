import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { differenceInYears } from "date-fns";
import session from "express-session";
import memorystore from "memorystore";
import bcrypt from "bcrypt";
import { TIME_SLOTS, getDefaultTimeSlotsConfig, getTimeSlotsForDay, type TimeSlotsConfig, type TimeSlotConfig } from "@shared/schema";
import { sendLateArrivalEmail, sendEarlyExitEmail, testSmtpConnection } from "./email";
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

  function requireAuth(req: Request, res: Response, next: Function) {
    if (!(req.session as any).userId) {
      return res.status(401).json({ message: "No autenticado" });
    }
    next();
  }

  function requireAdmin(req: Request, res: Response, next: Function) {
    if ((req.session as any).role !== "admin") {
      return res.status(403).json({ message: "Acceso denegado" });
    }
    next();
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
      res.json({ id: user.id, username: user.username, fullName: user.fullName, role: user.role, groupId: user.groupId });
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
    res.json({ id: user.id, username: user.username, fullName: user.fullName, role: user.role, groupId: user.groupId });
  });

  app.get("/api/guards", requireAuth, requireAdmin, async (_req, res) => {
    const guards = await storage.getGuards();
    res.json(guards.map(g => ({ id: g.id, username: g.username, fullName: g.fullName, role: g.role, groupId: g.groupId })));
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

  app.get("/api/groups", requireAuth, async (_req, res) => {
    const allGroups = await storage.getAllGroups();
    res.json(allGroups);
  });

  app.post("/api/groups", requireAuth, requireAdmin, async (req, res) => {
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

  app.patch("/api/groups/:id", requireAuth, requireAdmin, async (req, res) => {
    const group = await storage.updateGroup(parseInt(req.params.id), req.body);
    if (!group) return res.status(404).json({ message: "Grupo no encontrado" });
    res.json(group);
  });

  app.delete("/api/groups/:id", requireAuth, requireAdmin, async (req, res) => {
    await storage.deleteGroup(parseInt(req.params.id));
    res.json({ message: "Grupo eliminado" });
  });

  app.get("/api/students", requireAuth, async (_req, res) => {
    const allStudents = await storage.getAllStudents();
    res.json(allStudents);
  });

  app.get("/api/students/template", requireAuth, requireAdmin, (_req, res) => {
    const wb = XLSX.utils.book_new();
    const headers = [
      ["Nombre", "Apellidos", "Fecha_Nacimiento", "Curso", "Grupo", "Autorizacion_Paterna", "Autorizacion_Guagua", "Email"],
      ["María", "García Fernández", "2010-03-15", "1 ESO", "1A", "SI", "NO", "familia.garcia@ejemplo.com"],
      ["Carlos", "López Martín", "2005-07-22", "2 BACH", "2 BACH B", "SI", "SI", ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    ws["!cols"] = [
      { wch: 15 }, { wch: 25 }, { wch: 18 },
      { wch: 15 }, { wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Alumnos");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=plantilla_alumnos.xlsx");
    res.send(Buffer.from(buf));
  });

  app.post("/api/students/import", requireAuth, requireAdmin, upload.single("file"), async (req, res) => {
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
            email,
          });
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

  app.post("/api/students", requireAuth, requireAdmin, async (req, res) => {
    try {
      const student = await storage.createStudent(req.body);
      res.json(student);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/students/:id", requireAuth, requireAdmin, async (req, res) => {
    const student = await storage.updateStudent(parseInt(req.params.id), req.body);
    if (!student) return res.status(404).json({ message: "Alumno no encontrado" });
    res.json(student);
  });

  app.delete("/api/students/:id", requireAuth, requireAdmin, async (req, res) => {
    await storage.deleteStudent(parseInt(req.params.id));
    res.json({ message: "Alumno eliminado" });
  });

  app.post("/api/upload-photo", requireAuth, upload.single("photo"), (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No se subió imagen" });
    res.json({ url: `/uploads/${req.file.filename}` });
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

  app.post("/api/schedules", requireAuth, requireAdmin, async (req, res) => {
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
      const { qrCode } = req.body;
      const userId = (req.session as any).userId;

      const student = await storage.getStudentByQr(qrCode);
      if (!student) {
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

      const BUS_SLOTS = [6, 12];
      if (BUS_SLOTS.includes(timeSlot) && student.busAuthorization) {
        const slotLabel = timeSlot === 6 ? "6a hora mañana" : "6a hora tarde";
        const reason = `Salida por guagua - ${slotLabel}`;
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

  app.get("/api/exit-logs", requireAuth, requireAdmin, async (req, res) => {
    const { dateFrom, dateTo, groupId, studentName } = req.query;
    const logs = await storage.getExitLogs({
      dateFrom: dateFrom as string,
      dateTo: dateTo as string,
      groupId: groupId ? parseInt(groupId as string) : undefined,
      studentName: studentName as string,
    });
    res.json(logs);
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

  app.put("/api/settings", requireAuth, requireAdmin, async (req, res) => {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ message: "Clave requerida" });
    await storage.setSetting(key, String(value));
    const settings = await storage.getAllSettings();
    res.json(settings);
  });

  app.get("/api/exit-logs/export", requireAuth, requireAdmin, async (req, res) => {
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
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/students/generate-tokens", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const count = await storage.generateCarnetTokens();
      res.json({ message: `Tokens generados para ${count} alumno(s)`, count });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/reset-academic-year", requireAuth, requireAdmin, async (req, res) => {
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

  app.get("/api/late-arrivals/export", requireAuth, requireAdmin, async (req, res) => {
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

  app.post("/api/settings/test-smtp", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const result = await testSmtpConnection();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/students/:id/authorized-pickups", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "ID inválido" });
      const pickups = await storage.getAuthorizedPickups(id);
      res.json(pickups);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/students/:id/authorized-pickups", requireAuth, requireAdmin, async (req, res) => {
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
      const { studentId, documentId } = req.body;
      const userId = (req.session as any).userId;
      if (!studentId || !documentId) {
        return res.status(400).json({ message: "Alumno y DNI/NIE son obligatorios" });
      }
      const id = parseInt(studentId);
      if (isNaN(id)) return res.status(400).json({ message: "ID de alumno inválido" });
      const student = await storage.getStudent(id);
      if (!student) return res.status(404).json({ message: "Alumno no encontrado" });

      const group = await storage.getGroup(student.groupId);
      const age = Math.floor((Date.now() - new Date(student.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));

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
        const exitLog = await storage.createExitLog({
          studentId: student.id,
          result: "DENEGADO",
          reason: `Salida acompañada denegada - DNI/NIE ${documentId.trim()} no autorizado`,
          verifiedBy: userId,
        });

        await storage.createIncident({
          exitLogId: exitLog.id,
          note: `Intento de recogida no autorizada. DNI/NIE presentado: ${documentId.trim()}. Alumno: ${student.firstName} ${student.lastName}.`,
          createdBy: userId,
        });

        res.json({
          result: "DENEGADO",
          reason: `DNI/NIE ${documentId.trim()} no está autorizado para recoger a este alumno`,
          student: {
            firstName: student.firstName,
            lastName: student.lastName,
            course: student.course,
            photoUrl: student.photoUrl,
            age,
          },
          logId: exitLog.id,
          incidentCreated: true,
        });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
