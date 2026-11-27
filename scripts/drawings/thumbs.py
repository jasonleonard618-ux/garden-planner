"""Home page thumbnails: the same drawings with the title and footer dropped and the view cropped."""
import re, sys, os
out = sys.argv[1]
for name, box in (("bed-better", "20 140 890 540"), ("fence-excellent", "40 160 860 560")):
    s = open(os.path.join(out, f"{name}.svg")).read()
    s = re.sub(r'viewBox="[^"]+"', f'viewBox="{box}"', s, count=1)
    w, h = box.split()[2:]
    s = s.replace('width="100%"', f'width="{w}" height="{h}"', 1)
    # drop the eyebrow, title, subtitle and footer (the first three and the last top-level <text>)
    texts = list(re.finditer(r'<text x="28"[^>]*>.*?</text>', s))
    for m in reversed(texts):
        s = s[:m.start()] + s[m.end():]
    s = s.replace('<rect width=', '<rect fill-opacity="0" width=', 1)
    open(os.path.join(out, f"{name}-thumb.svg"), "w").write(s)
