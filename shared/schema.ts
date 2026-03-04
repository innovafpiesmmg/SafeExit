import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, serial } from "drizzle-orm/pg-core";
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

export const TIME_SLOTS = [
  { id: 1, label: "08:00 - 08:55", period: "morning" },
  { id: 2, label: "08:55 - 09:50", period: "morning" },
  { id: 3, label: "09:50 - 10:45", period: "morning" },
  { id: 4, label: "10:45 - 11:15", period: "morning" },
  { id: 5, label: "11:15 - 12:10", period: "morning" },
  { id: 6, label: "12:10 - 13:05", period: "morning" },
  { id: 7, label: "13:05 - 14:00", period: "afternoon" },
  { id: 8, label: "14:00 - 14:55", period: "afternoon" },
  { id: 9, label: "14:55 - 15:50", period: "afternoon" },
  { id: 10, label: "15:50 - 16:45", period: "afternoon" },
  { id: 11, label: "16:45 - 17:40", period: "afternoon" },
  { id: 12, label: "17:40 - 18:35", period: "afternoon" },
] as const;

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
