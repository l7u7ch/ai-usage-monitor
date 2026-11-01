import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Settings } from "@/components/settings";
const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });
describe("settings", () => {
  it("saves reset display preference", () => {
    render(<Settings />);
    fireEvent.click(screen.getByRole("button", { name: "リセット表示を切り替え" }));
    expect(localStorage.getItem("reset-display")).toBe("remaining");
  });
  it("validates confirmation and redirects after password change", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    render(<Settings />);
    fireEvent.change(screen.getByLabelText("現在のパスワード"), { target: { value: "old" } });
    fireEvent.change(screen.getByLabelText("新しいパスワード"), { target: { value: "new" } });
    fireEvent.change(screen.getByLabelText("新しいパスワード（確認）"), { target: { value: "other" } });
    fireEvent.click(screen.getByRole("button", { name: "パスワードを変更" }));
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("新しいパスワード（確認）"), { target: { value: "new" } });
    fireEvent.click(screen.getByRole("button", { name: "パスワードを変更" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(fetchMock).toHaveBeenCalledWith("/api/password", expect.objectContaining({ method: "POST", body: JSON.stringify({ currentPassword: "old", newPassword: "new" }) }));
  });
});
