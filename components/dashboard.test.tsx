import {
  cleanup,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "next-themes";
import { renderToString } from "react-dom/server";
import { ThemeToggle } from "@/components/theme-toggle";

import { Dashboard } from "@/components/dashboard";

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

const accounts = [
  {
    id: "account-1",
    displayName: null,
    email: "me@example.com",
    planType: "plus",
    status: "ready" as const,
    windows: [
      {
        id: "codex-primary",
        label: "5時間の使用制限",
        remainingPercent: 72,
        resetsAt: 1_800_000_000,
        windowDurationMins: 300,
      },
    ],
  },
];

const twoAccounts = [
  accounts[0],
  { ...accounts[0], id: "account-2", email: "personal@example.com" },
];

function openAccountMenu(email = "me@example.com") {
  const row = screen.getAllByRole("row").find((candidate) =>
    candidate.textContent?.includes(email),
  );
  if (!row) throw new Error(`Could not find account row for ${email}`);

  fireEvent.contextMenu(row, {
    button: 2,
    clientX: 100,
    clientY: 100,
  });
}

describe("Dashboard", () => {
  it("links to settings instead of displaying preference controls in the header", () => {
    render(<Dashboard initialAccounts={accounts} />);
    const header = within(screen.getByRole("banner"));
    expect(header.getByRole("link", { name: "設定" })).toHaveAttribute("href", "/settings");
    expect(header.queryByRole("button", { name: "リセット表示を切り替え" })).toBeNull();
    expect(header.queryByRole("button", { name: /モードに切り替え/ })).toBeNull();
  });
  it("uses the saved reset display preference for all reset cells", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2027, 0, 1, 12));
    const windows = [...accounts[0].windows, { ...accounts[0].windows[0], id: "weekly", label: "週間利用上限", resetsAt: 1_800_345_600, windowDurationMins: 10080 }];
    const rows = twoAccounts.map((account) => ({ ...account, windows }));
    localStorage.setItem("reset-display", "remaining");
    const { container } = render(<Dashboard initialAccounts={rows} />);
    const cells = rows.flatMap((account) => {
      const row = within(container).getAllByRole("row").find((item) => item.textContent?.includes(account.email));
      if (!row) throw new Error("missing account row");
      const columns = row.querySelectorAll(":scope > th, :scope > td");
      return [columns[3], columns[5]];
    });
    cells.forEach((cell) => expect(within(cell as HTMLElement).queryByRole("button")).toBeNull());
    cells.forEach((cell) => expect(cell.textContent).toMatch(/^\d+日/));
    act(() => vi.advanceTimersByTime(60_000));
    cells.forEach((cell) => expect(cell.textContent).toMatch(/^\d+日/));
    localStorage.removeItem("reset-display");
  });
  it("renders both theme icons on the server for CSS selection", () => {
    const html = renderToString(<ThemeProvider attribute="class" defaultTheme="dark"><ThemeToggle /></ThemeProvider>);
    expect(html).toContain("lucide-sun");
    expect(html).toContain("lucide-moon");
    expect(html).toContain("dark:hidden");
    expect(html).toContain("dark:block");
    expect(html).toContain('class="hidden dark:block">ライト</span>');
    expect(html).toContain('class="block dark:hidden">ダーク</span>');
  });
  it("switches between dark and light and persists the preference", async () => {
    localStorage.clear();
    vi.stubGlobal("matchMedia", () => ({ matches: false, addListener: () => {}, removeListener: () => {} }));
    const view = render(<ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}><ThemeToggle /></ThemeProvider>);
    const toggle = await screen.findByRole("button", { name: "ライトモードに切り替え" });
    expect(within(toggle).getByText("ライト")).toHaveClass("hidden", "dark:block");
    expect(within(toggle).getByText("ダーク")).toHaveClass("block", "dark:hidden");
    fireEvent.click(toggle);
    await waitFor(() => expect(document.documentElement).not.toHaveClass("dark"));
    expect(localStorage.getItem("theme")).toBe("light");
    view.unmount();
    render(<ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}><ThemeToggle /></ThemeProvider>);
    expect(await screen.findByRole("button", { name: "ダークモードに切り替え" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "ダークモードに切り替え" }));
    await waitFor(() => expect(document.documentElement).toHaveClass("dark"));
    expect(localStorage.getItem("theme")).toBe("dark");
  });
  it("shows the initial update timestamp in the card footer", () => {
    render(<Dashboard initialAccounts={accounts} initialUpdatedAt="2026-10-04T04:05:23.000Z" />);
    const timestamp = screen.getByText("2026年10月04日 13:05:23");
    expect(timestamp).toHaveAttribute("datetime", "2026-10-04T04:05:23.000Z");
    expect(timestamp.closest("footer")).toHaveClass("border-t", "text-muted-foreground");
  });

  it("updates the footer only when refreshing succeeds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T05:06:07.000Z"));
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ accounts }) }).mockRejectedValueOnce(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
    render(<Dashboard initialAccounts={accounts} initialUpdatedAt="2026-10-04T04:05:23.000Z" />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "更新" })); });
    expect(screen.getByText("2026年10月04日 14:06:07")).toBeInTheDocument();
    vi.setSystemTime(new Date("2026-10-04T06:07:08.000Z"));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "更新成功" })); });
    expect(screen.getByText("2026年10月04日 14:06:07")).toBeInTheDocument();
  });

  it("shows manual refresh progress, success and failure", async () => {
    let resolveRequest!: (value: unknown) => void;
    const fetchMock = vi.fn().mockImplementationOnce(() => new Promise((resolve) => { resolveRequest = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    render(<Dashboard initialAccounts={accounts} />);
    fireEvent.click(screen.getByRole("button", { name: "更新" }));
    const pending = screen.getByRole("button", { name: "更新中" });
    expect(pending).toBeDisabled();
    expect(pending).toHaveClass("disabled:opacity-50");
    expect(pending).not.toHaveClass("bg-blue-600", "disabled:opacity-100");
    expect(pending.querySelector("svg")).toHaveClass("animate-spin");
    resolveRequest({ ok: true, json: async () => ({ accounts }) });
    const success = await screen.findByRole("button", { name: "更新成功" });
    expect(success).toHaveClass("bg-green-700", "text-white", "border-green-700", "hover:text-white", "dark:bg-green-700", "dark:hover:bg-green-800");
    await screen.findByRole("button", { name: "更新" }, { timeout: 4000 });
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(screen.getByRole("button", { name: "更新" }));
    const failed = await screen.findByRole("button", { name: "更新失敗" });
    expect(failed).toHaveClass("bg-red-600", "text-white", "border-red-600", "hover:text-white", "dark:bg-red-600", "dark:hover:bg-red-700");
    expect(failed).not.toBeDisabled();
  });

  it("uses matching neutral compact header buttons when idle", () => {
    render(<Dashboard initialAccounts={accounts} />);
    for (const name of ["更新", "追加", "ログアウト"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toHaveAttribute("data-variant", "outline");
      expect(button).toHaveAttribute("data-size", "sm");
      expect(button).not.toHaveClass("w-[104px]");
      expect(button).toHaveClass("has-[>svg]:px-2.5");
    }
    expect(screen.getByRole("banner").querySelector(".border-l")).toBeNull();
  });

  it("keeps manual failure feedback when quiet polling succeeds", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ ok: true, json: async () => ({ accounts }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<Dashboard initialAccounts={accounts} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "更新" }));
    });
    expect(screen.getByRole("button", { name: "更新失敗" })).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "更新失敗" })).toBeInTheDocument();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    replaceMock.mockReset();
  });

  it("shows all registered accounts and account controls without a summary footer", () => {
    render(<Dashboard initialAccounts={accounts} />);

    expect(screen.getByRole("button", { name: "追加" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更新" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "アカウント" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "5時間枠" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "週間枠" })).toBeInTheDocument();
    expect(screen.getByText("me@example.com")).toBeInTheDocument();
    expect(screen.getByRole("table").parentElement?.parentElement).toHaveClass("rounded-md");
    expect(screen.queryByText(/accounts$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/low capacity/i)).not.toBeInTheDocument();
  });

  it("uses automatic column sizing for account usage values", () => {
    render(<Dashboard initialAccounts={accounts} />);

    const table = screen.getByRole("table");
    expect(table).toHaveClass("table-auto", "w-max");
    expect(table.parentElement?.parentElement).toHaveClass("mx-auto", "w-fit", "max-w-full");
  });

  it("leaves the dashboard empty without an account placeholder", () => {
    render(<Dashboard initialAccounts={[]} />);

    expect(screen.getByRole("main")).toBeEmptyDOMElement();
    expect(screen.queryByText("アカウントがまだありません")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "追加" })).toBeInTheDocument();
  });

  it("does not link to the usage forecast from the account dashboard", () => {
    render(<Dashboard initialAccounts={accounts} />);

    expect(
      screen.queryByRole("link", { name: "利用ペース予測" }),
    ).not.toBeInTheDocument();
  });

  it("asks for confirmation before logging out", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<Dashboard initialAccounts={accounts} />);
    fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ログアウトしますか？" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "ログアウトする" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/logout", { method: "POST" });
      expect(replaceMock).toHaveBeenCalledWith("/login");
    });
  });

  it("redirects to sign in when a protected dashboard request returns 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: "認証が必要です" }),
      }),
    );

    render(<Dashboard initialAccounts={accounts} />);
    fireEvent.click(screen.getByRole("button", { name: "追加" }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login"));
  });

  it("starts login directly when adding an account", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        accountId: "account-2",
        loginId: "login-2",
        verificationUrl: "https://auth.openai.com/device",
        userCode: "ABCD-1234",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Dashboard initialAccounts={accounts} />);
    fireEvent.click(screen.getByRole("button", { name: "追加" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
    });

    expect(await screen.findByText("認証コード")).toBeInTheDocument();
    expect(screen.getByText("ABCD-1234")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "ログインを開始" }),
    ).not.toBeInTheDocument();
  });

  it("copies the verification code", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText: writeTextMock } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          accountId: "account-2",
          loginId: "login-2",
          verificationUrl: "https://auth.openai.com/device",
          userCode: "ABCD-1234",
        }),
      }),
    );

    render(<Dashboard initialAccounts={accounts} />);
    fireEvent.click(screen.getByRole("button", { name: "追加" }));
    await screen.findByText("認証コード");
    fireEvent.click(screen.getByRole("button", { name: "認証コードをコピー" }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith("ABCD-1234");
    });
  });

  it("discards the pending account when the login dialog is closed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accountId: "account-2",
          loginId: "login-2",
          verificationUrl: "https://auth.openai.com/device",
          userCode: "ABCD-1234",
        }),
      })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<Dashboard initialAccounts={accounts} />);
    fireEvent.click(screen.getByRole("button", { name: "追加" }));
    await screen.findByText("認証コード");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/accounts/account-2/login/login-2",
        { method: "DELETE" },
      );
    });
  });

  it("discards the pending account when login fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accountId: "account-2",
          loginId: "login-2",
          verificationUrl: "https://auth.openai.com/device",
          userCode: "ABCD-1234",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "failed", error: "ログインに失敗しました" }),
      })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<Dashboard initialAccounts={accounts} />);
    fireEvent.click(screen.getByRole("button", { name: "追加" }));
    await screen.findByText("認証コード");
    await new Promise((resolve) => window.setTimeout(resolve, 1_600));

    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/accounts/account-2/login/login-2",
      { method: "DELETE" },
    );
  });

  it("renames a registered account and refreshes the account list", async () => {
    const updatedAccount = { ...accounts[0], displayName: "Work account" };
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/accounts/account-1" && init?.method === "PATCH") {
        return { ok: true, json: async () => ({}) };
      }
      if (url === "/api/accounts") {
        return { ok: true, json: async () => ({ accounts: [updatedAccount] }) };
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Dashboard initialAccounts={accounts} />);
    openAccountMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "ラベルを変更" }));
    expect(screen.getByRole("heading", { name: "ラベルの変更" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("ラベル"), { target: { value: "Work account" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/accounts/account-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName: "Work account" }),
      });
    });
    expect(await screen.findByText("Work account")).toBeInTheDocument();
    expect(screen.queryByText("me@example.com")).not.toBeInTheDocument();
  });

  it("moves an account up and persists the new order", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<Dashboard initialAccounts={twoAccounts} />);
    openAccountMenu("personal@example.com");
    fireEvent.click(await screen.findByRole("menuitem", { name: "上へ移動" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/accounts", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountIds: ["account-2", "account-1"] }),
      });
    });
    await waitFor(() => {
      expect(
        Array.from(document.querySelectorAll("tbody tr th")).map(
          (cell) => cell.querySelector('span[id^="account-"]')?.textContent,
        ),
      ).toEqual(["personal@example.com", "me@example.com"]);
    });
  });

  it("hides reauthentication for a registered account", async () => {
    render(<Dashboard initialAccounts={accounts} />);
    openAccountMenu();

    expect(await screen.findByRole("menuitem", { name: "ラベルを変更" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "再ログイン" })).not.toBeInTheDocument();
  });

  it("asks for confirmation before deleting a registered account", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/accounts/account-1" && init?.method === "DELETE") {
        return { ok: true, json: async () => ({}) };
      }
      if (url === "/api/accounts") {
        return { ok: true, json: async () => ({ accounts: [] }) };
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Dashboard initialAccounts={accounts} />);
    openAccountMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "削除" }));

    expect(await screen.findByRole("heading", { name: "ChatGPTアカウントを削除しますか？" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "削除する" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/accounts/account-1", { method: "DELETE" });
    });
    await waitFor(() => expect(screen.queryByText("me@example.com")).not.toBeInTheDocument());
    expect(screen.getByRole("main")).toBeEmptyDOMElement();
  });
});
