import { UsageDashboard } from "@/components/usage-dashboard";
import { getAuthStore } from "@/lib/auth/auth-store";
import { isValidSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ExperimentalUsagePage() {
  const auth = await getAuthStore().read();
  if (!auth) redirect("/setup");

  const sessionToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!isValidSession(sessionToken, auth)) redirect("/login");

  return <UsageDashboard experimental />;
}
