import { describe, expect, it, vi } from "vitest";

import { hashPassword } from "@/lib/auth/auth-store";
import {
  createSession,
  isValidCredential,
  isValidSession,
} from "@/lib/auth/session";

const auth = {
  loginId: "owner",
  passwordHash: hashPassword("correct-password", "test-salt"),
  sessionSigningSecret: "test-session-signing-secret",
};

describe("session authentication", () => {
  it("accepts only credentials from the persistent auth configuration", () => {
    expect(isValidCredential("owner", "correct-password", auth)).toBe(true);
    expect(isValidCredential("admin", "admin", auth)).toBe(false);
  });

  it("creates a session that can be validated", () => {
    const token = createSession(auth);

    expect(isValidSession(token, auth)).toBe(true);
    expect(isValidSession(`${token}tampered`, auth)).toBe(false);
  });
  it("rejects extra token segments and non-ASCII signatures without throwing", () => {
    const token = createSession(auth);
    expect(isValidSession(`${token}.junk`, auth)).toBe(false);
    const expiresAt = token.split(".")[0];
    expect(isValidSession(`${expiresAt}.${"é".repeat(43)}`, auth)).toBe(false);
  });

  it("validates a session in a fresh server module context", async () => {
    const { createSession: createSessionInLoginRoute } = await import("@/lib/auth/session");
    const token = createSessionInLoginRoute(auth);

    vi.resetModules();
    const { isValidSession: validateSessionInPageRoute } = await import("@/lib/auth/session");

    expect(validateSessionInPageRoute(token, auth)).toBe(true);
    expect(validateSessionInPageRoute(token, { ...auth, sessionSigningSecret: "other-secret" })).toBe(false);
  });

  it("keeps sessions valid without an inactivity timeout", () => {
    vi.useFakeTimers();
    const token = createSession(auth);

    expect(token.split(".")[0]).toBe("0");
    vi.advanceTimersByTime(10 * 365 * 24 * 60 * 60 * 1_000);
    expect(isValidSession(token, auth)).toBe(true);

    vi.useRealTimers();
  });
});
