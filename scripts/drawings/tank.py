"""Exploded isometric of one stock tank planter, matching construction sheet B-104:
a new 2 x 8 x 2 ft round-end galvanized tank lifted over two rails of 4x8x16 solid blocks,
seven 1/2 in drain holes on the floor centerline. Callout numbers are the B-104 keynote numbers."""
import math
from iso import *

L, Wd, Ht, R = 96.0, 24.0, 24.0, 12.0
ZINC = "#C9CFCB"; ZINC_D = "#8E9692"; INSIDE = "#9BA39F"; FLOOR = "#E4E8E5"


def outline(n=18):
    """Oval footprint as (x, y, nx, ny): straight long sides, half-round ends."""
    pts = []
    for i in range(n + 1):  # far side straight, then +x end, near side, -x end
        pass
    seg = []
    for i in range(7):
        x = R + (L - 2 * R) * i / 6; seg.append((x, 0.0, 0.0, -1.0))
    for i in range(1, n):
        t = -math.pi / 2 + math.pi * i / n; seg.append((L - R + R * math.cos(t), R + R * math.sin(t), math.cos(t), math.sin(t)))
    for i in range(7):
        x = L - R - (L - 2 * R) * i / 6; seg.append((x, Wd, 0.0, 1.0))
    for i in range(1, n):
        t = math.pi / 2 + math.pi * i / n; seg.append((R + R * math.cos(t), R + R * math.sin(t), math.cos(t), math.sin(t)))
    return seg


def shade(nx, ny):
    k = max(0.0, min(1.0, 0.5 + 0.35 * nx - 0.25 * ny))
    a, b = (0xDA, 0xDF, 0xDB), (0x86, 0x8E, 0x8A)
    return "#%02X%02X%02X" % tuple(round(a[i] * k + b[i] * (1 - k)) for i in range(3))


