import { createHash } from "node:crypto";

/** Spec §6.1 — idempotent BullMQ job id. */
export function collectJobKey(input: {
  projectId: string;
  promptId: string;
  channelId: string;
  countryCode: string;
  runDate: string;
}): string {
  const raw = [
    input.projectId,
    input.promptId,
    input.channelId,
    input.countryCode.toUpperCase(),
    input.runDate,
  ].join("|");
  return createHash("sha256").update(raw).digest("hex");
}
