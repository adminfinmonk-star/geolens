# Design agent tooling installed for GeoLens

## Skills (Cursor / agents)

| Skill | Path | Source |
|-------|------|--------|
| **Taste Skill** (`design-taste-frontend`) | `.cursor/skills/design-taste-frontend` + `.agents/skills/...` | https://www.tasteskill.dev/ |
| **Image to Code** | `.cursor/skills/image-to-code` | Leonxlnx/taste-skill |
| **Web Design Guidelines** | `.cursor/skills/web-design-guidelines` | vercel-labs/agent-skills |
| **Awesome Design** | `.cursor/skills/awesome-design` (+ `awesome-design-md/`) | VoltAgent/awesome-design-md |

Re-install Taste / Vercel skills:

```bash
npx skills add Leonxlnx/taste-skill --skill "design-taste-frontend"
npx skills add Leonxlnx/taste-skill --skill "image-to-code"
npx skills add vercel-labs/agent-skills --skill "web-design-guidelines"
```

## 21st MCP

Already wired in `.cursor/mcp.json`. Set `API_KEY_21ST` in `.env` (or Cursor MCP env) from https://21st.dev/mcp — then reload MCP / restart Cursor.

```json
{
  "mcpServers": {
    "21st": {
      "url": "https://21st.dev/api/mcp",
      "headers": { "x-api-key": "${API_KEY_21ST}" }
    }
  }
}
```

## Playwright CLI

Dev dependency `@playwright/cli` at repo root:

```bash
pnpm exec playwright-cli --help
pnpm exec playwright-cli open http://localhost:3010
```

## GeoLens brand reminder

When using these design skills on this product, keep **teal `#0F766E`**, Plus Jakarta Sans, and light theme — do not adopt purple/indigo defaults from generic templates.
