import Link from "next/link";
import { TrendChart } from "@/components/charts";
import { MarketingHeader } from "@/components/marketing-header";
import { CheckVisibilityCard } from "@/components/check-visibility-card";

const LOGOS = [
  "Casper",
  "HelloFresh",
  "MasterClass",
  "Amazon",
  "Adidas",
  "Datadog",
  "Attio",
  "Squarespace",
  "Brevo",
  "n8n",
];

const TOOLS = [
  {
    title: "Visibility Overview",
    body: "Measure AI visibility across platforms, topics, and regions.",
    href: "/prj_demo/overview",
    link: "Explore Overview",
  },
  {
    title: "Brand Performance",
    body: "See how AI talks about your brand and how positive those discussions are.",
    href: "/prj_demo/perception",
    link: "Explore Performance",
  },
  {
    title: "Competitor Research",
    body: "Find where competitors are mentioned over you, then close the gap.",
    href: "/prj_demo/competitors",
    link: "Explore Competitors",
  },
  {
    title: "Prompt Tracking",
    body: "Track the prompts that drive mentions and citations in AI answers.",
    href: "/prj_demo/prompts",
    link: "Explore Prompts",
  },
  {
    title: "AI-Cited Media",
    body: "See which outlets APIs cite most, then start showing up there.",
    href: "/prj_demo/sources",
    link: "Explore Sources",
  },
  {
    title: "Hallucination Shield",
    body: "Catch inaccurate AI claims about your brand before they spread.",
    href: "/prj_demo/perception",
    link: "Explore Shield",
  },
];

