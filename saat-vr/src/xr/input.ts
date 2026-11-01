// Controles do Quest (gamepad xr-standard): botões com histerese, eixos, poses da palma e do raio, histórico curto,
// vibração e a mão procedural com a luva que a pessoa vestiu no simulador.
import { Group, Mesh, MeshLambertMaterial, BoxGeometry, CylinderGeometry, SphereGeometry, Vector3, Quaternion, BufferGeometry, Line, LineBasicMaterial, MeshBasicMaterial, type WebGLRenderer } from 'three';

const _s = new Vector3();
export class Hand {
  connected = false; source: any = null; ctrl: Group | null = null; grip: Group | null = null; line: Line | null = null; cursor: Mesh | null = null; model: Group | null = null;
  pos = new Vector3(); quat = new Quaternion(); rayO = new Vector3(); rayD = new Vector3(0, 0, -1); tip = new Vector3();
  trigger = false; triggerPrev = false; squeeze = false; squeezePrev = false; low = false; lowPrev = false; top = false; topPrev = false; stick = false; stickPrev = false; ax = 0; ay = 0;
  constructor(public handedness: 'left' | 'right') {}
  get triggerDown() { return this.trigger && !this.triggerPrev; }
  get topDown() { return this.top && !this.topPrev; }
  get lowDown() { return this.low && !this.lowPrev; }
  get stickDown() { return this.stick && !this.stickPrev; }
  pulse(intensity = 0.4, ms = 25) { try { const a = this.source?.gamepad?.hapticActuators?.[0]; a?.pulse?.(intensity, ms); } catch { /* sem vibração */ } }
}

/** Luva procedural: palma + 4 dedos + polegar. Cores: pele, luva isolante (amarela), cobertura de vaqueta, PVC (verde); punho FR. */
function gloveModel(left: boolean) {
  const g = new Group(), skin = new MeshLambertMaterial({ color: 0xb98466 }), cuff = new MeshLambertMaterial({ color: 0x2a3a52 }), s = left ? -1 : 1;
  const palm = new Mesh(new BoxGeometry(0.075, 0.025, 0.09), skin); palm.position.set(0, -0.005, 0.02); g.add(palm);
  for (let i = 0; i < 4; i++) { const f = new Mesh(new CylinderGeometry(0.009, 0.01, 0.07, 6), skin); f.rotation.x = Math.PI / 2 + 0.35; f.position.set(-0.027 + i * 0.018, -0.018, -0.045); g.add(f); }
  const th = new Mesh(new CylinderGeometry(0.01, 0.011, 0.055, 6), skin); th.rotation.set(Math.PI / 2, 0, s * 0.9); th.position.set(-s * 0.045, -0.005, 0.0); g.add(th);
  const c = new Mesh(new CylinderGeometry(0.045, 0.045, 0.06, 10), cuff); c.rotation.x = Math.PI / 2; c.position.set(0, -0.005, 0.085); g.add(c);
  g.userData.skin = skin; g.userData.cuff = c; return g;
}
export function setGlove(m: Group | null, gear: { isolante: boolean; cobertura: boolean; pvc: boolean; fr: boolean }) {
  if (!m) return; const col = gear.cobertura ? 0x8a6a48 : gear.isolante ? 0xe0b21e : gear.pvc ? 0x2f7a3c : 0xb98466;
  (m.userData.skin as MeshLambertMaterial).color.setHex(col); (m.userData.cuff as Mesh).visible = gear.fr;
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
