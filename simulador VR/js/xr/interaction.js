// interaction.js — sistema genérico de interação (controles XR e modo desktop).
// Tipos: Grabbable (objeto solto), JointControl (alavanca, válvula, manivela, slider, porta, gaveta, interruptor),
// TiltControl (joystick), PokeButton (botão de apertar). UI: painéis em canvas (kit.Panel) clicados por raio.
import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { JointDrive, TiltDrive, GROUPS } from '../physics.js';

const NEAR = 0.06;          // raio de pegada direta (m)
const RAY_MAX = 10;         // alcance do raio (m)
const F_HAND = 300;         // força máxima de uma mão (N) — I6
const THROW_E = 60;         // energia máxima de arremesso (J) — limita velocidade de objetos pesados
const HIST = 14;            // amostras de histórico da mão (~150 ms a 90 Hz)

// temporários (sem alocação por quadro)
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _m = new THREE.Matrix4(), _s = new THREE.Vector3();
const _o = new THREE.Vector3(), _d = new THREE.Vector3();
const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const RV = { x: 0, y: 0, z: 0 }; // vetor reaproveitado para o Rapier

// ---------------- Mão (controle XR ou mouse) ----------------
export class Hand {
  constructor(name, handedness, desktop = false) {
    this.name = name; this.handedness = handedness; this.desktop = desktop;
    this.connected = desktop; this.source = null; this.ctrl = null; this.gripObj = null; this.line = null;
    this.pos = new THREE.Vector3(); this.quat = new THREE.Quaternion();      // palma (grip)
    this.rayO = new THREE.Vector3(); this.rayD = new THREE.Vector3(0, 0, -1); // raio
    this.tip = new THREE.Vector3(); this.vel = new THREE.Vector3();          // ponta (poke) e velocidade
    this.grip = false; this.gripPrev = false; this.trigger = false; this.triggerPrev = false;
    this.top = false; this.topPrev = false; this.low = false; this.lowPrev = false; this.stick = false; this.stickPrev = false;
    this.ax = 0; this.ay = 0;
    this.held = null; this.mode = null; this.hover = null; this.near = false; this.panel = null; this.hoverT = Infinity;
    this.hist = new Float64Array(HIST * 8); this.hn = 0; this.hi = 0;
    this.holdDist = 1; this.sepTime = 0;
  }
  get gripDown() { return this.grip && !this.gripPrev; }
  get triggerDown() { return this.trigger && !this.triggerPrev; }
  get topDown() { return this.top && !this.topPrev; }
  push(t) {
    const o = this.hi * 8, h = this.hist;
    h[o] = this.pos.x; h[o + 1] = this.pos.y; h[o + 2] = this.pos.z;
    h[o + 3] = this.quat.x; h[o + 4] = this.quat.y; h[o + 5] = this.quat.z; h[o + 6] = this.quat.w; h[o + 7] = t;
    this.hi = (this.hi + 1) % HIST; this.hn = Math.min(this.hn + 1, HIST);
    // velocidade instantânea suavizada (amortecimento do PD)
    if (this.hn > 1) {
      const p = ((this.hi - 2 + HIST) % HIST) * 8, dt = t - h[p + 7];
      if (dt > 1e-4) { _v.set((this.pos.x - h[p]) / dt, (this.pos.y - h[p + 1]) / dt, (this.pos.z - h[p + 2]) / dt); this.vel.lerp(_v, 0.5); }
    }
  }
  clearHist() { this.hn = 0; this.hi = 0; this.vel.set(0, 0, 0); }
  // amostra mais antiga dentro da janela (padrão 100 ms) — I3
  _oldest(win) {
    if (this.hn < 2) return -1;
    const last = ((this.hi - 1 + HIST) % HIST) * 8, tNow = this.hist[last + 7];
    let best = -1;
    for (let k = 1; k < this.hn; k++) {
      const o = ((this.hi - 1 - k + HIST * 2) % HIST) * 8;
      best = o; if (tNow - this.hist[o + 7] >= win) break;
    }
    return best;
  }
  avgVel(out, win = 0.1) {
    const o = this._oldest(win); if (o < 0) return out.set(0, 0, 0);
    const l = ((this.hi - 1 + HIST) % HIST) * 8, h = this.hist, dt = h[l + 7] - h[o + 7];
    if (dt < 1e-4) return out.set(0, 0, 0);
    return out.set((h[l] - h[o]) / dt, (h[l + 1] - h[o + 1]) / dt, (h[l + 2] - h[o + 2]) / dt);
  }
  avgAngVel(out, win = 0.1) {
    const o = this._oldest(win); if (o < 0) return out.set(0, 0, 0);
    const l = ((this.hi - 1 + HIST) % HIST) * 8, h = this.hist, dt = h[l + 7] - h[o + 7];
    if (dt < 1e-4) return out.set(0, 0, 0);
    _q2.set(h[o + 3], h[o + 4], h[o + 5], h[o + 6]).invert();
    _q3.set(h[l + 3], h[l + 4], h[l + 5], h[l + 6]).multiply(_q2);
    return quatToRotVec(_q3, out).multiplyScalar(1 / dt);
  }
  pulse(intensity = 0.4, ms = 25) {
    try { const a = this.source?.gamepad?.hapticActuators?.[0]; if (a?.pulse) a.pulse(intensity, ms); } catch (e) { /* sem vibração */ }
  }
}

// quaternion → vetor de rotação (eixo * ângulo), caminho mais curto
function quatToRotVec(q, out) {
  let x = q.x, y = q.y, z = q.z, w = q.w;
  if (w < 0) { x = -x; y = -y; z = -z; w = -w; }
  const s = Math.sqrt(x * x + y * y + z * z);
  if (s < 1e-7) return out.set(x * 2, y * 2, z * 2);
  const a = 2 * Math.atan2(s, w);
  return out.set(x / s * a, y / s * a, z / s * a);
}

