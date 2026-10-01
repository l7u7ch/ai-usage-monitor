import { createHmac, timingSafeEqual } from "node:crypto";

import type { AuthConfig } from "@/lib/auth/auth-store";
import { isValidPassword } from "@/lib/auth/auth-store";

// Renewed only by the explicit user-activity endpoint, never by polling.
export const SESSION_LIFETIME_SECONDS = 12 * 60 * 60;
const SESSION_LIFETIME_MS = SESSION_LIFETIME_SECONDS * 1_000;
export const SESSION_COOKIE_NAME = "codex-quota-session";

export function isValidCredential(id: string, password: string, auth: AuthConfig) {
  return id === auth.loginId && isValidPassword(password, auth.passwordHash);
}

export function createSession(auth: AuthConfig, activityAt = Date.now()) {
  const expiresAt = activityAt + SESSION_LIFETIME_MS;
  const signature = createHmac("sha256", auth.sessionSigningSecret)
    .update(String(expiresAt))
    .digest("base64url");
  return `${expiresAt}.${signature}`;
}

export function isValidSession(token: string | undefined, auth: AuthConfig | null) {
  if (!token || !auth) return false;

  if (!/^\d+\.[A-Za-z0-9_-]{43}$/.test(token)) return false;

  const [expiresAtText, signature] = token.split(".");
  const expiresAt = Number(expiresAtText);
  if (!Number.isSafeInteger(expiresAt) || !signature || expiresAt <= Date.now()) return false;

  const expectedSignature = createHmac("sha256", auth.sessionSigningSecret)
    .update(expiresAtText)
    .digest("base64url");
  if (signature.length !== expectedSignature.length) return false;

  return timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}
