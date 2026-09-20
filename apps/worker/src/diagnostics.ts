/** Safe, actionable summaries. Never expose a provider response or credential. */
export function collectionFailureDetail(code: string | undefined, raw: unknown): string | undefined {
  if (!code) return undefined;
  let diagnostic = code;
  if (raw && typeof raw === "object" && "error" in raw) diagnostic += ` ${JSON.stringify(raw.error)}`;
  if (/401|403|unauthorized|authentication|invalid.*key/i.test(diagnostic)) {
    return "Provider access rejected. Check the configured credential and account permissions.";
  }
  if (/402|quota|RESOURCE_EXHAUSTED|insufficient.*credit|balance/i.test(diagnostic)) {
    return "Provider quota or credits exhausted. Restore capacity before retrying.";
  }
  if (/429|rate.limit/i.test(diagnostic)) return "Provider rate limit reached. Wait before retrying or reduce collection concurrency.";
  if (/timeout|timed.out/i.test(diagnostic)) return "Provider request timed out. Retry collection after checking provider availability.";
  if (/HTTP_5\d\d/.test(diagnostic)) return "Provider service unavailable. Retry after the service recovers.";
  if (/missing|not.configured|no.*key/i.test(diagnostic)) return "Provider credential is missing. Configure access before collecting.";
  return "Collection failed. Review provider configuration and retry; this attempt is excluded from visibility scoring.";
}
