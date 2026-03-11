import { eq, and, ne, desc, gte, lte, ilike, or, lt, inArray, sql, count } from "drizzle-orm";
import { db } from "./db";
import {
  users, students, groups, groupSchedules, exitLogs, incidents, appSettings, lateArrivals, authorizedPickups, academicArchives,
  guardZones, guardDutyAssignments, guardDutyRegistrations,
  teacherAbsences, teacherAbsencePeriods, teacherAbsenceAttachments, guardCoverages, hourAdvancements, teacherSchedules, passwordResetTokens,
  notifications, notificationReads, chatMessages, chatReads, directMessages, auditLogs,
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
  type Notification, type InsertNotification,
  type NotificationRead, type InsertNotificationRead,
  type ChatMessage, type InsertChatMessage,
  type ChatRead,
  type DirectMessage, type InsertDirectMessage,
  type AuditLog, type InsertAuditLog,
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
  getUserByEmail(email: string): Promise<User | undefined>;
  createPasswordResetToken(userId: number, token: string, expiresAt: Date): Promise<void>;
  getPasswordResetToken(token: string): Promise<{ id: number; userId: number; token: string; expiresAt: Date; used: boolean } | undefined>;
  markPasswordResetTokenUsed(token: string): Promise<void>;
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
  getGroupScheduledSlots(groupId: number, dayOfWeek: number): Promise<number[]>;

  getAllTeacherSchedules(): Promise<TeacherSchedule[]>;
  getTeacherSchedulesByUser(userId: number): Promise<TeacherSchedule[]>;
  getTeacherSchedulesByDay(dayOfWeek: number): Promise<TeacherSchedule[]>;
  setTeacherSchedules(userId: number, entries: InsertTeacherSchedule[]): Promise<TeacherSchedule[]>;
  deleteTeacherSchedulesByUser(userId: number): Promise<void>;

  createNotification(data: InsertNotification): Promise<Notification>;
  getNotificationsForUser(userId: number, role: string, groupId?: number | null): Promise<any[]>;
  getSentNotifications(): Promise<any[]>;
  markNotificationRead(notificationId: number, userId: number): Promise<void>;
  getUnreadNotificationCount(userId: number, role: string, groupId?: number | null): Promise<number>;
  deleteNotification(id: number): Promise<void>;
  dismissNotificationForUser(notificationId: number, userId: number): Promise<void>;

  createChatMessage(data: InsertChatMessage): Promise<ChatMessage>;
  deleteChatMessage(id: number): Promise<void>;
  getChatMessages(groupId: number, limit?: number, beforeId?: number): Promise<any[]>;
  markChatRead(groupId: number, userId: number): Promise<void>;
  getUnreadChatCounts(userId: number, groupIds: number[]): Promise<Record<number, number>>;
  getGroupsForChat(userId: number, role: string, groupId?: number | null): Promise<number[]>;

  sendDirectMessage(data: InsertDirectMessage): Promise<DirectMessage>;
  getDirectMessage(id: number): Promise<DirectMessage | undefined>;
  getDirectMessages(userId1: number, userId2: number, limit?: number, beforeId?: number): Promise<any[]>;
  markDirectMessagesRead(senderId: number, receiverId: number): Promise<void>;
  deleteDirectMessage(id: number): Promise<void>;
  getDirectConversations(userId: number): Promise<any[]>;
  getUnreadDirectMessageCount(userId: number): Promise<number>;

  createAuditLog(data: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(limit?: number, offset?: number, filters?: { userId?: number; action?: string; entity?: string }): Promise<{ logs: AuditLog[]; total: number }>;
  cleanupOldRecords(yearsOld: number): Promise<{ exitLogs: number; lateArrivals: number; chatMessages: number; directMessages: number; notifications: number; incidents: number }>;
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

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createPasswordResetToken(userId: number, token: string, expiresAt: Date): Promise<void> {
    await db.insert(passwordResetTokens).values({ userId, token, expiresAt });
  }

  async getPasswordResetToken(token: string): Promise<{ id: number; userId: number; token: string; expiresAt: Date; used: boolean } | undefined> {
    const [row] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token));
    return row;
  }

  async markPasswordResetTokenUsed(token: string): Promise<void> {
    await db.update(passwordResetTokens).set({ used: true }).where(eq(passwordResetTokens.token, token));
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

  async getGroupScheduledSlots(groupId: number, dayOfWeek: number): Promise<number[]> {
    const entries = await db.select().from(teacherSchedules)
      .where(and(
        eq(teacherSchedules.groupId, groupId),
        eq(teacherSchedules.dayOfWeek, dayOfWeek),
        eq(teacherSchedules.slotType, "class")
      ));
    return entries.map(e => e.timeSlotId).sort((a, b) => a - b);
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

  async createNotification(data: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(data).returning();
    return created;
  }

  async getNotificationsForUser(userId: number, role: string, groupId?: number | null): Promise<any[]> {
    const allNotifs = await db.select().from(notifications).orderBy(desc(notifications.createdAt));
    const userGroupIds = await this.getGroupsForChat(userId, role, groupId);
    const userGroupSet = new Set(userGroupIds);
    const filtered = allNotifs.filter(n => {
      if (n.targetType === "all") return true;
      if (n.targetType === "user" && n.targetId === userId) return true;
      if (n.targetType === "group" && n.targetId && userGroupSet.has(n.targetId)) return true;
      return false;
    });
    const reads = await db.select().from(notificationReads).where(eq(notificationReads.userId, userId));
    const readMap = new Set(reads.map(r => r.notificationId));
    const dismissedSet = new Set(reads.filter(r => r.dismissed).map(r => r.notificationId));
    const senderIds = [...new Set(filtered.map(n => n.senderId))];
    const senders = senderIds.length > 0 ? await db.select().from(users).where(inArray(users.id, senderIds)) : [];
    const senderMap = new Map(senders.map(s => [s.id, s.fullName]));
    return filtered.filter(n => !dismissedSet.has(n.id)).map(n => ({
      ...n,
      read: readMap.has(n.id),
      senderName: senderMap.get(n.senderId) || "Sistema",
    }));
  }

  async getSentNotifications(): Promise<any[]> {
    const allNotifs = await db.select().from(notifications).orderBy(desc(notifications.createdAt));
    const senderIds = [...new Set(allNotifs.map(n => n.senderId))];
    const senders = senderIds.length > 0 ? await db.select().from(users).where(inArray(users.id, senderIds)) : [];
    const senderMap = new Map(senders.map(s => [s.id, s.fullName]));
    const allReads = await db.select().from(notificationReads);
    const readCountMap = new Map<number, number>();
    for (const r of allReads) {
      readCountMap.set(r.notificationId, (readCountMap.get(r.notificationId) || 0) + 1);
    }
    const allUsers = await db.select().from(users).where(ne(users.role, "admin"));
    const allGroups = await db.select().from(groups);
    const groupMap = new Map(allGroups.map(g => [g.id, g.name]));
    const allSchedules = await db.select().from(teacherSchedules);
    return allNotifs.map(n => {
      let totalRecipients = 0;
      if (n.targetType === "all") totalRecipients = allUsers.length;
      else if (n.targetType === "user") totalRecipients = 1;
      else if (n.targetType === "group" && n.targetId) {
        const teacherIdsInGroup = new Set<number>();
        allUsers.filter(u => u.groupId === n.targetId).forEach(u => teacherIdsInGroup.add(u.id));
        allSchedules.filter(s => s.groupId === n.targetId).forEach(s => teacherIdsInGroup.add(s.userId));
        totalRecipients = teacherIdsInGroup.size;
      }
      return {
        ...n,
        senderName: senderMap.get(n.senderId) || "Sistema",
        readCount: readCountMap.get(n.id) || 0,
        totalRecipients,
        targetName: n.targetType === "group" ? groupMap.get(n.targetId!) : n.targetType === "user" ? allUsers.find(u => u.id === n.targetId)?.fullName : "Todos",
      };
    });
  }

  async markNotificationRead(notificationId: number, userId: number): Promise<void> {
    const existing = await db.select().from(notificationReads).where(
      and(eq(notificationReads.notificationId, notificationId), eq(notificationReads.userId, userId))
    );
    if (existing.length === 0) {
      await db.insert(notificationReads).values({ notificationId, userId });
    }
  }

  async getUnreadNotificationCount(userId: number, role: string, groupId?: number | null): Promise<number> {
    const allNotifs = await db.select({ id: notifications.id, targetType: notifications.targetType, targetId: notifications.targetId }).from(notifications);
    const userGroupIds = await this.getGroupsForChat(userId, role, groupId);
    const userGroupSet = new Set(userGroupIds);
    const filtered = allNotifs.filter(n => {
      if (n.targetType === "all") return true;
      if (n.targetType === "user" && n.targetId === userId) return true;
      if (n.targetType === "group" && n.targetId && userGroupSet.has(n.targetId)) return true;
      return false;
    });
    if (filtered.length === 0) return 0;
    const reads = await db.select().from(notificationReads).where(eq(notificationReads.userId, userId));
    const readSet = new Set(reads.map(r => r.notificationId));
    return filtered.filter(n => !readSet.has(n.id)).length;
  }

  async deleteNotification(id: number): Promise<void> {
    await db.delete(notificationReads).where(eq(notificationReads.notificationId, id));
    await db.delete(notifications).where(eq(notifications.id, id));
  }

  async dismissNotificationForUser(notificationId: number, userId: number): Promise<void> {
    const existing = await db.select().from(notificationReads).where(
      and(eq(notificationReads.notificationId, notificationId), eq(notificationReads.userId, userId))
    );
    if (existing.length > 0) {
      await db.update(notificationReads)
        .set({ dismissed: true })
        .where(and(eq(notificationReads.notificationId, notificationId), eq(notificationReads.userId, userId)));
    } else {
      await db.insert(notificationReads).values({ notificationId, userId, dismissed: true });
    }
  }

  async deleteChatMessage(id: number): Promise<void> {
    await db.delete(chatMessages).where(eq(chatMessages.id, id));
  }

  async createChatMessage(data: InsertChatMessage): Promise<ChatMessage> {
    const [created] = await db.insert(chatMessages).values(data).returning();
    return created;
  }

  async getChatMessages(groupId: number, limit: number = 50, beforeId?: number): Promise<any[]> {
    let conditions = [eq(chatMessages.groupId, groupId)];
    if (beforeId) {
      conditions.push(lt(chatMessages.id, beforeId));
    }
    const messages = await db.select().from(chatMessages)
      .where(and(...conditions))
      .orderBy(desc(chatMessages.id))
      .limit(limit);
    const senderIds = [...new Set(messages.map(m => m.senderId))];
    const senders = senderIds.length > 0 ? await db.select().from(users).where(inArray(users.id, senderIds)) : [];
    const senderMap = new Map(senders.map(s => [s.id, { fullName: s.fullName, role: s.role }]));
    return messages.reverse().map(m => ({
      ...m,
      senderName: senderMap.get(m.senderId)?.fullName || "Desconocido",
      senderRole: senderMap.get(m.senderId)?.role || "guard",
    }));
  }

  async markChatRead(groupId: number, userId: number): Promise<void> {
    const existing = await db.select().from(chatReads).where(
      and(eq(chatReads.groupId, groupId), eq(chatReads.userId, userId))
    );
    if (existing.length > 0) {
      await db.update(chatReads).set({ lastReadAt: new Date() }).where(
        and(eq(chatReads.groupId, groupId), eq(chatReads.userId, userId))
      );
    } else {
      await db.insert(chatReads).values({ groupId, userId, lastReadAt: new Date() });
    }
  }

  async getUnreadChatCounts(userId: number, groupIds: number[]): Promise<Record<number, number>> {
    if (groupIds.length === 0) return {};
    const result: Record<number, number> = {};
    const reads = await db.select().from(chatReads).where(
      and(eq(chatReads.userId, userId), inArray(chatReads.groupId, groupIds))
    );
    const readMap = new Map(reads.map(r => [r.groupId, r.lastReadAt]));
    for (const gid of groupIds) {
      const lastRead = readMap.get(gid);
      let conditions = [eq(chatMessages.groupId, gid), ne(chatMessages.senderId, userId)];
      if (lastRead) {
        const msgs = await db.select({ cnt: count() }).from(chatMessages).where(
          and(eq(chatMessages.groupId, gid), ne(chatMessages.senderId, userId), gte(chatMessages.createdAt, lastRead))
        );
        result[gid] = msgs[0]?.cnt || 0;
      } else {
        const msgs = await db.select({ cnt: count() }).from(chatMessages).where(
          and(eq(chatMessages.groupId, gid), ne(chatMessages.senderId, userId))
        );
        result[gid] = msgs[0]?.cnt || 0;
      }
    }
    return result;
  }

  async getGroupsForChat(userId: number, role: string, groupId?: number | null): Promise<number[]> {
    if (role === "admin") {
      const allGroups = await db.select({ id: groups.id }).from(groups);
      return allGroups.map(g => g.id);
    }
    const scheduleGroups = await db.select({ groupId: teacherSchedules.groupId }).from(teacherSchedules).where(eq(teacherSchedules.userId, userId));
    const gids = new Set(scheduleGroups.map(s => s.groupId).filter((id): id is number => id !== null));
    if (groupId) gids.add(groupId);
    return Array.from(gids);
  }
  async sendDirectMessage(data: InsertDirectMessage): Promise<DirectMessage> {
    const [created] = await db.insert(directMessages).values(data).returning();
    return created;
  }

  async getDirectMessage(id: number): Promise<DirectMessage | undefined> {
    const [msg] = await db.select().from(directMessages).where(eq(directMessages.id, id));
    return msg;
  }

  async getDirectMessages(userId1: number, userId2: number, limit: number = 50, beforeId?: number): Promise<any[]> {
    let conditions = [
      or(
        and(eq(directMessages.senderId, userId1), eq(directMessages.receiverId, userId2)),
        and(eq(directMessages.senderId, userId2), eq(directMessages.receiverId, userId1))
      )
    ];
    if (beforeId) {
      conditions.push(lt(directMessages.id, beforeId));
    }
    const msgs = await db.select().from(directMessages)
      .where(and(...conditions))
      .orderBy(desc(directMessages.id))
      .limit(limit);

    const senderIds = [...new Set(msgs.map(m => m.senderId))];
    const senderUsers = senderIds.length > 0 ? await db.select().from(users).where(inArray(users.id, senderIds)) : [];
    const senderMap = Object.fromEntries(senderUsers.map(u => [u.id, u]));

    return msgs.reverse().map(m => ({
      ...m,
      senderName: senderMap[m.senderId]?.fullName || "Desconocido",
      senderRole: senderMap[m.senderId]?.role || "teacher",
    }));
  }

  async markDirectMessagesRead(senderId: number, receiverId: number): Promise<void> {
    await db.update(directMessages)
      .set({ readAt: new Date() })
      .where(and(
        eq(directMessages.senderId, senderId),
        eq(directMessages.receiverId, receiverId),
        sql`${directMessages.readAt} IS NULL`
      ));
  }

  async deleteDirectMessage(id: number): Promise<void> {
    await db.delete(directMessages).where(eq(directMessages.id, id));
  }

  async getDirectConversations(userId: number): Promise<any[]> {
    const sent = await db.select({
      partnerId: directMessages.receiverId,
      lastMsgId: sql<number>`MAX(${directMessages.id})`,
    }).from(directMessages)
      .where(eq(directMessages.senderId, userId))
      .groupBy(directMessages.receiverId);

    const received = await db.select({
      partnerId: directMessages.senderId,
      lastMsgId: sql<number>`MAX(${directMessages.id})`,
    }).from(directMessages)
      .where(eq(directMessages.receiverId, userId))
      .groupBy(directMessages.senderId);

    const partnerMap = new Map<number, number>();
    for (const s of sent) {
      partnerMap.set(s.partnerId, Math.max(partnerMap.get(s.partnerId) || 0, s.lastMsgId));
    }
    for (const r of received) {
      partnerMap.set(r.partnerId, Math.max(partnerMap.get(r.partnerId) || 0, r.lastMsgId));
    }

    if (partnerMap.size === 0) return [];

    const partnerIds = Array.from(partnerMap.keys());
    const partnerUsers = await db.select().from(users).where(inArray(users.id, partnerIds));
    const userMap = Object.fromEntries(partnerUsers.map(u => [u.id, u]));

    const msgIds = Array.from(partnerMap.values());
    const lastMsgs = await db.select().from(directMessages).where(inArray(directMessages.id, msgIds));
    const msgMap = Object.fromEntries(lastMsgs.map(m => [m.id, m]));

    const unreadCounts = await db.select({
      senderId: directMessages.senderId,
      cnt: count(),
    }).from(directMessages)
      .where(and(
        eq(directMessages.receiverId, userId),
        sql`${directMessages.readAt} IS NULL`,
        inArray(directMessages.senderId, partnerIds)
      ))
      .groupBy(directMessages.senderId);
    const unreadMap = Object.fromEntries(unreadCounts.map(u => [u.senderId, Number(u.cnt)]));

    const conversations = partnerIds.map(pid => {
      const lastMsg = msgMap[partnerMap.get(pid)!];
      const partner = userMap[pid];
      return {
        partnerId: pid,
        partnerName: partner?.fullName || "Desconocido",
        partnerRole: partner?.role || "teacher",
        lastMessage: lastMsg?.message || "",
        lastMessageAt: lastMsg?.createdAt,
        unreadCount: unreadMap[pid] || 0,
      };
    }).sort((a, b) => {
      const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return tb - ta;
    });

    return conversations;
  }

  async getUnreadDirectMessageCount(userId: number): Promise<number> {
    const [result] = await db.select({ cnt: count() }).from(directMessages)
      .where(and(
        eq(directMessages.receiverId, userId),
        sql`${directMessages.readAt} IS NULL`
      ));
    return Number(result?.cnt || 0);
  }

  async createAuditLog(data: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values(data).returning();
    return created;
  }

  async getAuditLogs(limit: number = 50, offset: number = 0, filters?: { userId?: number; action?: string; entity?: string }): Promise<{ logs: AuditLog[]; total: number }> {
    const conditions: any[] = [];
    if (filters?.userId) conditions.push(eq(auditLogs.userId, filters.userId));
    if (filters?.action) conditions.push(eq(auditLogs.action, filters.action));
    if (filters?.entity) conditions.push(eq(auditLogs.entity, filters.entity));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db.select({ cnt: count() }).from(auditLogs).where(whereClause);
    const logs = await db.select().from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.id))
      .limit(limit)
      .offset(offset);

    return { logs, total: Number(totalResult?.cnt || 0) };
  }

  async cleanupOldRecords(yearsOld: number): Promise<{ exitLogs: number; lateArrivals: number; chatMessages: number; directMessages: number; notifications: number; incidents: number }> {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - yearsOld);

    const oldExitIds = await db.select({ id: exitLogs.id }).from(exitLogs).where(lt(exitLogs.timestamp, cutoff));
    const exitIds = oldExitIds.map(e => e.id);
    let incidentCount = 0;
    if (exitIds.length > 0) {
      const delIncidents = await db.delete(incidents).where(inArray(incidents.exitLogId, exitIds)).returning();
      incidentCount = delIncidents.length;
    }

    const delExitLogs = await db.delete(exitLogs).where(lt(exitLogs.timestamp, cutoff)).returning();
    const delLateArrivals = await db.delete(lateArrivals).where(lt(lateArrivals.timestamp, cutoff)).returning();
    const delChatMessages = await db.delete(chatMessages).where(lt(chatMessages.createdAt, cutoff)).returning();
    const delDirectMessages = await db.delete(directMessages).where(lt(directMessages.createdAt, cutoff)).returning();

    const oldNotifIds = await db.select({ id: notifications.id }).from(notifications).where(lt(notifications.createdAt, cutoff));
    const notifIds = oldNotifIds.map(n => n.id);
    if (notifIds.length > 0) {
      await db.delete(notificationReads).where(inArray(notificationReads.notificationId, notifIds));
    }
    const delNotifications = await db.delete(notifications).where(lt(notifications.createdAt, cutoff)).returning();

    return {
      exitLogs: delExitLogs.length,
      lateArrivals: delLateArrivals.length,
      chatMessages: delChatMessages.length,
      directMessages: delDirectMessages.length,
      notifications: delNotifications.length,
      incidents: incidentCount,
    };
  }
}

export const storage = new DatabaseStorage();
