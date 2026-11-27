"use client";

import { CROPS } from "@/data/crops";
import {
  ALL_BEES, BEE_CROPS, BEE_SRC, BLOOM, BLOOM_MONTHS, BLOOM_TARGET, CALENDAR, CT_HELP, CT_RULES, GEAR, NESTS, SITE, TOWN_QUESTIONS,
  type BeeSrc,
} from "@/data/bees";
import { fmt } from "@/lib/geo";

export type BeeTab = "flowers" | "wild" | "spot" | "rules" | "kit";
export const BEE_TABS: [BeeTab, string][] = [["flowers", "Flowers"], ["wild", "Wild bees"], ["spot", "Hive spot"], ["rules", "Rules"], ["kit", "Hive kit"]];

/** What the person has chosen in the Bees tab. Saved with the plan. */
export type BeeState = {
  hives: 0 | 1 | 2;
  /** Only true once the person asks for the hive stand in their build plan. */
  stand?: boolean;
  plants: string[];
  hive: [number, number] | null;
  facing: string | null;
  lotFt: number | null;
  waterFt: number | null;
  checks: Record<string, boolean>;
};
export const DEFAULT_BEES: BeeState = { hives: 0, plants: [], hive: null, facing: null, lotFt: null, waterFt: null, checks: {} };

export function BeeLink({ k }: { k: BeeSrc }) {
  if (k === "practical") return <span className="label-pc">practical choice</span>;
  const s = BEE_SRC[k];
  return <a className="why" href={s.href} target="_blank" rel="noreferrer" title={s.label}>Why?</a>;
}

type HiveSun = { avg: number | null; am: number | null; pm: number | null; season: string } | null;