export default function MarketingPage() {
  return (
    <main className="mk-shell">
      <MarketingHeader />

      {/* Hero: Stitch / Semrush layout, GeoLens palette */}
      <section className="mk-hero-band">
        <div className="mk-wrap mk-hero-split">
          <div className="mk-hero-copy">
            <p className="mk-eyebrow">
              <span className="mk-eyebrow-mark" aria-hidden />
              GeoLens AI visibility features
            </p>
            <p className="mk-brand-hero">GeoLens</p>
            <h1 className="mk-hero-line mk-hero-line-wide">
              Inspect how AI APIs mention your brand
            </h1>
            <p className="mk-hero-sub">
              Retain raw provider responses, failures, model identity, and
              sample counts without claiming consumer-surface coverage.
            </p>
            <div className="mk-hero-cta">
              <Link href="/signup" className="mk-btn-pill mk-btn-soft">
                Try free for 7 days
              </Link>
              <Link href="/prj_demo/overview" className="mk-btn-pill mk-btn-outline">
                Get a demo
              </Link>
            </div>
          </div>
          <div className="mk-hero-visual">
            <CheckVisibilityCard />
          </div>
        </div>
      </section>

      <section className="mk-bridge mk-wrap">
        <h2>API responses change. Keep the evidence behind every observation.</h2>
        <div className="mk-logo-row" aria-label="Trusted by brands">
          {LOGOS.map((name) => (
            <span key={name} className="mk-logo-item">
              {name}
            </span>
          ))}
        </div>
      </section>

      {/* Three capability cards */}
      <section id="product" className="mk-section" style={{ paddingTop: 0 }}>
        <div className="mk-wrap mk-trio">
          <article className="mk-trio-card">
            <h3>Measure your AI presence</h3>
            <p>
              See how often your brand is mentioned across top AI platforms.
              Track visibility, position, and share of voice.
            </p>
            <div className="mk-trio-viz" aria-hidden>
              <div className="mk-mini-gauge">
                <strong>92</strong>
                <span>/100</span>
              </div>
              <ul className="mk-mini-platforms">
                <li>
                  <i style={{ background: "var(--chart-1)" }} /> ChatGPT{" "}
                  <b>41</b>
                </li>
                <li>
                  <i style={{ background: "var(--chart-2)" }} /> Perplexity{" "}
                  <b>73</b>
                </li>
                <li>
                  <i style={{ background: "var(--chart-3)" }} /> Gemini <b>58</b>
                </li>
              </ul>
            </div>
          </article>
          <article className="mk-trio-card">
            <h3>Benchmark competition</h3>
            <p>
              Find out who AI recommends when searchers ask questions in your
              category. See the gap. Close it.
            </p>
            <div className="mk-trio-viz" aria-hidden>
              <table className="mk-mini-table">
                <tbody>
                  {[
                    ["Monday", "85%"],
                    ["Salesforce", "82%"],
                    ["Attio", "47%"],
                  ].map(([n, v]) => (
                    <tr key={n}>
                      <td>{n}</td>
                      <td>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
          <article className="mk-trio-card">
            <h3>Grow your share of voice</h3>
            <p>
              Turn prompt gaps into content and outreach that put your brand in
              the answer, not the competition.
            </p>
            <div className="mk-trio-viz mk-trio-donut-wrap" aria-hidden>
              <svg className="mk-trio-donut" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="28" fill="none" stroke="#d8f3ef" strokeWidth="10" />
                <circle
                  cx="40"
                  cy="40"
                  r="28"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="10"
                  strokeDasharray="88 176"
                  strokeLinecap="round"
                  transform="rotate(-90 40 40)"
                />
              </svg>
              <span>You 28%</span>
            </div>
          </article>
        </div>
      </section>

      <section className="mk-section" style={{ paddingTop: 0 }}>
        <div className="mk-wrap">
          <div className="mk-quote">
            <p>
              GeoLens currently measures configured provider APIs. It does not
              claim that an API response reproduces ChatGPT, AI Mode, AI
              Overviews, or Copilot consumer interfaces.
            </p>
          </div>
        </div>
      </section>

      {/* Alternating deep features */}
      <section className="mk-section" style={{ paddingTop: 0 }}>
        <div className="mk-wrap" style={{ display: "grid", gap: "clamp(3.5rem, 7vw, 5.5rem)" }}>
          <FeatureRow
            kicker="Visibility"
            title="Track collected API evidence over time"
            body="Monitor OpenAI, Perplexity, Gemini, and Anthropic API responses with explicit sample sizes and retained failures."
            href="/prj_demo/overview"
            cta="View visibility"
            visual={<VisibilityMock />}
          />
          <FeatureRow
            kicker="Sentiment"
            title="Read the source responses"
            body="Review what each configured API returned and inspect the evidence behind extracted mentions."
            href="/prj_demo/perception"
            cta="View sentiment"
            reverse
            visual={<SentimentMock />}
          />
          <FeatureRow
            kicker="Prompts"
            title="Conduct prompt research"
            body="Find which prompts trigger brand mentions in your category. Spot topics you are absent from, then build content that puts you in the answer."
            href="/prj_demo/prompts"
            cta="Research new topics"
            visual={<PromptsMock />}
          />
        </div>
      </section>

      <section id="features" className="mk-section mk-band">
        <div className="mk-wrap">
          <h2 className="mk-section-title mk-section-title-center">
            Every tool you need for AI visibility
          </h2>
          <p className="mk-section-sub mk-section-sub-center">
            Visibility, prompts, competitors, sources, and actions in one
            workspace built for marketing teams.
          </p>
          <div className="mk-cap-grid">
            {TOOLS.map((c) => (
              <Link key={c.title} href={c.href} className="mk-cap">
                <span className="mk-icon" aria-hidden>
                  <CapIcon title={c.title} />
                </span>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
                <span className="mk-cap-link">{c.link} →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="methodology" className="mk-section">
        <div className="mk-wrap">
          <h2 className="mk-section-title mk-section-title-center">
            Trust is a product feature
          </h2>
          <p className="mk-section-sub mk-section-sub-center">
            GeoLens makes the collection boundary and evidence quality visible.
          </p>
          <div className="mk-ratings" aria-label="Methodology highlights">
            {[
              ["Teams", "Fast setup"],
              ["Agencies", "Multi-brand"],
              ["SEO leads", "Prompt gaps"],
            ].map(([name, score]) => (
              <div key={name} className="mk-rating">
                <strong>{score}</strong>
                <span>{name}</span>
              </div>
            ))}
          </div>
          <div className="mk-review-grid">
            {[
              {
                q: "Every reported mention links back to a retained response.",
                who: "Evidence lineage",
              },
              {
                q: "Failed attempts stay visible with provider and error details.",
                who: "Failure transparency",
              },
              {
                q: "API channels are named for the surface that was actually queried.",
                who: "Truthful identity",
              },
            ].map((r) => (
              <blockquote key={r.who} className="mk-review-card">
                <p>“{r.q}”</p>
                <footer>{r.who}</footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      <section className="mk-cta-band">
        <div className="mk-wrap" style={{ textAlign: "center" }}>
          <h2 className="mk-section-title mk-section-title-center">
            Start with inspectable API evidence
          </h2>
          <p className="mk-section-sub mk-section-sub-center">
            Start free, explore the live demo, or book a walkthrough with your team.
          </p>
          <div className="mk-hero-cta" style={{ justifyContent: "center" }}>
            <Link href="/signup" className="mk-btn-pill mk-btn-soft">
              Try free for 7 days
            </Link>
            <Link href="/prj_demo/overview" className="mk-btn-pill mk-btn-outline">
              Get a demo
            </Link>
          </div>
        </div>
      </section>

      <footer className="mk-footer">
        <div className="mk-wrap mk-footer-grid">
          <div>
            <BrandMark />
            <p className="mk-footer-tag">Inspectable AI API monitoring.</p>
          </div>
          <div>
            <h4>Product</h4>
            <a href="#product">Features</a>
            <Link href="/prj_demo/overview">Demo</Link>
            <Link href="/signup">Start free</Link>
          </div>
          <div>
            <h4>Platforms</h4>
            <span>OpenAI API</span>
            <span>Perplexity API</span>
            <span>Gemini API</span>
            <span>Anthropic API</span>
          </div>
          <div>
            <h4>Account</h4>
            <Link href="/login">Log in</Link>
            <Link href="/signup">Sign up</Link>
          </div>
        </div>
        <div className="mk-wrap mk-footer-bottom">
          <span>© {new Date().getFullYear()} GeoLens</span>
        </div>
      </footer>
    </main>
  );
}

function BrandMark() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span className="mk-logo-mark" aria-hidden>
        <span />
        <span />
        <span />
      </span>
      <span className="mk-header-brand-text">
        Geo<span>Lens</span>
      </span>
    </span>
  );
}

function FeatureRow({
  kicker,
  title,
  body,
  href,
  cta,
  visual,
  reverse,
}: {
  kicker: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className={`mk-feature${reverse ? " mk-feature-reverse" : ""}`}>
      <div className="mk-feature-copy">
        <p className="mk-eyebrow">
          <span className="mk-eyebrow-mark" aria-hidden />
          {kicker}
        </p>
        <h2 className="mk-feature-title">{title}</h2>
        <p className="mk-feature-body">{body}</p>
        <Link href={href} className="mk-btn-pill mk-btn-soft">
          {cta}
        </Link>
      </div>
      <div className="mk-feature-visual">{visual}</div>
    </div>
  );
}

function CapIcon({ title }: { title: string }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
  } as const;
  if (title.includes("Visibility")) {
    return (
      <svg {...common} aria-hidden>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  if (title.includes("Brand") || title.includes("Hallucination")) {
    return (
      <svg {...common} aria-hidden>
        <path d="M12 3l8 4v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" />
      </svg>
    );
  }
  if (title.includes("Competitor")) {
    return (
      <svg {...common} aria-hidden>
        <path d="M4 19V9M10 19V5M16 19v-7M22 19V8" strokeLinecap="round" />
      </svg>
    );
  }
  if (title.includes("Prompt")) {
    return (
      <svg {...common} aria-hidden>
        <path d="M5 7h14M5 12h10M5 17h12" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden>
      <path d="M8 7h11v11H8zM5 10h3M5 14h3" strokeLinejoin="round" />
    </svg>
  );
}

function VisibilityMock() {
  return (
    <div className="mk-mock-panel">
      <div className="mk-mock-kpis">
        {[
          ["Visibility", "47%"],
          ["Position", "2.4"],
          ["Share of voice", "18%"],
        ].map(([l, v]) => (
          <div key={l} className="mk-mock-kpi">
            <div className="lbl">{l}</div>
            <div className="val">{v}</div>
          </div>
        ))}
      </div>
      <TrendChart
        series={[
          { label: "You", color: "var(--chart-1)", points: [22, 28, 31, 36, 41, 47] },
          { label: "Category", color: "var(--chart-2)", points: [40, 42, 45, 48, 50, 52] },
        ]}
      />
    </div>
  );
}

function PromptsMock() {
  return (
    <div className="mk-mock-panel">
      <div className="mk-mock-title">High-value prompts</div>
      {[
        ["What are the best CRMs for startups?", "62%", "Present"],
        ["Attio vs HubSpot for agencies", "48%", "Present"],
        ["Modern CRM with flexible data model", "41%", "Gap"],
        ["CRM with Slack sync for agencies", "36%", "Gap"],
      ].map(([p, v, status]) => (
        <div key={p} className="mk-mock-prompt">
          <div className="txt">{p}</div>
          <div className="meta">
            <span className="mono">{v}</span>
            <span className={status === "Gap" ? "gap" : "ok"}>{status}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function SentimentMock() {
  return (
    <div className="mk-mock-panel">
      <div className="mk-mock-title">Share of voice vs sentiment</div>
      <div className="mk-sentiment-bubbles" aria-hidden>
        {[
          { n: "You", s: 72, x: "58%", y: "42%" },
          { n: "Mon", s: 88, x: "22%", y: "28%" },
          { n: "SF", s: 65, x: "74%", y: "62%" },
        ].map((b) => (
          <span
            key={b.n}
            className="mk-bubble"
            style={{
              left: b.x,
              top: b.y,
              width: 36 + b.s / 4,
              height: 36 + b.s / 4,
            }}
          >
            {b.n}
          </span>
        ))}
      </div>
    </div>
  );
}
