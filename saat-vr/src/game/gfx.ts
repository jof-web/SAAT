// Perfil gráfico leve (Quest / VR): materiais Lambert com propriedades espelhadas do original (o jogo continua mudando
// cor/emissivo no material PBR e o Lambert acompanha), lotes por cor de vértice e recorte de peças pequenas por distância.
import { Material, MeshLambertMaterial, MeshBasicMaterial, Object3D, Color, SRGBColorSpace, type Texture, Vector3, Mesh, BatchedMesh, BufferGeometry, BufferAttribute, Matrix4 } from 'three';

export const GFX = { lite: false, xr: false };
/** Quest/Pico (navegador do óculos) ou forçado por #vrlite / ?vrlite / localStorage saat:lite. */
export function detectLite() {
  try { return /OculusBrowser|Quest|Pico/i.test(navigator.userAgent) || /vrlite/.test(location.href) || localStorage.getItem('saat:lite') === '1'; } catch { return false; }
}
const conv = new WeakMap<Material, Material>();
/** Lambert equivalente ao material PBR (cache). color/emissive são o MESMO objeto; emissiveIntensity/opacity/visible são espelhados. */
export function lambertOf(m: any): Material {
  if (!m || !m.isMeshStandardMaterial) return m;
  let l = conv.get(m) as any; if (l) return l;
  l = new MeshLambertMaterial({ map: m.map, emissiveMap: m.emissiveMap, alphaMap: m.alphaMap, transparent: m.transparent, alphaTest: m.alphaTest, side: m.side, vertexColors: m.vertexColors, depthWrite: m.depthWrite, depthTest: m.depthTest, fog: m.fog, polygonOffset: m.polygonOffset, polygonOffsetFactor: m.polygonOffsetFactor, polygonOffsetUnits: m.polygonOffsetUnits, toneMapped: m.toneMapped });
  l.color = m.color; l.emissive = m.emissive; l.name = m.name;
  for (const k of ['emissiveIntensity', 'opacity', 'visible']) Object.defineProperty(l, k, { get: () => m[k], set: (v) => { m[k] = v; }, configurable: true, enumerable: true });
  conv.set(m, l); return l;
}
export const vrMat = <T extends Material>(m: T): T => ((GFX.lite || GFX.xr ? lambertOf(m) : m) as T);
/** Troca todos os materiais PBR da cena por Lambert (on) ou restaura (off). */
export function presetLambert(root: Object3D, on: boolean) {
  root.traverse((o: any) => { if (!o.isMesh || o.userData.noPreset) return;
    if (on) { const lm = lambertOf(o.material); if (lm !== o.material) { o.userData.stdMat = o.material; o.material = lm; } }
    else if (o.userData.stdMat && !GFX.lite) { o.material = o.userData.stdMat; delete o.userData.stdMat; } });
}
const avg = new WeakMap<Texture, Color>();
/** Cor média de uma textura de canvas (para assar em cor de vértice). */
export function avgColor(t: Texture | null | undefined): Color {
  if (!t) return new Color(1, 1, 1); let c = avg.get(t); if (c) return c;
  c = new Color(1, 1, 1);
  try { const img: any = t.image; const cv = document.createElement('canvas'); cv.width = cv.height = 8; const g = cv.getContext('2d')!; g.drawImage(img, 0, 0, 8, 8); const d = g.getImageData(0, 0, 8, 8).data; let r = 0, gg = 0, b = 0, n = 0, a = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 30) continue; r += d[i]; gg += d[i + 1]; b += d[i + 2]; a += d[i + 3]; n++; } if (n) c.setRGB(r / n / 255, gg / n / 255, b / n / 255, SRGBColorSpace); void a; } catch { /* sem canvas: branco */ }
  avg.set(t, c); return c;
}
/** Recorte por distância de peças pequenas (placas, lâmpadas, botões) usando layers (não mexe em .visible da lógica). */
export class SmallCull {
  private list: Mesh[] = []; private t = 0; private built = false;
  constructor(private root: Object3D, private R = 14, private maxR = 1.2) {}
  private rin = new WeakSet<Mesh>();
  private build() { const v = new Vector3(); this.root.traverse((o: any) => { if (!o.isMesh || o.userData.batch || o.isBatchedMesh || !o.geometry) return; if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); o.getWorldScale(v); const r = o.geometry.boundingSphere.radius * Math.max(v.x, v.y, v.z); if (r < this.maxR) { this.list.push(o); let p = o.parent; while (p && !String(p.name).startsWith('Z:')) p = p.parent; if (p && (p.name === 'Z:casa' || p.name === 'Z:bateria')) this.rin.add(o); } }); this.built = true; }
  reset() { this.list = []; this.built = false; }
  update(dt: number, p: Vector3, on: boolean) {
    this.t += dt; if (this.t < 0.25) return; this.t = 0; if (!this.built) { if (!on) return; this.build(); }
    const R2 = this.R * this.R, Ri2 = 8 * 8, w = new Vector3();
    for (const m of this.list) { if (m.userData.batched) continue; if (!on) { m.layers.set(0); continue; } m.getWorldPosition(w); const d = (w.x - p.x) ** 2 + (w.z - p.z) ** 2 + (w.y - p.y) ** 2 * 0.3; m.layers.set(d < (this.rin.has(m) ? Ri2 : R2) ? 0 : 5); }
  }
}

