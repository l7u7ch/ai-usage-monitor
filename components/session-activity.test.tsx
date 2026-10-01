import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionActivity } from "./session-activity";

const mocks = vi.hoisted(() => ({ path: "/", replace: vi.fn(), stop: vi.fn(), start: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.path, useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/lib/auth/session-activity", () => ({ startSessionActivity: mocks.start }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("session activity lifecycle", () => {
  it.each(["/", "/usage"])("listens on protected page %s and cleans up", (path) => {
    mocks.path = path;
    mocks.start.mockReturnValue(mocks.stop);
    const view = render(<SessionActivity />);
    expect(mocks.start).toHaveBeenCalledWith(document, expect.any(Function), expect.any(Function));
    mocks.start.mock.calls[0][2]();
    expect(mocks.replace).toHaveBeenCalledWith("/login");
    view.unmount();
    expect(mocks.stop).toHaveBeenCalledTimes(1);
  });
  it.each(["/login", "/setup"])("does not listen on %s", (path) => {
    mocks.path = path;
    render(<SessionActivity />);
    expect(mocks.start).not.toHaveBeenCalled();
  });
});
