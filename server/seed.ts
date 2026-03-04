import { storage } from "./storage";
import bcrypt from "bcrypt";

export async function seedDatabase() {
  const existingUsers = await storage.getAllUsers();
  if (existingUsers.length === 0) {
    console.log("Seeding database...");

    const adminUser = process.env.ADMIN_USER || "admin";
    const adminPass = process.env.ADMIN_PASS || "admin123";
    const adminName = process.env.ADMIN_NAME || "Administrador";

    const adminPassword = await bcrypt.hash(adminPass, 10);
    await storage.createUser({ username: adminUser, password: adminPassword, fullName: adminName, role: "admin" });

    console.log(`Admin user '${adminUser}' created successfully.`);
  }

  const tokensGenerated = await storage.generateCarnetTokens();
  if (tokensGenerated > 0) {
    console.log(`Generated carnet tokens for ${tokensGenerated} existing student(s).`);
  }
}
