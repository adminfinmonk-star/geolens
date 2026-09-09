import { describe, expect, it } from "vitest";
import {
  generateActionsForStore,
  impactFromStore,
  listActions,
  transitionAction,
} from "./actions.js";
import { getDemoStore, resetDemoStore } from "./seed.js";

describe("actions engine on demo store", () => {
  it("generates actions with evidence and impact markers", async () => {
    delete process.env.DATABASE_URL;
    resetDemoStore();
    const store = await getDemoStore();
    const { actions, regenerated } = generateActionsForStore(store, {
      force: true,
    });
    expect(regenerated).toBe(true);
    expect(actions.length).toBeGreaterThan(0);
    for (const a of actions) {
      expect(a.evidence.length).toBeGreaterThan(0);
      expect(a.id).toMatch(/^act_/);
    }

    const listed = listActions(store);
    expect(listed.rows.length).toBe(actions.length);

    const todo = listed.rows.find((a) => a.status === "new");
    expect(todo).toBeTruthy();
    const updated = transitionAction(store, todo!.id, "accept");
    expect(updated?.status).toBe("in_progress");
    transitionAction(store, todo!.id, "complete");
    expect(getActionStatus(store, todo!.id)).toBe("done");

    const impact = impactFromStore(store);
    expect(impact.series.length).toBeGreaterThan(0);
    expect(impact.markers.some((m) => m.kind === "done")).toBe(true);
    expect(impact.note).toMatch(/not causal/i);
  }, 60_000);
});

function getActionStatus(store: Awaited<ReturnType<typeof getDemoStore>>, id: string) {
  return store.actions.find((a) => a.id === id)?.status;
}
