import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, serial, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("guard"),
  groupId: integer("group_id"),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  course: text("course").notNull(),
  schedule: text("schedule").notNull().default("morning"),
});

export const insertGroupSchema = createInsertSchema(groups).omit({ id: true });
export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type Group = typeof groups.$inferSelect;

export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  course: text("course").notNull(),
  groupId: integer("group_id").notNull(),
  photoUrl: text("photo_url"),
  parentalAuthorization: boolean("parental_authorization").notNull().default(false),
  busAuthorization: boolean("bus_authorization").notNull().default(false),
  qrCode: text("qr_code").notNull().unique(),
  carnetToken: text("carnet_token").unique(),
  email: text("email"),
});

export const insertStudentSchema = createInsertSchema(students).omit({ id: true, qrCode: true, carnetToken: true });
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof students.$inferSelect;

export const groupSchedules = pgTable("group_schedules", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull(),
  date: text("date").notNull(),
  timeSlot: integer("time_slot").notNull(),
  exitAllowed: boolean("exit_allowed").notNull().default(false),
});

export const insertGroupScheduleSchema = createInsertSchema(groupSchedules).omit({ id: true });
export type InsertGroupSchedule = z.infer<typeof insertGroupScheduleSchema>;
export type GroupSchedule = typeof groupSchedules.$inferSelect;

export const exitLogs = pgTable("exit_logs", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  result: text("result").notNull(),
  reason: text("reason").notNull(),
  verifiedBy: integer("verified_by"),
});

export const insertExitLogSchema = createInsertSchema(exitLogs).omit({ id: true, timestamp: true });
export type InsertExitLog = z.infer<typeof insertExitLogSchema>;
export type ExitLog = typeof exitLogs.$inferSelect;

export const incidents = pgTable("incidents", {
  id: serial("id").primaryKey(),
  exitLogId: integer("exit_log_id").notNull(),
  note: text("note").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: integer("created_by"),
});

export const insertIncidentSchema = createInsertSchema(incidents).omit({ id: true, createdAt: true });
export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type Incident = typeof incidents.$inferSelect;

export const academicArchives = pgTable("academic_archives", {
  id: serial("id").primaryKey(),
  yearName: text("year_name").notNull(),
  archivedAt: timestamp("archived_at").notNull().defaultNow(),
  data: jsonb("data").notNull(),
});

export type AcademicArchive = typeof academicArchives.$inferSelect;

export interface TimeSlotConfig {
  id: number;
  start: string;
  end: string;
  isBreak?: boolean;
  label?: string;
}

export const DEFAULT_TIME_SLOTS: TimeSlotConfig[] = [
  { id: 1, start: "08:00", end: "08:55" },
  { id: 2, start: "08:55", end: "09:50" },
  { id: 100, start: "09:50", end: "10:10", isBreak: true, label: "Recreo 1" },
  { id: 3, start: "10:10", end: "11:05" },
  { id: 4, start: "11:05", end: "12:00" },
  { id: 101, start: "12:00", end: "12:20", isBreak: true, label: "Recreo 2" },
  { id: 5, start: "12:20", end: "13:15" },
  { id: 6, start: "13:15", end: "14:10" },
  { id: 7, start: "15:00", end: "15:55" },
  { id: 8, start: "15:55", end: "16:50" },
  { id: 102, start: "16:50", end: "17:10", isBreak: true, label: "Recreo 3" },
  { id: 9, start: "17:10", end: "18:05" },
  { id: 10, start: "18:05", end: "19:00" },
  { id: 11, start: "19:00", end: "19:55" },
  { id: 12, start: "19:55", end: "20:50" },
];

export type TimeSlotsConfig = Record<string, TimeSlotConfig[]>;

export function getDefaultTimeSlotsConfig(): TimeSlotsConfig {
  const config: TimeSlotsConfig = {};
  for (let d = 1; d <= 5; d++) {
    config[String(d)] = DEFAULT_TIME_SLOTS.map(s => ({ ...s }));
  }
  return config;
}

export function getTimeSlotsForDay(config: TimeSlotsConfig, dayOfWeek: number): TimeSlotConfig[] {
  return config[String(dayOfWeek)] || DEFAULT_TIME_SLOTS;
}

const _classSlots = DEFAULT_TIME_SLOTS.filter(s => !s.isBreak);
export const TIME_SLOTS = DEFAULT_TIME_SLOTS.map((s, _i, arr) => {
  let period: string;
  if (s.isBreak) {
    const breakIdx = arr.indexOf(s);
    const prevClass = arr.slice(0, breakIdx).filter(ps => !ps.isBreak);
    period = prevClass.length <= 6 ? "morning" : "afternoon";
  } else {
    const classIdx = _classSlots.indexOf(s);
    period = classIdx < 6 ? "morning" : "afternoon";
  }
  return {
    id: s.id,
    label: s.isBreak ? `☕ ${s.label || "Recreo"} (${s.start} - ${s.end})` : `${s.start} - ${s.end}`,
    period,
    isBreak: !!s.isBreak,
  };
}) as readonly { id: number; label: string; period: string; isBreak: boolean }[];

export const lateArrivals = pgTable("late_arrivals", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  registeredBy: integer("registered_by"),
  emailSent: boolean("email_sent").notNull().default(false),
  notes: text("notes"),
});

export const insertLateArrivalSchema = createInsertSchema(lateArrivals).omit({ id: true, timestamp: true });
export type InsertLateArrival = z.infer<typeof insertLateArrivalSchema>;
export type LateArrival = typeof lateArrivals.$inferSelect;

export const authorizedPickups = pgTable("authorized_pickups", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  documentId: text("document_id").notNull(),
});

export const insertAuthorizedPickupSchema = createInsertSchema(authorizedPickups).omit({ id: true });
export type InsertAuthorizedPickup = z.infer<typeof insertAuthorizedPickupSchema>;
export type AuthorizedPickup = typeof authorizedPickups.$inferSelect;

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type AppSetting = typeof appSettings.$inferSelect;

export const DAYS_OF_WEEK = [
  { id: 1, label: "Lunes" },
  { id: 2, label: "Martes" },
  { id: 3, label: "Miércoles" },
  { id: 4, label: "Jueves" },
  { id: 5, label: "Viernes" },
] as const;
