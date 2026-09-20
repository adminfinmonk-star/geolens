import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const web = fileURLToPath(new URL("../apps/web/", import.meta.url));
const distDir = process.env.GEO_NEXT_DIST_DIR ?? ".next-release-20260920";
if (!existsSync(path.join(web, distDir, "BUILD_ID"))) {
  throw new Error(`Build ${distDir} first: set GEO_NEXT_DIST_DIR and run pnpm --filter @geo/web build.`);
}
const require = createRequire(path.join(web, "package.json"));
const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "-p", process.env.PORT ?? "3010"], {
  cwd: web, env: { ...process.env, GEO_NEXT_DIST_DIR: distDir }, stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
