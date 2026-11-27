"""Cut-away isometric of one fence bay per level, matching construction sheets F-101..F-104.
The ground is cut open along the right-hand post so post depth, footing and apron show.
Outside of the garden is toward the viewer (+y). Callout numbers are the sheet keynote numbers."""
from iso import *

def ftin(i):
    i = round(i)
    return f"{i // 12}'-{i % 12}\"" if i >= 12 else f'{i}"'

TIERS = {
    "good": dict(name="GOOD", sheet="F-101", post="t", above=30, embed=18, bay=96, apron=12, mesh=[("hex", 0, 24)], floppy=0),
    "better": dict(name="BETTER", sheet="F-102", post="t", above=48, embed=24, bay=96, apron=24, mesh=[("weld", 0, 48)], floppy=18),
    "best": dict(name="BEST", sheet="F-103", post="pt", above=96, embed=24, bay=96, apron=12, mesh=[("deer", 0, 96), ("hex", 0, 24)], floppy=0),
    "excellent": dict(name="EXCELLENT", sheet="F-104", post="cedar", above=96, embed=36, bay=72, apron=12, mesh=[], floppy=0),
}


def mesh(sc, x0, x1, y, z0, z1, kind):
    o = []
    sp = {"hex": (2, 2, "#4C5A4A", 0.4), "weld": (2, 4, "#2E3430", 0.55), "deer": (2.5, 2.5, "#4C5A4A", 0.35), "cattle": (6, 4, "#2E3430", 0.8)}[kind]
    dx, dz, col, w = sp
    x = x0
    while x <= x1 + 0.01:
        o.append(sc.line((x, y, z0), (x, y, z1), col, w))
        x += dx
    z = z0
    while z <= z1 + 0.01:
        o.append(sc.line((x0, y, z), (x1, y, z), col, w))
        z += dz
    return "".join(o)


