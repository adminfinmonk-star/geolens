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
