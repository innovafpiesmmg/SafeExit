import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { differenceInYears } from "date-fns";
import session from "express-session";
import memorystore from "memorystore";
import bcrypt from "bcrypt";
import { TIME_SLOTS } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";

const uploadsDir = path.resolve("client/public/uploads");
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

function getCurrentTimeSlot(): number {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  const slotRanges = [
    { id: 1, start: 480, end: 535 },
    { id: 2, start: 535, end: 590 },
    { id: 3, start: 590, end: 645 },
    { id: 4, start: 645, end: 675 },
    { id: 5, start: 675, end: 730 },
    { id: 6, start: 730, end: 785 },
    { id: 7, start: 785, end: 840 },
    { id: 8, start: 840, end: 895 },
    { id: 9, start: 895, end: 950 },
    { id: 10, start: 950, end: 1005 },
    { id: 11, start: 1005, end: 1060 },
    { id: 12, start: 1060, end: 1115 },
  ];

  for (const slot of slotRanges) {
    if (totalMinutes >= slot.start && totalMinutes < slot.end) {
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
      cookie: { maxAge: 24 * 60 * 60 * 1000 },
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
      res.json({ id: user.id, username: user.username, fullName: user.fullName, role: user.role });
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
    res.json({ id: user.id, username: user.username, fullName: user.fullName, role: user.role });
  });

  app.get("/api/guards", requireAuth, requireAdmin, async (_req, res) => {
    const guards = await storage.getGuards();
    res.json(guards.map(g => ({ id: g.id, username: g.username, fullName: g.fullName, role: g.role })));
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
        const base = `${firstName.toLowerCase().replace(/\s+/g, "")}${lastName.toLowerCase().split(" ")[0].replace(/\s+/g, "")}`;
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
      const { firstName, lastName } = req.body;
      if (!firstName || !lastName) return res.status(400).json({ message: "Nombre y apellidos requeridos" });

      const guardPassword = await storage.getSetting("guardPassword");
      if (!guardPassword) return res.status(400).json({ message: "Primero define la contraseña común de los profesores de guardia" });

      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const base = `${firstName.trim().toLowerCase().replace(/\s+/g, "")}${lastName.trim().toLowerCase().split(" ")[0].replace(/\s+/g, "")}`;
      let username = base;
      let counter = 1;
      while (await storage.getUserByUsername(username)) {
        username = `${base}${counter}`;
        counter++;
      }

      const hashedPassword = await bcrypt.hash(guardPassword, 10);
      const user = await storage.createUser({ username, password: hashedPassword, fullName, role: "guard" });
      res.json({ id: user.id, username: user.username, fullName: user.fullName, role: user.role });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/guards/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { firstName, lastName } = req.body;
      if (!firstName || !lastName) return res.status(400).json({ message: "Nombre y apellidos requeridos" });
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const user = await storage.updateUser(id, { fullName });
      if (!user) return res.status(404).json({ message: "Profesor no encontrado" });
      res.json({ id: user.id, username: user.username, fullName: user.fullName, role: user.role });
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
      ["Nombre", "Apellidos", "Fecha_Nacimiento", "Curso", "Grupo", "Autorizacion_Paterna", "Autorizacion_Guagua"],
      ["María", "García Fernández", "2010-03-15", "1 ESO", "1A", "SI", "NO"],
      ["Carlos", "López Martín", "2005-07-22", "2 BACH", "2 BACH B", "SI", "SI"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    ws["!cols"] = [
      { wch: 15 }, { wch: 25 }, { wch: 18 },
      { wch: 15 }, { wch: 12 }, { wch: 22 }, { wch: 22 },
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
        const dob = String(row["Fecha_Nacimiento"] || "").trim();
        const course = String(row["Curso"] || "").trim();
        const groupName = String(row["Grupo"] || "").trim();
        const parentalAuth = String(row["Autorizacion_Paterna"] || "").trim().toUpperCase();
        const busAuth = String(row["Autorizacion_Guagua"] || "").trim().toUpperCase();

        if (!firstName || !lastName) {
          errors.push(`Fila ${rowNum}: Nombre o Apellidos vacíos`);
          continue;
        }
        if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
          errors.push(`Fila ${rowNum}: Fecha inválida (usar YYYY-MM-DD). Valor: "${dob}"`);
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

  app.get("/api/schedules/:groupId", requireAuth, async (req, res) => {
    const schedules = await storage.getGroupSchedules(parseInt(req.params.groupId));
    res.json(schedules);
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
      const timeSlot = getCurrentTimeSlot();

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
        const log = await storage.createExitLog({
          studentId: student.id,
          result: "AUTORIZADO",
          reason: `Salida por guagua - ${slotLabel}`,
          verifiedBy: userId,
        });
        return res.json({
          result: "AUTORIZADO",
          reason: `Salida por guagua - ${slotLabel}`,
          student: { id: student.id, firstName: student.firstName, lastName: student.lastName, photoUrl: student.photoUrl, course: student.course, groupId: student.groupId, age },
          logId: log.id,
        });
      }

      const schedules = await storage.getGroupSchedules(student.groupId);
      const currentSchedule = schedules.find(
        (s) => s.dayOfWeek === dayOfWeek && s.timeSlot === timeSlot
      );

      if (currentSchedule && currentSchedule.exitAllowed) {
        const log = await storage.createExitLog({
          studentId: student.id,
          result: "AUTORIZADO",
          reason: `Permiso grupal - Tramo ${timeSlot}`,
          verifiedBy: userId,
        });
        return res.json({
          result: "AUTORIZADO",
          reason: `Permiso grupal - Tramo ${timeSlot}`,
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
    const logs = await storage.getExitLogs({
      dateFrom: dateFrom as string,
      dateTo: dateTo as string,
      groupId: groupId ? parseInt(groupId as string) : undefined,
      studentName: studentName as string,
    });

    const csvHeader = "ID,Alumno,Grupo,Fecha,Hora,Resultado,Motivo,Verificado por\n";
    const csvRows = logs.map(log => {
      const date = new Date(log.timestamp);
      return `${log.id},"${log.studentName}","${log.groupName}","${date.toLocaleDateString("es-ES")}","${date.toLocaleTimeString("es-ES")}","${log.result}","${log.reason}","${log.verifierName}"`;
    }).join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="salidas_${new Date().toISOString().split("T")[0]}.csv"`);
    res.send("\uFEFF" + csvHeader + csvRows);
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

  return httpServer;
}
