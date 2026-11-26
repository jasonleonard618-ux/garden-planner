"use client";

import { useEffect, useMemo, useState } from "react";
import { CROPS } from "@/data/crops";
import { TIMING } from "@/data/timing";
import { PROBLEM_CATS, PROBLEMS } from "@/data/problems";
import { END, START, type Group } from "@/data/checklists";
import { SRC, type SrcKey } from "@/data/sources";
import { cropPlan, mdToDate, type CropPlan } from "@/lib/schedule";
import type { SiteData } from "@/lib/types";
import { guideFor, type RegionGuide } from "@/data/regions";

export type ToolView = "timeline" | "problems" | "checklist";
type Frost = NonNullable<SiteData["frost"]>;

const DAY = 864e5;
const fmtD = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
const span = (a: Date, b: Date) => (fmtD(a) === fmtD(b) ? fmtD(a) : `${fmtD(a)} to ${fmtD(b)}`);

export function SourceLink({ k }: { k: SrcKey | "app" | "practical" | "packet" }) {
  if (k === "practical") return <span className="label-pc">practical choice</span>;
  if (k === "packet") return <span className="label-pc">packet guidance</span>;
  if (k === "app") return <span className="label-pc">from your plan</span>;
  const s = SRC[k];
  return <a className="why" href={s.href} target="_blank" rel="noreferrer" title={s.label}>Why?</a>;
}

function seasonYear() {
  const now = new Date();
  return now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
}

// ---------- timeline ----------

/** A link to one of a state guide's sources. */
export function RegionLink({ g, k }: { g: RegionGuide; k: string }) {
  const s = g.sources[k];
  if (!s) return null;
  return <a className="why" href={s.href} target="_blank" rel="noreferrer" title={s.label}>Why?</a>;
}

/** Varieties, pests and timing for one crop from the state guide, or nothing if the state has none. */
export function LocalNotes({ g, id, timing = true }: { g: RegionGuide | null; id: string; timing?: boolean }) {
  if (!g) return null;
  const v = g.varieties[id], pe = g.pests[id], pt = g.pestTiming[id] ?? [], pl = g.planting[id];
  if (!v && !pe && !pt.length && !pl) return null;
  return (
    <div className="local">
      <p className="eyebrow">In {g.name}</p>
      {pl && timing && <p className="small"><b>When:</b> {pl.text} <RegionLink g={g} k={pl.src} /></p>}
      {v && <p className="small"><b>Varieties to try:</b> {v.names.join(", ")}. <RegionLink g={g} k={v.src} /></p>}
      {pe && <p className="small"><b>Watch for:</b> {pe.list}. <RegionLink g={g} k={pe.src} /></p>}
      {pt.map((n) => <p key={n.text} className="small">{n.text} <RegionLink g={g} k={n.src} /></p>)}
    </div>
  );
}

