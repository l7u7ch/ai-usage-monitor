"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setResetDisplay, useResetDisplay } from "@/lib/reset-display";

export function Settings() {
  const router = useRouter();
  const remaining = useResetDisplay();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  function toggleReset() {
    try { setResetDisplay(!remaining); }
    catch { toast.error("表示設定を保存できませんでした。"); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmation) { toast.error("パスワードが一致しません。"); return; }
    setPending(true);
    try {
      const response = await fetch("/api/password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) });
      if (response.status === 401) { router.replace("/login"); return; }
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        toast.error(body?.error ?? "パスワードを変更できませんでした。");
        return;
      }
      toast.success("パスワードを変更しました。再ログインしてください。");
      router.replace("/login");
    } catch { toast.error("パスワードを変更できませんでした。"); }
    finally { setPending(false); }
  }
  return <>
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex min-h-16 w-full max-w-[1500px] items-center justify-end px-6 py-3 lg:px-10"><Button asChild variant="outline" size="sm"><Link href="/">ダッシュボード</Link></Button></div>
    </header>
    <main className="mx-auto w-full max-w-[1500px] px-6 py-8 lg:px-10">
      <div className="max-w-xl space-y-8">
        <h1 className="text-2xl font-semibold">設定</h1>
        <section className="space-y-4 rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold">表示</h2>
          <div className="flex items-center justify-between gap-4"><span>リセット表示</span><Button variant="outline" size="sm" aria-label="リセット表示を切り替え" aria-pressed={remaining} onClick={toggleReset}>{remaining ? "残り時間" : "リセット日時"}</Button></div>
          <div className="flex items-center justify-between gap-4"><span>テーマ</span><ThemeToggle /></div>
        </section>
        <section className="space-y-4 rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold">パスワード変更</h2>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2"><label htmlFor="current-password">現在のパスワード</label><Input id="current-password" type="password" autoComplete="current-password" maxLength={1024} required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></div>
            <div className="space-y-2"><label htmlFor="new-password">新しいパスワード</label><Input id="new-password" type="password" autoComplete="new-password" maxLength={1024} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></div>
            <div className="space-y-2"><label htmlFor="confirm-password">新しいパスワード（確認）</label><Input id="confirm-password" type="password" autoComplete="new-password" maxLength={1024} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></div>
            <p className="text-sm text-muted-foreground">変更後はすべてのセッションが無効になり、再ログインが必要です。</p>
            <Button type="submit" disabled={pending}>{pending ? "変更中…" : "パスワードを変更"}</Button>
          </form>
        </section>
      </div>
    </main>
  </>;
}
