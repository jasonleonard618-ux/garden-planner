"use client";

import { Fragment, useMemo } from "react";
import type { Bed } from "@/lib/beds";
import type { Plan } from "@/lib/layout";
import { BED_TIERS, bedLines, dripLines, fenceLayout, fenceLines, FENCE_TIERS, total, type Line, type Tier } from "@/lib/build";
import { measure } from "@/lib/geo";
import { SRC } from "@/data/sources";
import { SourceLink } from "./GrowTools";
import type { LngLat } from "@/lib/types";

type BedTier = keyof typeof BED_TIERS;
type FenceTier = Tier | "none";
const usd = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const ftIn = (ft: number) => { const f = Math.floor(ft + 1e-6); const i = Math.round((ft - f) * 12); return i === 12 ? `${f + 1}'-0"` : `${f}'-${i}"`; };

export type BuildChoices = { bed: BedTier; fence: FenceTier; drip: boolean };

export function useBuild(garden: LngLat[] | null, beds: Bed[], c: BuildChoices) {
  return useMemo(() => {
    if (!garden) return null;
    const m = measure(garden);
    const sideFt = m.sides.map((s) => s.ft);
    const fl = c.fence !== "none" ? fenceLayout(garden, sideFt, FENCE_TIERS[c.fence].maxBayFt) : null;
    const ys = garden.map((p) => p[1]);
    const lengthFt = ((Math.max(...ys) - Math.min(...ys)) * 110574) * 3.28084;
    const groups: { title: string; lines: Line[] }[] = [{ title: `Beds (${beds.length}), ${BED_TIERS[c.bed].name}`, lines: bedLines(beds.length, c.bed) }];
    if (fl && c.fence !== "none") groups.push({ title: `Fence, ${FENCE_TIERS[c.fence].name}`, lines: fenceLines(fl, c.fence) });
    if (c.drip) groups.push({ title: "Drip watering", lines: dripLines(beds.length, Math.ceil(lengthFt + 25)) });
    return { m, fl, groups, sum: groups.reduce((s, g) => s + total(g.lines), 0) };
  }, [garden, beds, c]);
}