export function Timeline({ picks, frost, onPick, state }: { picks: string[]; frost: Frost | null; onPick: () => void; state?: string | null }) {
  const year = seasonYear();
  const guide = guideFor(state);
  const plans = useMemo(
    () => (frost ? (picks.map((id) => cropPlan(id, frost.lastSpring, frost.firstFall, year, guide?.weeks[id]?.weeks)).filter(Boolean) as CropPlan[]) : []),
    [picks, frost, year, guide],
  );
  const [sel, setSel] = useState(0);
  if (!frost) return <><h1 className="title">From seed to harvest</h1><p className="warn">We need your frost dates for this. Find your yard first, or try again if the climate lookup failed.</p></>;
  if (!plans.length) return <><h1 className="title">From seed to harvest</h1><p className="lede">Pick some crops and their seed-starting, planting and harvest dates appear here.</p><button className="btn primary" onClick={onPick}>Choose crops</button></>;

  const last = mdToDate(frost.lastSpring, year), first = mdToDate(frost.firstFall, year);
  const all = plans.flatMap((p) => [p.indoors?.from, p.sow?.from, p.buy, p.harvest?.to].filter(Boolean) as Date[]);
  const t0 = new Date(Math.min(new Date(year, 1, 1).getTime(), ...all.map((d) => d.getTime())));
  t0.setDate(1);
  const t1 = new Date(Math.max(new Date(year, 10, 30).getTime(), ...all.map((d) => d.getTime())));
  const pct = (d: Date) => `${(((d.getTime() - t0.getTime()) / (t1.getTime() - t0.getTime())) * 100).toFixed(2)}%`;
  const wid = (a: Date, b: Date) => `${(((b.getTime() - a.getTime()) / (t1.getTime() - t0.getTime())) * 100).toFixed(2)}%`;
  const months: Date[] = [];
  for (let d = new Date(t0); d <= t1; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) months.push(d);
  const today = new Date();
  const p = plans[Math.min(sel, plans.length - 1)];
  const t = TIMING[p.id];
  const c = CROPS.find((x) => x.id === p.id)!;
  const wk = guide?.weeks[p.id];

  return (
    <>
      <h1 className="title">From seed to harvest</h1>
      <p className="lede">Your {year} dates, worked out from your frost dates: last spring frost {fmtD(last)}, first fall frost {fmtD(first)}. <SourceLink k="noaa" /></p>
      {guide && <p className="small local-lede">Varieties, pests and planting notes use local guidance from {guide.extension}. {guide.general.map((n) => <span key={n.text}>{n.text} <RegionLink g={guide} k={n.src} /> </span>)}</p>}
      <div className="tl" role="table" aria-label="Planting timeline">
        <div className="tl-head" role="row">
          <span />
          <div className="tl-track">
            {months.map((m) => <span key={m.getTime()} className="tl-month" style={{ left: pct(m) }}>{m.toLocaleDateString(undefined, { month: "short" })}</span>)}
          </div>
        </div>
        {plans.map((q, i) => (
          <div key={q.id} className={`tl-row${i === sel ? " on" : ""}`} role="row">
            <button className="tl-name" onClick={() => setSel(i)} aria-pressed={i === sel}>{q.name.split(" /")[0].replace(" (flower)", "")}</button>
            <div className="tl-track">
              <i className="tl-line" style={{ left: pct(last) }} />
              <i className="tl-line warm" style={{ left: pct(new Date(last.getTime() + 21 * DAY)) }} />
              <i className="tl-line" style={{ left: pct(first) }} />
              {today >= t0 && today <= t1 && <i className="tl-today" style={{ left: pct(today) }} />}
              {q.indoors && <b className="bar indoors" style={{ left: pct(q.indoors.from), width: wid(q.indoors.from, q.indoors.to) }} />}
              {q.growInside && <b className="bar grow" style={{ left: pct(q.growInside.from), width: wid(q.growInside.from, q.growInside.to) }} />}
              {q.harden && <b className="bar harden" style={{ left: pct(q.harden.from), width: wid(q.harden.from, q.harden.to) }} />}
              {q.sow && <b className="bar sow" style={{ left: pct(q.sow.from), width: wid(q.sow.from, q.sow.to) }} />}
              {q.buy && <b className="bar buy" style={{ left: pct(q.buy), width: wid(q.buy, new Date(q.buy.getTime() + 10 * DAY)) }} />}
              {q.plantOut && <b className="dot" style={{ left: pct(q.plantOut) }} />}
              {q.harvest && <b className="bar harvest" style={{ left: pct(q.harvest.from), width: wid(q.harvest.from, q.harvest.to) }} />}
            </div>
          </div>
        ))}
      </div>
      <ul className="tl-key small">
        <li><b className="k indoors" />Start seeds inside</li><li><b className="k grow" />Growing inside</li><li><b className="k harden" />Harden off</li>
        <li><b className="k dotk" />Plant out</li><li><b className="k sow" />Sow in the bed</li><li><b className="k buy" />Buy plants</li><li><b className="k harvest" />Harvest</li>
      </ul>
      <p className="source">Lines: last spring frost, warm crops out (3 weeks later, a practical margin since half of years still get a later frost), first fall frost.</p>

      <section className="tl-detail">
        <h2>{p.name}</h2>
        <dl>
          {p.indoors && <><dt>Start seeds inside</dt><dd>{span(p.indoors.from, p.indoors.to)}{wk ? <> ({wk.weeks[0]} to {wk.weeks[1]} weeks ahead{wk.note ? `; ${wk.note}` : ""}) <RegionLink g={guide!} k={wk.src} /></> : t.weeks ? ` (${t.weeks[0]} to ${t.weeks[1]} weeks ahead)` : ""}</dd></>}
          {t.germF && <><dt>Sprouts best at</dt><dd>{t.germF}°F soil{t.germF >= 85 ? "; a heat mat helps" : ""}</dd></>}
          {p.harden && <><dt>Harden off</dt><dd>{span(p.harden.from, p.harden.to)}</dd></>}
          {p.plantOut && <><dt>{p.buy ? "Buy and plant" : "Plant out"}</dt><dd>About {fmtD(p.plantOut)}{c.warm ? ", after frost danger" : ", before the last frost; it handles light frost"}</dd></>}
          {p.sow && <><dt>Sow in the bed</dt><dd>{span(p.sow.from, p.sow.to)}</dd></>}
          {p.harvest && <><dt>Harvest</dt><dd>{span(p.harvest.from, p.harvest.to)} <span className="label-pc">packet guidance</span></dd></>}
        </dl>
        {p.notes.map((n) => <p key={n} className="small">{n}</p>)}
        <p className="small">{t.tip} <SourceLink k={t.src} /></p>
        <LocalNotes g={guide} id={p.id} />
      </section>
    </>
  );
}

