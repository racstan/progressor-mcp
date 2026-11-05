import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  // A .md file imports as its text, as in the page's build (CHANGELOG.md for What's new).
  plugins: [{ name: "markdown-text", transform: (code: string, id: string) => (id.endsWith(".md") ? `export default ${JSON.stringify(code)};` : undefined) }],
  // .claude/worktrees holds helper agents' copies of the repo, with their own tests.
  test: { setupFiles: ["test/setup.ts"], exclude: [...configDefaults.exclude, ".claude/**"] },
});
