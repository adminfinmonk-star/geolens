import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageBreak,
  Paragraph,
  Header,
  Footer,
  PageNumber,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  ShadingType,
} from "docx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "..", "GeoLens_Product_Manual.docx");

const TEAL = "0D7377";
const INK = "1A2332";
const MUTED = "5A6A7D";
const SOFT = "D8F3F1";
const LINE = "D7E0EA";
const WHITE = "FFFFFF";

function img(name, width, height) {
  const buf = fs.readFileSync(path.join(__dirname, name));
  return new ImageRun({ type: "png", data: buf, transformation: { width, height }, altText: { title: name, description: name, name } });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160 },
    children: [new TextRun({ text, bold: true, color: TEAL, font: "Calibri" })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text, bold: true, color: INK, font: "Calibri" })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, bold: true, color: INK, font: "Calibri" })],
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    ...opts,
    children: [
      new TextRun({
        text,
        color: INK,
        font: "Calibri",
        size: 22,
        ...opts.run,
      }),
    ],
  });
}

function muted(text) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, color: MUTED, font: "Calibri", size: 20, italics: true })],
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, color: INK, font: "Calibri", size: 22 })],
  });
}

function numbered(text) {
  return new Paragraph({
    numbering: { reference: "numbers", level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, color: INK, font: "Calibri", size: 22 })],
  });
}

function caption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 200 },
    children: [new TextRun({ text, color: MUTED, font: "Calibri", size: 18, italics: true })],
  });
}

function figure(name, width, height, captionText) {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 60 },
      children: [img(name, width, height)],
    }),
    caption(captionText),
  ];
}

function cell(text, opts = {}) {
  const { bold = false, header = false, width = 2340 } = opts;
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: header ? { type: ShadingType.CLEAR, fill: TEAL } : undefined,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: LINE },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE },
      left: { style: BorderStyle.SINGLE, size: 4, color: LINE },
      right: { style: BorderStyle.SINGLE, size: 4, color: LINE },
    },
    children: [
      new Paragraph({
        spacing: { before: 60, after: 60 },
        children: [
          new TextRun({
            text,
            bold: bold || header,
            color: header ? WHITE : INK,
            font: "Calibri",
            size: 18,
          }),
        ],
      }),
    ],
  });
}

