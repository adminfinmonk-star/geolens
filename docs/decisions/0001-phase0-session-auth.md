# Phase 0 auth approach

## Status
Accepted

## Context
BUILD_SPEC §4.1 lists better-auth (or Clerk). Our domain model uses prefixed ULIDs (`usr_`, `org_`, `prj_`) and §5 DDL for `app_user` / `organization` / `org_member`.

## Decision
Phase 0 ships a first-party email/password + httpOnly cookie session on Drizzle/`app_user`, creating org + project on signup (Phase 0 DoD). `better-auth` remains a dependency for a later swap once organization plugin mapping is designed.

## Consequences
- Signup → org → project works without Clerk.
- Multi-tenant RBAC starts with `org_member.role`.
- Migrating to better-auth later means mapping session tables; domain tables stay.
