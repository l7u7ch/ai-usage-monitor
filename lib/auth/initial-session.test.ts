import { afterEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/lib/auth/auth-store";
import { isValidSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { POST as login } from "@/app/api/login/route";
import { POST as setup } from "@/app/api/setup/route";

const store = vi.hoisted(() => ({ read: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/auth/auth-store", async (original) => ({
  ...await original<typeof import("@/lib/auth/auth-store")>(),
  getAuthStore: () => store,
}));
afterEach(() => vi.useRealTimers());

describe("initial session lifetime", () => {
  it.each([["login", login], ["setup", setup]] as const)("%s issues a persistent cookie and non-expiring token", async (_name, handler) => {
    vi.useFakeTimers();
    const auth = { loginId: "owner", passwordHash: hashPassword("test-password", "salt"), sessionSigningSecret: "test-secret" };
    store.read.mockResolvedValue(auth);
    store.create.mockResolvedValue(auth);
    const response = await handler(new Request("http://localhost/api/login", {
      method: "POST",
      headers: { origin: "http://localhost", "content-type": "application/json" },
      body: JSON.stringify({ id: "owner", password: "test-password" }),
    }));
    expect(response.status).toBe(200);
    const cookie = response.cookies.get(SESSION_COOKIE_NAME)!;
    expect(cookie.maxAge).toBe(34_560_000);
    expect(cookie.value.split(".")[0]).toBe("0");
    expect(isValidSession(cookie.value, auth)).toBe(true);
    vi.advanceTimersByTime(43_200_000);
    expect(isValidSession(cookie.value, auth)).toBe(true);
  });
});
