import type { SiteData } from "@/lib/types";

type Wind = NonNullable<SiteData["wind"]>;

/** Petals point the way the wind comes FROM. Darker part = 10 mph and up. */
export default function WindRose({ wind, size = 168 }: { wind: Wind; size?: number }) {
  const c = size / 2;
  const maxR = c - 18;
  const max = Math.max(...wind.sectors.map((s) => s.percent), 1);
  const petal = (i: number, pct: number) => {
    const r = (pct / max) * maxR;
    const a0 = ((i * 22.5 - 9) * Math.PI) / 180;
    const a1 = ((i * 22.5 + 9) * Math.PI) / 180;
    const p = (a: number, rr: number) => `${c + rr * Math.sin(a)},${c - rr * Math.cos(a)}`;
    return `M${c},${c} L${p(a0, r)} A${r},${r} 0 0 1 ${p(a1, r)} Z`;
  };
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Wind mostly from the ${wind.prevailing}`}>
      {[0.33, 0.66, 1].map((f) => (
        <circle key={f} cx={c} cy={c} r={maxR * f} fill="none" stroke="#d8d2c4" strokeDasharray="2 3" />
      ))}
      {wind.sectors.map((s, i) => (
        <g key={s.dir}>
          <path d={petal(i, s.percent)} fill="#9cbf8f" />
          <path d={petal(i, s.strongPercent)} fill="#3f6b45" />
        </g>
      ))}
      {["N", "E", "S", "W"].map((d, i) => {
        const a = (i * 90 * Math.PI) / 180;
        return (
          <text key={d} x={c + (maxR + 10) * Math.sin(a)} y={c - (maxR + 10) * Math.cos(a) + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill="#5b6157">
            {d}
          </text>
        );
      })}
    </svg>
  );
}
