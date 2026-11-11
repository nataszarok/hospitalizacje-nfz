import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // `.claude/**`: worktree sesji Claude Code (osobne kopie repo z własnym buildem).
  globalIgnores([".next/**", "node_modules/**", "dist/**", "out/**", ".claude/**"]),
]);
