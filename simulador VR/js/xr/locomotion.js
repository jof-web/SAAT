// locomotion.js — L1 a L8: teleporte com arco, movimento contínuo, giro snap/suave, room-scale,
// modo sentado/altura, vinheta de conforto, teleporte pelo menu. Também o movimento do modo desktop.
import * as THREE from 'three';

const KEY = 'vrlab:settings';
// padrão: andar (contínua) ligado, teleporte desligado; hand = mão dominante; run = multiplicador da corrida
const DEF = { teleport: false, continuous: true, speed: 1.5, run: 2, hand: 'right', turn: 'snap30', smoothSpeed: 90, vignette: true, seated: false, seatOffset: 0, manual: 0 };
const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _vel = new THREE.Vector3();
const N = 48;

export class Locomotion {
  constructor(app) {
    this.app = app; this.rig = app.rig; this.camera = app.camera; this.scene = app.scene;
    this.bounds = app.bounds; this.blocked = app.blocked;
    this.s = { ...DEF }; try { Object.assign(this.s, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { }
    this.yaw = 0; this.pitch = 0; this.turnArmed = true; this.running = false; this.aimHand = null; this.valid = false;
    this.target = new THREE.Vector3(); this.home = { x: 0, z: 2, yaw: 0 };
    this.vigI = 0; this.fade = 0; this.onTeleport = null;
    this.keys = new Set(); this.drag = false;
    this.buildArc(); this.buildVignette(); this.setupDesktop();
    this.applyHeight();
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.s)); } catch (e) { } }
  resetSettings() { Object.assign(this.s, DEF); this.applyHeight(); this.save(); }

  // ---------- visuais ----------
  buildArc() {
    this.arcPos = new Float32Array((N + 1) * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.arcPos, 3));
    this.arc = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x3ddc6a }));
    this.arc.frustumCulled = false; this.arc.visible = false; this.scene.add(this.arc);
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x3ddc6a }));
    this.marker.visible = false; this.scene.add(this.marker);
  }
  buildVignette() {
    this.vigMat = new THREE.ShaderMaterial({
      uniforms: { uI: { value: 0 }, uF: { value: 0 } }, transparent: true, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying vec2 vUv; uniform float uI; uniform float uF; void main(){ float r = length(vUv-0.5)*2.0; float a = smoothstep(0.30,0.80,r)*uI; gl_FragColor = vec4(0.0,0.0,0.0,max(a,uF)); }',
    });
    this.vig = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), this.vigMat);
    this.vig.position.z = -0.25; this.vig.renderOrder = 1000; this.vig.frustumCulled = false; this.vig.visible = false;
    this.camera.add(this.vig);
  }

  // ---------- cabeça ----------
  head(out) { return out.copy(this.camera.position).applyQuaternion(this.rig.quaternion).add(this.rig.position); }
  headYaw() { _q.copy(this.rig.quaternion).multiply(this.camera.quaternion); _v.set(0, 0, -1).applyQuaternion(_q); return Math.atan2(-_v.x, -_v.z); }

  rotateAroundHead(a) {
    const H = this.head(_p);
    _q.setFromAxisAngle(UP, a);
    this.rig.position.sub(H).applyQuaternion(_q).add(H);
    this.rig.quaternion.premultiply(_q); this.yaw += a;
  }
  // L1/L8: coloca a cabeça em (x,z); yaw opcional = direção do olhar
  teleportTo(x, z, yaw = null) {
    if (yaw !== null) this.rotateAroundHead(yaw - this.headYaw());
    const H = this.head(_p); _v2.set(x - H.x, 0, z - H.z);
    this.rig.position.add(_v2); this.fade = 1;
    this.onTeleport?.(_v2);
  }
  goHome() { this.teleportTo(this.home.x, this.home.z, this.home.yaw); }
  setHome(x, z, yaw) { this.home = { x, z, yaw }; }

  // L6: altura
  applyHeight() { this.rig.position.y = (this.s.seated ? this.s.seatOffset : 0) + this.s.manual; }
  setSeated(on, xr) {
    this.s.seated = on;
    if (on) this.s.seatOffset = xr ? Math.min(1.2, Math.max(0, 1.6 - this.camera.position.y)) : 0;
    this.applyHeight(); this.save();
  }
  nudgeHeight(d) { this.s.manual = Math.round((this.s.manual + d) * 100) / 100; this.applyHeight(); this.save(); }

  clampHead() {
    const H = this.head(_p), b = this.bounds, m = 0.3;
    const x = Math.min(b.maxX - m, Math.max(b.minX + m, H.x)), z = Math.min(b.maxZ - m, Math.max(b.minZ + m, H.z));
    this.rig.position.x += x - H.x; this.rig.position.z += z - H.z;
  }
  isValid(x, z) {
    const b = this.bounds, m = 0.3;
    if (x < b.minX + m || x > b.maxX - m || z < b.minZ + m || z > b.maxZ - m) return false;
    for (const r of this.blocked) if (x > r.minX - 0.2 && x < r.maxX + 0.2 && z > r.minZ - 0.2 && z < r.maxZ + 0.2) return false;
    return true;
  }

  // ---------- quadro ----------
  update(dt, xr, hands) {
    let moving = false, smooth = false;
    if (xr) {
      // mão dominante (config): gira e teleporta; a outra anda e corre
      const D = this.s.hand === 'left' ? hands[0] : hands[1], M = this.s.hand === 'left' ? hands[1] : hands[0];
      // L1: teleporte (opcional) — polegar dominante para frente; o outro só se a contínua estiver desligada
      const cand = this.s.teleport ? [D.connected ? D : null, !this.s.continuous && M.connected ? M : null] : [];
      if (!this.aimHand) { for (const h of cand) if (h && h.ay < -0.6 && !h.held) { this.aimHand = h; break; } }
      if (this.aimHand) {
        const h = this.aimHand;
        if (h.ay > -0.3 || !h.connected) {
          if (this.valid) this.teleportTo(this.target.x, this.target.z);
          this.aimHand = null; this.arc.visible = this.marker.visible = false;
        } else this.computeArc(h);
      }
      // L2: andar no polegar não dominante; L9: clicar o polegar = correr até soltar o polegar
      if (this.s.continuous && M.connected && this.aimHand !== M) {
        const x = Math.abs(M.ax) > 0.15 ? M.ax : 0, y = Math.abs(M.ay) > 0.15 ? M.ay : 0;
        if (M.stick && !M.stickPrev) this.running = !this.running;
        if (x || y) {
          const yaw = this.headYaw(), sp = this.s.speed * (this.running ? this.s.run : 1) * dt;
          const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
          this.rig.position.x += (fx * -y + Math.cos(yaw) * x) * sp;
          this.rig.position.z += (fz * -y - Math.sin(yaw) * x) * sp;
          this.clampHead(); moving = true;
        } else this.running = false;
      }
      // L3/L4: giro no polegar dominante
      if (D.connected && this.aimHand !== D) {
        const x = D.ax;
        if (this.s.turn === 'smooth') {
          if (Math.abs(x) > 0.2) { this.rotateAroundHead(-x * THREE.MathUtils.degToRad(this.s.smoothSpeed) * dt); smooth = true; }
        } else if (this.s.turn !== 'off') {
          const step = THREE.MathUtils.degToRad(this.s.turn === 'snap45' ? 45 : 30);
          if (this.turnArmed && Math.abs(x) > 0.7) { this.rotateAroundHead(x > 0 ? -step : step); this.turnArmed = false; this.fade = Math.max(this.fade, 0.6); }
          if (Math.abs(x) < 0.3) this.turnArmed = true;
        }
      }
    } else {
      // modo desktop: WASD/setas + Q/E; botão direito do mouse arrasta para olhar
      const k = this.keys, sp = this.s.speed * (k.has('ShiftLeft') || k.has('ShiftRight') ? this.s.run : 1) * dt;
      let f = 0, r = 0;
      if (k.has('KeyW') || k.has('ArrowUp')) f += 1; if (k.has('KeyS') || k.has('ArrowDown')) f -= 1;
      if (k.has('KeyD')) r += 1; if (k.has('KeyA')) r -= 1;
      if (k.has('KeyQ') || k.has('ArrowLeft')) this.rotateAroundHead(1.6 * dt);
      if (k.has('KeyE') || k.has('ArrowRight')) this.rotateAroundHead(-1.6 * dt);
      if (f || r) {
        const yaw = this.yaw;
        this.rig.position.x += (-Math.sin(yaw) * f + Math.cos(yaw) * r) * sp;
        this.rig.position.z += (-Math.cos(yaw) * f - Math.sin(yaw) * r) * sp;
        this.clampHead();
      }
      this.camera.position.set(0, 1.65, 0); this.camera.rotation.set(this.pitch, 0, 0);
    }
    // L7: vinheta durante movimento contínuo/giro suave; piscada no teleporte
    const want = (moving || smooth) && this.s.vignette ? 1 : 0;
    this.vigI += (want - this.vigI) * Math.min(1, dt * 8);
    this.fade = Math.max(0, this.fade - dt * 6);
    this.vigMat.uniforms.uI.value = this.vigI; this.vigMat.uniforms.uF.value = this.fade;
    this.vig.visible = this.vigI > 0.01 || this.fade > 0.01;
  }

  computeArc(h) {
    const P = this.arcPos; let n = 0;
    _p.copy(h.rayO); _vel.copy(h.rayD).multiplyScalar(8);
    const dt = 0.03; let landed = false;
    for (let i = 0; i < N; i++) {
      P[n * 3] = _p.x; P[n * 3 + 1] = _p.y; P[n * 3 + 2] = _p.z; n++;
      const nx = _p.x + _vel.x * dt, ny = _p.y + _vel.y * dt, nz = _p.z + _vel.z * dt;
      _vel.y -= 9.81 * dt;
      if (ny <= 0) {
        const f = _p.y / (_p.y - ny);
        this.target.set(_p.x + (nx - _p.x) * f, 0, _p.z + (nz - _p.z) * f);
        P[n * 3] = this.target.x; P[n * 3 + 1] = 0.01; P[n * 3 + 2] = this.target.z; n++; landed = true; break;
      }
      _p.set(nx, ny, nz);
    }
    this.valid = landed && this.isValid(this.target.x, this.target.z) && this.target.distanceTo(this.head(_v)) < 14;
    const c = this.valid ? 0x3ddc6a : 0xe5484d;
    this.arc.material.color.setHex(c); this.marker.material.color.setHex(c);
    this.arc.geometry.attributes.position.needsUpdate = true; this.arc.geometry.setDrawRange(0, n);
    this.arc.visible = true; this.marker.visible = landed; if (landed) this.marker.position.set(this.target.x, 0.01, this.target.z);
  }

  // ---------- desktop ----------
  setupDesktop() {
    const el = this.app.renderer.domElement;
    const typing = () => { const a = document.activeElement; return a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT'); };
    window.addEventListener('keydown', (e) => { if (!typing()) this.keys.add(e.code); });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => { if (e.button === 2 || e.button === 1) { this.drag = true; el.setPointerCapture(e.pointerId); } });
    el.addEventListener('pointerup', (e) => { if (e.button === 2 || e.button === 1) this.drag = false; });
    el.addEventListener('pointermove', (e) => {
      if (!this.drag || this.app.xrActive) return;
      this.rotateAroundHead(-e.movementX * 0.004);
      this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch - e.movementY * 0.004));
    });
  }
  // ao sair do VR: devolve a câmera ao controle do desktop
  resetDesktopCamera() { this.camera.position.set(0, 1.65, 0); this.pitch = 0; this.camera.rotation.set(0, 0, 0); this.arc.visible = this.marker.visible = false; this.aimHand = null; }
}
