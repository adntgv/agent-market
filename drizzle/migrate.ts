import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function runMigrations() {
  console.log("🔄 Running migrations...");
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool);

  await migrate(db, { migrationsFolder: "./drizzle/migrations" });

  console.log("✅ Migrations complete.");
  await pool.end();
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
