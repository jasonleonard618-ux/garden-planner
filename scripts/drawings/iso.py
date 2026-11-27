"""Small isometric drawing kit for the Build step diagrams (storyboard style: thin ink lines, warm
wood washes, coral numbered callouts in two columns that never overlap the drawing)."""
import math

INK = "#1B1D1A"; SUB = "#3D5F59"; CORAL = "#FF6F47"; CORAL_INK = "#2A0E05"
MONO = "'Geist Mono', ui-monospace, Menlo, monospace"
SERIF = "'Instrument Serif', Georgia, serif"
SANS = "'Geist', 'Helvetica Neue', Arial, sans-serif"
C30 = math.cos(math.radians(30)); S30 = 0.5

WOOD = {"top": "#F3E4C8", "x": "#E2C79C", "y": "#CDAE80", "grain": "#BF9F72"}
CEDAR_STAIN = {"top": "#D9B07E", "x": "#C08D57", "y": "#A9773F", "grain": "#8A5E2E"}
PT = {"top": "#E4E0C6", "x": "#CFCBA9", "y": "#B9B48F", "grain": "#9C9772"}
STEEL = {"top": "#9AA09B", "x": "#5E6560", "y": "#454B47", "grain": "#454B47"}
CONC = {"top": "#E2E1DC", "x": "#CFCDC6", "y": "#BDBBB3", "grain": "#9E9C95"}


def f(v):
    return f"{v:.1f}"


class Scene:
    def __init__(self, s, ox, oy):
        self.s, self.ox, self.oy = s, ox, oy
        self.items = []  # (bbox, svg string)
        self.over = []   # drawn after everything (dims, callout leaders)
        self.under = []  # drawn before everything (ground)

    def P(self, x, y, z):
        return (self.ox + (x - y) * C30 * self.s, self.oy + ((x + y) * S30 - z) * self.s)

    def pts(self, ps):
        return " ".join(f"{f(a)},{f(b)}" for a, b in (self.P(*p) for p in ps))

    def poly(self, ps, fill="none", stroke=INK, sw=0.9, extra=""):
        return f'<polygon points="{self.pts(ps)}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"{extra}/>'

    def line(self, a, b, stroke=INK, sw=0.6, dash=None, extra=""):
        (x1, y1), (x2, y2) = self.P(*a), self.P(*b)
        d = f' stroke-dasharray="{dash}"' if dash else ""
        return f'<line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}" stroke="{stroke}" stroke-width="{sw}" stroke-linecap="round"{d}{extra}/>'

    def box(self, x0, y0, z0, x1, y1, z1, pal=WOOD, grain=None, sw=0.9, faces="xyz", stroke=INK):
        """A prism. grain: 'x' or 'y' draws lengthwise grain lines on the visible faces."""
        out = []
        if "z" in faces:
            out.append(self.poly([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], pal["top"], stroke, sw))
        if "x" in faces:
            out.append(self.poly([(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)], pal["x"], stroke, sw))
        if "y" in faces:
            out.append(self.poly([(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)], pal["y"], stroke, sw))
        if grain:
            h = z1 - z0
            n = max(1, int(h / 3.2))
            for k in range(1, n + 1):
                z = z0 + h * k / (n + 1)
                if grain == "x" and "y" in faces:
                    out.append(self.line((x0 + 2, y1, z), (x1 - 2, y1, z), pal["grain"], 0.45))
                if grain == "y" and "x" in faces:
                    out.append(self.line((x1, y0 + 2, z), (x1, y1 - 2, z), pal["grain"], 0.45))
            if grain == "z":
                w = x1 - x0
                for k in (0.35, 0.7):
                    if "y" in faces:
                        out.append(self.line((x0 + w * k, y1, z0 + 1), (x0 + w * k, y1, z1 - 1), pal["grain"], 0.45))
        self.items.append(((x0, y0, z0, x1, y1, z1), "".join(out)))

    def add(self, bbox, svg):
        self.items.append((bbox, svg))

    def render(self):
        n = len(self.items)
        eps = 0.01
        before = [set() for _ in range(n)]

        def behind(a, b):  # a fully behind b along some axis (viewer at +x +y +z)
            return a[3] <= b[0] + eps or a[4] <= b[1] + eps or a[5] <= b[2] + eps

        for i in range(n):
            for j in range(n):
                if i != j:
                    A, B = self.items[i][0], self.items[j][0]
                    if behind(A, B) and not behind(B, A):
                        before[j].add(i)
        done, order = set(), []

        def visit(i, stack=()):
            if i in done:
                return
            if i in stack:
                return
            for k in sorted(before[i]):
                visit(k, stack + (i,))
            done.add(i); order.append(i)

        for i in range(n):
            visit(i)
        return "".join(self.under) + "".join(self.items[i][1] for i in order) + "".join(self.over)

    # ----- annotation -----
    def dim(self, a, b, off, text, side=1):
        """Dimension along a-b, offset by vector off (world), text centered and rotated along the line."""
        A = tuple(a[i] + off[i] for i in range(3)); B = tuple(b[i] + off[i] for i in range(3))
        (x1, y1), (x2, y2) = self.P(*A), self.P(*B)
        ang = math.degrees(math.atan2(y2 - y1, x2 - x1))
        if ang > 90: ang -= 180
        if ang < -90: ang += 180
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        o = []
        o.append(self.line(a, A, "#6B6F68", 0.5)); o.append(self.line(b, B, "#6B6F68", 0.5))
        o.append(f'<line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}" stroke="{INK}" stroke-width="0.6"/>')
        for (px, py) in ((x1, y1), (x2, y2)):
            o.append(f'<line x1="{f(px-4)}" y1="{f(py+4)}" x2="{f(px+4)}" y2="{f(py-4)}" stroke="{INK}" stroke-width="0.9"/>')
        w = len(text) * 6.4 + 8
        o.append(f'<g transform="translate({f(mx)},{f(my)}) rotate({f(ang)})"><rect x="{f(-w/2)}" y="-7" width="{f(w)}" height="14" fill="#F7F5EF"/>'
                 f'<text x="0" y="3.6" text-anchor="middle" font-family="{MONO}" font-size="10" fill="{INK}">{text}</text></g>')
        self.over.append("".join(o))


