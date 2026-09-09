export { collectJobKey } from "./jobKey.js";
export {
  runCollectEnrichJob,
  processCollectJob,
  buildCollectPayload,
  type CollectJobPayload,
  type CollectChannelResult,
} from "./collect.js";
export {
  enqueueCollectJob,
  startCollectWorker,
  queueMode,
  redisUrl,
  resetInlineJobState,
  setCollectJobHandler,
  type EnqueueResult,
  type CollectQueueMode,
} from "./queue.js";
export {
  scheduleProjectCollect,
  applyCollectResultToStore,
  runProjectCollectAndApply,
  type ScheduleCollectOptions,
} from "./schedule.js";

import { runCollectEnrichJob } from "./collect.js";
import { startCollectWorker, queueMode } from "./queue.js";

async function main() {
  process.env.GEO_ADAPTER_MODE = process.env.GEO_ADAPTER_MODE ?? "fixture";
  const args = process.argv.slice(2);

  if (args[0] === "worker") {
    console.log(`Starting collect worker (mode=${queueMode()})`);
    const w = await startCollectWorker();
    if (queueMode() === "inline") {
      console.log("REDIS_URL unset — nothing to consume; exiting");
      await w.close();
      return;
    }
    console.log("Listening on queue geo-collect");
    process.on("SIGINT", () => {
      void w.close().then(() => process.exit(0));
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
  process.argv[1]?.endsWith("index.ts") ||
  process.argv[1]?.endsWith("index.js")
) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