export function BuildStep({ garden, beds, choices, setChoices, onOpen }: {
  garden: LngLat[]; beds: Bed[]; choices: BuildChoices; setChoices: (c: BuildChoices) => void; onOpen: () => void;
}) {
  const b = useBuild(garden, beds, choices);
  if (!b) return null;
  return (
    <>
      <h1 className="title">Preview the build</h1>
      <p className="lede">Pick a level for the beds and the fence. Quantities come from your layout; prices are rough, so check your local store.</p>
      <h3>Beds</h3>
      <div className="tiers" role="radiogroup" aria-label="Bed level">
        {(Object.keys(BED_TIERS) as BedTier[]).map((k) => (
          <button key={k} role="radio" aria-checked={choices.bed === k} className={choices.bed === k ? "tier on" : "tier"} onClick={() => setChoices({ ...choices, bed: k })}>
            <BedTierArt tier={k} />
            <b>{BED_TIERS[k].name}</b>
            <small>{Math.round(BED_TIERS[k].courses * 9.25)} in tall{BED_TIERS[k].cap ? ", seat cap" : ""}</small>
          </button>
        ))}
      </div>
      <p className="small">{BED_TIERS[choices.bed].summary}{choices.bed !== "good" && <span className="label-pc">practical choice</span>}</p>
      <h3>Critter fence</h3>
      <div className="tiers four" role="radiogroup" aria-label="Fence level">
        {(["good", "better", "best", "excellent"] as Tier[]).map((k) => (
          <button key={k} role="radio" aria-checked={choices.fence === k} className={choices.fence === k ? "tier on" : "tier"} onClick={() => setChoices({ ...choices, fence: k })}>
            <FenceTierArt tier={k} />
            <b>{FENCE_TIERS[k].name}</b>
            <small>{FENCE_TIERS[k].heightIn / 12} ft · {FENCE_TIERS[k].keeps.split(",")[0].replace(" plus the above", "")}</small>
          </button>
        ))}
      </div>
      <label className="check small"><input type="checkbox" checked={choices.fence === "none"} onChange={(e) => setChoices({ ...choices, fence: e.target.checked ? "none" : "better" })} /> No fence</label>
      {choices.fence !== "none" && b.fl && (
        <>
          <p className="small"><b>Keeps out: {FENCE_TIERS[choices.fence].keeps}.</b> {FENCE_TIERS[choices.fence].summary} <SourceLink k={FENCE_TIERS[choices.fence].src === "uga" ? "ugaFence" : "practical"} /></p>
          <div className="stats">
            <div className="stat"><span className="stat-v">{b.fl.posts}</span><span className="stat-l">Posts</span></div>
            <div className="stat"><span className="stat-v">{Math.round(b.fl.perimeterFt)} ft</span><span className="stat-l">Fence length</span></div>
            <div className="stat"><span className="stat-v">4 ft</span><span className="stat-l">Gate, south side</span></div>
          </div>
        </>
      )}
      <label className="check"><input type="checkbox" checked={choices.drip} onChange={(e) => setChoices({ ...choices, drip: e.target.checked })} /> Add drip watering on a timer</label>
      <div className="stats">
        <div className="stat"><span className="stat-v">{usd(b.sum)}</span><span className="stat-l">Rough materials total</span></div>
      </div>
      <div className="notes-811">
        <p><b>Before you dig:</b> call 811 a few days ahead so buried lines get marked. It&apos;s free. <a className="why" href={SRC.call811.href} target="_blank" rel="noreferrer">Why?</a></p>
        <p><b>Check local rules:</b> many towns and HOAs limit fence height or need a permit, and posts set in concrete should go below your local frost line. Your building department can tell you both.</p>
      </div>
      <button className="btn primary" onClick={onOpen}>Open the build plan</button>
      <p className="muted small">Drawings, cut lists and the shopping list, ready to print or save as a PDF. Free during the pilot.</p>
    </>
  );
}

// ---------- tier comparison drawings (build preview) ----------

const INK = "#10221F", WOOD = "#F4EFE6", WOOD2 = "#E9DFCF", CORAL = "#FF6F47";

/** End view of a bed at each level, drawn to one scale so the height difference shows. */
function BedTierArt({ tier }: { tier: BedTier }) {
  const t = BED_TIERS[tier];
  const s = 2.6; // px per inch
  const W = 48 * s * 0.75, course = 9.25 * s, base = 70;
  const h = t.courses * course;
  const x0 = (130 - W) / 2;
  return (
    <svg viewBox="0 0 130 82" width="100%" aria-hidden="true">
      <line x1="4" y1={base} x2="126" y2={base} stroke={INK} strokeWidth="1" />
      {/* soil */}
      <rect x={x0 + 4} y={base - h + 6} width={W - 8} height={h - 6} fill="#6B4F3A" />
      {Array.from({ length: t.courses }, (_, i) => (
        <g key={i}>
          <rect x={x0 - 4} y={base - (i + 1) * course} width="4" height={course} fill={WOOD} stroke={INK} strokeWidth="0.8" />
          <rect x={x0 + W} y={base - (i + 1) * course} width="4" height={course} fill={WOOD} stroke={INK} strokeWidth="0.8" />
        </g>
      ))}
      {t.liner && <><line x1={x0 + 0.8} y1={base - h + 2} x2={x0 + 0.8} y2={base} stroke={CORAL} strokeWidth="1.6" /><line x1={x0 + W - 0.8} y1={base - h + 2} x2={x0 + W - 0.8} y2={base} stroke={CORAL} strokeWidth="1.6" /></>}
      {t.cap && <rect x={x0 - 10} y={base - h - 4} width={W + 20} height="4" fill={WOOD2} stroke={INK} strokeWidth="0.8" />}
      {/* height mark, left of the bed */}
      <line x1={x0 - 16} y1={base - h} x2={x0 - 16} y2={base} stroke={INK} strokeWidth="0.8" />
      <line x1={x0 - 19} y1={base - h} x2={x0 - 13} y2={base - h} stroke={INK} strokeWidth="0.8" />
    </svg>
  );
}

