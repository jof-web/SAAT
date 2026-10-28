// physics.js — mundo Rapier em passo fixo, sincronização corpo→malha com interpolação
// e "drives" de junta (motor de velocidade) usados por todos os controles.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

// Grupos de colisão: STATIC colide com GRAB; GRAB com tudo; CONTROL só com GRAB.
// (peças móveis dos controles não travam na carcaça da própria estação)
const M = { STATIC: 0x1, GRAB: 0x2, CONTROL: 0x4 };
const grp = (member, filter) => ((member << 16) | filter) >>> 0;
export const GROUPS = {
  STATIC: grp(M.STATIC, M.GRAB),
  GRAB: grp(M.GRAB, M.STATIC | M.GRAB | M.CONTROL),
  CONTROL: grp(M.CONTROL, M.GRAB),
};

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const vec = { x: 0, y: 0, z: 0 }; // objeto reaproveitado para chamadas ao Rapier

export class Physics {
  static async create() {
    // rapier3d-compat traz o wasm embutido em base64; init() precisa ser aguardado
    await RAPIER.init();
    return new Physics();
  }
  constructor() {
    this.R = RAPIER;
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.dt = 1 / 90;                 // passo fixo (estável para juntas)
    this.world.timestep = this.dt;
    this.acc = 0; this.alpha = 1; this.maxSub = 4;
    this.pre = [];                    // callbacks antes de cada passo: fn(dt)
    this.synced = [];                 // {body, obj, p0, p1, q0, q1}
    this.drives = new Set();
    this.stepCount = 0;
  }

  fixedBody(pos, quat) {
    const d = RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z);
    if (quat) d.setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w });
    return this.world.createRigidBody(d);
  }

  // shape: {type:'box', hx,hy,hz} | {type:'ball', r} | {type:'cyl', hh, r}; offset opcional {pos:Vector3, quat:Quaternion}
  collider(body, shape, { group = GROUPS.STATIC, friction = 0.7, restitution = 0.05, mass = null, density = null, pos = null, quat = null, sensor = false } = {}) {
    let d;
    if (shape.type === 'box') d = RAPIER.ColliderDesc.cuboid(shape.hx, shape.hy, shape.hz);
    else if (shape.type === 'ball') d = RAPIER.ColliderDesc.ball(shape.r);
    else if (shape.type === 'cyl') d = RAPIER.ColliderDesc.cylinder(shape.hh, shape.r);
    else throw new Error('forma desconhecida: ' + shape.type);
    if (pos) d.setTranslation(pos.x, pos.y, pos.z);
    if (quat) d.setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w });
    if (mass != null) d.setMass(mass); else if (density != null) d.setDensity(density);
    d.setFriction(friction).setRestitution(restitution).setCollisionGroups(group).setSolverGroups(group).setSensor(sensor);
    return this.world.createCollider(d, body);
  }

  // Corpo dinâmico sincronizado com obj (obj deve estar direto na cena, sem pai transformado)
  dynamicBody(obj, { pos, quat, ccd = false, gravityScale = 1, linDamp = 0.05, angDamp = 0.1, canSleep = true } = {}) {
    const p = pos || obj.position, q = quat || obj.quaternion;
    const d = RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z)
      .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setCcdEnabled(ccd).setGravityScale(gravityScale)
      .setLinearDamping(linDamp).setAngularDamping(angDamp).setCanSleep(canSleep);
    const body = this.world.createRigidBody(d);
    obj.position.copy(p); obj.quaternion.copy(q);
    this.synced.push({ body, obj, p0: obj.position.clone(), p1: obj.position.clone(), q0: obj.quaternion.clone(), q1: obj.quaternion.clone() });
    return body;
  }

  removeBody(body) {
    const i = this.synced.findIndex(s => s.body === body); if (i >= 0) this.synced.splice(i, 1);
    if (this.world.bodies.contains(body.handle)) this.world.removeRigidBody(body);
  }

  // Coloca o corpo numa pose sem interpolar (reset/teleporte)
  setPose(body, pos, quat) {
    body.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true);
    body.setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w }, true);
    vec.x = vec.y = vec.z = 0; body.setLinvel(vec, true); body.setAngvel(vec, true);
    const s = this.synced.find(e => e.body === body);
    if (s) { s.p0.copy(pos); s.p1.copy(pos); s.q0.copy(quat); s.q1.copy(quat); s.obj.position.copy(pos); s.obj.quaternion.copy(quat); }
  }

  step(frameDt) {
    this.acc += Math.min(frameDt, 0.1);
    let n = 0;
    while (this.acc >= this.dt && n < this.maxSub) {
      for (let i = 0; i < this.pre.length; i++) this.pre[i](this.dt);
      for (const d of this.drives) d.apply(this.dt);
      this.world.step();
      this.stepCount++;
      // guarda estado anterior e atual para interpolar
      for (let i = 0; i < this.synced.length; i++) {
        const s = this.synced[i];
        s.p0.copy(s.p1); s.q0.copy(s.q1);
        if (!s.body.isSleeping()) {
          const t = s.body.translation(), r = s.body.rotation();
          s.p1.set(t.x, t.y, t.z); s.q1.set(r.x, r.y, r.z, r.w);
        }
      }
      this.acc -= this.dt; n++;
    }
    if (n === this.maxSub) this.acc = 0; // evita espiral quando o quadro atrasa muito
    this.alpha = this.acc / this.dt;
    for (let i = 0; i < this.synced.length; i++) {
      const s = this.synced[i];
      s.obj.position.lerpVectors(s.p0, s.p1, this.alpha);
      s.obj.quaternion.slerpQuaternions(s.q0, s.q1, this.alpha);
    }
  }
}

