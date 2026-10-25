#!/usr/bin/env python3
"""Mathzilo — genera el logo en SVG (marca, nombre, lockups e iconos de la PWA).

Uso:
    python3 build_logo.py <lexend-800.woff> <carpeta_salida> [Star] [Math]

Si cambia el nombre de la app, basta con pasar otras dos mitades (por ejemplo
"No" "va") y se regeneran todos los SVG. El nombre se convierte a trazados con
la propia Lexend, así que los archivos no necesitan la fuente instalada.
"""
import sys, os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

font_path, out = sys.argv[1], sys.argv[2]
part_a = sys.argv[3] if len(sys.argv) > 3 else "Star"
part_b = sys.argv[4] if len(sys.argv) > 4 else "Math"
os.makedirs(out, exist_ok=True)

NAVY, CARD, GOLD, GOLD_PALE, BONE = "#0A1230", "#12275F", "#FFC933", "#FFE08A", "#F7F7FA"
GOLD_ON_LIGHT = "#D18F00"

font = TTFont(font_path)
upem = font["head"].unitsPerEm
cmap = font.getBestCmap()
glyphs = font.getGlyphSet()
hmtx = font["hmtx"]
cap_h = getattr(font["OS/2"], "sCapHeight", 0.7 * upem) or 0.7 * upem

def text_path(text, x0, baseline, size, tracking=-0.012):
    """Devuelve (d, ancho) con el texto convertido a un único path."""
    s = size / upem
    pen = SVGPathPen(glyphs)
    x = x0
    for ch in text:
        gname = cmap[ord(ch)]
        tp = TransformPen(pen, (s, 0, 0, -s, x, baseline))
        glyphs[gname].draw(tp)
        x += hmtx[gname][0] * s + tracking * size
    return pen.getCommands(), x - x0

def star_d(cx, cy, R, r):
    import math
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rad = R if i % 2 == 0 else r
        pts.append(f"{cx + rad * math.cos(a):.2f} {cy + rad * math.sin(a):.2f}")
    return "M" + "L".join(pts) + "Z"

def sparkle_d(cx, cy, s):
    k = s * 0.14
    return (f"M{cx} {cy - s}Q{cx + k} {cy - k} {cx + s} {cy}Q{cx + k} {cy + k} {cx} {cy + s}"
            f"Q{cx - k} {cy + k} {cx - s} {cy}Q{cx - k} {cy - k} {cx} {cy - s}Z")

def mark_group(gap=None):
    """Estrella con órbita en un lienzo de 512.

    El hueco entre la estrella y la parte delantera de la órbita se recorta con
    una máscara, así que es transparente de verdad y la marca vale sobre
    cualquier fondo. (El parámetro 'gap' se conserva por compatibilidad.)
    """
    rx, ry = 186, 60
    back = f"M{-rx} 0A{rx} {ry} 0 0 1 {rx} 0"
    front = f"M{-rx} 0A{rx} {ry} 0 0 0 {rx} 0"
    return (
        f'<defs><mask id="hueco" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">'
        f'<rect width="512" height="512" fill="#fff"/>'
        f'<g transform="translate(256 262) rotate(-20)" fill="none"><path d="{front}" stroke="#000" stroke-width="34"/></g>'
        f'</mask></defs>'
        f'<g transform="translate(256 262) rotate(-20)" fill="none">'
        f'<path d="{back}" stroke="{GOLD_PALE}" stroke-width="16"/></g>'
        f'<path d="{star_d(256, 248, 146, 70)}" fill="{GOLD}" stroke="{GOLD}" stroke-width="24" stroke-linejoin="round" mask="url(#hueco)"/>'
        f'<g transform="translate(256 262) rotate(-20)" fill="none">'
        f'<path d="{front}" stroke="{GOLD_PALE}" stroke-width="16"/></g>'
    )

def star_only_group():
    """Solo la estrella, más grande, para tamaños de 32 px o menos."""
    return f'<path d="{star_d(256, 262, 190, 92)}" fill="{GOLD}" stroke="{GOLD}" stroke-width="30" stroke-linejoin="round"/>'

def svg(w, h, body, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img">'
            f'<title>{title}</title>{body}</svg>\n')

def write(name, content):
    with open(os.path.join(out, name), "w", encoding="utf-8") as f:
        f.write(content)

full = part_a + part_b

# 1. Marca con baldosa (icono de app y favicon)
write("logo-marca.svg", svg(512, 512, f'<rect width="512" height="512" rx="112" fill="{CARD}"/>{mark_group(CARD)}', f"{full} — icono"))
write("favicon.svg", svg(512, 512, f'<rect width="512" height="512" rx="112" fill="{CARD}"/>{star_only_group()}', f"{full} — favicon"))
# 2. Marca sin baldosa (fondo transparente; el hueco de la órbita usa el color de la superficie)
write("logo-marca-sin-fondo.svg", svg(512, 512, mark_group(NAVY), f"{full} — marca"))
# 3. Icono adaptable (maskable): fondo a sangre y contenido dentro del 80 % central
write("icono-adaptable.svg", svg(512, 512, f'<rect width="512" height="512" fill="{CARD}"/><g transform="translate(256 256) scale(0.8) translate(-256 -256)">{mark_group(CARD)}</g>', f"{full} — icono adaptable"))

# 4. Nombre en trazados
SIZE = 150
base = 170
da, wa = text_path(part_a, 0, base, SIZE)
db, wb = text_path(part_b, wa, base, SIZE)
total = wa + wb
sp_x, sp_y = total + 24, base - cap_h * SIZE / upem + 4
def wordmark(color_a, color_b, spark, title):
    w, h = int(total + 80), 220
    body = (f'<path d="{da}" fill="{color_a}"/><path d="{db}" fill="{color_b}"/>'
            f'<path d="{sparkle_d(round(sp_x, 1), round(sp_y, 1), 26)}" fill="{spark}"/>')
    return svg(w, h, body, title), w, h
wm_dark, wmw, wmh = wordmark(GOLD, BONE, GOLD, f"{full}")
wm_light, _, _ = wordmark(GOLD_ON_LIGHT, NAVY, GOLD_ON_LIGHT, f"{full}")
write("nombre-fondo-oscuro.svg", wm_dark)
write("nombre-fondo-claro.svg", wm_light)

# 5. Lockup horizontal: baldosa + nombre
TILE = 200
def lockup(color_a, color_b, spark, bg, title):
    gap = 44
    w = TILE + gap + wmw
    h = TILE
    scale_wm = 0.86
    ty = (h - wmh * scale_wm) / 2 + 8
    body = (f'{bg}'
            f'<g transform="scale({TILE / 512})"><rect width="512" height="512" rx="112" fill="{CARD}"/>{mark_group(CARD)}</g>'
            f'<g transform="translate({TILE + gap} {ty:.1f}) scale({scale_wm})">'
            f'<path d="{da}" fill="{color_a}"/><path d="{db}" fill="{color_b}"/>'
            f'<path d="{sparkle_d(round(sp_x, 1), round(sp_y, 1), 26)}" fill="{spark}"/></g>')
    return svg(int(w), h, body, title)
write("logo-completo-fondo-oscuro.svg", lockup(GOLD, BONE, GOLD, "", f"{full}"))
write("logo-completo-fondo-claro.svg", lockup(GOLD_ON_LIGHT, NAVY, GOLD_ON_LIGHT, "", f"{full}"))
print("ok", full, "ancho nombre", round(total))