/** One fence bay at each level, all to one scale (8 ft tall at most), ground line and apron shown. */
function FenceTierArt({ tier }: { tier: Tier }) {
  const t = FENCE_TIERS[tier];
  const s = 0.62; // px per inch
  const ground = 72, h = t.heightIn * s, x0 = 22, x1 = 108;
  const meshH = tier === "good" ? h : tier === "better" ? h : 24 * s;
  return (
    <svg viewBox="0 0 130 82" width="100%" aria-hidden="true">
      {/* scale ticks every 2 ft */}
      {[2, 4, 6, 8].map((ft) => <line key={ft} x1="6" y1={ground - ft * 12 * s} x2="10" y2={ground - ft * 12 * s} stroke="#9AA9A5" strokeWidth="0.8" />)}
      <line x1="8" y1={ground} x2="8" y2={ground - 96 * s} stroke="#9AA9A5" strokeWidth="0.8" />
      {/* apron along the ground, outside */}
      <line x1={x0 - 14} y1={ground} x2={x1 + 2} y2={ground} stroke={INK} strokeWidth="1" />
      <line x1={x0 - 14} y1={ground + 2.5} x2={x0} y2={ground + 2.5} stroke={CORAL} strokeWidth="2" />
      {tier === "excellent" ? (
        <>
          {/* cattle-panel bay with kickboard, deer wires above */}
          <rect x={x0} y={ground - 52 * s} width={x1 - x0} height={52 * s} fill="none" stroke={INK} strokeWidth="1.2" />
          {Array.from({ length: 7 }, (_, i) => <line key={i} x1={x0 + ((x1 - x0) / 7) * i} y1={ground - 52 * s} x2={x0 + ((x1 - x0) / 7) * i} y2={ground} stroke={INK} strokeWidth="0.5" />)}
          {Array.from({ length: 5 }, (_, i) => <line key={i} x1={x0} y1={ground - 52 * s + i * 8} x2={x1} y2={ground - 52 * s + i * 8} stroke={INK} strokeWidth="0.5" />)}
          <rect x={x0} y={ground - 8 * s} width={x1 - x0} height={8 * s} fill={WOOD2} stroke={INK} strokeWidth="0.8" />
          {[66, 80, 94].map((inch) => <line key={inch} x1={x0} y1={ground - inch * s} x2={x1} y2={ground - inch * s} stroke={INK} strokeWidth="0.6" />)}
        </>
      ) : (
        <>
          <rect x={x0} y={ground - meshH} width={x1 - x0} height={meshH} fill="url(#mesh)" stroke={INK} strokeWidth="0.6" />
          {tier === "best" && <rect x={x0} y={ground - h} width={x1 - x0} height={h - meshH} fill="url(#net)" />}
          {tier === "better" && <line x1={x0} y1={ground - h} x2={x0 - 8} y2={ground - h - 8} stroke={INK} strokeWidth="0.8" />}
          {tier === "better" && <line x1={x1} y1={ground - h} x2={x1 - 8} y2={ground - h - 8} stroke={INK} strokeWidth="0.8" />}
        </>
      )}
      {/* posts */}
      <rect x={x0 - 2} y={ground - h - 2} width="4" height={h + 6} fill={tier === "good" || tier === "better" ? "#5C6B68" : WOOD} stroke={INK} strokeWidth="0.6" />
      <rect x={x1 - 2} y={ground - h - 2} width="4" height={h + 6} fill={tier === "good" || tier === "better" ? "#5C6B68" : WOOD} stroke={INK} strokeWidth="0.6" />
      <defs>
        <pattern id="mesh" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 0H4V4" fill="none" stroke={INK} strokeWidth="0.35" /></pattern>
        <pattern id="net" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 0H7V7" fill="none" stroke={INK} strokeWidth="0.3" /></pattern>
      </defs>
    </svg>
  );
}

