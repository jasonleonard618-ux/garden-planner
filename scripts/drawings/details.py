"""2D details in the same style: Excellent gate elevation (sheet F-501) and post footing (F-104 detail 6)."""
import random
from iso import INK, SUB, CORAL, MONO, frame, callouts, f, WOOD

def R(x, y, w, h, fill, sw=0.9, extra=""):
    return f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" fill="{fill}" stroke="{INK}" stroke-width="{sw}"{extra}/>'

def Lr(x1, y1, x2, y2, c=INK, w=0.7, dash=None):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    return f'<line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}" stroke="{c}" stroke-width="{w}"{d}/>'

def vdim(x, y1, y2, text, m=None):
    m = (y1 + y2) / 2 if m is None else m; w = len(text) * 6.4 + 8
    return (Lr(x, y1, x, y2, INK, 0.6) + Lr(x - 4, y1 + 4, x + 4, y1 - 4, INK, 0.9) + Lr(x - 4, y2 + 4, x + 4, y2 - 4, INK, 0.9) +
            f'<g transform="translate({f(x)},{f(m)}) rotate(-90)"><rect x="{f(-w/2)}" y="-7" width="{f(w)}" height="14" fill="#F7F5EF"/><text y="3.6" text-anchor="middle" font-family="{MONO}" font-size="10" fill="{INK}">{text}</text></g>')

def hdim(y, x1, x2, text):
    m = (x1 + x2) / 2; w = len(text) * 6.4 + 8
    return (Lr(x1, y, x2, y, INK, 0.6) + Lr(x1 - 4, y + 4, x1 + 4, y - 4, INK, 0.9) + Lr(x2 - 4, y + 4, x2 + 4, y - 4, INK, 0.9) +
            f'<rect x="{f(m-w/2)}" y="{f(y-7)}" width="{f(w)}" height="14" fill="#F7F5EF"/><text x="{f(m)}" y="{f(y+3.6)}" text-anchor="middle" font-family="{MONO}" font-size="10" fill="{INK}">{text}</text>')

def earth(x0, y0, x1, y1):
    o = [f'<rect x="{f(x0)}" y="{f(y0)}" width="{f(x1-x0)}" height="{f(y1-y0)}" fill="#F1E6D2"/>']
    k = x0 - (y1 - y0)
    while k < x1:
        a, b = max(k, x0), min(k + (y1 - y0), x1)
        o.append(Lr(a, y0 + (a - k), b, y0 + (b - k), "#C9B48F", 0.5)); k += 7
    return "".join(o)


