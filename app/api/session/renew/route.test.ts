import { NextRequest } from "next/server";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, isValidSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";

const { read } = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/auth/auth-store", () => ({ getAuthStore: () => ({ read }), isValidPassword: vi.fn() }));
const auth = { loginId: "owner", passwordHash: "unused", sessionSigningSecret: "test-secret" };

async function renew(token?: string, activityAt = Date.now(), origin = "http://localhost") {
  const { POST } = await import("./route");
  return POST(new NextRequest("http://localhost/api/session/renew", {
    method: "POST",
    headers: { origin, "content-type": "application/json", ...(token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {}) },
    body: JSON.stringify({ activityAt }),
  }));
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-01-01T00:00:00Z")); read.mockResolvedValue(auth); });
afterEach(() => vi.useRealTimers());

describe("activity renewal", () => {
  it("refreshes persistent storage without expiring the signed session", async () => {
    const token = createSession(auth);
    vi.advanceTimersByTime(60_000);
    const activityAt = Date.now();
    vi.advanceTimersByTime(30_000);
    const response = await renew(token, activityAt);
    expect(response.status).toBe(200);
    const cookie = response.cookies.get(SESSION_COOKIE_NAME)!;
    expect(cookie.value.split(".")[0]).toBe("0");
    expect(cookie.expires).toEqual(new Date(activityAt + 34_560_000_000));
    expect(isValidSession(cookie.value, auth)).toBe(true);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it.each([undefined, "invalid", "123.bad"])("rejects missing/invalid token %s without setting a cookie", async (token) => {
    const response = await renew(token);
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("never revives a session at or after its expiry, even for earlier activity", async () => {
    const expiry = String(Date.now() + 43_200_000);
    const token = `${expiry}.${createHmac("sha256", auth.sessionSigningSecret).update(expiry).digest("base64url")}`;
    vi.advanceTimersByTime(43_200_000);
    for (const delay of [0, 1]) {
      vi.advanceTimersByTime(delay);
      const response = await renew(token, Date.now() - 1_000);
      expect(response.status).toBe(401);
      expect(response.headers.get("set-cookie")).toBeNull();
    }
  });
  it("rejects cross-origin and missing-origin requests", async () => {
    for (const origin of ["https://other.example", ""]) {
      expect((await renew(createSession(auth), Date.now(), origin)).status).toBe(403);
    }
  });
  it("rejects future, stale, and malformed activity timestamps", async () => {
    for (const at of [Date.now() + 1, Date.now() - 60_001, 1.5]) {
      const response = await renew(createSession(auth), at);
      expect(response.status).toBe(400);
      expect(response.headers.get("set-cookie")).toBeNull();
    }
  });
  it("refreshes persistent storage for delayed activity", async () => {
    const token = createSession(auth);
    const response = await renew(token, Date.now() - 1_000);
    expect(response.status).toBe(200);
    expect(response.cookies.get(SESSION_COOKIE_NAME)?.value).toBe(token);
  });
  it("rejects removed auth configuration", async () => {
    read.mockResolvedValue(null);
    const response = await renew(createSession(auth));
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("accepts same-origin renewal behind a TLS proxy and sets a secure cookie in production", async () => {
    const token = createSession(auth);
    vi.advanceTimersByTime(1_000);
    vi.stubEnv("NODE_ENV", "production");
    try {
      const { POST } = await import("./route");
      const response = await POST(new NextRequest("http://localhost:3000/api/session/renew", {
        method: "POST",
        headers: { origin: "https://dashboard.example", host: "dashboard.example", "x-forwarded-proto": "https", cookie: `${SESSION_COOKIE_NAME}=${token}` },
        body: JSON.stringify({ activityAt: Date.now() }),
      }));
      expect(response.status).toBe(200);
      expect(response.headers.get("set-cookie")).toContain("Secure");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