def tank():
    W, H = 900, 720
    sc = Scene(3.4, 0, 0)
    cx, cy = sc.P(48, 12, 0)
    sc.ox, sc.oy = W / 2 - cx, 500 - cy
    # ground block
    gx0, gy0, gx1, gy1, gz = -10, -10, 106, 34, -10
    g = [sc.poly([(gx0, gy0, 0), (gx1, gy0, 0), (gx1, gy1, 0), (gx0, gy1, 0)], "#E3EAD3", INK, 0.9),
         sc.poly([(gx1, gy0, gz), (gx1, gy1, gz), (gx1, gy1, 0), (gx1, gy0, 0)], "#FFFFFF", INK, 0.9),
         sc.poly([(gx0, gy1, gz), (gx1, gy1, gz), (gx1, gy1, 0), (gx0, gy1, 0)], "#FFFFFF", INK, 0.9)]
    for k in range(1, 22):
        y = gy0 + (gy1 - gy0) * k / 22; g.append(sc.line((gx1, y, gz + 0.6), (gx1, y, -0.6), "#8D918C", 0.45))
    for k in range(1, 60):
        x = gx0 + (gx1 - gx0) * k / 60; g.append(sc.line((x, gy1, gz + 0.6), (x, gy1, -0.6), "#8D918C", 0.45))
    g.append(sc.poly([(-2, -2, 0), (98, -2, 0), (98, 26, 0), (-2, 26, 0)], "#E9E6DC", "#6B6F68", 0.6, ' stroke-dasharray="5 4"'))
    sc.under.append("".join(g))
    # block rails
    for y0 in (0, 16):
        for i in range(6):
            sc.box(i * 16 + 0.15, y0, 0, i * 16 + 15.85, y0 + 8, 4, CONC, None, 0.8)
    body = sc.render()
    # tank, lifted
    z0 = 4 + 30; z1 = z0 + Ht
    ol = outline()
    o = []
    for (x, y) in ((R, 0), (L - R, 0), (L - R, Wd), (R, Wd), (L, R), (0, R)):
        pass
    for (x, y) in ((R, Wd), (L - R, Wd), (L, R)):
        o.append(sc.line((x, y, 4), (x, y, z0 - 1), "#6B6F68", 0.6, "3 4"))
    n = len(ol)
    facets = [(ol[i], ol[(i + 1) % n]) for i in range(n)]
    def vis(a, b): return (a[2] + b[2]) + (a[3] + b[3]) > 0
    # far wall, inner face
    for a, b in facets:
        if not vis(a, b):
            o.append(sc.poly([(a[0], a[1], z0 + 0.8), (b[0], b[1], z0 + 0.8), (b[0], b[1], z1), (a[0], a[1], z1)], INSIDE, INSIDE, 0.6))
    for i in range(0, n, 2):
        a = ol[i]
        if a[2] + a[3] <= 0: o.append(sc.line((a[0], a[1], z0 + 1.2), (a[0], a[1], z1 - 1), ZINC_D, 0.45))
    # floor with drain holes
    o.append(sc.poly([(p[0], p[1], z0 + 0.8) for p in ol], FLOOR, INK, 0.7))
    for k in range(1, 8):
        px, py = sc.P(k * 12, R, z0 + 0.8)
        o.append(f'<ellipse cx="{f(px)}" cy="{f(py)}" rx="{f(1.6*sc.s*C30*1.15)}" ry="{f(1.6*sc.s*0.6)}" fill="{INK}"/>')
    # near wall, outside face, with corrugation lines
    CUT = (30.0, 66.0)  # cut-away of the near long side so the floor and holes show
    def cut(a, b): return a[3] > 0.5 and b[3] > 0.5 and min(a[0], b[0]) >= CUT[0] - 1e-6 and max(a[0], b[0]) <= CUT[1] + 1e-6
    for a, b in facets:
        if vis(a, b):
            col = shade((a[2] + b[2]) / 2, (a[3] + b[3]) / 2)
            top = z0 + 3 if cut(a, b) else z1
            o.append(sc.poly([(a[0], a[1], z0), (b[0], b[1], z0), (b[0], b[1], top), (a[0], a[1], top)], col, col, 0.6))
    for i in range(n):
        a = ol[i]
        if a[2] + a[3] > 0 and not (a[3] > 0.5 and CUT[0] < a[0] < CUT[1]): o.append(sc.line((a[0], a[1], z0 + 1.2), (a[0], a[1], z1 - 1.4), ZINC_D, 0.45))
    zz = [(CUT[0] + (CUT[1] - CUT[0]) * k / 12, z0 + 3 + (0.8 if k % 2 else 0)) for k in range(13)]
    o.append(f'<polyline points="{sc.pts([(x, Wd, z) for x, z in zz])}" fill="none" stroke="{INK}" stroke-width="0.9"/>')
    for x in CUT: o.append(sc.line((x, Wd, z0 + 3), (x, Wd, z1), INK, 0.9))
    # silhouette: bottom edge of the near half, end verticals, chime band
    near = [p for p in ol if p[2] + p[3] > -1e-6]
    o.append(f'<polyline points="{sc.pts([(p[0], p[1], z0) for p in near])}" fill="none" stroke="{INK}" stroke-width="0.9"/>')
    o.append(f'<polyline points="{sc.pts([(p[0], p[1], z0 + 1) for p in near])}" fill="none" stroke="{INK}" stroke-width="0.5"/>')
    # factory drain plug on the +x end, low
    px, py = sc.P(L, R, z0 + 1.6)
    o.append(f'<ellipse cx="{f(px)}" cy="{f(py)}" rx="3.2" ry="3.6" fill="#E9ECEA" stroke="{INK}" stroke-width="0.8"/>')
    # rolled rim
    i0 = 7 + 17  # first point of the near straight side
    k0 = next(i for i, p in enumerate(ol) if p[3] > 0.5 and p[0] <= CUT[1] + 1e-6)
    k1 = next(i for i, p in enumerate(ol) if p[3] > 0.5 and p[0] <= CUT[0] + 1e-6)
    rim = [(CUT[0], Wd, z1)] + [(p[0], p[1], z1) for p in ol[k1 + 1:]] + [(p[0], p[1], z1) for p in ol[:k0]] + [(CUT[1], Wd, z1)]
    for w_, c_ in ((3.2, INK), (1.4, "#EEF1EF")):
        o.append(f'<polyline points="{sc.pts(rim)}" fill="none" stroke="{c_}" stroke-width="{w_}" stroke-linejoin="round"/>')
    body += "".join(o)
    # dims
    sc.over = []
    sc.dim((0, Wd, 4), (L, Wd, 4), (0, 14, 0), "8'-0\" NOM.")
    sc.dim((0, R, z0), (0, R, z1), (0, 0, 0), "") if False else None
    body += "".join(sc.over)
    A = [(1, "NEW STOCK TANK, 2×8×2 FT", sc.P(18, Wd, z0 + 12), "L"),
         (2, "FACTORY ROLLED RIM", sc.P(80, Wd, z1), "L"),
         (3, "FACTORY PLUG: REMOVE", sc.P(L, R, z0 + 1.6), "R"),
         (4, "7 HOLES, 1/2 IN, 12 IN O.C.", sc.P(48, R, z0 + 0.8), "R"),
         (6, "BLOCK RAILS, 4×8×16", sc.P(40, 24, 2), "L"),
         (7, "LEVEL, 2 IN STONE DUST", sc.P(88, 30, 0), "R")]
    body += callouts(A, 215, 680, 150, H - 70)
    foot = "STOCK TANK PLANTER · 2 × 8 × 2 FT · NOT TO SCALE · NUMBERS MATCH SHEET B-104 KEYNOTES"
    return frame(W, H, body, "EXPLODED VIEW · BED · STOCK TANK", "How one stock tank sets up",
                 "Drill the floor and set the blocks before you fill it. Filled, it weighs about a ton.", foot)


if __name__ == "__main__":
    import sys, os
    outdir = sys.argv[1] if len(sys.argv) > 1 else "."
    open(os.path.join(outdir, "bed-tank.svg"), "w").write(tank())
