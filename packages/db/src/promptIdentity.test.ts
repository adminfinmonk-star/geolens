import { describe, expect, it } from "vitest";
import { promptIdentity, uniqueActivePrompts } from "./promptIdentity.js";

describe("prompt identity", () => {
  it("keeps the version with evidence and separates markets without mutating history", () => {
    const prompts = [
      { id: "new", project_id: "p", text: " Best  tools ", country_code: "us", status: "active" as const },
      { id: "old", project_id: "p", text: "best tools", country_code: "US", status: "active" as const },
      { id: "gb", project_id: "p", text: "best tools", country_code: "GB", status: "active" as const },
    ];
    expect(uniqueActivePrompts({ prompts, chats: [{ prompt_id: "old" }] }).map((p) => p.id)).toEqual(["old", "gb"]);
    expect(prompts.every((p) => p.status === "active")).toBe(true);
    expect(promptIdentity(" Best  tools ", "us")).toBe(promptIdentity("best tools", "US"));
  });
});