// ---------------- Formas de teste (raio e proximidade) ----------------
// shape: {type:'box', half:Vector3, center?:Vector3} | {type:'sphere', r, center?:Vector3} no referencial de hitObj
function localRay(obj, origin, dir) {
  _m.copy(obj.matrixWorld).invert();
  _o.copy(origin).applyMatrix4(_m); _d.copy(dir).transformDirection(_m);
}
function rayShape(it, origin, dir) {
  localRay(it.hitObj, origin, dir);
  const sh = it.shape, c = sh.center;
  const ox = _o.x - (c ? c.x : 0), oy = _o.y - (c ? c.y : 0), oz = _o.z - (c ? c.z : 0);
  if (sh.type === 'sphere') {
    const b = ox * _d.x + oy * _d.y + oz * _d.z, cc = ox * ox + oy * oy + oz * oz - sh.r * sh.r, disc = b * b - cc;
    if (disc < 0) return Infinity; const t = -b - Math.sqrt(disc); return t > 0 ? t : (cc < 0 ? 0 : Infinity);
  }
  let tmin = -Infinity, tmax = Infinity; const h = sh.half;
  const o = [ox, oy, oz], d = [_d.x, _d.y, _d.z], hh = [h.x, h.y, h.z];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) { if (Math.abs(o[i]) > hh[i]) return Infinity; continue; }
    let t1 = (-hh[i] - o[i]) / d[i], t2 = (hh[i] - o[i]) / d[i]; if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; }
    if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return Infinity;
  }
  if (tmax < 0) return Infinity; return tmin > 0 ? tmin : 0;
}
function pointDist(it, p) {
  _m.copy(it.hitObj.matrixWorld).invert(); _v4.copy(p).applyMatrix4(_m);
  const sh = it.shape, c = sh.center; if (c) _v4.sub(c);
  if (sh.type === 'sphere') return Math.max(0, _v4.length() - sh.r);
  const h = sh.half;
  const dx = Math.max(0, Math.abs(_v4.x) - h.x), dy = Math.max(0, Math.abs(_v4.y) - h.y), dz = Math.max(0, Math.abs(_v4.z) - h.z);
  return Math.hypot(dx, dy, dz);
}

// ---------------- Base dos interativos ----------------
class Interactable {
  constructor(o) {
    this.name = o.name || '?'; this.hitObj = o.hitObj; this.shape = o.shape; this.mats = o.mats || [];
    this.hl = 0; this.enabled = true;
  }
  setHighlight(l) {
    if (l === this.hl) return; this.hl = l;
    const hex = l === 2 ? 0x3a3000 : l === 1 ? 0x262626 : 0x000000;
    for (const m of this.mats) if (m.emissive) m.emissive.setHex(hex);
  }
}

// ---------------- Objeto solto pegável (I1–I6) ----------------
export class Grabbable extends Interactable {
  // o: {obj, body, mass, twoHanded, distance}
  constructor(o) {
    super({ ...o, hitObj: o.hitObj || o.obj });
    this.kind = 'grab'; this.obj = o.obj; this.body = o.body; this.mass = o.mass;
    this.twoHanded = !!o.twoHanded; this.distance = o.distance !== false;
    this.holders = []; this.pulling = false;
    this.offP = new THREE.Vector3(); this.offQ = new THREE.Quaternion();
    // duas mãos
    this.v0 = new THREE.Vector3(); this.m0 = new THREE.Vector3(); this.p0 = new THREE.Vector3(); this.q0 = new THREE.Quaternion();
    // parâmetros do PD (I6): objetos leves seguem rígidos; pesados atrasam e oscilam
    this.omega = Math.min(40, Math.max(8, 38 / Math.sqrt(this.mass)));
    this.zeta = this.mass < 3 ? 1 : 0.5;
    this.tp = new THREE.Vector3(); this.tq = new THREE.Quaternion(); this.sep = 0;
  }
}

