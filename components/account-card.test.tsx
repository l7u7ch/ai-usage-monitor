import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AccountUsageTable, formatTimeUntilReset } from "@/components/account-usage-table";
import type { AccountUsage } from "@/lib/accounts/account-usage";

afterEach(cleanup);

const account: AccountUsage = {
  id: "account-1",
  displayName: null,
  email: "me@example.com",
  planType: "plus",
  status: "ready",
  windows: [
    {
      id: "codex-primary",
      label: "5時間の使用制限",
      remainingPercent: 72,
      resetsAt: 1_800_000_000,
      windowDurationMins: 300,
    },
    {
      id: "codex-secondary",
      label: "週間利用上限",
      remainingPercent: 41,
      resetsAt: 1_800_345_600,
      windowDurationMins: 10_080,
    },
  ],
};

function renderAccounts(accounts: AccountUsage[]) {
  return render(
    <AccountUsageTable
      accounts={accounts}
      busyAccountId={null}
      loginPending={false}
      onMoveUp={() => {}}
      onMoveDown={() => {}}
      onRename={() => {}}
      onReauthenticate={() => {}}
      onDelete={() => {}}
    />,
  );
}

function renderAccount(accountOverride: AccountUsage = account) {
  return renderAccounts([accountOverride]);
}

function getAccountRow(container: HTMLElement, email = "me@example.com") {
  const row = within(container).getAllByRole("row").find((candidate) =>
    candidate.textContent?.includes(email),
  );
  if (!row) throw new Error(`Could not find account row for ${email}`);
  return row;
}

function openAccountContextMenu(container: HTMLElement, email = "me@example.com") {
  fireEvent.contextMenu(getAccountRow(container, email), {
    button: 2,
    clientX: 100,
    clientY: 100,
  });
}

