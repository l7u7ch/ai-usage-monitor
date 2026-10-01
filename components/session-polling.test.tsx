import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Dashboard } from "@/components/dashboard";
import { SessionActivity } from "@/components/session-activity";

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/" }));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it("dashboard polling continues without extending the idle session", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ accounts: [] }));
  vi.stubGlobal("fetch", fetcher);
  render(<><SessionActivity /><Dashboard initialAccounts={[]} /></>);
  expect(fetcher).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual(["/api/accounts", "/api/accounts"]);
});
