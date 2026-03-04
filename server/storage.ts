import { eq, and, ne, desc, gte, lte, ilike, or } from "drizzle-orm";
import { db } from "./db";
import {
  users, students, groups, groupSchedules, exitLogs, incidents, appSettings,
  type User, type InsertUser,
  type Student, type InsertStudent,
  type Group, type InsertGroup,
  type GroupSchedule, type InsertGroupSchedule,
  type ExitLog, type InsertExitLog,
  type Incident, type InsertIncident,
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
  setGroupSchedule(groupId: number, dayOfWeek: number, timeSlot: number, exitAllowed: boolean): Promise<void>;
  bulkSetGroupSchedules(schedules: InsertGroupSchedule[]): Promise<void>;

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
  resetAcademicYear(adminUserId: number): Promise<void>;
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
    const [student] = await db.select().from(students).where(eq(students.qrCode, qrCode));
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

  async setGroupSchedule(groupId: number, dayOfWeek: number, timeSlot: number, exitAllowed: boolean): Promise<void> {
    const existing = await db.select().from(groupSchedules)
      .where(and(
        eq(groupSchedules.groupId, groupId),
        eq(groupSchedules.dayOfWeek, dayOfWeek),
        eq(groupSchedules.timeSlot, timeSlot)
      ));

    if (existing.length > 0) {
      await db.update(groupSchedules)
        .set({ exitAllowed })
        .where(eq(groupSchedules.id, existing[0].id));
    } else {
      await db.insert(groupSchedules).values({ groupId, dayOfWeek, timeSlot, exitAllowed });
    }
  }

  async bulkSetGroupSchedules(schedules: InsertGroupSchedule[]): Promise<void> {
    for (const s of schedules) {
      await this.setGroupSchedule(s.groupId, s.dayOfWeek, s.timeSlot, s.exitAllowed);
    }
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

  async resetAcademicYear(adminUserId: number): Promise<void> {
    await db.delete(incidents);
    await db.delete(exitLogs);
    await db.delete(groupSchedules);
    await db.delete(students);
    await db.delete(groups);
    await db.delete(users).where(ne(users.id, adminUserId));
    await db.delete(appSettings);
  }
}

export const storage = new DatabaseStorage();
