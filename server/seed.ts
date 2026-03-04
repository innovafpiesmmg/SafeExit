import { storage } from "./storage";
import { db } from "./db";
import { users, groups, students, groupSchedules } from "@shared/schema";
import bcrypt from "bcrypt";

export async function seedDatabase() {
  const existingUsers = await storage.getAllUsers();
  if (existingUsers.length > 0) return;

  console.log("Seeding database...");

  const adminPassword = await bcrypt.hash("admin123", 10);
  const guardPassword = await bcrypt.hash("guard123", 10);

  await storage.createUser({ username: "admin", password: adminPassword, fullName: "Director García", role: "admin" });
  await storage.createUser({ username: "profesor1", password: guardPassword, fullName: "Prof. Martínez", role: "guard" });
  await storage.createUser({ username: "profesor2", password: guardPassword, fullName: "Prof. López", role: "guard" });

  const group1 = await storage.createGroup({ name: "1A", course: "1 ESO" });
  const group2 = await storage.createGroup({ name: "2B", course: "2 ESO" });
  const group3 = await storage.createGroup({ name: "1 BACH A", course: "1 Bachillerato" });
  const group4 = await storage.createGroup({ name: "2 BACH B", course: "2 Bachillerato" });

  await storage.createStudent({ firstName: "María", lastName: "García Fernández", dateOfBirth: "2010-03-15", course: "1 ESO", groupId: group1.id, photoUrl: null, parentalAuthorization: true });
  await storage.createStudent({ firstName: "Carlos", lastName: "López Martín", dateOfBirth: "2009-07-22", course: "1 ESO", groupId: group1.id, photoUrl: null, parentalAuthorization: true });
  await storage.createStudent({ firstName: "Ana", lastName: "Rodríguez Pérez", dateOfBirth: "2008-11-08", course: "2 ESO", groupId: group2.id, photoUrl: null, parentalAuthorization: false });
  await storage.createStudent({ firstName: "Pablo", lastName: "Hernández Ruiz", dateOfBirth: "2008-01-30", course: "2 ESO", groupId: group2.id, photoUrl: null, parentalAuthorization: true });
  await storage.createStudent({ firstName: "Laura", lastName: "Sánchez Díaz", dateOfBirth: "2007-05-12", course: "1 Bachillerato", groupId: group3.id, photoUrl: null, parentalAuthorization: true });
  await storage.createStudent({ firstName: "Miguel", lastName: "Torres Navarro", dateOfBirth: "2006-09-04", course: "2 Bachillerato", groupId: group4.id, photoUrl: null, parentalAuthorization: true });
  await storage.createStudent({ firstName: "Sofía", lastName: "Moreno Castillo", dateOfBirth: "2005-12-20", course: "2 Bachillerato", groupId: group4.id, photoUrl: null, parentalAuthorization: true });
  await storage.createStudent({ firstName: "Alejandro", lastName: "Jiménez Vega", dateOfBirth: "2004-02-14", course: "2 Bachillerato", groupId: group4.id, photoUrl: null, parentalAuthorization: true });

  for (const group of [group1, group2, group3, group4]) {
    await storage.setGroupSchedule(group.id, 1, 4, true);
    await storage.setGroupSchedule(group.id, 2, 4, true);
    await storage.setGroupSchedule(group.id, 3, 4, true);
    await storage.setGroupSchedule(group.id, 4, 4, true);
    await storage.setGroupSchedule(group.id, 5, 4, true);
  }

  for (const group of [group3, group4]) {
    await storage.setGroupSchedule(group.id, 1, 6, true);
    await storage.setGroupSchedule(group.id, 3, 6, true);
    await storage.setGroupSchedule(group.id, 5, 6, true);
  }

  console.log("Database seeded successfully!");
}
