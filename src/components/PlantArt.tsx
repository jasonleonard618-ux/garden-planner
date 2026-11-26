/**
 * Hand-rendered plant symbols for plans, in the storyboard's style: a soft shadow, layered leaf
 * blobs, a highlight, leaf veins, an ink outline, and fruit or flower accents where a crop has them.
 * Shapes are seeded so the same plan always draws the same way.
 */

type Kind = "scallop" | "star" | "flower" | "dots" | "burst";
type Style = { li: string; mid: string; dk: string; kind: Kind; acc?: string; size: number };

const INK = "#0E2E2A";

/** Look per crop. size = symbol radius as a share of half the plant spacing. */
const STYLE: Record<string, Style> = {
  tomato: { li: "#A9DCC4", mid: "#3F8A78", dk: "#1D5A52", kind: "scallop", acc: "#FF6F47", size: 0.95 },
  pepper: { li: "#B4DEC9", mid: "#4F9682", dk: "#22605A", kind: "scallop", acc: "#FF9A6B", size: 0.9 },
  eggplant: { li: "#B4DEC9", mid: "#4F9682", dk: "#22605A", kind: "scallop", acc: "#6B4C9A", size: 0.9 },
  cucumber: { li: "#9FD0BE", mid: "#2F7465", dk: "#0B3530", kind: "scallop", acc: "#F2D16B", size: 0.95 },
  zucchini: { li: "#9FD0BE", mid: "#2F7465", dk: "#0B3530", kind: "scallop", acc: "#F2D16B", size: 0.95 },
  "winter-squash": { li: "#9FD0BE", mid: "#2F7465", dk: "#0B3530", kind: "scallop", acc: "#F2A65A", size: 0.95 },
  potato: { li: "#B9DCC8", mid: "#5A9A80", dk: "#2C6852", kind: "scallop", size: 0.9 },
  basil: { li: "#C9EBD9", mid: "#7CC4A2", dk: "#3D8A6A", kind: "scallop", size: 0.95 },
  kale: { li: "#BFD9E0", mid: "#5E8C97", dk: "#2E5A66", kind: "star", size: 0.95 },
  collards: { li: "#BFD9E0", mid: "#5E8C97", dk: "#2E5A66", kind: "star", size: 0.95 },
  broccoli: { li: "#C2D8D2", mid: "#4E7F72", dk: "#264F45", kind: "star", size: 0.95 },
  cabbage: { li: "#D3E8DD", mid: "#7FB39E", dk: "#3F7462", kind: "star", size: 0.95 },
  cauliflower: { li: "#D3E8DD", mid: "#7FB39E", dk: "#3F7462", kind: "star", acc: "#FFFDF4", size: 0.95 },
  kohlrabi: { li: "#D5E6EA", mid: "#83A9B3", dk: "#456F7A", kind: "star", size: 0.9 },
  "lettuce-leaf": { li: "#E2F3E9", mid: "#A8D9BF", dk: "#5FA585", kind: "dots", size: 0.95 },
  "lettuce-head": { li: "#E2F3E9", mid: "#A8D9BF", dk: "#5FA585", kind: "dots", size: 0.95 },
  spinach: { li: "#D3EEDF", mid: "#6FAF8E", dk: "#3B7C5D", kind: "dots", size: 0.95 },
  chard: { li: "#D9EFE2", mid: "#7DBB9B", dk: "#3D7E60", kind: "dots", acc: "#D2453A", size: 0.95 },
  arugula: { li: "#D3EEDF", mid: "#8FC7AA", dk: "#4E8C70", kind: "dots", size: 0.95 },
  parsley: { li: "#E3EDE9", mid: "#9DB8AF", dk: "#5E7A72", kind: "dots", size: 0.95 },
  cilantro: { li: "#E3EDE9", mid: "#9DB8AF", dk: "#5E7A72", kind: "dots", size: 0.95 },
  strawberry: { li: "#BFE1CF", mid: "#4F9A7E", dk: "#22604E", kind: "dots", acc: "#FF6F47", size: 0.95 },
  alyssum: { li: "#FFFFFF", mid: "#F4F1EA", dk: "#B9B4A6", kind: "dots", size: 0.9 },
  "bush-bean": { li: "#C2E3D1", mid: "#5FA186", dk: "#2C6852", kind: "dots", size: 0.95 },
  "pole-bean": { li: "#C2E3D1", mid: "#5FA186", dk: "#2C6852", kind: "dots", size: 0.95 },
  pea: { li: "#C7EBD6", mid: "#6FBF97", dk: "#2F7D5B", kind: "dots", size: 0.95 },
  carrot: { li: "#C7EBD6", mid: "#6FBF97", dk: "#2F7D5B", kind: "burst", size: 0.95 },
  beet: { li: "#C7EBD6", mid: "#6FA98A", dk: "#9B2D4A", kind: "burst", size: 0.95 },
  radish: { li: "#C7EBD6", mid: "#7FBF9B", dk: "#D2453A", kind: "burst", size: 0.95 },
  turnip: { li: "#C7EBD6", mid: "#7FBF9B", dk: "#8C6BB1", kind: "burst", size: 0.95 },
  onion: { li: "#D5E9DE", mid: "#7FA79A", dk: "#4D6E64", kind: "burst", size: 0.9 },
  garlic: { li: "#D5E9DE", mid: "#7FA79A", dk: "#4D6E64", kind: "burst", size: 0.9 },
  leek: { li: "#D5E9DE", mid: "#6F9B8D", dk: "#3F6258", kind: "burst", size: 0.9 },
  corn: { li: "#D9EBC9", mid: "#7FA65A", dk: "#4E6E2E", kind: "burst", acc: "#F2D16B", size: 0.95 },
  marigold: { li: "#FFD2C2", mid: "#FF8A5C", dk: "#E0552F", kind: "flower", acc: "#B23A1A", size: 0.9 },
};
const FALLBACK: Style = { li: "#C9EBD9", mid: "#6FAF8E", dk: "#2F7D5B", kind: "dots", size: 0.9 };
export const plantStyle = (id: string) => STYLE[id] ?? FALLBACK;

