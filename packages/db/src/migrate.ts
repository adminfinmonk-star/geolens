import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations(
  connectionString = process.env.DATABASE_URL,
) {
  if (!connectionString) throw new Error("DATABASE_URL required");
  const sql = postgres(connectionString, { max: 1 });
  const dir = path.join(__dirname, "..", "drizzle");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const body = fs.readFileSync(path.join(dir, file), "utf8");
    await sql.unsafe(body);
  }
  await sql.end();
}

const isMain =
  process.argv[1]?.endsWith("migrate.ts") ||
  process.argv[1]?.endsWith("migrate.js");

if (isMain) {
  runMigrations()
    .then(() => {
      console.log("Migrations complete");
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
