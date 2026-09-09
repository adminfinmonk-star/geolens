# App chrome — Semrush-style dual-rail nav

> App only. Do not change marketing homepage.

**Stitch:** `0a1448ba2dd248e99877f4284c607ee8` · `design/stitch/sidebar-semrush.*`  
**Reference:** Semrush Local rail (user attachment) — icon+label rail, secondary panel, `<<` collapse

## Interaction

| Action | Result |
|--------|--------|
| Hover suite icon | Secondary panel **peeks** (overlay) for that suite |
| Leave rail + panel | Peek closes (unless pinned) |
| Click suite icon | Panel **pins** open and pushes content |
| Click `<< Collapse` | Hides secondary; icon rail stays |
| Click `Expand` / suite | Opens / pins secondary again |

## Suites → routes

- Analysis → overview, competitors, discovery  
- Brand → insights, perception, fact-checking  
- Monitor → prompts, sources/domains, actions  
- Results → chats, fanouts, ads  
- Settings → profile, brands, topics, channels, billing, api-keys, sso  

Persisted: `geo_nav_pinned`, `geo_nav_collapsed`
