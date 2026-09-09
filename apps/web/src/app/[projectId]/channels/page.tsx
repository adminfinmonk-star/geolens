import Link from "next/link";
import { apiFetch } from "@/lib/api-server";

type ChannelRow = {
  channel_id: string;
  description: string;
  surface_kind: string;
  geo_capability: string;
  chat_count: number;
  visibility: number;
  health: { status: string; reason?: string };
  version_history: { modelId: string; effectiveFrom: string; note?: string }[];
  adapter_mode?: string | null;
  key_present?: boolean;
};

type Runtime = {
  GEO_ADAPTER_MODE: string;
  channels: {
    channel_id: string;
    mode: string;
    key_present: boolean;
    provider?: string;
    route_note?: string;
  }[];
  honesty: string;
  routing_policy?: string;
};

async function fetchChannels(projectId: string): Promise<{
  rows: ChannelRow[];
  providers: string[];
} | null> {
  try {
    const res = await apiFetch(`/v1/projects/${projectId}/reports/channels`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchRuntime(): Promise<Runtime | null> {
  try {
    const res = await apiFetch(`/v1/adapters/runtime`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function pct(n: number) {
  return `${(n * 100).toFixed(0)}%`;
}

function providerLabel(channelId: string) {
  if (channelId.startsWith("copilot")) return "Copilot";
  if (channelId.startsWith("google-ai")) return "Google";
  const root = channelId.split("-")[0] ?? channelId;
  const map: Record<string, string> = {
    openai: "OpenAI",
    perplexity: "Perplexity",
    anthropic: "Anthropic / Claude",
    google: "Google / Gemini",
    sim: "Simulator",
    xai: "xAI",
    mistral: "Mistral",
  };
  return map[root] ?? root;
}

function healthLabel(status: string) {
  const s = status.toLowerCase();
  if (s === "ok" || s === "healthy") return { text: "Healthy", warm: false };
  if (s === "degraded" || s === "warn") return { text: status, warm: true };
  return { text: status, warm: true };
}

export default async function ChannelsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [data, runtime] = await Promise.all([
    fetchChannels(projectId),
    fetchRuntime(),
  ]);

  const modeById = Object.fromEntries(
    (runtime?.channels ?? []).map((c) => [c.channel_id, c]),
  );

  const rows = data?.rows ?? [];
  const healthy = rows.filter(
    (r) => r.health.status.toLowerCase() === "ok",
  ).length;
  const live = rows.filter((r) => {
    const rt = modeById[r.channel_id];
    const mode = rt?.mode ?? r.adapter_mode ?? "fixture";
    return mode !== "fixture";
  }).length;
  const totalChats = rows.reduce((s, r) => s + r.chat_count, 0);
  const avgVis =
    rows.length > 0
      ? rows.reduce((s, r) => s + r.visibility, 0) / rows.length
      : 0;

  return (
    <div className="geo-vis">
      <header className="geo-vis-header">
        <div>
          <div className="geo-vis-title-row">
            <h1>Channels</h1>
            <span className="geo-badge geo-badge-neutral">LLM coverage</span>
          </div>
          <p className="geo-page-lede">
            Models and assistants you collect AI answers from — health,
            visibility, and collection mode.
          </p>
        </div>
        <div className="geo-vis-actions">
          <Link
            href={`/${projectId}/prompts`}
            className="geo-btn geo-btn-ghost geo-btn-sm"
          >
            Prompt Tracking
          </Link>
          <Link
            href={`/${projectId}/billing`}
            className="geo-btn geo-btn-primary geo-btn-sm"
          >
            Billing &amp; quota
          </Link>
        </div>
      </header>

      {!data && (
        <p className="ob-error">
          Couldn&apos;t load channels. Check that the API is running.
        </p>
      )}

      {data && (
        <>
          <div className="geo-vis-kpis">
            <article className="geo-vis-kpi">
              <p className="geo-vis-kpi-label">Enabled channels</p>
              <p className="geo-vis-kpi-value">{rows.length}</p>
              <p className="geo-vis-kpi-meta">
                {data.providers.length} providers
              </p>
            </article>
            <article className="geo-vis-kpi">
              <p className="geo-vis-kpi-label">Healthy</p>
              <p className="geo-vis-kpi-value">
                {healthy}/{rows.length || 0}
              </p>
              <p className="geo-vis-kpi-meta">Ok status</p>
            </article>
            <article className="geo-vis-kpi">
              <p className="geo-vis-kpi-label">Collection mode</p>
              <p className="geo-vis-kpi-value" style={{ fontSize: "1.15rem" }}>
                {runtime?.GEO_ADAPTER_MODE ?? "—"}
              </p>
              <p className="geo-vis-kpi-meta">{live} live · fixture otherwise</p>
            </article>
            <article className="geo-vis-kpi">
              <p className="geo-vis-kpi-label">Chats collected</p>
              <p className="geo-vis-kpi-value">{totalChats}</p>
              <p className="geo-vis-kpi-meta">Avg vis {pct(avgVis)}</p>
            </article>
          </div>

          <div className="geo-pr-layout">
            <section className="geo-panel geo-vis-panel" style={{ padding: 0 }}>
              <div className="geo-comp-table-wrap">
                <table className="geo-comp-table">
                  <thead>
                    <tr>
                      <th>Channel</th>
                      <th>Provider</th>
                      <th>Status</th>
                      <th>Collection</th>
                      <th>Visibility</th>
                      <th>Chats</th>
                      <th>Geo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const rt = modeById[r.channel_id];
                      const collection =
                        rt?.mode ?? r.adapter_mode ?? "fixture";
                      const keyOk = Boolean(rt?.key_present ?? r.key_present);
                      const health = healthLabel(r.health.status);
                      return (
                        <tr key={r.channel_id}>
                          <td>
                            <strong>{r.description}</strong>
                            <small className="geo-pr-row-meta">
                              {r.channel_id}
                            </small>
                          </td>
                          <td>{providerLabel(r.channel_id)}</td>
                          <td>
                            <span
                              className={`geo-badge ${
                                health.warm
                                  ? "geo-badge-warm"
                                  : "geo-badge-neutral"
                              }`}
                            >
                              {health.text}
                            </span>
                          </td>
                          <td>
                            {collection}
                            <small className="geo-pr-row-meta">
                              {keyOk ? "API key set" : "Using fixtures"}
                            </small>
                          </td>
                          <td>
                            {pct(r.visibility)}
                            <div
                              className="geo-vis-bar-track"
                              style={{ marginTop: 6, maxWidth: 88 }}
                            >
                              <span
                                style={{
                                  width: `${Math.min(100, r.visibility * 100)}%`,
                                }}
                              />
                            </div>
                          </td>
                          <td>{r.chat_count}</td>
                          <td>
                            {r.geo_capability === "none"
                              ? "Not localized"
                              : r.geo_capability}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="geo-pr-side">
              <section className="geo-panel geo-vis-panel">
                <h2 className="geo-section-title" style={{ marginTop: 0 }}>
                  Fixture vs live
                </h2>
                <p className="geo-vis-note" style={{ marginTop: 0 }}>
                  {runtime?.honesty ??
                    "Unset vendor keys stay on fixtures — demo numbers are honest about that."}
                </p>
                {runtime?.routing_policy && (
                  <p className="geo-vis-note">
                    <strong>Routing: </strong>
                    {runtime.routing_policy}
                  </p>
                )}
              </section>
              <section className="geo-panel geo-vis-panel">
                <h2 className="geo-section-title" style={{ marginTop: 0 }}>
                  Related
                </h2>
                <div
                  className="geo-vis-actions"
                  style={{ flexDirection: "column", alignItems: "stretch" }}
                >
                  <Link
                    href={`/${projectId}/topics`}
                    className="geo-btn geo-btn-ghost geo-btn-sm"
                  >
                    Topics &amp; tags
                  </Link>
                  <Link
                    href={`/${projectId}/settings/api-keys`}
                    className="geo-btn geo-btn-ghost geo-btn-sm"
                  >
                    API keys
                  </Link>
                </div>
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
