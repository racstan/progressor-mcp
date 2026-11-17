// "Since you last looked": at the top of the project's Dashboard page, a line saying what changed
// since the Developer last looked, and below it the feed of what happened, newest first, by day.
// The time of the last look is kept in this browser and updated when they leave the page.
import { useEffect, useMemo, useState } from "react";
import { digestLines, markNew } from "../feed.js";
import { useFeed } from "./data.js";
import { dayGroups } from "./goalList.js";
import { Loading } from "./Loading.js";
import { exactDate } from "./words.js";
import { readLastLook, writeLastLook } from "./lastLook.js";

const SHOWN = 30;

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function SinceLook({ projectId, version, onOpenGoal }: { projectId: string; version: unknown; onOpenGoal: (id: string) => void }) {
  // The time of the last look is read once, when the page opens; it moves on when the page is left.
  const [since] = useState(() => readLastLook(projectId));
  useEffect(() => {
    const save = () => writeLastLook(projectId);
    window.addEventListener("pagehide", save);
    return () => {
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [projectId]);
  const feed = useFeed(projectId, version);
  const items = useMemo(() => (feed ? markNew(feed, since) : []), [feed, since]);
  const [all, setAll] = useState(false);
  if (feed === undefined) return <Loading />;
  if (feed === null) return null;
  const shown = all ? items : items.slice(0, SHOWN);
  const groups = dayGroups(shown, (i) => i.at, "newest");
  return (
    <section className="section since-look">
      <h2>Since you last looked</h2>
      <p className="stat-lead" role="status">{digestLines(items, since)}</p>
      {items.length === 0 ? (
        <p className="quiet">Nothing has happened in this project yet.</p>
      ) : (
        <div className="feed-scroll" tabIndex={0} aria-label="What happened, newest first">
          {groups.map((g) => (
            <div key={g.key} className="feed-day">
              <h3>{g.heading}</h3>
              <ul>
                {g.items.map((i) => (
                  <li key={i.key} className={i.isNew ? "feed-new" : undefined}>
                    <span className="who">{i.by === "AI" ? "Your AI" : "You on the dashboard"}</span> {i.text}
                    {" "}
                    <button className="linkbtn" onClick={() => onOpenGoal(i.goalId)} title={`Open the goal "${i.goalTitle}"`}>{i.goalTitle}</button>
                    {i.isNew && <b className="feed-tag">New</b>}
                    <time dateTime={i.at} title={exactDate(i.at)}>{clock(i.at)}</time>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {!all && items.length > SHOWN && <button className="btn ghost" onClick={() => setAll(true)}>Show the other {items.length - SHOWN}</button>}
        </div>
      )}
    </section>
  );
}