def gate():
    W, H = 900, 960
    s = 5.2
    gx = 300  # inside face of hinge post
    g0 = 730  # grade y
    Y = lambda z: g0 - z * s
    X = lambda x: gx + x * s
    o = []
    o.append(earth(X(-20), g0, X(70), g0 + 34 * s * 0 + 120))
    o.append(Lr(X(-30), g0, X(78), g0, INK, 1.2))
    # piers (break below)
    for x in (-3.5 - 3.25, 48 - 3.25 + 0):
        pass
    for px in (-3.5, 48):
        o.append(R(X(px - 3.25), g0 - 1.5 * s, 10 * s, 120 + 1.5 * s, "#D9D7D0", 0.8))
    o.append(Lr(X(-25), g0 + 118, X(75), g0 + 118, "#6B6F68", 0.6, "6 4"))
    # sill and cloth under it
    o.append(R(X(0), g0, 48 * s, 5.5 * s, "#C9B48F"))
    o.append(Lr(X(0), g0 + 5.5 * s + 3, X(48), g0 + 5.5 * s + 3, INK, 0.8, "4 3"))
    # posts
    for px in (-3.5, 48):
        o.append(R(X(px), Y(108), 3.5 * s, 108 * s, WOOD["x"]))
        o.append(Lr(X(px + 1.2), Y(94), X(px + 1.2), Y(2), WOOD["grain"], 0.45))
    # doubled header 2x8, top at 90
    o.append(R(X(-3.5), Y(90), 55 * s, 7.25 * s, WOOD["top"]))
    # pergola beam (doubled 2x8, top flush with posts at 108) and 2x4 rafter tail ends at 16 in
    o.append(R(X(-14), Y(108), 79 * s, 7.25 * s, WOOD["top"]))
    for rx in (-8, 8, 24, 40, 56):
        o.append(R(X(rx - 0.75), Y(111.5), 1.5 * s, 3.5 * s, WOOD["x"]))
    # deer wire at 81
    o.append(Lr(X(0), Y(81), X(48), Y(81), INK, 1.0))
    # gate frame 47 x 72, bottom 1 in above sill
    fx0, fx1, fz0, fz1 = 0.5, 47.5, 1, 73
    o.append(f'<rect x="{f(X(fx0))}" y="{f(Y(fz1))}" width="{f((fx1-fx0)*s)}" height="{f((fz1-fz0)*s)}" fill="none"/>')
    # infill: cattle panel 4x4 and hardware cloth bottom 24
    x = fx0 + 3.5
    while x < fx1 - 3.5:
        o.append(Lr(X(x), Y(fz1 - 3.5), X(x), Y(fz0 + 3.5), "#2E3430", 0.6)); x += 4
    z = fz0 + 3.5
    while z < fz1 - 3.5:
        o.append(Lr(X(fx0 + 3.5), Y(z), X(fx1 - 3.5), Y(z), "#2E3430", 0.6)); z += 4
    x = fx0 + 3.5
    while x < fx1 - 3.5:
        o.append(Lr(X(x), Y(25), X(x), Y(fz0 + 3.5), "#8D918C", 0.35)); x += 1
    o.append(f'<rect x="{f(X(fx0+3.5))}" y="{f(Y(25))}" width="{f((fx1-fx0-7)*s)}" height="{f((24-3.5)*s)}" fill="rgba(141,145,140,0.18)"/>')
    # frame members
    for (a, b, c, d) in ((fx0, fz0, fx1, fz0 + 3.5), (fx0, fz1 - 3.5, fx1, fz1), (fx0, fz0, fx0 + 3.5, fz1), (fx1 - 3.5, fz0, fx1, fz1), (fx0 + 3.5, 23.25, fx1 - 3.5, 26.75)):
        o.append(R(X(a), Y(d), (c - a) * s, (d - b) * s, WOOD["top"]))
    # brace: bottom hinge corner (left, low) up to top latch corner (right, high), lower and upper panels
    for (z0, z1) in ((fz0 + 3.5, 23.25), (26.75, fz1 - 3.5)):
        x0, x1 = fx0 + 3.5, fx1 - 3.5
        o.append(f'<polygon points="{f(X(x0))},{f(Y(z0))} {f(X(x0+5))},{f(Y(z0))} {f(X(x1))},{f(Y(z1-5))} {f(X(x1))},{f(Y(z1))} {f(X(x1-5))},{f(Y(z1))} {f(X(x0))},{f(Y(z0+5))}" fill="{WOOD["top"]}" stroke="{INK}" stroke-width="0.9" stroke-linejoin="round"/>')
    # anti-sag cable: top hinge corner to bottom latch corner
    o.append(Lr(X(fx0 + 2), Y(fz1 - 2), X(fx1 - 2), Y(fz0 + 2), "#6B6F68", 0.8, "2 2"))
    # hinges at each rail
    for z in (fz0 + 1.75, 25, fz1 - 1.75):
        o.append(f'<rect x="{f(X(-3))}" y="{f(Y(z)-3)}" width="{f(15*s)}" height="6" rx="3" fill="{INK}"/>')
        o.append(f'<circle cx="{f(X(-1.6))}" cy="{f(Y(z))}" r="1.6" fill="#FFFFFF"/>')
    # latch at 40 and stop strip on latch post
    o.append(f'<rect x="{f(X(41))}" y="{f(Y(40)-2.5)}" width="{f(8*s)}" height="5" fill="{INK}"/>')
    o.append(f'<rect x="{f(X(47.9))}" y="{f(Y(40)-5)}" width="{f(1.6*s)}" height="10" fill="{INK}"/>')
    o.append(R(X(47.6), Y(fz1), 0.6 * s, (fz1 - fz0) * s, "#BF9F72", 0.6))
    # dims
    o.append(hdim(g0 + 140, X(0), X(48), '4\'-0" CLEAR'))
    o.append(vdim(X(64), Y(90), g0, '7\'-6"'))
    o.append(vdim(X(72), Y(108), g0, '9\'-0"', Y(70)))
    o.append(vdim(X(58), Y(81), g0, '6\'-9"'))
    o.append(vdim(X(-14), Y(40), g0, '3\'-4"'))
    A = [
        (19, "PERGOLA BEAM, SEE F-104", (X(20), Y(104.4)), "R"),
        (2, "DOUBLED 2×8 HEADER", (X(10), Y(86.4)), "L"),
        (1, "4×4 CEDAR GATE POST", (X(-1.75), Y(60)), "L"),
        (7, "STRAP HINGES (3)", (X(6), Y(fz1 - 1.75)), "L"),
        (5, "2×4 BRACE", (X(14), Y(9)), "L"),
        (4, "MID RAIL AT 24 IN", (X(12), Y(25)), "L"),
        (3, "2×4 FRAME, HALF-LAP", (X(fx0 + 1.75), Y(36)), "L"),
        (11, "2×6 SILL, FLUSH", (X(8), g0 + 3 * s), "L"),
        (13, "DEER WIRE", (X(30), Y(81)), "R"),
        (6, "CATTLE PANEL INFILL", (X(30), Y(55)), "R"),
        (10, "ANTI-SAG CABLE", (X(38), Y(19.8)), "R"),
        (8, "GRAVITY LATCH", (X(44), Y(40)), "R"),
        (9, "GATE STOP", (X(48.7), Y(44)), "R"),
        (6, "½ IN CLOTH, LOW 24 IN", (X(24), Y(12)), "R"),
        (12, "CLOTH UNDER SILL", (X(40), g0 + 5.5 * s + 3), "R"),
    ]
    body = "".join(o) + callouts(A, 170, 690, 130, H - 100, 32)
    return frame(W, H, body, "GATE ELEVATION · EXCELLENT FENCE", "A gate that won't sag",
                 "Seen from outside the garden. Hinges are on the left; the brace pushes the gate into them.",
                 "GARDEN GATE · 4 FT WALK-THROUGH · NOT TO SCALE · NUMBERS MATCH SHEET F-501 KEYNOTES")


