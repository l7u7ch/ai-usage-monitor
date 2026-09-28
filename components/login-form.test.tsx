import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "@/components/login-form";

const { pushMock, toastErrorMock } = vi.hoisted(() => ({ pushMock: vi.fn(), toastErrorMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock } }));

describe("LoginForm", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    pushMock.mockReset();
    toastErrorMock.mockReset();
  });

  it("uses the shared input styling for both credential fields", () => {
    render(<LoginForm />);

    for (const label of ["ID", "パスワード"]) {
      const input = screen.getByLabelText(label);
      expect(input).toHaveAttribute("data-slot", "input");
      expect(input).toHaveClass("h-9", "border-input", "focus-visible:ring-[3px]");
    }
  });

  it("submits ID and password then continues after successful login", async () => {
    const onAuthenticated = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<LoginForm onAuthenticated={onAuthenticated} />);
    fireEvent.change(screen.getByLabelText("ID"), { target: { value: "admin" } });
    fireEvent.change(screen.getByLabelText("パスワード"), { target: { value: "admin" } });
    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: "admin", password: "admin" }),
      });
    });
    expect(onAuthenticated).toHaveBeenCalledOnce();
  });

  it("keeps the login button pending until navigation unmounts the form", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("ID"), { target: { value: "owner" } });
    fireEvent.change(screen.getByLabelText("パスワード"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/"));
    const button = screen.getByRole("button", { name: "ログイン中…" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("shows an error when the credentials are rejected", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    render(<LoginForm onAuthenticated={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("ID"), { target: { value: "admin" } });
    fireEvent.change(screen.getByLabelText("パスワード"), { target: { value: "incorrect" } });
    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("IDまたはパスワードが正しくありません。"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ログイン" })).toBeEnabled();
  });
});