def callouts(anchors, left_x, right_x, top, bottom, min_gap=30):
    """anchors: list of (n, label, (sx, sy), side). Places labels in two columns with no overlaps;
    returns svg. Leaders run from the numbered dot to the anchor point."""
    out = []
    for side in ("L", "R"):
        group = sorted([a for a in anchors if a[3] == side], key=lambda a: a[2][1])
        ys = []
        for a in group:
            y = max(a[2][1], top)
            if ys and y < ys[-1] + min_gap:
                y = ys[-1] + min_gap
            ys.append(y)
        # push up from the bottom if needed
        for i in range(len(ys) - 1, -1, -1):
            lim = bottom if i == len(ys) - 1 else ys[i + 1] - min_gap
            if ys[i] > lim:
                ys[i] = lim
        for a, y in zip(group, ys):
            n, label, (ax, ay), _ = a
            cx = left_x if side == "L" else right_x
            out.append(f'<polyline points="{f(cx + (10 if side == "L" else -10))},{f(y)} {f(ax)},{f(ay)}" fill="none" stroke="{INK}" stroke-width="0.7"/>')
            out.append(f'<circle cx="{f(ax)}" cy="{f(ay)}" r="2.2" fill="{INK}"/>')
            out.append(f'<circle cx="{f(cx)}" cy="{f(y)}" r="10" fill="{CORAL}"/>')
            out.append(f'<text x="{f(cx)}" y="{f(y+4)}" text-anchor="middle" font-family="{MONO}" font-size="11" fill="{CORAL_INK}">{n}</text>')
            if side == "L":
                out.append(f'<text x="{f(cx-16)}" y="{f(y+4)}" text-anchor="end" font-family="{MONO}" font-size="10.5" letter-spacing="0.06em" fill="{INK}">{label}</text>')
            else:
                out.append(f'<text x="{f(cx+16)}" y="{f(y+4)}" text-anchor="start" font-family="{MONO}" font-size="10.5" letter-spacing="0.06em" fill="{INK}">{label}</text>')
    return "".join(out)


def frame(w, h, body, eyebrow, title, sub, foot):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="100%" role="img" aria-label="{title}">'
            f'<defs><radialGradient id="wash" cx="50%" cy="48%" r="62%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.85"/>'
            f'<stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient></defs>'
            f'<rect width="{w}" height="{h}" fill="url(#wash)"/>'
            f'<text x="28" y="36" font-family="{MONO}" font-size="10.5" letter-spacing="0.1em" fill="{SUB}">{eyebrow}</text>'
            f'<text x="28" y="68" font-family="{SERIF}" font-size="30" fill="{INK}">{title}</text>'
            f'<text x="28" y="88" font-family="{SANS}" font-size="12" fill="{SUB}">{sub}</text>'
            f'{body}'
            f'<text x="28" y="{h-20}" font-family="{MONO}" font-size="10" letter-spacing="0.08em" fill="{SUB}">{foot}</text></svg>')
