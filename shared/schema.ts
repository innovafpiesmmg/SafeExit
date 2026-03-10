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
  photoUrl: text("photo_url"),
  email: text("email"),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  course: text("course").notNull(),
  schedule: text("schedule").notNull().default("morning"),
  allowAdvancement: boolean("allow_advancement").notNull().default(true),
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
  busExitMinutes: integer("bus_exit_minutes").default(5),
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
  signatureData: text("signature_data"),
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

export const guardZones = pgTable("guard_zones", {
  id: serial("id").primaryKey(),
  buildingNumber: integer("building_number").notNull(),
  zoneName: text("zone_name").notNull(),
  zoneOrder: integer("zone_order").notNull().default(0),
});

export const insertGuardZoneSchema = createInsertSchema(guardZones).omit({ id: true });
export type InsertGuardZone = z.infer<typeof insertGuardZoneSchema>;
export type GuardZone = typeof guardZones.$inferSelect;

export const guardDutyAssignments = pgTable("guard_duty_assignments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
  timeSlotId: integer("time_slot_id").notNull(),
  zoneId: integer("zone_id").notNull(),
});

export const insertGuardDutyAssignmentSchema = createInsertSchema(guardDutyAssignments).omit({ id: true });
export type InsertGuardDutyAssignment = z.infer<typeof insertGuardDutyAssignmentSchema>;
export type GuardDutyAssignment = typeof guardDutyAssignments.$inferSelect;

export const guardDutyRegistrations = pgTable("guard_duty_registrations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  zoneId: integer("zone_id").notNull(),
  date: text("date").notNull(),
  timeSlotId: integer("time_slot_id").notNull(),
  signatureData: text("signature_data"),
  substitutionPlan: text("substitution_plan"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertGuardDutyRegistrationSchema = createInsertSchema(guardDutyRegistrations).omit({ id: true, timestamp: true });
export type InsertGuardDutyRegistration = z.infer<typeof insertGuardDutyRegistrationSchema>;
export type GuardDutyRegistration = typeof guardDutyRegistrations.$inferSelect;

export const DAYS_OF_WEEK = [
  { id: 1, label: "Lunes" },
  { id: 2, label: "Martes" },
  { id: 3, label: "Miércoles" },
  { id: 4, label: "Jueves" },
  { id: 5, label: "Viernes" },
] as const;

export const teacherAbsences = pgTable("teacher_absences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  date: text("date").notNull(),
  createdBy: integer("created_by").notNull(),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTeacherAbsenceSchema = createInsertSchema(teacherAbsences).omit({ id: true, createdAt: true });
export type InsertTeacherAbsence = z.infer<typeof insertTeacherAbsenceSchema>;
export type TeacherAbsence = typeof teacherAbsences.$inferSelect;

export const teacherAbsencePeriods = pgTable("teacher_absence_periods", {
  id: serial("id").primaryKey(),
  absenceId: integer("absence_id").notNull(),
  timeSlotId: integer("time_slot_id").notNull(),
  groupId: integer("group_id").notNull(),
});

export const insertTeacherAbsencePeriodSchema = createInsertSchema(teacherAbsencePeriods).omit({ id: true });
export type InsertTeacherAbsencePeriod = z.infer<typeof insertTeacherAbsencePeriodSchema>;
export type TeacherAbsencePeriod = typeof teacherAbsencePeriods.$inferSelect;

export const teacherAbsenceAttachments = pgTable("teacher_absence_attachments", {
  id: serial("id").primaryKey(),
  absenceId: integer("absence_id").notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

export const insertTeacherAbsenceAttachmentSchema = createInsertSchema(teacherAbsenceAttachments).omit({ id: true, uploadedAt: true });
export type InsertTeacherAbsenceAttachment = z.infer<typeof insertTeacherAbsenceAttachmentSchema>;
export type TeacherAbsenceAttachment = typeof teacherAbsenceAttachments.$inferSelect;

export const guardCoverages = pgTable("guard_coverages", {
  id: serial("id").primaryKey(),
  absencePeriodId: integer("absence_period_id").notNull(),
  guardUserId: integer("guard_user_id").notNull(),
  date: text("date").notNull(),
  assignedBy: integer("assigned_by").notNull(),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
});

export const insertGuardCoverageSchema = createInsertSchema(guardCoverages).omit({ id: true, assignedAt: true });
export type InsertGuardCoverage = z.infer<typeof insertGuardCoverageSchema>;
export type GuardCoverage = typeof guardCoverages.$inferSelect;

export const hourAdvancements = pgTable("hour_advancements", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  groupId: integer("group_id").notNull(),
  originalSlotId: integer("original_slot_id").notNull(),
  targetSlotId: integer("target_slot_id").notNull(),
  teacherUserId: integer("teacher_user_id").notNull(),
  absencePeriodId: integer("absence_period_id"),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertHourAdvancementSchema = createInsertSchema(hourAdvancements).omit({ id: true, createdAt: true });
export type InsertHourAdvancement = z.infer<typeof insertHourAdvancementSchema>;
export type HourAdvancement = typeof hourAdvancements.$inferSelect;

export const teacherSchedules = pgTable("teacher_schedules", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  groupId: integer("group_id").notNull(),
  timeSlotId: integer("time_slot_id").notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
});

export const insertTeacherScheduleSchema = createInsertSchema(teacherSchedules).omit({ id: true });
export type InsertTeacherSchedule = z.infer<typeof insertTeacherScheduleSchema>;
export type TeacherSchedule = typeof teacherSchedules.$inferSelect;
