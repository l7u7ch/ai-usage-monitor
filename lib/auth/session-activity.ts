export function startSessionActivity(target: EventTarget, fetcher: typeof fetch, onExpired: () => void) {
  const events = ["pointerdown", "keydown", "wheel", "touchstart"];
  const controller = new AbortController();
  let stopped = false;
  let pending = false;
  let latestActivity: number | null = null;
  let nextRequestAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function schedule() {
    if (stopped || pending || latestActivity === null || timer !== undefined) return;
    const delay = nextRequestAt - Date.now();
    if (delay > 0) {
      timer = setTimeout(() => { timer = undefined; void renew(); }, delay);
    } else {
      void renew();
    }
  }

  async function renew() {
    if (stopped || pending || latestActivity === null) return;
    const activityAt = latestActivity;
    latestActivity = null;
    // Suspended tabs must not turn old activity into a fresh session.
    if (Date.now() - activityAt > 60_000) return;
    pending = true;
    nextRequestAt = Date.now() + 30_000;
    try {
      const response = await fetcher("/api/session/renew", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ activityAt }),
        signal: controller.signal,
      });
      if (!stopped && response.status === 401) {
        stop();
        onExpired();
      }
    } catch {
      // No automatic retry: another genuine interaction can try again.
    } finally {
      pending = false;
      schedule();
    }
  }

  const onActivity: EventListener = (event) => {
    if (stopped || !event.isTrusted) return;
    latestActivity = Date.now();
    schedule();
  };

  function stop() {
    stopped = true;
    latestActivity = null;
    if (timer !== undefined) clearTimeout(timer);
    controller.abort();
    for (const event of events) target.removeEventListener(event, onActivity, true);
  }

  for (const event of events) target.addEventListener(event, onActivity, { capture: true, passive: true });
  return stop;
}
