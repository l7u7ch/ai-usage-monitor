import { Dashboard } from "@/components/dashboard";
import { getAccountStore } from "@/lib/accounts/account-store";
import { loadAccountUsage } from "@/lib/accounts/account-usage";
import { getAuthStore } from "@/lib/auth/auth-store";
import { isValidSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const auth = await getAuthStore().read();
  if (!auth) redirect("/setup");
  const sessionToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!isValidSession(sessionToken, auth)) redirect("/login");

  const storedAccounts = await getAccountStore().list();
  const accounts = await Promise.all(storedAccounts.map((account) => loadAccountUsage(account)));

  return <Dashboard initialAccounts={accounts} initialUpdatedAt={new Date().toISOString()} />;
}
