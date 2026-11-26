"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, track } from "@/lib/supabase";
import type { SiteProfile } from "@/lib/types";

/** Signed-in state, shared by the save step and the plan list. */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

export async function saveToAccount(p: SiteProfile, userId: string) {
  if (!supabase) throw new Error("Accounts aren't set up yet.");
  const { error } = await supabase.from("plans").upsert({ id: p.id, user_id: userId, name: p.name, data: p, updated_at: new Date().toISOString() });
  if (error) throw error;
  track("plan_saved", "account");
}

export async function listAccountPlans(): Promise<SiteProfile[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("plans").select("data").order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => r.data as SiteProfile);
}

/** Sign-in only happens at save: Google, or a sign-in link by email. */
export function SignIn() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!supabase) return null;
  const redirectTo = typeof window !== "undefined" ? window.location.href : undefined;
  return (
    <div className="signin">
      <p className="small"><b>Create a free account</b> to keep this plan and open it on your phone or computer. Everything you&apos;ve done so far comes with you.</p>
      {process.env.NEXT_PUBLIC_GOOGLE_SIGNIN === "1" && <button className="btn google" onClick={() => supabase!.auth.signInWithOAuth({ provider: "google", options: { redirectTo } })}>Continue with Google</button>}
      {sent ? (
        <p className="small">Check your email for a sign-in link. You can close this tab after you click it.</p>
      ) : (
        <form className="search-box" onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          const { error } = await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
          if (error) setErr(error.message); else setSent(true);
        }}>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email" />
          <button className="btn" type="submit">Email me a link</button>
        </form>
      )}
      {err && <p className="warn small">{err}</p>}
    </div>
  );
}

export function Feedback({ step }: { step: string }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [contact, setContact] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return setState("error");
    setState("sending");
    const { data } = await supabase.auth.getSession();
    const { error } = await supabase.from("feedback").insert({ message: msg.trim(), contact: contact.trim() || null, page: location.pathname, step, user_id: data.session?.user.id ?? null });
    setState(error ? "error" : "sent");
    if (!error) { setMsg(""); track("feedback_sent"); }
  };
  return (
    <div className="feedback">
      <button className="tools-btn" onClick={() => { setOpen(!open); setState("idle"); }} aria-expanded={open}>Feedback</button>
      {open && (
        <form className="feedback-pop glass" onSubmit={send}>
          <p className="small"><b>Tell us what&apos;s confusing, broken or missing.</b> It goes straight to the person building this.</p>
          <textarea required maxLength={4000} rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} aria-label="Your feedback" placeholder="What happened?" />
          <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Email, if you'd like a reply (optional)" aria-label="Contact email, optional" />
          <div className="row">
            <button className="btn primary" disabled={state === "sending" || !msg.trim()}>{state === "sending" ? "Sending…" : "Send"}</button>
            <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Close</button>
          </div>
          {state === "sent" && <p className="small">Thanks, got it.</p>}
          {state === "error" && <p className="warn small">{supabase ? "That didn't send. Please try again." : "Feedback isn't connected yet in this test version."}</p>}
        </form>
      )}
    </div>
  );
}
