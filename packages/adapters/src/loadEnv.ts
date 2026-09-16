import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Load repo-root `.env` into process.env without overriding existing keys.
 * tsx/node do not load a parent .env unless --env-file is passed; Analyze
 * was falling back to fixtures even when OPENROUTER_API_KEY was on disk.
 */
export function loadRepoEnv(): string | null {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env.GEO_ENV_FILE,
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../.env"),
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(here, "../../../.env"),
    path.resolve(here, "../../../../.env"),
  ].filter((p): p is string => Boolean(p));

  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    applyEnvFile(file);
    return file;
  }
  return null;
}

function applyEnvFile(file: string) {
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key || key in process.env) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
