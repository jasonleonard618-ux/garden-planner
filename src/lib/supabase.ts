import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Supabase is optional: without these two settings the app saves in the browser only. */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;

function visitor() {
  try {
    let v = localStorage.getItem("ll-visitor");
    if (!v) { v = crypto.randomUUID(); localStorage.setItem("ll-visitor", v); }
    return v;
  } catch {
    return "unknown";
  }
}

/** Simple usage tracking for the pilot: which steps people reach. No personal details. */
export function track(name: string, detail?: string) {
  if (!supabase) return;
  supabase.from("events").insert({ visitor: visitor(), name, detail: detail ?? null }).then(() => {}, () => {});
}
