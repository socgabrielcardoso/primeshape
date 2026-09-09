export class Timeline {
  constructor() { this.reset(); }
  reset() {
    this.previous = null;
    this.closedSince = null;
    this.wideSince = null;
    this.blinkUntil = 0;
    this.yawnUntil = 0;
    this.blinks = [];
    this.yawns = [];
    this.intervals = [];
    this.wasClosed = false;
    this.yawnRecorded = false;
    this.anchor = null;
  }
  update(metrics, now) {
    if (!metrics || metrics.qualidade < 0.4) { this.reset(); return this.result(now); }
    const [x, y, w, h] = metrics.caixa;
    const anchor = [x + w / 2, y + h / 2, w];
    if (this.anchor && (Math.abs(anchor[0] - this.anchor[0]) + Math.abs(anchor[1] - this.anchor[1]) > Math.max(this.anchor[2], 0.12) || Math.abs(w - this.anchor[2]) > this.anchor[2] * 0.6)) this.reset();
    if (this.previous !== null && (now <= this.previous || now - this.previous > 0.8)) this.reset();
    this.anchor = anchor;
    const closed = metrics.olho_esquerdo_fechado && metrics.olho_direito_fechado;
    if (this.previous !== null) this.intervals.push([this.previous, now, this.wasClosed]);
    if (closed) this.closedSince ??= now;
    else if (this.closedSince !== null) {
      const duration = now - this.closedSince;
      if (duration >= 0.06 && duration <= 0.65) { this.blinks.push(now); this.blinkUntil = now + 0.5; }
      this.closedSince = null;
    }
    if (metrics.boca_ampla) {
      this.wideSince ??= now;
      if (now - this.wideSince >= 1.6 && !this.yawnRecorded) { this.yawns.push(now); this.yawnRecorded = true; }
      if (this.yawnRecorded) this.yawnUntil = now + 0.8;
    } else { this.wideSince = null; this.yawnRecorded = false; }
    this.previous = now;
    this.wasClosed = closed;
    this.blinks = this.blinks.filter(t => t >= now - 60);
    this.yawns = this.yawns.filter(t => t >= now - 60);
    this.intervals = this.intervals.filter(row => row[1] > now - 60);
    return this.result(now);
  }
  result(now) {
    let covered = 0, closed = 0;
    for (const [start, end, wasClosed] of this.intervals) {
      const duration = Math.max(0, end - Math.max(start, now - 60));
      covered += duration;
      if (wasClosed) closed += duration;
    }
    return {
      olhos_fechados_s: this.closedSince === null ? 0 : now - this.closedSince,
      boca_ampla_s: this.wideSince === null ? 0 : now - this.wideSince,
      piscada_recente: now < this.blinkUntil, possivel_bocejo: now < this.yawnUntil,
      piscadas_60s: this.blinks.length, possiveis_bocejos_60s: this.yawns.length,
      perclos_observado: covered >= 10 ? closed / covered : null, cobertura_s: covered
    };
  }
}
