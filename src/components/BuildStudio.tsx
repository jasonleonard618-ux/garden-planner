"use client";

import { Fragment, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Bed } from "@/lib/beds";
import type { LngLat } from "@/lib/types";
import {
  BED_TIERS, FENCE_TIERS, MATS, PATHS, WATERS, bedLinesFor, matOf, dripLines, fenceLines, pathLines, soakerLines, total,
  type BedMat, type Line, type PathKind, type Tier, type Water,
} from "@/lib/build";
import { SRC } from "@/data/sources";
import { PlanSvg, useBuild, type BuildChoices } from "./BuildPlan";

type BedTier = keyof typeof BED_TIERS;
type Tab = "options" | "beds" | "fence" | "water" | "cost";
type FenceView = "cutaway" | "layout" | "footing" | "gate";
const usd = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const ftIn = (ft: number) => { const f = Math.floor(ft + 1e-6); const i = Math.round((ft - f) * 12); return i === 12 ? `${f + 1}'-0"` : `${f}'-${i}"`; };
const TABS: [Tab, string][] = [["options", "Options"], ["beds", "Beds"], ["fence", "Fence"], ["water", "Water"], ["cost", "Cost"]];

// ---------- inline drawings (inlined so they use the page's fonts) ----------

const cache = new Map<string, Promise<string>>();
function Drawing({ src, className }: { src: string; className?: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let live = true;
    if (!cache.has(src)) cache.set(src, fetch(src).then((r) => r.text()));
    cache.get(src)!.then((t) => live && setSvg(t));
    return () => { live = false; };
  }, [src]);
  return <div className={`drawing${className ? ` ${className}` : ""}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}

// ---------- words for each level (from the construction sheet keynotes) ----------

const BED_INFO: Record<BedTier, { blurb: string; time: string; steps: string[] }> = {
  good: {
    blurb: "One 2×10 board high, screwed to 4×4 posts inside each corner. Quick to build and enough depth for most crops.",
    time: "1 hour per bed",
    steps: [
      "Strip the sod over a 4 × 8 ft area, loosen the soil 6 in deep and rake it level.",
      "Cut one 8 ft board into two 45 in ends, and cut four posts 11 in long.",
      "Screw the sides and ends to the posts inside each corner, three screws per board end.",
      "Set the box with the posts 2 in into the soil. Level it along its length, shimming with soil, not stones.",
      "Fill to 2 in below the top with raised-bed mix and water it in to settle.",
    ],
  },
  better: {
    blurb: "Two boards high, so it's easier on your back, with a 6 mil liner on the soil side so wet soil stays off the wood.",
    time: "2 hours per bed",
    steps: [
      "Strip the sod over a 4 × 8 ft area, loosen the soil 6 in deep and rake it level.",
      "Cut ends to 45 in for both courses, and cut four posts 20 in long.",
      "Screw both courses to the posts inside each corner, three screws per board end.",
      "Staple 6 mil plastic to the inside faces only. Leave the bottom open so the bed drains.",
      "Set and level the box with the posts 2 in into the soil, then fill to 2 in below the top and water in.",
    ],
  },
  best: {
    blurb: "Two boards high plus a 2×6 cap you can sit on. Liner on the soil side, semi-transparent stain on the outside only.",
    time: "4 hours per bed",
    steps: [
      "Strip the sod over a 4 × 8 ft area, loosen the soil 6 in deep and rake it level.",
      "Build the two-course box on 20 in posts, three screws per board end, and staple the liner to the inside faces.",
      "Miter the 2×6 cap at the corners and screw it down into the posts and boards.",
      "Stain the outside faces and top edge only. Keep stain off anything that touches soil.",
      "Set and level the bed, then fill to 2 in below the top and water in.",
    ],
  },
};

/** Stock tank planter, from sheet B-104 keynotes. */
const TANK_INFO = {
  blurb: "Two new 2 × 8 × 2 ft galvanized stock tanks fill each 4 × 8 ft bed space. No carpentry, 2 ft of root depth and a 28 in working height. They cost more than wood and take more soil, and a filled tank can't be moved.",
  time: "2 hours per pair, plus filling",
  steps: [
    "Strip the sod, level the spot and lay 2 in of stone dust where the blocks go.",
    "Set two rails of 4×8×16 solid blocks under each tank's long sides, leaving the middle strip open.",
    "Drill seven 1/2 in holes along the floor's centerline, 12 in apart. Remove the factory drain plug and leave it out.",
    "Deburr each hole and touch up the bare edges with cold-galvanizing spray. Wear gloves; drilled edges are sharp.",
    "Set the tank on its blocks before filling. Fill with one soil mix all the way down to 2 in below the rim. Don't add a gravel layer, it holds water up instead of draining it.",
    "Keep soil pH between 6 and 7, test it every few years, and skip blueberries. Zinc can leach more in acid soil.",
  ],
};

const FENCE_INFO: Record<Tier, { blurb: string; time: string; steps: string[] }> = {
  good: {
    blurb: "Chicken wire on steel T-posts, with the bottom bent outward so rabbits can't dig under.",
    time: "an afternoon",
    steps: [
      "Call 811 at least two working days before you drive posts.",
      "Drive the corner T-posts first, run a string line, then the line posts 18 in deep at the spacing on the post layout.",
      "Unroll 36 in hex mesh: 24 in up the posts and 12 in bent out flat on the outside.",
      "Clip the mesh to every post, three clips each, and pin the apron with staples every 12 in.",
      "Hang the gate on the south side.",
    ],
  },
  better: {
    blurb: "48 in welded wire on T-posts. The top 18 in is left loose so climbers flop back, and a 24 in apron stops diggers.",
    time: "a weekend",
    steps: [
      "Call 811 at least two working days before you drive posts.",
      "Set the corners first, then drive the line posts 24 in deep at the spacing on the post layout.",
      "Clip 48 in welded wire to the posts.",
      "Join an 18 in strip of hex mesh along the top with hog rings and leave it unsupported, leaning out.",
      "Lay a 24 in apron flat on the outside and pin it. Set 4×4 gate posts 30 in deep in gravel and hang the gate.",
    ],
  },
  best: {
    blurb: "An 8 ft deer fence on treated 4×4 posts, with 1 in mesh along the bottom 2 ft and an apron.",
    time: "two weekends",
    steps: [
      "Call 811 at least two working days before you dig.",
      "Set the 10 ft posts 24 in deep, and brace the corners and gate posts with an H-brace.",
      "Run a top tension wire, then hang the 8 ft deer mesh. Don't drive staples tight on poly mesh.",
      "Add 24 in hex mesh along the bottom, overlapping a 12 in apron on the outside.",
      "Set the gate posts 36 in in concrete and hang the framed gate on three hinges.",
    ],
  },
  excellent: {
    blurb: "Cedar-framed cattle-panel bays on a 2×8 kickboard, with deer wires to 8 ft, a pergola beam along the top and a cedar gate that won't sag.",
    time: "four to five weekends, or a pro crew",
    steps: [
      "Call 811 at least two working days before you dig.",
      "Set the 12 ft cedar posts in concrete (14 ft if your frost line is deeper than 36 in), bottoms at your frost depth or 36 in, whichever is deeper, on 6 in of gravel.",
      "Fit the 2×8 kickboard, 1 in below grade, between posts.",
      "Build each bay's 2×4 frame, staple in the cattle panel, and cap it with the top rail.",
      "String deer wires at 66, 80 and 94 in.",
      "Bolt a 2×8 beam to each face of the posts at the top (9 ft), then screw 2×4 rafter tails across it every 16 in.",
      "Build and hang the gate from sheet F-501.",
    ],
  },
};

const FINISH: { tier: BedTier; name: string; title: string; price: string; body: string; src: keyof typeof SRC }[] = [
  { tier: "good", name: "Good", title: "Leave it bare", price: "$0", body: "Cedar heartwood resists rot on its own and weathers to silver gray. With nothing on the wood, there is nothing to leach.", src: "umdBeds" },
  { tier: "better", name: "Better", title: "Line the soil side", price: "≈ $15 / bed", body: "6 mil plastic on the inside faces, stopping about 2 in above the bottom so water still drains. Wet soil against the wood is what rots it.", src: "askBeds" },
  { tier: "best", name: "Best", title: "Line it, stain the outside", price: "≈ $35 / bed", body: "Liner as in Better, plus semi-transparent oil-based stain on the outside faces and top edge only. Recoat every few years.", src: "umdBeds" },
];

// ---------- the studio ----------

export function BuildStudio({ garden, beds, trimmed, choices, setChoices, onOpen }: {
  garden: LngLat[]; beds: Bed[]; trimmed?: boolean; choices: BuildChoices; setChoices: (c: BuildChoices) => void; onOpen: () => void;
}) {
  const [tab, setTab] = useState<Tab>("options");
  const [fv, setFv] = useState<FenceView>("cutaway");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const b = useBuild(garden, beds, choices);
  if (!b) return null;
  const set = (c: Partial<BuildChoices>) => setChoices({ ...choices, ...c });
  const water: Water = choices.drip ? "drip" : choices.water === "soaker" ? "soaker" : "hand";
  const fenceOn = choices.fence !== "none";
  const ft = fenceOn ? (choices.fence as Tier) : null;
  const mat = matOf(choices.mat);
  const view: FenceView = ft !== "excellent" && (fv === "footing" || fv === "gate") ? "cutaway" : fv;

  const stage = <Stage tab={tab} setTab={setTab} b={b} beds={beds} garden={garden} choices={choices} set={set} water={water} fenceView={view} setFenceView={setFv} />;

  return (
    <>
      <h1 className="title">How do you want to build it?</h1>
      <p className="lede">Pick materials, then a level for the beds and the fence. Every drawing matches the printed construction sheets, and quantities come from your layout.</p>
      {trimmed && <p className="muted small">The fence and drip wrap just your {beds.length} beds, 1½ ft out from their edges, not the whole outline you drew.</p>}
      <div className="tabs build-tabs" role="tablist" aria-label="Build">
        {TABS.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "tab on" : "tab"} onClick={() => setTab(k)}>{label}</button>)}
      </div>

      {tab === "options" && (
        <>
          <p className="small">Choose a bed material, a path surface and how you&apos;ll water. Prices update for your {beds.length} beds.</p>
          <dl className="build-sum">
            <div><dt>Beds</dt><dd>{MATS[mat].name}{MATS[mat].own ? `, ${beds.length * 2} tanks` : `, ${BED_TIERS[choices.bed].name.toLowerCase()}`}</dd></div>
            <div><dt>Paths</dt><dd>{PATHS[choices.path ?? "chips"].name}</dd></div>
            <div><dt>Water</dt><dd>{WATERS[water].name}</dd></div>
            <div><dt>Fence</dt><dd>{ft ? FENCE_TIERS[ft].name : "None"}</dd></div>
          </dl>
          <button className="btn" onClick={() => setTab("beds")}>See the bed plans →</button>
        </>
      )}

      {tab === "beds" && (
        <>
          {MATS[mat].own ? (
            <>
              <p className="small">{TANK_INFO.blurb} About {TANK_INFO.time}.</p>
              <h3>Steps</h3>
              <ol className="build-steps">{TANK_INFO.steps.map((t) => <li key={t}>{t}</li>)}</ol>
              <p className="muted small">Galvanized beds are generally safe for food crops. How hot a tank gets and how many years it lasts aren&apos;t settled by any source. <a className="why" href={SRC.hgicGalv.href} target="_blank" rel="noreferrer">Why?</a> · <a className="why" href={SRC.tankDrain.href} target="_blank" rel="noreferrer">Drain holes</a> · <a className="why" href={SRC.uwContainers.href} target="_blank" rel="noreferrer">No gravel layer</a></p>
            </>
          ) : (
          <>
          <div className="tiers" role="radiogroup" aria-label="Bed level">
            {(Object.keys(BED_TIERS) as BedTier[]).map((k) => (
              <button key={k} role="radio" aria-checked={choices.bed === k} className={choices.bed === k ? "tier on" : "tier"} onClick={() => set({ bed: k })}>
                <b>{BED_TIERS[k].name}</b>
                <small>{usd(total(bedLinesFor(1, k, mat)))} / bed</small>
              </button>
            ))}
          </div>
          <p className="small">{BED_INFO[choices.bed].blurb} About {BED_INFO[choices.bed].time}.</p>
          {!MATS[mat].drawn && <p className="warn small">{MATS[mat].name} beds aren&apos;t drawn; the drawing shows the cedar build. Follow the kit or mound the soil.</p>}
          {MATS[mat].drawn && (
            <>
              <h3>Steps</h3>
              <ol className="build-steps">{BED_INFO[choices.bed].steps.map((s) => <li key={s}>{s}</li>)}</ol>
            </>
          )}
          <h3>Finishing the wood</h3>
          <div className="finish-grid">
            {FINISH.map((f) => (
              <button key={f.tier} className={choices.bed === f.tier ? "finish on" : "finish"} onClick={() => set({ bed: f.tier })} aria-pressed={choices.bed === f.tier}>
                <span className="finish-h"><span className="eyebrow">{f.name}</span><span className="mono small">{f.price}</span></span>
                <Drawing src={`/drawings/finish-${f.tier}.svg`} />
                <b>{f.title}</b>
              </button>
            ))}
          </div>
          <p className="small">{FINISH.find((f) => f.tier === choices.bed)!.body} <a className="why" href={SRC[FINISH.find((f) => f.tier === choices.bed)!.src].href} target="_blank" rel="noreferrer">Why?</a></p>
          <details className="sub">
            <summary>Charred wood, treated lumber and what to avoid</summary>
            <div className="finish-char">
              <Drawing src="/drawings/finish-char.svg" />
              <p className="small"><b>Shou sugi ban is for the look, not longer life.</b> A 2021 USDA Forest Products Lab study found charring didn&apos;t reliably improve rot resistance. If you love the look, char the outside and still line the inside. <a className="why" href={SRC.fplChar.href} target="_blank" rel="noreferrer">Why?</a></p>
            </div>
            <ul className="avoid small">
              <li>Old lumber treated with CCA, creosote or penta, such as railroad ties.</li>
              <li>Paint, stain or sealer on the soil side of the boards.</li>
            </ul>
            <p className="muted small">Sources: <a href={SRC.umdBeds.href} target="_blank" rel="noreferrer">{SRC.umdBeds.label}</a>; <a href={SRC.askBeds.href} target="_blank" rel="noreferrer">{SRC.askBeds.label}</a>.</p>
          </details>
          </>
          )}
        </>
      )}

      {tab === "fence" && (
        <>
          <div className="tiers four" role="radiogroup" aria-label="Fence level">
            {(["good", "better", "best", "excellent"] as Tier[]).map((k) => (
              <button key={k} role="radio" aria-checked={choices.fence === k} className={choices.fence === k ? "tier on" : "tier"} onClick={() => set({ fence: k })}>
                <b>{FENCE_TIERS[k].name}</b>
                <small>{FENCE_TIERS[k].keeps.split(",")[0].replace(" plus the above", "")}</small>
              </button>
            ))}
          </div>
          <label className="check small"><input type="checkbox" checked={!fenceOn} onChange={(e) => set({ fence: e.target.checked ? "none" : "better" })} /> No fence</label>
          {ft && b.fl && (
            <>
              <p className="small"><b>Keeps out: {FENCE_TIERS[ft].keeps}.</b> {FENCE_INFO[ft].blurb} About {FENCE_INFO[ft].time}. <a className="why" href={SRC.ugaFence.href} target="_blank" rel="noreferrer">Why?</a></p>
              <div className="stats">
                <div className="stat"><span className="stat-v">{b.fl.posts}</span><span className="stat-l">Posts</span></div>
                <div className="stat"><span className="stat-v">{Math.round(b.fl.perimeterFt)} ft</span><span className="stat-l">Fence</span></div>
                <div className="stat"><span className="stat-v">{usd(total(fenceLines(b.fl, ft)))}</span><span className="stat-l">Materials</span></div>
              </div>
              <h3>Steps</h3>
              <ol className="build-steps">{FENCE_INFO[ft].steps.map((s) => <li key={s}>{s}</li>)}</ol>
              <div className="notes-811">
                <p><b>Check local rules:</b> many towns and HOAs limit fence height or need a permit over 6 ft, and concrete footings go below your local frost line. Your building department can tell you both.</p>
              </div>
            </>
          )}
        </>
      )}

      {tab === "water" && (
        <>
          <div className="tiers" role="radiogroup" aria-label="Watering">
            {(Object.keys(WATERS) as Water[]).map((k) => (
              <button key={k} role="radio" aria-checked={water === k} className={water === k ? "tier on" : "tier"} onClick={() => set({ drip: k === "drip", water: k })}>
                <b>{WATERS[k].name}</b><small>{WATERS[k].tag}</small>
              </button>
            ))}
          </div>
          {water === "drip" && (
            <>
              <p className="small">Plan it with the beds: the risers go in before the soil, and the mainline goes in before the path mulch.</p>
              <h3>Steps</h3>
              <ol className="build-steps">
                <li>Before the path mulch goes down, lay the ½ in mainline from the spigot down the middle path.</li>
                <li>{MATS[mat].own ? "At each stock tank, add a tee and bring a riser up and over the rim at the path end." : "At each bed, add a tee and bring a riser up at the path end, before you fill the soil."}</li>
                <li>{MATS[mat].own ? "Run two lines of 12 in emitter tubing the length of each tank, pin them down and cap the ends." : "Run three lines of 12 in emitter tubing the length of each bed, pin them down and cap the ends."}</li>
                <li>At the spigot, connect in order: backflow preventer, timer, 25 psi regulator, filter. Flush once, then cap.</li>
                <li>Mulch over the lines. Start with about 30 minutes every other day and adjust to your soil and weather (practical starting point).</li>
              </ol>
              <p className="muted small">Order, pressure and emitter spacing: <a href={SRC.clemsonDrip.href} target="_blank" rel="noreferrer">{SRC.clemsonDrip.label}</a>. Before winter, drain the lines and bring the timer, regulator and filter inside.</p>
            </>
          )}
          {water === "soaker" && <p className="small">Snake one 25 ft soaker hose through each bed and run them from a splitter. You turn them on; a hose timer can do it for you later.</p>}
          {water === "hand" && <p className="small">No parts to buy. Plan on a slow soak at the base of the plants, most mornings in July.</p>}
        </>
      )}

      {tab === "cost" && (
        <>
          <div className="stats"><div className="stat"><span className="stat-v">{usd(b.sum)}</span><span className="stat-l">To build this spring, materials</span></div></div>
          <p className="muted small">Rough national prices to help you budget, not quotes. Check your local store; lumber prices change often.</p>
          <h3>Save money</h3>
          <ul className="small build-tips">
            <li>Tree services often drop off wood chips for free.</li>
            <li>Many towns give away compost in spring.</li>
            <li>Build half the beds this year and the rest next spring.</li>
          </ul>
        </>
      )}

      <div className="build-inline">{stage}</div>
      <div className="notes-811">
        <p><b>Before you dig:</b> call 811 a few days ahead so buried lines get marked. It&apos;s free. <a className="why" href={SRC.call811.href} target="_blank" rel="noreferrer">Why?</a></p>
      </div>
      <div className="build-open">
        <span><b>{usd(b.sum)}</b> <small>rough materials total</small></span>
        <button className="btn primary" onClick={onOpen}>Open the build plan</button>
      </div>
      <p className="muted small">Every construction sheet, the cut lists and the shopping list, ready to print or save as a PDF. Free during the pilot.</p>

      {mounted && createPortal(<div className="build-stage">{stage}</div>, document.body)}
    </>
  );
}

function Stage({ tab, setTab, b, beds, garden, choices, set, water, fenceView, setFenceView }: {
  tab: Tab; setTab: (t: Tab) => void; b: NonNullable<ReturnType<typeof useBuild>>; beds: Bed[]; garden: LngLat[]; choices: BuildChoices;
  set: (c: Partial<BuildChoices>) => void; water: Water; fenceView: FenceView; setFenceView: (v: FenceView) => void;
}) {
  const n = beds.length;
  const mat = matOf(choices.mat);
  const ft = choices.fence !== "none" ? (choices.fence as Tier) : null;
  if (tab === "options") {
    return (
      <div className="paper options-paper">
        <p className="eyebrow">Build · options</p>
        <h2 className="paper-h">Materials for your {n} beds</h2>
        <h3>Bed material <small>{MATS[mat].own ? "stock tanks, 2 per bed" : `${BED_TIERS[choices.bed].name.toLowerCase()} build`}</small></h3>
        <div className="opt-grid">
          {(Object.keys(MATS) as BedMat[]).map((k) => (
            <OptCard key={k} kind={`mat-${k}`} on={mat === k} title={MATS[k].name} price={usd(total(bedLinesFor(n, choices.bed, k)))} sub={MATS[k].sub} tag={MATS[k].life} onClick={() => set({ mat: k })} />
          ))}
        </div>
        <h3>Paths <small>{Math.max(0, Math.round(b.pathSq))} sq ft between and around the beds</small></h3>
        <div className="opt-grid">
          {(Object.keys(PATHS) as PathKind[]).map((k) => {
            const lines = pathLines(k, b.pathSq);
            return <OptCard key={k} kind={`path-${k}`} on={(choices.path ?? "chips") === k} title={PATHS[k].name} price={usd(total(lines))} sub={PATHS[k].sub} tag={PATHS[k].tag} onClick={() => set({ path: k })} />;
          })}
        </div>
        <h3>Water and critters</h3>
        <div className="opt-grid">
          {(Object.keys(WATERS) as Water[]).map((k) => {
            const price = k === "drip" ? total(dripLines(n, 60, !!MATS[mat].own)) : k === "soaker" ? total(soakerLines(n)) : 0;
            return <OptCard key={k} kind={`water-${k}`} on={water === k} title={WATERS[k].name} price={k === "drip" ? `≈ ${usd(price)}` : usd(price)} sub={WATERS[k].sub} tag={WATERS[k].tag} onClick={() => set({ drip: k === "drip", water: k })} />;
          })}
          <OptCard kind="fence" on={false} title="Critter fence" price={ft && b.fl ? usd(total(fenceLines(b.fl, ft))) : "None"} sub="Good to excellent: rabbits to deer." tag="See fence plans" onClick={() => setTab("fence")} />
        </div>
        <p className="muted small">Prices are rough national figures for budgeting (practical choice), not quotes.</p>
      </div>
    );
  }
  if (tab === "beds") {
    const lines = bedLinesFor(1, choices.bed, mat);
    return (
      <div className="paper split">
        <Drawing src={MATS[mat].own ? "/drawings/bed-tank.svg" : `/drawings/bed-${choices.bed}.svg`} />
        <CutList title={MATS[mat].own ? "Per bed · 2 stock tanks" : `Per bed · ${MATS[mat].name.toLowerCase()} · ${BED_TIERS[choices.bed].name.toLowerCase()}`} lines={lines} foot={MATS[mat].own ? "Full sheet: B-104 in your build plan." : MATS[mat].drawn ? `Full sheet: B-10${{ good: 1, better: 2, best: 3 }[choices.bed]} in your build plan.${mat === "pine" ? " Pine uses the same sizes as the cedar drawn here." : ""}` : "Drawing shows the cedar build for reference."} />
      </div>
    );
  }
  if (tab === "fence") {
    if (!ft || !b.fl) return <div className="paper empty-paper"><p className="lede">No fence. Pick a level on the left to see its drawings.</p></div>;
    const views: [FenceView, string][] = [["cutaway", "Cut-away"], ["layout", "Post layout"], ...(ft === "excellent" ? ([["footing", "Footing"], ["gate", "Gate"]] as [FenceView, string][]) : [])];
    return (
      <div className="paper split">
        <div>
          <div className="tabs paper-tabs" role="tablist" aria-label="Fence drawings">
            {views.map(([k, l]) => <button key={k} role="tab" aria-selected={fenceView === k} className={fenceView === k ? "tab on" : "tab"} onClick={() => setFenceView(k)}>{l}</button>)}
          </div>
          {fenceView === "cutaway" && <Drawing src={`/drawings/fence-${ft}.svg`} />}
          {fenceView === "footing" && <Drawing src="/drawings/footing-excellent.svg" />}
          {fenceView === "gate" && <Drawing src="/drawings/gate-excellent.svg" />}
          {fenceView === "layout" && (
            <div className="layout-draw">
              <p className="eyebrow">Fence layout · post spacing</p>
              <h2 className="paper-h">Post spacing, worked out</h2>
              <p className="small">Each side is split into equal bays no wider than {FENCE_TIERS[ft].maxBayFt} ft{ft === "excellent" ? ", so each cedar frame comes from one 8 ft board" : ""}, with a 4 ft gate on the south-most side.</p>
              <PlanSvg garden={garden} beds={beds} fl={b.fl} kind="fence" tanks={!!MATS[mat].own} />
            </div>
          )}
        </div>
        {fenceView === "layout" ? (
          <div className="cutlist">
            <p className="eyebrow">Post schedule</p>
            <table className="shop">
              <thead><tr><th>Side</th><th>Length</th><th>Bays</th><th>O.C.</th></tr></thead>
              <tbody>{b.fl.sides.map((s, i) => <tr key={i}><td>{i + 1}</td><td>{ftIn(s.ft)}</td><td>{s.bays}{s.gate ? " + gate" : ""}</td><td>{ftIn(s.bayFt)}</td></tr>)}</tbody>
            </table>
            <p className="muted small">{b.fl.posts} posts. Measure post center to post center. Set the corners first, run a string line between them, then mark the line posts along it.</p>
          </div>
        ) : (
          <CutList title={`Materials · ${Math.round(b.fl.perimeterFt)} ft around ${n} beds`} lines={fenceLines(b.fl, ft)} foot={`Full sheet: F-10${{ good: 1, better: 2, best: 3, excellent: 4 }[ft]}${ft === "excellent" ? " and gate sheet F-501" : ""} in your build plan.`} />
        )}
      </div>
    );
  }
  if (tab === "water") {
    if (water !== "drip") return (
      <div className="paper split">
        <div className="layout-draw"><p className="eyebrow">Watering · {WATERS[water].name.toLowerCase()}</p><h2 className="paper-h">{water === "soaker" ? "A soaker hose in every bed" : "Watering by hand"}</h2>
          <p className="small">Aim for about 1 in of water a week, rain included, and keep the soil moist, not soggy. Water at the base of the plants in the morning so leaves dry by night.</p></div>
        {water === "soaker" ? <CutList title={`Parts · ${n} beds`} lines={soakerLines(n)} foot="" /> : <div />}
      </div>
    );
    return (
      <div className="paper split">
        <div className="layout-draw">
          <p className="eyebrow">Drip layout · plan view, north up</p>
          <h2 className="paper-h">Where the water lines go</h2>
          <PlanSvg garden={garden} beds={beds} fl={null} kind="drip" tanks={!!MATS[mat].own} />
          <p className="eyebrow chain-h">At the spigot, in this order</p>
          <ol className="chain">{["Spigot", "Backflow preventer", "Timer", "Regulator, 25 psi", "Filter", "½ in mainline"].map((s) => <li key={s}>{s}</li>)}</ol>
        </div>
        <CutList title={`Parts · ${n} beds`} lines={b.groups.find((g) => g.title === "Drip watering")?.lines ?? []} foot="Full sheet: D-101 in your build plan." />
      </div>
    );
  }
  // cost
  const max = Math.max(...b.groups.map((g) => total(g.lines)), 1);
  return (
    <div className="paper split">
      <div className="layout-draw">
        <p className="eyebrow">Cost · typical US prices</p>
        <h2 className="paper-h">What it will cost</h2>
        <p className="cost-big">{usd(b.sum)} <small>to build this spring</small></p>
        <div className="cost-bars">
          {b.groups.map((g) => (
            <div key={g.title} className="cost-row"><span>{g.title}</span><i style={{ width: `${Math.max(2, (total(g.lines) / max) * 100)}%` }} /><b>{usd(total(g.lines))}</b></div>
          ))}
        </div>
      </div>
      <div className="cutlist">
        <p className="eyebrow">Each year after, roughly</p>
        <table className="shop"><tbody>
          <tr><td>Compost top-up, 1 in a year</td><td>{usd(Math.round((n * 32) / 12 / 27 * 45 + 10))}</td></tr>
          <tr><td>Seeds and starter plants</td><td>{usd(30 + n * 6)}</td></tr>
          {(choices.path ?? "chips") !== "grass" && (choices.path ?? "chips") !== "gravel" && <tr><td>Path mulch top-up</td><td>$0–{usd(Math.round(Math.max(0, b.pathSq) / 12 / 27 * 35))}</td></tr>}
          <tr><td>Repairs and screws</td><td>$25</td></tr>
        </tbody></table>
        <p className="muted small">Yearly figures are rough practical estimates, not sourced prices.</p>
      </div>
    </div>
  );
}

function OptCard({ kind, on, title, price, sub, tag, onClick }: { kind: string; on: boolean; title: string; price: string; sub: string; tag: string; onClick: () => void }) {
  return (
    <button className={on ? "opt on" : "opt"} aria-pressed={on} onClick={onClick}>
      <span className={`opt-sw sw-${kind}`} aria-hidden />
      <span className="opt-b"><span className="opt-t"><b>{title}</b><span className="mono">{price}</span></span><small>{sub}</small><em>{tag}</em></span>
    </button>
  );
}

function CutList({ title, lines, foot }: { title: string; lines: Line[]; foot: string }) {
  return (
    <div className="cutlist">
      <p className="eyebrow">Cut list · {title}</p>
      <ol>
        {lines.map((l, i) => (
          <Fragment key={l.item}>
            <li><span className="cl-n">{i + 1}</span><span className="cl-t"><b>{l.item}</b>{l.note && <small>{l.note}</small>}</span><span className="cl-q">{l.qty} {l.unit.replace(/^boards$|^posts$/, (u) => u)}</span></li>
          </Fragment>
        ))}
      </ol>
      {foot && <p className="muted small">{foot}</p>}
    </div>
  );
}
