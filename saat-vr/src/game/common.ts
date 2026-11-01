// Peças comuns: contexto de modelagem, placas e sinalização (NR-26/ISO 7010 simplificados), proxies de interação,
// peças clicáveis (modo inspeção) e figura humana (vítima / colega).
import {
  Mesh, PlaneGeometry, BoxGeometry, MeshStandardMaterial, MeshBasicMaterial, CanvasTexture, SRGBColorSpace, Object3D, Group, Vector3,
  CapsuleGeometry, SphereGeometry, CylinderGeometry, DoubleSide, type Material,
} from 'three';
import type { Batch } from './batch';
import type { Mats } from './materials';

export type AABB = [number, number, number, number];
export type Zone = 'patio' | 'casa' | 'bateria' | 'externo' | 'shell';
export interface Inter {
  id: string; kind: string; label: string; verb: string; hit: Mesh; zone: Zone; eq?: string;
  view?: { pos: Vector3; look: Vector3; fov?: number };
  range?: number; data?: any;
}
export interface Part { inter: string; id: string; label: string; act: string; hit: Mesh; vis: Object3D[]; data?: any; tool?: string }
export interface MCtx { b: Batch; M: Mats; root: Record<Zone, Group>; col: AABB[]; inter: Inter[]; parts: Part[]; zone: Zone }

const INVIS = new MeshBasicMaterial({ visible: false });
const BOXG = new BoxGeometry(1, 1, 1);
export const FONT = '"Barlow Condensed","Barlow","Arial Narrow",Arial,sans-serif';
export const MONO = '"IBM Plex Mono",Consolas,monospace';

/** Proxy invisível para mira/inspeção. */
export function inter(c: MCtx, o: Omit<Inter, 'hit' | 'zone'> & { box: [number, number, number]; at: [number, number, number]; ry?: number; zone?: Zone }) {
  const m = new Mesh(BOXG, INVIS); m.scale.set(...o.box); m.position.set(...o.at); if (o.ry) m.rotation.y = o.ry; m.userData.inter = o.id;
  const zone = o.zone || c.zone; c.root[zone].add(m); m.updateMatrixWorld();
  const it: Inter = { id: o.id, kind: o.kind, label: o.label, verb: o.verb, hit: m, zone, eq: o.eq, view: o.view, range: o.range, data: o.data }; c.inter.push(it); return it;
}
/** Peça clicável no modo inspeção (o proxy é um pouco maior que a peça). */
export function part(c: MCtx, interId: string, id: string, label: string, act: string, vis: Object3D[], box: [number, number, number], at: Vector3 | [number, number, number], o: { data?: any; tool?: string; ry?: number } = {}) {
  const m = new Mesh(BOXG, INVIS); m.scale.set(...box); if (Array.isArray(at)) m.position.set(...at); else m.position.copy(at); if (o.ry) m.rotation.y = o.ry;
  m.userData.part = id; c.root[c.zone].add(m); m.updateMatrixWorld();
  const p: Part = { inter: interId, id, label, act, hit: m, vis, data: o.data, tool: o.tool }; c.parts.push(p); return p;
}
export const colBox = (c: MCtx, x: number, z: number, hw: number, hd = hw) => c.col.push([x - hw, z - hd, x + hw, z + hd]);
/** Malha dinâmica (não agrupada). */
export function dmesh(geo: any, mat: Material, x: number, y: number, z: number, parent: Object3D, sx = 1, sy = 1, sz = 1) { const m = new Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); return m; }
export const dbox = (w: number, h: number, d: number, mat: Material, x: number, y: number, z: number, p: Object3D) => dmesh(BOXG, mat, x, y, z, p, w, h, d);
const CY: Record<number, CylinderGeometry> = {};
export const dcyl = (r: number, h: number, mat: Material, x: number, y: number, z: number, p: Object3D, seg = 16) => dmesh((CY[seg] ||= new CylinderGeometry(0.5, 0.5, 1, seg)), mat, x, y, z, p, r * 2, h, r * 2);

