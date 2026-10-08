// Chargement d'un niveau JSON et conversions beat <-> temps.
// Un niveau ne contient jamais de pixels : seulement des beats.

export class LevelSystem {
  constructor(data) {
    this.name = data.name ?? 'Sans nom';
    this.bpm = data.bpm ?? 120;
    this.music = data.music ?? null;
    this.offset = data.offset ?? 0; // secondes avant le beat 0 dans le fichier audio
    this.obstacles = (data.obstacles ?? []).map((o) => ({ ...o }));
    this.sortObstacles();
  }

  static async load(id) {
    const res = await fetch(`levels/${id}.json`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Niveau introuvable : levels/${id}.json`);
    return new LevelSystem(await res.json());
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

  // Dernier beat utile du niveau (fin du dernier obstacle + marge).
  get endBeat() {
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
