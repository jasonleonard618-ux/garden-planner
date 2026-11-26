"use client";

import { CROPS } from "@/data/crops";
import { SRC } from "@/data/sources";
import { BED_SQFT, UNLISTED_SQFT, type GardenSize, type HarvestUse } from "@/lib/sizing";

export type Goals = { people: number; use: HarvestUse; beds: number | null; fill: boolean };
export const DEFAULT_GOALS: Goals = { people: 4, use: "fresh", beds: null, fill: false };

const USES: { id: HarvestUse; label: string; sub: string }[] = [
  { id: "fresh", label: "Fresh eating", sub: "Salads and suppers in season" },
  { id: "preserve", label: "Fresh and preserving", sub: "Plus canning, freezing, sauce" },
];

/** Step 3: how many people, how the harvest is used, favorite crops, and the bed count that covers it. */
export function GoalsStep({ goals, setGoals, picks, setPicks, size, fits, using }: {
  goals: Goals; setGoals: (g: Goals) => void; picks: string[]; setPicks: (p: string[]) => void;
  size: GardenSize; fits: number; using: number;
}) {
  const set = (g: Partial<Goals>) => setGoals({ ...goals, ...g });
  const toggle = (id: string) => setPicks(picks.includes(id) ? picks.filter((x) => x !== id) : [...picks, id]);
  const rec = size.recommended;
  const chosen = goals.fill ? fits : Math.min(goals.beds ?? rec, fits);
  const pct = rec ? Math.min(100, Math.round((Math.min(rec, fits) / fits) * 100)) : 0;
  return (
    <>
      <h1 className="title">What do you want from the garden?</h1>
      <p className="lede">Tell us who you&apos;re feeding and what you love to eat. We size the garden from Extension planting amounts, then use your sunniest beds.</p>

      <h3>How many people are you feeding?</h3>
      <div className="stepper" role="group" aria-label="People">
        <button aria-label="Fewer people" onClick={() => set({ people: Math.max(1, goals.people - 1), beds: null })} disabled={goals.people <= 1}>−</button>
        <span className="stepper-v" aria-live="polite">{goals.people}</span>
        <button aria-label="More people" onClick={() => set({ people: Math.min(12, goals.people + 1), beds: null })} disabled={goals.people >= 12}>+</button>
      </div>

      <h3>How will you use the harvest?</h3>
      <div className="use-grid" role="radiogroup" aria-label="How you will use the harvest">
        {USES.map((u) => (
          <button key={u.id} role="radio" aria-checked={goals.use === u.id} className={goals.use === u.id ? "use on" : "use"} onClick={() => set({ use: u.id, beds: null })}>
            <b>{u.label}</b><small>{u.sub}</small>
          </button>
        ))}
      </div>

      <h3>What do you love to eat?</h3>
      <div className="chips" role="group" aria-label="Crops you love">
        {CROPS.map((c) => (
          <button key={c.id} aria-pressed={picks.includes(c.id)} className={picks.includes(c.id) ? "chip on" : "chip"} onClick={() => { toggle(c.id); if (goals.beds != null) set({ beds: null }); }}>
            {c.name.replace(" (flower)", "")}
          </button>
        ))}
      </div>
      <p className="muted small">These carry into the Plants step, where you can check which ones suit your sun and season.</p>

      {picks.length === 0 ? (
        <p className="warn">Pick a few crops to see how big a garden you need.</p>
      ) : (
        <section className="reco" aria-label="Recommendation">
          <p className="eyebrow">We recommend</p>
          <div className="reco-n"><span>{rec}</span><span>raised beds<br /><em>4 × 8 ft</em></span></div>
          <div className="reco-bar"><i style={{ width: `${pct}%` }} /></div>
          <p className="muted small">
            {rec <= fits ? `${rec} of the ${fits} beds that fit in your outline.` : `Your outline fits ${fits}. Draw a larger outline or pick fewer crops to grow it all.`}
            {" "}Range {size.beds[0] === size.beds[1] ? size.beds[0] : `${size.beds[0]} to ${size.beds[1]}`} beds, about {size.sqft[0]}–{size.sqft[1]} sq ft of bed.
          </p>
          <h3>Beds to build</h3>
          <div className="row reco-pick">
            <div className="stepper small" role="group" aria-label="Beds to build">
              <button aria-label="Fewer beds" onClick={() => set({ beds: Math.max(1, chosen - 1), fill: false })} disabled={chosen <= 1}>−</button>
              <span className="stepper-v">{chosen}</span>
              <button aria-label="More beds" onClick={() => set({ beds: Math.min(fits, chosen + 1), fill: false })} disabled={chosen >= fits}>+</button>
            </div>
            {goals.fill || goals.beds != null ? (
              <button className="link" onClick={() => set({ beds: null, fill: false })}>Use the recommendation</button>
            ) : (
              <button className="link" onClick={() => set({ fill: true })}>Fill the whole outline ({fits})</button>
            )}
          </div>
          {using > 0 && <p className="muted small">The Beds step groups your {using} beds in the sunniest part of your outline; the rest stays lawn for now.</p>}
        </section>
      )}

      {size.crops.length > 0 && (
        <details className="sub">
          <summary>How we worked this out</summary>
          <table className="shop size-table">
            <thead><tr><th>Crop</th><th>Per person</th><th>Plants</th><th>Sq ft</th></tr></thead>
            <tbody>
              {size.crops.map((c) => (
                <tr key={c.id}>
                  <td>{c.name.replace(" (flower)", "")}</td>
                  <td>{c.listed ? c.amount : <span className="label-pc">practical choice</span>}</td>
                  <td>{c.listed ? (c.plants[0] === c.plants[1] ? c.plants[0] : `${c.plants[0]}–${c.plants[1]}`) : "–"}</td>
                  <td>{c.sqft[0] === c.sqft[1] ? c.sqft[0] : `${c.sqft[0]}–${c.sqft[1]}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">
            Amounts per person, for fresh use or for processing, come from <a href={SRC.muSize.href} target="_blank" rel="noreferrer">{SRC.muSize.label}</a>. Feet of row are turned into plants and bed area with the raised-bed spacing in <a href={SRC.csu.href} target="_blank" rel="noreferrer">{SRC.csu.label}</a>. Where Missouri lists no processing amount, the fresh amount is used. Crops the table doesn&apos;t list (herbs, garlic, leeks, strawberries, flowers) get {UNLISTED_SQFT} sq ft, a quarter bed, and a cucumber or pole bean hill counts as 3 or 4 plants on a trellis (practical choices). The recommendation is the middle of the range, rounded up to whole {BED_SQFT} sq ft beds.
          </p>
        </details>
      )}
    </>
  );
}
