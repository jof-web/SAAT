// kit.js — utilitários compartilhados: materiais, montagem de peças (merge com cor por vértice),
// painéis de UI em canvas (modo imediato) e quadro de etiquetas em atlas (1 draw call).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------- Materiais compartilhados ----------
export const mats = {
  vc: new THREE.MeshLambertMaterial({ vertexColors: true }), // peças estáticas mescladas
  led: new THREE.MeshBasicMaterial({ color: 0xffffff }),       // LEDs (cor por instância)
};

// Clona o material de cor por vértice para uma peça que precisa de destaque próprio
export function vcMaterial() { return mats.vc.clone(); }

// ---------- Montagem de peças ----------
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const _c = new THREE.Color();

function paint(geo, color) {
  _c.set(color);
  const n = geo.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  geo.deleteAttribute('uv');
  if (geo.attributes.uv1) geo.deleteAttribute('uv1');
  return geo;
}

// Builder: junta primitivas numa única geometria com cor por vértice (1 draw call por peça)
export class Parts {
  constructor() { this.list = []; }
  add(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    _q.setFromEuler(_e.set(rx, ry, rz));
    geo.applyMatrix4(_m.compose(_p.set(x, y, z), _q, _s));
    this.list.push(paint(geo, color));
    return this;
  }
  box(w, h, d, color, x, y, z, rx, ry, rz) { return this.add(new THREE.BoxGeometry(w, h, d), color, x, y, z, rx, ry, rz); }
  cyl(rt, rb, h, color, x, y, z, rx, ry, rz, seg = 16) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), color, x, y, z, rx, ry, rz); }
  sphere(r, color, x, y, z, seg = 12) { return this.add(new THREE.SphereGeometry(r, seg, Math.max(6, seg >> 1)), color, x, y, z); }
  torus(R, r, color, x, y, z, rx, ry, rz, rs = 8, ts = 28) { return this.add(new THREE.TorusGeometry(R, r, rs, ts), color, x, y, z, rx, ry, rz); }
  build() {
    const g = mergeGeometries(this.list, false);
    for (const s of this.list) s.dispose();
    this.list.length = 0;
    g.computeBoundingSphere();
    return g;
  }
  mesh(mat = mats.vc) { return new THREE.Mesh(this.build(), mat); }
}

// ---------- Textos em canvas ----------
export const FONT = 'system-ui, "Segoe UI", Roboto, sans-serif';
export const MONO = 'ui-monospace, "Roboto Mono", Menlo, monospace';
export const UI = {
  bg: '#14181c', panel: '#1c2228', line: '#313a42', text: '#e8ebed', dim: '#98a2aa', off: '#5e666d',
  accent: '#f2c230', ok: '#3da56a', warn: '#e39b2d', bad: '#e5484d', info: '#6fb3e0',
};

