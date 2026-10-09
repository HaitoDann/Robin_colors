"""Convertit les images "pixel art" générées (grandes, floues, fond en damier)
en vraies planches de sprites pour le jeu.

Entrées  : art/robin_run.png  (8 images de course, bleu puis rouge)
           art/robin.png      (pose debout, bleu et rouge, fond transparent)
           art/robin_jump_fall_dash_death.png (bleu uniquement : saut x2,
               chute, dash x2 sur la 1re ligne, mort x4 sur la 2e)
Sorties  : public/sprites/robin_blue.png, public/sprites/robin_red.png
           Une ligne d'images de FRAME_W x FRAME_H, dans l'ordre de FRAMES.
           La version rouge des poses qui n'existent qu'en bleu est obtenue
           en recolorant avec les couleurs de la course rouge.

Usage : python3 tools/process_sprites.py   (nécessite Pillow et numpy)
"""

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "art"
OUT = ROOT / "public" / "sprites"

ART_HEIGHT = 32  # hauteur de Robin en vrais pixels
FRAME_W, FRAME_H = 48, 36
FRAMES = [
    "run1", "run2", "run3", "run4", "run5", "run6", "run7", "run8",
    "jump1", "jump2", "fall", "dash1", "dash2", "idle",
    "death1", "death2", "death3", "death4",
    "slide1", "slide2", "slide3", "land1", "land2", "hland1", "hland2",
    "ff1", "ff2", "frun1", "frun2", "frun3", "frun4", "frun5", "frun6",
    "idle1", "idle2", "idle3", "idle4", "idle5", "idle6", "idle7", "idle8",
]
# 2e planche de poses : glissade, atterrissages, fast-fall, course rapide, idle.
POSES2 = "robin_glissade_atterissage_fastfall_course rapide_idle.png"
POSES2_SCALE = 170 / 35  # idle de 170 px source -> 35 px
# Taille d'un "pixel" dans l'image des poses, réglée pour que la tête fasse
# la même largeur que dans la course (20 px).
POSES_SCALE = 7.1
# Hauteur de la pose debout (robin.png) pour une tête de 20 px de large.
IDLE_HEIGHT = 35


def background_mask_checker(rgb):
    """Fond en damier blanc/gris : clair et peu saturé."""
    mx, mn = rgb.max(2), rgb.min(2)
    return (mx > 170) & (mx - mn < 40)


