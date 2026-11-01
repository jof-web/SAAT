// Controles do Quest (gamepad xr-standard): botões com histerese, eixos, poses da palma e do raio, histórico curto,
// vibração e a mão procedural com a luva que a pessoa vestiu no simulador.
import { Group, Mesh, MeshLambertMaterial, CylinderGeometry, CapsuleGeometry, SphereGeometry, Vector3, Quaternion, Matrix4, BufferGeometry, Line, LineBasicMaterial, MeshBasicMaterial, type WebGLRenderer } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _s = new Vector3(), _d = new Vector3(), _c = new Vector3(), _q = new Quaternion(), _mm = new Matrix4(), _up = new Vector3(0, 1, 0), _one = new Vector3(1, 1, 1);
export class Hand {
  connected = false; source: any = null; ctrl: Group | null = null; grip: Group | null = null; line: Line | null = null; cursor: Mesh | null = null; model: Group | null = null;
  pos = new Vector3(); quat = new Quaternion(); rayO = new Vector3(); rayD = new Vector3(0, 0, -1); tip = new Vector3();
  trigger = false; triggerPrev = false; squeeze = false; squeezePrev = false; low = false; lowPrev = false; top = false; topPrev = false; stick = false; stickPrev = false; ax = 0; ay = 0;
  constructor(public handedness: 'left' | 'right') {}
  get triggerDown() { return this.trigger && !this.triggerPrev; }
  get squeezeDown() { return this.squeeze && !this.squeezePrev; }
  get squeezeUp() { return !this.squeeze && this.squeezePrev; }
  get topDown() { return this.top && !this.topPrev; }
  get lowDown() { return this.low && !this.lowPrev; }
  get stickDown() { return this.stick && !this.stickPrev; }
  pulse(intensity = 0.4, ms = 25) { try { const a = this.source?.gamepad?.hapticActuators?.[0]; a?.pulse?.(intensity, ms); } catch { /* sem vibração */ } }
}

/** Luva procedural (uma malha por mão): punho fechado segurando o controle — palma arredondada, dedos em duas
 *  falanges curvadas, polegar sobre o controle, manguito da luva e manga da vestimenta FR. */
const flat = (g: BufferGeometry) => (g.index ? g.toNonIndexed() : g);
function capsule(r: number, len: number, from: Vector3, to: Vector3) {
  const g = new CapsuleGeometry(r, Math.max(0.001, len), 3, 8); const d = _d.copy(to).sub(from); const q = _q.setFromUnitVectors(_up, d.clone().normalize());
  g.applyMatrix4(_mm.compose(_c.copy(from).addScaledVector(d, 0.5), q, _one)); return flat(g);
}
function gloveModel(left: boolean) {
  const s = left ? -1 : 1, parts: BufferGeometry[] = [];
  const palm = new RoundedBoxGeometry(0.078, 0.032, 0.086, 3, 0.014); palm.applyMatrix4(_mm.makeTranslation(0, 0.004, 0.018)); parts.push(flat(palm));
  // dedos: indicador junto ao polegar; nó → falange proximal (frente-baixo) → média/distal (curvada para trás)
  [[-0.026, 1.0], [-0.009, 1.08], [0.009, 1.0], [0.025, 0.82]].forEach(([x, k]) => { const X = x * s, a = new Vector3(X, 0.006, -0.022), b = new Vector3(X, -0.012, -0.022 - 0.032 * k), c = new Vector3(X * 0.92, -0.04 * k, -0.03 - 0.018 * k);
    parts.push(capsule(0.0098, a.distanceTo(b), a, b), capsule(0.0088, b.distanceTo(c), b, c)); });
  const t0 = new Vector3(-0.036 * s, -0.002, 0.026), t1 = new Vector3(-0.042 * s, 0.012, -0.006), t2 = new Vector3(-0.026 * s, 0.024, -0.03);
  parts.push(capsule(0.012, t0.distanceTo(t1), t0, t1), capsule(0.0105, t1.distanceTo(t2), t1, t2));
  const geo = mergeGeometries(parts)!;
  const glove = new MeshLambertMaterial({ color: 0xb98466 }), sleeveM = new MeshLambertMaterial({ color: 0x2a3a52 });
  const g = new Group(), hand = new Mesh(geo, glove); g.add(hand);
  const gaunt = new Mesh(new CylinderGeometry(0.037, 0.044, 0.07, 14, 1, true), glove); gaunt.rotation.x = Math.PI / 2; gaunt.position.set(0, 0.002, 0.088); (gaunt.material as any).side = 2; g.add(gaunt);
  const sleeve = new Mesh(new CylinderGeometry(0.047, 0.05, 0.09, 14), sleeveM); sleeve.rotation.x = Math.PI / 2; sleeve.position.set(0, 0.002, 0.158); g.add(sleeve);
  g.userData.skin = glove; g.userData.cuff = sleeve; g.userData.gaunt = gaunt; g.traverse((o: any) => { o.userData.noPreset = true; }); return g;
}
export function setGlove(m: Group | null, gear: { isolante: boolean; cobertura: boolean; pvc: boolean; fr: boolean }) {
  if (!m) return; const luva = gear.cobertura || gear.isolante || gear.pvc, col = gear.cobertura ? 0x8a6a48 : gear.isolante ? 0xe0b21e : gear.pvc ? 0x2f7a3c : 0xb98466;
  (m.userData.skin as MeshLambertMaterial).color.setHex(col); (m.userData.gaunt as Mesh).visible = luva; (m.userData.cuff as Mesh).visible = gear.fr;
}

