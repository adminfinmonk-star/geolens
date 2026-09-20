import { describe, expect, it } from "vitest";
import { parseRedis } from "./queue.js";

describe("Redis connection configuration", () => {
  it("preserves TLS, credentials and database for every queue", () => {
    expect(parseRedis("rediss://user:p%40ss@cache.example:6380/3")).toEqual({ host: "cache.example", port: 6380, username: "user", password: "p@ss", db: 3, tls: {}, maxRetriesPerRequest: null });
    expect(() => parseRedis("https://cache.example")).toThrow("Invalid Redis protocol");
    expect(() => parseRedis("redis://cache.example/not-a-db")).toThrow("Invalid Redis database");
  });
});
