"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SetupForm() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) {
      toast.error("パスワードが一致しません。");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, password }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        toast.error(typeof result?.error === "string"
          ? result.error
          : "アカウントを作成できませんでした。再試行してください。");
        setSubmitting(false);
        return;
      }
      router.push("/");
    } catch {
      toast.error("アカウントを作成できませんでした。時間をおいて再試行してください。");
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      {/* <h1 className="text-xl font-semibold">初期アカウント作成</h1> */}
      {/* <p className="text-sm text-muted-foreground">最初の管理者アカウントを作成してください。</p> */}
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="setup-id">
          ID
        </label>
        <Input
          id="setup-id"
          name="id"
          autoComplete="username"
          pattern="[A-Za-z0-9_.-]+"
          maxLength={64}
          onChange={(event) => setId(event.target.value)}
          required
          value={id}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="setup-password">
          パスワード
        </label>
        <Input
          id="setup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          maxLength={1024}
          onChange={(event) => setPassword(event.target.value)}
          required
          value={password}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="setup-confirmation">
          パスワード（確認）
        </label>
        <Input
          id="setup-confirmation"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          onChange={(event) => setConfirmation(event.target.value)}
          required
          value={confirmation}
        />
      </div>
      <Button className="w-full" disabled={submitting} type="submit">
        {submitting ? "作成中…" : "アカウントを作成"}
      </Button>
    </form>
  );
}
