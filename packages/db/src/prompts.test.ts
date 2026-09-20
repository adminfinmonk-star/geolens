import { describe, expect, it } from "vitest";
import {
  createPrompt,
  enrichChatRows,
  getChatDetail,
  getDemoStore,
  promptObservedMetrics,
  resetDemoStore,
  updatePrompt,
} from "./index.js";

describe("prompts + chat detail (memory)", () => {
  it("derives per-prompt visibility only from eligible collected answers", async () => {
    resetDemoStore();
    const store = await getDemoStore();
    const own = store.brands.find((brand) => brand.is_own)!;
    const prompt = store.prompts[0]!;
    const promptChats = store.chats.filter((chat) => chat.prompt_id === prompt.id);
    expect(promptChats.length).toBeGreaterThan(0);

    const metrics = promptObservedMetrics(store)[prompt.id]!;
    const eligible = promptChats.filter(
      (chat) => chat.status === "ok" || chat.status === "empty",
    );
    const mentioned = eligible.filter((chat) =>
      store.mentions.some(
        (mention) =>
          mention.chat_id === chat.id &&
          mention.brand_id === own.id &&
          mention.mention_count > 0,
      ),
    );

    expect(metrics.attempts).toBe(promptChats.length);
    expect(metrics.eligible_answers).toBe(eligible.length);
    expect(metrics.mentioned_answers).toBe(mentioned.length);
    expect(metrics.mention_rate).toBe(
      eligible.length === 0 ? null : mentioned.length / eligible.length,
    );
  });

  it("creates and archives prompts on the demo store", async () => {
    resetDemoStore();
    const created = await createPrompt(null, "prj_demo", {
      text: "CRM pricing comparison 2026",
      country_code: "gb",
    });
    expect(created?.country_code).toBe("GB");
    expect(created?.id.startsWith("pr_")).toBe(true);

    const updated = await updatePrompt(null, "prj_demo", created!.id, {
      status: "paused",
    });
    expect(updated?.status).toBe("paused");
  });

  it("returns chat detail with mentions and sources", async () => {
    resetDemoStore();
    const store = await getDemoStore();
    const ok = store.chats.find((c) => c.status === "ok");
    expect(ok).toBeTruthy();
    const detail = await getChatDetail(store, ok!.id);
    expect(detail?.chat.id).toBe(ok!.id);
    expect(detail?.prompt?.text).toBeTruthy();

    const rows = enrichChatRows(store, 3);
    expect(rows[0]?.prompt_text).toBeTruthy();
  });

  it("retains the original prompt when text or market changes", async () => {
    resetDemoStore();
    const store = await getDemoStore();
    const chat = store.chats[0]!;
    const original = store.prompts.find((prompt) => prompt.id === chat.prompt_id)!;
    const originalText = original.text;
    const version = await updatePrompt(null, store.project.id, original.id, {
      text: "An independent new research question",
      country_code: "GB",
    });
    expect(version?.id).not.toBe(original.id);
    expect(original.status).toBe("archived");
    expect((await getChatDetail(store, chat.id))?.prompt?.text).toBe(originalText);
    expect(promptObservedMetrics(store)[version!.id]?.attempts).toBe(0);
  });
});
