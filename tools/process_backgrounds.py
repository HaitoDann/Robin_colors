"""Découpe la planche « fond en 4 couches » en images pour la parallaxe.

Entrée  : art/Planche pixel art fantasy en 4 couches.png (4 bandes empilées)
Sorties : public/backgrounds/medieval_sky.png  (ciel, opaque)
          public/backgrounds/medieval_far.png  (cité lointaine, haut fondu)
          public/backgrounds/medieval_mid.png  (remparts, ciel pastel retiré)
          public/backgrounds/medieval_near.png (premier plan, damier retiré)
Chaque couche est rendue raccordable à l'horizontale (miroir aux bords).

Usage : python3 tools/process_backgrounds.py
"""

from pathlib import Path

import numpy as np
from PIL import Image

from process_sprites import background_mask_checker, flood_outside

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art" / "Planche pixel art fantasy en 4 couches.png"
OUT = ROOT / "public" / "backgrounds"

# Bandes (y0, y1) et zone d'étiquette à effacer (x0, y0, x1, y1), en pixels source.
X0, X1 = 14, 1656
BANDS = {
    "sky": ((44, 236), None),
    "far": ((242, 490), (10, 255, 318, 290)),
    "mid": ((497, 708), (10, 510, 330, 542)),
    "near": ((713, 915), (10, 725, 298, 755)),
}
# Premier plan : on démarre après l'étiquette (elle cache le haut de l'arbre).
X0_BY_BAND = {"near": 300}


def mirror(img):
    """Raccord sans couture : l'image suivie de son reflet horizontal."""
    return np.concatenate([img, img[:, ::-1]], axis=1)


def despeckle(alpha, keep=14):
    """Retire les pixels opaques isolés (restes de fond) : on garde un pixel
    s'il a au moins `keep` voisins opaques dans un carré 5x5."""
    a = (alpha > 0).astype(int)
    p = np.pad(a, 2)
    count = sum(p[dy : dy + a.shape[0], dx : dx + a.shape[1]] for dy in range(5) for dx in range(5))
    out = alpha.copy()
    out[(a == 1) & (count < keep)] = 0
    return out


def seamless(img, blend=120):
    """Rend l'image raccordable : le bord droit se fond dans le bord gauche."""
    h, w = img.shape[:2]
    out = img[:, : w - blend].copy().astype(float)
    tail = img[:, w - blend :].astype(float)
    t = np.linspace(0, 1, blend)[None, :, None]
    out[:, :blend] = out[:, :blend] * t + tail * (1 - t)
    return out.astype(np.uint8)


def flood_top(mask):
    """Pixels du masque reliés au bord supérieur (remplissage par diffusion)."""
    from collections import deque

    h, w = mask.shape
    out = np.zeros_like(mask)
    q = deque((0, x) for x in range(w) if mask[0, x])
    for _, x in q:
        out[0, x] = True
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not out[ny, nx]:
                out[ny, nx] = True
                q.append((ny, nx))
    return out


def pastel(rgb):
    """Ciel et montagnes lointaines : clairs et doux (rose, lavande, pêche)."""
    mx, mn = rgb.max(2), rgb.min(2)
    sky_blue = (rgb[:, :, 2] > 150) & (rgb[:, :, 2] > rgb[:, :, 0] + 25)
    return ((mx > 150) & (mn > 95)) | sky_blue


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    src = np.array(Image.open(SRC).convert("RGB")).astype(int)
    for name, ((y0, y1), label) in BANDS.items():
        rgb = src[y0:y1, X0_BY_BAND.get(name, X0) : X1]
        alpha = np.full(rgb.shape[:2], 255, dtype=np.uint8)
        if label and name == "far":
            # Étiquette dans le ciel : on la recouvre avec le ciel juste à droite.
            lx0, ly0, lx1, ly1 = label
            r0, r1, w = ly0 - y0, ly1 - y0 + 2, lx1 - X0
            rgb = rgb.copy()
            rgb[r0:r1, :w] = rgb[r0:r1, w : 2 * w]
            label = None
        if label:
            lx0, ly0, lx1, ly1 = label
            alpha[max(0, ly0 - y0) : max(0, ly1 - y0), max(0, lx0 - X0) : lx1 - X0] = 0
        if name == "far":
            # Le haut (brume du ciel) se fond progressivement dans la couche ciel.
            ramp = np.clip((np.arange(rgb.shape[0]) - 50) / 70, 0, 1)
            alpha = (alpha * ramp[:, None]).astype(np.uint8)
        elif name == "mid":
            # Colonne par colonne, on efface depuis le haut tant que c'est pastel.
            p = pastel(rgb) | (alpha == 0)  # l'étiquette effacée compte comme du ciel
            for x in range(rgb.shape[1]):
                run = 0
                for y in range(rgb.shape[0]):
                    if p[y, x]:
                        alpha[y, x] = 0
                        run = 0
                    else:
                        run += 1
                        if run >= 3:
                            alpha[max(0, y - 2) : y + 1, x] = 255
                            break
                        alpha[y, x] = 0
        elif name == "near":
            # Damier gris (clair ou foncé) peu saturé, relié au bord du haut.
            mx, mn = rgb.max(2), rgb.min(2)
            grey = ((mx - mn) < 40) & (mx > 80) | (alpha == 0)
            bg = flood_top(grey)
            alpha[bg] = 0
        if name in ("mid", "near"):
            alpha = despeckle(despeckle(alpha))
        img = np.dstack([rgb.astype(np.uint8), alpha])
        img = mirror(img)
        if label and name != "near":
            # L'étiquette tombe dans le ciel : transparente (après le raccord).
            lx0, ly0, lx1, ly1 = label
            img[max(0, ly0 - y0) : max(0, ly1 - y0), : lx1 - X0, 3] = 0
        Image.fromarray(img).save(OUT / f"medieval_{name}.png")
        print(name, img.shape[1], "x", img.shape[0])


if __name__ == "__main__":
    main()
