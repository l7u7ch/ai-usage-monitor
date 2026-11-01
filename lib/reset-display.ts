"use client";

import { useSyncExternalStore } from "react";

const eventName = "reset-display-change";
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(eventName, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(eventName, callback); };
}
function snapshot() {
  try { return localStorage.getItem("reset-display") === "remaining"; }
  catch { return false; }
}
export function useResetDisplay() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
export function setResetDisplay(remaining: boolean) {
  localStorage.setItem("reset-display", remaining ? "remaining" : "date");
  window.dispatchEvent(new Event(eventName));
}