// ---------- texturas de texto e sinalização ----------
const texCache = new Map<string, CanvasTexture>();
function ctex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, W: number, H: number) => void) {
  let t = texCache.get(key); if (t) return t;
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!, w, h);
  t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 8; texCache.set(key, t); return t;
}
function fitText(g: CanvasRenderingContext2D, lines: string[], W: number, H: number, weight = 700, family = FONT, maxFrac = 0.62, y0 = 0, align: CanvasTextAlign = 'center', x0 = W / 2) {
  let fs = (H / lines.length) * maxFrac; const f = (s: number) => `${weight} ${s}px ${family}`; g.font = f(fs);
  while (lines.some((l) => g.measureText(l).width > W * 0.9) && fs > 6) { fs -= 1; g.font = f(fs); }
  g.textAlign = align; g.textBaseline = 'middle'; lines.forEach((l, i) => g.fillText(l, x0, y0 + ((i + 0.5) * H) / lines.length + fs * 0.04));
}
export type SignKind = 'plaqueta' | 'perigo' | 'obrig' | 'proib' | 'saida' | 'extintor' | 'info' | 'aviso' | 'verde' | 'placa';
/** Placa/plaqueta. w,h em metros. */
export function sign(kind: SignKind, lines: string[], w: number, h: number, o: { bg?: string; fg?: string; picto?: string } = {}) {
  const ppm = 420, W = Math.max(64, Math.round(w * ppm)), H = Math.max(32, Math.round(h * ppm));
  const t = ctex(kind + '|' + lines.join('/') + '|' + w + 'x' + h + (o.bg || '') + (o.picto || ''), W, H, (g) => {
    const bd = Math.max(2, H * 0.035);
    if (kind === 'plaqueta') { g.fillStyle = o.bg || '#f2c230'; g.fillRect(0, 0, W, H); g.strokeStyle = '#111'; g.lineWidth = bd * 1.4; g.strokeRect(bd, bd, W - 2 * bd, H - 2 * bd); g.fillStyle = o.fg || '#111'; fitText(g, lines, W, H, 700, FONT, 0.7); return; }
    if (kind === 'perigo' || kind === 'aviso') {
      g.fillStyle = '#f7f5ef'; g.fillRect(0, 0, W, H); const top = H * 0.26; g.fillStyle = kind === 'perigo' ? '#c8102e' : '#f2c230'; g.fillRect(0, 0, W, top);
      g.fillStyle = kind === 'perigo' ? '#fff' : '#111'; fitText(g, [kind === 'perigo' ? 'PERIGO' : 'ATENÇÃO'], W, top, 800, FONT, 0.78);
      const ts = Math.min(W * 0.3, (H - top) * 0.8), tx = W * 0.05, ty = top + (H - top - ts) / 2; tri(g, tx, ty, ts); g.fillStyle = '#111'; fitText(g, lines, W - ts - tx * 2, H - top, 700, FONT, 0.55, top, 'center', ts + tx * 1.5 + (W - ts - tx * 2) / 2);
      g.strokeStyle = '#222'; g.lineWidth = bd; g.strokeRect(bd / 2, bd / 2, W - bd, H - bd); return;
    }
    if (kind === 'obrig' || kind === 'proib') {
      g.fillStyle = '#f7f5ef'; g.fillRect(0, 0, W, H); const r = Math.min(H * 0.32, W * 0.2), cx = W / 2, cy = H * 0.36;
      g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fillStyle = kind === 'obrig' ? '#1f5aa6' : '#fff'; g.fill();
      if (kind === 'proib') { g.lineWidth = r * 0.2; g.strokeStyle = '#c8102e'; g.stroke(); }
      picto(g, o.picto || (kind === 'obrig' ? 'capacete' : 'fumar'), cx, cy, r * 0.62, kind === 'obrig' ? '#fff' : '#111');
      if (kind === 'proib') { g.beginPath(); g.moveTo(cx - r * 0.7, cy - r * 0.7); g.lineTo(cx + r * 0.7, cy + r * 0.7); g.lineWidth = r * 0.2; g.strokeStyle = '#c8102e'; g.stroke(); }
      g.fillStyle = '#111'; fitText(g, lines, W, H * 0.3, 700, FONT, 0.5, H * 0.68); g.strokeStyle = '#333'; g.lineWidth = bd; g.strokeRect(bd / 2, bd / 2, W - bd, H - bd); return;
    }
    const bg = o.bg || (kind === 'saida' || kind === 'verde' ? '#00843d' : kind === 'extintor' ? '#c8102e' : kind === 'placa' ? '#e9e6dc' : '#1d252c');
    const fg = o.fg || (kind === 'placa' ? '#1b1f24' : '#fff');
    g.fillStyle = bg; g.fillRect(0, 0, W, H); g.fillStyle = fg;
    if (kind === 'saida') { arrow(g, W * 0.12, H / 2, H * 0.32, fg); fitText(g, lines, W * 0.75, H, 800, FONT, 0.6, 0, 'center', W * 0.6); return; }
    if (kind === 'extintor') { picto(g, 'extintor', W / 2, H * 0.4, Math.min(W, H) * 0.28, '#fff'); fitText(g, lines, W, H * 0.3, 700, FONT, 0.6, H * 0.68); return; }
    fitText(g, lines, W, H, kind === 'placa' ? 600 : 700, FONT, 0.62);
    if (kind === 'placa') { g.strokeStyle = '#8f8b80'; g.lineWidth = bd; g.strokeRect(bd / 2, bd / 2, W - bd, H - bd); }
  });
  const m = new Mesh(new PlaneGeometry(w, h), new MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.0 })); m.castShadow = false; return m;
}
export function tri(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.beginPath(); g.moveTo(x + s / 2, y); g.lineTo(x + s, y + s * 0.88); g.lineTo(x, y + s * 0.88); g.closePath(); g.fillStyle = '#f2c230'; g.fill(); g.lineWidth = s * 0.07; g.strokeStyle = '#111'; g.lineJoin = 'round'; g.stroke();
  // raio (ISO 7010 W012 simplificado)
  const cx = x + s / 2, cy = y + s * 0.55, k = s * 0.22; g.beginPath(); g.moveTo(cx + k * 0.25, cy - k * 1.25); g.lineTo(cx - k * 0.55, cy + k * 0.12); g.lineTo(cx - k * 0.02, cy + k * 0.12); g.lineTo(cx - k * 0.3, cy + k * 1.15); g.lineTo(cx + k * 0.6, cy - k * 0.25); g.lineTo(cx + k * 0.06, cy - k * 0.25); g.closePath(); g.fillStyle = '#111'; g.fill();
}
function arrow(g: CanvasRenderingContext2D, x: number, y: number, s: number, c: string) { g.fillStyle = c; g.beginPath(); g.moveTo(x - s * 0.2, y - s * 0.6); g.lineTo(x + s * 0.5, y); g.lineTo(x - s * 0.2, y + s * 0.6); g.lineTo(x - s * 0.2, y + s * 0.25); g.lineTo(x - s * 0.9, y + s * 0.25); g.lineTo(x - s * 0.9, y - s * 0.25); g.lineTo(x - s * 0.2, y - s * 0.25); g.closePath(); g.fill(); }
/** Pictogramas simplificados (traço sólido). */
export function picto(g: CanvasRenderingContext2D, k: string, cx: number, cy: number, s: number, c: string) {
  g.fillStyle = c; g.strokeStyle = c; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = s * 0.12;
  if (k === 'capacete') { g.beginPath(); g.arc(cx, cy + s * 0.15, s * 0.62, Math.PI, 0); g.fill(); g.fillRect(cx - s * 0.85, cy + s * 0.12, s * 1.7, s * 0.16); g.fillRect(cx - s * 0.08, cy - s * 0.55, s * 0.16, s * 0.3); }
  else if (k === 'luva') { g.beginPath(); g.ellipse(cx, cy + s * 0.15, s * 0.42, s * 0.5, 0, 0, 7); g.fill(); for (let i = 0; i < 4; i++) g.fillRect(cx - s * 0.36 + i * s * 0.2, cy - s * 0.75, s * 0.15, s * 0.6); g.save(); g.translate(cx + s * 0.38, cy); g.rotate(-0.7); g.fillRect(-s * 0.08, -s * 0.4, s * 0.16, s * 0.45); g.restore(); g.fillRect(cx - s * 0.35, cy + s * 0.55, s * 0.7, s * 0.3); }
  else if (k === 'oculos') { g.beginPath(); g.ellipse(cx - s * 0.38, cy, s * 0.3, s * 0.22, 0, 0, 7); g.ellipse(cx + s * 0.38, cy, s * 0.3, s * 0.22, 0, 0, 7); g.fill(); g.fillRect(cx - s * 0.1, cy - s * 0.06, s * 0.2, s * 0.08); g.fillRect(cx - s * 0.9, cy - s * 0.1, s * 0.25, s * 0.08); g.fillRect(cx + s * 0.65, cy - s * 0.1, s * 0.25, s * 0.08); }
  else if (k === 'botina') { g.beginPath(); g.moveTo(cx - s * 0.35, cy - s * 0.7); g.lineTo(cx + s * 0.05, cy - s * 0.7); g.lineTo(cx + s * 0.08, cy + s * 0.1); g.lineTo(cx + s * 0.7, cy + s * 0.25); g.lineTo(cx + s * 0.75, cy + s * 0.6); g.lineTo(cx - s * 0.4, cy + s * 0.6); g.closePath(); g.fill(); }
  else if (k === 'facial') { g.beginPath(); g.arc(cx, cy - s * 0.2, s * 0.55, Math.PI, 0); g.fill(); g.globalAlpha = 0.85; g.fillRect(cx - s * 0.5, cy - s * 0.2, s, s * 0.8); g.globalAlpha = 1; }
  else if (k === 'raio') { const k2 = s * 0.6; g.beginPath(); g.moveTo(cx + k2 * 0.3, cy - k2 * 1.3); g.lineTo(cx - k2 * 0.6, cy + k2 * 0.15); g.lineTo(cx, cy + k2 * 0.15); g.lineTo(cx - k2 * 0.3, cy + k2 * 1.3); g.lineTo(cx + k2 * 0.65, cy - k2 * 0.25); g.lineTo(cx + k2 * 0.08, cy - k2 * 0.25); g.closePath(); g.fill(); }
  else if (k === 'fumar') { g.fillRect(cx - s * 0.75, cy, s * 1.2, s * 0.22); g.fillRect(cx + s * 0.5, cy, s * 0.15, s * 0.22); g.beginPath(); g.moveTo(cx + s * 0.62, cy - s * 0.15); g.quadraticCurveTo(cx + s * 0.4, cy - s * 0.5, cx + s * 0.7, cy - s * 0.8); g.stroke(); }
  else if (k === 'extintor') { g.fillRect(cx - s * 0.28, cy - s * 0.4, s * 0.56, s * 1.2); g.beginPath(); g.arc(cx, cy - s * 0.4, s * 0.28, Math.PI, 0); g.fill(); g.fillRect(cx - s * 0.1, cy - s * 0.85, s * 0.2, s * 0.25); g.beginPath(); g.moveTo(cx + s * 0.1, cy - s * 0.78); g.quadraticCurveTo(cx + s * 0.75, cy - s * 0.8, cx + s * 0.6, cy + s * 0.1); g.stroke(); }
  else if (k === 'olhos') { g.beginPath(); g.ellipse(cx, cy, s * 0.8, s * 0.42, 0, 0, 7); g.fill(); g.fillStyle = '#1f5aa6'; g.beginPath(); g.arc(cx, cy, s * 0.24, 0, 7); g.fill(); }
  else if (k === 'dea') { g.beginPath(); g.moveTo(cx, cy + s * 0.75); g.bezierCurveTo(cx - s * 1.1, cy - s * 0.1, cx - s * 0.5, cy - s * 0.95, cx, cy - s * 0.35); g.bezierCurveTo(cx + s * 0.5, cy - s * 0.95, cx + s * 1.1, cy - s * 0.1, cx, cy + s * 0.75); g.fill(); g.fillStyle = '#00843d'; const k2 = s * 0.35; g.beginPath(); g.moveTo(cx + k2 * 0.2, cy - k2 * 1.1); g.lineTo(cx - k2 * 0.5, cy + k2 * 0.1); g.lineTo(cx + k2 * 0.05, cy + k2 * 0.1); g.lineTo(cx - k2 * 0.2, cy + k2 * 1.1); g.lineTo(cx + k2 * 0.55, cy - k2 * 0.2); g.lineTo(cx + k2 * 0.05, cy - k2 * 0.2); g.closePath(); g.fill(); }
}
/** Coloca placa no grupo da zona. */
export function plate(c: MCtx, kind: SignKind, lines: string[], w: number, h: number, x: number, y: number, z: number, ry = 0, o: { bg?: string; fg?: string; picto?: string } = {}) {
  const m = sign(kind, lines, w, h, o); m.position.set(x, y, z); m.rotation.y = ry; c.root[c.zone].add(m); return m;
}
/** Textura de mostrador/visor dinâmico (canvas). */
export function canvasTex(w: number, h: number) { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 4; return { c, g: c.getContext('2d')!, t }; }

