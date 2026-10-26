import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  // .claude/worktrees holds helper agents' copies of the repo, with their own tests.
  test: { setupFiles: ["test/setup.ts"], exclude: [...configDefaults.exclude, ".claude/**"] },
});
