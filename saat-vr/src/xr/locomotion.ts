// Locomoção no VR (porte do sandbox): andar na direção da cabeça, correr (clique no polegar), giro snap/suave em volta
// da cabeça, teleporte com arco (só prática livre), vinheta de conforto, altura/calibração e colisão AABB com deslizamento.
import { Group, Mesh, PlaneGeometry, ShaderMaterial, Vector3, Quaternion, Line, BufferGeometry, BufferAttribute, LineBasicMaterial, RingGeometry, MeshBasicMaterial, MathUtils, type PerspectiveCamera, type Scene } from 'three';
import type { Hand } from './input';

const KEY = 'saat:vrloco';
export const LOCO_DEF = { teleport: false, continuous: true, speed: 1.5, run: 2, hand: 'right' as 'right' | 'left', turn: 'snap30' as 'snap30' | 'snap45' | 'smooth' | 'off', smoothSpeed: 90, vignette: true, seated: false, seatOffset: 0, manual: 0 };
const UP = new Vector3(0, 1, 0), _v = new Vector3(), _p = new Vector3(), _q = new Quaternion(), _vel = new Vector3(), N = 48;

export class Locomotion {
  s = { ...LOCO_DEF }; running = false; moving = false; aim: Hand | null = null; valid = false; target = new Vector3(); vigI = 0; fade = 0; wallDark = 0; turnArmed = true;
  arc: Line; marker: Mesh; vig: Mesh; private arcPos = new Float32Array((N + 1) * 3); private vigMat: ShaderMaterial;
  /** blocked(x,z): colisão (AABB + limites). canTeleport(): prática livre. */
  constructor(public rig: Group, public cam: PerspectiveCamera, scene: Scene, public blocked: (x: number, z: number, r?: number) => boolean, public canTeleport: () => boolean) {
    try { Object.assign(this.s, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* */ }
    const g = new BufferGeometry(); g.setAttribute('position', new BufferAttribute(this.arcPos, 3));
    this.arc = new Line(g, new LineBasicMaterial({ color: 0x3ddc6a })); this.arc.frustumCulled = false; this.arc.visible = false; scene.add(this.arc);
    this.marker = new Mesh(new RingGeometry(0.22, 0.3, 32).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: 0x3ddc6a })); this.marker.visible = false; scene.add(this.marker);
    this.vigMat = new ShaderMaterial({ uniforms: { uI: { value: 0 }, uF: { value: 0 } }, transparent: true, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying vec2 vUv; uniform float uI; uniform float uF; void main(){ float r = length(vUv-0.5)*2.0; float a = smoothstep(0.30,0.80,r)*uI; gl_FragColor = vec4(0.0,0.0,0.0,max(a,uF)); }' });
    this.vig = new Mesh(new PlaneGeometry(2.4, 2.4), this.vigMat); this.vig.position.z = -0.25; this.vig.renderOrder = 1000; this.vig.frustumCulled = false; this.vig.visible = false; this.vig.userData.noPreset = true;
    cam.add(this.vig); this.applyHeight();
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.s)); } catch { /* */ } }
  reset() { Object.assign(this.s, LOCO_DEF); this.applyHeight(); this.save(); }
  head(out: Vector3) { return out.copy(this.cam.position).applyQuaternion(this.rig.quaternion).add(this.rig.position); }
  headYaw() { _q.copy(this.rig.quaternion).multiply(this.cam.quaternion); _v.set(0, 0, -1).applyQuaternion(_q); return Math.atan2(-_v.x, -_v.z); }
  rotateAroundHead(a: number) { const H = this.head(_p); _q.setFromAxisAngle(UP, a); this.rig.position.sub(H).applyQuaternion(_q).add(H); this.rig.quaternion.premultiply(_q); }
  /** Coloca a cabeça em (x,z) olhando para yaw (opcional). */
  placeHead(x: number, z: number, yaw: number | null = null) { if (yaw !== null) this.rotateAroundHead(yaw - this.headYaw()); const H = this.head(_p); this.rig.position.x += x - H.x; this.rig.position.z += z - H.z; this.fade = 1; }
  applyHeight() { this.rig.position.y = (this.s.seated ? this.s.seatOffset : 0) + this.s.manual; }
  setSeated(on: boolean) { this.s.seated = on; if (on) this.s.seatOffset = Math.min(1.2, Math.max(0, 1.6 - this.cam.position.y)); this.applyHeight(); this.save(); }
  nudgeHeight(d: number) { this.s.manual = Math.min(1.5, Math.max(-1, Math.round((this.s.manual + d) * 100) / 100)); this.applyHeight(); this.save(); }
  zeroHeight() { this.s.manual = 0; this.s.seated = false; this.s.seatOffset = 0; this.applyHeight(); this.save(); }
  /** O controle mais baixo (encostado no chão real) passa a ficar a 4 cm do piso virtual. */
  calibrateFloor(hands: Hand[]) { let low: Hand | null = null; for (const h of hands) if (h.connected && (!low || h.pos.y < low.pos.y)) low = h; if (!low) return null;
    const localY = low.pos.y - this.rig.position.y, rigY = 0.04 - localY; this.s.manual = Math.min(1.5, Math.max(-1, Math.round((rigY - (this.s.seated ? this.s.seatOffset : 0)) * 100) / 100)); this.applyHeight(); this.save(); return this.s.manual; }
  eyeHeight() { return this.cam.position.y + this.rig.position.y; }
  /** Move a cabeça por (dx,dz) com deslizamento nos eixos. */
  private move(dx: number, dz: number) { const H = this.head(_p); let mx = 0, mz = 0; if (dx && !this.blocked(H.x + dx, H.z, 0.25)) mx = dx; if (dz && !this.blocked(H.x + mx, H.z + dz, 0.25)) mz = dz; this.rig.position.x += mx; this.rig.position.z += mz; return mx || mz; }

  update(dt: number, hands: Hand[], pesJuntos = false) {
    const D = this.s.hand === 'left' ? hands[0] : hands[1], M = this.s.hand === 'left' ? hands[1] : hands[0]; let smooth = false; this.moving = false;
    // teleporte (prática livre): polegar dominante para frente
    const tp = this.s.teleport && this.canTeleport();
    if (!tp) { this.aim = null; this.arc.visible = this.marker.visible = false; }
    if (tp && !this.aim && D.connected && D.ay < -0.6) this.aim = D;
    if (this.aim) { const h = this.aim; if (h.ay > -0.3 || !h.connected) { if (this.valid) this.placeHead(this.target.x, this.target.z); this.aim = null; this.arc.visible = this.marker.visible = false; } else this.computeArc(h); }
    // andar e correr (polegar não dominante); pés juntos limita a 0,3 m/s
    if (this.s.continuous && M.connected) {
      const x = Math.abs(M.ax) > 0.15 ? M.ax : 0, y = Math.abs(M.ay) > 0.15 ? M.ay : 0;
      if (M.stickDown && !pesJuntos) this.running = !this.running;
      if (x || y) { const yaw = this.headYaw(); let sp = this.s.speed * (this.running ? this.s.run : 1); if (pesJuntos) { sp = Math.min(sp, 0.3); this.running = false; } sp *= dt;
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw); this.moving = !!this.move((fx * -y + Math.cos(yaw) * x) * sp, (fz * -y - Math.sin(yaw) * x) * sp); }
      else this.running = false;
    }
    // giro (polegar dominante), sempre em volta da cabeça
    if (D.connected && this.aim !== D) { const x = D.ax;
      if (this.s.turn === 'smooth') { if (Math.abs(x) > 0.2) { this.rotateAroundHead(-x * MathUtils.degToRad(this.s.smoothSpeed) * dt); smooth = true; } }
      else if (this.s.turn !== 'off') { const st = MathUtils.degToRad(this.s.turn === 'snap45' ? 45 : 30); if (this.turnArmed && Math.abs(x) > 0.7) { this.rotateAroundHead(x > 0 ? -st : st); this.turnArmed = false; this.fade = Math.max(this.fade, 0.6); } if (Math.abs(x) < 0.3) this.turnArmed = true; } }
    // room-scale: cabeça dentro de parede escurece em proporção (não empurra)
    const H = this.head(_p); let inside = 0; if (this.blocked(H.x, H.z, 0.05)) { inside = 1; for (const r of [0.1, 0.2, 0.3]) if (!this.blocked(H.x + r, H.z, 0.05) || !this.blocked(H.x - r, H.z, 0.05) || !this.blocked(H.x, H.z + r, 0.05) || !this.blocked(H.x, H.z - r, 0.05)) { inside = r / 0.3; break; } }
    this.wallDark += (inside * 0.92 - this.wallDark) * Math.min(1, dt * 10);
    const want = (this.moving || smooth) && this.s.vignette ? 1 : 0; this.vigI += (want - this.vigI) * Math.min(1, dt * 8); this.fade = Math.max(0, this.fade - dt * 6);
    this.vigMat.uniforms.uI.value = this.vigI; this.vigMat.uniforms.uF.value = Math.max(this.fade, this.wallDark); this.vig.visible = this.vigI > 0.01 || this.fade > 0.01 || this.wallDark > 0.01;
  }
  private computeArc(h: Hand) {
    const P = this.arcPos; let n = 0, landed = false; _p.copy(h.rayO); _vel.copy(h.rayD).multiplyScalar(8);
    for (let i = 0; i < N; i++) { P[n * 3] = _p.x; P[n * 3 + 1] = _p.y; P[n * 3 + 2] = _p.z; n++; const dt = 0.03, nx = _p.x + _vel.x * dt, ny = _p.y + _vel.y * dt, nz = _p.z + _vel.z * dt; _vel.y -= 9.81 * dt;
      if (ny <= 0) { const f = _p.y / (_p.y - ny); this.target.set(_p.x + (nx - _p.x) * f, 0, _p.z + (nz - _p.z) * f); P[n * 3] = this.target.x; P[n * 3 + 1] = 0.01; P[n * 3 + 2] = this.target.z; n++; landed = true; break; } _p.set(nx, ny, nz); }
    this.valid = landed && !this.blocked(this.target.x, this.target.z, 0.3) && this.target.distanceTo(this.head(_v).setY(0)) < 14;
    const c = this.valid ? 0x3ddc6a : 0xe5484d; (this.arc.material as LineBasicMaterial).color.setHex(c); (this.marker.material as MeshBasicMaterial).color.setHex(c);
    this.arc.geometry.attributes.position.needsUpdate = true; this.arc.geometry.setDrawRange(0, n); this.arc.visible = true; this.marker.visible = landed; if (landed) this.marker.position.set(this.target.x, 0.01, this.target.z);
  }
}