// ---------- the printable sheet set ----------

function useLocal(garden: LngLat[]) {
  const lat0 = garden.reduce((a, p) => a + p[1], 0) / garden.length;
  const lon0 = garden.reduce((a, p) => a + p[0], 0) / garden.length;
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180) * 3.28084, ky = 110574 * 3.28084;
  return (p: LngLat): [number, number] => [(p[0] - lon0) * kx, (p[1] - lat0) * ky];
}

function PlanSvg({ garden, beds, fl, kind }: { garden: LngLat[]; beds: Bed[]; fl: ReturnType<typeof fenceLayout> | null; kind: "site" | "fence" | "drip" }) {
  const toFt = useLocal(garden);
  const ring = garden.map(toFt);
  const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
  const pad = 8;
  const [x0, x1, y0, y1] = [Math.min(...xs) - pad, Math.max(...xs) + pad, Math.min(...ys) - pad, Math.max(...ys) + pad];
  const W = kind === "site" ? 520 : 640, s = Math.min(W / (x1 - x0), 380 / (y1 - y0));
  const H = (y1 - y0) * s;
  const P = ([x, y]: [number, number]) => [(x - x0) * s, (y1 - y) * s] as [number, number];
  const path = ring.map((p, i) => `${i ? "L" : "M"}${P(p).join(" ")}`).join(" ") + "Z";
  const posts: [number, number][] = [];
  if (fl) ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length], sd = fl.sides[i];
    const run = sd.gate ? (sd.ft - 4) / sd.ft : 1;
    for (let k = 0; k < sd.bays; k++) { const t = (k / sd.bays) * run; posts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    if (sd.gate) posts.push([a[0] + (b[0] - a[0]) * run, a[1] + (b[1] - a[1]) * run]);
  });
  const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const scaleFt = 10;
  return (
    <svg viewBox={`-150 -30 ${W + 300} ${H + 80}`} className="sheet-svg" role="img" aria-label={`${kind} plan`}>
      <path d={path} fill={kind === "site" ? "#EEF5F0" : "none"} stroke="#10221F" strokeWidth={kind === "fence" ? 2.2 : 1.2} strokeDasharray={kind === "site" ? "5 3" : undefined} />
      {beds.map((bd) => {
        const r = bd.ring.map(toFt).map(P);
        return (
          <g key={bd.id}>
            <path d={r.map((p, j) => `${j ? "L" : "M"}${p.join(" ")}`).join(" ") + "Z"} fill={kind === "site" ? "#fff" : "#F4F4F2"} stroke="#10221F" strokeWidth="1" />
            {kind === "site" && <line x1={r[0][0]} y1={(r[0][1] + r[2][1]) / 2 + (r[2][1] - r[0][1]) * 0.18} x2={r[1][0]} y2={(r[0][1] + r[2][1]) / 2 + (r[2][1] - r[0][1]) * 0.18} stroke="#10221F" strokeWidth="0.5" strokeDasharray="2 2" opacity="0" />}
            {kind !== "drip" && <text x={(r[0][0] + r[2][0]) / 2} y={(r[0][1] + r[2][1]) / 2 + 4} textAnchor="middle" className="sv-t">{bd.n}</text>}
            {kind === "drip" && [0.2, 0.5, 0.8].map((f) => {
              // three emitter lines along the bed's long side, inset a little from each end
              const a = [r[0][0] + (r[1][0] - r[0][0]) * f, r[0][1] + (r[1][1] - r[0][1]) * f];
              const b = [r[3][0] + (r[2][0] - r[3][0]) * f, r[3][1] + (r[2][1] - r[3][1]) * f];
              const k = 0.04;
              return <line key={f} x1={a[0] + (b[0] - a[0]) * k} y1={a[1] + (b[1] - a[1]) * k} x2={b[0] + (a[0] - b[0]) * k} y2={b[1] + (a[1] - b[1]) * k} stroke="#145049" strokeWidth="1.4" strokeDasharray="1 2.5" strokeLinecap="round" />;
            })}
          </g>
        );
      })}
      {kind === "drip" && (() => {
        const [mx, top] = P([midX, Math.max(...ys)]); const [, bot] = P([midX, Math.min(...ys) - pad * 0.6]);
        return <>
          <line x1={mx} y1={top} x2={mx} y2={bot} stroke="#FF6F47" strokeWidth="3" />
          {beds.map((bd) => { const r = bd.ring.map(toFt).map(P); const cy = (r[0][1] + r[2][1]) / 2; const cx = (r[0][0] + r[2][0]) / 2; const near = cx + (Math.min(...r.map((q) => Math.abs(q[0] - cx)))) * (mx < cx ? -1 : 1); return <line key={bd.id} x1={mx} y1={cy} x2={near} y2={cy} stroke="#FF6F47" strokeWidth="1.6" />; })}
          <circle cx={mx} cy={bot} r="6" fill="#FF6F47" />
          <text x={mx + 10} y={bot + 4} className="sv-s">From spigot: backflow preventer, timer, 25 psi regulator, filter</text>
        </>;
      })()}
      {kind === "fence" && fl && ring.map((a, i) => {
        const b = ring[(i + 1) % ring.length], sd = fl.sides[i];
        const [ax, ay] = P(a), [bx, by] = P(b);
        const [gx, gy] = P([(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]);
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        let nx = -(by - ay), ny = bx - ax; const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
        if (nx * (mx - gx) + ny * (my - gy) < 0) { nx = -nx; ny = -ny; }
        const horiz = Math.abs(nx) > Math.abs(ny);
        const cx = mx + nx * (horiz ? 10 : 0), cy = my + ny * (horiz ? 0 : 16) + (horiz ? 3 : ny > 0 ? 6 : 0);
        return <text key={i} x={cx} y={cy} textAnchor={horiz ? (nx > 0 ? "start" : "end") : "middle"} className="sv-s">{sd.bays} @ {ftIn(sd.bayFt)} O.C.{sd.gate ? " + 4' gate" : ""}</text>;
      })}
      {(kind === "fence" || kind === "site") && posts.map((p, i) => { const [x, y] = P(p); return <rect key={i} x={x - 3} y={y - 3} width="6" height="6" fill="#10221F" />; })}
      <g transform={`translate(${W + 6}, 6)`}><path d="M0 18 L6 0 L12 18 L6 13 Z" fill="#10221F" /><text x="6" y="30" textAnchor="middle" className="sv-s">N</text></g>
      <g transform={`translate(0, ${H + 30})`}>
        <rect x="0" y="0" width={scaleFt * s} height="5" fill="#10221F" /><rect x={scaleFt * s} y="0" width={scaleFt * s} height="5" fill="none" stroke="#10221F" />
        <text x="0" y="18" className="sv-s">0</text><text x={scaleFt * s} y="18" className="sv-s" textAnchor="middle">10 ft</text><text x={2 * scaleFt * s} y="18" className="sv-s" textAnchor="middle">20 ft</text>
      </g>
    </svg>
  );
}

