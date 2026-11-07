import { networkInterfaces } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type Dashboard, dashboardHost, startDashboard } from "../src/dashboard/http.js";
import { tempDir } from "./tmp.js";

const open: Dashboard[] = [];
afterEach(async () => {
  for (const d of open.splice(0)) await d.close();
});
const freePort = () => 20000 + Math.floor(Math.random() * 20000);

/** An IPv4 address of this computer that is not loopback, if it has one (CI machines may not). */
const outsideAddress = Object.values(networkInterfaces())
  .flat()
  .find((a) => a && a.family === "IPv4" && !a.internal)?.address;

/** Whether something answers on that address and port (any HTTP status), or the connection is refused. */
async function answers(address: string, port: number): Promise<boolean> {
  try {
    await fetch(`http://${address}:${port}/api/info`, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

describe("the address the dashboard listens on", () => {
  it("is loopback unless PROGRESSOR_HOST says otherwise", () => {
    expect(dashboardHost({})).toBe("127.0.0.1");
    expect(dashboardHost({ PROGRESSOR_HOST: "" })).toBe("127.0.0.1");
    expect(dashboardHost({ PROGRESSOR_HOST: "  " })).toBe("127.0.0.1");
    expect(dashboardHost({ PROGRESSOR_HOST: "0.0.0.0" })).toBe("0.0.0.0");
    expect(dashboardHost({ PROGRESSOR_HOST: " 0.0.0.0 " })).toBe("0.0.0.0");
  });

  it("still answers on localhost when it listens on every address", async () => {
    const registryFile = join(tempDir("progressor-host-"), "projects.json");
    const d = await startDashboard({ registryFile, port: freePort(), host: "0.0.0.0" });
    open.push(d);
    expect(d.role).toBe("serving");
    const res = await fetch(`http://127.0.0.1:${d.port}/api/info`);
    expect(res.status).toBe(200);
  });

  it.skipIf(!outsideAddress)("is reachable from outside only when asked to listen on every address", async () => {
    const registryFile = join(tempDir("progressor-host-"), "projects.json");
    const local = await startDashboard({ registryFile, port: freePort() });
    open.push(local);
    expect(await answers(outsideAddress!, local.port)).toBe(false);

    const everywhere = await startDashboard({ registryFile: join(tempDir("progressor-host-"), "projects.json"), port: freePort(), host: "0.0.0.0" });
    open.push(everywhere);
    expect(await answers(outsideAddress!, everywhere.port)).toBe(true);
  });

  it("still refuses a page that names another host, when it listens on every address", async () => {
    const registryFile = join(tempDir("progressor-host-"), "projects.json");
    const d = await startDashboard({ registryFile, port: freePort(), host: "0.0.0.0" });
    open.push(d);
    const { request } = await import("node:http");
    const status = await new Promise<number>((done, fail) => {
      const req = request({ host: "127.0.0.1", port: d.port, path: "/api/projects", headers: { host: `attacker.example:${d.port}` } }, (res) => {
        res.resume();
        done(res.statusCode ?? 0);
      });
      req.on("error", fail);
      req.end();
    });
    expect(status).toBe(403);
  });
});
