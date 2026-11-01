// Controles do Quest (gamepad xr-standard): botões com histerese, eixos, poses da palma e do raio, histórico curto,
// vibração e a mão procedural com a luva que a pessoa vestiu no simulador.
import { Group, Mesh, MeshLambertMaterial, CylinderGeometry, CapsuleGeometry, SphereGeometry, Vector3, Quaternion, Object3D, BufferGeometry, Line, LineBasicMaterial, MeshBasicMaterial, type WebGLRenderer } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const _s = new Vector3();
export class Hand {
  connected = false; source: any = null; ctrl: Group | null = null; grip: Group | null = null; line: Line | null = null; cursor: Mesh | null = null; model: Group | null = null;
  pos = new Vector3(); quat = new Quaternion(); rayO = new Vector3(); rayD = new Vector3(0, 0, -1); tip = new Vector3();
  trigger = false; triggerPrev = false; tv = 0; sv = 0; trigTouch = true; thumbTouch = true; touchSeen = false; autoPoint = false; holding = false; finger = new Vector3(); squeeze = false; squeezePrev = false; low = false; lowPrev = false; top = false; topPrev = false; stick = false; stickPrev = false; ax = 0; ay = 0;
  constructor(public handedness: 'left' | 'right') {}
  get triggerDown() { return this.trigger && !this.triggerPrev; }
  get squeezeDown() { return this.squeeze && !this.squeezePrev; }
  get squeezeUp() { return !this.squeeze && this.squeezePrev; }
  get topDown() { return this.top && !this.topPrev; }
  get lowDown() { return this.low && !this.lowPrev; }
  get stickDown() { return this.stick && !this.stickPrev; }
  /** Indicador esticado (pode apertar botão): dedo fora do gatilho (sensor) ou perto de algo apertável. */
  get pointing() { return !this.holding && !this.squeeze && ((this.touchSeen && !this.trigTouch) || this.autoPoint); }
  pulse(intensity = 0.4, ms = 25) { try { const a = this.source?.gamepad?.hapticActuators?.[0]; a?.pulse?.(intensity, ms); } catch { /* sem vibração */ } }
}

/** Mão articulada com luva: palma, 4 dedos com 2 falanges (juntas animadas), polegar, manguito e manga FR.
 *  Poses: aberta (repouso), fechada (grip), indicador esticado (sensor do gatilho ou perto de botão). */
