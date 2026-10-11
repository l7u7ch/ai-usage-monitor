"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { RemainingProjection } from "@/components/remaining-projection";
import { ObservedUsageChart } from "@/components/observed-usage-chart";
import type { UsageForecastAccount, UsageForecastResponse } from "@/lib/usage/types";

const DEFAULT_REFRESH_INTERVAL_MS = 5 * 60 * 1_000;

function formatSampledAt(sampledAt: number) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Tokyo",
  }).format(new Date(sampledAt));
}

function AccountForecast({ account, sampledAt, experimental }: { account: UsageForecastAccount; sampledAt: number; experimental: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h2 className="truncate text-lg font-semibold">
            {account.displayName || account.email || "認証中のアカウント"}
          </h2>
          <CardDescription>
            {account.email && account.displayName ? account.email : "Codex利用枠の推移"}
          </CardDescription>
        </div>
        {account.planType ? <Badge variant="secondary">{account.planType}</Badge> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {account.status === "ready" ? (
          account.windows.length ? (
            account.windows.map((window) => (
              <section
                key={window.id}
                className="rounded-lg border border-border/70 bg-muted/10 p-4"
              >
                {experimental ? <ObservedUsageChart window={window} sampledAt={sampledAt} /> : <RemainingProjection window={window} sampledAt={sampledAt} />}
              </section>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">利用枠の情報がありません。</p>
          )
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="size-4" aria-hidden="true" />
            {account.status === "signed-out"
              ? "ログインが必要です"
              : account.error ?? "利用状況を取得できません"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function UsageDashboard({ experimental = false }: { experimental?: boolean } = {}) {
  const [data, setData] = useState<UsageForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshError, setRefreshError] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refreshInFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshInFlight.current || sessionExpired) return;
    refreshInFlight.current = true;
    setRefreshing(true);
    try {
      const response = await fetch("/api/usage", { cache: "no-store" });
      if (response.status === 401) {
        setSessionExpired(true);
        setRefreshError(false);
        return;
      }
      if (!response.ok) throw new Error("Usage request failed");
      const result = (await response.json()) as UsageForecastResponse;
      setData(result);
      setRefreshError(false);
    } catch {
      setRefreshError(true);
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
      setLoading(false);
    }
  }, [sessionExpired]);

  useEffect(() => {
    if (sessionExpired) return;
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(initialRefresh);
  }, [refresh, sessionExpired]);

  useEffect(() => {
    if (sessionExpired) return;
    const interval = window.setInterval(
      () => void refresh(),
      data?.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS,
    );
    return () => window.clearInterval(interval);
  }, [data?.refreshIntervalMs, refresh, sessionExpired]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl space-y-7 px-5 py-8 sm:px-8 lg:px-10">
      <header className="flex flex-col gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            AI Usage Monitor
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{experimental ? "使用率グラフ（実験）" : "利用ペース予測"}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {experimental ? "直近1時間の使用率を表示します。縦軸は利用上限に対する使用率（0〜100%）です。" : "直近の利用率から、リセット前に利用枠へ到達する可能性を推定します。"}
          </p>
          <Link href="/" className="inline-block text-sm text-foreground underline underline-offset-4">
            アカウント管理に戻る
          </Link>
          <Link href={experimental ? "/usage" : "/usage/experimental"} className="ml-4 inline-block text-sm text-foreground underline underline-offset-4">
            {experimental ? "利用ペース予測を見る" : "使用率グラフ（実験）を見る"}
          </Link>
        </div>
        <div className="text-sm text-muted-foreground" role="status" aria-live="polite">
          {sessionExpired ? (
            <span>再ログインが必要です</span>
          ) : refreshing ? (
            <span className="flex items-center gap-2">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              利用状況を更新中
            </span>
          ) : data ? (
            <span>表示中は5分ごとに更新・最終取得 {formatSampledAt(data.sampledAt)}</span>
          ) : (
            <span>5分ごとに更新</span>
          )}
        </div>
      </header>

      {refreshError ? (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          利用状況を取得できませんでした。次回の自動更新で再試行します。
        </div>
      ) : null}

      {sessionExpired ? (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          ログインの有効期限が切れました。{" "}
          <Link href="/login" className="font-medium underline underline-offset-4">
            再ログイン
          </Link>
        </div>
      ) : (
        <section aria-label={experimental ? "アカウント別の使用率" : "アカウント別の利用予測"} className="space-y-4">
          {loading && !data ? (
            <p className="py-12 text-center text-sm text-muted-foreground">利用状況を取得しています…</p>
          ) : data?.accounts.length ? (
            data.accounts.map((account) => (
              <AccountForecast key={account.id} account={account} sampledAt={data.sampledAt} experimental={experimental} />
            ))
          ) : data ? (
            <div className="rounded-lg border border-dashed px-6 py-12 text-center">
              <p className="font-medium">{experimental ? "表示対象のアカウントがありません" : "予測対象のアカウントがありません"}</p>
              <p className="mt-1 text-sm text-muted-foreground">登録済みアカウントがあると利用ペースを表示します。</p>
            </div>
          ) : null}
        </section>
      )}

      {!sessionExpired ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {experimental ? "実績のみを表示し、予測は含みません。現在のリセット周期内の観測が対象です。画面を閉じている間の常時収集は行いません。" : "予測は直近1時間の利用率の傾向に基づく目安です。十分な観測データが集まるまでは予測を表示しません。"}
        </p>
      ) : null}
    </main>
  );
}
