import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startSessionActivity } from "./session-activity";

let handlers: Map<string, EventListener>;
let target: EventTarget;
let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
let expired: ReturnType<typeof vi.fn<() => void>>;
function activity(type = "pointerdown", trusted = true) {
  handlers.get(type)?.({ isTrusted: trusted } as Event);
}
beforeEach(() => {
  vi.useFakeTimers();
  handlers = new Map();
  target = {
    addEventListener: (type: string, listener: EventListener) => handlers.set(type, listener),
    removeEventListener: (type: string) => handlers.delete(type),
  } as unknown as EventTarget;
  fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
  expired = vi.fn();
});
afterEach(() => vi.useRealTimers());

describe("user activity renewal", () => {
  it("never renews on mounting, idle time, polling, or synthetic events", async () => {
    const stop = startSessionActivity(target, fetcher, expired);
    activity("pointerdown", false);
    activity("focus");
    activity("visibilitychange");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetcher).not.toHaveBeenCalled();
    stop();
  });
  it("renews on trusted activity and flushes the last activity timestamp once after throttling", async () => {
    const stop = startSessionActivity(target, fetcher, expired);
    activity();
    await vi.advanceTimersByTimeAsync(10_000);
    activity("keydown");
    const lastActivity = Date.now();
    await vi.advanceTimersByTimeAsync(19_999);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][0]).toBe("/api/session/renew");
    expect(JSON.parse(fetcher.mock.calls[1][1]!.body as string)).toEqual({ activityAt: lastActivity });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    stop();
  });
  it.each(["pointerdown", "keydown", "wheel", "touchstart"])("captures trusted %s", (type) => {
    const stop = startSessionActivity(target, fetcher, expired);
    activity(type);
    expect(fetcher).toHaveBeenCalledTimes(1);
    stop();
  });
  it("removes listeners, cancels trailing work, and aborts on cleanup", async () => {
    const stop = startSessionActivity(target, fetcher, expired);
    activity();
    await vi.advanceTimersByTimeAsync(1_000);
    activity();
    const signal = fetcher.mock.calls[0][1]!.signal!;
    stop();
    expect(handlers.size).toBe(0);
    expect(signal.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("stops permanently and redirects once on 401", async () => {
    fetcher.mockResolvedValue(new Response(null, { status: 401 }));
    const stop = startSessionActivity(target, fetcher, expired);
    activity();
    await vi.advanceTimersByTimeAsync(30_000);
    activity();
    expect(expired).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    stop();
  });
  it("does not retry a network failure automatically, but allows subsequent activity", async () => {
    fetcher.mockRejectedValueOnce(new Error("offline"));
    const stop = startSessionActivity(target, fetcher, expired);
    activity();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    activity();
    expect(fetcher).toHaveBeenCalledTimes(2);
    stop();
  });
  it("serializes requests while retaining the newest interaction", async () => {
    let resolve!: (response: Response) => void;
    fetcher.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const stop = startSessionActivity(target, fetcher, expired);
    activity();
    await vi.advanceTimersByTimeAsync(30_000);
    activity("keydown");
    const lastActivity = Date.now();
    expect(fetcher).toHaveBeenCalledTimes(1);
    resolve(new Response(null));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetcher.mock.calls[1][1]!.body as string).activityAt).toBe(lastActivity);
    stop();
  });
});