/** Small seeded random generator (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function blob(cx: number, cy: number, R: number, bumps: number, r: () => number, amp = 0.09, jit = 0.03) {
  const ph = r() * 6.28;
  let d = "";
  for (let t = 0; t < 36; t++) {
    const a = (t / 36) * 2 * Math.PI;
    const rr = R * (1 + amp * Math.sin(bumps * a + ph) + (r() * 2 - 1) * jit);
    d += `${t ? "L" : "M"}${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`;
  }
  return d + "Z";
}

/** One plant symbol, centered at (cx, cy) with radius R in SVG units. */
export function Plant({ id, cx, cy, R, seed, faded }: { id: string; cx: number; cy: number; R: number; seed: number; faded?: boolean }) {
  const st = plantStyle(id);
  const r = rng(seed);
  const sw = Math.max(0.35, Math.min(1.1, R * 0.09));
  const op = faded ? 0.55 : 1;
  if (st.kind === "burst") {
    const n = 8;
    return (
      <g opacity={op}>
        {Array.from({ length: n }, (_, t) => {
          const a = (t / n) * 6.28 + r() * 0.4;
          return <line key={t} x1={cx} y1={cy} x2={cx + Math.cos(a) * R} y2={cy + Math.sin(a) * R} stroke={st.mid} strokeWidth={Math.max(0.5, R * 0.16)} strokeLinecap="round" />;
        })}
        <circle cx={cx} cy={cy} r={R * 0.28} fill={st.dk} />
        {st.acc && <circle cx={cx} cy={cy} r={R * 0.16} fill={st.acc} />}
      </g>
    );
  }
  if (st.kind === "dots") {
    return (
      <g opacity={op}>
        <circle cx={cx + R * 0.22} cy={cy + R * 0.25} r={R} fill="#0B3530" fillOpacity="0.16" />
        <circle cx={cx} cy={cy} r={R} fill={st.mid} stroke={INK} strokeWidth={sw * 0.8} />
        <circle cx={cx - R * 0.3} cy={cy - R * 0.3} r={R * 0.45} fill={st.li} fillOpacity="0.8" />
        {st.acc && r() < 0.6 && <circle cx={cx + R * 0.35} cy={cy + R * 0.3} r={Math.max(0.6, R * 0.28)} fill={st.acc} stroke={INK} strokeWidth={sw * 0.4} />}
      </g>
    );
  }
  const n = st.kind === "scallop" ? 9 : st.kind === "star" ? 12 : 7;
  const veins = Array.from({ length: 5 }, () => {
    const a = r() * 6.28, r0 = R * (0.25 + r() * 0.25);
    return `M${(cx + Math.cos(a) * r0).toFixed(1)} ${(cy + Math.sin(a) * r0).toFixed(1)} q ${(Math.cos(a + 1) * R * 0.2).toFixed(1)} ${(Math.sin(a + 1) * R * 0.2).toFixed(1)} ${(Math.cos(a) * R * 0.35).toFixed(1)} ${(Math.sin(a) * R * 0.35).toFixed(1)}`;
  });
  const fruit = st.acc && st.kind !== "flower" && r() < 0.6
    ? [0, 1].map(() => { const a = r() * 6.28; return [cx + Math.cos(a) * R * 0.5, cy + Math.sin(a) * R * 0.5] as const; })
    : [];
  return (
    <g opacity={op}>
      <path d={blob(cx + R * 0.25, cy + R * 0.28, R, n, r)} fill="#0B3530" fillOpacity="0.18" />
      <path d={blob(cx + R * 0.08, cy + R * 0.08, R, n, r)} fill={st.dk} />
      <path d={blob(cx - R * 0.04, cy - R * 0.04, R * 0.92, n, r)} fill={st.mid} />
      <ellipse cx={cx - R * 0.3} cy={cy - R * 0.32} rx={R * 0.42} ry={R * 0.3} fill={st.li} fillOpacity="0.75" />
      {st.kind === "star"
        ? Array.from({ length: 10 }, (_, t) => { const a = (t / 10) * 6.28 + r() * 0.3; return <line key={t} x1={cx} y1={cy} x2={cx + Math.cos(a) * R * 0.92} y2={cy + Math.sin(a) * R * 0.92} stroke={INK} strokeWidth={sw * 0.6} strokeOpacity="0.6" />; })
        : veins.map((d, i) => <path key={i} d={d} fill="none" stroke={st.dk} strokeWidth={sw * 0.8} strokeLinecap="round" />)}
      <path d={blob(cx, cy, R, n, r)} fill="none" stroke={INK} strokeWidth={sw} />
      {st.kind === "flower" && <circle cx={cx} cy={cy} r={R * 0.32} fill={st.acc} stroke={INK} strokeWidth={sw * 0.5} />}
      {st.kind === "star" && st.acc && <circle cx={cx} cy={cy} r={R * 0.38} fill={st.acc} stroke={INK} strokeWidth={sw * 0.5} />}
      {fruit.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={Math.max(0.8, R * 0.15)} fill={st.acc} stroke={INK} strokeWidth={sw * 0.45} />)}
    </g>
  );
}