// ---------- figura humana (low poly, articulada) ----------
export function human(M: Mats, o: { pose?: 'pe' | 'deitado'; capacete?: boolean } = {}) {
  const g = new Group(), fr = M.fr, skin = M.skin, boot = M.black;
  const cap = (r: number, l: number, mat: Material) => new Mesh(new CapsuleGeometry(r, l, 4, 10), mat);
  const torso = cap(0.17, 0.36, fr); torso.position.y = 1.2; torso.scale.set(1.15, 1, 0.75); g.add(torso);
  const head = new Mesh(new SphereGeometry(0.11, 16, 12), skin); head.position.y = 1.62; g.add(head);
  if (o.capacete !== false) { const h = new Mesh(new SphereGeometry(0.135, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.helmet); h.position.y = 1.64; g.add(h); const br = new Mesh(new CylinderGeometry(0.16, 0.16, 0.012, 20), M.helmet); br.position.set(0, 1.645, 0.03); g.add(br); }
  const limb = (x: number, y: number, r: number, l: number, mat: Material, name: string) => { const p = new Group(); p.position.set(x, y, 0); const m = cap(r, l, mat); m.position.y = -l / 2 - r; p.add(m); p.name = name; g.add(p); return p; };
  const aL = limb(-0.24, 1.46, 0.055, 0.5, fr, 'bracoE'), aR = limb(0.24, 1.46, 0.055, 0.5, fr, 'bracoD');
  for (const a of [aL, aR]) { const hd = new Mesh(new SphereGeometry(0.05, 10, 8), skin); hd.position.y = -0.66; a.add(hd); }
  const lL = limb(-0.1, 0.92, 0.075, 0.68, fr, 'pernaE'), lR = limb(0.1, 0.92, 0.075, 0.68, fr, 'pernaD');
  for (const l of [lL, lR]) { const b = new Mesh(new BoxGeometry(0.12, 0.1, 0.26), boot); b.position.set(0, -0.9, 0.05); l.add(b); }
  g.traverse((x: any) => { if (x.isMesh) { x.castShadow = true; x.receiveShadow = true; } });
  if (o.pose === 'deitado') { g.rotation.order = 'YXZ'; g.rotation.x = -Math.PI / 2; g.position.y = 0.17; aL.rotation.z = -0.35; aR.rotation.z = 0.55; lL.rotation.z = -0.1; lR.rotation.z = 0.06; }
  return g;
}
export { DoubleSide, Vector3 };