def flood_outside(bg, fg_seed_free=None):
    """Garde comme fond uniquement les pixels de fond reliés au bord
    (les semelles blanches entourées de contour restent dans Robin)."""
    h, w = bg.shape
    out = np.zeros_like(bg)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if bg[y, x]:
                out[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if bg[y, x] and not out[y, x]:
                out[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and bg[ny, nx] and not out[ny, nx]:
                out[ny, nx] = True
                q.append((ny, nx))
    return out


def segments(profile, min_count=3):
    segs, start = [], None
    for i, v in enumerate(profile):
        if v > min_count and start is None:
            start = i
        elif v <= min_count and start is not None:
            segs.append((start, i))
            start = None
    if start is not None:
        segs.append((start, len(profile)))
    return segs


def downsample(rgb, fg, scale):
    """Échantillonne une cellule sur `scale` pixels source (zone centrale)."""
    h, w = fg.shape
    th, tw = int(round(h / scale)), int(round(w / scale))
    out = np.zeros((th, tw, 4), dtype=np.uint8)
    for j in range(th):
        for i in range(tw):
            y0, y1 = int((j + 0.25) * scale), int((j + 0.75) * scale) + 1
            x0, x1 = int((i + 0.25) * scale), int((i + 0.75) * scale) + 1
            cell_fg = fg[y0:y1, x0:x1]
            if cell_fg.size == 0 or cell_fg.mean() < 0.5:
                continue
            px = rgb[y0:y1, x0:x1][cell_fg]
            out[j, i, :3] = np.median(px, axis=0)
            out[j, i, 3] = 255
    return out


def crop_alpha(img):
    ys, xs = np.nonzero(img[:, :, 3])
    return img[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]


def quantize(frames, colors=14):
    """Palette commune à toutes les images d'une couleur (pixels nets)."""
    strip = np.concatenate([f.reshape(-1, 4) for f in frames])
    opaque = strip[strip[:, 3] > 0][:, :3]
    pal_img = Image.fromarray(opaque.reshape(1, -1, 3)).quantize(colors, method=Image.Quantize.MEDIANCUT)
    palette = np.array(pal_img.getpalette()[: colors * 3]).reshape(-1, 3)
    result = []
    for f in frames:
        f = f.copy()
        mask = f[:, :, 3] > 0
        px = f[mask][:, :3].astype(int)
        idx = ((px[:, None, :] - palette[None, :, :]) ** 2).sum(2).argmin(1)
        f[mask, :3] = palette[idx]
        result.append(f)
    return result


def place(sprite, anchor="head"):
    """Pose le sprite dans une case FRAME_W x FRAME_H, pieds en bas.
    anchor="head" : tête centrée horizontalement (Robin ne "tremble" pas en
    courant) ; anchor="center" : sprite centré (poses allongées)."""
    canvas = np.zeros((FRAME_H, FRAME_W, 4), dtype=np.uint8)
    h, w = sprite.shape[:2]
    if anchor == "head":
        head = sprite[: h // 3, :, 3] > 0
        head_cx = np.nonzero(head)[1].mean()
    else:
        head_cx = w / 2
    x = int(round(FRAME_W / 2 - head_cx))
    y = FRAME_H - h
    for j in range(h):
        for i in range(w):
            if sprite[j, i, 3] and 0 <= x + i < FRAME_W and 0 <= y + j < FRAME_H:
                canvas[y + j, x + i] = sprite[j, i]
    return canvas


def run_frames():
    rgb = np.array(Image.open(ART / "robin_run.png").convert("RGB")).astype(int)
    fg_all = ~background_mask_checker(rgb)
    bands = [b for b in segments(fg_all.sum(1)) if b[1] - b[0] > 150]  # ignore textes
    result = {}
    for color, (y0, y1) in zip(("blue", "red"), bands):
        sprites = []
        for x0, x1 in segments(fg_all[y0:y1].sum(0), 2):
            sub = rgb[y0:y1, x0:x1]
            fg = ~flood_outside(background_mask_checker(sub))
            scale = (y1 - y0) / ART_HEIGHT
            sprites.append(crop_alpha(downsample(sub, fg, scale)))
        result[color] = sprites
    return result


def idle_frames():
    img = np.array(Image.open(ART / "robin.png").convert("RGBA")).astype(int)
    fg_all = img[:, :, 3] > 200
    out = {}
    for color, (x0, x1) in zip(("blue", "red"), segments(fg_all.sum(0), 2)):
        sub_fg = fg_all[:, x0:x1]
        ys = np.nonzero(sub_fg.any(1))[0]
        y0, y1 = ys.min(), ys.max() + 1
        # Robin.png a une tête plus petite par rapport au corps : on règle la
        # hauteur pour que la tête fasse 20 px de large, comme dans la course.
        scale = (y1 - y0) / IDLE_HEIGHT
        out[color] = crop_alpha(downsample(img[y0:y1, x0:x1, :3], sub_fg[y0:y1], scale))
    return out


def pose_frames():
    """Poses bleues : 1re ligne saut1, saut2, chute, dash1, dash2 ; 2e ligne mort1-4."""
    rgb = np.array(Image.open(ART / "robin_jump_fall_dash_death.png").convert("RGB")).astype(int)
    fg_all = ~background_mask_checker(rgb)
    sprites = []
    for y0, y1 in (b for b in segments(fg_all.sum(1)) if b[1] - b[0] > 80):
        for x0, x1 in segments(fg_all[y0:y1].sum(0), 2):
            # Dans chaque colonne, le numéro est au-dessus : on garde le plus grand bloc.
            rows = segments(fg_all[y0:y1, x0:x1].sum(1), 1)
            r0, r1 = max(rows, key=lambda r: r[1] - r[0])
            sub = rgb[y0 + r0 : y0 + r1, x0:x1]
            fg = ~flood_outside(background_mask_checker(sub))
            sprites.append(crop_alpha(downsample(sub, fg, POSES_SCALE)))
    assert len(sprites) == 9, f"{len(sprites)} poses trouvées au lieu de 9"
    return sprites


def merge(segs, gap):
    out = []
    for s in segs:
        if out and s[0] - out[-1][1] < gap:
            out[-1] = (out[-1][0], s[1])
        else:
            out.append(s)
    return out


def pose2_frames():
    """3 lignes : glissade x3, atterrissage x2, atterrissage lourd x2 /
    fast-fall x2, course rapide x6 / idle x8. Les traits d'effet proches
    d'une pose sont regroupés avec elle ; titres et numéros sont ignorés."""
    rgb = np.array(Image.open(ART / POSES2).convert("RGB")).astype(int)
    fg_all = ~background_mask_checker(rgb)
    bands = [b for b in segments(fg_all.sum(1), 3) if b[1] - b[0] > 150]
    sprites = []
    for y0, y1 in bands:
        y0 -= 12  # garde les traits de vitesse au-dessus de la tête
        for x0, x1 in merge(segments(fg_all[y0:y1].sum(0), 1), 20):
            rows = merge(segments(fg_all[y0:y1, x0:x1].sum(1), 0), 10)
            r0, r1 = max(rows, key=lambda r: r[1] - r[0])
            sub = rgb[y0 + r0 : y0 + r1, x0:x1]
            fg = ~flood_outside(background_mask_checker(sub))
            sprites.append(crop_alpha(downsample(sub, fg, POSES2_SCALE)))
    assert len(sprites) == 23, f"{len(sprites)} poses trouvées au lieu de 23"
    return sprites


def is_tinted(c, color):
    r, g, b = (int(v) for v in c)
    return b > r + 25 if color == "blue" else r > b + 25


def recolor_blue_to_red(frames, blue_ref, red_ref):
    """Recolore des images bleues en rouge. La correspondance bleu -> rouge
    est apprise en superposant les courses bleue et rouge (mêmes dessins) :
    pour chaque couleur bleue, on prend la couleur rouge la plus fréquente
    au même endroit. La peau, les yeux et le blanc ne changent pas."""
    votes = {}
    for b, r in zip(blue_ref, red_ref):
        both = (b[:, :, 3] > 0) & (r[:, :, 3] > 0)
        for y, x in zip(*np.nonzero(both)):
            cb, cr = tuple(b[y, x, :3]), tuple(r[y, x, :3])
            if is_tinted(cb, "blue") and is_tinted(cr, "red"):
                votes.setdefault(cb, {}).setdefault(cr, 0)
                votes[cb][cr] += 1
    mapping = {cb: max(v, key=v.get) for cb, v in votes.items()}
    known = np.array(list(mapping.keys()), dtype=int)

    out = []
    for f in frames:
        f = f.copy()
        for y, x in zip(*np.nonzero(f[:, :, 3])):
            c = f[y, x, :3].astype(int)
            if is_tinted(c, "blue"):
                nearest = tuple(known[((known - c) ** 2).sum(1).argmin()])
                f[y, x, :3] = mapping[nearest]
        out.append(f)
    return out


def main():
    runs = run_frames()
    idles = idle_frames()
    jump1, jump2, fall, dash1, dash2, *deaths = pose_frames()
    OUT.mkdir(parents=True, exist_ok=True)

    poses = [place(jump1), place(jump2), place(fall), place(dash1), place(dash2)]
    death = [place(d, "center") for d in deaths]

    extra = [place(f, "center" if i == 1 else "head") for i, f in enumerate(pose2_frames())]

    blue = quantize([place(f) for f in runs["blue"]] + poses + [place(idles["blue"])] + death + extra)
    red_own = quantize([place(f) for f in runs["red"]] + [place(idles["red"])])
    blue_poses = blue[8:13] + blue[14:]
    red_poses = recolor_blue_to_red(blue_poses, blue[:8], red_own[:8])
    red = red_own[:8] + red_poses[:5] + [red_own[8]] + red_poses[5:]

    for color, frames in (("blue", blue), ("red", red)):
        assert len(frames) == len(FRAMES)
        Image.fromarray(np.concatenate(frames, axis=1)).save(OUT / f"robin_{color}.png")
        print(f"robin_{color}.png : {len(frames)} images de {FRAME_W}x{FRAME_H}")


if __name__ == "__main__":
    main()
