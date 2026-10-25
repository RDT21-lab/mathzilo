"""Mathzilo — empaqueta el prototipo de la fase 1 en un solo HTML autocontenido.

Mete en src/template.html el CSS, las mascotas, el motor, la app y el logo.
Uso:  python build.py            → dist/starmath-prototipo.html
"""
import json
import random
import re
import sys
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
KIT = ROOT / "kit"
OUT = ROOT / "dist" / "starmath-prototipo.html"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def svg_inline(path: Path) -> str:
    """SVG listo para meter en el DOM: sin tamaño fijo, sin <title> (lo pone el contenedor)."""
    s = read(path).strip()
    s = re.sub(r'\s(width|height)="[^"]*"', "", s, count=2)
    s = re.sub(r"<title>.*?</title>", "", s)
    return s.replace('role="img"', 'aria-hidden="true"')


def data_uri(svg: str) -> str:
    return "data:image/svg+xml," + quote(svg, safe=" =:/;,'")


def star_field() -> str:
    """Puntos blancos y dorados repartidos con semilla fija (mismo cielo en cada build)."""
    rnd = random.Random(7)
    dots = []
    for _ in range(46):
        x, y = rnd.uniform(0, 400), rnd.uniform(0, 400)
        r = rnd.choice([0.8, 0.8, 1.1, 1.4])
        fill = "#FFC933" if rnd.random() < 0.18 else "#F7F7FA"
        op = rnd.choice([0.25, 0.35, 0.5])
        dots.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{fill}" fill-opacity="{op}"/>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">{"".join(dots)}</svg>'


def check_js(name: str, code: str) -> None:
    if "</script" in code.lower():
        sys.exit(f"{name} contiene '</script' y rompería el HTML")


def main() -> None:
    css = read(SRC / "app.css")
    mascots = read(SRC / "mascots.js")
    engine = read(SRC / "engine.js")
    app = read(SRC / "app.js")
    for name, code in (("mascots.js", mascots), ("engine.js", engine), ("app.js", app)):
        check_js(name, code)

    assets = {
        "mark": svg_inline(KIT / "logo" / "logo-marca.svg"),
        "wordmark": svg_inline(KIT / "logo" / "nombre-fondo-oscuro.svg"),
    }
    html = read(SRC / "template.html")
    parts = {
        "{{FAVICON}}": data_uri(read(KIT / "logo" / "favicon.svg")),
        "{{STARS}}": data_uri(star_field()),
        "{{ASSETS}}": json.dumps(assets, ensure_ascii=False).replace("</", "<\\/"),
        "{{CSS}}": css,
        "{{MASCOTS}}": mascots,
        "{{ENGINE}}": engine,
        "{{APP}}": app,
    }
    for key, value in parts.items():
        if key not in html:
            sys.exit(f"Falta {key} en template.html")
        html = html.replace(key, value)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html, encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)} · {len(html.encode('utf-8')) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