// ---------- what's wrong ----------

export function Problems() {
  const [cat, setCat] = useState<string>("all");
  const [sel, setSel] = useState(PROBLEMS[0].id);
  const list = PROBLEMS.filter((p) => cat === "all" || p.cat === cat);
  const p = PROBLEMS.find((x) => x.id === sel) ?? list[0];
  return (
    <>
      <h1 className="title">What&apos;s wrong?</h1>
      <p className="lede">Pick what you&apos;re seeing. Each answer comes from Extension guides, linked under it.</p>
      <div className="chips" role="group" aria-label="Problem type">
        {PROBLEM_CATS.map(([k, label]) => <button key={k} className={cat === k ? "chip on" : "chip"} aria-pressed={cat === k} onClick={() => setCat(k)}>{label}</button>)}
      </div>
      <div className="prob-grid">
        {list.map((q) => (
          <button key={q.id} className={`prob${q.id === p.id ? " on" : ""}`} onClick={() => setSel(q.id)} aria-pressed={q.id === p.id}>
            <span className="prob-ico" dangerouslySetInnerHTML={{ __html: q.svg }} />
            <span>{q.name}</span>
          </button>
        ))}
      </div>
      {p && (
        <section className="prob-detail">
          <h2>{p.name}</h2>
          <p className="eyebrow">{p.crops}</p>
          <h3>What you see</h3><p>{p.see}</p>
          <h3>Why it happens</h3><p>{p.why}</p>
          <h3>What to do</h3>
          <ul>{p.todo.map((t) => <li key={t}>{t}</li>)}</ul>
          <p className="source">Sources: {p.src.map((k, i) => <span key={k}>{i ? ", " : ""}<a href={SRC[k].href} target="_blank" rel="noreferrer">{SRC[k].label}</a></span>)}</p>
        </section>
      )}
    </>
  );
}

// ---------- season checklist ----------

export function Checklist({ frost }: { frost: Frost | null }) {
  const year = seasonYear();
  const [which, setWhich] = useState<"start" | "end">(() => (new Date().getMonth() >= 7 ? "end" : "start"));
  const key = `ll-checklist-${year}`;
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => { try { setDone(JSON.parse(localStorage.getItem(key) ?? "[]")); } catch { /* none yet */ } }, [key]);
  const toggle = (id: string) => {
    const next = done.includes(id) ? done.filter((x) => x !== id) : [...done, id];
    setDone(next);
    localStorage.setItem(key, JSON.stringify(next));
  };
  const groups: Group[] = which === "start" ? START : END;
  const when = (g: Group) => {
    if (!frost) return null;
    const base = mdToDate(g.when.ref === "lastSpring" ? frost.lastSpring : frost.firstFall, which === "end" ? (new Date().getMonth() >= 5 ? new Date().getFullYear() : new Date().getFullYear() - 1) : year);
    return span(new Date(base.getTime() + g.when.fromDays * DAY), new Date(base.getTime() + g.when.toDays * DAY));
  };
  const total = groups.reduce((n, g) => n + g.tasks.length, 0);
  const ticked = groups.reduce((n, g) => n + g.tasks.filter((t) => done.includes(t.id)).length, 0);
  return (
    <>
      <h1 className="title">Season checklist</h1>
      <div className="tabs" role="tablist" aria-label="Season">
        <button role="tab" aria-selected={which === "start"} className={which === "start" ? "tab on" : "tab"} onClick={() => setWhich("start")}>Start of season</button>
        <button role="tab" aria-selected={which === "end"} className={which === "end" ? "tab on" : "tab"} onClick={() => setWhich("end")}>End of season</button>
      </div>
      <p className="muted small">{ticked} of {total} done.{frost ? " Dates follow your frost dates." : ""}</p>
      {groups.map((g) => (
        <section key={g.title} className="cl-group">
          <h3>{g.title}{when(g) ? ` · ${when(g)}` : ""}</h3>
          <ul>
            {g.tasks.map((t) => (
              <li key={t.id} className={done.includes(t.id) ? "done" : ""}>
                <label>
                  <input type="checkbox" checked={done.includes(t.id)} onChange={() => toggle(t.id)} />
                  <span><b>{t.title}</b> {t.detail} <SourceLink k={t.src} /></span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
