import { NextRequest, NextResponse } from "next/server";
import { getAuthStore } from "@/lib/auth/auth-store";
import { isValidSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  const protocol = request.headers.get("x-forwarded-proto") ?? url.protocol.slice(0, -1);
  if (request.headers.get("origin") !== `${protocol}://${host}`) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const store = getAuthStore();
  const auth = await store.read();
  if (!auth || !isValidSession(request.cookies.get(SESSION_COOKIE_NAME)?.value, auth)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (typeof body?.currentPassword !== "string" || typeof body?.newPassword !== "string" || !body.currentPassword || !body.newPassword || body.currentPassword.length > 1024 || body.newPassword.length > 1024) {
    return NextResponse.json({ error: "パスワードを入力してください。" }, { status: 400 });
  }
  try {
    if (!await store.changePassword(body.currentPassword, body.newPassword, auth.sessionSigningSecret)) return NextResponse.json({ error: "現在のパスワードまたはセッションが正しくありません。" }, { status: 400 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return NextResponse.json({ error: "別の変更処理が進行中です。完了しない場合は管理者に確認してください。" }, { status: 409 });
    throw error;
  }
  const response = NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  response.cookies.set(SESSION_COOKIE_NAME, "", { httpOnly: true, path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 0 });
  return response;
}
