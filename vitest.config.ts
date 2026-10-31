import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    exclude: [...configDefaults.exclude, ".codex-profiles/**", "data/**", ".worktrees/**"],
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, ".") },
  },
});
