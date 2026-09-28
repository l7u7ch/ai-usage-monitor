"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LoginFormProps = {
  onAuthenticated?: () => void;
};

export function LoginForm({ onAuthenticated }: LoginFormProps) {
  const router = useRouter();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, password }),
      });
      if (!response.ok) {
        toast.error("IDまたはパスワードが正しくありません。");
        setSubmitting(false);
        return;
      }
      if (onAuthenticated) {
        onAuthenticated();
      } else {
        router.push("/");
      }
    } catch {
      toast.error("ログインできませんでした。時間をおいて再試行してください。");
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="login-id">ID</label>
        <Input
          id="login-id"
          name="id"
          autoComplete="username"
          onChange={(event) => setId(event.target.value)}
          required
          value={id}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="login-password">パスワード</label>
        <Input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
          required
          value={password}
        />
      </div>
      <Button className="w-full" disabled={submitting} type="submit">
        {submitting ? "ログイン中…" : "ログイン"}
      </Button>
    </form>
  );
}