function table(headers, rows, widths) {
  const w = widths || headers.map(() => Math.floor(9360 / headers.length));
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    rows: [
      new TableRow({
        children: headers.map((h, i) => cell(h, { header: true, width: w[i] })),
      }),
      ...rows.map(
        (r) =>
          new TableRow({
            children: r.map((c, i) => cell(String(c), { width: w[i] })),
          }),
      ),
    ],
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

const doc = new Document({
  styles: {
    default: {
      document: {
        styles: [{ id: "Normal", run: { font: "Calibri", size: 22, color: INK } }],
      },
    },
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
      {
        reference: "numbers",
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
    ],
  },
  sections: [
    // —— Cover ——
    {
      properties: {
        page: {
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400 },
          children: [img("cover-geolens-manual.png", 620, 348)],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400 },
          children: [
            new TextRun({
              text: "Product Manual",
              bold: true,
              size: 56,
              color: TEAL,
              font: "Calibri",
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 120 },
          children: [
            new TextRun({
              text: "Personas, User Journeys & Feature Guide",
              size: 28,
              color: MUTED,
              font: "Calibri",
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400 },
          children: [
            new TextRun({
              text: "AI Search / GEO Analytics Platform",
              size: 22,
              color: INK,
              font: "Calibri",
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 80 },
          children: [
            new TextRun({
              text: "Audience: Product · Customer Success · Sales · New Users",
              size: 20,
              color: MUTED,
              font: "Calibri",
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 600 },
          shading: { type: ShadingType.CLEAR, fill: SOFT },
          children: [
            new TextRun({
              text: "  Demo: /prj_demo/overview  ·  Version 1.0  ",
              size: 20,
              color: TEAL,
              font: "Calibri",
            }),
          ],
        }),
        pageBreak(),
      ],
    },
    // —— Body ——
    {
      properties: {
        page: {
          margin: { top: 900, right: 900, bottom: 900, left: 900 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: "GeoLens Product Manual", color: TEAL, size: 16, font: "Calibri", bold: true }),
                new TextRun({ text: "  |  Confidential — Internal & Customer Use", color: MUTED, size: 16, font: "Calibri" }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "Page ", color: MUTED, size: 16, font: "Calibri" }),
                new TextRun({ children: [PageNumber.CURRENT], color: MUTED, size: 16, font: "Calibri" }),
                new TextRun({ text: " of ", color: MUTED, size: 16, font: "Calibri" }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], color: MUTED, size: 16, font: "Calibri" }),
              ],
            }),
          ],
        }),
      },
      children: [
        h1("1. What GeoLens is"),
        p(
          "People increasingly ask AI assistants (“What’s the best CRM for a 20-person agency?”) instead of searching keywords. GeoLens measures that channel and turns it into an operating system for marketers.",
        ),
        numbered("You define prompts — natural-language questions you want to be found for."),
        numbered("GeoLens runs them across AI engines / model channels (and countries)."),
        numbered(
          "Every answer becomes a chat — brands mentioned, order, sentiment, sources, citations, fanouts, ads, products.",
        ),
        numbered(
          "Chats roll up into visibility, share of voice, position, sentiment, plus source and shopping metrics.",
        ),
        numbered(
          "Gaps become ranked Actions; Perception and Fact-checking show how AI describes you; Agent analytics show crawl access and AI referral traffic.",
        ),
        p(
          "GeoLens is not a content writer, a classic SEO rank tracker, or an LLM observability tool. It recommends what to fix and where to show up — it does not write or publish content for you.",
        ),

        h1("2. Core concepts"),
        table(
          ["Term", "Meaning"],
          [
            ["Chat", "One prompt × one engine × one country × one day → one AI answer. Every metric drills back to chats."],
            ["Prompt", "A conversational question you track (not a keyword). Has topic, tags, country, lifecycle."],
            ["Model channel", "Stable surface ID (e.g. ChatGPT), independent of model version churn."],
            ["Source vs citation", "Source = URL retrieved. Citation = URL shown in the answer."],
            ["Brand vs source visibility", "Named in the answer vs your domain retrieved/cited."],
            ["Fanout", "Background search the model runs while answering."],
            ["Gap", "A domain/URL that helps competitors and never names you. Fuel for Actions."],
            ["Surface kind", "simulator / api / ui — API data is honest but not identical to consumer UI."],
          ],
          [2400, 6960],
        ),

        pageBreak(),
        h1("3. Who uses GeoLens (personas)"),
        muted("Seven primary personas span brand, agency, ecommerce, platform, and executive stakeholders."),
        ...figure("personas-overview.png", 600, 338, "Figure 1 — GeoLens user personas"),

        h2("3.1 Maya — Brand marketing lead"),
        bullet("Goal: Prove AI search is a channel; grow visibility and share of voice."),
        bullet("Cares about: Overview, Insights, Channels, Competitors, Actions, Impact, Perception."),
        bullet("Success: Weekly visibility up on priority topics; Actions completed with Impact markers."),

        h2("3.2 Jordan — Content / SEO / GEO specialist"),
        bullet("Goal: Close source gaps; get cited; fix crawl blocks."),
        bullet("Cares about: Sources, Gap Analysis, Domains/URLs, Fanouts, Crawlability, Crawl Insights, Action briefs."),
        bullet("Success: Gap list shrinking; robots.txt allows AI bots; crawled URLs become citations."),

        h2("3.3 Priya — Brand / product marketer"),
        bullet("Goal: Control narrative — attributes, objections, factual accuracy."),
        bullet("Cares about: Perception, Fact-checking, Brand profile, Chats."),
        bullet("Success: Perception gaps documented; contradicted claims fixed and re-checked."),

        h2("3.4 Sam — Ecommerce / merchandising"),
        bullet("Goal: SKU visibility and correct pricing in shopping-style AI answers."),
        bullet("Cares about: Shopping catalog, win rate, price drift, demand queries."),
        bullet("Success: Catalog matched; price drift actioned; win rate up on hero SKUs."),

        h2("3.5 Alex — Agency strategist"),
        bullet("Goal: Pitch and retain clients; allocate credits across projects."),
        bullet("Cares about: Pitch → customer conversion, Billing, Share links, client-safe views."),
        bullet("Success: Pitch converts with history preserved; clients see reports without Actions strategy."),

        h2("3.6 Riley — Technical / RevOps / platform"),
        bullet("Goal: Wire data into BI, agents, and SSO; keep quotas clean."),
        bullet("Cares about: API keys, MCP, SSO/SAML, Billing quotas."),
        bullet("Success: Dashboard = API = MCP numbers; SSO for enterprise users."),

        h2("3.7 Chris — Executive / stakeholder (often read-only)"),
        bullet("Goal: High-level trend without operating the tool daily."),
        bullet("Cares about: Overview, shared views (/share/...), Impact narrative."),
        bullet("Success: Shared link in board pack; no login required for read-only share."),

        pageBreak(),
        h1("4. Roles & access (RBAC)"),
        h2("Org roles"),
        table(
          ["Role", "Can do"],
          [
            ["Owner", "Everything: billing, API keys, SSO, all writes (including API/MCP)."],
            ["Admin", "All projects and configuration; no billing."],
            ["Member", "Read/write across projects; sees Actions."],
            ["Guest", "Only projects explicitly granted."],
          ],
          [2400, 6960],
        ),
        h2("Project roles (agency client seats)"),
        table(
          ["Role", "Can do"],
          [
            ["Editor", "Edit that project’s configuration."],
            ["Viewer", "Read-only reporting."],
          ],
          [2400, 6960],
        ),
        p(
          "Important: Actions (competitive strategy) are for org owner / admin / member — not project-only guests or viewers.",
        ),

        pageBreak(),
        h1("5. Application map"),
        muted("Use the left sidebar. Top bar: date range, channel/model filter, and ⌘K / Ctrl+K search."),
        ...figure("app-map.png", 600, 338, "Figure 2 — GeoLens application map"),
        table(
          ["Area", "Pages", "User outcome"],
          [
            ["Home", "Overview, Brand Insights, Channels", "Health of visibility + where you win/lose"],
            ["Brand", "Perception, Fact-checking, Competitors, Profile", "Narrative, accuracy, competitor set"],
            ["Prompts", "All prompts, Discovery, Topics", "What you track and coverage"],
            ["Sources", "Gaps, Domains, URLs", "Citation / retrieval optimization"],
            ["Actions", "Actions, Impact", "Prioritized work + measurement"],
            ["Results", "Chats, Fanouts, Ads", "Evidence and ad landscape"],
            ["Agent", "Crawlability, Crawl Insights, Referrals", "Bot access + AI traffic"],
            ["Shopping", "Shopping", "Catalog / SKU AI visibility"],
            ["Settings", "Billing, API keys, SSO", "Commercial + platform"],
          ],
          [1800, 3600, 3960],
        ),

        pageBreak(),
        h1("6. End-to-end user journeys"),

        h2("Journey A — First-time brand setup (Maya + Jordan)"),
        p("Goal: From zero to a trusted weekly dashboard in one sitting."),
        ...figure("journey-a-setup.png", 600, 338, "Figure 3 — Journey A: First-time setup"),
        table(
          ["Step", "Where", "What the user does"],
          [
            ["1", "Signup", "Create account; land in first project Overview."],
            ["2", "Brand profile", "Confirm identity fields; save as reviewed."],
            ["3", "Competitors", "Track or reject suggestions."],
            ["4", "Topics", "Add topics/tags; optional CSV import."],
            ["5", "Discovery", "Wizard → coverage → activate prompts."],
            ["6", "All prompts", "Activate/pause/archive; set countries."],
            ["7", "Channels", "Confirm engines collecting and adapter mode."],
            ["8", "Overview", "Read KPIs, trend, chats, top actions/domains."],
            ["9", "Share", "Create read-only share link for execs."],
          ],
          [900, 2100, 6360],
        ),
        p("Definition of done: Visibility / SoV / position / sentiment show numbers; opening a chat proves the pipeline."),

        h2("Journey B — Weekly GEO operating rhythm (Jordan)"),
        p("Goal: Continuous improvement loop."),
        ...figure("journey-b-weekly.png", 600, 338, "Figure 4 — Journey B: Weekly GEO rhythm"),
        table(
          ["Cadence", "Steps"],
          [
            ["Monday", "Overview + Insights; filter last 7 days."],
            ["Same day", "Gap Analysis → bookmark priorities."],
            ["Same day", "Actions → Generate → Accept top opportunities."],
            ["Mid-week", "Execute briefs outside GeoLens; mark steps complete."],
            ["Friday", "Impact: visibility sparkline + markers (directional, not causal)."],
            ["As needed", "Fanouts refine prompts; Crawlability fixes robots.txt."],
          ],
          [2400, 6960],
        ),

        pageBreak(),
        h2("Journey C — Narrative & trust (Priya)"),
        p("Goal: AI describes the brand accurately."),
        ...figure("journey-c-narrative.png", 600, 338, "Figure 5 — Journey C: Narrative & trust"),
        numbered("Perception: association vs prominence; biggest gap; objections."),
        numbered("Fact-checking: Contradicted / By fact / By category."),
        numbered("Open evidence Chats behind bad claims."),
        numbered("Update Brand profile; fix website/docs off-product."),
        numbered("Wait for next collection cycle; re-check Fact-checking."),

        h2("Journey D — Close a competitive gap (Maya + Jordan)"),
        p("Goal: Turn a Gap into a completed Action with Impact."),
        ...figure("journey-d-gap-impact.png", 600, 338, "Figure 6 — Journey D: Gap → Action → Impact"),
        numbered("Find: Gap Analysis shows high gap score domains/URLs."),
        numbered("Prioritize: Actions table by opportunity score and evidence."),
        numbered("Decide: Open action brief; Accept or Decline."),
        numbered("Execute: Toggle steps as external work finishes."),
        numbered("Measure: Complete → Impact chart shows marker."),

        pageBreak(),
        h2("Journey E — Ecommerce shopping visibility (Sam)"),
        ...figure("journey-e-shopping.png", 600, 338, "Figure 7 — Journey E: Shopping visibility"),
        numbered("Upload / ingest CSV catalog on Shopping."),
        numbered("Review product visibility, win rate, position, price drift."),
        numbered("Filter all products vs catalog-matched."),
        numbered("Inspect shopping queries / demand."),
        numbered("Confirm wrong prices in Fact-checking / Chats if present."),
        numbered("Fix feed/PDP; re-ingest; watch win rate and drift."),

        h2("Journey F — Agency pitch → retained client (Alex)"),
        ...figure("journey-f-agency.png", 600, 338, "Figure 8 — Journey F: Agency pitch to client"),
        numbered("Create pitch project with limited prompt allowance."),
        numbered("Seed brand profile + Discovery for prospect domain."),
        numbered("Run collection (simulator or live APIs)."),
        numbered("Build narrative: Overview + Insights + one strong Action."),
        numbered("Share read-only link with prospect."),
        numbered("On win: convert pitch → customer in place (history preserved)."),
        numbered("Allocate credits; invite client as project viewer."),
        numbered("Billing: monitor usage; pause only with eyes open (paused period data is lost)."),

        h2("Journey G — Platform integration (Riley)"),
        numbered("API keys: create (shown once), use x-api-key on /customer/v1/*."),
        numbered("External tools pull same metrics as dashboard (parity promise)."),
        numbered("MCP: connect assistants with same authz as the user."),
        numbered("SSO: configure IdP, test redirect, distribute SP metadata."),
        numbered("Crawl Insights + AI Referrals: connect Cloudflare / GA-style data."),

        h2("Journey H — Executive check-in (Chris)"),
        numbered("Opens shared link — no login."),
        numbered("Reads own-brand KPIs and brand comparison table."),
        numbered("Asks Maya: “What are we doing about the gap?” — Maya uses Actions/Impact."),

        pageBreak(),
        h1("7. Feature manual (by module)"),
        h2("7.1 Overview"),
        p("Headline brand metrics, trend/rank visuals, recent chats, top actions, top domains; share a view; jump via ⌘K."),
        h2("7.2 Brand Insights"),
        p("Topic × channel performance; strongest/weakest channel — answer “we win on ChatGPT but lose on Perplexity for topic X.”"),
        h2("7.3 Channels"),
        p("Per-engine health, visibility, chat volume, surface kind, collection mode / API key status."),
        h2("7.4–7.5 Brand profile & Competitors"),
        p("Edit identity and mark reviewed. Accept/reject suggested competitors. Position ranks include untracked brands by design."),
        h2("7.6 Perception"),
        p("Market attributes, objections, biggest gap cards — for messaging and positioning."),
        h2("7.7 Fact-checking"),
        p("Tabs: Contradicted / By fact / By category. Claims from AI chats judged against your asserted facts."),
        h2("7.8 Prompts, Topics, Discovery"),
        p("Create/edit/activate prompts; organize with topics/tags; CSV import; Discovery wizard with coverage report."),
        h2("7.9 Sources & Gap Analysis"),
        p("Domains/URLs metrics, classify, bookmark; Gap Analysis ranks pages that name competitors but not you."),
        h2("7.10 Actions & Impact"),
        p("Generate opportunity-scored recommendations; accept/decline/complete; Impact markers are correlational, not causal."),
        h2("7.11 Chats, Fanouts, Ads"),
        p("Atomic evidence runs; background queries; advertiser landscape when ads appear."),
        h2("7.12 Agent analytics"),
        p("Crawlability (robots.txt), Crawl Insights (bot visits), AI Referrals (floor, not total)."),
        h2("7.13 Shopping"),
        p("Catalog ingest, SKU visibility / win rate / position / price drift."),
        h2("7.14 Billing, API keys, SSO"),
        p("Plan & usage; upgrade; pause with data-loss warning; API key lifecycle; enterprise SAML."),

        pageBreak(),
        h1("8. Persona → screens cheat sheet"),
        table(
          ["Persona", "Start here", "Deep work", "Prove value"],
          [
            ["Maya", "Overview", "Insights, Actions", "Impact, Share"],
            ["Jordan", "Gaps", "Domains/URLs, Fanouts, Crawl", "Actions complete"],
            ["Priya", "Perception", "Fact-checking, Chats", "Cleared contradictions"],
            ["Sam", "Shopping", "Price drift, catalog", "Win rate"],
            ["Alex", "Billing / projects", "Pitch Discovery", "Shared client view"],
            ["Riley", "API keys / SSO", "MCP, Crawl ingest", "Parity checks"],
            ["Chris", "Share link", "—", "Impact story from Maya"],
          ],
          [1800, 2400, 3000, 2160],
        ),

        h1("9. Recommended first 30 days"),
        ...figure("timeline-30-days.png", 600, 338, "Figure 9 — First 30 days onboarding"),
        table(
          ["Days", "Focus"],
          [
            ["1–3", "Profile, competitors, Discovery, activate prompts, confirm Channels."],
            ["4–7", "Live with Overview + Chats; fix crawl blocks; bookmark top gaps."],
            ["8–14", "First Actions cycle; Perception + Fact-checking; Shopping catalog if ecom."],
            ["15–21", "Execute accepted actions; Fanouts refine prompts; Share stakeholder link."],
            ["22–30", "Impact review; API/MCP if needed; Billing quota hygiene; expand carefully."],
          ],
          [1800, 7560],
        ),

        pageBreak(),
        h1("10. Metrics glossary"),
        table(
          ["Metric", "Plain language"],
          [
            ["Visibility", "How often your brand is named in answers."],
            ["Share of voice (SoV)", "Your mention share vs other brands."],
            ["Position", "Average rank among all brands named (including untracked)."],
            ["Sentiment", "How positively you are described when named."],
            ["Retrieval / citation", "Your pages found vs explicitly cited."],
            ["Gap score", "How often a source helps competitors and not you."],
            ["Win rate (Shopping)", "How often your SKU wins vs alternatives."],
            ["Price drift", "AI-stated price diverges from your catalog."],
          ],
          [2800, 6560],
        ),

        h1("11. Plans, credits, and pausing"),
        bullet("Brand plans gate prompts, channels, projects, countries, frequency, and features (API, MCP, SSO)."),
        bullet("Agency plans use credits as allocation slots from prompts × models × run days — not a monthly spend wallet."),
        bullet("Pitch projects have smaller allowance; convert to customer without losing history."),
        bullet("Pause stops collection and frees allocation; data for the paused period is not recoverable."),

        h1("12. Integrations"),
        table(
          ["Surface", "Who", "Purpose"],
          [
            ["Web dashboard", "All personas", "Primary UX"],
            ["Share links", "Execs / clients", "Read-only KPIs"],
            ["Customer REST API", "Riley", "Automation, BI, custom apps"],
            ["MCP", "Riley / power users", "Assistants querying GeoLens data"],
            ["CSV", "Jordan / Sam", "Prompt import, catalog, log samples"],
            ["SAML SSO", "Enterprise", "Corporate login"],
            ["Cloudflare / GA-style", "Riley / Jordan", "Crawl Insights & AI Referrals"],
          ],
          [2800, 2400, 4160],
        ),

        pageBreak(),
        h1("13. Honesty & limitations"),
        numbered("Simulator / API / UI surfaces differ — label collection mode in Channels."),
        numbered("Impact is correlational — markers show when you worked, not proof of causation."),
        numbered("AI Referrals are a floor — not all assistant traffic is measurable."),
        numbered("Position includes untracked brands — rank can change when the market names someone new."),
        numbered("Some UI affordances (Overview Export, full Brands CRUD, Project/tags filter chips) may be incomplete in a given build."),

        h1("14. Demo & training path"),
        numbered("Marketing home → Open demo → /prj_demo/overview."),
        numbered("Walk Overview → Insights → Channels."),
        numbered("Open one Chat (prove atomic unit)."),
        numbered("Gap Analysis → one Action detail → Impact."),
        numbered("Perception → Fact-checking."),
        numbered("Crawlability → Shopping (if relevant)."),
        numbered("Settings: Billing quotas; API keys for technical buyers."),

        h1("15. Document control"),
        table(
          ["Field", "Value"],
          [
            ["Title", "GeoLens Product Manual"],
            ["Formats", "docs/PRODUCT_MANUAL.md + docs/GeoLens_Product_Manual.docx"],
            ["Assets", "docs/product-manual-assets/"],
            ["Update when", "Nav modules, personas, or commercial gates change"],
          ],
          [2400, 6960],
        ),
        muted("End of GeoLens Product Manual — Personas & User Journeys."),
      ],
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(outPath, buffer);
console.log("Wrote", outPath, `(${Math.round(buffer.length / 1024)} KB)`);
