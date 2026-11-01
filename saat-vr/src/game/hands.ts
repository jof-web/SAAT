// "Viewmodel": mãos (com a luva/manga que o treinando está usando), ferramenta na mão e o tablet robusto.
// Renderizado por cima da cena principal (limpa só a profundidade), então não atravessa paredes.
import {
  Scene, PerspectiveCamera, Group, Mesh, MeshStandardMaterial, BoxGeometry, CapsuleGeometry, CylinderGeometry, SphereGeometry, TorusGeometry,
  HemisphereLight, DirectionalLight, Vector3, PlaneGeometry, MeshBasicMaterial, type WebGLRenderer, type Texture,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const std = (c: number, r = 0.6, m = 0) => new MeshStandardMaterial({ color: c, roughness: r, metalness: m });
function mesh(g: any, m: any, x = 0, y = 0, z = 0, p?: Group) { const o = new Mesh(g, m); o.position.set(x, y, z); p?.add(o); return o; }

export const TOOL_NAMES: Record<string, string> = {
  detector_mt: 'Detector de tensão 15 kV', detector_at: 'Detector 145 kV (vara)', vara_manobra: 'Vara de manobra', manivela_extracao: 'Manivela de extração',
  alavanca_terra: 'Alavanca da chave de terra', manivela_secc: 'Manivela da seccionadora', kit_bloqueio: 'Kit de bloqueio (cadeado)', aterr_mt: 'Aterramento temporário MT',
  radio: 'Rádio portátil', lampada: 'Lâmpada sobressalente', sinalizacao: 'Sinalização (fita/cones)', tapete: 'Tapete isolante', dea: 'DEA (desfibrilador)',
};

export class Hands {
  scene = new Scene(); cam = new PerspectiveCamera(52, 1, 0.01, 10); rig = new Group();
  right = new Group(); left = new Group(); glove = std(0xb98466, 0.65); cuff = std(0x1a1a1a, 0.8); sleeve = std(0x2a3a52, 0.85);
  tools: Record<string, Group> = {}; tool: string | null = null; tablet = new Group(); screen: Mesh;
  mode: 'none' | 'tool' | 'tablet' = 'none'; private k = 0; private kTab = 0; private t = 0; useAnim = 0;
  constructor() {
    this.scene.add(this.rig); this.scene.add(new HemisphereLight(0xe8eef4, 0x4a4540, 1.4)); const dl = new DirectionalLight(0xfff1dc, 1.8); dl.position.set(-1, 2, 1); this.scene.add(dl);
    this.right = this.hand(1); this.left = this.hand(-1); this.rig.add(this.right, this.left);
    this.buildTools(); this.screen = this.buildTablet(); this.rig.add(this.tablet);
    this.right.visible = this.left.visible = false; this.tablet.visible = false;
  }
  setEnv(t: Texture | null) { this.scene.environment = t; }
  private hand(side: 1 | -1) {
    const g = new Group(), palm = new RoundedBoxGeometry(0.082, 0.03, 0.095, 2, 0.012);
    const p = mesh(palm, this.glove, 0, 0, 0, g); p.castShadow = false;
    for (let i = 0; i < 4; i++) { const f = mesh(new CapsuleGeometry(0.0095, 0.05, 3, 8), this.glove, -0.03 + i * 0.02, -0.005, -0.075 - (i === 0 || i === 3 ? -0.006 : 0), g); f.rotation.x = Math.PI / 2 + 0.55; f.position.y -= 0.018; }
    const th = mesh(new CapsuleGeometry(0.011, 0.04, 3, 8), this.glove, -side * 0.048, -0.008, -0.025, g); th.rotation.set(Math.PI / 2, 0, side * 0.7);
    const cf = mesh(new CylinderGeometry(0.038, 0.04, 0.06, 14), this.cuff, 0, 0, 0.075, g); cf.rotation.x = Math.PI / 2; cf.scale.set(1, 1, 0.75);
    const sl = mesh(new CylinderGeometry(0.046, 0.05, 0.32, 14), this.sleeve, 0, 0.0, 0.25, g); sl.rotation.x = Math.PI / 2;
    g.userData.cuff = cf; return g;
  }
  /** Luvas e mangas conforme o EPI vestido. */
  setGear(o: { isolante: boolean; cobertura: boolean; pvc: boolean; fr: boolean }) {
    const c = o.cobertura ? 0x9a6a3c : o.isolante ? 0x1d1d1f : o.pvc ? 0x2f7a3c : 0xb98466; this.glove.color.setHex(c); this.glove.roughness = o.isolante && !o.cobertura ? 0.45 : 0.75;
    this.cuff.color.setHex(o.isolante ? (o.cobertura ? 0x1d1d1f : 0xd8b020) : o.pvc ? 0x2f7a3c : 0xb98466); this.sleeve.color.setHex(o.fr ? 0x2a3a52 : 0x6f7a80);
  }
  private buildTools() {
    const Y = std(0xe0b21e, 0.5), O = std(0xe86a1c, 0.5), G = std(0x2a2d30, 0.5), A = std(0xc9ced1, 0.3, 0.9), R = std(0xb3262b, 0.45), B = std(0x1f5aa6, 0.5), K = std(0x111214, 0.6), W = std(0xeceae4, 0.4);
    const mk = (id: string, f: (g: Group) => void) => { const g = new Group(); f(g); g.visible = false; this.right.add(g); this.tools[id] = g; };
    mk('detector_mt', (g) => { mesh(new CylinderGeometry(0.014, 0.014, 0.42, 10), Y, 0, 0.02, -0.2, g).rotation.x = Math.PI / 2 - 0.35; mesh(new RoundedBoxGeometry(0.05, 0.05, 0.12, 2, 0.01), Y, 0, 0.1, -0.42, g); mesh(new CylinderGeometry(0.006, 0.015, 0.07, 10), O, 0, 0.13, -0.5, g).rotation.x = Math.PI / 2 - 0.35; const led = mesh(new SphereGeometry(0.008, 8, 6), new MeshStandardMaterial({ color: 0x2fd36b, emissive: 0x2fd36b, emissiveIntensity: 0 }), 0.026, 0.1, -0.42, g); g.userData.led = led; });
    mk('detector_at', (g) => { const p = mesh(new CylinderGeometry(0.016, 0.02, 1.4, 10), B, 0, 0.12, -0.6, g); p.rotation.x = Math.PI / 2 - 0.55; mesh(new RoundedBoxGeometry(0.06, 0.06, 0.13, 2, 0.01), Y, 0, 0.5, -1.2, g); const led = mesh(new SphereGeometry(0.01, 8, 6), new MeshStandardMaterial({ color: 0x2fd36b, emissive: 0x2fd36b, emissiveIntensity: 0 }), 0.03, 0.5, -1.2, g); g.userData.led = led; });
    mk('vara_manobra', (g) => { const p = mesh(new CylinderGeometry(0.016, 0.02, 1.5, 10), Y, 0, 0.14, -0.62, g); p.rotation.x = Math.PI / 2 - 0.55; mesh(new TorusGeometry(0.03, 0.006, 6, 12), A, 0, 0.55, -1.25, g); });
    mk('manivela_extracao', (g) => { const r = mesh(new CylinderGeometry(0.009, 0.009, 0.22, 8), A, 0, 0.02, -0.12, g); r.rotation.x = Math.PI / 2; mesh(new CylinderGeometry(0.016, 0.016, 0.03, 6), A, 0, 0.02, -0.23, g).rotation.x = Math.PI / 2; mesh(new BoxGeometry(0.12, 0.012, 0.012), A, 0.06, 0.02, -0.02, g); mesh(new CylinderGeometry(0.014, 0.014, 0.06, 10), K, 0.12, 0.05, -0.02, g); });
    mk('alavanca_terra', (g) => { const r = mesh(new CylinderGeometry(0.011, 0.011, 0.45, 8), std(0x4a4f53, 0.5, 0.5), 0, 0.03, -0.22, g); r.rotation.x = Math.PI / 2; mesh(new CylinderGeometry(0.018, 0.018, 0.04, 6), A, 0, 0.03, -0.45, g).rotation.x = Math.PI / 2; mesh(new CylinderGeometry(0.02, 0.02, 0.1, 10), R, 0, 0.03, 0.0, g).rotation.x = Math.PI / 2; });
    mk('manivela_secc', (g) => { const r = mesh(new CylinderGeometry(0.012, 0.012, 0.4, 8), A, 0, 0.02, -0.2, g); r.rotation.x = Math.PI / 2; mesh(new BoxGeometry(0.18, 0.016, 0.016), A, 0.09, 0.02, 0, g); mesh(new CylinderGeometry(0.016, 0.016, 0.08, 10), K, 0.18, 0.06, 0, g); });
    mk('kit_bloqueio', (g) => { mesh(new BoxGeometry(0.04, 0.04, 0.018), R, 0, 0.03, -0.05, g); const sh = mesh(new TorusGeometry(0.014, 0.0035, 6, 12, Math.PI), A, 0, 0.055, -0.05, g); void sh; mesh(new BoxGeometry(0.05, 0.08, 0.002), R, 0.03, -0.01, -0.06, g).rotation.z = 0.2; });
    mk('aterr_mt', (g) => { mesh(new BoxGeometry(0.05, 0.08, 0.04), Y, 0, 0.05, -0.08, g); for (let i = 0; i < 3; i++) mesh(new TorusGeometry(0.07, 0.008, 6, 16), K, 0, -0.04 + i * 0.012, 0.0, g).rotation.x = Math.PI / 2; });
    mk('radio', (g) => { mesh(new RoundedBoxGeometry(0.055, 0.12, 0.035, 2, 0.008), K, 0, 0.06, -0.04, g); mesh(new CylinderGeometry(0.006, 0.006, 0.09, 6), K, 0.015, 0.16, -0.04, g); });
    mk('lampada', (g) => { mesh(new SphereGeometry(0.02, 10, 8), W, 0, 0.05, -0.06, g); mesh(new CylinderGeometry(0.012, 0.012, 0.02, 10), A, 0, 0.025, -0.06, g); });
    mk('sinalizacao', (g) => { mesh(new CylinderGeometry(0.01, 0.06, 0.18, 12), O, 0, 0.06, -0.06, g); });
    mk('tapete', (g) => { mesh(new CylinderGeometry(0.06, 0.06, 0.5, 14), K, 0.03, 0.02, -0.05, g).rotation.z = Math.PI / 2; });
    mk('dea', (g) => { mesh(new RoundedBoxGeometry(0.22, 0.24, 0.08, 2, 0.02), Y, -0.05, 0.0, -0.06, g); mesh(new BoxGeometry(0.1, 0.03, 0.01), K, -0.05, 0.04, -0.015, g); });
  }
  private buildTablet() {
    const g = this.tablet, body = std(0x2a2d30, 0.55), bump = std(0xe0b21e, 0.6);
    mesh(new RoundedBoxGeometry(0.27, 0.185, 0.02, 3, 0.012), body, 0, 0, 0, g);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) mesh(new RoundedBoxGeometry(0.04, 0.04, 0.03, 2, 0.01), bump, sx * 0.124, sy * 0.081, 0, g);
    mesh(new BoxGeometry(0.06, 0.006, 0.004), std(0x111214), 0, -0.088, 0.008, g);
    const scr = mesh(new PlaneGeometry(0.236, 0.148), new MeshBasicMaterial({ color: 0x0c0e10 }), 0, 0.002, 0.0105, g); return scr;
  }
  setTool(id: string | null) { this.tool = id; for (const [k, g] of Object.entries(this.tools)) g.visible = k === id; }
  setMode(m: 'none' | 'tool' | 'tablet') { this.mode = m; }
  /** Pulso de uso (ex.: girar manivela, testar detector). */
  use() { this.useAnim = 1; }
  update(dt: number, moving: number, bob: number, aspect: number) {
    this.t += dt; this.cam.aspect = aspect; this.cam.updateProjectionMatrix();
    const kT = this.mode === 'tablet' ? 1 : 0, kH = this.mode === 'tool' && this.tool ? 1 : 0;
    this.kTab += (kT - this.kTab) * Math.min(1, dt * 9); this.k += (kH - this.k) * Math.min(1, dt * 9); this.useAnim = Math.max(0, this.useAnim - dt * 2.2);
    const sway = Math.sin(this.t * 1.3) * 0.004, bx = Math.cos(bob) * 0.008 * moving, by = Math.abs(Math.sin(bob)) * 0.01 * moving;
    // tablet nas duas mãos
    this.tablet.visible = this.kTab > 0.02; this.tablet.position.set(bx * 0.25, -0.006 - (1 - this.kTab) * 0.3 + by * 0.25 + sway * 0.5, -0.245); this.tablet.rotation.set(-0.1, 0, 0);
    // mãos: com tablet seguram as laterais; com ferramenta só a direita
    const hv = this.kTab > 0.02 || this.k > 0.02; this.right.visible = hv; this.left.visible = this.kTab > 0.02;
    if (this.kTab > 0.02) {
      const ty = this.tablet.position.y, tz = this.tablet.position.z;
      this.left.position.set(-0.145, ty - 0.075, tz + 0.02); this.left.rotation.set(-0.1, 0.25, -1.1);
      this.right.position.set(0.145, ty - 0.075, tz + 0.02); this.right.rotation.set(-0.1, -0.25, 1.1);
      for (const g of Object.values(this.tools)) g.visible = false;
    } else {
      const u = Math.sin(this.useAnim * Math.PI);
      this.right.position.set(0.17 + bx, -0.2 - (1 - this.k) * 0.3 + by + sway, -0.32 - u * 0.06); this.right.rotation.set(0.15 + u * 0.3, 0.12, 0.08 + u * 0.4);
      if (this.tool) this.tools[this.tool].visible = true;
    }
  }
  render(r: WebGLRenderer) { if (!this.right.visible && !this.tablet.visible) return; const ac = r.autoClear; r.autoClear = false; r.clearDepth(); r.render(this.scene, this.cam); r.autoClear = ac; }
  /** Cantos da tela do tablet em pixels CSS (ordem: sup-esq, sup-dir, inf-dir, inf-esq). */
  screenCorners(w: number, h: number): [number, number][] {
    const out: [number, number][] = []; this.tablet.updateMatrixWorld(); const hw = 0.118, hh = 0.074;
    for (const [x, y] of [[-hw, hh], [hw, hh], [hw, -hh], [-hw, -hh]]) { const v = new Vector3(x, y + 0.002, 0.011).applyMatrix4(this.tablet.matrixWorld).project(this.cam); out.push([(v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h]); }
    return out;
  }
  ledOn(on: boolean) { for (const id of ['detector_mt', 'detector_at']) { const l = this.tools[id]?.userData.led as Mesh; if (l) (l.material as MeshStandardMaterial).emissiveIntensity = on ? 3 : 0; } }
}

/** matrix3d que leva o retângulo (0,0)-(w,h) ao quadrilátero dado (homografia). */
export function quadTransform(w: number, h: number, q: [number, number][]) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const src = [[0, 0], [w, 0], [w, h], [0, h]], dst = [[x0, y0], [x1, y1], [x2, y2], [x3, y3]];
  const A: number[][] = [], b: number[] = [];
  for (let i = 0; i < 4; i++) { const [sx, sy] = src[i], [dx, dy] = dst[i];
    A.push([sx, sy, 1, 0, 0, 0, -sx * dx, -sy * dx]); b.push(dx); A.push([0, 0, 0, sx, sy, 1, -sx * dy, -sy * dy]); b.push(dy); }
  const n = 8; for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
    for (let r = 0; r < n; r++) { if (r === c) continue; const f = A[r][c] / A[c][c]; for (let k = c; k < n; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; } }
  const hm = b.map((v, i) => v / A[i][i]); const [a, bb, c, d, e, f, g, hh] = hm;
  return `matrix3d(${a},${d},0,${g},${bb},${e},0,${hh},0,0,1,0,${c},${f},0,1)`;
}
