// Controle em 1ª pessoa: mouse preso (Pointer Lock) ou arrastar como reserva, WASD/setas, Shift, C (pés juntos /
// agachar), colisão por AABB com deslizamento, balanço de cabeça e passos. Também faz a câmera de inspeção (tween).
import { Vector3, PerspectiveCamera } from 'three';
import type { AABB } from './common';
import { GFX } from './gfx';

export class Player {
  pos = new Vector3(0, 0, 0); yaw = 0; pitch = -0.05; eye = 1.65; crouch = 0; keys: Record<string, boolean> = {};
  locked = false; enabled = true; lookEnabled = true; speedMul = 1; bob = 0; stepDist = 0; moving = 0;
  onStep: (run: boolean) => void = () => {};
  shake = 0; fall = 0; roll = 0;
  private drag = { on: false, x: 0, y: 0 };
  // inspeção / assento
  view: { pos: Vector3; look: Vector3; t: number; dur: number; from: { pos: Vector3; look: Vector3 }; back: boolean } | null = null;
  constructor(public cam: PerspectiveCamera, public canvas: HTMLCanvasElement, public colliders: () => AABB[]) {
    addEventListener('keydown', (e) => { const t = e.target as HTMLElement; if (t?.closest?.('input,textarea,select,[contenteditable]')) return; this.keys[e.code] = true; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault(); });
    addEventListener('keyup', (e) => (this.keys[e.code] = false)); addEventListener('blur', () => (this.keys = {}));
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; });
    addEventListener('mousemove', (e) => {
      if (!this.enabled || !this.lookEnabled || this.view) return;
      if (this.locked) { this.yaw -= e.movementX * 0.0022; this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch - e.movementY * 0.0022)); }
      else if (this.drag.on) { const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y; this.yaw -= dx * 0.004; this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch - dy * 0.004)); this.drag.x = e.clientX; this.drag.y = e.clientY; }
    });
    canvas.addEventListener('mousedown', (e) => { if (e.button === 2 || (!this.locked && e.button === 0 && e.shiftKey)) { this.drag = { on: true, x: e.clientX, y: e.clientY }; } });
    addEventListener('mouseup', () => (this.drag.on = false));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  lock() { if (this.locked || !this.enabled || GFX.xr) return; try { const r: any = this.canvas.requestPointerLock(); r?.catch?.(() => {}); } catch { /* sem pointer lock: arrastar com botão direito */ } }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  place(x: number, z: number, yaw: number) { this.pos.set(x, 0, z); this.yaw = yaw; this.pitch = -0.05; this.view = null; }
  /** Colisão (AABB + limites do mundo). Pública: o VR usa a mesma regra na posição da cabeça. */
  hit(x: number, z: number, r = 0.27) { for (const [a, b, c, d] of this.colliders()) if (x + r > a && x - r < c && z + r > b && z - r < d) return true; return x < -14 || x > 74 || z < -40 || z > 94; }
  /** Tween da câmera para um enquadramento (inspeção) e de volta. */
  goView(pos: Vector3, look: Vector3, dur = 0.45) { const from = { pos: this.cam.position.clone(), look: this.cam.position.clone().add(this.dir()) }; this.view = { pos: pos.clone(), look: look.clone(), t: 0, dur, from, back: false }; }
  leaveView(dur = 0.35) { if (!this.view) return; const v = this.view; v.from = { pos: this.cam.position.clone(), look: v.look.clone() }; v.pos = this.headPos(); v.look = this.headPos().add(this.dir()); v.t = 0; v.dur = dur; v.back = true; }
  dir() { return new Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)); }
  headPos() { return new Vector3(this.pos.x, this.eye - this.crouch * 0.5, this.pos.z); }
  update(dt: number) {
    const k = this.keys;
    if (this.view) {
      const v = this.view; v.t = Math.min(v.dur, v.t + dt); const e = 1 - Math.pow(1 - v.t / v.dur, 3);
      this.cam.position.lerpVectors(v.from.pos, v.pos, e); const look = v.from.look.clone().lerp(v.look, e); this.cam.up.set(0, 1, 0); this.cam.lookAt(look);
      if (v.back && v.t >= v.dur) this.view = null; return;
    }
    let fx = 0, fz = 0; if (this.enabled) { if (k.KeyW || k.ArrowUp) fz += 1; if (k.KeyS || k.ArrowDown) fz -= 1; if (k.KeyA || k.ArrowLeft) fx -= 1; if (k.KeyD || k.ArrowRight) fx += 1; }
    const run = !!(k.ShiftLeft || k.ShiftRight); this.crouch += ((k.KeyC && this.enabled ? 1 : 0) - this.crouch) * Math.min(1, dt * 8);
    const sp = (run ? 3.6 : 1.7) * (1 - this.crouch * 0.6) * this.speedMul;
    let mx = 0, mz = 0; const l = Math.hypot(fx, fz);
    if (l) { fx /= l; fz /= l; const sn = Math.sin(this.yaw), cs = Math.cos(this.yaw); mx = (-sn * fz + cs * fx) * sp * dt; mz = (-cs * fz - sn * fx) * sp * dt; }
    const p = this.pos; let moved = 0;
    if (mx && !this.hit(p.x + mx, p.z)) { p.x += mx; moved += Math.abs(mx); } if (mz && !this.hit(p.x, p.z + mz)) { p.z += mz; moved += Math.abs(mz); }
    this.moving += ((moved > 0 ? 1 : 0) - this.moving) * Math.min(1, dt * 10);
    if (moved) { this.stepDist += moved; this.bob += moved * (run ? 2.6 : 3.4); const sl = run ? 0.85 : 0.62; if (this.stepDist > sl) { this.stepDist = 0; this.onStep(run); } }
    const by = Math.sin(this.bob * 2) * 0.028 * this.moving, bx = Math.cos(this.bob) * 0.018 * this.moving;
    this.shake = Math.max(0, this.shake - dt * 1.6); const sh = this.shake * this.shake;
    const eye = this.eye - this.crouch * 0.5 - this.fall * (this.eye - 0.25);
    this.cam.position.set(p.x + bx * Math.cos(this.yaw) + (Math.random() - 0.5) * sh * 0.15, eye + by + (Math.random() - 0.5) * sh * 0.1, p.z - bx * Math.sin(this.yaw));
    this.cam.rotation.set(this.pitch + (Math.random() - 0.5) * sh * 0.05, this.yaw, this.roll + Math.sin(this.bob) * 0.004 * this.moving, 'YXZ');
  }
}
