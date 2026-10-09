"""Découpe les planches de décor (pixel art généré, fond en damier) en petites
images prêtes pour le jeu, dans public/tiles/.

Entrées : art/file_00000000d06c81f4a11094b5ce5ee863.png (obstacles, sol, effets)
          art/Planche de sprites pixel art rétro.png      (pièces)
Chaque élément est repéré par sa boîte dans l'image source (y0, x0, y1, x1),
puis réduit à sa taille en jeu (largeur ou hauteur cible).
Les frames d'une animation sont posées côte à côte (même taille).

Usage : python3 tools/process_tiles.py
"""

from pathlib import Path

import numpy as np
from PIL import Image

from process_sprites import background_mask_checker, flood_outside, downsample, crop_alpha

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "art"
OUT = ROOT / "public" / "tiles"
SHEET = "file_00000000d06c81f4a11094b5ce5ee863.png"
COINS = "Planche de sprites pixel art rétro.png"

# nom : (fichier, [boîtes], taille cible : ("w", px) ou ("h", px))
ITEMS = {
    "spike": (SHEET, [(104, 48, 168, 116)], ("w", 26)),
    "wall_gray": (SHEET, [(88, 588, 216, 692)], ("w", 45)),
    "wall_blue": (SHEET, [(60, 784, 236, 880)], ("w", 45)),
    "wall_red": (SHEET, [(80, 952, 228, 1024)], ("w", 45)),
    "wall_red_break": (SHEET, [(340, 1016, 428, 1068), (340, 1088, 428, 1140), (340, 1156, 428, 1212), (348, 1220, 428, 1276)], ("h", 64)),
    "wall_red_block": (SHEET, [(340, 820, 396, 868), (340, 872, 396, 920), (340, 924, 396, 972)], ("w", 45)),
    "gate_blue": (SHEET, [(312, 32, 424, 64), (316, 72, 424, 104), (312, 116, 424, 148), (316, 156, 424, 188)], ("w", 24)),
    "gate_blue_open": (SHEET, [(312, 224, 424, 252), (312, 272, 424, 300), (312, 316, 424, 344), (312, 360, 424, 388)], ("w", 24)),
    "gate_red": (SHEET, [(312, 436, 424, 468), (312, 476, 424, 508), (316, 520, 424, 552), (312, 560, 424, 592)], ("w", 24)),
    "gate_red_open": (SHEET, [(312, 628, 420, 656), (312, 668, 424, 696), (312, 708, 424, 732), (312, 748, 424, 772)], ("w", 24)),
    "low": (SHEET, [(544, 24, 630, 340)], ("w", 225)),  # sans les racines qui touchent le sol
    "ceiling": (SHEET, [(512, 384, 664, 652)], ("w", 300)),
    "crystal": (SHEET, [(548, 704, 640, 772), (548, 788, 640, 856), (548, 876, 640, 940), (548, 960, 640, 1028)], ("h", 32)),
    "checkpoint": (SHEET, [(520, 1096, 712, 1168), (516, 1212, 712, 1276)], ("h", 70)),
    "hole_left": (SHEET, [(736, 36, 892, 84)], ("h", 110)),
    "hole_right": (SHEET, [(736, 160, 892, 212)], ("h", 110)),
    "platform_gray": (SHEET, [(796, 276, 832, 508)], ("w", 150)),
    "platform_blue": (SHEET, [(796, 544, 832, 752)], ("w", 150)),
    "platform_red": (SHEET, [(796, 788, 836, 1004)], ("w", 150)),
    "platform_blue_ghost": (SHEET, [(792, 1040, 836, 1160)], ("w", 150)),
    "platform_red_ghost": (SHEET, [(792, 1168, 836, 1288)], ("w", 150)),
    "spring": (SHEET, [(960, 48, 1032, 128), (980, 148, 1032, 228), (960, 248, 1032, 328)], ("w", 36)),
    "ground": (SHEET, [(1108, 28, 1172, 368)], ("w", 150)),
    # Terre caillouteuse (bas du sol) : remplit le dessus des plafonds.
    "soil": (SHEET, [(1138, 40, 1170, 356)], ("w", 150)),
    "deco": (SHEET, [(1120, 1016, 1164, 1064), (1124, 964, 1164, 1000), (1124, 1172, 1164, 1212), (1128, 1136, 1160, 1164),
                     (1128, 1224, 1160, 1264), (1132, 1068, 1156, 1092), (1136, 1100, 1160, 1124)], ("scale", 2.6)),
    "coin_blue": (COINS, [(128, 44, 218, 126), (128, 170, 218, 242), (128, 302, 218, 340), (128, 410, 218, 474), (128, 526, 218, 604), (128, 650, 218, 732)], ("h", 20)),
    "coin_red": (COINS, [(128, 812, 218, 894), (128, 936, 218, 1010), (128, 1068, 218, 1106), (128, 1172, 218, 1234), (128, 1286, 218, 1364), (128, 1408, 218, 1492)], ("h", 20)),
}


def extract(rgb, box, target):
    y0, x0, y1, x1 = box
    sub = rgb[y0:y1, x0:x1]
    fg = ~flood_outside(background_mask_checker(sub))
    ys, xs = np.nonzero(fg)
    sub, fg = sub[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1], fg[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
    kind, v = target
    scale = v if kind == "scale" else (sub.shape[1] / v if kind == "w" else sub.shape[0] / v)
    return crop_alpha(downsample(sub, fg, scale))


# Portes : on ne garde que le milieu (sans les bouts arrondis) pour la répétition.
MIDDLE_ONLY = {"gate_blue", "gate_blue_open", "gate_red", "gate_red_open"}


def strip(frames):
    """Frames de même taille côte à côte, alignées en bas et centrées."""
    h = max(f.shape[0] for f in frames)
    w = max(f.shape[1] for f in frames)
    out = np.zeros((h, w * len(frames), 4), dtype=np.uint8)
    for i, f in enumerate(frames):
        x = i * w + (w - f.shape[1]) // 2
        out[h - f.shape[0] :, x : x + f.shape[1]] = f
    return out, w, h


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    cache = {}
    meta = {}
    for name, (file, boxes, target) in ITEMS.items():
        if file not in cache:
            cache[file] = np.array(Image.open(ART / file).convert("RGB")).astype(int)
        frames = [extract(cache[file], b, target) for b in boxes]
        if name in MIDDLE_ONLY:
            frames = [f[int(f.shape[0] * 0.2) : int(f.shape[0] * 0.8)] for f in frames]
        img, w, h = strip(frames)
        Image.fromarray(img).save(OUT / f"{name}.png")
        meta[name] = {"w": w, "h": h, "frames": len(frames)}
        print(f"{name:22s} {len(frames)} frame(s) de {w}x{h}")
    import json

    # Tailles des frames, lues par le jeu au chargement.
    (ROOT / "src" / "gfx" / "tiles.js").write_text(
        "// Généré par tools/process_tiles.py : taille et nombre de frames de chaque image.\nexport default "
        + json.dumps(meta, indent=1)
        + ";\n"
    )


if __name__ == "__main__":
    main()