/** Perfil leve: junta as peças soltas e opacas de cada zona (botões, lâmpadas, portas, alavancas…) em BatchedMesh
 *  (1–2 draw calls por zona). A peça original continua existindo (lógica, animação, cor, visibilidade) e é espelhada
 *  a cada quadro; ela só deixa de ser desenhada (layer 5). Lâmpadas e painéis emissivos vão num lote sem luz. */
const NG = new Map<string, BufferGeometry>();
function normGeo(g: BufferGeometry) {
  let n = NG.get(g.uuid); if (n) return n; n = new BufferGeometry(); const pos = g.getAttribute('position'), cnt = pos.count;
  n.setAttribute('position', pos.clone()); n.setAttribute('normal', g.getAttribute('normal') ? g.getAttribute('normal').clone() : new BufferAttribute(new Float32Array(cnt * 3), 3));
  n.setAttribute('uv', g.getAttribute('uv') ? g.getAttribute('uv').clone() : new BufferAttribute(new Float32Array(cnt * 2), 2));
  if (g.index) n.setIndex(g.index.clone()); else { const ix = new Uint32Array(cnt); for (let i = 0; i < cnt; i++) ix[i] = i; n.setIndex(new BufferAttribute(ix, 1)); }
  NG.set(g.uuid, n); return n;
}
interface BItem { s: Mesh; b: BatchedMesh; id: number; zone: Object3D; basic: boolean; m: Float32Array; vis: boolean; col: number; off?: boolean }
export class AutoBatch {
  static cur: AutoBatch | null = null; items: BItem[] = []; batches: BatchedMesh[] = []; private c = new Color(); private M = new Matrix4(); private byMesh = new Map<Object3D, BItem>();
  /** Tira do lote as malhas de um objeto que a mão pegou (passa a desenhar sozinho, fora da zona). */
  detach(root: Object3D) { root.traverse((o) => { const it = this.byMesh.get(o); if (it && !it.off) { it.off = true; it.b.setVisibleAt(it.id, false); it.vis = false; o.layers.set(0); } }); }
  reattach(root: Object3D) { root.traverse((o) => { const it = this.byMesh.get(o); if (it?.off) { it.off = false; o.layers.set(5); it.m.fill(NaN); it.col = -1; it.vis = false; } }); }
  build(zones: Record<string, Object3D>) {
    AutoBatch.cur = this;
    for (const zone of Object.values(zones)) {
      const lit: Mesh[] = [], bas: Mesh[] = [];
      zone.traverse((o: any) => {
        if (!o.isMesh || o.isBatchedMesh || o.isInstancedMesh || o.userData.batch || o.userData.noPreset || o.userData.solo || !o.geometry?.getAttribute('position')) return;
        const m: any = o.userData.stdMat || o.material; if (!m || Array.isArray(m) || m.visible === false || m.transparent || m.map || m.isShaderMaterial || m.isMeshBasicMaterial || !m.color) return;
        if (m.userData?.glow || (m.emissive && m.emissiveIntensity > 0.5)) bas.push(o); else lit.push(o);
      });
      for (const [list, basic] of [[lit, false], [bas, true]] as [Mesh[], boolean][]) {
        if (!list.length) continue; const geos = new Map<string, BufferGeometry>(); for (const s of list) geos.set(s.geometry.uuid, normGeo(s.geometry));
        let nv = 0, ni = 0; for (const g of geos.values()) { nv += g.getAttribute('position').count; ni += g.index!.count; }
        const mat = basic ? new MeshBasicMaterial({ color: 0xffffff, toneMapped: true }) : new MeshLambertMaterial({ color: 0xffffff });
        const b = new BatchedMesh(list.length, nv, ni, mat); b.name = 'lote:' + zone.name + (basic ? ':luz' : ''); b.userData.noPreset = true; b.frustumCulled = false; (b as any).perObjectFrustumCulled = true;
        const gid = new Map<string, number>(); for (const [k, g] of geos) gid.set(k, b.addGeometry(g));
        for (const s of list) { const id = b.addInstance(gid.get(s.geometry.uuid)!); const it: BItem = { s, b, id, zone, basic, m: new Float32Array(16).fill(NaN), vis: true, col: -1 }; this.items.push(it); this.byMesh.set(s, it); s.userData.batched = true; s.layers.set(5); }
        zone.add(b); this.batches.push(b);
      }
    }
    this.sync(); return this;
  }
  sync() {
    for (const it of this.items) {
      if (it.off) continue; const s = it.s; let v = s.visible; let p = s.parent; while (v && p && p !== it.zone) { v = p.visible; p = p.parent; }
      const m: any = s.material; if (v && m && m.visible === false) v = false;
      if (v !== it.vis) { it.b.setVisibleAt(it.id, v); it.vis = v; } if (!v) continue;
      const e = s.matrixWorld.elements; let ch = false; for (let i = 0; i < 16; i++) if (e[i] !== it.m[i]) { ch = true; break; }
      if (ch) { it.m.set(e); this.M.fromArray(e); it.b.setMatrixAt(it.id, this.M); }
      if (it.basic) { if (m.emissiveIntensity > 0.05 && (m.emissive.r + m.emissive.g + m.emissive.b) > 0) this.c.copy(m.emissive); else this.c.copy(m.color).multiplyScalar(0.6); } else this.c.copy(m.color);
      const hx = this.c.getHex(); if (hx !== it.col) { it.col = hx; it.b.setColorAt(it.id, this.c); }
    }
  }
}
