/** Light & Loam brand: the Seedling mark (light above, soil below, a sprout crossing the line). */
export function SeedlingMark({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <path className="m-sun" d="M8 54 A42 42 0 0 1 92 54 Z" fill="#FF6F47" />
      <path className="m-soil" d="M8 54 A42 42 0 0 0 92 54 Z" fill="#33504A" />
      <path className="m-rows" d="M30 66 L70 66 M36 74 L64 74" stroke="rgba(255,255,255,0.35)" strokeWidth="2.4" strokeLinecap="round" />
      <path className="m-stem" d="M50 78 L50 44" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" pathLength={1} />
      <path className="m-leaf-r" d="M50 50 C 50 36, 62 30, 72 32 C 70 44, 60 50, 50 50 Z" fill="#FFFFFF" />
      <path className="m-leaf-l" d="M50 56 C 48 46, 38 42, 30 44 C 32 54, 42 58, 50 56 Z" fill="#FFFFFF" opacity="0.85" />
    </svg>
  );
}

export function Wordmark({ size = 30 }: { size?: number }) {
  return (
    <span className="wordmark">
      <SeedlingMark size={size} />
      <span className="wm-text">Light &amp; Loam</span>
    </span>
  );
}

/** Stacked lockup: the mark with plain "Light & Loam" set beneath it. */
export function LogoStacked({ size = 120, className }: { size?: number; className?: string }) {
  return (
    <span className={`logo-stacked ${className ?? ""}`}>
      <SeedlingMark size={size} />
      <span className="ls-text" style={{ fontSize: size * 0.36 }}>Light &amp; Loam</span>
    </span>
  );
}
