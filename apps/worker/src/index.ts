export {
  type AnalyzeQueuePayload,
  type AnalyzeQueueResult,
  enqueueAnalyzeProject,
  getAnalyzeProjectJob,
  startAnalyzeWorker,
} from "./analyzeQueue.js";
export {
  buildCollectPayload,
  type CollectChannelResult,
  type CollectJobPayload,
  processCollectJob,
  runCollectEnrichJob,
} from "./collect.js";
export { collectJobKey } from "./jobKey.js";
export {
  projectCollectionIsDue,
  runProjectSchedulerTick,
  startProjectScheduler,
} from "./projectScheduler.js";
export {
  type CollectQueueMode,
  checkQueueReadiness,
  type EnqueueResult,
  enqueueCollectJob,
  queueMode,
  redisUrl,
  resetInlineJobState,
  setCollectJobHandler,
  startCollectWorker,
} from "./queue.js";
export {
  applyCollectResultToStore,
  runProjectCollectAndApply,
  type ScheduleCollectOptions,
  scheduleProjectCollect,
  snapshotProjectCollect,
} from "./schedule.js";

import { clearAdapterCache, loadRepoEnv } from "@geo/adapters";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startAnalyzeWorker } from "./analyzeQueue.js";
import { runCollectEnrichJob } from "./collect.js";
import { startProjectScheduler } from "./projectScheduler.js";
import { queueMode, startCollectWorker } from "./queue.js";

async function main() {
  loadRepoEnv();
  clearAdapterCache();
  process.env.GEO_ADAPTER_MODE = process.env.GEO_ADAPTER_MODE ?? "auto";
  if (process.env.NODE_ENV === "production") {
    const missing = ["DATABASE_URL", "REDIS_URL"].filter(
      (key) => !process.env[key]?.trim(),
    );
    if (missing.length) {
      throw new Error(`Missing production configuration: ${missing.join(", ")}`);
    }
  }
  const args = process.argv.slice(2);

  if (args[0] === "worker") {
    console.log(`Starting collect worker (mode=${queueMode()})`);
    const w = await startCollectWorker();
    const analyzeWorker = await startAnalyzeWorker();
    const scheduler = await startProjectScheduler();
    if (queueMode() === "inline") {
      console.log("REDIS_URL unset — nothing to consume; exiting");
      await w.close();
      await analyzeWorker.close();
      await scheduler.close();
      return;
    }
    console.log("Listening on queue geo-collect");
    process.on("SIGINT", () => {
      void Promise.all([w.close(), analyzeWorker.close(), scheduler.close()]).then(
        () => process.exit(0),
      );
    });
    return;
  }

  const result = await runCollectEnrichJob({
    prompt: "best CRM for a 20-person agency",
    countryCode: "US",
    runDate: "2026-09-01",
    brands: [
      { brandId: "br_acme", name: "Acme", aliases: [], patterns: [] },
      { brandId: "br_beta", name: "BetaSoft", aliases: ["Beta"], patterns: [] },
    ],
  });
  console.log(JSON.stringify(result, null, 2));
}

if (
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
