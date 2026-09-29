"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, LoaderCircle, LogOut, Plus, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AccountUsageTable } from "@/components/account-usage-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AccountUsage } from "@/lib/accounts/account-usage";

type LoginPrompt = {
  mode: "add" | "reauthenticate";
  accountId: string;
  loginId: string;
  verificationUrl: string;
  userCode: string;
};

export function Dashboard({
  initialAccounts,
}: {
  initialAccounts: AccountUsage[];
}) {
  const router = useRouter();
  const [accounts, setAccounts] = useState(initialAccounts);
  const [refreshing, setRefreshing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [actionPendingId, setActionPendingId] = useState<string | null>(null);
  const [renamingAccount, setRenamingAccount] = useState<AccountUsage | null>(
    null,
  );
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<AccountUsage | null>(
    null,
  );
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [login, setLogin] = useState<LoginPrompt | null>(null);
  const sessionExpiryRedirected = useRef(false);

  const fetchAuthenticated = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await fetch(input, init);
      if (response.status === 401 && !sessionExpiryRedirected.current) {
        sessionExpiryRedirected.current = true;
        router.replace("/login");
      }
      return response;
    },
    [router],
  );

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const response = await fetchAuthenticated("/api/accounts", { cache: "no-store" });
      if (!response.ok) throw new Error("request failed");
      const body = (await response.json()) as { accounts: AccountUsage[] };
      setAccounts(body.accounts);
    } catch {
      if (!quiet) toast.error("利用状況を更新できませんでした");
    } finally {
      if (!quiet) setRefreshing(false);
    }
  }, [fetchAuthenticated]);

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(true), 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const discardLogin = useCallback(
    async (loginToDiscard: LoginPrompt) => {
      try {
        const response = await fetchAuthenticated(
          `/api/accounts/${loginToDiscard.accountId}/login/${loginToDiscard.loginId}`,
          { method: "DELETE" },
        );
        if (response.status === 409) await refresh(true);
      } catch {
        toast.error("ログイン処理を中断できませんでした");
      }
    },
    [fetchAuthenticated, refresh],
  );

  useEffect(() => {
    if (!login) return;
    const timer = window.setInterval(async () => {
      const response = await fetchAuthenticated(
        `/api/accounts/${login.accountId}/login/${login.loginId}`,
        { cache: "no-store" },
      );
      if (!response.ok) return;
      const result = (await response.json()) as {
        status: "pending" | "complete" | "failed";
        error?: string;
      };
      if (result.status === "complete") {
        window.clearInterval(timer);
        toast.success(
          login.mode === "add"
            ? "ChatGPTアカウントを追加しました"
            : "ChatGPTアカウントを再認証しました",
        );
        setDialogOpen(false);
        setLogin(null);
        await refresh(true);
      } else if (result.status === "failed") {
        window.clearInterval(timer);
        toast.error(result.error ?? "ログインに失敗しました");
        void discardLogin(login);
        setDialogOpen(false);
        setLogin(null);
      }
    }, 1_500);
    return () => window.clearInterval(timer);
  }, [discardLogin, fetchAuthenticated, login, refresh]);

  async function addAccount() {
    setLogin(null);
    setSubmitting(true);
    try {
      const response = await fetchAuthenticated("/api/accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = (await response.json()) as LoginPrompt & {
        error?: string;
      };
      if (!response.ok) throw new Error(result.error);
      setLogin({ ...result, mode: "add" });
      setDialogOpen(true);
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "アカウントを追加できませんでした",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function reauthenticateAccount(account: AccountUsage) {
    if (login) return;
    setActionPendingId(account.id);
    try {
      const response = await fetchAuthenticated(`/api/accounts/${account.id}/login`, {
        method: "POST",
      });
      const result = (await response.json()) as LoginPrompt & {
        error?: string;
      };
      if (!response.ok) throw new Error(result.error);
      setLogin({ ...result, mode: "reauthenticate" });
      setDialogOpen(true);
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "再ログインを開始できませんでした",
      );
    } finally {
      setActionPendingId(null);
    }
  }

  async function saveDisplayName() {
    if (!renamingAccount) return;
    setSavingDisplayName(true);
    try {
      const displayName = displayNameInput.trim() || null;
      const response = await fetchAuthenticated(`/api/accounts/${renamingAccount.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error);
      setAccounts((current) =>
        current.map((account) =>
          account.id === renamingAccount.id
            ? { ...account, displayName }
            : account,
        ),
      );
      setRenamingAccount(null);
      toast.success("ラベルを変更しました");
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "ラベルを変更できませんでした",
      );
    } finally {
      setSavingDisplayName(false);
    }
  }

  async function deleteAccount() {
    if (!accountToDelete) return;
    setDeletingAccount(true);
    try {
      const response = await fetchAuthenticated(`/api/accounts/${accountToDelete.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error);
      }
      setAccounts((current) =>
        current.filter((account) => account.id !== accountToDelete.id),
      );
      setAccountToDelete(null);
      toast.success("ChatGPTアカウントを削除しました");
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "アカウントを削除できませんでした",
      );
    } finally {
      setDeletingAccount(false);
    }
  }

  async function moveAccount(accountId: string, direction: -1 | 1) {
    const index = accounts.findIndex((account) => account.id === accountId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= accounts.length) return;

    const reorderedAccounts = [...accounts];
    [reorderedAccounts[index], reorderedAccounts[targetIndex]] = [
      reorderedAccounts[targetIndex],
      reorderedAccounts[index],
    ];

    setActionPendingId(accountId);
    try {
      const response = await fetchAuthenticated("/api/accounts", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountIds: reorderedAccounts.map((account) => account.id),
        }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(result?.error);
      }
      setAccounts(reorderedAccounts);
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "アカウントの順序を変更できませんでした",
      );
    } finally {
      setActionPendingId(null);
    }
  }

  async function logout() {
    setLoggingOut(true);
    try {
      const response = await fetch("/api/logout", { method: "POST" });
      if (!response.ok) throw new Error("request failed");
      router.replace("/login");
    } catch {
      toast.error("ログアウトできませんでした");
      setLoggingOut(false);
    }
  }

  async function copyLoginCode() {
    if (!login) return;
    try {
      await navigator.clipboard.writeText(login.userCode);
      toast.success("認証コードをコピーしました");
    } catch {
      toast.error("認証コードをコピーできませんでした");
    }
  }

  return (
    <>
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex min-h-16 w-full max-w-[1500px] flex-wrap items-center justify-between gap-3 px-6 py-3 lg:px-10">
          <div className="flex items-baseline gap-3">
            <p className="text-sm font-semibold tracking-[0.16em]">
              AI Usage Monitor
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => void refresh()}
                disabled={refreshing}
              >
                <RefreshCw className={refreshing ? "animate-spin" : ""} />
                更新
              </Button>
              <Button
                onClick={() => void addAccount()}
                disabled={submitting || Boolean(login)}
              >
                {submitting ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <Plus />
                )}
                アカウントを追加
              </Button>
            </div>
            <div className="border-l pl-4">
              <Button
                variant="outline"
                onClick={() => setLogoutDialogOpen(true)}
                disabled={loggingOut}
              >
                {loggingOut ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <LogOut />
                )}
                ログアウト
              </Button>
            </div>
            <Dialog
              open={dialogOpen}
              onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open && login) {
                  void discardLogin(login);
                  setLogin(null);
                }
              }}
            >
              <DialogContent>
                <DialogHeader>
                  {/* <DialogTitle>ChatGPTアカウントを追加</DialogTitle> */}
                  {/* <DialogDescription> */}
                  {/* 認証情報はこのサーバー上のアカウント別プロファイルに保存されます。 */}
                  {/* </DialogDescription> */}
                </DialogHeader>
                {login ? (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        認証コード
                      </p>
                      <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-4">
                        <p className="min-w-0 flex-1 font-mono text-2xl font-semibold tracking-widest">
                          {login.userCode}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label="認証コードをコピー"
                          onClick={() => void copyLoginCode()}
                        >
                          <Copy />
                          コピー
                        </Button>
                      </div>
                    </div>
                    <Button asChild className="w-full">
                      <a
                        href={login.verificationUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        OpenAIの認証ページを開く
                      </a>
                    </Button>
                    <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <LoaderCircle className="size-4 animate-spin" />
                      ログイン完了を待っています
                    </p>
                  </div>
                ) : null}
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <Dialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>ログアウトしますか？</DialogTitle>
            {/* <DialogDescription> */}
            {/* このブラウザで保存されているログイン状態を終了します。 */}
            {/* </DialogDescription> */}
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={loggingOut}>
                キャンセル
              </Button>
            </DialogClose>
            <Button onClick={() => void logout()} disabled={loggingOut}>
              {loggingOut ? <LoaderCircle className="animate-spin" /> : null}
              ログアウトする
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <main className="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-[1500px] px-6 py-8 lg:px-10">
        {accounts.length > 0 && (
          <div className="mx-auto w-fit max-w-full overflow-hidden rounded-md border border-border/80 bg-card/30">
            <AccountUsageTable
              accounts={accounts}
              busyAccountId={actionPendingId}
              loginPending={Boolean(login)}
              onMoveUp={(selected) => void moveAccount(selected.id, -1)}
              onMoveDown={(selected) => void moveAccount(selected.id, 1)}
              onRename={(selected) => {
                setRenamingAccount(selected);
                setDisplayNameInput(selected.displayName ?? "");
              }}
              onReauthenticate={(selected) =>
                void reauthenticateAccount(selected)
              }
              onDelete={setAccountToDelete}
            />
          </div>
        )}
      </main>

      <Dialog
        open={Boolean(renamingAccount)}
        onOpenChange={(open) => {
          if (!open && !savingDisplayName) setRenamingAccount(null);
        }}
      >
        <DialogContent showCloseButton={!savingDisplayName}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void saveDisplayName();
            }}
          >
            <DialogHeader>
              <DialogTitle>ラベルの変更</DialogTitle>
              {/* <DialogDescription> */}
              {/* 空欄にするとChatGPTアカウントのメールアドレスを表示します。 */}
              {/* </DialogDescription> */}
            </DialogHeader>
            <div className="py-4">
              <label
                htmlFor="account-display-name"
                className="mb-2 block text-sm font-medium"
              >
                ラベル
              </label>
              <Input
                id="account-display-name"
                value={displayNameInput}
                onChange={(event) => setDisplayNameInput(event.target.value)}
                maxLength={50}
                autoFocus
                disabled={savingDisplayName}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={savingDisplayName}
                >
                  キャンセル
                </Button>
              </DialogClose>
              <Button type="submit" disabled={savingDisplayName}>
                {savingDisplayName ? (
                  <LoaderCircle className="animate-spin" />
                ) : null}
                保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(accountToDelete)}
        onOpenChange={(open) => {
          if (!open && !deletingAccount) setAccountToDelete(null);
        }}
      >
        <DialogContent showCloseButton={!deletingAccount}>
          <DialogHeader>
            <DialogTitle>ChatGPTアカウントを削除しますか？</DialogTitle>
            {/* <DialogDescription>
              {accountToDelete?.displayName ||
                accountToDelete?.email ||
                "このアカウント"}
              を削除します。保存された認証情報もサーバーから削除されます。
            </DialogDescription> */}
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={deletingAccount}>
                キャンセル
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => void deleteAccount()}
              disabled={deletingAccount}
            >
              {deletingAccount ? (
                <LoaderCircle className="animate-spin" />
              ) : null}
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
