// Chargement d'un niveau JSON et conversions beat <-> temps.
// Un niveau ne contient jamais de pixels : seulement des beats.

// Petite empreinte d'un texte (pour savoir si un fichier a changé).
function hashText(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 31) + text.charCodeAt(i)) | 0;
  return h;
}

export class LevelSystem {
  static hash(text) {
    return hashText(text);
  }

  constructor(data) {
    this.name = data.name ?? 'Sans nom';
    this.bpm = data.bpm ?? 120;
    this.music = data.music ?? null;
    this.offset = data.offset ?? 0; // secondes avant le beat 0 dans le fichier audio
    this.obstacles = (data.obstacles ?? []).map((o) => ({ ...o }));
    this.sortObstacles();
  }

  // Charge un niveau. preferDraft : en éditeur, on reprend le brouillon
  // sauvegardé automatiquement s'il existe. Sans fichier, on prend le brouillon.
  // Un brouillon n'est repris que s'il a été fait à partir de la version
  // actuelle du fichier (sinon le fichier a changé entre-temps : on l'ignore).
  static async load(id, { preferDraft = false } = {}) {
    const draft = LevelSystem.loadDraft(id);
    const res = await fetch(`levels/${id}.json`, { cache: 'no-store' });
    const text = res.ok ? await res.text() : null;
    const base = text ? hashText(text) : null;
    let level;
    if (draft && (!text || (preferDraft && draft.base === base))) level = new LevelSystem(draft.data);
    else if (text) level = new LevelSystem(JSON.parse(text));
    else throw new Error(`Niveau introuvable : levels/${id}.json`);
    level.base = base;
    return level;
  }

  static draftKey(id) {
    return `robins-colors:draft:${id}`;
  }

  static loadDraft(id) {
    try {
      const raw = localStorage.getItem(LevelSystem.draftKey(id));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Ancien format (sans "data") : niveau seul, version du fichier inconnue.
      return parsed.data ? parsed : { data: parsed, base: undefined };
    } catch (e) {
      return null;
    }
  }

  saveDraft(id) {
    try {
      localStorage.setItem(LevelSystem.draftKey(id), JSON.stringify({ data: this.toJSON(), base: this.base ?? null }));
    } catch (e) {
      /* stockage indisponible */
    }
  }

  static deleteDraft(id) {
    try {
      localStorage.removeItem(LevelSystem.draftKey(id));
    } catch (e) {
      /* stockage indisponible */
    }
  }

  // Liste des niveaux : levels/index.json + niveaux créés dans l'éditeur.
  static async list() {
    let levels = [];
    try {
      const res = await fetch('levels/index.json', { cache: 'no-store' });
      if (res.ok) levels = await res.json();
    } catch (e) {
      /* pas d'index */
    }
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const m = /^robins-colors:draft:(.+)$/.exec(key);
        if (!m || levels.some((l) => l.id === m[1])) continue;
        const data = LevelSystem.loadDraft(m[1]).data;
        levels.push({ id: m[1], name: data.name ?? m[1], draftOnly: true });
      }
    } catch (e) {
      /* stockage indisponible */
    }
    return levels;
  }

  // Texte JSON lisible (un obstacle par ligne).
  toText() {
    const data = this.toJSON();
    const lines = data.obstacles.map((o) => '    ' + JSON.stringify(o).replace(/,"/g, ', "').replace(/":/g, '": ')).join(',\n');
    return JSON.stringify({ ...data, obstacles: [] }, null, 2).replace('"obstacles": []', `"obstacles": [\n${lines}\n  ]`) + '\n';
  }

  get secondsPerBeat() {
    return 60 / this.bpm;
  }

  beatToTime(beat) {
    return this.offset + beat * this.secondsPerBeat;
  }

  timeToBeat(time) {
    return (time - this.offset) / this.secondsPerBeat;
  }

  sortObstacles() {
    this.obstacles.sort((a, b) => a.beat - b.beat);
  }

  // Dernier beat du niveau : la fin de la musique si on la connaît
  // (musicEndBeat, fixé après chargement du mp3), sinon le dernier obstacle + 8.
  get endBeat() {
    if (this.musicEndBeat) return this.musicEndBeat;
    let last = 0;
    for (const o of this.obstacles) last = Math.max(last, o.beat + (o.length ?? 1));
    return last + 8;
  }

  toJSON() {
    return {
      name: this.name,
      bpm: this.bpm,
      music: this.music,
      offset: this.offset,
      obstacles: this.obstacles.map((o) => {
        const out = { beat: o.beat, type: o.type };
        if (o.color && o.color !== 'gray') out.color = o.color;
        if (o.length != null) out.length = o.length;
        if (o.height != null) out.height = o.height;
        return out;
      }),
    };
  }
}
