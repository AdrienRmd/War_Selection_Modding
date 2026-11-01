#!/usr/bin/env python3
"""Génère public/field-archive-bg.webp — fond décor « Field Archive ».

Composition (V1) : art du jeu (public/stalingrad-art.webp) retravaillé en
toile de fond d'archive de campagne :
  1. léger flou (lisibilité du texte posé dessus) + réduction à 1600 px ;
  2. étalonnage sépia chaud (teinte « carte d'état-major ») ;
  3. assombrissement ~20-25 % de visibilité avec compression des hautes
     lumières (gamma) — plafond ~68/255 pour garantir le contraste texte ;
  4. vignettage radial bords (x0,55) — le voile CSS complète en bas.

Contraste vérifié par validation/design/field-archive (check-contrast.py) :
le pixel le plus clair du WebP final, composé avec le voile CSS, reste sous
le budget 4.5:1 pour --foreground, --muted-foreground et --primary.

Usage : python3 scripts/make-field-archive-bg.py
"""
from PIL import Image, ImageFilter

SRC = "public/stalingrad-art.webp"
DST = "public/field-archive-bg.webp"
TARGET_W = 1600
DARKEN = 0.30  # visibilité visée (~20-25 % après gamma + vignettage)
GAMMA = 1.15    # écrase les hautes lumières (ciel) sous le plafond
CAP = 68        # plafond absolu par canal après étalonnage
VIGNETTE_EDGE = 0.60

im = Image.open(SRC).convert("RGB")
w, h = im.size
im = im.resize((TARGET_W, round(h * TARGET_W / w)), Image.LANCZOS)
im = im.filter(ImageFilter.GaussianBlur(2.2))

# Étalonnage : luminance -> sépia chaud, assombrie, gamma sur les hautes lumières.
src = im.load()
for y in range(im.height):
    for x in range(im.width):
        r, g, b = src[x, y]
        lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
        v = 255.0 * (lum / 255.0 * DARKEN) ** (1.0 / GAMMA)
        r2, g2, b2 = v * 1.10, v * 0.97, v * 0.78  # teinte sépia chaude
        src[x, y] = (min(int(r2), CAP), min(int(g2), CAP), min(int(b2), CAP))

# Vignettage radial (ellipse large), multiplicatif vers les bords.
w, h = im.size
mask = Image.new("L", (w, h))
mp = mask.load()
cx, cy = w / 2, h * 0.42
for y in range(h):
    for x in range(w):
        dx, dy = (x - cx) / (w * 0.62), (y - cy) / (h * 0.78)
        d = min((dx * dx + dy * dy) ** 0.5, 1.0)
        mp[x, y] = int(255 * (1.0 - (1.0 - VIGNETTE_EDGE) * d * d))
dark = Image.new("RGB", (w, h), (0, 0, 0))
im = Image.composite(im, dark, mask)

im.save(DST, "WEBP", quality=62, method=6)
print(f"{DST}: {im.size}, objectif < 200 Ko")
