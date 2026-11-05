// The page's build (scripts/build-ui.mjs) and the tests (vitest.config.ts) load a .md file as its text.
declare module "*.md" {
  const text: string;
  export default text;
}