export function BeesPanel({ tab, setTab, bees, setBees, picks, state, wind, sun, sunBusy, hasPlace, placing, onPlace, onCancelPlace, onSheet, hasBuild }: {
  tab: BeeTab; setTab: (t: BeeTab) => void;
  bees: BeeState; setBees: (b: BeeState) => void;
  picks: string[]; state: string | null; wind: string | null;
  sun: HiveSun; sunBusy: boolean; hasPlace: boolean; placing: boolean;
  onPlace: () => void; onCancelPlace: () => void; onSheet: () => void; hasBuild: boolean;
}) {
  const set = (p: Partial<BeeState>) => setBees({ ...bees, ...p });
  return (
    <>
      <p className="eyebrow">Bees</p>
      <div className="tabs bee-tabs" role="tablist">
        {BEE_TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`tab${tab === k ? " on" : ""}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      {tab === "flowers" && <Flowers bees={bees} set={set} picks={picks} />}
      {tab === "wild" && <WildBees />}
      {tab === "spot" && <HiveSpot bees={bees} set={set} wind={wind} sun={sun} sunBusy={sunBusy} hasPlace={hasPlace} placing={placing} onPlace={onPlace} onCancelPlace={onCancelPlace} />}
      {tab === "rules" && <Rules state={state} bees={bees} set={set} />}
      {tab === "kit" && <HiveKit bees={bees} set={set} state={state} onSheet={onSheet} hasBuild={hasBuild} />}
    </>
  );
}

// ---------- flowers ----------

function Flowers({ bees, set, picks }: { bees: BeeState; set: (p: Partial<BeeState>) => void; picks: string[] }) {
  const needs = picks.filter((id) => BEE_CROPS[id]);
  const chosen = BLOOM.filter((p) => bees.plants.includes(p.id));
  const counts = Array.from({ length: 16 }, (_, i) => chosen.filter((p) => p.from <= i && i <= p.to).length);
  const gaps = ranges(counts.map((n) => n < BLOOM_TARGET));
  const toggle = (id: string) => set({ plants: bees.plants.includes(id) ? bees.plants.filter((x) => x !== id) : [...bees.plants, id] });
  return (
    <>
      <h1 className="title">Feed the bees</h1>
      <p className="lede">Flowers from early spring to fall feed honey bees and wild bees alike. You don’t need a hive for this part.</p>

      <h2 className="bee-h">Your crops that need bees</h2>
      {needs.length ? (
        <ul className="bee-list">
          {needs.map((id) => (
            <li key={id}><b>{CROPS.find((c) => c.id === id)?.name ?? id}</b> {BEE_CROPS[id].why} <BeeLink k={BEE_CROPS[id].src} /></li>
          ))}
        </ul>
      ) : (
        <p className="muted small">None of the crops you’ve picked so far rely on bees. Squash, cucumbers, melons, pumpkins, strawberries, raspberries and blueberries do.</p>
      )}

      <h2 className="bee-h">Bloom calendar</h2>
      <p className="small">Pick plants to see when something is in flower. Aim for at least {BLOOM_TARGET} in bloom at a time. <BeeLink k="caesGuide" /> <span className="label-pc">home-garden target is our choice</span></p>
      <div className="row" style={{ gap: 8, margin: "6px 0 10px" }}>
        <button className="btn" onClick={() => set({ plants: BLOOM.filter((p) => p.start).map((p) => p.id) })}>Starter mix</button>
        <button className="btn ghost" onClick={() => set({ plants: BLOOM.map((p) => p.id) })}>All</button>
        <button className="btn ghost" onClick={() => set({ plants: [] })}>Clear</button>
      </div>
      <div className="bloom" role="table" aria-label="Bloom calendar">
        <div className="bloom-row bloom-head" role="row">
          <span />
          <div className="bloom-track">{BLOOM_MONTHS.map((m) => <span key={m} className="bloom-month">{m}</span>)}</div>
        </div>
        {BLOOM.map((p) => {
          const on = bees.plants.includes(p.id);
          return (
            <div key={p.id} className={`bloom-row${on ? " on" : ""}`} role="row">
              <button className="bloom-name" onClick={() => toggle(p.id)} aria-pressed={on} title={`${p.latin} · ${p.kind}`}>
                <span className="bloom-box" aria-hidden>{on ? "✓" : ""}</span>{p.name}
              </button>
              <div className="bloom-track">
                <span className="bloom-bar" style={{ left: `${(p.from / 16) * 100}%`, width: `${((p.to - p.from + 1) / 16) * 100}%` }} />
              </div>
            </div>
          );
        })}
        <div className="bloom-row bloom-count" role="row">
          <span className="small">In bloom</span>
          <div className="bloom-track">
            {counts.map((n, i) => <span key={i} className={`bloom-n${n >= BLOOM_TARGET ? " ok" : n ? " low" : ""}`} style={{ left: `${(i / 16) * 100}%` }}>{n}</span>)}
          </div>
        </div>
      </div>
      <p className="small" style={{ marginTop: 8 }}>
        {!chosen.length ? "Pick a few plants, or start with the starter mix."
          : !gaps.length ? `At least ${BLOOM_TARGET} in bloom from March to October.`
          : `Fewer than ${BLOOM_TARGET} in bloom: ${gaps.map(([a, b]) => halfLabel(a, b)).join("; ")}.`}
      </p>
      <p className="muted small">Bloom times are for Connecticut. Wildflower times from the CAES native wildflower list <BeeLink k="stoner" />; trees and shrubs from the CAES citizen’s guide <BeeLink k="caesGuide" />; witch-hazel from UConn <BeeLink k="uconnBees" />.</p>

      <h2 className="bee-h">Good for every bee</h2>
      <ul className="bee-list">
        {ALL_BEES.map((t) => <li key={t.text}>{t.text} <BeeLink k={t.src} /></li>)}
      </ul>
    </>
  );
}

function ranges(flags: boolean[]): [number, number][] {
  const out: [number, number][] = [];
  flags.forEach((f, i) => {
    if (!f) return;
    const last = out[out.length - 1];
    if (last && last[1] === i - 1) last[1] = i; else out.push([i, i]);
  });
  return out;
}
const half = (i: number) => `${i % 2 ? "late" : "early"} ${BLOOM_MONTHS[Math.floor(i / 2)]}`;
const halfLabel = (a: number, b: number) => (a === b ? half(a) : `${half(a)} to ${half(b)}`);

// ---------- wild bees ----------

function WildBees() {
  return (
    <>
      <h1 className="title">Homes for wild bees</h1>
      <p className="lede">Most native bees live alone, and most nest in the ground or in hollow stems. A tidy yard has few places for them. These three steps help.</p>
      <div className="bee-cards">
        {NESTS.map((n) => (
          <div key={n.title} className="bee-card">
            <p className="eyebrow">{n.tag}</p>
            <h3>{n.title}</h3>
            <ul>{n.items.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        ))}
      </div>
      <p className="small">Source: UConn Home & Garden Education Center <BeeLink k="uconnBees" /></p>
    </>
  );
}

// ---------- hive spot ----------

const FACINGS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

function HiveSpot({ bees, set, wind, sun, sunBusy, hasPlace, placing, onPlace, onCancelPlace }: {
  bees: BeeState; set: (p: Partial<BeeState>) => void; wind: string | null; sun: HiveSun; sunBusy: boolean;
  hasPlace: boolean; placing: boolean; onPlace: () => void; onCancelPlace: () => void;
}) {
  const check = (k: string, v: boolean) => set({ checks: { ...bees.checks, [k]: v } });
  const near = bees.lotFt != null && bees.lotFt < SITE.lotLineFt;
  const water = bees.waterFt == null ? null : bees.waterFt >= SITE.waterMinFt && bees.waterFt <= SITE.waterMaxFt;
  const faceOk = bees.facing ? SITE.goodFacing.includes(bees.facing) : null;
  return (
    <>
      <h1 className="title">Find a hive spot</h1>
      <p className="lede">Place the hive stand on the map. We’ll check its sun, then walk through the rest of what Extension guides ask for.</p>

      <h2 className="bee-h">How many hives?</h2>
      <div className="chips">
        {([1, 2] as const).map((n) => <button key={n} className={`chip${bees.hives === n ? " on" : ""}`} onClick={() => set({ hives: n })}>{n === 1 ? "One hive" : "Two hives"}</button>)}
        <button className={`chip${bees.hives === 0 ? " on" : ""}`} onClick={() => set({ hives: 0 })}>Not yet</button>
      </div>
      <p className="muted small">Two is a common start, not a rule: with two you can compare them and borrow from one to help the other. NC State suggests two <BeeLink k="ncsu" />; UGA says one or two <BeeLink k="ugaBees" />. CAES suggests one or two on a home lot <BeeLink k="caesSite" />.</p>

      <h2 className="bee-h">Place it</h2>
      {!hasPlace ? <p className="small">Find your yard first (step 1), then come back to place the hive.</p>
        : placing ? (
          <div className="draw-help"><p>Tap where the hive stand would go. The dotted rings show 25 and 50 ft, the distance CAES gives for a water source.</p><button className="btn ghost" onClick={onCancelPlace}>Cancel</button></div>
        ) : (
          <div className="row" style={{ gap: 8 }}>
            <button className="btn primary" onClick={onPlace}>{bees.hive ? "Move the hive" : "Place the hive on the map"}</button>
            {bees.hive && <button className="btn ghost" onClick={() => set({ hive: null })}>Remove</button>}
          </div>
        )}

      {bees.hive && (
        <>
          <h2 className="bee-h">Sun at this spot</h2>
          {sun && sun.avg != null ? (
            <div className="stats">
              <div className="stat"><span className="stat-v">{fmt(sun.avg, 1)}</span><span className="stat-l">hrs direct sun, {sun.season}</span></div>
              {sun.am != null && <div className="stat"><span className="stat-v">{fmt(sun.am, 1)}</span><span className="stat-l">before midday</span></div>}
              {sun.pm != null && <div className="stat"><span className="stat-v">{fmt(sun.pm, 1)}</span><span className="stat-l">after midday</span></div>}
            </div>
          ) : <p className="muted small">{sunBusy ? "Working out the sun…" : "Sun hours show once the sun map for your yard has loaded."}</p>}
          <p className="small">
            The guides differ here. Penn State says full sun is best, and that hives in shade tend to be more defensive <BeeLink k="psu" />.
            CAES says to avoid direct sun <BeeLink k="caesSite" />. A middle path is morning sun with some afternoon shade <BeeLink k="practical" />.
            {sun?.am != null && sun?.pm != null && (sun.am + sun.pm < 2 ? " This spot is mostly shaded." : sun.am >= sun.pm ? " This spot gets more morning sun than afternoon sun." : " This spot gets more afternoon sun than morning sun.")}
          </p>
        </>
      )}

      <h2 className="bee-h">Which way will the entrance face?</h2>
      <div className="chips">{FACINGS.map((f) => <button key={f} className={`chip${bees.facing === f ? " on" : ""}`} onClick={() => set({ facing: f })}>{f}</button>)}</div>
      <p className="small">{faceOk == null ? "South or east is best." : faceOk ? "Good: south or east." : "South or east is better, so the entrance gets early sun."} <BeeLink k="psu" /></p>

      <div className="cl-group">
        <ul>
          <li className={bees.checks.wind ? "done" : ""}>
            <label><input type="checkbox" checked={!!bees.checks.wind} onChange={(e) => check("wind", e.target.checked)} />
              <span><b>Sheltered from wind</b>A fence, hedge or building on the windward side{wind ? `. Your prevailing wind is from the ${wind}` : ""}. <BeeLink k="psu" /></span></label>
          </li>
          <li className={bees.checks.dry ? "done" : ""}>
            <label><input type="checkbox" checked={!!bees.checks.dry} onChange={(e) => check("dry", e.target.checked)} />
              <span><b>Dry ground you can reach</b>Not a low wet spot, and close enough to carry boxes that can weigh over 60 lb. <BeeLink k="psu" /></span></label>
          </li>
          <li className={bees.checks.flyway ? "done" : ""}>
            <label><input type="checkbox" checked={!!bees.checks.flyway} onChange={(e) => check("flyway", e.target.checked)} />
              <span><b>Flight path kept up and away</b>If bees would fly across a walk, a play area or a neighbor’s yard, put a solid fence, hedge or hay bales at least {SITE.barrierFt} ft tall in front of the entrance. <BeeLink k="caesSite" /></span></label>
          </li>
        </ul>
      </div>

      <div className="bee-inputs">
        <label>Nearest lot line, ft<input type="number" min={0} value={bees.lotFt ?? ""} onChange={(e) => set({ lotFt: e.target.value === "" ? null : Number(e.target.value) })} /></label>
        <label>Water source, ft<input type="number" min={0} value={bees.waterFt ?? ""} onChange={(e) => set({ waterFt: e.target.value === "" ? null : Number(e.target.value) })} /></label>
      </div>
      {bees.lotFt != null && (
        <p className="small">{near ? `Within ${SITE.lotLineFt} ft of a lot line, put a barrier at least 5 ft tall between the hive and the line.` : `More than ${SITE.lotLineFt} ft from the lot line.`} <BeeLink k="psu" /></p>
      )}
      {water != null && (
        <p className="small">{water ? "Good distance." : `CAES suggests ${SITE.waterMinFt} to ${SITE.waterMaxFt} ft.`} Have it out by March 15 so the bees don’t settle on a neighbor’s pool or birdbath, and keep it filled to October 31. <BeeLink k="caesSite" /></p>
      )}
    </>
  );
}

// ---------- rules ----------

function Rules({ state, bees, set }: { state: string | null; bees: BeeState; set: (p: Partial<BeeState>) => void }) {
  const ct = state === "CT";
  const check = (k: string, v: boolean) => set({ checks: { ...bees.checks, [k]: v } });
  return (
    <>
      <h1 className="title">Check the rules</h1>
      <p className="lede">Most places allow a hive or two, but the rules come from your state and your town. Here’s what we know, and what to ask.</p>
      <h2 className="bee-h">{ct ? "Connecticut" : "State rules"}</h2>
      {ct ? (
        <ul className="bee-list">{CT_RULES.map((r) => <li key={r.text}>{r.text} <BeeLink k={r.src} /></li>)}</ul>
      ) : (
        <p className="small">We have state rules for Connecticut so far. Most states ask beekeepers to register with the state department of agriculture; check yours before your bees arrive. Here is the Connecticut page as an example <BeeLink k="caesReg" />.</p>
      )}
      <h2 className="bee-h">Ask your town</h2>
      <p className="small">Call the zoning office, and check any HOA or deed rules.</p>
      <div className="cl-group">
        <ul>
          {TOWN_QUESTIONS.map((q, i) => (
            <li key={q} className={bees.checks[`town${i}`] ? "done" : ""}>
              <label><input type="checkbox" checked={!!bees.checks[`town${i}`]} onChange={(e) => check(`town${i}`, e.target.checked)} /><span>{q}</span></label>
            </li>
          ))}
        </ul>
      </div>
      {ct && (
        <>
          <h2 className="bee-h">Help nearby</h2>
          <ul className="bee-list">{CT_HELP.map((r) => <li key={r.text}>{r.text} <BeeLink k={r.src} /></li>)}</ul>
        </>
      )}
    </>
  );
}

// ---------- hive kit ----------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function HiveKit({ bees, set, state, onSheet, hasBuild }: { bees: BeeState; set: (p: Partial<BeeState>) => void; state: string | null; onSheet: () => void; hasBuild: boolean }) {
  const n = bees.hives || 1;
  const ct = state === "CT";
  const tasks = CALENDAR.filter((t) => ct || !t.ctOnly);
  const groups: [string, typeof GEAR][] = [["For each hive", GEAR.filter((g) => g.per === "hive")], ["Shared tools", GEAR.filter((g) => g.per === "shared")], ["At the site", GEAR.filter((g) => g.per === "site")]];
  return (
    <>
      <h1 className="title">Your hive kit</h1>
      <p className="lede">A stand drawn to build from, what to buy, and your first year month by month.</p>
      {!bees.hives && (
        <div className="row" style={{ gap: 8, alignItems: "center" }}>
          <span className="small">Planning for</span>
          <div className="chips">{([1, 2] as const).map((k) => <button key={k} className="chip" onClick={() => set({ hives: k })}>{k === 1 ? "One hive" : "Two hives"}</button>)}</div>
        </div>
      )}

      <h2 className="bee-h">Hive stand, sheet H-101</h2>
      <p className="small">One stand holds one or two hives, 18 in off the ground to keep skunks and mice away <BeeLink k="mu" />, with the back legs ½ in taller so rain runs out the front <BeeLink k="psu" />. The sheet also shows the hive spot layout: flyway barrier, water distance and lot line.</p>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn primary" onClick={onSheet}>Open sheet H-101</button>
        <button className={bees.stand ? "btn" : "btn ghost"} aria-pressed={!!bees.stand} onClick={() => set({ stand: !bees.stand })}>{bees.stand ? "✓ In my build plan" : "Add to my build plan"}</button>
      </div>
      <p className="muted small">{bees.stand ? `Sheet H-101 and the stand lumber are in your build plan${hasBuild ? "" : " once you get to the Build step"}. Press again to take them out.` : "Not in your build plan unless you add it here or in the Build step."}</p>

      <h2 className="bee-h">What to buy{bees.hives ? `, ${bees.hives === 1 ? "one hive" : "two hives"}` : ""}</h2>
      {groups.map(([title, lines]) => (
        <table key={title} className="shop bee-gear">
          <caption>{title}</caption>
          <tbody>
            {lines.map((g) => (
              <tr key={g.item}><td><b>{g.item}</b><br /><span className="muted small">{g.note}</span> <BeeLink k={g.src} /></td><td className="num">{g.per === "hive" ? (g.qtyPerHive ?? 1) * n : 1}</td></tr>
            ))}
          </tbody>
        </table>
      ))}
      <p className="muted small">Box sizes vary a little by maker. A local club can point you to good suppliers.</p>

      <h2 className="bee-h">First year{ct ? " in Connecticut" : ""}</h2>
      <div className="tl bee-cal">
        <div className="tl-head"><span /><div className="tl-track">{MONTHS.map((m, i) => <span key={m} className="tl-month" style={{ left: `${(i / 12) * 100}%` }}>{m[0]}</span>)}</div></div>
        {tasks.map((t) => (
          <div key={t.title} className="tl-row bee-task">
            <span className="tl-name" title={t.detail}>{t.title}</span>
            <div className="tl-track"><span className={`bee-bar${t.law ? " law" : ""}`} style={{ left: `${(t.from / 12) * 100}%`, width: `${Math.max(1.5, ((t.to - t.from) / 12) * 100)}%` }} /></div>
          </div>
        ))}
      </div>
      <ul className="bee-list bee-cal-list">
        {tasks.map((t) => <li key={t.title}><b>{t.title}.</b> {t.detail} <BeeLink k={t.src} /></li>)}
      </ul>
      {!ct && <p className="muted small">Dates are for Connecticut; adjust for your climate and check your state’s registration rules.</p>}
    </>
  );
}
