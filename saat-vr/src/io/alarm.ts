// io: saída de alarme. MVP = Web Audio + flash visual. Pós-MVP: sirene USB (Web Serial/WebHID) com a mesma interface.
export type AlarmPattern = 'emergencia' | 'alarme' | 'beep';
export interface AlarmOutput { activate(p: AlarmPattern): void; deactivate(p?: AlarmPattern): void }

export class WebAudioAlarm implements AlarmOutput {
  private ctx: AudioContext | null = null; private nodes: Record<string, { osc: OscillatorNode; gain: GainNode; lfo?: OscillatorNode; timer?: any }> = {};
  muted = false;
  constructor(private flashEl: HTMLElement | null) {}
  private ac() { if (!this.ctx) { const C = (window as any).AudioContext || (window as any).webkitAudioContext; if (C) this.ctx = new C(); } if (this.ctx?.state === 'suspended') this.ctx.resume(); return this.ctx; }
  unlock() { this.ac(); }
  activate(p: AlarmPattern) {
    if (p === 'beep') return this.beep();
    if (this.nodes[p]) return; const ctx = this.ac(); if (!ctx) return;
    const osc = ctx.createOscillator(), gain = ctx.createGain(); gain.gain.value = this.muted ? 0 : p === 'emergencia' ? 0.18 : 0.06;
    osc.connect(gain).connect(ctx.destination);
    let lfo: OscillatorNode | undefined, timer: any;
    if (p === 'emergencia') { // sirene: varredura 600–1400 Hz
      osc.type = 'sawtooth'; osc.frequency.value = 1000; lfo = ctx.createOscillator(); const lg = ctx.createGain(); lfo.frequency.value = 0.8; lg.gain.value = 400; lfo.connect(lg).connect(osc.frequency); lfo.start();
      this.flashEl?.classList.add('on');
    } else { osc.type = 'square'; osc.frequency.value = 880; let on = true; timer = setInterval(() => { gain.gain.value = this.muted ? 0 : on ? 0.05 : 0; on = !on; }, 350); }
    osc.start(); this.nodes[p] = { osc, gain, lfo, timer };
  }
  deactivate(p?: AlarmPattern) {
    for (const k of p ? [p] : Object.keys(this.nodes)) { const n = this.nodes[k]; if (!n) continue; try { n.osc.stop(); n.lfo?.stop(); } catch {} clearInterval(n.timer); delete this.nodes[k]; if (k === 'emergencia') this.flashEl?.classList.remove('on'); }
  }
  beep() { const ctx = this.ac(); if (!ctx || this.muted) return; const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 1200; g.gain.value = 0.08; o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.08); }
  setMuted(m: boolean) { this.muted = m; for (const [k, n] of Object.entries(this.nodes)) n.gain.gain.value = m ? 0 : k === 'emergencia' ? 0.18 : 0.05; }
}