// ---------- Painel de UI (canvas, modo imediato) ----------
// O dono define panel.render = (p) => { p.text(...); p.button(...); }
// O painel só redesenha quando marcado como sujo (dirty).
export class Panel {
  constructor({ w = 0.64, h = 0.5, px = 1024 } = {}) {
    this.W = px; this.H = Math.round(px * h / w);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.W; this.canvas.height = this.H;
    this.g = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false }));
    this.mesh.renderOrder = 10;
    this.w = w; this.h = h;
    this.buttons = []; this.hoverId = null; this.dirty = true; this.render = null;
    this.hitX = 0; this.hitY = 0;
    this._inv = new THREE.Matrix4(); this._o = new THREE.Vector3(); this._d = new THREE.Vector3();
  }
  // Teste de raio contra o plano do painel. Retorna distância ou Infinity e guarda o ponto em px.
  rayHit(origin, dir) {
    if (!this.mesh.visible) return Infinity;
    let p = this.mesh; while (p) { if (!p.visible) return Infinity; p = p.parent; }
    this._inv.copy(this.mesh.matrixWorld).invert();
    const o = this._o.copy(origin).applyMatrix4(this._inv);
    const d = this._d.copy(dir).transformDirection(this._inv);
    if (Math.abs(d.z) < 1e-6) return Infinity;
    const t = -o.z / d.z; if (t <= 0) return Infinity;
    const x = o.x + d.x * t, y = o.y + d.y * t;
    if (Math.abs(x) > this.w / 2 || Math.abs(y) > this.h / 2) return Infinity;
    this.hitX = (x / this.w + 0.5) * this.W; this.hitY = (0.5 - y / this.h) * this.H;
    // distância em unidades do mundo (o painel pode estar escalado)
    const sx = this.mesh.matrixWorld.elements; const scale = Math.hypot(sx[0], sx[1], sx[2]);
    return t * scale;
  }
  hover(x, y) {
    const b = this.find(x, y); const id = b ? b.id : null;
    if (id !== this.hoverId) { this.hoverId = id; this.dirty = true; }
    return b;
  }
  clearHover() { if (this.hoverId !== null) { this.hoverId = null; this.dirty = true; } }
  find(x, y) {
    for (let i = this.buttons.length - 1; i >= 0; i--) { const b = this.buttons[i]; if (!b.disabled && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b; }
    return null;
  }
  click(x, y) { const b = this.find(x, y); if (b && b.onClick) { b.onClick(); this.dirty = true; return true; } return false; }
  update() {
    if (!this.dirty || !this.render) return;
    this.dirty = false; this.buttons.length = 0;
    const g = this.g; g.fillStyle = UI.bg; g.fillRect(0, 0, this.W, this.H);
    this.render(this);
    this.tex.needsUpdate = true;
  }
  // --- primitivas de desenho ---
  rect(x, y, w, h, color) { this.g.fillStyle = color; this.g.fillRect(x, y, w, h); }
  stroke(x, y, w, h, color, lw = 2) { this.g.strokeStyle = color; this.g.lineWidth = lw; this.g.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw); }
  text(s, x, y, { size = 26, color = UI.text, align = 'left', weight = 500, mono = false, max = 0 } = {}) {
    const g = this.g; g.font = `${weight} ${size}px ${mono ? MONO : FONT}`; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle';
    if (max > 0 && g.measureText(s).width > max) { while (s.length > 1 && g.measureText(s + '…').width > max) s = s.slice(0, -1); s += '…'; }
    g.fillText(s, x, y);
  }
  // Botão: id único por página; style: {active, color, disabled, size}
  button(id, x, y, w, h, label, onClick, { active = false, color = null, disabled = false, size = 26, align = 'center' } = {}) {
    const hov = this.hoverId === id && !disabled;
    const bg = disabled ? '#181c20' : active ? (color || UI.accent) : hov ? '#2c353d' : UI.panel;
    this.rect(x, y, w, h, bg);
    this.stroke(x, y, w, h, hov ? UI.accent : UI.line, hov ? 3 : 2);
    const fg = disabled ? UI.off : active ? '#111' : UI.text;
    this.text(label, align === 'center' ? x + w / 2 : x + 14, y + h / 2 + 1, { size, color: fg, align, weight: 600, max: w - 20 });
    this.buttons.push({ id, x, y, w, h, onClick, disabled });
  }
}

