import { db } from "./db";
import { users, userProfiles, wallets } from "./schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("🌱 Seeding database...");

  // Check if admin already exists
  const existing = await db.query.users.findFirst({
    where: eq(users.email, "admin@agentmarket.com"),
  });

  if (existing) {
    console.log("✅ Admin already exists, skipping seed.");
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash("admin123secure", 10);

  // Create admin user
  const [admin] = await db
    .insert(users)
    .values({
      email: "admin@agentmarket.com",
      username: "admin",
      passwordHash,
      role: "admin",
      emailVerified: true,
    })
    .returning();

  // Create admin profile
  await db.insert(userProfiles).values({
    userId: admin.id,
    bio: "Platform administrator",
    tags: ["admin"],
  });

  // Create admin wallet
  await db.insert(wallets).values({
    userId: admin.id,
    balance: "0.00",
    escrowBalance: "0.00",
  });

  console.log(`✅ Admin seeded: ${admin.email} (id: ${admin.id})`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
