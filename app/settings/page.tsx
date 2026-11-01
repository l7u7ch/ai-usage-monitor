import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Settings } from "@/components/settings";
import { getAuthStore } from "@/lib/auth/auth-store";
import { isValidSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const auth = await getAuthStore().read();
  if (!auth) redirect("/setup");
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!isValidSession(token, auth)) redirect("/login");
  return <Settings />;
}