describe("AccountUsageTable", () => {
  it("sizes the table to its content while keeping horizontal overflow available", () => {
    const { container } = renderAccount();
    const table = within(container).getByRole("table");

    expect(table.parentElement).toHaveClass("overflow-x-auto");
    expect(table).toHaveClass("w-max", "table-auto");
    expect(table).not.toHaveClass("w-full");
    expect(within(table).getByRole("columnheader", { name: "アカウント" })).not.toHaveClass("min-w-64");
  });

  it("gives both usage columns a 288px minimum width", () => {
    const { container } = renderAccount();
    const table = within(container).getByRole("table");
    const headers = within(table).getAllByRole("columnheader");
    const row = within(table).getAllByRole("row")[1];
    const cells = row.querySelectorAll(":scope > th, :scope > td");

    expect(cells).toHaveLength(3);
    expect(headers[1]).toHaveClass("min-w-72");
    expect(headers[2]).toHaveClass("min-w-72");
    expect(cells[1]).toHaveClass("min-w-72");
    expect(cells[2]).toHaveClass("min-w-72");
    expect(cells[0]).not.toHaveClass("min-w-72");
  });

  it("renders one account as a quota matrix row", () => {
    renderAccount();

    expect(screen.getByText("me@example.com")).toBeInTheDocument();
    expect(screen.getByText("plus")).toHaveClass("rounded-sm");
    expect(screen.getByRole("progressbar", { name: "5時間の使用制限 72% 残り" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "週間利用上限 41% 残り" })).toBeInTheDocument();
    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByText("41")).toBeInTheDocument();
    expect(screen.getAllByRole("progressbar")).toHaveLength(2);
  });

  it("uses compact vertical padding for account data cells", () => {
    renderAccount();
    const row = within(screen.getByRole("table")).getAllByRole("row")[1];
    const cells = row.querySelectorAll(":scope > th, :scope > td");

    expect(cells).toHaveLength(3);
    cells.forEach((cell) => expect(cell).toHaveClass("py-4"));
  });

  it("shows the ChatGPT logo before the account name", () => {
    const { container } = renderAccount();
    const card = within(container);
    const logo = card.getByRole("img", { name: "ChatGPT" });
    const accountName = card.getByText("me@example.com");

    expect(logo.tagName.toLowerCase()).toBe("svg");
    expect(
      logo.compareDocumentPosition(accountName) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows only the custom label when one is set", () => {
    const { container } = renderAccount({ ...account, displayName: "Work account" });
    const card = within(container);

    expect(card.getByText("Work account")).toBeInTheDocument();
    expect(card.queryByText("me@example.com")).not.toBeInTheDocument();
  });

  it("opens row actions from the account context menu", async () => {
    const { container } = renderAccount();
    openAccountContextMenu(container);

    const menu = within(await screen.findByRole("menu"));
    expect(menu.getByRole("menuitem", { name: "ラベルを変更" })).toBeInTheDocument();
  });

  it("does not render a separate operations column", () => {
    const { container } = renderAccount();
    const table = within(container).getByRole("table");
    const accountRow = getAccountRow(container);

    expect(within(table).queryByRole("columnheader", { name: "操作" })).not.toBeInTheDocument();
    expect(accountRow.querySelectorAll(":scope > th, :scope > td")).toHaveLength(3);
  });

  it("shows icons for available actions and hides reauthentication", async () => {
    const { container } = renderAccount();
    openAccountContextMenu(container);

    const menu = within(await screen.findByRole("menu"));
    const rename = menu.getByRole("menuitem", { name: "ラベルを変更" });
    const remove = menu.getByRole("menuitem", { name: "削除" });

    expect(rename.querySelector("svg")).not.toBeNull();
    expect(remove.querySelector("svg")).not.toBeNull();
    expect(menu.queryByRole("menuitem", { name: "再ログイン" })).not.toBeInTheDocument();
  });

  it("disables moving past either account-list boundary", async () => {
    const otherAccount = { ...account, id: "account-2", email: "other@example.com" };
    const { container, unmount } = renderAccounts([account, otherAccount]);
    openAccountContextMenu(container);
    const firstMenu = within(await screen.findByRole("menu"));

    expect(firstMenu.getByRole("menuitem", { name: "上へ移動" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(firstMenu.getByRole("menuitem", { name: "下へ移動" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );

    unmount();
    const secondTable = renderAccounts([account, otherAccount]);
    openAccountContextMenu(secondTable.container, "other@example.com");
    const secondMenu = within(await screen.findByRole("menu"));

    expect(secondMenu.getByRole("menuitem", { name: "上へ移動" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(secondMenu.getByRole("menuitem", { name: "下へ移動" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it.each([
    [80, "bg-green-500"],
    [60, "bg-green-500"],
    [40, "bg-yellow-500"],
    [20, "bg-orange-500"],
    [19, "bg-red-500"],
  ])("uses the expected indicator color at %i%% remaining", (remainingPercent, colorClass) => {
    const { container } = renderAccount({
      ...account,
      windows: [{ ...account.windows[0], remainingPercent }],
    });

    expect(container.querySelector('[data-slot="progress-indicator"]')).toHaveClass(colorClass);
  });

  it("right-aligns the percentage and time remaining", () => {
    const { container } = renderAccount();
    const quota = container.querySelector('[aria-label="5時間の使用制限 72% 残り"]');
    const timeRemaining = Array.from(container.querySelectorAll("p")).find((element) =>
      element.textContent?.startsWith("あと"),
    );
    const percentage = Array.from(container.querySelectorAll("p")).find((element) =>
      element.textContent === "72%",
    );

    expect(quota).not.toBeNull();
    expect(timeRemaining).not.toBeUndefined();
    expect(quota!.compareDocumentPosition(timeRemaining!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(percentage?.parentElement).toHaveClass("justify-end");
    expect(timeRemaining?.parentElement).toHaveClass("justify-between");
  });

  it("uses a restrained hierarchy for quota details", () => {
    const { container } = renderAccount();
    const percentage = Array.from(container.querySelectorAll("p")).find((element) =>
      element.textContent === "72%",
    );
    const reset = screen.getAllByText(/^リセット/)[0];
    const resetTime = reset.querySelector("span");
    const timeRemaining = Array.from(container.querySelectorAll("p")).find((element) =>
      element.textContent?.startsWith("あと"),
    );

    expect(percentage?.querySelector("span")).toHaveClass("text-foreground/70");
    expect(reset).toHaveClass("text-[13px]", "text-muted-foreground");
    expect(resetTime).toHaveClass("text-foreground/80");
    expect(timeRemaining).toHaveClass("text-[13px]", "text-foreground/80");
  });

  it("prompts for login when the account is signed out", () => {
    renderAccount({ ...account, status: "signed-out", email: null, planType: null, windows: [] });

    expect(screen.getByText("ログインが必要です")).toBeInTheDocument();
  });

  it("shows the time remaining until a usage window resets", () => {
    expect(formatTimeUntilReset(1_800_000_000, 1_799_999_700_000)).toBe("あと5分");
  });

  it("shows unused instead of reset details for fully available windows", () => {
    const { container } = renderAccount({
      ...account,
      windows: account.windows.map((window) => ({ ...window, remainingPercent: 100 })),
    });
    const card = within(container);

    expect(card.getAllByText("未使用")).toHaveLength(2);
    expect(card.queryByText(/^リセット/)).not.toBeInTheDocument();
    expect(card.queryByText(/^あと/)).not.toBeInTheDocument();
  });
});
