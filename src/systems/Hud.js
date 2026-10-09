// Interface en jeu : en-tête (niveau, essai), barre de progression,
// compteurs de pièces, et panneaux (titre, pause, fin de niveau).

import { WIDTH, HEIGHT } from '../config.js';
import { UI, text, drawPanel, keyHints, drawDiamond, FONT_TITLE, FONT_TEXT } from '../ui/theme.js';

const BAR_W = 320;

export class Hud {
  constructor(scene) {
    this.scene = scene;
    this.color = 'blue';
    this.gfx = scene.add.graphics().setDepth(98);
    this.panelGfx = scene.add.graphics().setDepth(99);

    this.kicker = text(scene, 14, 10, '', { size: 12, title: true, color: UI.text }).setDepth(100);
    this.info = text(scene, 14, 27, '', { size: 11, title: true, color: UI.dim }).setDepth(100);
    this.coins = ['blue', 'red'].map((c, i) =>
      text(scene, WIDTH - 14, 9 + i * 20, '', { size: 14, title: true, bold: true, color: UI.css(c === 'blue' ? UI.blue : UI.red) })
        .setOrigin(1, 0)
        .setDepth(100),
    );
    this.coinCounts = { blue: [0, 0], red: [0, 0] };
    this.progress = null;

    // Panneau central.
    this.pKicker = text(scene, WIDTH / 2, 0, '', { size: 13, title: true, color: UI.dim, letterSpacing: 4 }).setOrigin(0.5).setDepth(100);
    this.title = text(scene, WIDTH / 2, 0, '', { size: 34, title: true, bold: true }).setOrigin(0.5).setDepth(100);
    this.subtitle = text(scene, WIDTH / 2, 0, '', { size: 17, color: '#c8c8e0', align: 'center', lineSpacing: 6 }).setOrigin(0.5, 0).setDepth(100);
    this.hintObjs = [];
    this.panelOpen = false;
  }

  // --- En-tête ---

  setHeader(kicker, info) {
    this.kicker.setText(kicker);
    this.info.setText(info);
  }

  // Compatibilité : ligne d'information seule (éditeur).
  setInfo(info) {
    this.info.setText(info);
  }

  setVisible(v) {
    for (const o of [this.kicker, this.gfx, ...this.coins]) o.setVisible(v);
  }

  // counts : { blue: [ramassées, total], red: [...] } ; rien si aucune pièce.
  setCoins(counts) {
    this.coinCounts = counts;
    ['blue', 'red'].forEach((c, i) => {
      const [got, total] = counts[c];
      this.coins[i].setText(total ? `${got} / ${total}` : '');
    });
  }

  // ratio : avancement 0..1 ; ticks : positions 0..1 des checkpoints (reached : bool).
  setProgress(ratio, ticks = [], color = 'blue') {
    this.progress = { ratio: Math.max(0, Math.min(1, ratio)), ticks };
    this.color = color;
  }

  // À appeler à chaque image : petits éléments dessinés (barre, icônes).
  draw() {
    const g = this.gfx;
    g.clear();
    if (!this.kicker.visible) return;
    const acc = this.color === 'red' ? UI.red : UI.blue;
    if (this.progress) {
      const x = WIDTH / 2 - BAR_W / 2;
      g.fillStyle(UI.ink, 0.6).fillRect(x - 2, 12, BAR_W + 4, 8);
      g.fillStyle(UI.line, 1).fillRect(x, 14, BAR_W, 4);
      g.fillStyle(acc, 1).fillRect(x, 14, BAR_W * this.progress.ratio, 4);
      for (const t of this.progress.ticks) {
        g.fillStyle(t.reached ? 0x7dffa0 : 0x8c8cb0, 1).fillRect(x + BAR_W * t.at - 1, 10, 3, 12);
      }
      g.fillStyle(0xffffff, 1).fillRect(x + BAR_W * this.progress.ratio - 2, 11, 4, 10);
    }
    ['blue', 'red'].forEach((c, i) => {
      if (!this.coinCounts[c][1]) return;
      const t = this.coins[i];
      drawDiamond(g, t.x - t.width - 12, t.y + 10, 6, c === 'blue' ? UI.blue : UI.red);
    });
  }

  // --- Panneau central ---

  // opts : { kicker, hints: [[touche, texte], ...], color }
  showMessage(title, subtitle = '', opts = {}) {
    const { kicker = '', hints = [], color = this.color, numeric = false } = opts;
    // Texte avec des nombres : police Silkscreen (chiffres nets).
    this.subtitle.setFontFamily(numeric ? FONT_TITLE : FONT_TEXT).setFontSize(numeric ? 14 : 17);
    const acc = color === 'red' ? UI.red : color === 'gold' ? 0xffd166 : UI.blue;
    this.pKicker.setText(kicker).setVisible(!!kicker);
    this.title.setText(title).setVisible(true);
    this.subtitle.setText(subtitle).setVisible(!!subtitle);

    // Mise en page verticale selon le contenu.
    const h = 70 + (kicker ? 22 : 0) + (subtitle ? this.subtitle.height + 18 : 0) + (hints.length ? 44 : 0);
    const w = Math.max(480, this.title.width + 80, this.subtitle.width + 80);
    let y = HEIGHT / 2 - h / 2 - 10;
    const g = this.panelGfx.clear();
    g.fillStyle(UI.ink, 0.45).fillRect(0, 0, WIDTH, HEIGHT); // assombrit le jeu
    drawPanel(g, WIDTH / 2 - w / 2, y, w, h, { fill: UI.panel, alpha: 0.96, border: acc, stripe: acc, stripeW: 6 });
    y += 24;
    if (kicker) {
      this.pKicker.setY(y);
      y += 24;
    }
    this.title.setY(y + 4).setColor(UI.text);
    y += 32;
    if (subtitle) {
      this.subtitle.setY(y);
      y += this.subtitle.height + 14;
    }
    for (const o of this.hintObjs) o.destroy();
    this.hintObjs = hints.length ? keyHints(this.scene, WIDTH / 2, y + 2, hints, 101) : [];
    this.panelOpen = true;
  }

  hideMessage() {
    this.panelGfx.clear();
    for (const o of [this.pKicker, this.title, this.subtitle]) o.setVisible(false);
    for (const o of this.hintObjs) o.destroy();
    this.hintObjs = [];
    this.panelOpen = false;
  }
}
