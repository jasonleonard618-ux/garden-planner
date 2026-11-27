"use client";

import { useState } from "react";
import { fmt, measure } from "@/lib/geo";
import type { BedKind, LngLat, MyBed } from "@/lib/types";
import { CROPS } from "@/data/crops";
import { familyOf, FAMILY_COLOR, FAMILY_LABEL, ROTATION_YEARS } from "@/data/families";
import { SOURCES } from "@/data/crops";

export const KIND_NAME: Record<BedKind, string> = { raised: "Raised bed", metal: "Metal or stock tank", inground: "In-ground", perennial: "Perennial patch", pots: "Pots" };
const KIND_HELP: Record<BedKind, string> = {
  raised: "A framed bed of wood or other boards.",
  metal: "A steel bed, or a livestock stock tank used as a planter.",
  inground: "Planted straight in the ground, no frame.",
  perennial: "Strawberries, asparagus, rhubarb and the like. Kept out of rotation.",
  pots: "Containers or grow bags.",
};

/** Side lengths of a 4-corner bed, short side first, in feet. */
export function bedSize(ring: LngLat[]) {
  const m = measure(ring);
  if (ring.length !== 4) return { label: `${fmt(m.areaSqFt)} sq ft`, areaSqFt: m.areaSqFt };
  const a = (m.sides[0].ft + m.sides[2].ft) / 2, b = (m.sides[1].ft + m.sides[3].ft) / 2;
  const [w, l] = [Math.min(a, b), Math.max(a, b)];
  return { label: `${fmt(w, w < 10 ? 1 : 0).replace(/\.0$/, "")} × ${fmt(l, l < 10 ? 1 : 0).replace(/\.0$/, "")} ft`, areaSqFt: m.areaSqFt };
}

/** A widthFt × lengthFt rectangle centred on a point, long side running north–south. */
export function rectAt(c: LngLat, widthFt: number, lengthFt: number): LngLat[] {
  const dx = (widthFt * 0.3048) / 2 / (111320 * Math.cos((c[1] * Math.PI) / 180));
  const dy = (lengthFt * 0.3048) / 2 / 110574;
  return [[c[0] - dx, c[1] - dy], [c[0] + dx, c[1] - dy], [c[0] + dx, c[1] + dy], [c[0] - dx, c[1] + dy]];
}

/** Turn a bed about its centre by deg (counter-clockwise), measured in local metres so it keeps its shape. */
export function rotateRing(ring: LngLat[], deg: number): LngLat[] {
  const c: LngLat = [ring.reduce((a, p) => a + p[0], 0) / ring.length, ring.reduce((a, p) => a + p[1], 0) / ring.length];
  const kx = Math.cos((c[1] * Math.PI) / 180), t = (deg * Math.PI) / 180, cs = Math.cos(t), sn = Math.sin(t);
  return ring.map(([x, y]) => { const lx = (x - c[0]) * kx, ly = y - c[1]; return [c[0] + (lx * cs - ly * sn) / kx, c[1] + lx * sn + ly * cs] as LngLat; });
}

export function RoadQuestion({ onPick }: { onPick: (r: "new" | "have") => void }) {
  return (
    <section className="road" aria-labelledby="road-q">
      <h2 id="road-q">One question before we start: do you already grow here?</h2>
      <div className="road-options">
        <button className="road-card" onClick={() => onPick("new")}>
          <b>Starting fresh</b>
          <span>Find the sunniest spot, size new beds, and get build drawings.</span>
        </button>
        <button className="road-card" onClick={() => onPick("have")}>
          <b>I already have beds</b>
          <span>Trace the beds you have and plan what goes where this year. Skips sizing and building.</span>
        </button>
      </div>
      <p className="muted small">Not sure? Pick either. You can switch later.</p>
    </section>
  );
}

