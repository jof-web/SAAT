// Som sintetizado (sem arquivos): ambiente (vento / ar-condicionado), zumbido espacial dos trafos, passos por piso,
// portas, cliques, manobras (Sfx), arco, choque, batimento, metrônomo da RCP, rádio com voz do sistema (pt-BR).
import { Sfx } from '../io/sfx';
import type { Vector3 } from 'three';

export class Audio extends Sfx {
  private c: AudioContext | null = null; private amb: { wind: GainNode; room: GainNode; hum: { g: GainNode; p: PannerNode }[]; zone: GainNode } | null = null;
  vol = 0.8; voz = true;
  private ac2() { if (!this.c) { const C = (window as any).AudioContext || (window as any).webkitAudioContext; if (C) this.c = new C(); } if (this.c?.state === 'suspended') this.c.resume(); return this.c; }
  start(trafos: Vector3[]) {
    const c = this.ac2(); if (!c || this.amb) return; const master = c.createGain(); master.gain.value = this.vol; master.connect(c.destination);
    const noise = (sec = 2) => { const b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < d.length; i++) { l = l * 0.97 + (Math.random() * 2 - 1) * 0.03; d[i] = l * 6; } const s = c.createBufferSource(); s.buffer = b; s.loop = true; s.start(); return s; };
    const wind = c.createGain(); wind.gain.value = 0; const wf = c.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 500; noise(4).connect(wf).connect(wind).connect(master);
    const room = c.createGain(); room.gain.value = 0; const rf = c.createBiquadFilter(); rf.type = 'bandpass'; rf.frequency.value = 180; rf.Q.value = 0.6; noise(3).connect(rf).connect(room).connect(master);
    const hum = trafos.map((p) => { const g = c.createGain(); g.gain.value = 0.12; const pn = c.createPanner(); pn.panningModel = 'HRTF'; pn.distanceModel = 'inverse'; pn.refDistance = 3; pn.rolloffFactor = 1.4; pn.positionX.value = p.x; pn.positionY.value = 2.5; pn.positionZ.value = p.z;
      for (const [f, a] of [[120, 1], [240, 0.45], [360, 0.18]] as const) { const o = c.createOscillator(); o.frequency.value = f; const og = c.createGain(); og.gain.value = a * 0.25; o.connect(og).connect(g); o.start(); }
      g.connect(pn).connect(master); return { g, p: pn }; });
    const zone = c.createGain(); zone.gain.value = 0; const zf = c.createBiquadFilter(); zf.type = 'highpass'; zf.frequency.value = 2500; noise(1).connect(zf).connect(zone).connect(master);
    this.amb = { wind, room, hum, zone };
  }
  /** Atualiza ouvinte e ambiente. */
  listen(p: Vector3, yaw: number, indoor: boolean, energ: boolean[]) {
    const c = this.c, a = this.amb; if (!c || !a) return; const L = c.listener as any, t = c.currentTime;
    if (L.positionX) { L.positionX.setTargetAtTime(p.x, t, 0.05); L.positionY.setTargetAtTime(p.y, t, 0.05); L.positionZ.setTargetAtTime(p.z, t, 0.05); L.forwardX.setTargetAtTime(-Math.sin(yaw), t, 0.05); L.forwardY.setTargetAtTime(0, t, 0.05); L.forwardZ.setTargetAtTime(-Math.cos(yaw), t, 0.05); }
    a.wind.gain.setTargetAtTime(indoor ? 0.004 : 0.03, t, 0.4); a.room.gain.setTargetAtTime(indoor ? 0.03 : 0, t, 0.4);
    a.hum.forEach((hh, i) => hh.g.gain.setTargetAtTime(energ[i] ? (indoor ? 0.03 : 0.12) : 0, t, 0.3));
  }
  zone(k: number) { const a = this.amb, c = this.c; if (!a || !c) return; a.zone.gain.setTargetAtTime(k * 0.08, c.currentTime, 0.1); }
  private beep(f: number, dur: number, g = 0.2, type: OscillatorType = 'sine', f2?: number, t0 = 0) { const c = this.ac2(); if (!c) return; const o = c.createOscillator(), gg = c.createGain(); o.type = type; o.frequency.value = f; if (f2) o.frequency.exponentialRampToValueAtTime(f2, c.currentTime + t0 + dur); gg.gain.setValueAtTime(g, c.currentTime + t0); gg.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t0 + dur); o.connect(gg).connect(c.destination); o.start(c.currentTime + t0); o.stop(c.currentTime + t0 + dur + 0.05); }
  private burst(dur: number, g: number, f: number, t0 = 0, q = 0.8) { const c = this.ac2(); if (!c) return; const n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const s = c.createBufferSource(); s.buffer = b; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; const gg = c.createGain(); gg.gain.value = g; s.connect(bp).connect(gg).connect(c.destination); s.start(c.currentTime + t0); }
  step(surface: string) { this.burst(0.07, surface === 'patio' ? 0.22 : 0.08, surface === 'patio' ? 2200 : 900, 0, surface === 'patio' ? 0.5 : 2); }
  door(open: boolean) { this.burst(0.12, 0.25, 600); this.beep(open ? 180 : 140, 0.25, 0.05, 'triangle'); if (!open) this.burst(0.08, 0.35, 300, 0.45); }
  gate() { for (let i = 0; i < 6; i++) this.burst(0.06, 0.15, 1800 + i * 50, i * 0.12); }
  click() { this.burst(0.03, 0.4, 3000, 0, 4); }
  arc(k: number) { this.burst(0.5, 1.2 * k, 300, 0, 0.4); this.burst(1.2, 0.6 * k, 2500, 0.05, 0.3); this.beep(60, 0.6, 0.6 * k, 'sawtooth', 30); }
  accident(tipo: string) { if (tipo === 'arco') this.arc(1); else { this.beep(60, 1.2, 0.5, 'sawtooth'); this.burst(0.8, 0.4, 4000); } setTimeout(() => this.beep(4200, 4, 0.06), 600); for (let i = 0; i < 6; i++) setTimeout(() => this.thump(), 1500 + i * 900); }
  thump() { this.beep(55, 0.18, 0.5, 'sine', 40); }
  tick() { this.beep(1400, 0.03, 0.08, 'square'); }
  shockDea() { this.beep(900, 0.2, 0.2, 'square'); this.burst(0.3, 0.6, 600, 0.2); }
  radio(text: string) { this.burst(0.08, 0.25, 2500, 0, 1); if (!this.voz || !('speechSynthesis' in window)) return; try { const u = new SpeechSynthesisUtterance(text.replace(/^COS[^:]*:\s*/, '')); u.lang = 'pt-BR'; u.rate = 1.08; u.volume = 0.8; const v = speechSynthesis.getVoices().find((x) => x.lang?.startsWith('pt')); if (v) u.voice = v; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch { /* sem voz */ } }
}
