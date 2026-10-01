"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { startSessionActivity } from "@/lib/auth/session-activity";

export function SessionActivity() {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (pathname !== "/" && pathname !== "/usage") return;
    return startSessionActivity(document, fetch, () => router.replace("/login"));
  }, [pathname, router]);
  return null;
}
