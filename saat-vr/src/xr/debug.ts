// Depuração no VR: FPS preso à câmera (canto inferior esquerdo), últimos 10 erros (agrupados ×n) e FPS médio por área.
import type { PerspectiveCamera, WebGLRenderer } from 'three';
import { Panel, UI } from './panel';

const K_ERR = 'saat:vrErr', K_FPS = 'saat:vrFps', K_ON = 'saat:vrFpsOn';
const load = (k: string, d: any) => { try { const v = JSON.parse(localStorage.getItem(k) as string); return v ?? d; } catch { return d; } };
const store = (k: string, v: any) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } };

export class Debug {
  errors: { t: string; msg: string; n: number }[] = load(K_ERR, []); byArea: Record<string, { f: number; s: number }> = load(K_FPS, {}); showFps: boolean = load(K_ON, false);
  fps = 0; calls = 0; tris = 0; area = '—'; private frames = 0; private acc = 0; private saveT = 0; listeners = new Set<(k?: string) => void>(); overlay: Panel;
  constructor() {
    addEventListener('error', (e) => this.error((e.message || 'erro') + (e.filename ? ` (${e.filename.split('/').pop()}:${e.lineno})` : '')));
    addEventListener('unhandledrejection', (e: any) => this.error('Promise: ' + (e.reason?.message || String(e.reason))));
    this.overlay = new Panel({ w: 0.12, h: 0.035, px: 320 });
    this.overlay.render = (p) => { p.rect(0, 0, p.W, p.H, '#0a0c0e'); p.text(this.fps.toFixed(0) + ' fps', 14, p.H / 2, { size: 44, color: this.fps >= 70 ? UI.ok : this.fps >= 55 ? UI.warn : UI.bad, weight: 700, mono: true }); p.text(this.calls + ' dc', p.W - 12, p.H / 2, { size: 30, color: UI.dim, align: 'right', mono: true }); };
    const m = this.overlay.mesh; m.position.set(-0.17, 0.13, -0.42); m.renderOrder = 1001; (m.material as any).depthTest = false; m.visible = false;
  }
  attach(cam: PerspectiveCamera) { cam.add(this.overlay.mesh); }
  setVisible(xr: boolean) { this.overlay.mesh.visible = xr && this.showFps; }
  setFps(on: boolean) { this.showFps = on; this.overlay.mesh.visible = on; store(K_ON, on); }
  error(msg: string) { msg = String(msg).slice(0, 300); const l = this.errors[this.errors.length - 1]; if (l && l.msg === msg) l.n++; else { this.errors.push({ t: new Date().toTimeString().slice(0, 8), msg, n: 1 }); if (this.errors.length > 10) this.errors.shift(); } store(K_ERR, this.errors); for (const f of this.listeners) f(); }
  clear() { this.errors = []; this.byArea = {}; store(K_ERR, this.errors); store(K_FPS, this.byArea); for (const f of this.listeners) f(); }
  private last = 0;
  frame(_dt: number, area: string, r: WebGLRenderer, xr: boolean) {
    const now = performance.now(), dt = this.last ? (now - this.last) / 1000 : 0; this.last = now; if (dt <= 0 || dt > 0.5) return; this.frames++; this.acc += dt; this.area = area;
    if (xr) { const s = (this.byArea[area] ||= { f: 0, s: 0 }); s.f++; s.s += dt; }
    if (this.acc >= 0.5) { this.fps = this.frames / this.acc; this.frames = 0; this.acc = 0; this.calls = r.info.render.calls; this.tris = r.info.render.triangles; if (this.overlay.mesh.visible) this.overlay.dirty = true; for (const f of this.listeners) f('fps'); }
    this.saveT += dt; if (this.saveT > 5) { this.saveT = 0; store(K_FPS, this.byArea); } this.overlay.update();
  }
  fpsTable() { return Object.entries(this.byArea).filter(([, v]) => v.s > 1).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => [k, v.f / v.s, v.s] as [string, number, number]); }
}
