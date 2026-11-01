import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthStore, isValidPassword } from "@/lib/auth/auth-store";
import { createSession, isValidSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";

const { getAuthStoreMock } = vi.hoisted(() => ({ getAuthStoreMock: vi.fn() }));
vi.mock("@/lib/auth/auth-store", async (original) => ({ ...await original<typeof import("@/lib/auth/auth-store")>(), getAuthStore: getAuthStoreMock }));
import { POST } from "@/app/api/password/route";

let store: AuthStore;
let token: string;
function request(body: unknown, origin = "http://localhost", session = token) {
  return new NextRequest("http://localhost/api/password", { method: "POST", headers: { origin, cookie: `${SESSION_COOKIE_NAME}=${session}`, "content-type": "application/json" }, body: JSON.stringify(body) });
}
describe("password change", () => {
  beforeEach(async () => {
    store = new AuthStore(await mkdtemp(path.join(tmpdir(), "password-test-")));
    const auth = await store.create("owner", "old");
    token = createSession(auth);
    getAuthStoreMock.mockReturnValue(store);
  });
  it("requires same origin, an authenticated session, and the current password", async () => {
    expect((await POST(request({ currentPassword: "old", newPassword: "new" }, "http://other"))).status).toBe(403);
    expect((await POST(request({ currentPassword: "old", newPassword: "new" }, "http://localhost", "invalid"))).status).toBe(401);
    expect((await POST(request({ currentPassword: "wrong", newPassword: "new" }))).status).toBe(400);
    expect((await POST(request({ currentPassword: "old", newPassword: "" }))).status).toBe(400);
    expect(isValidPassword("old", (await store.read())!.passwordHash)).toBe(true);
  });
  it("updates the password and revokes the session", async () => {
    expect((await POST(request({ currentPassword: "old", newPassword: "new" }))).status).toBe(200);
    const auth = await store.read();
    expect(isValidPassword("new", auth!.passwordHash)).toBe(true);
    expect(isValidSession(token, auth)).toBe(false);
  });
});
