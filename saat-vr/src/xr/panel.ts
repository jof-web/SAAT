// Painel de interface em canvas para o VR (porte do kit.js do sandbox): modo imediato, redesenha só quando sujo,
// clique pelo raio do controle. 1024 px para 0,64 m; texto ≥ 22 px; botões ≥ 56 px.
import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, Matrix4, Vector3 } from 'three';

export const FONT = '"Barlow Condensed", "Barlow", system-ui, sans-serif';
export const MONO = '"IBM Plex Mono", ui-monospace, monospace';
export const UI = { bg: '#14181c', panel: '#1c2228', line: '#313a42', text: '#e8ebed', dim: '#98a2aa', off: '#5e666d', accent: '#f2c230', ok: '#3da56a', warn: '#e39b2d', bad: '#e5484d', info: '#6fb3e0' };

interface Btn { id: string; x: number; y: number; w: number; h: number; onClick: (() => void) | null; disabled: boolean }
export class Panel {
  W: number; H: number; canvas = document.createElement('canvas'); g: CanvasRenderingContext2D; tex: CanvasTexture; mesh: Mesh;
  w: number; h: number; transparent: boolean; buttons: Btn[] = []; hoverId: string | null = null; dirty = true; render: ((p: Panel) => void) | null = null; hitX = 0; hitY = 0;
  private inv = new Matrix4(); private o = new Vector3(); private d = new Vector3();
  constructor({ w = 0.64, h = 0.5, px = 1024, transparent = false } = {}) {
    this.W = px; this.H = Math.round((px * h) / w); this.canvas.width = this.W; this.canvas.height = this.H; this.g = this.canvas.getContext('2d')!;
    this.tex = new CanvasTexture(this.canvas); this.tex.colorSpace = SRGBColorSpace; this.tex.anisotropy = 4;
    this.mesh = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ map: this.tex, toneMapped: false, transparent, fog: false }));
    this.mesh.renderOrder = 10; this.mesh.userData.noPreset = true; this.w = w; this.h = h; this.transparent = transparent;
  }
  /** Raio contra o plano: distância (m) ou Infinity; guarda o ponto em px. */
  rayHit(origin: Vector3, dir: Vector3) {
    let p: any = this.mesh; while (p) { if (!p.visible) return Infinity; p = p.parent; }
    this.inv.copy(this.mesh.matrixWorld).invert(); const o = this.o.copy(origin).applyMatrix4(this.inv), d = this.d.copy(dir).transformDirection(this.inv);
    if (Math.abs(d.z) < 1e-6) return Infinity; const t = -o.z / d.z; if (t <= 0) return Infinity;
    const x = o.x + d.x * t, y = o.y + d.y * t; if (Math.abs(x) > this.w / 2 || Math.abs(y) > this.h / 2) return Infinity;
    this.hitX = (x / this.w + 0.5) * this.W; this.hitY = (0.5 - y / this.h) * this.H;
    const e = this.mesh.matrixWorld.elements; return t * Math.hypot(e[0], e[1], e[2]);
  }
  hover(x: number, y: number) { const b = this.find(x, y), id = b ? b.id : null; if (id !== this.hoverId) { this.hoverId = id; this.dirty = true; } return b; }
  clearHover() { if (this.hoverId !== null) { this.hoverId = null; this.dirty = true; } }
  find(x: number, y: number) { for (let i = this.buttons.length - 1; i >= 0; i--) { const b = this.buttons[i]; if (!b.disabled && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b; } return null; }
  click(x: number, y: number) { const b = this.find(x, y); if (b?.onClick) { b.onClick(); this.dirty = true; return true; } return false; }
  update() { if (!this.dirty || !this.render) return; this.dirty = false; this.buttons.length = 0; if (this.transparent) this.g.clearRect(0, 0, this.W, this.H); else { this.g.fillStyle = UI.bg; this.g.fillRect(0, 0, this.W, this.H); } this.render(this); this.tex.needsUpdate = true; }
  rect(x: number, y: number, w: number, h: number, c: string) { this.g.fillStyle = c; this.g.fillRect(x, y, w, h); }
  stroke(x: number, y: number, w: number, h: number, c: string, lw = 2) { this.g.strokeStyle = c; this.g.lineWidth = lw; this.g.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw); }
  /** Texto com ajuste: encolhe a fonte até 45 % antes de cortar. */
  text(s: string, x: number, y: number, { size = 26, color = UI.text, align = 'left' as CanvasTextAlign, weight = 600, mono = false, max = 0 } = {}) {
    const g = this.g, f = (z: number) => `${weight} ${z}px ${mono ? MONO : FONT}`; g.font = f(size); g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle';
    if (max > 0) { const w0 = g.measureText(s).width; if (w0 > max) { const z = Math.max(Math.round(size * 0.45), Math.floor((size * max) / w0)); g.font = f(z); } while (s.length > 1 && g.measureText(s).width > max) s = s.slice(0, -2) + '…'; }
    g.fillText(s, x, y);
  }
  button(id: string, x: number, y: number, w: number, h: number, label: string, onClick: (() => void) | null, { active = false, color = '' as string, disabled = false, size = 26, align = 'center' as 'center' | 'left' } = {}) {
    const hov = this.hoverId === id && !disabled, bg = disabled ? '#181c20' : active ? color || UI.accent : hov ? '#2c353d' : UI.panel;
    this.rect(x, y, w, h, bg); this.stroke(x, y, w, h, hov ? UI.accent : UI.line, hov ? 3 : 2);
    this.text(label, align === 'center' ? x + w / 2 : x + 14, y + h / 2 + 1, { size, color: disabled ? UI.off : active ? '#111' : UI.text, align, weight: 600, max: w - 20 });
    this.buttons.push({ id, x, y, w, h, onClick, disabled });
  }
}
