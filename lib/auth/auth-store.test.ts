import { access, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { AuthStore, isValidPassword } from "@/lib/auth/auth-store";
import { createSession, isValidSession } from "@/lib/auth/session";

describe("AuthStore", () => {
  it("allows only one simultaneous password change across store instances", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "codex-dashboard-auth-"));
    const store = new AuthStore(root);
    await store.create("owner", "old-password");
    const outcomes = await Promise.allSettled([
      store.changePassword("old-password", "first-password"),
      new AuthStore(root).changePassword("old-password", "second-password"),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled" && outcome.value === true)).toHaveLength(1);
    const auth = await store.read();
    expect(["first-password", "second-password"].filter((password) => isValidPassword(password, auth!.passwordHash))).toHaveLength(1);
  });
  it("rejects a stale session even when the password is unchanged", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "codex-dashboard-auth-"));
    const store = new AuthStore(root);
    const auth = await store.create("owner", "password");
    expect(await store.changePassword("password", "password", auth.sessionSigningSecret)).toBe(true);
    expect(await store.changePassword("password", "attacker-password", auth.sessionSigningSecret)).toBe(false);
    expect(isValidPassword("password", (await store.read())!.passwordHash)).toBe(true);
  });
  it("changes the password and invalidates existing sessions", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "codex-dashboard-auth-"));
    const store = new AuthStore(root);
    const original = await store.create("owner", "old-password");
    const token = createSession(original);
    expect(await store.changePassword("wrong", "new-password")).toBe(false);
    expect(await store.changePassword("old-password", "new-password")).toBe(true);
    const updated = await store.read();
    expect(updated?.loginId).toBe("owner");
    expect(isValidPassword("new-password", updated!.passwordHash)).toBe(true);
    expect(isValidPassword("old-password", updated!.passwordHash)).toBe(false);
    expect(isValidSession(token, updated)).toBe(false);
  });
  it("does not provision default credentials before setup", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "codex-dashboard-auth-"));
    const store = new AuthStore(root);
    expect(await store.read()).toBeNull();
    await expect(access(path.join(root, "auth-v2.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("creates a chosen account once with private persistent credentials", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "codex-dashboard-auth-"));
    const store = new AuthStore(root);
    const auth = await store.create("owner", "strong-secret-password");
    expect(auth.loginId).toBe("owner");
    expect(isValidPassword("strong-secret-password", auth.passwordHash)).toBe(true);
    expect(isValidPassword("admin", auth.passwordHash)).toBe(false);
    expect(auth.sessionSigningSecret).toMatch(/^.{32,}$/);
    expect((await stat(path.join(root, "auth-v2.json"))).mode & 0o777).toBe(0o600);
    expect(JSON.parse(await readFile(path.join(root, "auth-v2.json"), "utf8"))).toEqual(auth);
    await expect(new AuthStore(root).create("attacker", "another-secret-password")).rejects.toMatchObject({ code: "EEXIST" });
    expect(await store.read()).toEqual(auth);
  });

  it("reuses the stored credentials across AuthStore instances", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "codex-dashboard-auth-"));
    const first = await new AuthStore(root).create("owner", "strong-secret-password");
    expect(await new AuthStore(root).read()).toEqual(first);
  });

  it("ignores legacy credentials and requires a fresh account", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "codex-dashboard-auth-"));
    await writeFile(path.join(root, "auth.json"), JSON.stringify({ loginId: "admin" }));
    const store = new AuthStore(root);
    expect(await store.read()).toBeNull();
    expect((await store.create("owner", "strong-secret-password")).loginId).toBe("owner");
  });
});