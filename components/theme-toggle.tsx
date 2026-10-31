"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

const subscribe = () => () => {};

export function ThemeToggle() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const { resolvedTheme, setTheme } = useTheme();
  const dark = mounted && resolvedTheme === "dark";
  const label = dark ? "ライトモードに切り替え" : "ダークモードに切り替え";

  return (
    <Button variant="outline" size="sm" aria-label={label} title={label} onClick={() => setTheme(dark ? "light" : "dark")}>
      <Sun className="hidden dark:block" />
      <Moon className="block dark:hidden" />
      <span className="hidden dark:block">ライト</span>
      <span className="block dark:hidden">ダーク</span>
    </Button>
  );
}
