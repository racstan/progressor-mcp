// Fills the Python package (python/) with the built Progressor, ready for `uv build python` or
// `python -m build python`. Run `npm run build` first; `npm run build:python` does both.
//
// The package carries dist/, package.json and the production node_modules (installed fresh from
// package-lock.json in a temporary folder, so your own node_modules is left alone), and writes the
// version from package.json, converted to Python's spelling.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const pkg = join(root, "python", "src", "progressor_mcp");
const app = join(pkg, "app");

if (!existsSync(join(root, "dist", "cli.js"))) {
  console.error("build-python: dist/ is missing. Run `npm run build` first.");
  process.exit(1);
}
const { pythonVersion } = await import(new URL("../dist/pythonVersion.js", import.meta.url).href);
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const py = pythonVersion(version);

rmSync(app, { recursive: true, force: true });
cpSync(join(root, "dist"), join(app, "dist"), { recursive: true });
cpSync(join(root, "package.json"), join(app, "package.json"));
cpSync(join(root, "LICENSE.md"), join(app, "LICENSE.md"));
cpSync(join(root, "LICENSE.md"), join(root, "python", "LICENSE.md"));

const deps = mkdtempSync(join(tmpdir(), "progressor-python-"));
try {
  cpSync(join(root, "package.json"), join(deps, "package.json"));
  cpSync(join(root, "package-lock.json"), join(deps, "package-lock.json"));
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  execFileSync(npm, ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], {
    cwd: deps,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  cpSync(join(deps, "node_modules"), join(app, "node_modules"), { recursive: true });
} finally {
  rmSync(deps, { recursive: true, force: true });
}

writeFileSync(join(pkg, "_version.py"), `# Written by scripts/build-python.mjs from package.json (${version}).\n__version__ = "${py}"\n`);
console.log(`build-python: python/ holds Progressor ${version} (Python version ${py}).`);
