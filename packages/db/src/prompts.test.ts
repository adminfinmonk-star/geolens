import { describe, expect, it } from "vitest";
import {
  createPrompt,
  getChatDetail,
  resetDemoStore,
  getDemoStore,
  updatePrompt,
  enrichChatRows,
} from "./index.js";

describe("prompts + chat detail (memory)", () => {
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
});
