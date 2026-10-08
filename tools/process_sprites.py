"""Convertit les images "pixel art" générées (grandes, floues, fond en damier)
en vraies planches de sprites pour le jeu.

Entrées  : art/robin_run.png (8 images de course, bleu puis rouge)
           art/robin.png     (pose debout, bleu et rouge, fond transparent)
Sorties  : public/sprites/robin_blue.png, public/sprites/robin_red.png
           Une ligne d'images de FRAME_W x FRAME_H :
           0-7 course, 8 saut, 9 chute, 10 dash, 11 debout

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
FRAME_W, FRAME_H = 32, 36
FRAMES = ["run1", "run2", "run3", "run4", "run5", "run6", "run7", "run8", "jump", "fall", "dash", "idle"]


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


def place(sprite, head_cx=None):
    """Pose le sprite dans une case FRAME_W x FRAME_H, pieds en bas,
    tête centrée horizontalement (évite que Robin "tremble" en courant)."""
    canvas = np.zeros((FRAME_H, FRAME_W, 4), dtype=np.uint8)
    h, w = sprite.shape[:2]
    if head_cx is None:
        head = sprite[: h // 3, :, 3] > 0
        head_cx = np.nonzero(head)[1].mean()
    x = int(round(FRAME_W / 2 - head_cx))
    y = FRAME_H - h
    for j in range(h):
        for i in range(w):
            if sprite[j, i, 3] and 0 <= x + i < FRAME_W and 0 <= y + j < FRAME_H:
                canvas[y + j, x + i] = sprite[j, i]
    return canvas


def lean(frame, max_shift=2):
    """Penche Robin vers l'avant (le haut du corps décalé à droite) pour le dash."""
    out = np.zeros_like(frame)
    h = frame.shape[0]
    for y in range(h):
        s = int(round(max_shift * (1 - y / h)))
        out[y, s:] = frame[y, : frame.shape[1] - s]
    return out


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
        scale = (y1 - y0) / ART_HEIGHT
        out[color] = crop_alpha(downsample(img[y0:y1, x0:x1, :3], sub_fg[y0:y1], scale))
    return out


def main():
    runs = run_frames()
    idles = idle_frames()
    OUT.mkdir(parents=True, exist_ok=True)
    for color in ("blue", "red"):
        run = runs[color]
        assert len(run) == 8, f"{color}: {len(run)} images de course trouvées au lieu de 8"
        frames = [place(f) for f in run]
        frames.append(place(run[3]))  # saut : jambes tendues
        frames.append(place(run[1]))  # chute
        frames.append(lean(place(run[3])))  # dash : penché en avant
        frames.append(place(idles[color]))
        frames = quantize(frames)
        sheet = np.concatenate(frames, axis=1)
        Image.fromarray(sheet).save(OUT / f"robin_{color}.png")
        print(f"robin_{color}.png : {len(frames)} images de {FRAME_W}x{FRAME_H}")


if __name__ == "__main__":
    main()