// ---------------- Controle com junta (revolute/prismatic) ----------------
// o: {scope, name, obj, hitObj, shape, mats, kind:'revolute'|'prismatic', anchor(Vector3 local da estação), axis(Vector3 local),
//     colliders:[{shape, pos?, quat?}], mass, min, max, jointLimits, grabMode:'angle'|'twist'|'linear', rest, drive:{...}}
export class JointControl extends Interactable {
  constructor(ix, o) {
    super(o);
    this.ix = ix; this.kind = 'control'; this.held = null; this.clickable = false;
    this.grabMode = o.grabMode || (o.kind === 'prismatic' ? 'linear' : 'angle');
    const sc = o.scope, ph = sc.physics;
    this.anchorW = sc.toWorld(o.anchor.clone());
    this.axisW = o.axis.clone().normalize().applyQuaternion(sc.quat);
    // corpo móvel: origem na junta, mesma orientação da base (valor inicial 0)
    this.body = sc.dynamic(o.obj, { pos: this.anchorW, quat: sc.quat, gravityScale: o.gravityScale ?? 0, angDamp: o.angDamp ?? 0.6, linDamp: o.linDamp ?? 0.6 });
    this.colliders = o.colliders.map(c => ph.collider(this.body, c.shape, { group: GROUPS.CONTROL, mass: (o.mass || 0.5) / o.colliders.length, pos: c.pos, quat: c.quat, friction: c.friction ?? 0.7 }));
    const R = ph.R, a = o.axis.clone().normalize(), z = { x: 0, y: 0, z: 0 };
    const jd = o.kind === 'revolute'
      ? R.JointData.revolute({ x: o.anchor.x, y: o.anchor.y, z: o.anchor.z }, z, { x: a.x, y: a.y, z: a.z })
      : R.JointData.prismatic({ x: o.anchor.x, y: o.anchor.y, z: o.anchor.z }, z, { x: a.x, y: a.y, z: a.z });
    this.joint = sc.joint(jd, this.body);
    if (o.jointLimits !== false && isFinite(o.min) && isFinite(o.max)) { this.joint.setLimits(o.min, o.max); }
    this.drive = sc.drive(new JointDrive(ph, {
      kind: o.kind, joint: this.joint, body: this.body, axis: a, baseQuat: sc.quat, anchorWorld: this.anchorW,
      min: o.min, max: o.max, rest: o.rest || 'brake', init: 0, ...(o.drive || {}),
    }));
    this.min = o.min ?? -Infinity; this.max = o.max ?? Infinity;
    this.u = new THREE.Vector3(); this.w = new THREE.Vector3(); this.h0 = new THREE.Vector3(); this.qPrev = new THREE.Quaternion();
    this.grabLocal = new THREE.Vector3(); this.phiPrev = 0; this.base = 0;
  }
  get value() { return this.drive.value; }
  grab(h) {
    this.held = h; const d = this.drive; d.held = true; d.mode = 'drive'; d.target = d.value; this.base = d.value;
    // ponto de pegada no referencial da peça (para soltar se a mão se afastar demais)
    this.hitObj.updateWorldMatrix(true, false);
    this.grabLocal.copy(h.pos).applyMatrix4(_m.copy(this.hitObj.matrixWorld).invert());
    const mode = (this.grabMode === 'twist' && h.desktop) ? 'angle' : this.grabMode; this.curMode = mode;
    if (mode === 'angle') {
      _v.copy(h.pos).sub(this.anchorW); _v.addScaledVector(this.axisW, -_v.dot(this.axisW));
      if (_v.lengthSq() < 1e-6) _v.set(1, 0, 0).cross(this.axisW);
      this.u.copy(_v).normalize(); this.w.crossVectors(this.axisW, this.u); this.phiPrev = 0;
    } else if (mode === 'twist') this.qPrev.copy(h.quat);
    else this.h0.copy(h.pos);
  }
  // alvo bruto a partir da mão
  rawTarget(h) {
    const d = this.drive;
    if (this.curMode === 'angle') {
      _v.copy(h.pos).sub(this.anchorW);
      const x = _v.dot(this.u), y = _v.dot(this.w);
      if (x * x + y * y < 0.0004) return d.target;           // mão sobre o eixo: ignora
      const phi = Math.atan2(y, x); let dp = phi - this.phiPrev;
      if (dp > Math.PI) dp -= Math.PI * 2; if (dp < -Math.PI) dp += Math.PI * 2;
      this.phiPrev = phi; this.base += dp; return this.base;
    }
    if (this.curMode === 'twist') {
      _q.copy(this.qPrev).invert(); _q2.copy(h.quat).multiply(_q);        // rotação do pulso desde o último quadro
      const s = _q2.x * this.axisW.x + _q2.y * this.axisW.y + _q2.z * this.axisW.z;
      let a = 2 * Math.atan2(s, _q2.w); if (a > Math.PI) a -= Math.PI * 2; if (a < -Math.PI) a += Math.PI * 2;
      this.qPrev.copy(h.quat); this.base += a; return this.base;
    }
    _v.copy(h.pos).sub(this.h0); return this.base + _v.dot(this.axisW);
  }
  filter(t) { return Math.min(this.max, Math.max(this.min, t)); }
  hold(h) {
    let t = this.filter(this.rawTarget(h));
    // não acumula além do limite (evita "mola" ao voltar)
    if (this.curMode !== 'angle' || isFinite(this.min)) this.base = Math.min(this.max, Math.max(this.min, this.base));
    this.drive.target = t;
  }
  release() { this.held = null; this.drive.held = false; this.rest(); }
  rest() { this.drive.mode = this.drive.rest; this.drive.target = this.drive.value; }
  // distância entre a mão e o ponto onde pegou (para soltar automaticamente)
  gripSeparation(h) { _v.copy(this.grabLocal).applyMatrix4(this.hitObj.matrixWorld); return _v.distanceTo(h.pos); }
  reset() { this.drive.reset(); }
}

// Alavanca de 1 eixo com posições de trava (I9)
export class Lever extends JointControl {
  constructor(ix, o) { super(ix, { ...o, kind: 'revolute', rest: 'drive' }); this.detents = o.detents; this.idx = this.nearest(0); }
  nearest(v) { let b = 0, bd = Infinity; this.detents.forEach((d, i) => { const e = Math.abs(d - v); if (e < bd) { bd = e; b = i; } }); return b; }
  filter(t) {
    t = super.filter(t);
    const i = this.nearest(t);
    if (Math.abs(this.detents[i] - t) < 0.05) t = this.detents[i];   // "ímã" de ~3°
    if (i !== this.idx && Math.abs(this.detents[i] - t) < 1e-6) { this.idx = i; this.held?.pulse(0.6, 18); } // I20 básico
    return t;
  }
  rest() { const i = this.nearest(this.drive.value); this.idx = i; this.drive.mode = 'drive'; this.drive.target = this.detents[i]; }
  get locked() { return !this.held && Math.abs(this.drive.value - this.detents[this.idx]) < 0.03; }
  reset() { super.reset(); this.idx = this.nearest(0); this.drive.mode = 'drive'; this.drive.target = 0; }
}

