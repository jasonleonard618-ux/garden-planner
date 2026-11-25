import type { SiteProfile } from "./types";

const KEY = "garden-planner.sites.v1";

export function listSites(): SiteProfile[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as SiteProfile[];
  } catch {
    return [];
  }
}

export function saveSite(p: SiteProfile) {
  const all = listSites().filter((s) => s.id !== p.id);
  all.unshift(p);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function deleteSite(id: string) {
  localStorage.setItem(KEY, JSON.stringify(listSites().filter((s) => s.id !== id)));
}

export function downloadSite(p: SiteProfile) {
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${p.name.replace(/[^\w-]+/g, "-").toLowerCase() || "garden-site"}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function readSiteFile(file: File): Promise<SiteProfile> {
  const p = JSON.parse(await file.text()) as SiteProfile;
  if (!p.place || !p.id) throw new Error("This file isn't a garden site profile.");
  return p;
}
