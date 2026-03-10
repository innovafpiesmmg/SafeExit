import { eq, and, ne, desc, gte, lte, ilike, or } from "drizzle-orm";
import { db } from "./db";
import {
  users, students, groups, groupSchedules, exitLogs, incidents, appSettings, lateArrivals, authorizedPickups, academicArchives,
  guardZones, guardDutyAssignments, guardDutyRegistrations,
  teacherAbsences, teacherAbsencePeriods, teacherAbsenceAttachments, guardCoverages, hourAdvancements, teacherSchedules,
  type User, type InsertUser,
  type Student, type InsertStudent,
  type Group, type InsertGroup,
  type GroupSchedule, type InsertGroupSchedule,
  type ExitLog, type InsertExitLog,
  type Incident, type InsertIncident,
  type LateArrival, type InsertLateArrival,
  type AuthorizedPickup, type InsertAuthorizedPickup,
  type AcademicArchive,
  type GuardZone, type InsertGuardZone,
  type GuardDutyAssignment, type InsertGuardDutyAssignment,
  type GuardDutyRegistration, type InsertGuardDutyRegistration,
  type TeacherAbsence, type InsertTeacherAbsence,
  type TeacherAbsencePeriod, type InsertTeacherAbsencePeriod,
  type TeacherAbsenceAttachment, type InsertTeacherAbsenceAttachment,
  type GuardCoverage, type InsertGuardCoverage,
  type HourAdvancement, type InsertHourAdvancement,
  type TeacherSchedule, type InsertTeacherSchedule,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;

  getAllGroups(): Promise<Group[]>;
  getGroup(id: number): Promise<Group | undefined>;
  createGroup(group: InsertGroup): Promise<Group>;
  updateGroup(id: number, group: Partial<InsertGroup>): Promise<Group | undefined>;
  deleteGroup(id: number): Promise<void>;

  getAllStudents(): Promise<Student[]>;
  getStudent(id: number): Promise<Student | undefined>;
  getStudentByQr(qrCode: string): Promise<Student | undefined>;
  getStudentByCarnetToken(token: string): Promise<Student | undefined>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(id: number, student: Partial<InsertStudent>): Promise<Student | undefined>;
  deleteStudent(id: number): Promise<void>;
  getStudentsByGroup(groupId: number): Promise<Student[]>;
  generateCarnetTokens(): Promise<number>;

  getGroupSchedules(groupId: number): Promise<GroupSchedule[]>;
  getGroupSchedulesByDate(groupId: number, date: string): Promise<GroupSchedule[]>;
  setGroupSchedule(groupId: number, date: string, timeSlot: number, exitAllowed: boolean): Promise<void>;
  bulkSetGroupSchedules(schedules: InsertGroupSchedule[]): Promise<void>;
  getScheduleDates(groupId: number): Promise<string[]>;

  createExitLog(log: InsertExitLog): Promise<ExitLog>;
  getExitLogs(filters?: { dateFrom?: string; dateTo?: string; groupId?: number; studentName?: string }): Promise<any[]>;
  getExitLog(id: number): Promise<ExitLog | undefined>;
  getRecentExitLogs(limit: number): Promise<any[]>;
  getExitStats(): Promise<{ total: number; authorized: number; denied: number; today: number }>;

  createIncident(incident: InsertIncident): Promise<Incident>;
  getIncidents(): Promise<Incident[]>;

  getSetting(key: string): Promise<string | undefined>;
  setSetting(key: string, value: string): Promise<void>;
  getAllSettings(): Promise<Record<string, string>>;

  getGuards(): Promise<User[]>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<void>;
  updateAllGuardPasswords(hashedPassword: string): Promise<void>;
  archiveAcademicYear(adminUserId: number, yearName: string): Promise<AcademicArchive>;
  resetAcademicYear(adminUserId: number): Promise<void>;
  getAcademicArchives(): Promise<AcademicArchive[]>;
  getAcademicArchive(id: number): Promise<AcademicArchive | undefined>;
  deleteAcademicArchive(id: number): Promise<void>;

  createLateArrival(data: InsertLateArrival): Promise<LateArrival>;
  getLateArrivals(filters?: { dateFrom?: string; dateTo?: string; groupId?: number; studentName?: string }): Promise<any[]>;
  getTodayLateArrivals(): Promise<any[]>;

  getAuthorizedPickups(studentId: number): Promise<AuthorizedPickup[]>;
  setAuthorizedPickups(studentId: number, pickups: InsertAuthorizedPickup[]): Promise<AuthorizedPickup[]>;
  verifyPickupAuthorization(studentId: number, documentId: string): Promise<AuthorizedPickup | null>;

  getAllGuardZones(): Promise<GuardZone[]>;
  getGuardZonesByBuilding(buildingNumber: number): Promise<GuardZone[]>;
  getGuardZone(id: number): Promise<GuardZone | undefined>;
  createGuardZone(zone: InsertGuardZone): Promise<GuardZone>;
  updateGuardZone(id: number, zone: Partial<InsertGuardZone>): Promise<GuardZone | undefined>;
  deleteGuardZone(id: number): Promise<void>;

  getGuardDutyAssignments(dayOfWeek: number): Promise<GuardDutyAssignment[]>;
  getAllGuardDutyAssignments(): Promise<GuardDutyAssignment[]>;
  createGuardDutyAssignment(assignment: InsertGuardDutyAssignment): Promise<GuardDutyAssignment>;
  deleteGuardDutyAssignment(id: number): Promise<void>;
  bulkSetGuardDutyAssignments(dayOfWeek: number, assignments: InsertGuardDutyAssignment[]): Promise<GuardDutyAssignment[]>;

  getGuardDutyRegistrations(filters?: { dateFrom?: string; dateTo?: string; buildingNumber?: number; zoneId?: number; userId?: number }): Promise<any[]>;
  createGuardDutyRegistration(reg: InsertGuardDutyRegistration): Promise<GuardDutyRegistration>;
  getGuardDutyRegistrationsByUserAndDate(userId: number, date: string): Promise<GuardDutyRegistration[]>;

  createTeacherAbsence(absence: InsertTeacherAbsence, periods: Omit<InsertTeacherAbsencePeriod, "absenceId">[]): Promise<TeacherAbsence>;
  getTeacherAbsences(filters?: { dateFrom?: string; dateTo?: string; userId?: number; status?: string }): Promise<any[]>;
  getTeacherAbsenceById(id: number): Promise<any>;
  updateTeacherAbsenceStatus(id: number, status: string): Promise<TeacherAbsence | undefined>;
  deleteTeacherAbsence(id: number): Promise<void>;
  getAbsenceAttachments(absenceId: number): Promise<TeacherAbsenceAttachment[]>;
  addAbsenceAttachment(data: InsertTeacherAbsenceAttachment): Promise<TeacherAbsenceAttachment>;
  deleteAbsenceAttachment(id: number): Promise<void>;
  getUnattendedSlots(date: string): Promise<any[]>;
  createGuardCoverage(data: InsertGuardCoverage): Promise<GuardCoverage>;
  getGuardCoverages(date: string): Promise<any[]>;
  deleteGuardCoverage(id: number): Promise<void>;
  createHourAdvancement(data: InsertHourAdvancement): Promise<HourAdvancement>;
  getHourAdvancements(date: string): Promise<any[]>;
  deleteHourAdvancement(id: number): Promise<void>;
  getGroupFreeSlots(date: string, groupId: number): Promise<number[]>;

  getAllTeacherSchedules(): Promise<TeacherSchedule[]>;
  getTeacherSchedulesByUser(userId: number): Promise<TeacherSchedule[]>;
  getTeacherSchedulesByDay(dayOfWeek: number): Promise<TeacherSchedule[]>;
  setTeacherSchedules(userId: number, entries: InsertTeacherSchedule[]): Promise<TeacherSchedule[]>;
  deleteTeacherSchedulesByUser(userId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getAllGroups(): Promise<Group[]> {
    return db.select().from(groups);
  }

  async getGroup(id: number): Promise<Group | undefined> {
    const [group] = await db.select().from(groups).where(eq(groups.id, id));
    return group;
  }

  async createGroup(group: InsertGroup): Promise<Group> {
    const [created] = await db.insert(groups).values(group).returning();
    return created;
  }

  async updateGroup(id: number, group: Partial<InsertGroup>): Promise<Group | undefined> {
    const [updated] = await db.update(groups).set(group).where(eq(groups.id, id)).returning();
    return updated;
  }

  async deleteGroup(id: number): Promise<void> {
    await db.delete(groups).where(eq(groups.id, id));
  }

  async getAllStudents(): Promise<Student[]> {
    return db.select().from(students);
  }

  async getStudent(id: number): Promise<Student | undefined> {
    const [student] = await db.select().from(students).where(eq(students.id, id));
    return student;
  }

  async getStudentByQr(qrCode: string): Promise<Student | undefined> {
    const trimmed = (qrCode || "").trim();
    const [student] = await db.select().from(students).where(eq(students.qrCode, trimmed));
    return student;
  }

  async getStudentByCarnetToken(token: string): Promise<Student | undefined> {
    const [student] = await db.select().from(students).where(eq(students.carnetToken, token));
    return student;
  }

  async createStudent(student: InsertStudent): Promise<Student> {
    const qrCode = `SAFEEXIT-${randomUUID()}`;
    const carnetToken = randomUUID().replace(/-/g, "").slice(0, 16);
    const [created] = await db.insert(students).values({ ...student, qrCode, carnetToken }).returning();
    return created;
  }

  async updateStudent(id: number, student: Partial<InsertStudent>): Promise<Student | undefined> {
    const [updated] = await db.update(students).set(student).where(eq(students.id, id)).returning();
    return updated;
  }

  async deleteStudent(id: number): Promise<void> {
    await db.delete(students).where(eq(students.id, id));
  }

  async getStudentsByGroup(groupId: number): Promise<Student[]> {
    return db.select().from(students).where(eq(students.groupId, groupId));
  }

  async generateCarnetTokens(): Promise<number> {
    const all = await db.select().from(students);
    let count = 0;
    for (const s of all) {
      if (!s.carnetToken) {
        const token = randomUUID().replace(/-/g, "").slice(0, 16);
        await db.update(students).set({ carnetToken: token }).where(eq(students.id, s.id));
        count++;
      }
    }
    return count;
  }

  async getGroupSchedules(groupId: number): Promise<GroupSchedule[]> {
    return db.select().from(groupSchedules).where(eq(groupSchedules.groupId, groupId));
  }

  async getGroupSchedulesByDate(groupId: number, date: string): Promise<GroupSchedule[]> {
    return db.select().from(groupSchedules).where(
      and(eq(groupSchedules.groupId, groupId), eq(groupSchedules.date, date))
    );
  }

  async setGroupSchedule(groupId: number, date: string, timeSlot: number, exitAllowed: boolean): Promise<void> {
    const existing = await db.select().from(groupSchedules)
      .where(and(
        eq(groupSchedules.groupId, groupId),
        eq(groupSchedules.date, date),
        eq(groupSchedules.timeSlot, timeSlot)
      ));

    if (existing.length > 0) {
      await db.update(groupSchedules)
        .set({ exitAllowed })
        .where(eq(groupSchedules.id, existing[0].id));
    } else {
      await db.insert(groupSchedules).values({ groupId, date, timeSlot, exitAllowed });
    }
  }

  async bulkSetGroupSchedules(schedules: InsertGroupSchedule[]): Promise<void> {
    for (const s of schedules) {
      await this.setGroupSchedule(s.groupId, s.date, s.timeSlot, s.exitAllowed);
    }
  }

  async getScheduleDates(groupId: number): Promise<string[]> {
    const rows = await db.select({ date: groupSchedules.date })
      .from(groupSchedules)
      .where(and(eq(groupSchedules.groupId, groupId), eq(groupSchedules.exitAllowed, true)));
    const unique = [...new Set(rows.map(r => r.date))];
    unique.sort();
    return unique;
  }

  async createExitLog(log: InsertExitLog): Promise<ExitLog> {
    const [created] = await db.insert(exitLogs).values(log).returning();
    return created;
  }

  async getExitLog(id: number): Promise<ExitLog | undefined> {
    const [log] = await db.select().from(exitLogs).where(eq(exitLogs.id, id));
    return log;
  }

  async getExitLogs(filters?: { dateFrom?: string; dateTo?: string; groupId?: number; studentName?: string }): Promise<any[]> {
    const allLogs = await db.select().from(exitLogs).orderBy(desc(exitLogs.timestamp));
    const allStudents = await db.select().from(students);
    const allGroups = await db.select().from(groups);
    const allUsers = await db.select().from(users);

    let result = allLogs.map(log => {
      const student = allStudents.find(s => s.id === log.studentId);
      const group = student ? allGroups.find(g => g.id === student.groupId) : undefined;
      const verifier = log.verifiedBy ? allUsers.find(u => u.id === log.verifiedBy) : undefined;
      return {
        ...log,
        studentName: student ? `${student.firstName} ${student.lastName}` : "Desconocido",
        studentPhoto: student?.photoUrl,
        groupName: group?.name || "Sin grupo",
        verifierName: verifier?.fullName || "Sistema",
      };
    });

    if (filters?.dateFrom) {
      const from = new Date(filters.dateFrom);
      result = result.filter(r => new Date(r.timestamp) >= from);
    }
    if (filters?.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter(r => new Date(r.timestamp) <= to);
    }
    if (filters?.groupId) {
      const studentsInGroup = allStudents.filter(s => s.groupId === filters.groupId).map(s => s.id);
      result = result.filter(r => studentsInGroup.includes(r.studentId));
    }
    if (filters?.studentName) {
      const search = filters.studentName.toLowerCase();
      result = result.filter(r => r.studentName.toLowerCase().includes(search));
    }

    return result;
  }

  async getRecentExitLogs(limit: number): Promise<any[]> {
    const logs = await this.getExitLogs();
    return logs.slice(0, limit);
  }

  async getExitStats(): Promise<{ total: number; authorized: number; denied: number; today: number }> {
    const allLogs = await db.select().from(exitLogs);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
      total: allLogs.length,
      authorized: allLogs.filter(l => l.result === "AUTORIZADO").length,
      denied: allLogs.filter(l => l.result === "DENEGADO").length,
      today: allLogs.filter(l => new Date(l.timestamp) >= today).length,
    };
  }

  async createIncident(incident: InsertIncident): Promise<Incident> {
    const [created] = await db.insert(incidents).values(incident).returning();
    return created;
  }

  async getIncidents(): Promise<Incident[]> {
    return db.select().from(incidents).orderBy(desc(incidents.createdAt));
  }

  async getSetting(key: string): Promise<string | undefined> {
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key));
    return row?.value;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await db.insert(appSettings).values({ key, value })
      .onConflictDoUpdate({ target: appSettings.key, set: { value } });
  }

  async getAllSettings(): Promise<Record<string, string>> {
    const rows = await db.select().from(appSettings);
    const result: Record<string, string> = {};
    for (const row of rows) result[row.key] = row.value;
    return result;
  }

  async getGuards(): Promise<User[]> {
    return db.select().from(users).where(or(eq(users.role, "guard"), eq(users.role, "tutor")));
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async updateAllGuardPasswords(hashedPassword: string): Promise<void> {
    await db.update(users).set({ password: hashedPassword }).where(or(eq(users.role, "guard"), eq(users.role, "tutor")));
  }

  async archiveAcademicYear(adminUserId: number, yearName: string): Promise<AcademicArchive> {
    const allStudents = await db.select().from(students);
    const allGroups = await db.select().from(groups);
    const allExitLogs = await db.select().from(exitLogs);
    const allIncidents = await db.select().from(incidents);
    const allLateArrivals = await db.select().from(lateArrivals);
    const allSchedules = await db.select().from(groupSchedules);
    const allUsers = await db.select().from(users);
    const allPickups = await db.select().from(authorizedPickups);
    const allSettings = await db.select().from(appSettings);

    const data = {
      students: allStudents,
      groups: allGroups,
      exitLogs: allExitLogs,
      incidents: allIncidents,
      lateArrivals: allLateArrivals,
      groupSchedules: allSchedules,
      users: allUsers.filter(u => u.id !== adminUserId),
      authorizedPickups: allPickups,
      settings: allSettings,
    };

    const [archive] = await db.insert(academicArchives).values({
      yearName,
      data,
    }).returning();

    await this.resetAcademicYear(adminUserId);

    return archive;
  }

  async resetAcademicYear(adminUserId: number): Promise<void> {
    await db.delete(guardDutyRegistrations);
    await db.delete(guardDutyAssignments);
    await db.delete(guardZones);
    await db.delete(incidents);
    await db.delete(exitLogs);
    await db.delete(lateArrivals);
    await db.delete(authorizedPickups);
    await db.delete(groupSchedules);
    await db.delete(students);
    await db.delete(groups);
    await db.delete(users).where(ne(users.id, adminUserId));
    await db.delete(appSettings);
  }

  async getAcademicArchives(): Promise<AcademicArchive[]> {
    return db.select({
      id: academicArchives.id,
      yearName: academicArchives.yearName,
      archivedAt: academicArchives.archivedAt,
      data: academicArchives.data,
    }).from(academicArchives).orderBy(desc(academicArchives.archivedAt));
  }

  async getAcademicArchive(id: number): Promise<AcademicArchive | undefined> {
    const [archive] = await db.select().from(academicArchives).where(eq(academicArchives.id, id));
    return archive;
  }

  async deleteAcademicArchive(id: number): Promise<void> {
    await db.delete(academicArchives).where(eq(academicArchives.id, id));
  }

  async createLateArrival(data: InsertLateArrival): Promise<LateArrival> {
    const [created] = await db.insert(lateArrivals).values(data).returning();
    return created;
  }

  async getLateArrivals(filters?: { dateFrom?: string; dateTo?: string; groupId?: number; studentName?: string }): Promise<any[]> {
    const allArrivals = await db.select().from(lateArrivals).orderBy(desc(lateArrivals.timestamp));
    const allStudents = await db.select().from(students);
    const allGroups = await db.select().from(groups);
    const allUsers = await db.select().from(users);

    let result = allArrivals.map(arrival => {
      const student = allStudents.find(s => s.id === arrival.studentId);
      const group = student ? allGroups.find(g => g.id === student.groupId) : undefined;
      const registrar = arrival.registeredBy ? allUsers.find(u => u.id === arrival.registeredBy) : undefined;
      return {
        ...arrival,
        studentName: student ? `${student.firstName} ${student.lastName}` : "Desconocido",
        studentPhoto: student?.photoUrl,
        groupName: group?.name || "Sin grupo",
        course: student?.course || "",
        registrarName: registrar?.fullName || "Sistema",
        studentEmail: student?.email || null,
      };
    });

    if (filters?.dateFrom) {
      const from = new Date(filters.dateFrom);
      result = result.filter(r => new Date(r.timestamp) >= from);
    }
    if (filters?.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter(r => new Date(r.timestamp) <= to);
    }
    if (filters?.groupId) {
      const studentsInGroup = allStudents.filter(s => s.groupId === filters.groupId).map(s => s.id);
      result = result.filter(r => studentsInGroup.includes(r.studentId));
    }
    if (filters?.studentName) {
      const search = filters.studentName.toLowerCase();
      result = result.filter(r => r.studentName.toLowerCase().includes(search));
    }

    return result;
  }

  async getTodayLateArrivals(): Promise<any[]> {
    const today = new Date();
    return this.getLateArrivals({ dateFrom: today.toISOString().split("T")[0], dateTo: today.toISOString().split("T")[0] });
  }

  async getAuthorizedPickups(studentId: number): Promise<AuthorizedPickup[]> {
    return db.select().from(authorizedPickups).where(eq(authorizedPickups.studentId, studentId));
  }

  async setAuthorizedPickups(studentId: number, pickups: InsertAuthorizedPickup[]): Promise<AuthorizedPickup[]> {
    await db.delete(authorizedPickups).where(eq(authorizedPickups.studentId, studentId));
    if (pickups.length === 0) return [];
    const toInsert = pickups.map(p => ({ ...p, studentId }));
    return db.insert(authorizedPickups).values(toInsert).returning();
  }

  async verifyPickupAuthorization(studentId: number, documentId: string): Promise<AuthorizedPickup | null> {
    const normalized = documentId.replace(/[\s.-]/g, "").toUpperCase();
    const pickups = await this.getAuthorizedPickups(studentId);
    const match = pickups.find(p => p.documentId.replace(/[\s.-]/g, "").toUpperCase() === normalized);
    return match || null;
  }

  async getAllGuardZones(): Promise<GuardZone[]> {
    return db.select().from(guardZones).orderBy(guardZones.buildingNumber, guardZones.zoneOrder);
  }

  async getGuardZonesByBuilding(buildingNumber: number): Promise<GuardZone[]> {
    return db.select().from(guardZones)
      .where(eq(guardZones.buildingNumber, buildingNumber))
      .orderBy(guardZones.zoneOrder);
  }

  async getGuardZone(id: number): Promise<GuardZone | undefined> {
    const [zone] = await db.select().from(guardZones).where(eq(guardZones.id, id));
    return zone;
  }

  async createGuardZone(zone: InsertGuardZone): Promise<GuardZone> {
    const [created] = await db.insert(guardZones).values(zone).returning();
    return created;
  }

  async updateGuardZone(id: number, zone: Partial<InsertGuardZone>): Promise<GuardZone | undefined> {
    const [updated] = await db.update(guardZones).set(zone).where(eq(guardZones.id, id)).returning();
    return updated;
  }

  async deleteGuardZone(id: number): Promise<void> {
    await db.delete(guardDutyAssignments).where(eq(guardDutyAssignments.zoneId, id));
    await db.delete(guardZones).where(eq(guardZones.id, id));
  }

  async getGuardDutyAssignments(dayOfWeek: number): Promise<GuardDutyAssignment[]> {
    return db.select().from(guardDutyAssignments).where(eq(guardDutyAssignments.dayOfWeek, dayOfWeek));
  }

  async getAllGuardDutyAssignments(): Promise<GuardDutyAssignment[]> {
    return db.select().from(guardDutyAssignments);
  }

  async createGuardDutyAssignment(assignment: InsertGuardDutyAssignment): Promise<GuardDutyAssignment> {
    const [created] = await db.insert(guardDutyAssignments).values(assignment).returning();
    return created;
  }

  async deleteGuardDutyAssignment(id: number): Promise<void> {
    await db.delete(guardDutyAssignments).where(eq(guardDutyAssignments.id, id));
  }

  async bulkSetGuardDutyAssignments(dayOfWeek: number, assignments: InsertGuardDutyAssignment[]): Promise<GuardDutyAssignment[]> {
    await db.delete(guardDutyAssignments).where(eq(guardDutyAssignments.dayOfWeek, dayOfWeek));
    if (assignments.length === 0) return [];
    return db.insert(guardDutyAssignments).values(assignments).returning();
  }

  async getGuardDutyRegistrations(filters?: { dateFrom?: string; dateTo?: string; buildingNumber?: number; zoneId?: number; userId?: number }): Promise<any[]> {
    const allRegs = await db.select().from(guardDutyRegistrations).orderBy(desc(guardDutyRegistrations.timestamp));
    const allUsers = await db.select().from(users);
    const allZones = await db.select().from(guardZones);

    let result = allRegs.map(reg => {
      const user = allUsers.find(u => u.id === reg.userId);
      const zone = allZones.find(z => z.id === reg.zoneId);
      return {
        ...reg,
        userName: user?.fullName || "Desconocido",
        zoneName: zone?.zoneName || "Zona eliminada",
        buildingNumber: zone?.buildingNumber || 0,
      };
    });

    if (filters?.dateFrom) {
      result = result.filter(r => r.date >= filters.dateFrom!);
    }
    if (filters?.dateTo) {
      result = result.filter(r => r.date <= filters.dateTo!);
    }
    if (filters?.buildingNumber) {
      result = result.filter(r => r.buildingNumber === filters.buildingNumber);
    }
    if (filters?.zoneId) {
      result = result.filter(r => r.zoneId === filters.zoneId);
    }
    if (filters?.userId) {
      result = result.filter(r => r.userId === filters.userId);
    }

    return result;
  }

  async createGuardDutyRegistration(reg: InsertGuardDutyRegistration): Promise<GuardDutyRegistration> {
    const [created] = await db.insert(guardDutyRegistrations).values(reg).returning();
    return created;
  }

  async getGuardDutyRegistrationsByUserAndDate(userId: number, date: string): Promise<GuardDutyRegistration[]> {
    return db.select().from(guardDutyRegistrations)
      .where(and(eq(guardDutyRegistrations.userId, userId), eq(guardDutyRegistrations.date, date)));
  }

  async createTeacherAbsence(absence: InsertTeacherAbsence, periods: Omit<InsertTeacherAbsencePeriod, "absenceId">[]): Promise<TeacherAbsence> {
    const [created] = await db.insert(teacherAbsences).values(absence).returning();
    if (periods.length > 0) {
      await db.insert(teacherAbsencePeriods).values(
        periods.map(p => ({ ...p, absenceId: created.id }))
      );
    }
    return created;
  }

  async getTeacherAbsences(filters?: { dateFrom?: string; dateTo?: string; userId?: number; status?: string }): Promise<any[]> {
    const allAbsences = await db.select().from(teacherAbsences).orderBy(desc(teacherAbsences.date));
    const allPeriods = await db.select().from(teacherAbsencePeriods);
    const allUsers = await db.select().from(users);
    const allGroups = await db.select().from(groups);
    const allAttachments = await db.select().from(teacherAbsenceAttachments);

    let result = allAbsences.map(a => {
      const user = allUsers.find(u => u.id === a.userId);
      const creator = allUsers.find(u => u.id === a.createdBy);
      const absPeriods = allPeriods.filter(p => p.absenceId === a.id).map(p => {
        const group = allGroups.find(g => g.id === p.groupId);
        return { ...p, groupName: group?.name || "?" };
      });
      const absAttachments = allAttachments.filter(at => at.absenceId === a.id);
      return {
        ...a,
        userName: user?.fullName || "?",
        createdByName: creator?.fullName || "?",
        periods: absPeriods,
        attachments: absAttachments,
      };
    });

    if (filters?.dateFrom) result = result.filter(r => r.date >= filters.dateFrom!);
    if (filters?.dateTo) result = result.filter(r => r.date <= filters.dateTo!);
    if (filters?.userId) result = result.filter(r => r.userId === filters.userId);
    if (filters?.status) result = result.filter(r => r.status === filters.status);

    return result;
  }

  async getTeacherAbsenceById(id: number): Promise<any> {
    const [absence] = await db.select().from(teacherAbsences).where(eq(teacherAbsences.id, id));
    if (!absence) return null;
    const allUsers = await db.select().from(users);
    const allGroups = await db.select().from(groups);
    const periods = await db.select().from(teacherAbsencePeriods).where(eq(teacherAbsencePeriods.absenceId, id));
    const attachments = await db.select().from(teacherAbsenceAttachments).where(eq(teacherAbsenceAttachments.absenceId, id));
    const user = allUsers.find(u => u.id === absence.userId);
    const creator = allUsers.find(u => u.id === absence.createdBy);
    return {
      ...absence,
      userName: user?.fullName || "?",
      createdByName: creator?.fullName || "?",
      periods: periods.map(p => {
        const group = allGroups.find(g => g.id === p.groupId);
        return { ...p, groupName: group?.name || "?" };
      }),
      attachments,
    };
  }

  async updateTeacherAbsenceStatus(id: number, status: string): Promise<TeacherAbsence | undefined> {
    const [updated] = await db.update(teacherAbsences).set({ status }).where(eq(teacherAbsences.id, id)).returning();
    return updated;
  }

  async deleteTeacherAbsence(id: number): Promise<void> {
    const periods = await db.select().from(teacherAbsencePeriods).where(eq(teacherAbsencePeriods.absenceId, id));
    for (const p of periods) {
      await db.delete(guardCoverages).where(eq(guardCoverages.absencePeriodId, p.id));
    }
    await db.delete(teacherAbsencePeriods).where(eq(teacherAbsencePeriods.absenceId, id));
    await db.delete(teacherAbsenceAttachments).where(eq(teacherAbsenceAttachments.absenceId, id));
    await db.delete(teacherAbsences).where(eq(teacherAbsences.id, id));
  }

  async getAbsenceAttachments(absenceId: number): Promise<TeacherAbsenceAttachment[]> {
    return db.select().from(teacherAbsenceAttachments).where(eq(teacherAbsenceAttachments.absenceId, absenceId));
  }

  async addAbsenceAttachment(data: InsertTeacherAbsenceAttachment): Promise<TeacherAbsenceAttachment> {
    const [created] = await db.insert(teacherAbsenceAttachments).values(data).returning();
    return created;
  }

  async deleteAbsenceAttachment(id: number): Promise<void> {
    await db.delete(teacherAbsenceAttachments).where(eq(teacherAbsenceAttachments.id, id));
  }

  async getUnattendedSlots(date: string): Promise<any[]> {
    const absences = await db.select().from(teacherAbsences)
      .where(and(eq(teacherAbsences.date, date), ne(teacherAbsences.status, "rejected")));
    const absenceIds = absences.map(a => a.id);
    if (absenceIds.length === 0) return [];

    const allPeriods = await db.select().from(teacherAbsencePeriods);
    const relevantPeriods = allPeriods.filter(p => absenceIds.includes(p.absenceId));
    const allGroups = await db.select().from(groups);
    const allUsers = await db.select().from(users);
    const allCoverages = await db.select().from(guardCoverages).where(eq(guardCoverages.date, date));
    const allAdvancements = await db.select().from(hourAdvancements).where(eq(hourAdvancements.date, date));

    return relevantPeriods.map(p => {
      const absence = absences.find(a => a.id === p.absenceId);
      const teacher = allUsers.find(u => u.id === absence?.userId);
      const group = allGroups.find(g => g.id === p.groupId);
      const coverage = allCoverages.find(c => c.absencePeriodId === p.id);
      const coverGuard = coverage ? allUsers.find(u => u.id === coverage.guardUserId) : null;
      const advancement = allAdvancements.find(a => a.groupId === p.groupId && a.originalSlotId === p.timeSlotId);
      const advTeacher = advancement ? allUsers.find(u => u.id === advancement.teacherUserId) : null;
      return {
        periodId: p.id,
        absenceId: p.absenceId,
        timeSlotId: p.timeSlotId,
        groupId: p.groupId,
        groupName: group?.name || "?",
        allowAdvancement: group?.allowAdvancement !== false,
        absentTeacherId: absence?.userId,
        absentTeacherName: teacher?.fullName || "?",
        absenceStatus: absence?.status || "pending",
        coverage: coverage ? {
          id: coverage.id,
          guardUserId: coverage.guardUserId,
          guardUserName: coverGuard?.fullName || "?",
        } : null,
        advancement: advancement ? {
          id: advancement.id,
          teacherUserId: advancement.teacherUserId,
          teacherName: advTeacher?.fullName || "?",
          fromSlot: advancement.targetSlotId,
        } : null,
      };
    });
  }

  async createGuardCoverage(data: InsertGuardCoverage): Promise<GuardCoverage> {
    const [created] = await db.insert(guardCoverages).values(data).returning();
    return created;
  }

  async getGuardCoverages(date: string): Promise<any[]> {
    const coverages = await db.select().from(guardCoverages).where(eq(guardCoverages.date, date));
    const allUsers = await db.select().from(users);
    return coverages.map(c => {
      const guard = allUsers.find(u => u.id === c.guardUserId);
      return { ...c, guardUserName: guard?.fullName || "?" };
    });
  }

  async deleteGuardCoverage(id: number): Promise<void> {
    await db.delete(guardCoverages).where(eq(guardCoverages.id, id));
  }

  async createHourAdvancement(data: InsertHourAdvancement): Promise<HourAdvancement> {
    const [created] = await db.insert(hourAdvancements).values(data).returning();
    return created;
  }

  async getHourAdvancements(date: string): Promise<any[]> {
    const advancements = await db.select().from(hourAdvancements).where(eq(hourAdvancements.date, date));
    const allUsers = await db.select().from(users);
    const allGroups = await db.select().from(groups);
    return advancements.map(a => {
      const teacher = allUsers.find(u => u.id === a.teacherUserId);
      const group = allGroups.find(g => g.id === a.groupId);
      const creator = allUsers.find(u => u.id === a.createdBy);
      return {
        ...a,
        teacherName: teacher?.fullName || "?",
        groupName: group?.name || "?",
        createdByName: creator?.fullName || "?",
      };
    });
  }

  async deleteHourAdvancement(id: number): Promise<void> {
    await db.delete(hourAdvancements).where(eq(hourAdvancements.id, id));
  }

  async getGroupFreeSlots(date: string, groupId: number): Promise<number[]> {
    const absences = await db.select().from(teacherAbsences)
      .where(and(eq(teacherAbsences.date, date), ne(teacherAbsences.status, "rejected")));
    const absenceIds = absences.map(a => a.id);

    const allPeriods = await db.select().from(teacherAbsencePeriods);
    const relevantPeriods = allPeriods
      .filter(p => absenceIds.includes(p.absenceId) && p.groupId === groupId);

    const allCoverages = await db.select().from(guardCoverages).where(eq(guardCoverages.date, date));
    const coveredPeriodIds = new Set(allCoverages.map(c => c.absencePeriodId));

    const uncoveredAbsentSlots = relevantPeriods
      .filter(p => !coveredPeriodIds.has(p.id))
      .map(p => p.timeSlotId);

    const advs = await db.select().from(hourAdvancements)
      .where(and(eq(hourAdvancements.date, date), eq(hourAdvancements.groupId, groupId)));

    const filledByAdvancement = new Set(advs.map(a => a.originalSlotId));
    const freedByAdvancement = advs.map(a => a.targetSlotId);

    const freeSlots = new Set<number>();

    for (const slot of uncoveredAbsentSlots) {
      if (!filledByAdvancement.has(slot)) {
        freeSlots.add(slot);
      }
    }

    for (const slot of freedByAdvancement) {
      freeSlots.add(slot);
    }

    return Array.from(freeSlots).sort((a, b) => a - b);
  }

  async getAllTeacherSchedules(): Promise<TeacherSchedule[]> {
    return db.select().from(teacherSchedules);
  }

  async getTeacherSchedulesByUser(userId: number): Promise<TeacherSchedule[]> {
    return db.select().from(teacherSchedules).where(eq(teacherSchedules.userId, userId));
  }

  async getTeacherSchedulesByDay(dayOfWeek: number): Promise<TeacherSchedule[]> {
    return db.select().from(teacherSchedules).where(eq(teacherSchedules.dayOfWeek, dayOfWeek));
  }

  async setTeacherSchedules(userId: number, entries: InsertTeacherSchedule[]): Promise<TeacherSchedule[]> {
    await db.delete(teacherSchedules).where(eq(teacherSchedules.userId, userId));
    if (entries.length === 0) return [];
    const created = await db.insert(teacherSchedules).values(entries).returning();
    return created;
  }

  async deleteTeacherSchedulesByUser(userId: number): Promise<void> {
    await db.delete(teacherSchedules).where(eq(teacherSchedules.userId, userId));
  }
}

export const storage = new DatabaseStorage();