// Interruptor liga/desliga (I8): duas posições; puxar ou clicar (gatilho/mouse) alterna
export class Toggle extends Lever {
  constructor(ix, o) { const a = o.angle || 0.35; super(ix, { ...o, detents: [-a, a], min: -a, max: a }); this.clickable = true; this.drive.target = -a; this.idx = 0; this.on = false; }
  click(h) { this.idx = this.idx ? 0 : 1; this.drive.mode = 'drive'; this.drive.target = this.detents[this.idx]; h?.pulse(0.5, 20); }
  update() { const on = this.drive.value > 0; if (on !== this.on) { this.on = on; } }
  reset() { this.drive.reset(); this.idx = 0; this.drive.mode = 'drive'; this.drive.target = this.detents[0]; this.on = false; }
}

// Válvula girada pelo pulso (I10): multivoltas, segura onde ficou
export class Valve extends JointControl {
  constructor(ix, o) { super(ix, { ...o, kind: 'revolute', grabMode: 'twist', rest: 'brake', jointLimits: false }); }
}
// Manivela (I11): rotação contínua, gira livre com atrito leve ao soltar
export class Crank extends JointControl {
  constructor(ix, o) { super(ix, { ...o, kind: 'revolute', grabMode: 'angle', rest: 'free', jointLimits: false, min: -Infinity, max: Infinity }); }
  get rpm() { return this.drive.vel * 60 / (Math.PI * 2); }
}
// Slider linear (I12)
export class Slider extends JointControl {
  constructor(ix, o) { super(ix, { ...o, kind: 'prismatic', rest: 'brake' }); }
}
// Porta com dobradiça (I13): solta com atrito; trinco magnético perto de fechada
export class Hinge extends JointControl {
  constructor(ix, o) { super(ix, { ...o, kind: 'revolute', rest: 'free' }); }
  update() {
    if (this.held) return; const d = this.drive;
    if (d.value < 0.06 && Math.abs(d.vel) < 1.5) { d.mode = 'drive'; d.target = 0; } else if (d.mode === 'drive') d.mode = 'free';
  }
}
// Gaveta com trilho (I13)
export class Rail extends JointControl {
  constructor(ix, o) { super(ix, { ...o, kind: 'prismatic', rest: o.rest || 'free' }); }
}
// Massa em mola vertical (E1.4): segura e puxa; ao soltar, a mola física (k, c) e a gravidade agem
export class SpringRail extends JointControl {
  constructor(ix, o) {
    super(ix, { ...o, kind: 'prismatic', rest: 'spring', gravityScale: 1, linDamp: 0.01, angDamp: 0.5, drive: { k: o.k, c: o.c, maxForce: 400, ...(o.drive || {}) } });
    this.drive.mode = 'spring';
  }
  setMass(m) { const n = this.colliders.length; for (const c of this.colliders) c.setMass(m / n); this.body.wakeUp(); }
}
// Porta com maçaneta e trinco (E5.4): girar a maçaneta (pulso) destrava; perto de fechada, trava sozinha
export class LatchedHinge extends Hinge {
  constructor(ix, o) {
    super(ix, o); this.knob = o.knob; this.knobAxisLocal = o.knobAxis || new THREE.Vector3(0, 0, 1);
    this.unlock = o.unlock ?? 0.5; this.knobMax = o.knobMax ?? 0.9; this.knobAngle = 0; this.latched = true; this.qk = new THREE.Quaternion();
  }
  grab(h) { super.grab(h); this.qk.copy(h.quat); }
  hold(h) {
    if (h.desktop) this.knobAngle = this.knobMax;               // no desktop não há torção de pulso
    else {
      _v2.copy(this.knobAxisLocal).applyQuaternion(this.hitObj.getWorldQuaternion(_q3));
      _q.copy(this.qk).invert(); _q2.copy(h.quat).multiply(_q);
      let a = 2 * Math.atan2(_q2.x * _v2.x + _q2.y * _v2.y + _q2.z * _v2.z, _q2.w);
      if (a > Math.PI) a -= Math.PI * 2; if (a < -Math.PI) a += Math.PI * 2;
      this.qk.copy(h.quat); this.knobAngle = Math.max(-this.knobMax, Math.min(this.knobMax, this.knobAngle + a));
    }
    if (this.latched && Math.abs(this.knobAngle) > this.unlock) { this.latched = false; h.pulse(0.7, 30); }
    if (this.latched) { this.rawTarget(h); this.base = this.drive.value; this.drive.target = 0; }
    else super.hold(h);
  }
  release(h) { super.release(h); }
  update(dt) {
    if (!this.held) {
      this.knobAngle *= Math.max(0, 1 - dt * 10);               // maçaneta volta por mola
      if (!this.latched && this.drive.value < 0.03 && Math.abs(this.drive.vel) < 1.5) this.latched = true;
    }
    if (this.latched && !this.held) { this.drive.mode = 'drive'; this.drive.target = 0; }
    else if (!this.held) super.update(dt);
    if (this.knob) this.knob.rotation.z = -Math.abs(this.knobAngle);
  }
  reset() { super.reset(); this.latched = true; this.knobAngle = 0; }
}

