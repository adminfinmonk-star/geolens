import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Db } from "./client.js";
import { apiKey } from "./pg-schema.js";
import { newId } from "./schema.js";

export type ApiKeyScope = "read" | "write" | "admin";

export interface ApiKeyRecord {
  id: string;
  organization_id: string;
  project_id: string | null;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: ApiKeyScope[];
  created_at: string;
  last_used_at?: string;
  revoked_at?: string;
}

/** In-memory keys for demo / tests without Postgres. */
const memoryKeys = new Map<string, ApiKeyRecord>();

function hashKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export function resetApiKeyStore() {
  memoryKeys.clear();
}

export async function createApiKey(
  db: Db | null,
  input: {
    organizationId: string;
    projectId?: string | null;
    name: string;
    scopes?: ApiKeyScope[];
  },
): Promise<{ record: ApiKeyRecord; plaintext: string }> {
  const id = newId("key");
  const secret = randomBytes(24).toString("base64url");
  const plaintext = `geo_${id.slice(4)}_${secret}`;
  const prefix = plaintext.slice(0, 12);
  const record: ApiKeyRecord = {
    id,
    organization_id: input.organizationId,
    project_id: input.projectId ?? null,
    name: input.name,
    key_prefix: prefix,
    key_hash: hashKey(plaintext),
    scopes: input.scopes ?? ["read"],
    created_at: new Date().toISOString(),
  };

  if (db) {
    await db.insert(apiKey).values({
      id: record.id,
      organizationId: record.organization_id,
      projectId: record.project_id,
      name: record.name,
      keyPrefix: record.key_prefix,
      keyHash: record.key_hash,
      scopesJson: JSON.stringify(record.scopes),
      createdAt: new Date(),
    });
  } else {
    memoryKeys.set(record.key_hash, record);
  }

  return { record: { ...record, key_hash: "***" }, plaintext };
}

export async function verifyApiKey(
  db: Db | null,
  plaintext: string | undefined,
): Promise<ApiKeyRecord | null> {
  if (!plaintext?.startsWith("geo_")) return null;
  const hash = hashKey(plaintext);

  if (db) {
    const rows = await db
      .select()
      .from(apiKey)
      .where(eq(apiKey.keyHash, hash))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    if (row.revokedAt) return null;
    await db
      .update(apiKey)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKey.id, row.id));
    return {
      id: row.id,
      organization_id: row.organizationId,
      project_id: row.projectId,
      name: row.name,
      key_prefix: row.keyPrefix,
      key_hash: row.keyHash,
      scopes: JSON.parse(row.scopesJson) as ApiKeyScope[],
      created_at: row.createdAt.toISOString(),
      last_used_at: row.lastUsedAt
        ? new Date(row.lastUsedAt as Date | string).toISOString()
        : undefined,
    };
  }

  const rec = memoryKeys.get(hash);
  if (!rec || rec.revoked_at) return null;
  rec.last_used_at = new Date().toISOString();
  return rec;
}

export function assertKeyCanAccessProject(
  key: ApiKeyRecord,
  projectId: string,
  projectOrgId: string,
): boolean {
  if (key.revoked_at) return false;
  if (key.organization_id !== projectOrgId) return false;
  if (key.project_id && key.project_id !== projectId) return false;
  return true;
}

export async function listApiKeys(
  db: Db | null,
  opts: { organizationId: string; projectId?: string },
): Promise<Omit<ApiKeyRecord, "key_hash">[]> {
  const scrub = (r: ApiKeyRecord) => ({
    id: r.id,
    organization_id: r.organization_id,
    project_id: r.project_id,
    name: r.name,
    key_prefix: r.key_prefix,
    scopes: r.scopes,
    created_at: r.created_at,
    last_used_at: r.last_used_at,
    revoked_at: r.revoked_at,
  });

  if (db) {
    const rows = await db.select().from(apiKey);
    return rows
      .filter(
        (r) =>
          r.organizationId === opts.organizationId &&
          (!opts.projectId ||
            r.projectId == null ||
            r.projectId === opts.projectId),
      )
      .map((r) =>
        scrub({
          id: r.id,
          organization_id: r.organizationId,
          project_id: r.projectId,
          name: r.name,
          key_prefix: r.keyPrefix,
          key_hash: "***",
          scopes: JSON.parse(r.scopesJson) as ApiKeyScope[],
          created_at: r.createdAt.toISOString(),
          last_used_at: r.lastUsedAt
            ? new Date(r.lastUsedAt as Date | string).toISOString()
            : undefined,
          revoked_at: r.revokedAt
            ? new Date(r.revokedAt as Date | string).toISOString()
            : undefined,
        }),
      );
  }

  return [...memoryKeys.values()]
    .filter(
      (r) =>
        r.organization_id === opts.organizationId &&
        (!opts.projectId ||
          r.project_id == null ||
          r.project_id === opts.projectId),
    )
    .map(scrub);
}

export async function revokeApiKey(
  db: Db | null,
  keyId: string,
): Promise<boolean> {
  if (db) {
    const rows = await db
      .select()
      .from(apiKey)
      .where(eq(apiKey.id, keyId))
      .limit(1);
    if (!rows[0]) return false;
    await db
      .update(apiKey)
      .set({ revokedAt: new Date() })
      .where(eq(apiKey.id, keyId));
    return true;
  }
  for (const [hash, rec] of memoryKeys) {
    if (rec.id === keyId) {
      rec.revoked_at = new Date().toISOString();
      memoryKeys.set(hash, rec);
      return true;
    }
  }
  return false;
}
