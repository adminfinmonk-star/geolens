import { and, eq } from "drizzle-orm";
import type { Db } from "./client.js";
import { prompt as promptTable } from "./pg-schema.js";
import { newId, type Prompt } from "./schema.js";
import { type DemoStore, getDemoStore } from "./seed.js";

export type PromptInput = {
  text: string;
  country_code?: string;
  status?: "active" | "paused" | "archived";
};

export interface PromptObservedMetrics {
  attempts: number;
  eligible_answers: number;
  mentioned_answers: number;
  failed_attempts: number;
  mention_rate: number | null;
}

/**
 * Observed prompt metrics derived only from immutable collection rows.
 * Error/blocked attempts are reported, but never included in the visibility
 * denominator. No synthetic ranking or estimated demand is produced here.
 */
export function promptObservedMetrics(
  store: DemoStore,
): Record<string, PromptObservedMetrics> {
  const ownBrandIds = new Set(
    store.brands.filter((brand) => brand.is_own).map((brand) => brand.id),
  );
  const ownMentionChatIds = new Set(
    store.mentions
      .filter(
        (mention) =>
          ownBrandIds.has(mention.brand_id) && mention.mention_count > 0,
      )
      .map((mention) => mention.chat_id),
  );

  const result: Record<string, PromptObservedMetrics> = {};
  for (const prompt of store.prompts) {
    const chats = store.chats.filter((chat) => chat.prompt_id === prompt.id);
    const eligible = chats.filter(
      (chat) => chat.status === "ok" || chat.status === "empty",
    );
    const mentioned = eligible.filter((chat) => ownMentionChatIds.has(chat.id));
    result[prompt.id] = {
      attempts: chats.length,
      eligible_answers: eligible.length,
      mentioned_answers: mentioned.length,
      failed_attempts: chats.filter(
        (chat) => chat.status === "error" || chat.status === "blocked",
      ).length,
      mention_rate:
        eligible.length === 0 ? null : mentioned.length / eligible.length,
    };
  }
  return result;
}

function toApi(p: {
  id: string;
  projectId: string;
  text: string;
  countryCode: string;
  status: string;
}): Prompt {
  return {
    id: p.id,
    project_id: p.projectId,
    text: p.text,
    country_code: p.countryCode,
    status: p.status as Prompt["status"],
  };
}

export async function listPrompts(
  db: Db | null,
  projectId: string,
): Promise<Prompt[] | null> {
  if (db) {
    const rows = await db
      .select()
      .from(promptTable)
      .where(eq(promptTable.projectId, projectId));
    return rows.map(toApi);
  }
  const store = await getDemoStore();
  if (store.project.id !== projectId) return null;
  return store.prompts;
}

export async function createPrompt(
  db: Db | null,
  projectId: string,
  input: PromptInput,
): Promise<Prompt | null> {
  const text = input.text.trim();
  if (!text) throw new Error("text_required");
  const country = (input.country_code ?? "US").toUpperCase().slice(0, 2);
  const status = input.status ?? "active";
  const id = newId("pr");

  if (db) {
    await db.insert(promptTable).values({
      id,
      projectId,
      text,
      countryCode: country,
      status,
    });
    return {
      id,
      project_id: projectId,
      text,
      country_code: country,
      status,
    };
  }

  const store = await getDemoStore();
  if (store.project.id !== projectId) return null;
  const row: Prompt = {
    id,
    project_id: projectId,
    text,
    country_code: country,
    status,
  };
  store.prompts.push(row);
  return row;
}

export async function updatePrompt(
  db: Db | null,
  projectId: string,
  promptId: string,
  input: Partial<PromptInput>,
): Promise<Prompt | null> {
  if (db) {
    const existing = await db
      .select()
      .from(promptTable)
      .where(
        and(
          eq(promptTable.id, promptId),
          eq(promptTable.projectId, projectId),
        ),
      )
      .limit(1);
    const row = existing[0];
    if (!row) return null;

    const text = input.text?.trim() ?? row.text;
    const countryCode = input.country_code
      ? input.country_code.toUpperCase().slice(0, 2)
      : row.countryCode;
    const status = input.status ?? row.status;

    await db
      .update(promptTable)
      .set({ text, countryCode, status })
      .where(eq(promptTable.id, promptId));

    return {
      id: promptId,
      project_id: projectId,
      text,
      country_code: countryCode,
      status: status as Prompt["status"],
    };
  }

  const store = await getDemoStore();
  if (store.project.id !== projectId) return null;
  const p = store.prompts.find((x) => x.id === promptId);
  if (!p) return null;
  if (input.text !== undefined) p.text = input.text.trim();
  if (input.country_code !== undefined) {
    p.country_code = input.country_code.toUpperCase().slice(0, 2);
  }
  if (input.status !== undefined) p.status = input.status;
  return p;
}

export async function getChatDetail(
  store: DemoStore,
  chatId: string,
) {
  const c = store.chats.find((x) => x.id === chatId);
  if (!c) return null;
  const prompt = store.prompts.find((p) => p.id === c.prompt_id);
  const mentions = store.mentions
    .filter((m) => m.chat_id === chatId)
    .map((m) => {
      const brand = store.brands.find((b) => b.id === m.brand_id);
      return {
        ...m,
        brand_name: brand?.name ?? m.brand_id,
        is_own: brand?.is_own ?? false,
      };
    });
  const sources = store.sources.filter((s) => s.chat_id === chatId);
  return {
    chat: c,
    prompt: prompt ?? null,
    mentions,
    sources,
  };
}

export function enrichChatRows(store: DemoStore, limit: number) {
  return store.chats
    .slice()
    .sort((a, b) => b.run_date.localeCompare(a.run_date))
    .slice(0, limit)
    .map((c) => {
      const prompt = store.prompts.find((p) => p.id === c.prompt_id);
      const mentionCount = store.mentions.filter(
        (m) => m.chat_id === c.id,
      ).length;
      return {
        ...c,
        prompt_text: prompt?.text ?? null,
        mention_count: mentionCount,
      };
    });
}
