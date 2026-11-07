import { existsSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lockFile, withLock } from "../src/lock.js";
import { tempDir } from "./tmp.js";

const fail = (code: string) => Object.assign(new Error(code), { code });

describe("withLock on a busy file system", () => {
  it("keeps trying when Windows says the hold file is in use (EPERM, EBUSY, EACCES), and holds it while the body runs", () => {
    const root = tempDir();
    const dir = tempDir();
    const codes = ["EPERM", "EBUSY", "EACCES"];
    let tries = 0;
    const open = (file: string, flags: string) => {
      tries++;
      const code = codes.shift();
      if (code) throw fail(code);
      return openSync(file, flags);
    };
    const held = withLock(root, () => existsSync(lockFile(root, dir)), { dir, open });
    expect(held).toBe(true);
    expect(tries).toBe(4);
    expect(existsSync(lockFile(root, dir))).toBe(false);
  });

  it("says the plan is busy, and does not run the body, when the hold file stays in use", () => {
    const root = tempDir();
    let ran = false;
    const open = () => {
      throw fail("EPERM");
    };
    expect(() => withLock(root, () => (ran = true), { dir: tempDir(), open, timeoutMs: 60 })).toThrow(/is busy/);
    expect(ran).toBe(false);
  });

  it("still runs the body when the temp folder is missing", () => {
    const root = tempDir();
    const open = () => {
      throw fail("ENOENT");
    };
    expect(withLock(root, () => "ran", { dir: tempDir(), open })).toBe("ran");
  });
});

describe("taking over a stale hold", () => {
  it("does not remove a fresh hold another process took in the meantime", () => {
    const root = tempDir();
    const dir = tempDir();
    const file = lockFile(root, dir);
    writeFileSync(file, "999999 gone");
    // While this process judges the old hold stale, another process takes it over with a fresh one.
    const isAlive = (pid: number) => {
      if (pid === 999999) {
        writeFileSync(file, `${process.pid + 1} fresh`);
        return false;
      }
      return true;
    };
    expect(() => withLock(root, () => "ran", { dir, isAlive, timeoutMs: 80 })).toThrow(/is busy/);
    expect(readFileSync(file, "utf8")).toBe(`${process.pid + 1} fresh`);
  });

  it("takes over a stale hold and leaves nothing behind", () => {
    const root = tempDir();
    const dir = tempDir();
    writeFileSync(lockFile(root, dir), "999999 gone");
    expect(withLock(root, () => "ran", { dir, isAlive: (pid) => pid !== 999999 })).toBe("ran");
    expect(existsSync(lockFile(root, dir))).toBe(false);
  });
});