function BedDrawing({ tier }: { tier: BedTier }) {
  const t = BED_TIERS[tier];
  const h = t.courses * 9.25;
  const sc = 5; // px per inch
  const W = 96 * sc, H = h * sc;
  return (
    <svg viewBox={`-90 -40 ${W + 400} ${H + 120}`} className="sheet-svg" role="img" aria-label="Bed side elevation and end view">
      {Array.from({ length: t.courses }, (_, i) => <rect key={i} x="0" y={H - (i + 1) * 9.25 * sc} width={W} height={9.25 * sc} fill="#F4EFE6" stroke="#10221F" />)}
      {t.cap && <rect x="-10" y={-1.5 * sc} width={W + 20} height={1.5 * sc} fill="#E9DFCF" stroke="#10221F" />}
      {[0, W - 3.5 * sc].map((x) => <rect key={x} x={x} y={-0} width={3.5 * sc} height={H + 2 * sc} fill="none" stroke="#10221F" strokeDasharray="4 3" />)}
      <line x1="0" y1={H + 26} x2={W} y2={H + 26} stroke="#10221F" /><text x={W / 2} y={H + 42} textAnchor="middle" className="sv-s">{`8'-0" side`}</text>
      <line x1={-18} y1={0} x2={-18} y2={H} stroke="#10221F" /><text x={-24} y={H / 2} textAnchor="end" className="sv-s">{`${h.toFixed(1)}"`}</text>
      <g transform={`translate(${W + 60}, 0)`}>
        {Array.from({ length: t.courses }, (_, i) => <rect key={i} x="0" y={H - (i + 1) * 9.25 * sc} width={48 * sc * 0.9} height={9.25 * sc} fill="#F4EFE6" stroke="#10221F" />)}
        <line x1="0" y1={H + 26} x2={48 * sc * 0.9} y2={H + 26} stroke="#10221F" /><text x={24 * sc * 0.9} y={H + 42} textAnchor="middle" className="sv-s">{`4'-0" end (boards cut 45")`}</text>
      </g>
      <text x="0" y={-18} className="sv-s">Side elevation · dashed: 4×4 corner posts inside the corners{t.liner ? " · liner on soil side" : ""}</text>
    </svg>
  );
}

