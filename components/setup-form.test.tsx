import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SetupForm } from "@/components/setup-form";

const { pushMock, toastErrorMock } = vi.hoisted(() => ({ pushMock: vi.fn(), toastErrorMock: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock } }));

describe("SetupForm", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    pushMock.mockReset();
    toastErrorMock.mockReset();
  });

  it("uses the shared input styling for all account fields", () => {
    render(<SetupForm />);

    for (const label of ["ID", "パスワード", "パスワード（確認）"]) {
      const input = screen.getByLabelText(label);
      expect(input).toHaveAttribute("data-slot", "input");
      expect(input).toHaveClass("h-9", "border-input", "focus-visible:ring-[3px]");
    }
  });

  it("creates the chosen account then navigates to the dashboard", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    render(<SetupForm />);
    fireEvent.change(screen.getByLabelText("ID"), { target: { value: "owner" } });
    fireEvent.change(screen.getByLabelText("パスワード"), { target: { value: "strong-secret-password" } });
    fireEvent.change(screen.getByLabelText("パスワード（確認）"), { target: { value: "strong-secret-password" } });
    fireEvent.click(screen.getByRole("button", { name: "アカウントを作成" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/setup", expect.objectContaining({
      method: "POST", body: JSON.stringify({ id: "owner", password: "strong-secret-password" }),
    })));
    expect(pushMock).toHaveBeenCalledWith("/");
  });

  it("does not submit when passwords disagree", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<SetupForm />);
    fireEvent.change(screen.getByLabelText("ID"), { target: { value: "owner" } });
    fireEvent.change(screen.getByLabelText("パスワード"), { target: { value: "strong-secret-password" } });
    fireEvent.change(screen.getByLabelText("パスワード（確認）"), { target: { value: "different-password" } });
    fireEvent.click(screen.getByRole("button", { name: "アカウントを作成" }));
    expect(toastErrorMock).toHaveBeenCalledWith("パスワードが一致しません。");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the server's rejection reason in a toast", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: "許可されていないリクエストです。" }),
    }));
    render(<SetupForm />);
    fireEvent.change(screen.getByLabelText("ID"), { target: { value: "owner" } });
    fireEvent.change(screen.getByLabelText("パスワード"), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText("パスワード（確認）"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "アカウントを作成" }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("許可されていないリクエストです。"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "アカウントを作成" })).toBeEnabled();
  });

  it("submits a short nonempty password", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<SetupForm />);
    fireEvent.change(screen.getByLabelText("ID"), { target: { value: "owner" } });
    fireEvent.change(screen.getByLabelText("パスワード"), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText("パスワード（確認）"), { target: { value: "short" } });
    expect(container.querySelector<HTMLFormElement>("form")?.checkValidity()).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "アカウントを作成" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });
});