// Réserve d'objets d'affichage réutilisés à chaque image : on "redessine" le
// décor avec des images sans en recréer (begin, puis image/tile/nine, puis end).

export class SpritePool {
  constructor(scene, depth) {
    this.scene = scene;
    this.depth = depth;
    this.lists = {}; // type (+ texture pour les nine-slices) -> objets
    this.used = {};
  }

  begin() {
    for (const k in this.used) this.used[k] = 0;
  }

  take(kind, create) {
    const list = (this.lists[kind] ??= []);
    const i = (this.used[kind] = (this.used[kind] ?? 0) + 1) - 1;
    if (!list[i]) list[i] = create().setDepth(this.depth);
    return list[i].setVisible(true).setAlpha(1).clearTint();
  }

  // Image simple (origine en haut à gauche par défaut).
  image(key, frame, x, y) {
    const o = this.take('image', () => this.scene.add.image(0, 0, key, frame));
    return o.setTexture(key, frame).setScale(1).setOrigin(0, 0).setPosition(x, y).setFlipX(false);
  }

  // Image répétée sur une surface (sol, colonnes).
  tile(key, frame, x, y, w, h) {
    const o = this.take('tile', () => this.scene.add.tileSprite(0, 0, w, h, key, frame));
    o.setTexture(key, frame).setOrigin(0, 0).setPosition(x, y);
    if (o.width !== w || o.height !== h) o.setSize(w, h);
    return o.setTileScale(1, 1).setTilePosition(0, 0);
  }

  // Image étirée en gardant le haut et le bas intacts (murs de hauteurs variables).
  nine(key, x, y, w, h, top = 14, bottom = 8) {
    const o = this.take(`nine:${key}`, () => this.scene.add.nineslice(0, 0, key, 0, w, h, 0, 0, top, bottom));
    o.setOrigin(0, 0).setPosition(x, y);
    if (o.width !== w || o.height !== h) o.setSize(w, h);
    return o;
  }

  end() {
    for (const k in this.lists) for (let i = this.used[k] ?? 0; i < this.lists[k].length; i++) this.lists[k][i].setVisible(false);
  }
}