export function YourBedsStep({ beds, setBeds, suns, sunBusy, season, kind, setKind, size, setSize, drawing, onDraw, onPlace, onCancel, onSwitch, gridMissing, editing, setEditing }: {
  editing: string | null; setEditing: (id: string | null) => void;
  beds: MyBed[]; setBeds: (b: MyBed[]) => void; suns: (number | null)[] | null; sunBusy: boolean; season: string;
  kind: BedKind; setKind: (k: BedKind) => void; size: { w: number; l: number }; setSize: (s: { w: number; l: number }) => void;
  drawing: "bed" | "bedpoint" | null; onDraw: () => void; onPlace: () => void; onCancel: () => void; onSwitch: () => void; gridMissing: boolean;
}) {
  const total = beds.reduce((a, b) => a + bedSize(b.ring).areaSqFt, 0);
  const renumber = (list: MyBed[]) => list.map((b, i) => ({ ...b, n: i + 1 }));
  const turn = (id: string, deg: number) => setBeds(beds.map((x) => (x.id === id ? { ...x, ring: rotateRing(x.ring, deg) } : x)));
  const editBed = beds.find((b) => b.id === editing);
  return (
    <>
      <h1 className="title">Trace the beds you have</h1>
      <p className="lede">Draw each bed over the photo, or type its size and tap where it sits. Every bed gets its own sun hours.</p>
      <h3>What kind of bed?</h3>
      <div className="chips" role="radiogroup" aria-label="Bed type">
        {(Object.keys(KIND_NAME) as BedKind[]).map((k) => (
          <button key={k} role="radio" aria-checked={kind === k} className={kind === k ? "chip on" : "chip"} onClick={() => setKind(k)}>{KIND_NAME[k]}</button>
        ))}
      </div>
      <p className="muted small">{KIND_HELP[kind]}</p>
      {editBed ? (
        <div className="draw-help">
          <p><b>Bed {editBed.n}:</b> drag ✥ on the map to move it, or drag a corner to turn it.</p>
          <div className="row">
            <button className="btn" onClick={() => turn(editBed.id, 15)}>↺ 15°</button>
            <button className="btn" onClick={() => turn(editBed.id, -15)}>↻ 15°</button>
            <button className="btn" onClick={() => turn(editBed.id, 90)}>Turn 90°</button>
            <button className="btn primary" onClick={() => setEditing(null)}>Done</button>
          </div>
        </div>
      ) : drawing ? (
        <div className="draw-help">
          <p>{drawing === "bed" ? "Tap two corners along one side of the bed, then tap the opposite side." : `Tap the middle of the bed on the map. It goes in as ${size.w} × ${size.l} ft, long side north–south.`}</p>
          <button className="btn ghost" onClick={onCancel}>Cancel</button>
        </div>
      ) : (
        <div className="have-tools">
          <button className="btn primary" onClick={onDraw}>Draw a bed</button>
          <span className="muted small">or</span>
          <label className="mini">W <input type="number" min={1} max={40} value={size.w} onChange={(e) => setSize({ ...size, w: Math.max(1, +e.target.value) })} /> ft</label>
          <label className="mini">L <input type="number" min={1} max={60} value={size.l} onChange={(e) => setSize({ ...size, l: Math.max(1, +e.target.value) })} /> ft</label>
          <button className="btn" onClick={onPlace}>Place it</button>
        </div>
      )}
      <p className="muted small">Trees hiding a bed, or an old photo? Type the size, then tap its spot. A tape measure from a house corner helps.</p>
      {gridMissing && <p className="warn small">No height survey covers this spot, so sun hours leave out trees and buildings. Add them in the Sun step under &ldquo;Fix what the data missed&rdquo;.</p>}
      {beds.length > 0 && (
        <>
          <h3>{beds.length} bed{beds.length > 1 ? "s" : ""} · {fmt(total)} sq ft · sun in {season.toLowerCase()}</h3>
          {sunBusy && <p className="busy"><span className="spinner" aria-hidden /> Measuring sun on each bed…</p>}
          <ul className="mybeds">
            {beds.map((b, i) => {
              const h = suns?.[i];
              return (
                <li key={b.id}>
                  <span className="bed-n">{b.n}</span>
                  <select aria-label={`Bed ${b.n} type`} value={b.kind} onChange={(e) => setBeds(beds.map((x) => (x.id === b.id ? { ...x, kind: e.target.value as BedKind } : x)))}>
                    {(Object.keys(KIND_NAME) as BedKind[]).map((k) => <option key={k} value={k}>{KIND_NAME[k]}</option>)}
                  </select>
                  <span className="small">{bedSize(b.ring).label}</span>
                  <span className="bed-h">{h == null ? "–" : `${fmt(h, 1)} hrs`}</span>
                  <span className="bed-acts">
                    <button className="link" aria-label={`Move or turn bed ${b.n}`} onClick={() => setEditing(editing === b.id ? null : b.id)}>{editing === b.id ? "Done" : "Move"}</button>
                    <button className="link" aria-label={`Remove bed ${b.n}`} onClick={() => { if (editing === b.id) setEditing(null); setBeds(renumber(beds.filter((x) => x.id !== b.id))); }}>Remove</button>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="small muted">Fruiting crops need 6+ hours of direct sun; leafy greens manage with 3 to 4. <a className="why" href={SOURCES.isu.href} target="_blank" rel="noreferrer">Why?</a></p>
        </>
      )}
      <p className="muted small">Starting a new garden instead? <button className="link" onClick={onSwitch}>Switch to starting fresh</button></p>
    </>
  );
}

const SORTED = [...CROPS].sort((a, b) => a.name.localeCompare(b.name));

export function LastYearStep({ beds, setBeds, year }: { beds: MyBed[]; setBeds: (b: MyBed[]) => void; year: number }) {
  const [y, setY] = useState(year - 1);
  const key = String(y);
  const set = (id: string, crops: string[]) => setBeds(beds.map((b) => (b.id === id ? { ...b, history: { ...b.history, [key]: crops } } : b)));
  return (
    <>
      <h1 className="title">What grew where?</h1>
      <p className="lede">Add what each bed grew. Rough is fine: we only need the plant family, so &ldquo;some kind of squash&rdquo; works.</p>
      <div className="tabs" role="tablist" aria-label="Year">
        {[year - 1, year - 2].map((yy) => (
          <button key={yy} role="tab" aria-selected={y === yy} className={y === yy ? "tab on" : "tab"} onClick={() => setY(yy)}>{yy}{yy === year - 2 ? ", if you know" : ""}</button>
        ))}
      </div>
      <div className="notice">
        <p>Crops in the same family share pests and diseases that wait in the soil. Iowa State Extension advises keeping a family out of the same spot for 3 to 4 years; we plan for {ROTATION_YEARS}. <a className="why" href={SOURCES.isuRotation.href} target="_blank" rel="noreferrer">Why?</a></p>
      </div>
      <ul className="lastyear">
        {beds.map((b) => {
          const grown = b.history[key] ?? [];
          return (
            <li key={b.id}>
              <div className="ly-head"><b>Bed {b.n}</b><span className="muted small">{KIND_NAME[b.kind]} · {bedSize(b.ring).label}</span></div>
              {b.kind === "perennial" ? (
                <p className="muted small">Perennial patch: stays as it is and isn&apos;t rotated (practical choice).</p>
              ) : (
                <div className="chips">
                  {grown.map((id) => {
                    const c = CROPS.find((x) => x.id === id);
                    const f = familyOf(id);
                    return (
                      <button key={id} className="chip fam" onClick={() => set(b.id, grown.filter((x) => x !== id))} aria-label={`Remove ${c?.name ?? id}`}>
                        {f && <i style={{ background: FAMILY_COLOR[f] }} aria-hidden />}{c?.name ?? id}{f ? <small>{FAMILY_LABEL[f]}</small> : null} ×
                      </button>
                    );
                  })}
                  <select aria-label={`Add a crop to bed ${b.n}`} value="" onChange={(e) => e.target.value && set(b.id, [...grown, e.target.value])}>
                    <option value="">+ Add a crop</option>
                    {SORTED.filter((c) => !grown.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="muted small">Don&apos;t remember? Skip this step. Rotation starts from this year, and next year it fills in from your saved plan.</p>
    </>
  );
}