def footing():
    W, H = 900, 760
    s = 7.0
    cx, g0 = 450, 350
    Y = lambda z: g0 - z * s
    X = lambda x: cx + x * s
    D = 36  # frost depth or 36 in min
    o = []
    o.append(earth(X(-17), g0, X(17), Y(-D - 10)))
    o.append(f'<rect x="{f(X(-6.5))}" y="{f(g0)}" width="{f(13*s)}" height="{f((D+6)*s)}" fill="#F1E6D2"/>')
    # gravel base 6 in
    rnd = random.Random(3)
    o.append(R(X(-5), Y(-D), 10 * s, 6 * s, "#E6E0D2", 0.8))
    for _ in range(70):
        o.append(f'<circle cx="{f(X(rnd.uniform(-4.5, 4.5)))}" cy="{f(Y(rnd.uniform(-D - 5.6, -D - 0.4)))}" r="{f(rnd.uniform(1.2, 2.4))}" fill="none" stroke="#8D918C" stroke-width="0.5"/>')
    # concrete 10 in dia, crowned 1.5 in above grade
    o.append(f'<path d="M{f(X(-5))},{f(Y(-D))} L{f(X(-5))},{f(g0)} Q{f(X(0))},{f(Y(3))} {f(X(5))},{f(g0)} L{f(X(5))},{f(Y(-D))} Z" fill="#D9D7D0" stroke="{INK}" stroke-width="1"/>')
    for _ in range(110):
        o.append(f'<circle cx="{f(X(rnd.uniform(-4.6, 4.6)))}" cy="{f(Y(rnd.uniform(-D + 0.5, 0)))}" r="0.9" fill="#9E9C95"/>')
    # post: bottom 2 in into the gravel
    o.append(R(X(-1.75), Y(26), 3.5 * s, (26 + D + 2) * s, WOOD["x"]))
    for k in (-0.7, 0.6):
        o.append(Lr(X(k), Y(24), X(k), Y(-D - 1), WOOD["grain"], 0.45))
    o.append(f'<path d="M{f(X(-2.6))},{f(Y(26))} l{f(1.4*s)},-6 l{f(1.2*s)},10 l{f(1.2*s)},-8 l{f(1.6*s)},4" fill="none" stroke="{INK}" stroke-width="0.9"/>')
    # grade
    o.append(Lr(X(-20), g0, X(20), g0, INK, 1.2))
    for k in range(-19, 20, 3):
        if abs(k) > 6:
            o.append(f'<path d="M{f(X(k)-2)},{f(g0)} l1.2,-4 M{f(X(k))},{f(g0)} l0,-5 M{f(X(k)+2)},{f(g0)} l-1.2,-4" stroke="#7E9465" stroke-width="0.6" fill="none"/>')
    o.append(Lr(X(-20), Y(-D), X(20), Y(-D), "#2F6B9A", 0.8, "6 4"))
    o.append(vdim(X(-24), g0, Y(-D), '36" MIN'))
    o.append(vdim(X(-29), Y(1.5), Y(-D - 6), '3\'-7 1/2"'))
    o.append(hdim(Y(-D - 13), X(-5), X(5), '10" DIA'))
    A = [
        (17, "4×4 CEDAR POST", (X(0.4), Y(18)), "R"),
        (20, "CROWN 1½ IN, SHEDS WATER", (X(3.2), Y(0.8)), "R"),
        (18, "CONCRETE, 10 IN HOLE", (X(3.8), Y(-16)), "R"),
        (0, "FROST DEPTH OR 36 IN, DEEPER", (X(14), Y(-D)), "R"),
        (17, "POST END 2 IN INTO GRAVEL", (X(0), Y(-D - 1.2)), "R"),
        (19, "6 IN COMPACTED GRAVEL", (X(-3.5), Y(-D - 4)), "R"),
    ]
    A = [a for a in A if a[0] != 0]
    o.append(f'<rect x="{f(X(-16.2))}" y="{f(Y(-D)-15)}" width="74" height="12" fill="#F1E6D2"/><text x="{f(X(-16))}" y="{f(Y(-D)-5)}" font-family="{MONO}" font-size="10" letter-spacing="0.06em" fill="#2F6B9A">FROST LINE</text>')
    body = "".join(o) + callouts(A, 210, 700, 140, H - 70, 34)
    return frame(W, H, body, "POST FOOTING · EXCELLENT FENCE", "A post footing frost can't lift",
                 "Section through one post. Set the bottom at your local frost depth or 36 in, whichever is deeper; your building department knows the number.",
                 "FENCE POST FOOTING · NOT TO SCALE · NUMBERS MATCH SHEET F-104, DETAIL 6")


if __name__ == "__main__":
    import sys, os
    outdir = sys.argv[1] if len(sys.argv) > 1 else "."
    open(os.path.join(outdir, "gate-excellent.svg"), "w").write(gate())
    open(os.path.join(outdir, "footing-excellent.svg"), "w").write(footing())