// ---------- Drive de junta ----------
// Mede a coordenada da junta (ângulo desenrolado ou deslocamento) e aciona o motor de velocidade.
// modos: 'drive' (vai até target), 'brake' (segura onde está), 'free' (atrito leve)
const TAU = Math.PI * 2;
const wrap = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

export class JointDrive {
  constructor(ph, o) {
    this.ph = ph; this.kind = o.kind; this.joint = o.joint; this.body = o.body;
    this.axis = o.axis.clone().normalize();          // eixo no referencial da base
    this.baseQ = o.baseQuat.clone(); this.baseInv = o.baseQuat.clone().invert();
    this.axisW = this.axis.clone().applyQuaternion(this.baseQ);
    this.anchorW = o.anchorWorld.clone();            // posição da junta no mundo
    this.min = o.min ?? -Infinity; this.max = o.max ?? Infinity;
    this.maxVel = o.maxVel ?? 6; this.gain = o.gain ?? 18;
    this.fDrive = o.fDrive ?? 800; this.fBrake = o.fBrake ?? 400; this.fFree = o.fFree ?? 3;
    this.rest = o.rest ?? 'brake'; this.mode = this.rest;
    this.init = o.init ?? 0; this.value = this.init; this.target = this.init; this.vel = 0;
    this.prevTwist = wrap(this.init); this.held = false; this.active = true;
    if (this.joint.setMotorMaxForce) this.joint.setMotorMaxForce(o.maxForce ?? 200);
    try { this.joint.configureMotorModel(RAPIER.MotorModel.AccelerationBased); } catch (e) { /* versão sem enum */ }
  }
  measure(dt) {
    if (this.kind === 'revolute') {
      const r = this.body.rotation();
      _q.set(r.x, r.y, r.z, r.w).premultiply(this.baseInv);           // rotação relativa à base
      const s = _q.x * this.axis.x + _q.y * this.axis.y + _q.z * this.axis.z;
      const th = wrap(2 * Math.atan2(s, _q.w));
      const d = wrap(th - this.prevTwist); this.prevTwist = th;
      this.value += d; this.vel = this.vel * 0.6 + (d / dt) * 0.4;
    } else {
      const t = this.body.translation();
      const nv = (t.x - this.anchorW.x) * this.axisW.x + (t.y - this.anchorW.y) * this.axisW.y + (t.z - this.anchorW.z) * this.axisW.z;
      this.vel = this.vel * 0.6 + ((nv - this.value) / dt) * 0.4; this.value = nv;
    }
  }
  apply(dt) {
    if (!this.active && !this.held) return;
    if (this.body.isSleeping() && this.mode !== 'drive') return;
    this.measure(dt);
    let v = 0, f = this.fBrake;
    if (this.mode === 'drive') {
      const t = Math.min(this.max, Math.max(this.min, this.target));
      v = Math.max(-this.maxVel, Math.min(this.maxVel, (t - this.value) * this.gain)); f = this.fDrive;
      if (Math.abs(t - this.value) > 1e-3) this.body.wakeUp();
    } else if (this.mode === 'free') f = this.fFree;
    // limite por software (válvula multivoltas, manivela sem limite de junta)
    if ((this.value <= this.min && v <= 0 && this.vel < 0) || (this.value >= this.max && v >= 0 && this.vel > 0)) { v = 0; f = this.fDrive; }
    this.joint.configureMotorVelocity(v, f);
  }
  // Volta ao valor inicial (o corpo já foi reposicionado pelo reset da estação)
  reset() { this.value = this.init; this.target = this.init; this.prevTwist = wrap(this.init); this.vel = 0; this.mode = this.rest; this.held = false; }
}