const CAPS = new Map<string, CapsuleGeometry>();
function seg(r: number, len: number) { const k = r + '|' + len; let g = CAPS.get(k); if (!g) { g = new CapsuleGeometry(r, len, 3, 8); g.rotateX(-Math.PI / 2); g.translate(0, 0, -len / 2); CAPS.set(k, g); } return g; }
function gloveModel(left: boolean) {
  const s = left ? -1 : 1, glove = new MeshLambertMaterial({ color: 0xb98466 }), sleeveM = new MeshLambertMaterial({ color: 0x2a3a52 });
  const g = new Group(), hand = new Group(); hand.rotation.set(-0.12, 0, -s * 0.95); hand.position.set(0.004 * s, -0.004, 0.012); g.add(hand); // palma para dentro e para baixo, como segurando o controle
  const palm = new Mesh(new RoundedBoxGeometry(0.08, 0.03, 0.088, 3, 0.013), glove); palm.position.set(0, 0, 0.02); hand.add(palm);
  const fingers: { j1: Group; j2: Group }[] = []; let tip: Object3D | null = null;
  ([[-0.027, 0.04, 0.03], [-0.009, 0.044, 0.033], [0.009, 0.041, 0.03], [0.026, 0.032, 0.025]] as const).forEach(([x, l1, l2], i) => {
    const j1 = new Group(); j1.position.set(x * s, 0.002, -0.022); hand.add(j1); j1.add(new Mesh(seg(0.0098, l1), glove));
    const j2 = new Group(); j2.position.set(0, 0, -l1); j1.add(j2); j2.add(new Mesh(seg(0.0088, l2), glove));
    if (i === 0) { tip = new Object3D(); tip.position.set(0, 0, -l2 - 0.008); j2.add(tip); } fingers.push({ j1, j2 }); });
  const t1 = new Group(); t1.position.set(-0.036 * s, -0.004, 0.022); hand.add(t1); t1.add(new Mesh(seg(0.0118, 0.036), glove));
  const t2 = new Group(); t2.position.set(0, 0, -0.036); t1.add(t2); t2.add(new Mesh(seg(0.0105, 0.028), glove));
  const gaunt = new Mesh(new CylinderGeometry(0.037, 0.044, 0.07, 14, 1, true), glove); gaunt.rotation.x = Math.PI / 2; gaunt.position.set(0, 0.002, 0.092); (gaunt.material as any).side = 2; g.add(gaunt);
  const sleeve = new Mesh(new CylinderGeometry(0.047, 0.05, 0.09, 14), sleeveM); sleeve.rotation.x = Math.PI / 2; sleeve.position.set(0, 0.002, 0.162); g.add(sleeve);
  Object.assign(g.userData, { skin: glove, cuff: sleeve, gaunt, fingers, thumb: [t1, t2], tip, s, cur: { index: 0.3, grip: 0.2, thumb: 0.4 } }); g.traverse((o: any) => { o.userData.noPreset = true; }); return g;
}
/** Aplica a pose (0 = esticado, 1 = fechado) com suavização. */
export function poseHand(m: Group | null, tgt: { index: number; grip: number; thumb: number }, dt: number) {
  if (!m) return; const u = m.userData, c = u.cur, k = Math.min(1, dt * 18); c.index += (tgt.index - c.index) * k; c.grip += (tgt.grip - c.grip) * k; c.thumb += (tgt.thumb - c.thumb) * k;
  u.fingers.forEach((f: { j1: Group; j2: Group }, i: number) => { const v = i === 0 ? c.index : c.grip; f.j1.rotation.x = -0.06 - v * 1.45; f.j2.rotation.x = -0.05 - v * 1.55; });
  const [t1, t2] = u.thumb as Group[], t = c.thumb, s = u.s; t1.rotation.set(-0.15 - t * 0.35, s * (0.75 - t * 0.55), s * t * 0.5); t2.rotation.x = -0.1 - t * 0.8;
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
      h.low = !!b[4]?.pressed; h.top = !!b[5]?.pressed; h.stick = !!b[3]?.pressed; h.ax = gp.axes[2] || 0; h.ay = gp.axes[3] || 0; h.tv = tv; h.sv = sv;
      const tt = !!b[0]?.touched, th = [3, 4, 5, 6].some((i) => !!b[i]?.touched); if (tt || th) h.touchSeen = true; h.trigTouch = tt || tv > 0.05; h.thumbTouch = th;
    }
  }
  /** Pose dos dedos e ponta do indicador (mundo). */
  animate(dt: number) {
    for (const h of this.hands) { if (!h.connected || !h.model) continue; const pt = h.pointing;
      poseHand(h.model, { index: pt ? 0 : h.holding ? 0.85 : 0.3 + h.tv * 0.7, grip: h.holding ? 0.9 : 0.15 + h.sv * 0.85, thumb: h.holding || h.sv > 0.5 ? 0.85 : h.touchSeen ? (h.thumbTouch ? 0.7 : 0.1) : 0.55 }, dt);
      h.model.updateMatrixWorld(true); (h.model.userData.tip as Object3D).getWorldPosition(h.finger); }
  }
  poses() {
    for (const h of this.hands) { if (!h.connected || !h.grip || !h.ctrl) continue;
      h.grip.matrixWorld.decompose(h.pos, h.quat, _s); h.rayO.setFromMatrixPosition(h.ctrl.matrixWorld); h.rayD.set(0, 0, -1).transformDirection(h.ctrl.matrixWorld); h.tip.copy(h.rayO).addScaledVector(h.rayD, 0.01); }
  }
}
