# Gap closure — Postgres feature persistence + authz

## Context

Phases 0–9 landed as a DemoStore-backed demo. Signup/Postgres projects only
had the chat spine; Actions, Perception, Shopping, and Agent Analytics were
empty. Report routes were largely unauthenticated.

## Decision

1. **`project_extension` table** — JSON payload for the DemoStore feature slice
   (actions, perception, shopping, agent, topics, etc.), keyed by `project_id`.
2. **`bootstrapProjectFeatures`** — on first `loadProjectStore`, seed own brand,
   minimal chats, then `ensure*` + actions so surfaces are non-empty.
3. **Authz chokepoint** — `userCanAccessProject` via `org_member`; Fastify
   `preHandler` on `/v1/projects/:projectId/*`. Unauthenticated access remains
   only for the public demo id `prj_demo` (CI/memory mode).

## Consequences

- Real signup projects get Perception/Shopping/Actions after first load.
- Feature mutations persist via `persistProjectStore` / extension upsert.
- Not a full normalized schema for every entity — intentional interim until
  dedicated tables land. Spine (brands/prompts/chats) stays relational.
