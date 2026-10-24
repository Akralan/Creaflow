import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    // Les worktrees de .claude/ sont des copies anciennes du dépôt : leurs tests ne sont pas les nôtres.
    exclude: ["**/node_modules/**", ".claude/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
