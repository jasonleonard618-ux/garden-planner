"""Exploded isometric of one 4 x 8 ft raised bed per level, matching construction sheets B-101..B-103
(2x10 cedar courses, 4x4 posts inside the corners, liner on Better/Best, 2x6 cap and outside stain on Best).
Callout numbers are the keynote numbers on the construction sheets."""
import random
from iso import *

TIERS = {
    "good": dict(courses=1, liner=False, cap=False, stain=False, name="GOOD"),
    "better": dict(courses=2, liner=True, cap=False, stain=False, name="BETTER"),
    "best": dict(courses=2, liner=True, cap=True, stain=True, name="BEST"),
}
T, BH = 1.5, 9.25  # 2x10 actual


def bed(tier):
    t = TIERS[tier]
    W, H = 900, 720
    s = 2.8
    sc = Scene(s, 0, 0)
    # center on the bed footprint
    cx, cy = sc.P(48, 24, 0)
    sc.ox, sc.oy = W / 2 - cx + 6, 480 - cy
    rnd = random.Random(4)
    h = t["courses"] * BH
    lift = 34
    # ---- ground block (cut faces hatched) ----
    gx0, gy0, gx1, gy1, gz = -10, -10, 106, 58, -12
    g = []
    g.append(sc.poly([(gx0, gy0, 0), (gx1, gy0, 0), (gx1, gy1, 0), (gx0, gy1, 0)], "#E3EAD3", INK, 0.9))
    g.append(sc.poly([(gx1, gy0, gz), (gx1, gy1, gz), (gx1, gy1, 0), (gx1, gy0, 0)], "#FFFFFF", INK, 0.9))
    g.append(sc.poly([(gx0, gy1, gz), (gx1, gy1, gz), (gx1, gy1, 0), (gx0, gy1, 0)], "#FFFFFF", INK, 0.9))
    for k in range(1, 40):
        y = gy0 + (gy1 - gy0) * k / 40
        g.append(sc.line((gx1, y, gz + 0.6), (gx1, y, -0.6), "#8D918C", 0.45))
    for k in range(1, 64):
        x = gx0 + (gx1 - gx0) * k / 64
        g.append(sc.line((x, gy1, gz + 0.6), (x, gy1, -0.6), "#8D918C", 0.45))
    # stripped, loosened soil where the bed lands
    g.append(sc.poly([(0, 0, 0), (96, 0, 0), (96, 48, 0), (0, 48, 0)], "#E7D9BF", "#6B6F68", 0.6, ' stroke-dasharray="5 4"'))
    for _ in range(140):
        x, y = rnd.uniform(3, 93), rnd.uniform(3, 45)
        px, py = sc.P(x, y, 0)
        g.append(f'<circle cx="{f(px)}" cy="{f(py)}" r="0.7" fill="#9C8A6B"/>')
    for _ in range(46):  # grass tufts outside the footprint
        while True:
            x, y = rnd.uniform(gx0 + 2, gx1 - 2), rnd.uniform(gy0 + 2, gy1 - 2)
            if not (-3 < x < 99 and -3 < y < 51):
                break
        px, py = sc.P(x, y, 0)
        g.append(f'<path d="M{f(px-2.5)},{f(py)} l1.5,-4 M{f(px)},{f(py)} l0,-5 M{f(px+2.5)},{f(py)} l-1.5,-4" stroke="#7E9465" stroke-width="0.6" fill="none"/>')
    sc.under.append("".join(g))
    z0 = lift
    # drop lines from the frame corners to the footprint
    for (x, y) in ((0, 48), (96, 48), (96, 0), (0, 0)):
        sc.under.append(sc.line((x, y, 0), (x, y, z0 - 2), "#6B6F68", 0.6, "3 4"))
    # ---- frame ----
    nat, out = WOOD, (CEDAR_STAIN if t["stain"] else WOOD)
    for c in range(t["courses"]):
        za, zb = z0 + c * BH, z0 + (c + 1) * BH
        sc.box(0, 0, za, 96, T, zb, nat, "x")                 # far side (inner face shows)
        sc.box(0, T, za, T, 48 - T, zb, nat, "y")             # far end
        sc.box(96 - T, T, za, 96, 48 - T, zb, out, "y")       # near end
        sc.box(0, 48 - T, za, 96, 48, zb, out, "x")           # near side
    # posts inside the corners, bottom 2 in below the frame (set into soil)
    for (x, y) in ((T, T), (96 - T - 3.5, T), (T, 48 - T - 3.5), (96 - T - 3.5, 48 - T - 3.5)):
        sc.box(x, y, z0 - 2, x + 3.5, y + 3.5, z0 + h, nat, "z", 0.8)
    # liner on the two inner faces we can see
    if t["liner"]:
        L = "rgba(255,111,71,0.18)"
        sc.add((0, T, z0, 96, T + 0.05, z0 + h), sc.poly([(T + 3.5, T, z0 + 2), (96 - T - 3.5, T, z0 + 2), (96 - T - 3.5, T, z0 + h - 0.6), (T + 3.5, T, z0 + h - 0.6)], L, CORAL, 0.9, ' stroke-dasharray="5 3"'))
        sc.add((T, T, z0, T + 0.05, 48 - T, z0 + h), sc.poly([(T, T + 3.5, z0 + 2), (T, 48 - T - 3.5, z0 + 2), (T, 48 - T - 3.5, z0 + h - 0.6), (T, T + 3.5, z0 + h - 0.6)], L, CORAL, 0.9, ' stroke-dasharray="5 3"'))
    # screws: 3 per board end on the near faces
    for c in range(t["courses"]):
        za = z0 + c * BH
        for k in (0.22, 0.5, 0.78):
            for x in (T + 1.75, 96 - T - 1.75):
                px, py = sc.P(x, 48, za + BH * k)
                sc.over.append(f'<circle cx="{f(px)}" cy="{f(py)}" r="1.1" fill="{INK}"/>')
            for y in (T + 1.75, 48 - T - 1.75):
                px, py = sc.P(96, y, za + BH * k)
                sc.over.append(f'<circle cx="{f(px)}" cy="{f(py)}" r="1.1" fill="{INK}"/>')
    # cap, exploded above
    capz = z0 + h + 36
    if t["cap"]:
        o, cw = 2.5, 5.5
        for drop in ((0, 0), ):
            pass
        sc.under.append("")
        for (x, y) in ((-o, 48 + o), (96 + o, 48 + o), (96 + o, -o), (-o, -o)):
            sc.over.append(sc.line((min(max(x, 0), 96), min(max(y, 0), 48), z0 + h + 0.2), (x, y, capz - 0.2), "#6B6F68", 0.6, "3 4"))
        capw = CEDAR_STAIN
        sc.box(-o, -o, capz, 96 + o, -o + cw, capz + T, WOOD, None)
        sc.box(-o, -o + cw, capz, -o + cw, 48 + o - cw, capz + T, WOOD, None)
        sc.box(96 + o - cw, -o + cw, capz, 96 + o, 48 + o - cw, capz + T, capw if t["stain"] else WOOD, None)
        sc.box(-o, 48 + o - cw, capz, 96 + o, 48 + o, capz + T, capw if t["stain"] else WOOD, None)
    # ---- dimensions ----
    sc.dim((0, 48, z0), (96, 48, z0), (0, 12, 0), "8'-0\"")
    sc.dim((96, 0, z0), (96, 48, z0), (12, 0, 0), "4'-0\"")
    hz = '1\'-6 1/2"' if t["courses"] == 2 else '9 1/4"'
    sc.dim((0, 48, z0), (0, 48, z0 + h), (-12, 0, 0), hz)
    body = sc.render()
    # ---- callouts (keynote numbers from the construction sheets) ----
    A = []
    A.append((1, "SIDE BOARD, 2×10", sc.P(30, 48, z0 + BH * 0.5), "L"))
    A.append((2, "END BOARD, 45 IN", sc.P(96, 14, z0 + h - BH * 0.5), "R"))
    A.append((3, "4×4 CORNER POST", sc.P(T + 1.75, 48 - T - 1.75, z0 - 1), "L"))
    A.append((4, "3 SCREWS PER END", sc.P(96 - T - 1.75, 48, z0 + BH * 0.78), "R"))
    if t["liner"]:
        A.append((5, "6 MIL LINER, SOIL SIDE", sc.P(48, T, z0 + h - 3), "R"))
    if t["cap"]:
        A.append((7, "2×6 SEAT CAP", sc.P(60, -2.5, capz + T), "R"))
        A.append((10, "STAIN, OUTSIDE ONLY", sc.P(70, 48, z0 + h - 4), "L"))
    A.append((8, "STRIP SOD, LOOSEN 6 IN", sc.P(70, 30, 0), "R"))
    body += callouts(A, 190, 700, 150, H - 70)
    lvl = t["name"]
    foot = f"RAISED BED · 4 × 8 FT · CEDAR · {lvl} · NOT TO SCALE · NUMBERS MATCH SHEET B-10{ {'good':1,'better':2,'best':3}[tier] } KEYNOTES"
    return frame(W, H, body, f"EXPLODED VIEW · BED · {lvl}", "How one bed goes together",
                 "Parts are pulled apart to show how they stack. Dashed lines show where each piece lands.", foot)


if __name__ == "__main__":
    import sys, os
    outdir = sys.argv[1] if len(sys.argv) > 1 else "."
    for k in TIERS:
        open(os.path.join(outdir, f"bed-{k}.svg"), "w").write(bed(k))