// ---------- Quadro de etiquetas em atlas (todas as etiquetas de uma estação em 1 draw call) ----------
export class LabelBoard {
  constructor({ cols = 4, rows = 8, slotW = 256, slotH = 64 } = {}) {
    this.cols = cols; this.rows = rows; this.sw = slotW; this.sh = slotH;
    this.canvas = document.createElement('canvas');
    this.canvas.width = cols * slotW; this.canvas.height = rows * slotH;
    this.g = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    this.slots = []; this.pos = []; this.uv = []; this.idx = [];
    this.mesh = null; this.dirty = false;
  }
  // pos/right/up em coordenadas do pai onde o mesh será adicionado
  add({ pos, right = new THREE.Vector3(1, 0, 0), up = new THREE.Vector3(0, 1, 0), w = 0.3, h = 0.075, text = '', style = {} }) {
    const i = this.slots.length; if (i >= this.cols * this.rows) throw new Error('LabelBoard cheio');
    const cx = i % this.cols, cy = Math.floor(i / this.cols);
    const base = this.pos.length / 3;
    const rx = right.x * w / 2, ry = right.y * w / 2, rz = right.z * w / 2, ux = up.x * h / 2, uy = up.y * h / 2, uz = up.z * h / 2;
    this.pos.push(pos.x - rx - ux, pos.y - ry - uy, pos.z - rz - uz, pos.x + rx - ux, pos.y + ry - uy, pos.z + rz - uz,
      pos.x + rx + ux, pos.y + ry + uy, pos.z + rz + uz, pos.x - rx + ux, pos.y - ry + uy, pos.z - rz + uz);
    const W = this.canvas.width, H = this.canvas.height, pad = 2;
    const u0 = (cx * this.sw + pad) / W, u1 = ((cx + 1) * this.sw - pad) / W, v1 = 1 - (cy * this.sh + pad) / H, v0 = 1 - ((cy + 1) * this.sh - pad) / H;
    this.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.slots.push({ text: null, style: {} });
    this.set(i, text, style);
    return i;
  }
  build() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    geo.setIndex(this.idx); geo.computeVertexNormals(); geo.computeBoundingSphere();
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false, side: THREE.DoubleSide }));
    this.flush(true);
    return this.mesh;
  }
  // style: {bg, color, size, mono, align, weight}
  set(i, text, style) {
    const s = this.slots[i];
    if (s.text === text && (!style || (style.color === s.style.color && style.bg === s.style.bg))) return;
    s.text = text; if (style) s.style = { ...s.style, ...style }; s.dirty = true; this.dirty = true;
  }
  flush(force = false) {
    if (!this.dirty && !force) return;
    const g = this.g;
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i]; if (!s.dirty && !force) continue; s.dirty = false;
      const x = (i % this.cols) * this.sw, y = Math.floor(i / this.cols) * this.sh, st = s.style;
      g.fillStyle = st.bg || '#1c2228'; g.fillRect(x, y, this.sw, this.sh);
      const font = (sz) => `${st.weight || 700} ${sz}px ${st.mono ? MONO : FONT}`;
      let size = st.size || Math.round(this.sh * 0.5), t = s.text || ''; const max = this.sw - 16;
      g.font = font(size);
      // encolhe a fonte até caber (mín. 55%); só corta o texto se ainda não couber
      const w0 = g.measureText(t).width;
      if (w0 > max) { size = Math.max(Math.round(size * 0.55), Math.floor(size * max / w0)); g.font = font(size); }
      g.fillStyle = st.color || '#e8ebed'; g.textBaseline = 'middle';
      const al = st.align || 'center'; g.textAlign = al;
      const tx = al === 'center' ? x + this.sw / 2 : x + 10;
      while (t.length > 1 && g.measureText(t).width > max) t = t.slice(0, -1);
      g.fillText(t, tx, y + this.sh / 2 + 1);
    }
    this.dirty = false; this.tex.needsUpdate = true;
  }
}

// ---------- LEDs instanciados (1 draw call) ----------
export class LedArray {
  constructor(count, radius = 0.012) {
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(radius, 10, 6), mats.led.clone(), count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.n = 0; this.state = new Array(count).fill(-1);
    this.colors = [new THREE.Color(0x2a302b), new THREE.Color(0x3ddc6a), new THREE.Color(0xf2c230), new THREE.Color(0xe5484d)];
    for (let i = 0; i < count; i++) this.mesh.setColorAt(i, this.colors[0]);
  }
  add(pos) { const i = this.n++; _m.makeTranslation(pos.x, pos.y, pos.z); this.mesh.setMatrixAt(i, _m); this.mesh.count = this.n; return i; }
  // st: 0 apagado, 1 verde (ativo), 2 âmbar (segurando), 3 vermelho
  set(i, st) {
    if (this.state[i] === st) return; this.state[i] = st;
    this.mesh.setColorAt(i, this.colors[st]); this.mesh.instanceColor.needsUpdate = true;
  }
  finalize() { this.mesh.instanceMatrix.needsUpdate = true; this.mesh.computeBoundingSphere(); }
}