export class XRInput {
  hands = [new Hand('left'), new Hand('right')];
  constructor(renderer: WebGLRenderer, rig: Group, scene: Group | any) {
    const lineGeo = new BufferGeometry().setFromPoints([new Vector3(0, 0, 0), new Vector3(0, 0, -1)]);
    for (let i = 0; i < 2; i++) {
      const ctrl = renderer.xr.getController(i), grip = renderer.xr.getControllerGrip(i); rig.add(ctrl, grip);
      const line = new Line(lineGeo, new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })); line.scale.z = 2; line.visible = false; ctrl.add(line);
      const cur = new Mesh(new SphereGeometry(0.008, 8, 6), new MeshBasicMaterial({ color: 0xffffff })); cur.visible = false; cur.userData.noPreset = true; scene.add(cur);
      ctrl.addEventListener('connected', (e: any) => {
        const src = e.data; if (src.hand) return; const h = src.handedness === 'left' ? this.hands[0] : this.hands[1];
        h.source = src; h.ctrl = ctrl; h.grip = grip; h.line = line; h.cursor = cur; h.connected = true;
        if (!h.model) { h.model = gloveModel(h.handedness === 'left'); grip.add(h.model); }
      });
      ctrl.addEventListener('disconnected', () => { for (const h of this.hands) if (h.ctrl === ctrl) { h.connected = false; h.source = null; line.visible = false; cur.visible = false; } });
    }
  }
  read() {
    for (const h of this.hands) {
      h.triggerPrev = h.trigger; h.squeezePrev = h.squeeze; h.lowPrev = h.low; h.topPrev = h.top; h.stickPrev = h.stick;
      const gp = h.source?.gamepad; if (!h.connected || !gp) { h.trigger = h.squeeze = h.low = h.top = h.stick = false; h.ax = h.ay = 0; continue; }
      const b = gp.buttons, tv = b[0]?.value ?? 0, sv = b[1]?.value ?? 0;
      h.trigger = h.trigger ? tv > 0.35 : tv > 0.6; h.squeeze = h.squeeze ? sv > 0.35 : sv > 0.6;
      h.low = !!b[4]?.pressed; h.top = !!b[5]?.pressed; h.stick = !!b[3]?.pressed; h.ax = gp.axes[2] || 0; h.ay = gp.axes[3] || 0;
    }
  }
  poses() {
    for (const h of this.hands) { if (!h.connected || !h.grip || !h.ctrl) continue;
      h.grip.matrixWorld.decompose(h.pos, h.quat, _s); h.rayO.setFromMatrixPosition(h.ctrl.matrixWorld); h.rayD.set(0, 0, -1).transformDirection(h.ctrl.matrixWorld); h.tip.copy(h.rayO).addScaledVector(h.rayD, 0.01); }
  }
}
