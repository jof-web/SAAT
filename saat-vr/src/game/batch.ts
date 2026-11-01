// Agrupador de geometria estática: junta peças por (bloco de 12 m × material) para poucos draw calls e
// recorte por visão funcionando. Recalcula UV em coordenadas de mundo para texturas repetidas (densidade constante).
import {
  BufferGeometry, BoxGeometry, CylinderGeometry, LatheGeometry, TubeGeometry, SphereGeometry, CatmullRomCurve3, Matrix4, Quaternion, Euler, Vector3, Vector2,
  Mesh, Object3D, Material, BufferAttribute, Group,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { UVSCALE } from './materials';
import { GFX, lambertOf, avgColor } from './gfx';
import { MeshLambertMaterial, Color } from 'three';

const m4 = new Matrix4(), q = new Quaternion(), eu = new Euler(), v1 = new Vector3(), v2 = new Vector3();
const BOX = new BoxGeometry(1, 1, 1);
const CYL: Record<string, CylinderGeometry> = {};
const cylG = (seg0: number, top = 0.5, open = false) => { const seg = GFX.lite ? Math.max(5, Math.round(seg0 / 2)) : seg0; return (CYL[seg + ':' + top + ':' + open] ||= new CylinderGeometry(top, 0.5, 1, seg, 1, open)); };
const VC = new MeshLambertMaterial({ vertexColors: true });
const RB: Record<string, BufferGeometry> = {};

export interface BatchOpts { chunk?: number; shadows?: boolean }
export class Batch {
  private bins = new Map<string, { mat: Material; geos: BufferGeometry[]; cx: number; cz: number; cast: boolean }>();
  constructor(private o: BatchOpts = {}) {}
  /** Zona lógica (ex.: 'casa', 'patio') — vira um Group separado para renderização por zona. */
  zone = 'patio';
  cast = true;
  add(g: BufferGeometry, mat: Material) {
    g.computeBoundingSphere(); const c = g.boundingSphere!.center, S = this.o.chunk ?? 12;
    const cx = Math.floor(c.x / S), cz = Math.floor(c.z / S), key = `${this.zone}|${cx}|${cz}|${mat.uuid}|${this.cast ? 1 : 0}`;
    let b = this.bins.get(key); if (!b) this.bins.set(key, (b = { mat, geos: [], cx, cz, cast: this.cast })); b.geos.push(g);
  }
  private put(base: BufferGeometry, mat: Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0, rz = 0, order: 'XYZ' | 'YXZ' = 'XYZ') {
    eu.set(rx, ry, rz, order); q.setFromEuler(eu); m4.compose(v1.set(x, y, z), q, v2.set(sx, sy, sz)); this.add(base.clone().applyMatrix4(m4), mat);
  }
  box(w: number, h: number, d: number, mat: Material, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0) { this.put(BOX, mat, x, y, z, w, h, d, rx, ry, rz); }
  /** Caixa com cantos arredondados (painéis, gabinetes). */
  rbox(w: number, h: number, d: number, r: number, mat: Material, x: number, y: number, z: number, ry = 0) {
    const k = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${r}`; const g = (RB[k] ||= new RoundedBoxGeometry(w, h, d, GFX.lite ? 1 : 2, r));
    this.put(g, mat, x, y, z, 1, 1, 1, 0, ry, 0);
  }
  cyl(r: number, h: number, mat: Material, x: number, y: number, z: number, rx = 0, rz = 0, seg = 16, ry = 0, rTop = r) {
    this.put(cylG(seg, (0.5 * rTop) / r), mat, x, y, z, r * 2, h, r * 2, rx, ry, rz);
  }
  /** Cilindro horizontal ao longo de X. */
  cylX(r: number, len: number, mat: Material, x: number, y: number, z: number, seg = 16) { this.cyl(r, len, mat, x, y, z, 0, Math.PI / 2, seg); }
  cylZ(r: number, len: number, mat: Material, x: number, y: number, z: number, seg = 16) { this.cyl(r, len, mat, x, y, z, Math.PI / 2, 0, seg); }
  sphere(r: number, mat: Material, x: number, y: number, z: number, seg = 12) { if (GFX.lite) seg = Math.max(6, seg >> 1); const g = new SphereGeometry(r, seg, Math.max(4, Math.round(seg * 0.6))); g.translate(x, y, z); this.add(g, mat); }
  lathe(pts: Vector2[], mat: Material, x: number, y: number, z: number, seg = 18, rx = 0, rz = 0) { const g = new LatheGeometry(pts, GFX.lite ? Math.max(8, seg >> 1) : seg); eu.set(rx, 0, rz); q.setFromEuler(eu); m4.compose(v1.set(x, y, z), q, v2.set(1, 1, 1)); g.applyMatrix4(m4); this.add(g, mat); }
  /** Barra prismática entre dois pontos (perfis, hastes). */
  bar(a: Vector3, b: Vector3, w: number, mat: Material, d = w) {
    const dir = b.clone().sub(a), len = dir.length(); if (len < 1e-4) return;
    q.setFromUnitVectors(v1.set(0, 1, 0), dir.normalize()); m4.compose(a.clone().add(b).multiplyScalar(0.5), q, v2.set(w, len, d)); this.add(BOX.clone().applyMatrix4(m4), mat);
  }
  /** Tubo redondo entre dois pontos. */
  rod(a: Vector3, b: Vector3, r: number, mat: Material, seg = 8) {
    const dir = b.clone().sub(a), len = dir.length(); if (len < 1e-4) return;
    q.setFromUnitVectors(v1.set(0, 1, 0), dir.normalize()); m4.compose(a.clone().add(b).multiplyScalar(0.5), q, v2.set(r * 2, len, r * 2)); this.add(cylG(seg).clone().applyMatrix4(m4), mat);
  }
  /** Cantoneira L entre dois pontos (treliças). */
  angle(a: Vector3, b: Vector3, s: number, mat: Material) {
    const dir = b.clone().sub(a), len = dir.length(); if (len < 1e-4) return; const n = dir.clone().normalize();
    q.setFromUnitVectors(v1.set(0, 1, 0), n); const c = a.clone().add(b).multiplyScalar(0.5), t = s * 0.18;
    const g1 = BOX.clone(); g1.scale(s, 1, t); g1.translate(0, 0, s / 2 - t / 2); const g2 = BOX.clone(); g2.scale(t, 1, s); g2.translate(s / 2 - t / 2, 0, 0);
    for (const g of [g1, g2]) { m4.compose(c, q, v2.set(1, len, 1)); this.add(g.applyMatrix4(m4), mat); }
  }
  /** Cabo flexível com flecha (catenária aproximada). */
  wire(a: Vector3, b: Vector3, r: number, mat: Material, sag = 0.4, seg = 16, radial = 6) {
    const mid = a.clone().lerp(b, 0.5); mid.y -= sag; const p1 = a.clone().lerp(mid, 0.5); p1.y -= sag * 0.15; const p2 = mid.clone().lerp(b, 0.5); p2.y -= sag * 0.15;
    this.add(new TubeGeometry(new CatmullRomCurve3([a, p1, mid, p2, b]), GFX.lite ? Math.max(6, seg >> 1) : seg, r, GFX.lite ? 3 : radial, false), mat);
  }
  path(pts: Vector3[], r: number, mat: Material, seg = 24, radial = 6) { this.add(new TubeGeometry(new CatmullRomCurve3(pts), GFX.lite ? Math.max(4, seg >> 1) : seg, r, GFX.lite ? 3 : radial, false), mat); }
  geo(g: BufferGeometry, mat: Material, x = 0, y = 0, z = 0, ry = 0) { this.put(g, mat, x, y, z, 1, 1, 1, 0, ry, 0); }

  /** Gera as malhas. Retorna os grupos por zona. */
  flush(parent: Object3D): Record<string, Group> {
    const zones: Record<string, Group> = {};
    if (GFX.lite) (this as any).liteMerge();
    for (const [key, b] of this.bins) {
      if (!b.geos.length) continue; const zone = key.split('|')[0];
      const gs = b.geos.map((g) => { let x = g.index ? g.toNonIndexed() : g; if (!x.getAttribute('uv')) x.setAttribute('uv', new BufferAttribute(new Float32Array(x.getAttribute('position').count * 2), 2)); for (const n of Object.keys(x.attributes)) if (!['position', 'normal', 'uv', ...(b.mat === VC ? ['color'] : [])].includes(n)) x.deleteAttribute(n); return x; });
      const g = mergeGeometries(gs, false); if (!g) continue;
      const sc = UVSCALE.get(b.mat); if (sc && b.mat !== VC) worldUV(g, sc);
      const m = new Mesh(g, GFX.lite ? lambertOf(b.mat) : b.mat); m.castShadow = b.cast && !GFX.lite; m.receiveShadow = !GFX.lite; m.matrixAutoUpdate = false; m.updateMatrix(); m.userData.batch = true;
      (zones[zone] ||= Object.assign(new Group(), { name: 'zona:' + zone })).add(m);
      if (b.mat === VC) { g.deleteAttribute('uv'); }
      gs.forEach((x) => x.dispose());
    }
    for (const z of Object.values(zones)) parent.add(z);
    this.bins.clear(); return zones;
  }
}
/** Perfil leve: tudo que é opaco, sem textura repetida e sem emissivo vira um lote único por bloco de 24 m com cor de vértice. */
Batch.prototype['liteMerge' as any] = function (this: any) {
  const out = new Map<string, any>();
  for (const [key, b] of this.bins as Map<string, any>) {
    const m: any = b.mat, emis = m.emissive && m.emissiveIntensity > 0 && (m.emissive.r + m.emissive.g + m.emissive.b) > 0;
    const keep = (m.transparent && (m.opacity ?? 1) < 0.8) || m.alphaTest > 0 || emis || m.userData?.keepTex || !m.color;
    const zone = key.split('|')[0], cx = Math.floor((b.cx * 12) / 24), cz = Math.floor((b.cz * 12) / 24);
    if (keep) { const k3 = `${zone}|${cx}|${cz}|${m.uuid}`; const t3 = out.get(k3); if (t3) t3.geos.push(...b.geos); else out.set(k3, { ...b, geos: [...b.geos], cx, cz }); continue; }
    const k2 = `${zone}|${cx}|${cz}|VC`;
    let t = out.get(k2); if (!t) out.set(k2, (t = { mat: VC, geos: [], cx, cz, cast: false }));
    const col = new Color().copy(m.color); if (m.map) col.multiply(avgColor(m.map));
    for (const g0 of b.geos as BufferGeometry[]) { const g = g0.index ? g0.toNonIndexed() : g0; const n = g.getAttribute('position').count, arr = new Float32Array(n * 3); for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; } g.setAttribute('color', new BufferAttribute(arr, 3)); t.geos.push(g); }
  }
  this.bins = out;
};
/** UV triplanar pelo eixo dominante da normal (m por repetição = s). */
export function worldUV(g: BufferGeometry, s: number) {
  const p = g.getAttribute('position'), n = g.getAttribute('normal'), uv = g.getAttribute('uv') as BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i)), x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (ay >= ax && ay >= az) uv.setXY(i, x / s, z / s); else if (ax >= az) uv.setXY(i, z / s, y / s); else uv.setXY(i, x / s, y / s);
  }
  uv.needsUpdate = true;
}
/** Perfil de isolador (saias alternadas) para LatheGeometry. */
export function insulatorProfile(h: number, rCore: number, rBig: number, rSmall: number, pitch = 0.075, flange = 0.06): Vector2[] {
  if (GFX.lite) pitch *= 2;
  const pts: Vector2[] = [new Vector2(0, 0), new Vector2(rCore * 1.25, 0), new Vector2(rCore * 1.25, flange), new Vector2(rCore, flange + 0.005)];
  const n = Math.max(2, Math.floor((h - 2 * flange - 0.04) / pitch));
  for (let i = 0; i < n; i++) {
    const y0 = flange + 0.02 + i * pitch, r = i % 2 ? rSmall : rBig, t = pitch * 0.2;
    pts.push(new Vector2(rCore, y0), new Vector2(r, y0 + pitch * 0.18), new Vector2(r, y0 + pitch * 0.18 + t * 0.4), new Vector2(rCore, y0 + pitch * 0.62));
  }
  pts.push(new Vector2(rCore, h - flange - 0.005), new Vector2(rCore * 1.25, h - flange), new Vector2(rCore * 1.25, h), new Vector2(0, h));
  return pts;
}