// ---------------- Joystick de máquina (I17): junta esférica ----------------
export class TiltControl extends Interactable {
  // o: {scope, name, obj, hitObj, shape, mats, anchor, colliders, mass, maxTilt}
  constructor(ix, o) {
    super(o);
    this.ix = ix; this.kind = 'control'; this.held = null; this.clickable = false;
    const sc = o.scope, ph = sc.physics;
    this.anchorW = sc.toWorld(o.anchor.clone()); this.baseQ = sc.quat.clone(); this.baseInv = sc.quat.clone().invert();
    this.body = sc.dynamic(o.obj, { pos: this.anchorW, quat: sc.quat, gravityScale: 0, angDamp: 1, linDamp: 1 });
    for (const c of o.colliders) ph.collider(this.body, c.shape, { group: GROUPS.CONTROL, mass: (o.mass || 0.3) / o.colliders.length, pos: c.pos, quat: c.quat });
    this.joint = sc.joint(ph.R.JointData.spherical({ x: o.anchor.x, y: o.anchor.y, z: o.anchor.z }, { x: 0, y: 0, z: 0 }), this.body);
    this.drive = sc.drive(new TiltDrive(ph, { joint: this.joint, body: this.body, baseQuat: sc.quat, maxTilt: o.maxTilt ?? 0.35 }));
    this.grabLocal = new THREE.Vector3();
  }
  // saídas normalizadas: x (direita +), y (frente +)
  get x() { return Math.max(-1, Math.min(1, -this.drive.tz / this.drive.maxTilt)); }
  get y() { return Math.max(-1, Math.min(1, -this.drive.tx / this.drive.maxTilt)); }
  grab(h) { this.held = h; this.drive.held = true; this.hitObj.updateWorldMatrix(true, false); this.grabLocal.copy(h.pos).applyMatrix4(_m.copy(this.hitObj.matrixWorld).invert()); }
  hold(h) {
    _v.copy(h.pos).sub(this.anchorW).applyQuaternion(this.baseInv);
    if (_v.y < 0.02) _v.y = 0.02;
    this.drive.targetX = Math.atan2(_v.z, _v.y); this.drive.targetZ = Math.atan2(-_v.x, _v.y);
  }
  release() { this.held = null; this.drive.held = false; this.drive.targetX = this.drive.targetZ = 0; }
  gripSeparation(h) { _v.copy(this.grabLocal).applyMatrix4(this.hitObj.matrixWorld); return _v.distanceTo(h.pos); }
  reset() { this.drive.reset(); }
}

// ---------------- Botão de apertar (I7): poke com a ponta do controle ----------------
// root: Object3D estático (eixo +Y local = direção de saída do botão). cap: peça móvel (filha de root).
export class PokeButton extends Interactable {
  constructor(ix, o) {
    super({ ...o, hitObj: o.cap, shape: o.shape || { type: 'sphere', r: o.radius * 1.2 } });
    this.ix = ix; this.kind = 'button'; this.clickable = true;
    this.root = o.root; this.cap = o.cap; this.r = o.radius; this.travel = o.travel ?? 0.012; this.top = o.top;
    this.capY = o.cap.position.y; this.depth = 0; this.pressed = false; this.clickT = 0; this.count = 0;
    this.onPress = o.onPress || null; this.onRelease = o.onRelease || null;
    this.inv = new THREE.Matrix4(); this.invReady = false; this.armed = [false, false];
  }
  click(h) { this.clickT = 0.18; h?.pulse(0.5, 25); }
  update(dt, hands) {
    if (!this.invReady) { this.root.updateWorldMatrix(true, false); this.inv.copy(this.root.matrixWorld).invert(); this.invReady = true; }
    let depth = 0, presser = null;
    for (let i = 0; i < hands.length; i++) {
      const h = hands[i]; if (h.desktop || !h.connected) continue;
      _v.copy(h.tip).applyMatrix4(this.inv);
      const k = h.handedness === 'left' ? 0 : 1, inCol = Math.hypot(_v.x, _v.z) < this.r + 0.008;
      // só "arma" com a ponta acima do topo; entrar por baixo/de lado não dispara
      if (_v.y > this.top - 0.002) this.armed[k] = true; else if (!inCol) this.armed[k] = false;
      if (inCol && this.armed[k] && _v.y > this.top - this.travel - 0.05) {
        const dd = Math.min(this.travel, Math.max(0, this.top - _v.y)); if (dd > depth) { depth = dd; presser = h; }
      }
    }
    if (this.clickT > 0) { this.clickT -= dt; depth = Math.max(depth, this.travel); }
    this.depth = depth; this.cap.position.y = this.capY - depth;
    if (!this.pressed && depth > this.travel * 0.6) { this.pressed = true; this.count++; presser?.pulse(0.6, 25); this.onPress?.(); }
    else if (this.pressed && depth < this.travel * 0.3) { this.pressed = false; this.onRelease?.(); }
  }
  reset() { this.depth = 0; this.pressed = false; this.clickT = 0; this.count = 0; this.cap.position.y = this.capY; }
}

// ================= Sistema de interação =================
export class Interaction {
  constructor(app) {
    this.app = app; this.renderer = app.renderer; this.scene = app.scene; this.camera = app.camera; this.rig = app.rig; this.ph = app.physics;
    this.items = []; this.buttons = []; this.panels = []; this.controls = [];
    this.hands = [new Hand('esquerda', 'left'), new Hand('direita', 'right')];
    this.desk = new Hand('mouse', 'none', true);
    this.xr = false; this.active = [this.desk];
    this.heldGrabs = new Set();
    this.mouse = { x: 0, y: 0, down: false, inside: false };
    this.cursors = [];
    this.setupXR(); this.setupDesktop();
    this.ph.pre.push(dt => this.preStep(dt));
  }

  // ---------- registro ----------
  add(it) {
    if (it.kind === 'button') this.buttons.push(it);
    if (it.kind === 'control' || it.kind === 'grab' || it.kind === 'button') this.items.push(it);
    if (it.kind === 'control') this.controls.push(it);
    return it;
  }
  remove(it) {
    for (const h of [...this.hands, this.desk]) if (h.held === it) this.release(h, false);
    for (const arr of [this.items, this.buttons, this.controls]) { const i = arr.indexOf(it); if (i >= 0) arr.splice(i, 1); }
    this.heldGrabs.delete(it);
  }
  addPanel(p) { this.panels.push(p); return p; }
  removePanel(p) { const i = this.panels.indexOf(p); if (i >= 0) this.panels.splice(i, 1); }

