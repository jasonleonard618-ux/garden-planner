"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogoStacked, Wordmark } from "./Logo";
import { CROPS } from "@/data/crops";

const STEPS = [
  { n: "01", tag: "Site", title: "Find the sunniest spot", body: "We trace shade from your house, trees and fences across a whole day in spring, summer and late summer, using a government height survey of your block.", art: "site" },
  { n: "02", tag: "Grow", title: "Pick what grows there", body: "Crops are matched to your sun and frost dates. Pairings are only suggested when field trials back them, with the source attached.", art: "grow" },
  { n: "03", tag: "Layout", title: "Lay out the beds", body: "A planting plan you can tap through. Turn a column into a wide walkway and the plant list updates.", art: "layout" },
  { n: "04", tag: "Build", title: "Build it, good to excellent", body: "Exploded drawings, cut lists, fence cut-aways and footing details, with a price for each level.", art: "build" },
] as const;

export default function Home({ skipIntro }: { skipIntro?: boolean }) {
  const [pastHero, setPastHero] = useState(false);
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

  // The top bar widens with the wordmark once the hero scrolls away; the "How it works" picture
  // follows whichever step is in the middle of the screen.
  const [active, setActive] = useState(0);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setPastHero(window.scrollY > window.innerHeight * 0.6));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
    }, { rootMargin: "-45% 0px -45% 0px" });
    document.querySelectorAll(".how-steps [data-step]").forEach((el) => io.observe(el));
    return () => { io.disconnect(); window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div className={`home${phase === "done" ? " revealed" : ""}`}>
      {phase !== "done" && (
        <div className={`intro${phase === "leaving" ? " leaving" : ""}`} onClick={() => setPhase("done")} role="presentation">
          <LogoStacked size={132} className="intro-logo" />
          <button className="intro-skip" onClick={() => setPhase("done")}>Skip</button>
        </div>
      )}

      {/* At the top the hero carries the full logo, so the bar holds just the links; the wordmark slides in once the hero scrolls away. */}
      <header className={`home-nav${pastHero ? " past" : ""}`}>
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
          <p className="lede">About fifteen minutes. Everything is drawn on your own yard, and every recommendation shows its source.</p>
        </div>
        <div className="how-sticky">
          <div className="how-stage" aria-hidden>
            {STEPS.map((s, i) => (
              <div key={s.n} className={`stage-art art art-${s.art}${i === active ? " on" : ""}`}><Art kind={s.art} /></div>
            ))}
            <span className="stage-count">{STEPS[active].n} / 0{STEPS.length}</span>
          </div>
          <ol className="how-steps">
            {STEPS.map((s, i) => (
              <li key={s.n} data-step={i} className={i === active ? "on" : ""}>
                <div className={`step-art art art-${s.art}`} aria-hidden><Art kind={s.art} /></div>
                <p className="eyebrow">{s.n} · {s.tag}</p>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
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

const PEPPER_SUN = CROPS.find((c) => c.id === "pepper")?.sun ?? 6;

/** The storyboard pictures for each step: sample yard photo, trial-backed pairings, the hand-drawn plan, build drawings. */
function Art({ kind }: { kind: string }) {
  if (kind === "site")
    return (
      <div className="art-yard">
        <span className="art-glow" />
        <span className="art-spot"><small>SPOT A · JUNE</small><b>14.4 hrs</b></span>
        <span className="art-sample">Sample yard</span>
      </div>
    );
  if (kind === "grow")
    return (
      <ul className="art-tags">
        <li><span><b>Tomato + basil</b><small>Fewer thrips and whiteflies in a field trial</small></span><i className="t-ok">Backed by trials</i></li>
        <li><span><b>Lettuce + sweet alyssum</b><small>Hoverflies eat the aphids</small></span><i className="t-ok">Backed by trials</i></li>
        <li><span><b>Strawberries</b><small>No proven companion, so they grow alone</small></span><i className="t-plain">Single crop</i></li>
        <li><span><b>Peppers</b><small>Need {PEPPER_SUN}+ hrs of sun; this spot has 11</small></span><i className="t-ok">Fits your sun</i></li>
      </ul>
    );
  if (kind === "layout") return <div className="art-plan" role="img" aria-label="Hand-drawn planting plan with an 8 ft walkway" />;
  return (
    <div className="art-draw">
      <img src="/drawings/bed-better-thumb.svg" alt="Exploded drawing of a raised bed" />
      <img src="/drawings/fence-excellent-thumb.svg" alt="Cut-away drawing of the excellent fence" />
      <span className="art-tiers">{["Good", "Better", "Best", "Excellent"].map((t) => <span key={t}>{t}</span>)}</span>
    </div>
  );
}