function TitleBlock({ no, title, name }: { no: string; title: string; name: string }) {
  return (
    <div className="titleblock">
      <span className="tb-brand">Light &amp; Loam</span>
      <span className="tb-proj">{name}</span>
      <span className="tb-title">{title}</span>
      <span className="tb-no">{no}</span>
      <span className="tb-note">{new Date().toLocaleDateString()} · Planning drawing, not a stamped or engineered plan</span>
    </div>
  );
}

export function BuildPlanSheets({ name, garden, beds, ends, plan, choices, onClose }: { name: string; garden: LngLat[]; beds: Bed[]; ends: [string, string]; plan: Plan; choices: BuildChoices; onClose: () => void }) {
  const cap = (w: string) => w[0].toUpperCase() + w.slice(1);
  const b = useBuild(garden, beds, choices)!;
  return (
    <div className="sheets" role="dialog" aria-label="Build plan">
      <div className="sheets-bar no-print">
        <strong>Build plan · {name}</strong>
        <span>
          <button className="btn pill" onClick={() => window.print()}>Print or save as PDF</button>
          <button className="btn" onClick={onClose}>Close</button>
        </span>
      </div>
      <section className="sheet">
        <h2>Site and planting plan</h2>
        <div className="sheet-split">
          <PlanSvg garden={garden} beds={beds} fl={b.fl} kind="site" />
          <table className="shop plant-table">
            <thead><tr><th>Bed</th><th>{cap(ends[0])} half</th><th>{cap(ends[1])} half</th></tr></thead>
            <tbody>
              {plan.beds.map((pb) => (
                <tr key={pb.n}><td>{pb.n}</td><td>{pb.north.crop ? `${pb.north.crop.name.replace(" (flower)", "")} ×${pb.north.plants}` : "open"}</td><td>{pb.south.crop ? `${pb.south.crop.name.replace(" (flower)", "")} ×${pb.south.plants}` : "open"}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="sheet-note">{beds.length} beds, 4 × 8 ft, long sides {ends[0] === "north" ? "roughly north to south" : "roughly east to west"}, kept 1½ ft in from the outline.{b.fl ? " Squares are fence posts." : ""}</p>
        <TitleBlock no="A-1" title="Site plan" name={name} />
      </section>
      <section className="sheet">
        <h2>Raised bed, {BED_TIERS[choices.bed].name.toLowerCase()}</h2>
        <BedDrawing tier={choices.bed} />
        <ol className="steps-list">
          <li>Cut one 8 ft 2×10 into two 45 in end boards per course.</li>
          <li>Cut 4×4 corner posts to the bed height plus 2 in; screw each board to the posts with three 3 in screws per end.</li>
          <li>Set the bed level on the ground where it will stay; the spare 2 in of post goes into the soil.</li>
          {BED_TIERS[choices.bed].liner && <li>Staple liner to the inside faces only, leaving the bottom open to drain.</li>}
          {choices.drip && <li>Set the drip tee and riser where the bed meets the mainline before filling with soil.</li>}
          <li>Fill with raised-bed soil mix and water it in to settle.</li>
        </ol>
        <TitleBlock no="B-1" title="Bed construction" name={name} />
      </section>
      {b.fl && choices.fence !== "none" && (
        <section className="sheet">
          <h2>Fence layout, {FENCE_TIERS[choices.fence].name.toLowerCase()}</h2>
          <PlanSvg garden={garden} beds={beds} fl={b.fl} kind="fence" />
          <p className="sheet-note">{b.fl.posts} posts. Each side is split into equal bays no wider than {FENCE_TIERS[choices.fence].maxBayFt} ft, measured center to center (O.C.). {FENCE_TIERS[choices.fence].summary} Source: <a href={SRC.ugaFence.href}>{SRC.ugaFence.label}</a>{FENCE_TIERS[choices.fence].src === "practical" ? " for heights; the cattle-panel build is a practical choice" : ""}.</p>
          <p className="sheet-note"><b>Call 811 before digging post holes.</b> Check fence height and permit rules with your town or HOA, and set concrete footings below your local frost line.</p>
          <TitleBlock no="B-2" title="Fence layout" name={name} />
        </section>
      )}
      {choices.drip && (
        <section className="sheet">
          <h2>Drip watering</h2>
          <PlanSvg garden={garden} beds={beds} fl={null} kind="drip" />
          <p className="sheet-note">A ½ in mainline (orange) runs down the middle path with a tee and riser to each bed and three lines of 12 in emitter tubing per bed (dotted). Assembly at the spigot, in order: backflow preventer, timer, 25 psi regulator, filter. Source: <a href={SRC.clemsonDrip.href}>{SRC.clemsonDrip.label}</a>. Start with about 30 minutes every other day and adjust to your soil and weather (practical starting point).</p>
          <TitleBlock no="B-3" title="Drip plan" name={name} />
        </section>
      )}
      <section className="sheet flow">
        <h2>Shopping list</h2>
        {b.groups.map((g) => (
          <table key={g.title} className="shop">
            <caption>{g.title}</caption>
            <thead><tr><th>Item</th><th>Qty</th><th>Each</th><th>Total</th></tr></thead>
            <tbody>
              {g.lines.map((l) => (
                <Fragment key={l.item}>
                  <tr><td>{l.item}{l.note && <small>{l.note}</small>}</td><td>{l.qty} {l.unit}</td><td>{usd(l.price)}</td><td>{usd(l.qty * l.price)}</td></tr>
                </Fragment>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={3}>Subtotal</td><td>{usd(total(g.lines))}</td></tr></tfoot>
          </table>
        ))}
        <p className="sheet-total">Rough materials total: <b>{usd(b.sum)}</b></p>
        <p className="sheet-note">Prices are rough national figures to help you budget, not quotes. Check your local store; lumber prices change often.</p>
        <TitleBlock no="C-1" title="Shopping list" name={name} />
      </section>
    </div>
  );
}
