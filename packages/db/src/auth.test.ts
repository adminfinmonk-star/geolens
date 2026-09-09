import { describe, expect, it } from "vitest";
import { hashSync, compareSync } from "bcryptjs";
import { AuthError } from "./auth.js";

describe("auth helpers", () => {
  it("hashes passwords with bcrypt", () => {
    const hash = hashSync("password123", 4);
    expect(compareSync("password123", hash)).toBe(true);
    expect(compareSync("wrong", hash)).toBe(false);
  });

  it("AuthError carries a code", () => {
    const err = new AuthError("email_taken", "taken");
    expect(err.code).toBe("email_taken");
  });
});
