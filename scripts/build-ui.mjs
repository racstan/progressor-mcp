// Bundles the dashboard page (src/ui) into dist/ui, which the MCP server serves. React is bundled in,
// so the published package needs nothing extra at runtime. `--watch` rebuilds on change.
import { copyFileSync, mkdirSync } from "node:fs";
import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");
mkdirSync("dist/ui", { recursive: true });
for (const f of ["index.html", "styles.css", "favicon.svg"]) copyFileSync(`src/ui/${f}`, `dist/ui/${f}`);

const options = {
  entryPoints: ["src/ui/main.tsx"],
  outfile: "dist/ui/app.js",
  bundle: true,
  format: "esm",
  target: "es2022",
  jsx: "automatic",
  minify: !watch,
  sourcemap: watch,
  define: { "process.env.NODE_ENV": JSON.stringify(watch ? "development" : "production") },
  logLevel: "info",
};
if (watch) await (await esbuild.context(options)).watch();
else await esbuild.build(options);