  // Cria um objeto pegável com corpo físico. scope: escopo da estação (rastreia para reset/dispose).
  grabbable(scope, { obj, shapes, mass, hit, twoHanded = false, distance = true, friction = 0.7, restitution = 0.1, ccd = true, mats, name, pos, quat }) {
    const body = scope.dynamic(obj, { pos, quat, ccd });
    const per = mass / shapes.length;
    for (const s of shapes) this.ph.collider(body, s.shape, { group: GROUPS.GRAB, mass: per, friction, restitution, pos: s.pos, quat: s.quat });
    const g = new Grabbable({ obj, body, mass, twoHanded, distance, shape: hit, mats, name });
    scope.track(g); return this.add(g);
  }

  // ---------- XR ----------
  setupXR() {
    const factory = new XRControllerModelFactory();
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
    for (let i = 0; i < 2; i++) {
      const ctrl = this.renderer.xr.getController(i), grip = this.renderer.xr.getControllerGrip(i);
      this.rig.add(ctrl); this.rig.add(grip);
      // modelo do controle (baixado do CDN de perfis WebXR); se falhar, usa um modelo simples
      const model = factory.createControllerModel(grip); grip.add(model);
      setTimeout(() => { if (model.children.length === 0) grip.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.12), new THREE.MeshLambertMaterial({ color: 0x333a40 }))); }, 8000);
      const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
      line.scale.z = 2; line.visible = false; ctrl.add(line);
      const cur = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      cur.visible = false; this.scene.add(cur);
      ctrl.addEventListener('connected', (e) => {
        const src = e.data; if (src.hand) return;   // mãos rastreadas: Fase 5
        const h = src.handedness === 'left' ? this.hands[0] : this.hands[1];
        h.source = src; h.ctrl = ctrl; h.gripObj = grip; h.line = line; h.cursor = cur; h.connected = true; h.clearHist();
      });
      ctrl.addEventListener('disconnected', (e) => {
        for (const h of this.hands) if (h.ctrl === ctrl) { if (h.held) this.release(h, false); h.connected = false; h.source = null; line.visible = false; cur.visible = false; }
      });
    }
  }
  setXR(on) {
    this.xr = on;
    if (this.desk.held) this.release(this.desk, false);
    this.renderer.domElement.style.cursor = 'default';
  }

  // ---------- Desktop ----------
  setupDesktop() {
    const el = this.renderer.domElement, m = this.mouse;
    const pos = (e) => { const r = el.getBoundingClientRect(); m.x = ((e.clientX - r.left) / r.width) * 2 - 1; m.y = -((e.clientY - r.top) / r.height) * 2 + 1; m.inside = true; };
    el.addEventListener('pointermove', pos);
    el.addEventListener('pointerleave', () => { m.inside = false; });
    el.addEventListener('pointerdown', (e) => { pos(e); if (e.button === 0) m.down = true; });
    window.addEventListener('pointerup', (e) => { if (e.button === 0) m.down = false; });
    el.addEventListener('wheel', (e) => { if (this.desk.held) { this.desk.holdDist = Math.min(5, Math.max(0.3, this.desk.holdDist - e.deltaY * 0.001)); e.preventDefault(); } }, { passive: false });
    this.deskCursor = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 6), new THREE.MeshBasicMaterial({ color: 0xf2c230 }));
    this.deskCursor.visible = false; this.scene.add(this.deskCursor);
  }

  // ---------- entradas (chamado no início do quadro) ----------
  readInputs() {
    if (this.xr) {
      this.active.length = 0;
      for (const h of this.hands) {
        h.gripPrev = h.grip; h.triggerPrev = h.trigger; h.topPrev = h.top; h.lowPrev = h.low; h.stickPrev = h.stick;
        if (!h.connected || !h.source?.gamepad) { h.grip = h.trigger = h.top = h.low = h.stick = false; h.ax = h.ay = 0; continue; }
        const gp = h.source.gamepad, b = gp.buttons;
        const tv = b[0]?.value ?? 0, gv = b[1]?.value ?? 0;
        h.trigger = h.trigger ? tv > 0.35 : tv > 0.6;  // histerese
        h.grip = h.grip ? gv > 0.35 : gv > 0.6;
        h.low = !!b[4]?.pressed; h.top = !!b[5]?.pressed; h.stick = !!b[3]?.pressed;   // A/X, B/Y, clique do polegar
        h.ax = gp.axes[2] || 0; h.ay = gp.axes[3] || 0;
        this.active.push(h);
      }
    } else {
      const h = this.desk; h.gripPrev = h.grip; h.triggerPrev = h.trigger;
      h.grip = h.trigger = this.mouse.down;
      this.active.length = 0; this.active.push(h);
    }
  }
  // ---------- poses (depois da locomoção mover o rig) ----------
  readPoses(t) {
    if (this.xr) {
      for (const h of this.hands) {
        if (!h.connected) continue;
        h.gripObj.matrixWorld.decompose(h.pos, h.quat, _s);
        h.rayO.setFromMatrixPosition(h.ctrl.matrixWorld);
        h.rayD.set(0, 0, -1).transformDirection(h.ctrl.matrixWorld);
        h.tip.copy(h.rayO).addScaledVector(h.rayD, 0.01);
        h.push(t);
      }
    } else {
      const h = this.desk;
      _ndc.set(this.mouse.x, this.mouse.y);
      _ray.setFromCamera(_ndc, this.camera);
      h.rayO.copy(_ray.ray.origin); h.rayD.copy(_ray.ray.direction);
      h.pos.copy(h.rayO).addScaledVector(h.rayD, h.holdDist);
      this.camera.getWorldQuaternion(h.quat);
      h.push(t);
    }
  }

  // ---------- atualização por quadro ----------
  update(dt) {
    for (const h of this.active) {
      if (h.held) this.holdUpdate(h, dt);
      else { this.hoverUpdate(h); this.pressUpdate(h); }
      this.visuals(h);
    }
    for (let i = 0; i < this.buttons.length; i++) this.buttons[i].update(dt, this.active);
    for (let i = 0; i < this.controls.length; i++) { const c = this.controls[i]; if (c.update) c.update(dt); }
    // destaque: 2 segurando, 1 em foco
    for (let i = 0; i < this.items.length; i++) this.items[i]._hl = 0;
    for (const h of this.active) { if (h.held) h.held._hl = 2; else if (h.hover && h.hover._hl < 1) h.hover._hl = 1; }
    for (let i = 0; i < this.items.length; i++) this.items[i].setHighlight(this.items[i]._hl);
    // cursor do mouse
    if (!this.xr) {
      const h = this.desk, el = this.renderer.domElement;
      el.style.cursor = h.held ? 'grabbing' : h.panel ? 'pointer' : h.hover ? (h.hover.kind === 'button' || h.hover.clickable ? 'pointer' : 'grab') : 'default';
    }
  }

  hoverUpdate(h) {
    let best = null, bestD = Infinity, near = false;
    if (!h.desktop) {
      for (let i = 0; i < this.items.length; i++) {
        const it = this.items[i]; if (!it.enabled || it.kind === 'button') continue;
        if (it.kind === 'control' && it.held && it.held !== h) continue;
        const d = pointDist(it, h.pos); if (d < NEAR && d < bestD) { bestD = d; best = it; near = true; }
      }
    }
    let panel = null, t = Infinity;
    if (!best) {
      for (let i = 0; i < this.panels.length; i++) { const tt = this.panels[i].rayHit(h.rayO, h.rayD); if (tt < t) { t = tt; panel = this.panels[i]; } }
      for (let i = 0; i < this.items.length; i++) {
        const it = this.items[i]; if (!it.enabled) continue;
        if (!h.desktop && it.kind === 'grab' && !it.distance) continue;
        if (!h.desktop && it.kind === 'control' && !it.clickable) continue; // controles: só pegada direta no VR (interruptor aceita clique)
        const tt = rayShape(it, h.rayO, h.rayD); if (tt < t && tt < RAY_MAX) { t = tt; best = it; panel = null; }
      }
    }
    if (h.panel && h.panel !== panel) h.panel.clearHover();
    if (panel) panel.hover(panel.hitX, panel.hitY);
    h.hover = best; h.near = near; h.panel = panel; h.hoverT = near ? 0 : t;
  }

  pressUpdate(h) {
    if (h.desktop) {
      if (!h.triggerDown) return;
      if (h.panel) { h.panel.click(h.panel.hitX, h.panel.hitY); return; }
      const it = h.hover; if (!it) return;
      if (it.kind === 'button' || (it.clickable && it.kind === 'control' && it instanceof Toggle)) { it.click(h); return; }
      h.holdDist = h.hoverT; h.pos.copy(h.rayO).addScaledVector(h.rayD, h.hoverT);
      this.grab(h, it, 'trigger');
      return;
    }
    if (h.gripDown && h.hover && h.near) { this.grab(h, h.hover, 'grip'); return; }
    if (h.triggerDown) {
      if (h.panel) { h.panel.click(h.panel.hitX, h.panel.hitY); h.pulse(0.3, 12); return; }
      const it = h.hover; if (!it) return;
      if (it.kind === 'button') { it.click(h); return; }
      if (it.clickable && !h.near) { it.click(h); return; }
      if (h.near || (it.kind === 'grab' && it.distance)) this.grab(h, it, 'trigger');
    }
  }

  grab(h, it, mode) {
    if (it.kind === 'button') return;
    if (it.kind === 'control') {
      if (it.held && it.held !== h) this.release(it.held, false);
      it.grab(h);
    } else {
      // objeto solto
      if (it.holders.length && !it.twoHanded) this.release(it.holders[0], false);   // troca de mão
      if (it.holders.length >= 2) return;
      it.holders.push(h);
      const far = !h.desktop && mode === 'trigger' && pointDist(it, h.pos) > NEAR;
      it.pulling = far;
      if (!far) this.setOffset(it, h);
      if (it.holders.length === 2) this.setTwoHand(it);
      this.heldGrabs.add(it); it.body.wakeUp();
    }
    h.held = it; h.mode = mode; h.sepTime = 0; h.hover = null;
    if (h.panel) { h.panel.clearHover(); h.panel = null; }
    h.pulse(0.35, 30);
  }
  setOffset(it, h) {
    _q.copy(h.quat).invert();
    it.offP.copy(it.obj.position).sub(h.pos).applyQuaternion(_q);
    it.offQ.copy(_q).multiply(it.obj.quaternion);
  }
  setTwoHand(it) {
    const a = it.holders[0], b = it.holders[1];
    it.v0.copy(b.pos).sub(a.pos).normalize(); it.m0.copy(a.pos).add(b.pos).multiplyScalar(0.5);
    it.p0.copy(it.obj.position); it.q0.copy(it.obj.quaternion); it.pulling = false;
  }

  release(h, throwIt = true) {
    const it = h.held; if (!it) return;
    h.held = null; h.mode = null;
    if (it.kind === 'control') { if (it.held === h) it.release(h); return; }
    const i = it.holders.indexOf(h); if (i >= 0) it.holders.splice(i, 1);
    if (it.holders.length) { this.setOffset(it, it.holders[0]); return; }
    this.heldGrabs.delete(it); it.pulling = false;
    if (throwIt) {
      // I3: velocidade média da mão nos últimos ~100 ms (+ ω × r)
      const v = h.avgVel(_v, 0.1), w = h.avgAngVel(_v2, 0.1);
      if (w.length() > 25) w.setLength(25);
      _v3.copy(it.obj.position).sub(h.pos); v.add(_v4.crossVectors(w, _v3));
      const vmax = Math.sqrt(2 * THROW_E / it.mass); if (v.length() > vmax) v.setLength(vmax);
      RV.x = v.x; RV.y = v.y; RV.z = v.z; it.body.setLinvel(RV, true);
      RV.x = w.x; RV.y = w.y; RV.z = w.z; it.body.setAngvel(RV, true);
    }
  }

  holdUpdate(h, dt) {
    const it = h.held;
    const keep = h.desktop ? h.trigger : (h.mode === 'grip' ? h.grip : h.trigger);
    if (!keep) { this.release(h, true); return; }
    if (it.kind === 'control') {
      it.hold(h, dt);
      if (!h.desktop && it.gripSeparation(h) > 0.35) { h.pulse(0.8, 40); this.release(h, false); }
      return;
    }
    // objeto solto: solta se ficar preso longe da mão (I5) — o alvo é aplicado em preStep
    if (!it.pulling && it.holders.length === 1 && it.sep > 0.6) { h.sepTime += dt; if (h.sepTime > 0.4) { h.pulse(0.8, 40); this.release(h, false); } }
    else h.sepTime = 0;
  }

  visuals(h) {
    if (h.desktop) {
      this.deskCursor.visible = !!h.held;
      if (h.held) this.deskCursor.position.copy(h.pos);
      return;
    }
    if (!h.line) return;
    const show = !h.held && !h.near;
    h.line.visible = show;
    const hit = isFinite(h.hoverT) && h.hoverT > 0 && (h.hover || h.panel);
    h.line.scale.z = hit ? h.hoverT : 2;
    h.line.material.color.setHex(h.panel ? 0xf2c230 : h.hover ? 0x6fb3e0 : 0xffffff);
    h.cursor.visible = show && !!hit;
    if (h.cursor.visible) h.cursor.position.copy(h.rayO).addScaledVector(h.rayD, h.hoverT);
  }

  // ---------- passo de física: puxa objetos segurados (PD com força limitada) ----------
  preStep(dt) {
    for (const it of this.heldGrabs) {
      const H = it.holders; if (!H.length) continue;
      const tp = it.tp, tq = it.tq; let F = F_HAND, vh = _v3;
      if (H.length === 1) {
        const h = H[0]; vh.copy(h.vel);
        if (it.pulling) {
          tp.copy(h.pos); tq.copy(it.obj.quaternion);
          if (it.obj.position.distanceTo(h.pos) < 0.12) { it.pulling = false; this.setOffset(it, h); }
        } else { tp.copy(it.offP).applyQuaternion(h.quat).add(h.pos); tq.copy(h.quat).multiply(it.offQ); }
      } else {
        // I4: rotação pela linha entre as mãos
        const a = H[0], b = H[1]; F = F_HAND * 2;
        _v.copy(b.pos).sub(a.pos).normalize(); _q.setFromUnitVectors(it.v0, _v);
        _v2.copy(a.pos).add(b.pos).multiplyScalar(0.5);
        tp.copy(it.p0).sub(it.m0).applyQuaternion(_q).add(_v2); tq.copy(_q).multiply(it.q0);
        vh.copy(a.vel).add(b.vel).multiplyScalar(0.5);
      }
      this.drivePD(it, tp, tq, vh, F, dt);
    }
  }
  drivePD(it, tp, tq, vh, F, dt) {
    const b = it.body, t = b.translation(), lv = b.linvel(), av = b.angvel();
    const om = it.pulling ? 14 : it.omega, ze = it.pulling ? 1 : it.zeta, m = it.mass;
    // posição
    let ex = tp.x - t.x, ey = tp.y - t.y, ez = tp.z - t.z;
    const el = Math.hypot(ex, ey, ez); it.sep = el;
    const lim = it.pulling ? 0.6 : 0.25; if (el > lim) { ex *= lim / el; ey *= lim / el; ez *= lim / el; }
    let ax = om * om * ex + 2 * ze * om * (vh.x - lv.x), ay = om * om * ey + 2 * ze * om * (vh.y - lv.y) + 9.81, az = om * om * ez + 2 * ze * om * (vh.z - lv.z);
    const cap = F / m, an = Math.hypot(ax, ay, az); if (an > cap) { ax *= cap / an; ay *= cap / an; az *= cap / an; }
    let vx = lv.x + ax * dt, vy = lv.y + ay * dt, vz = lv.z + az * dt;
    const vmax = it.pulling ? 7 : 10, vn = Math.hypot(vx, vy, vz); if (vn > vmax) { vx *= vmax / vn; vy *= vmax / vn; vz *= vmax / vn; }
    RV.x = vx; RV.y = vy; RV.z = vz; b.setLinvel(RV, true);
    // rotação
    if (!it.pulling) {
      const r = b.rotation(); _q2.set(r.x, r.y, r.z, r.w).invert(); _q3.copy(tq).multiply(_q2);
      quatToRotVec(_q3, _v4);
      let wx = av.x + (om * om * _v4.x - 2 * ze * om * av.x) * dt, wy = av.y + (om * om * _v4.y - 2 * ze * om * av.y) * dt, wz = av.z + (om * om * _v4.z - 2 * ze * om * av.z) * dt;
      const wn = Math.hypot(wx, wy, wz); if (wn > 20) { wx *= 20 / wn; wy *= 20 / wn; wz *= 20 / wn; }
      RV.x = wx; RV.y = wy; RV.z = wz; b.setAngvel(RV, true);
    }
  }

  // teleporte: limpa histórico (evita arremesso fantasma) e leva junto o que está na mão
  onTeleport(delta) {
    for (const h of this.hands) h.clearHist();
    for (const it of this.heldGrabs) {
      _v.copy(it.obj.position).add(delta);
      this.ph.setPose(it.body, _v, it.obj.quaternion);
    }
  }
}
