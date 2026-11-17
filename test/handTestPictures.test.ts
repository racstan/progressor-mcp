// Screenshots on a hand-test result: the Developer pastes or picks a picture on the dashboard; it is kept
// with the goal's other pictures, tied to that hand test, and the AI is told its path.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Dashboard, startDashboard } from "../src/dashboard/http.js";
import { projectEntry } from "../src/dashboard/registry.js";
import { parsePlanFile } from "../src/planFile.js";
import { MAX_PICTURE_BYTES, Project } from "../src/project.js";
import { tempDir } from "./tmp.js";

let root: string;
let agent: Project;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

beforeEach(() => {
  root = tempDir("progressor-shots-");
  agent = new Project({ root, session: { id: "s", pid: process.pid } });
  agent.addGoal("Login", [{ title: "Route" }]);
  agent.claimGoal("login");
  agent.addHandTest("Sign in on a phone", "login", "t1");
});

describe("a screenshot on a hand test", () => {
  it("is stored as the goal's next picture, tied to the hand test and marked as the Developer's", () => {
    const pic = agent.addHandTestPicture("login", "h1", "my shot.PNG", PNG);
    expect(pic).toMatchObject({ id: "p1", file: "p1.png", handTest: "h1", kind: "image", byDeveloper: true, caption: "my shot" });
    expect(readFileSync(join(root, ".progressor", "pictures", "login", "p1.png"))).toEqual(PNG);
    expect(agent.pictures("login")).toEqual([pic]);
    expect(agent.pictureFile("login", "p1.png")?.mime).toBe("image/png");
  });

  it("works on a goal no chat holds", () => {
    agent.releaseGoal("login");
    expect(agent.addHandTestPicture("login", "h1", "a.jpg", PNG).file).toBe("p1.jpg");
  });

  it("refuses an unknown goal or hand test, a type that is not a picture, an empty or too big file", () => {
    expect(() => agent.addHandTestPicture("nope", "h1", "a.png", PNG)).toThrow(/No Goal nope/);
    expect(() => agent.addHandTestPicture("login", "h9", "a.png", PNG)).toThrow(/No hand test h9/);
    expect(() => agent.addHandTestPicture("login", "h1", "notes.txt", PNG)).toThrow(/cannot be added/);
    expect(() => agent.addHandTestPicture("login", "h1", "a.png", Buffer.alloc(0))).toThrow(/empty/);
    expect(() => agent.addHandTestPicture("login", "h1", "a.png", Buffer.alloc(MAX_PICTURE_BYTES + 1))).toThrow(/limit/);
    expect(existsSync(join(root, ".progressor", "pictures", "login"))).toBe(false);
  });
});

describe("adding one from the dashboard", () => {
  let d: Dashboard;
  let id: string;
  beforeEach(async () => {
    d = await startDashboard({ project: agent, registryFile: join(tempDir("progressor-registry-"), "projects.json"), port: 20000 + Math.floor(Math.random() * 20000) });
    id = projectEntry(root).id;
  });
  afterEach(async () => {
    await d.close();
  });
  const upload = (test: string, name: string, data: Buffer, kind = "mark") =>
    fetch(new URL(`/api/projects/${id}/goals/login/hand-tests/${test}/pictures`, d.url), {
      method: "POST",
      headers: { origin: new URL(d.url).origin, "x-progressor": kind, "x-file-name": encodeURIComponent(name), "content-type": "application/octet-stream" },
      body: new Uint8Array(data),
    });
  const told = () => parsePlanFile(readFileSync(join(root, ".progressor", "talk", "login.md"), "utf8"), "login").messages.map((m) => m.text);

  it("stores it, tells the AI where it is, and shows it on the goal", async () => {
    const res = await upload("h1", "phone.png", PNG);
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ id: "p1", handTest: "h1", byDeveloper: true });
    expect(told()).toEqual([
      'On the dashboard I added a screenshot to the thing to try h1 ("Sign in on a phone"). It is at .progressor/pictures/login/p1.png: open it by that path if you need it.',
    ]);
    const view = (await (await fetch(new URL(`/api/projects/${id}/goals/login`, d.url))).json()) as { pictures: { id: string; handTest?: string }[] };
    expect(view.pictures.map((p) => [p.id, p.handTest])).toEqual([["p1", "h1"]]);
  });

  it("answers in plain words when the file can't be added", async () => {
    const res = await upload("h9", "phone.png", PNG);
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toMatch(/No hand test h9/);
    expect((await upload("h1", "notes.txt", PNG)).status).toBe(400);
  });

  it("only takes it from the dashboard's own page", async () => {
    const res = await fetch(new URL(`/api/projects/${id}/goals/login/hand-tests/h1/pictures`, d.url), {
      method: "POST",
      headers: { origin: "https://evil.example", "x-progressor": "mark" },
      body: new Uint8Array(PNG),
    });
    expect(res.status).toBe(403);
    expect(agent.pictures("login")).toEqual([]);
  });
});

describe("a pasted screenshot", () => {
  const item = (type: string, kind = "file") => ({ kind, type, getAsFile: () => new File([new Uint8Array([1, 2])], "image.png", { type }) });
  const list = (...items: ReturnType<typeof item>[]) => items as unknown as DataTransferItemList;

  it("is taken from the clipboard and named so its caption reads well", async () => {
    const { pastedPicture } = await import("../src/ui/AddShot.js");
    const file = pastedPicture(list(item("text/plain", "string"), item("image/png")));
    expect(file?.name).toBe("Your screenshot.png");
    expect(pastedPicture(list(item("image/jpeg")))?.name).toBe("Your screenshot.jpg");
  });

  it("leaves pasted text alone", async () => {
    const { pastedPicture } = await import("../src/ui/AddShot.js");
    expect(pastedPicture(list(item("text/plain", "string")))).toBeUndefined();
    expect(pastedPicture(undefined)).toBeUndefined();
  });
});
