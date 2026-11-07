"""Dev-only: one contact sheet comparing the live build with the Phase 1 style options.

usage: python dev/conquest-style/contact-sheet.py [--options current,a,b,c] [--root docs/conquest-graphics/phase1] [--out sheet.jpg]
Per subject: a column per option with the 390-portrait HIGH shot large, and under it 390 LOW plus
1280 desktop HIGH and LOW thumbnails. Header rows carry each option's name, summary and measured budget.
Measurements come from each option's stats.json (Chromium SwiftShader software GL; relative only).
"""
import argparse, json, pathlib
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[2]
SUBJECTS = [('refuge', 'REFUGE AREA'), ('raid', 'RAID SITE · WESTERN DUST SWITCHBACK'), ('tank', 'PLAYER TANK'), ('enemy', 'ENEMY · RAIDER'), ('props', 'PROP SET'), ('map', 'REGION MAP SCREEN')]
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
FONT_REG = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
COL, GAP, PAD = 300, 14, 20
BIG = (COL, int(COL * 844 / 390))          # 390 portrait HIGH
SMALL_P = (COL // 2 - 4, int((COL // 2 - 4) * 844 / 390))  # 390 LOW
SMALL_D = (COL // 2 - 4, int((COL // 2 - 4) * 800 / 1280))  # desktop thumbs


def font(size, bold=True):
    return ImageFont.truetype(FONT if bold else FONT_REG, size)


def load(path, size):
    if path.exists():
        return Image.open(path).convert('RGB').resize(size, Image.LANCZOS)
    im = Image.new('RGB', size, (40, 14, 18))
    ImageDraw.Draw(im).text((8, 8), 'missing', fill=(255, 150, 140), font=font(14))
    return im


def wrap(draw, text, width, fnt):
    words, lines, line = text.split(), [], ''
    for w in words:
        test = (line + ' ' + w).strip()
        if draw.textlength(test, font=fnt) <= width:
            line = test
        else:
            lines.append(line)
            line = w
    if line:
        lines.append(line)
    return lines


def budget(stats):
    out = {}
    for q in ('high', 'low'):
        rows = [r for r in stats.get('results', []) if r.get('quality') == q and 'drawCalls' in r]
        if rows:
            out[q] = (max(r['drawCalls'] for r in rows), max(r['triangles'] for r in rows), max(r.get('textureMB', 0) for r in rows), max(r.get('programs', 0) for r in rows))
    maps = [r for r in stats.get('results', []) if r.get('subject') == 'map' and 'mapRepaintMs' in r]
    if maps:
        out['map'] = max(r['mapRepaintMs'] for r in maps)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--options', default='current,a,b,c')
    ap.add_argument('--root', default=str(ROOT / 'docs/conquest-graphics/phase1'))
    ap.add_argument('--out', default=str(ROOT / 'docs/conquest-graphics/phase1/contact-sheet.jpg'))
    a = ap.parse_args()
    base = pathlib.Path(a.root)
    options = a.options.split(',')
    meta = {}
    for o in options:
        m = base / o / 'option.json'
        st = base / o / 'stats.json'
        meta[o] = {**(json.loads(m.read_text()) if m.exists() else {'name': o.upper(), 'summary': ''}), 'budget': budget(json.loads(st.read_text())) if st.exists() else {}}
    width = PAD * 2 + 150 + len(options) * (COL + GAP)
    header_h = 330
    block_h = 44 + BIG[1] + 8 + SMALL_P[1] + 16
    sheet = Image.new('RGB', (width, header_h + len(SUBJECTS) * block_h + PAD), (7, 10, 15))
    d = ImageDraw.Draw(sheet)
    d.text((PAD, PAD), 'LUNAR CONQUEST · GRAPHICS OVERHAUL · PHASE 1 STYLE OPTIONS', fill=(232, 214, 170), font=font(28))
    d.text((PAD, PAD + 40), 'Same terrain, footprints, tank kit and camera in every column. Big: 390×844 portrait HIGH. Small: 390 LOW · desktop 1280×800 HIGH (top) / LOW (bottom).', fill=(170, 186, 200), font=font(15, False))
    d.text((PAD, PAD + 62), 'Budgets are worst-case per option across subjects (draw calls · triangles · texture MB · shader programs), measured in Chromium SwiftShader — relative, not iPhone FPS.', fill=(140, 156, 170), font=font(13, False))
    x0 = PAD + 150
    for i, o in enumerate(options):
        x = x0 + i * (COL + GAP)
        m = meta[o]
        d.text((x, PAD + 96), m.get('name', o), fill=(255, 255, 255), font=font(19))
        y = PAD + 124
        for line in wrap(d, m.get('summary', ''), COL, font(13, False))[:7]:
            d.text((x, y), line, fill=(184, 198, 210), font=font(13, False))
            y += 17
        b = m['budget']
        for q, color in (('high', (126, 226, 214)), ('low', (240, 200, 120))):
            if q in b:
                dc, tri, tex, prog = b[q]
                d.text((x, PAD + 252 + (0 if q == 'high' else 20)), f'{q.upper()}: {dc} draws · {tri/1000:.0f}k tris · {tex:.1f} MB · {prog} progs', fill=color, font=font(12))
        if 'map' in b:
            d.text((x, PAD + 292), f'MAP repaint {b["map"]:.1f} ms (desktop CPU)', fill=(160, 170, 182), font=font(12, False))
    for s, (subject, title) in enumerate(SUBJECTS):
        y = header_h + s * block_h
        d.line((PAD, y + 6, width - PAD, y + 6), fill=(60, 74, 88), width=2)
        d.text((PAD, y + 16), title, fill=(232, 214, 170), font=font(18))
        for i, o in enumerate(options):
            x = x0 + i * (COL + GAP)
            folder = base / o
            sheet.paste(load(folder / f'{subject}-390-high.jpg', BIG), (x, y + 44))
            yy = y + 44 + BIG[1] + 8
            sheet.paste(load(folder / f'{subject}-390-low.jpg', SMALL_P), (x, yy))
            sheet.paste(load(folder / f'{subject}-1280-high.jpg', SMALL_D), (x + COL // 2 + 4, yy))
            sheet.paste(load(folder / f'{subject}-1280-low.jpg', SMALL_D), (x + COL // 2 + 4, yy + SMALL_D[1] + 6))
            d.text((x + COL // 2 + 4, yy + 2 * SMALL_D[1] + 12), 'desktop HIGH / LOW', fill=(120, 132, 144), font=font(11, False))
        d.text((PAD, y + 44 + BIG[1] + 12), '390 LOW →', fill=(120, 132, 144), font=font(12, False))
    out = pathlib.Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out, quality=82, optimize=True)
    print('contact sheet', out, sheet.size, f'{out.stat().st_size/1048576:.1f} MB')


if __name__ == '__main__':
    main()
