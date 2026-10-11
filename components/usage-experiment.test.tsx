import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { UsageDashboard } from "@/components/usage-dashboard";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("shows an experimental observed usage chart without a forecast", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    sampledAt: 1800000000000, refreshIntervalMs: 300000,
    accounts: [{ id: "a", displayName: "Work", email: null, planType: null, status: "ready", windows: [{
      id: "primary", label: "5時間の使用制限", remainingPercent: 70, resetsAt: 1800003600,
      windowDurationMins: 300, samples: [{ sampledAt: 1800000000000, usedPercent: 30, resetsAt: 1800003600 }],
      forecast: { status: "collecting", sampleCount: 1, observedMinutes: 0, consumptionPercentPerHour: null, minutesUntilDepletion: null, remainingAtResetPercent: null },
    }] }],
  }) }));
  render(<UsageDashboard experimental />);
  expect(await screen.findByRole("img", { name: "5時間の使用制限の使用率推移" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "使用率グラフ（実験）" })).toBeInTheDocument();
  expect(screen.getByText("現在の使用率 30%" )).toBeInTheDocument();
  expect(screen.queryByText("予測残量の見通し")).not.toBeInTheDocument();
  expect(screen.getByRole("img", { name: "5時間の使用制限の使用率推移" }).querySelector("svg")).not.toBeNull();
  expect(screen.getByText("観測データを収集中です。次の記録が集まると推移を表示します。")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "利用ペース予測を見る" })).toHaveAttribute("href", "/usage");
});
