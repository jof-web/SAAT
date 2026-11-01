// Efeitos sonoros sintetizados (sem arquivos): disjuntor, seccionadora (motor), extração (catraca), chave de terra.
export class Sfx {
  private ctx: AudioContext | null = null; muted = false;
  private ac() { if (!this.ctx) { const C = (window as any).AudioContext || (window as any).webkitAudioContext; if (C) this.ctx = new C(); } if (this.ctx?.state === 'suspended') this.ctx.resume(); return this.ctx; }
  unlock() { this.ac(); }
  private noise(dur: number, gain: number, f = 1800, t0 = 0) { const c = this.ac(); if (!c || this.muted) return; const n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3); const s = c.createBufferSource(); s.buffer = b; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; const g = c.createGain(); g.gain.value = gain; s.connect(bp).connect(g).connect(c.destination); s.start(c.currentTime + t0); }
  private tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', t0 = 0, f2?: number) { const c = this.ac(); if (!c || this.muted) return; const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = freq; if (f2) o.frequency.linearRampToValueAtTime(f2, c.currentTime + t0 + dur);
    g.gain.setValueAtTime(0, c.currentTime + t0); g.gain.linearRampToValueAtTime(gain, c.currentTime + t0 + 0.05); g.gain.linearRampToValueAtTime(0, c.currentTime + t0 + dur); o.connect(g).connect(c.destination); o.start(c.currentTime + t0); o.stop(c.currentTime + t0 + dur + 0.05); }
  play(k: string) {
    if (k === 'cbr') { this.noise(0.25, 0.9, 900); this.tone(70, 0.25, 0.4, 'sine'); this.tone(180, 1.6, 0.05, 'sawtooth', 0.35, 260); }
    else if (k === 'dis') { this.tone(95, 4.0, 0.06, 'sawtooth', 0, 105); this.noise(0.15, 0.4, 2500, 3.9); }
    else if (k === 'rack') { for (let i = 0; i < 10; i++) this.noise(0.05, 0.35, 3200, i * 0.28); }
    else if (k === 'earth') { this.noise(0.18, 0.6, 1400, 1.2); this.tone(420, 0.3, 0.06, 'triangle', 1.2); }
  }
}