// Drive de junta esférica (joystick): inclinações em X e Z e torção em Y travada.
// O wrapper JS 0.21 não expõe motores por eixo na classe esférica; usamos o conjunto bruto.
export class TiltDrive {
  constructor(ph, o) {
    this.ph = ph; this.joint = o.joint; this.body = o.body;
    this.baseInv = o.baseQuat.clone().invert();
    this.maxTilt = o.maxTilt ?? 0.35; this.gain = o.gain ?? 16; this.f = o.f ?? 900;
    this.tx = 0; this.tz = 0; this.ty = 0; this.targetX = 0; this.targetZ = 0; this.held = false; this.active = true;
    this.raw = this.joint.rawSet; this.h = this.joint.handle;
    const A = RAPIER.JointAxis;
    this.axes = [A.AngX, A.AngY, A.AngZ];
    for (const ax of this.axes) { try { this.raw.jointSetMotorMaxForce(this.h, ax, o.maxForce ?? 60); } catch (e) { } }
  }
  measure() {
    const r = this.body.rotation();
    _q.set(r.x, r.y, r.z, r.w).premultiply(this.baseInv);
    _v.set(0, 1, 0).applyQuaternion(_q);                 // vetor "para cima" da haste
    this.tx = Math.atan2(_v.z, _v.y);                     // inclinação em torno de X
    this.tz = Math.atan2(-_v.x, _v.y);                    // inclinação em torno de Z
    this.ty = wrap(2 * Math.atan2(_q.y, _q.w));            // torção (travada em 0)
  }
  apply() {
    if (!this.active && !this.held) return;
    if (this.body.isSleeping() && !this.held && Math.abs(this.targetX) + Math.abs(this.targetZ) < 1e-4) return;
    this.measure();
    const m = this.maxTilt, cl = (x) => Math.max(-m, Math.min(m, x));
    const vx = (cl(this.targetX) - this.tx) * this.gain, vz = (cl(this.targetZ) - this.tz) * this.gain, vy = -this.ty * this.gain;
    this.raw.jointConfigureMotorVelocity(this.h, this.axes[0], vx, this.f);
    this.raw.jointConfigureMotorVelocity(this.h, this.axes[1], vy, this.f);
    this.raw.jointConfigureMotorVelocity(this.h, this.axes[2], vz, this.f);
    if (Math.abs(vx) + Math.abs(vz) > 1e-3) this.body.wakeUp();
  }
  reset() { this.targetX = this.targetZ = 0; this.tx = this.tz = this.ty = 0; this.held = false; }
}

export { RAPIER };
