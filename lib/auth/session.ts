import { createHmac, timingSafeEqual } from "node:crypto";

import type { AuthConfig } from "@/lib/auth/auth-store";
import { isValidPassword } from "@/lib/auth/auth-store";

// Browser storage lifetime; the signed session itself does not expire.
export const SESSION_LIFETIME_SECONDS = 400 * 24 * 60 * 60;
export const SESSION_COOKIE_NAME = "codex-quota-session";

export function isValidCredential(id: string, password: string, auth: AuthConfig) {
  return id === auth.loginId && isValidPassword(password, auth.passwordHash);
}

export function createSession(auth: AuthConfig) {
  // Zero marks a non-expiring session. Legacy dated tokens still expire.
  const expiresAt = 0;
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
  if (!Number.isSafeInteger(expiresAt) || !signature || (expiresAt !== 0 && expiresAt <= Date.now())) return false;

  const expectedSignature = createHmac("sha256", auth.sessionSigningSecret)
    .update(expiresAtText)
    .digest("base64url");
  if (signature.length !== expectedSignature.length) return false;

  return timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}
