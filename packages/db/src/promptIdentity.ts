import type { Prompt } from "./schema.js";

export function promptIdentity(text: string, country: string): string {
  return `${country.trim().toUpperCase()}|${text.trim().replace(/\s+/g, " ").toLowerCase()}`;
}

/** Prefer the version with evidence; keep every historical row intact. */
export function uniqueActivePrompts(store: {
  prompts: Prompt[];
  chats: { prompt_id: string }[];
}): Prompt[] {
  const counts = new Map<string, number>();
  for (const chat of store.chats) counts.set(chat.prompt_id, (counts.get(chat.prompt_id) ?? 0) + 1);
  const seen = new Set<string>();
  return store.prompts.filter((p) => p.status === "active")
    .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.id.localeCompare(b.id))
    .filter((p) => {
      const key = promptIdentity(p.text, p.country_code);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

type AnalysisPromptStore = {
  project: { domain?: string };
  prompts: Prompt[];
  chats: { prompt_id: string }[];
  analysisScope?: { domain: string; promptIds?: string[] };
};

/**
 * Active prompts that explicitly belong to the current domain analysis.
 * A legacy scope without prompt ids is fail-closed so unrelated active rows
 * cannot silently enter a report or scheduled collection.
 */
export function analysisScopedActivePrompts(store: AnalysisPromptStore): Prompt[] {
  const active = uniqueActivePrompts(store);
  const scope = store.analysisScope;
  if (!scope || scope.domain !== store.project.domain) return active;
  const allowed = new Set(scope.promptIds ?? []);
  return active.filter((prompt) => allowed.has(prompt.id));
}

/** Keep user-managed prompt versions attached to the current analysis scope. */
export function bindPromptToAnalysisScope(
  store: AnalysisPromptStore,
  promptId: string,
  replacesPromptId?: string,
) {
  const scope = store.analysisScope;
  if (!scope || scope.domain !== store.project.domain) return;
  const ids = new Set(scope.promptIds ?? []);
  if (replacesPromptId) ids.delete(replacesPromptId);
  ids.add(promptId);
  scope.promptIds = [...ids];
}
