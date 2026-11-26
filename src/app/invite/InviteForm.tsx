"use client";

import { useState } from "react";
import { LogoStacked } from "@/components/Logo";

export default function InviteForm({ next }: { next: string }) {
  const [code, setCode] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "bad">("idle");
  return (
    <main className="invite">
      <div className="hero-img" aria-hidden />
      <div className="hero-shade" />
      <form className="invite-card glass" onSubmit={async (e) => {
        e.preventDefault();
        setState("busy");
        const r = await fetch("/api/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
        if (r.ok) window.location.assign(next);
        else setState("bad");
      }}>
        <LogoStacked size={84} className="invite-logo" />
        <h1>Private pilot</h1>
        <p>Light &amp; Loam is in a small invite-only test. Enter the code you were given.</p>
        <input value={code} onChange={(e) => { setCode(e.target.value); setState("idle"); }} placeholder="Invite code" aria-label="Invite code" autoFocus autoCapitalize="none" autoComplete="off" />
        <button className="btn pill" disabled={!code.trim() || state === "busy"}>{state === "busy" ? "Checking…" : "Enter"}</button>
        {state === "bad" && <p className="warn small">That code didn&apos;t work. Check the spelling, or ask the person who invited you.</p>}
      </form>
    </main>
  );
}
