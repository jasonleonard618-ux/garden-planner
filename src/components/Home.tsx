"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogoStacked, Wordmark } from "./Logo";

const STEPS = [
  { n: "01", tag: "Site", title: "Find the sunniest spot", body: "We trace shade from your house, trees and fences across a whole day in spring, summer and late summer, using a government height survey of your block.", art: "site" },
  { n: "02", tag: "Grow", title: "Pick what grows there", body: "Crops are matched to your sun and frost dates. Pairings are only suggested when field trials back them, with the source attached.", art: "grow" },
  { n: "03", tag: "Layout", title: "Lay out the beds", body: "A planting plan you can tap through. Turn a column into a wide walkway and the plant list updates.", art: "layout" },
  { n: "04", tag: "Build", title: "Build it, good to excellent", body: "Drawings, cut lists, fence and footing details, with a price for each level.", art: "build" },
] as const;

export default function Home({ skipIntro }: { skipIntro?: boolean }) {
  const [phase, setPhase] = useState<"intro" | "leaving" | "done">(skipIntro ? "done" : "intro");

  useEffect(() => {
    if (phase !== "intro") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (sessionStorage.getItem("ll-intro-seen")) return setPhase("done");
    sessionStorage.setItem("ll-intro-seen", "1");
    const t1 = setTimeout(() => setPhase("leaving"), reduce ? 900 : 2600);
    const t2 = setTimeout(() => setPhase("done"), reduce ? 1200 : 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [phase]);

  return (
    <div className={`home${phase === "done" ? " revealed" : ""}`}>
      {phase !== "done" && (
        <div className={`intro${phase === "leaving" ? " leaving" : ""}`} onClick={() => setPhase("done")} role="presentation">
          <LogoStacked size={132} className="intro-logo" />
          <button className="intro-skip" onClick={() => setPhase("done")}>Skip</button>
        </div>
      )}

      <header className="home-nav">
        <Link href="/" className="brand" aria-label="Light & Loam home"><Wordmark size={30} /></Link>
        <nav>
          <a href="#how">How it works</a>
          <a href="#sources">Sources</a>
          <Link className="btn pill" href="/plan">Start planning</Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-img" role="img" aria-label="Aerial photo of an example neighborhood" />
        <div className="hero-shade" />
        <div className="hero-copy">
          <LogoStacked size={84} className="hero-logo" />
          <p className="eyebrow light">A garden planner for the yard you already have</p>
          <h1>Grow where the sun already falls.</h1>
          <p className="hero-lede">Find the sunniest spot, choose what grows there, lay out the beds and get build plans with a shopping list. Free to try, no sign-up until you save.</p>
          <AddressForm />
        </div>
        <p className="hero-note glass">
          <strong>Sample yard.</strong> This is an example neighborhood, not your home. Type your address and the same study runs on your own yard.
        </p>
      </section>

      <section id="how" className="how">
        <div className="how-head">
          <p className="eyebrow">How it works</p>
          <h2>From a satellite photo to a shopping list.</h2>
          <p className="lede">Four steps, about fifteen minutes. Everything is drawn on your own yard, and every recommendation shows its source.</p>
        </div>
        <div className="cards">
          {STEPS.map((s) => (
            <article key={s.n} className="feature">
              <div className={`art art-${s.art}`} aria-hidden><Art kind={s.art} /></div>
              <p className="eyebrow">{s.n} · {s.tag}</p>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="sources" className="evidence">
        <div>
          <p className="eyebrow light">No garden folklore</p>
          <h2>Advice you can check.</h2>
        </div>
        <ul>
          <li><strong>Pairings from trials.</strong> University of Minnesota Extension, USDA-ARS Salinas, and peer-reviewed field trials.</li>
          <li><strong>Sun from real shade.</strong> Shadows cast by your actual buildings and trees, traced across the day.</li>
          <li><strong>Builds to spec.</strong> Fence heights from University of Georgia Extension; frost depth from your local building code.</li>
        </ul>
      </section>

      <section className="closing">
        <h2>Start with your address.</h2>
        <AddressForm />
      </section>

      <footer className="home-foot">
        <span>Light &amp; Loam · pilot 2027</span>
        <span>Sample aerial imagery: Esri World Imagery · Sources listed on every screen</span>
      </footer>
    </div>
  );
}

function AddressForm() {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form className="home-search" onSubmit={(e) => { e.preventDefault(); router.push(q.trim() ? `/plan?q=${encodeURIComponent(q.trim())}` : "/plan"); }}>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Street address, city, state" aria-label="Street address" />
      <button className="btn pill" type="submit">See my yard →</button>
    </form>
  );
}

function Art({ kind }: { kind: string }) {
  if (kind === "site") return <div className="art-yard"><span className="sun-blob" /><span className="art-chip">Best spot · June</span></div>;
  if (kind === "grow")
    return (
      <ul className="art-tags">
        <li><b>Tomato + basil</b><i className="t-ok">Backed by trials</i></li>
        <li><b>Lettuce + alyssum</b><i className="t-ok">Backed by trials</i></li>
        <li><b>Strawberries</b><i className="t-plain">Single crop</i></li>
      </ul>
    );
  if (kind === "layout")
    return (
      <svg viewBox="0 0 200 120" width="100%" height="100%">
        {[0, 1, 2, 3].map((c) => [0, 1].map((r) => (
          <g key={`${c}${r}`}>
            <rect x={14 + c * 46} y={12 + r * 54} width="36" height="46" rx="4" fill={c === 2 ? "transparent" : "#E6F3EC"} stroke={c === 2 ? "#BFE3D0" : "#145049"} strokeDasharray={c === 2 ? "4 3" : undefined} />
            {c !== 2 && [0, 1, 2].map((k) => <circle key={k} cx={32 + c * 46} cy={22 + r * 54 + k * 13} r="4.5" fill={["#FF6F47", "#6FB08A", "#F2B544"][(c + r + k) % 3]} />)}
          </g>
        )))}
        <text x="120" y="72" textAnchor="middle" fontSize="8" fill="#4E5F5B" transform="rotate(-90 120 66)">walkway</text>
      </svg>
    );
  return (
    <div className="art-tiers">
      {["Good", "Better", "Best", "Excellent"].map((t, i) => <span key={t} style={{ height: 34 + i * 18 }}>{t}</span>)}
    </div>
  );
}