def fence(tier):
    t = TIERS[tier]
    W, H = 900, 760
    L, A, E = t["bay"], t["above"], t["embed"]
    foot = 6 if tier == "excellent" else 0
    depth = E + foot + 8
    top = A + (15 if t["floppy"] or tier == "excellent" else 0)
    s = min(4.2, 470 / (top + depth + (L + 40) * 0.5))
    sc = Scene(s, 0, 0)
    cx, cy = sc.P(L / 2, 0, (top - depth) / 2)
    sc.ox, sc.oy = W / 2 - cx - 10, 420 - cy
    gy0, gy1, gx0 = -26, 34, -16
    zb = -depth
    g = []
    # ground top: garden side plain, outside side with apron
    g.append(sc.poly([(gx0, gy0, 0), (L, gy0, 0), (L, gy1, 0), (gx0, gy1, 0)], "#E3EAD3", INK, 0.9))
    # front face (+y) hatched
    g.append(sc.poly([(gx0, gy1, zb), (L, gy1, zb), (L, gy1, 0), (gx0, gy1, 0)], "#FFFFFF", INK, 0.9))
    n = int((L - gx0) / 2.2)
    for k in range(1, n):
        x = gx0 + (L - gx0) * k / n
        g.append(sc.line((x, gy1, zb + 0.6), (x, gy1, -0.6), "#8D918C", 0.45))
    # section face (+x) with earth hatch
    g.append(sc.poly([(L, gy0, zb), (L, gy1, zb), (L, gy1, 0), (L, gy0, 0)], "#F1E6D2", INK, 1.2))
    for k in range(-30, 40):
        y = gy0 + k * 3.2
        a = (L, max(gy0, y), max(zb, -(max(gy0, y) - y) - 0) )
        # 45-degree hatch within the face: from (y, 0) down-left
        y1, z1 = y, 0.0
        y2, z2 = y - (depth), zb
        if y2 < gy0:
            z2 = -(y1 - gy0); y2 = gy0
        if y1 > gy1:
            z1 = -(y1 - gy1); y1 = gy1
        if z1 > zb and y1 > gy0:
            g.append(sc.line((L, y1, z1), (L, y2, max(z2, zb)), "#C9B48F", 0.5))
    # labels on the ground
    for (txt, y) in (("GARDEN", -15), ("OUTSIDE", gy1 - 5)):
        px, py = sc.P(L * 0.25, y, 0)
        g.append(f'<text x="{f(px)}" y="{f(py)}" transform="rotate(30 {f(px)} {f(py)})" text-anchor="middle" font-family="{MONO}" font-size="10" letter-spacing="0.12em" fill="{SUB}">{txt}</text>')
    sc.under.append("".join(g))
    over_sec = []
    # ----- posts -----
    pal = {"t": STEEL, "pt": PT, "cedar": WOOD}[t["post"]]
    pw = 1.4 if t["post"] == "t" else 3.5
    ytop = pw / 2
    for x in (0, L):
        sc.box(x - pw / 2, -pw / 2, 0, x + pw / 2, pw / 2, A + (12 if tier == "excellent" else 0), pal, "z" if t["post"] != "t" else None, 0.8)
    # post below grade, on the section face (right post is cut in half)
    sec = []
    if tier == "excellent":
        sec.append(sc.poly([(L, -5, -E), (L, 5, -E), (L, 5, 1.5), (L, -5, 1.5)], "#D9D7D0", INK, 0.9))
        for i in range(60):
            import random
        rnd = __import__("random").Random(7)
        for _ in range(70):
            yy, zz = rnd.uniform(-4.4, 4.4), rnd.uniform(-E + 1, 0.5)
            px, py = sc.P(L, yy, zz)
            sec.append(f'<circle cx="{f(px)}" cy="{f(py)}" r="0.8" fill="#9E9C95"/>')
        sec.append(sc.poly([(L, -6, -E - 6), (L, 6, -E - 6), (L, 6, -E), (L, -6, -E)], "#E6E0D2", INK, 0.8))
        for _ in range(40):
            yy, zz = rnd.uniform(-5.5, 5.5), rnd.uniform(-E - 5.5, -E - 0.5)
            px, py = sc.P(L, yy, zz)
            sec.append(f'<circle cx="{f(px)}" cy="{f(py)}" r="1.1" fill="none" stroke="#8D918C" stroke-width="0.5"/>')
        sec.append(sc.poly([(L, -1.75, -E - 2), (L, 1.75, -E - 2), (L, 1.75, 0), (L, -1.75, 0)], WOOD["x"], INK, 0.9))
    elif t["post"] == "pt":
        sec.append(sc.poly([(L, -1.75, -E), (L, 1.75, -E), (L, 1.75, 0), (L, -1.75, 0)], PT["x"], INK, 0.9))
    else:
        sec.append(sc.poly([(L, -0.7, -E), (L, 0.7, -E), (L, 0.7, 0), (L, -0.7, 0)], STEEL["x"], INK, 0.9))
        sec.append(sc.poly([(L, -3, -E + 8), (L, 3, -E + 8), (L, 3, -E + 4), (L, -3, -E + 4)], STEEL["top"], INK, 0.7))
    # apron in section: laid flat outside
    sec.append(sc.line((L, 0.9, 0.3), (L, t["apron"], 0.3), "#1B1D1A", 1.4))
    sc.under.append("".join(sec))
    # ----- apron on the ground (outside) -----
    ap = t["apron"]
    sc.add((0, pw / 2, 0, L, ap, 0.1), sc.poly([(0, pw / 2, 0), (L, pw / 2, 0), (L, ap, 0), (0, ap, 0)], "rgba(76,90,74,0.10)", "#4C5A4A", 0.6) + mesh_flat(sc, 0, L, pw / 2, ap))
    # ----- infill -----
    fy = ytop + 0.05
    for kind, za, zbm in t["mesh"]:
        sc.add((0, fy, za, L, fy + 0.05 + (0.02 if kind == "hex" else 0), zbm), mesh(sc, 0, L, fy + (0.05 if kind == "hex" else 0), za, zbm, kind))
    if t["floppy"]:
        F = t["floppy"]
        o = sc.poly([(0, fy, A), (L, fy, A), (L, fy + 10, A + 15), (0, fy + 10, A + 15)], "rgba(255,255,255,0.35)", "#4C5A4A", 0.6)
        for k in range(0, 13):
            u = k / 12
            o += sc.line((0, fy + 10 * u, A + 15 * u), (L, fy + 10 * u, A + 15 * u), "#4C5A4A", 0.4)
        for k in range(0, int(L / 3) + 1):
            o += sc.line((k * 3, fy, A), (k * 3, fy + 10, A + 15), "#4C5A4A", 0.4)
        sc.add((0, fy, A, L, fy + 10, A + 15), o)
    if tier == "best":
        sc.add((0, fy, A - 0.5, L, fy + 0.1, A), sc.line((0, fy, A - 0.3), (L, fy, A - 0.3), INK, 1.2))
    if tier == "excellent":
        x0, x1 = 1.75, L - 1.75
        sc.box(x0, -0.75, -1, x1, 0.75, 6.25, WOOD, "x")                     # kickboard 2x8
        sc.box(x0, -1.75, 6.25, x1, 1.75, 7.75, WOOD, None)                  # bottom rail
        sc.add((x0, -0.01, 7.75, x1, 0.01, 57.75), mesh(sc, x0, x1, 0, 7.75, 57.75, "cattle"))
        for xx in (x0, x1 - 3.5):
            sc.box(xx, -0.75, 7.75, xx + 3.5, 0.75, 57.75, WOOD, "z")        # frame stiles
        sc.box(x0, -1.75, 57.75, x1, 1.75, 59.25, WOOD, None)                # top rail
        for zz in (66, 80, 94):
            sc.add((0, 1.76, zz, L, 1.8, zz + 0.1), sc.line((0, 1.78, zz), (L, 1.78, zz), INK, 0.9))
        # pergola: doubled 2x8 beam on both post faces, top flush with posts at 108; 2x4 rafter tails at 16 in
        for y0 in (-3.25, 1.75):
            sc.box(-12, y0, 100.75, L + 12, y0 + 1.5, 108, WOOD, "x")
        xx = -8
        while xx <= L + 8:
            sc.box(xx - 0.75, -12, 108, xx + 0.75, 12, 111.5, WOOD, None)
            xx += 16
    body = sc.render()
    # ----- dimensions -----
    d = Scene(s, sc.ox, sc.oy)
    d.dim((L, 0, 0), (L, 0, A), (14, 0, 0), ftin(A))
    d.dim((L, gy1, -E - foot), (L, gy1, 0), (0, 10, 0), ftin(E + foot) if tier != "excellent" else "36\" MIN")
    d.dim((0, pw / 2, 0), (0, ap, 0), (-12, 0, 0), ftin(ap))
    if tier == "excellent":
        d.dim((L, 0, 0), (L, 0, 108), (30, 0, 0), "9 FT POST")
    zt = A + (32 if tier == "excellent" else 0)
    d.dim((0, 0, zt), (L, 0, zt), (0, 0, 10), ftin(L) + " O.C.")
    body += "".join(d.over)
    # ----- callouts -----
    P = sc.P
    C = []
    postname = {"t": "STEEL T-POST", "pt": "4×4 TREATED POST", "cedar": "4×4 CEDAR POST"}[t["post"]]
    C.append((1, postname, P(0, ytop, A * 0.75), "L"))
    C.append((2, f"{ftin(E)} MIN IN GROUND" if tier != "excellent" else "SET IN CONCRETE", P(L, 0, -E * 0.55), "R"))
    C.append((3, f"{ap} IN APRON, PINNED", P(L * 0.35, ap * 0.6, 0), "L"))
    if tier == "good":
        C.append((4, "1 IN HEX MESH", P(L * 0.55, fy, 16), "R"))
    if tier == "better":
        C.append((4, "48 IN WELDED WIRE", P(L * 0.55, fy, 30), "R"))
        C.append((5, "18 IN FLOPPY TOP", P(L * 0.6, fy + 6, A + 9), "R"))
    if tier == "best":
        C.append((4, "8 FT DEER MESH", P(L * 0.55, fy, 70), "R"))
        C.append((5, "24 IN HEX MESH BASE", P(L * 0.4, fy, 14), "L"))
    if tier == "excellent":
        C.append((4, "CATTLE PANEL IN 2×4 FRAME", P(L * 0.5, 0, 34), "R"))
        C.append((5, "2×8 KICKBOARD", P(L * 0.3, 0.75, 3), "L"))
        C.append((8, "DEER WIRES 66, 80, 94 IN", P(L * 0.6, 1.78, 80), "R"))
        C.append((16, "2×4 TOP RAIL", P(L * 0.35, 1.75, 58.5), "L"))
        C.append((9, "6 IN GRAVEL BASE", P(L, 0, -E - 3), "R"))
        C.append((10, "DOUBLED 2×8 PERGOLA BEAM", P(L * 0.3, 3.25, 104), "L"))
        C.append((11, "2×4 RAFTER TAILS, 16 IN O.C.", P(L * 0.55, 6, 111.5), "R"))
    body += callouts(C, 205, 680, 130, H - 60)
    note = "BAY · " + ("6 FT" if tier == "excellent" else "8 FT")
    return frame(W, H, body, f"CUT-AWAY · FENCE · {t['name']}", "How the fence meets the ground",
                 "The ground is cut open on the right so you can see the post depth and the apron.",
                 f"CRITTER FENCE · ONE {note} · NOT TO SCALE · NUMBERS MATCH SHEET {t['sheet']} KEYNOTES")


def mesh_flat(sc, x0, x1, y0, y1):
    o = []
    x = x0
    while x <= x1:
        o.append(sc.line((x, y0, 0.05), (x, y1, 0.05), "#4C5A4A", 0.35)); x += 2
    y = y0
    while y <= y1:
        o.append(sc.line((x0, y, 0.05), (x1, y, 0.05), "#4C5A4A", 0.35)); y += 2
    return "".join(o)


if __name__ == "__main__":
    import sys, os
    outdir = sys.argv[1] if len(sys.argv) > 1 else "."
    for k in TIERS:
        open(os.path.join(outdir, f"fence-{k}.svg"), "w").write(fence(k))
