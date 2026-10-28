// debug.js — FPS (liga/desliga, visível no VR), captura de erros (window.onerror / unhandledrejection)
// e FPS médio por estação para o relatório.
import { Panel, UI } from './kit.js';

const K_ERR = 'vrlab:errors', K_FPS = 'vrlab:fps', K_ON = 'vrlab:fpsOn';
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
const hhmmss = () => new Date().toTimeString().slice(0, 8);

export class Debug {
  constructor(version) {
    this.version = version;
    this.errors = load(K_ERR, []);        // [{t, msg, n}]
    this.byStation = load(K_FPS, {});     // {id: {f: quadros, s: segundos}}
    this.showFps = load(K_ON, true);
    this.fps = 0; this.frames = 0; this.acc = 0; this.saveT = 0; this.lastT = 0;
    this.calls = 0; this.tris = 0; this.station = '—'; this.listeners = new Set();
    window.addEventListener('error', (e) => {
      const f = e.filename ? ' (' + e.filename.split('/').pop().split('?')[0] + ':' + e.lineno + ')' : '';
      this.error((e.message || 'erro') + f);
    });
    window.addEventListener('unhandledrejection', (e) => this.error('Promise: ' + (e.reason?.message || String(e.reason))));
    // contador de FPS preso à câmera (canto inferior esquerdo)
    this.overlay = new Panel({ w: 0.12, h: 0.035, px: 320 });
    this.overlay.render = (p) => {
      p.rect(0, 0, p.W, p.H, 'rgba(10,12,14,1)');
      const c = this.fps >= 70 ? UI.ok : this.fps >= 55 ? UI.warn : UI.bad;
      p.text(this.fps.toFixed(0) + ' fps', 14, p.H / 2, { size: 44, color: c, weight: 700, mono: true });
      p.text(this.calls + ' dc', p.W - 12, p.H / 2, { size: 30, color: UI.dim, align: 'right', mono: true });
    };
    this.overlay.mesh.position.set(-0.07, -0.075, -0.4);
    this.overlay.mesh.renderOrder = 1001; this.overlay.mesh.material.depthTest = false;
    this.overlay.mesh.visible = this.showFps;
  }
  attach(camera) { this.cam = camera; camera.add(this.overlay.mesh); this.layout(false); }
  // VR: canto inferior esquerdo do olhar. Desktop: canto superior direito da janela.
  layout(xr) {
    const m = this.overlay.mesh, d = 0.4;
    if (xr || !this.cam) { m.position.set(-0.1, -0.1, -d); return; }
    const hh = d * Math.tan(this.cam.fov * Math.PI / 360), hw = hh * this.cam.aspect;
    m.position.set(hw - 0.065, hh - 0.022, -d);
  }
  setFps(on) { this.showFps = on; this.overlay.mesh.visible = on; store(K_ON, on); }

  error(msg) {
    msg = String(msg).slice(0, 300);
    const last = this.errors[this.errors.length - 1];
    if (last && last.msg === msg) last.n = (last.n || 1) + 1;
    else { this.errors.push({ t: hhmmss(), msg, n: 1 }); if (this.errors.length > 10) this.errors.shift(); }
    store(K_ERR, this.errors);
    console.warn('[debug]', msg);
    for (const fn of this.listeners) fn();
  }
  clear() { this.errors = []; store(K_ERR, this.errors); for (const fn of this.listeners) fn(); }
  clearFps() { this.byStation = {}; store(K_FPS, this.byStation); }

  // chamado a cada quadro com o tempo do requestAnimationFrame (ms)
  frame(tMs, station, info) {
    const dt = this.lastT ? (tMs - this.lastT) / 1000 : 0; this.lastT = tMs;
    if (dt <= 0 || dt > 0.5) return;
    this.frames++; this.acc += dt; this.station = station;
    const s = this.byStation[station] || (this.byStation[station] = { f: 0, s: 0 }); s.f++; s.s += dt;
    if (this.acc >= 0.5) {
      this.fps = this.frames / this.acc; this.frames = 0; this.acc = 0;
      this.calls = info.render.calls; this.tris = info.render.triangles;
      if (this.showFps) this.overlay.dirty = true;
      for (const fn of this.listeners) fn('fps');
    }
    this.saveT += dt; if (this.saveT > 5) { this.saveT = 0; store(K_FPS, this.byStation); }
    this.overlay.update();
  }
  fpsTable() {
    return Object.entries(this.byStation).filter(([, v]) => v.s > 1).sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => [k, v.f / v.s, v.s]);
  }
}
