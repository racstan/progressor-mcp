/**
 * The Python package's version for an npm version. Python writes test versions differently
 * (1.5.0-beta.2 on npm is 1.5.0b2 on PyPI), so they are converted; anything else is refused so a
 * release never goes out with a version that doesn't match npm's.
 */
const PRE: Record<string, string> = { alpha: "a", beta: "b", rc: "rc" };

export function pythonVersion(npm: string): string {
  const m = /^(\d+\.\d+\.\d+)(?:-(alpha|beta|rc)\.(\d+))?$/.exec(npm);
  if (!m) throw new Error(`The Python package can't use the version ${npm}: use 1.2.3, or 1.2.3-alpha.1, -beta.1 or -rc.1.`);
  return m[2] ? `${m[1]}${PRE[m[2]]}${m[3]}` : m[1]!;
}
