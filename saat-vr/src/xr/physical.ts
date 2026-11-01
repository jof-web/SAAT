// Interação física no VR: o dedo aperta botão; o grip pega e manipula (seletora, alavanca, manivela, porta, tampa,
// portas e armários); a ferramenta na mão encosta no ponto (detector, cadeado, aterramento); EPI físico (inspeciona
// olhando de perto, veste levando à cabeça/mãos/tronco); cinto de ferramentas; o que se solta cai; resgate pelas mãos.
// Só envia comandos para o simulador, como o PC (mesma lógica de peças via Interaction.actVR).
import { Box3, Group, Matrix4, Mesh, Object3D, Quaternion, Vector3, BoxGeometry, CylinderGeometry, SphereGeometry, MeshLambertMaterial } from 'three';
import { AutoBatch } from '../game/gfx';
import { TOOL_NAMES } from '../game/hands';
import type { Hand } from './input';

export interface PhysHost {
  W: any; inter: any; scene: Object3D; sess(): any; cmd(c: any): any; setTool(id: string | null): void; tool(): string | null; toast(m: string, k?: string): void; refreshEpi(): void;
  audio: any; takeDea(): void; deaTaken(): boolean; safety: any; rcpQualidade(ts: number[]): number; fallback(t: any, ops: [string, () => void][]): void;
}
type Cat = 'poke' | 'rot' | 'crank' | 'lever' | 'touch' | 'pull';
const CAT: Record<string, Cat> = { sel43: 'rot', 'bay:43': 'rot', ats: 'rot', oltc: 'rot', rack: 'crank', terra: 'lever', terraAT: 'lever', porta: 'pull', tampa: 'pull' };
const catOf = (p: any): Cat => CAT[p.act] || (p.tool ? 'touch' : 'poke');
const HEAD = /capacete|oculos|protetor|balaclava/, HANDS = /^luva/;
const nome = (id: string) => (TOOL_NAMES as any)[id] || id.replace(/_/g, ' ');
const n2 = (v: number) => v.toFixed(v < 20 ? 2 : 0).replace('.', ',');
interface PC { p: any; t: any; cat: Cat; inv: Matrix4; half: Vector3; c: Vector3; n: Vector3; inside: boolean[]; warned: boolean[]; push: { o: Object3D; d: Vector3 }[] | null }
interface Eng { pc: PC; cat: 'crank' | 'lever'; a: number; acc: number; q: number; start: Vector3; u: Vector3; w: Vector3; model: Group; fired: boolean }
type Hold =
  | { k: 'item'; obj: Object3D; uid: string | null; item: string; epi: boolean; tool: boolean; tipL: Vector3; insp: number; inspDone: boolean; eng: Eng | null }
  | { k: 'hinge'; pivot: Vector3; a0: number; o0: number; f: number; set: (o: number) => void; last: number; lim: boolean }
  | { k: 'part'; pc: PC; start: Vector3; ref: Vector3; fired: boolean };
const _v = new Vector3(), _w = new Vector3(), _b = new Box3(), _m = new Matrix4(), _q = new Quaternion(), _c = new Vector3(), _x = new Vector3();
const shown = (o: Object3D | null) => { while (o) { if (!o.visible) return false; o = o.parent; } return true; };
const ang = (p: Vector3, c: Vector3) => Math.atan2(-(p.z - c.z), p.x - c.x);
const wrap = (a: number) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

export class Physical {
  static B3 = Box3;
  pcs: PC[] = []; hold: (Hold | null)[] = [null, null]; hl: PC | null = null; private refreshT = 9; private vel = [new Vector3(), new Vector3()]; private last = [new Vector3(), new Vector3()];
  private loose = new Set<Object3D>(); private falling: { o: Object3D; v: Vector3; t: number }[] = []; belt = new Group(); private slots: Object3D[] = []; private beltYaw = 0;
  private rescue = { t: 0, rcp: null as null | { ts: number[]; hi: number; lo: number; armed: boolean; metro: any; idle: number }, dea: '', deaT: 0 as any };
  private mat = new MeshLambertMaterial({ color: 0x2b2f33 }); private matTool = new MeshLambertMaterial({ color: 0x9aa3ab });
  constructor(public H: PhysHost) {
    // cinto: 4 coldres (quadril esquerdo/direito, frente esquerda/direita); a ferramenta fica pendurada apontando para baixo
    [[-0.21, 0.02], [0.21, 0.02], [-0.14, -0.13], [0.14, -0.13]].forEach(([x, z]) => { const s = new Object3D(); s.position.set(x, 0, z); s.rotation.x = -Math.PI / 2; this.belt.add(s); this.slots.push(s);
      const pouch = new Mesh(new BoxGeometry(0.06, 0.1, 0.04), this.mat); pouch.position.set(x, -0.06, z); this.belt.add(pouch); });
    this.belt.traverse((o: any) => { o.userData.noPreset = true; }); this.belt.visible = false; H.scene.add(this.belt);
  }
  // ---------- peças próximas (caixa orientada da peça; normal = menor eixo, apontando para quem está na frente) ----------
  private refresh(head: Vector3) {
    const W = this.H.W, zv = (z: string) => W.zones[z]?.visible !== false, byId = new Map<string, any>(); for (const i of W.inter) byId.set(i.id, i);
    const old = new Map(this.pcs.map((x) => [x.p, x])); this.pcs = [];
    const add = (p: any, t: any, cat: Cat) => { const hit = p.hit as Mesh; hit.getWorldPosition(_v); if (_v.distanceToSquared(head) > 12.25) return; const prev = old.get(p); if (prev) { this.pcs.push(prev); return; }
      const g: any = hit.geometry, pr = g.parameters || {}; hit.updateWorldMatrix(true, false); const pos = new Vector3(), q = new Quaternion(), sc = new Vector3(); hit.matrixWorld.decompose(pos, q, sc);
      const half = new Vector3(((pr.width || 1) * Math.abs(sc.x)) / 2, ((pr.height || 1) * Math.abs(sc.y)) / 2, ((pr.depth || 1) * Math.abs(sc.z)) / 2); // caixa da peça em metros (a malha é unitária e escalada)
      const hs = [half.x, half.y, half.z], srt = [...hs].sort((x, y) => x - y), toHead = _w.copy(head).sub(pos).normalize(), axes = [0, 1, 2].map((i) => new Vector3(i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0).applyQuaternion(q));
      // normal: eixo fino da caixa; se a caixa for quase cúbica, o eixo mais voltado para quem está na frente
      const ax = srt[0] < srt[1] * 0.7 ? hs.indexOf(srt[0]) : [0, 1, 2].reduce((b, i) => (Math.abs(axes[i].dot(toHead)) > Math.abs(axes[b].dot(toHead)) ? i : b), 0), n = axes[ax].clone(); const c = pos.clone(); if (n.dot(toHead) < 0) n.negate();
      this.pcs.push({ p, t, cat, inv: new Matrix4().compose(pos, q, new Vector3(1, 1, 1)).invert(), half, c, n, inside: [false, false], warned: [false, false], push: null }); };
    for (const p of W.parts) { const t = byId.get(p.inter); if (p.hit && t && zv(t.zone)) add(p, t, catOf(p)); }
    for (const t of W.inter) if (t.kind === 'emerg' && t.hit && zv(t.zone)) add({ id: t.id, inter: t.id, act: 'inter:emerg', label: t.label, hit: t.hit, vis: [] }, t, 'poke');
  }
  private inBox(pc: PC, w: Vector3, m: number) { _x.copy(w).applyMatrix4(pc.inv); const h = pc.half; return Math.abs(_x.x) < h.x + m && Math.abs(_x.y) < h.y + m && Math.abs(_x.z) < h.z + m; }
  // ---------- laço ----------
  update(dt: number, hands: Hand[], head: Vector3, fwd: Vector3, dead: boolean) {
    this.refreshT += dt; if (this.refreshT > 0.3) { this.refreshT = 0; this.refresh(head); }
    this.hl = null; let hlD = 0.06;
    const yaw = Math.atan2(-fwd.x, -fwd.z); this.beltYaw += wrap(yaw - this.beltYaw) * Math.min(1, dt * 3); this.belt.position.set(head.x, Math.max(0.62, head.y * 0.58), head.z); this.belt.rotation.y = this.beltYaw; this.belt.visible = !dead;
    hands.forEach((h, k) => {
      if (!h.connected) return; this.vel[k].lerp(_v.copy(h.pos).sub(this.last[k]).divideScalar(Math.max(dt, 1e-3)), 0.4); this.last[k].copy(h.pos);
      if (dead) { if (this.hold[k]) this.release(k, h, hands); return; }
      if (h.squeezeDown && !this.hold[k]) this.tryGrab(k, h, hands, head);
      if (this.hold[k] && !h.squeeze) this.release(k, h, hands);
      const hd = this.hold[k]; h.holding = !!hd && hd.k === 'item';
      // dedo: botões
      let near = false;
      for (const pc of this.pcs) { if (pc.cat !== 'poke') continue; const d = pc.c.distanceTo(h.finger); if (d < 0.12) near = true; if (d < hlD && !hd) { hlD = d; this.hl = pc; }
        if (h.pointing && !hd) { if (!pc.inside[k] && this.inBox(pc, h.finger, 0.006)) { pc.inside[k] = true; this.press(pc, true); this.fire(pc, h); } else if (pc.inside[k] && !this.inBox(pc, h.finger, 0.02)) { pc.inside[k] = false; this.press(pc, false); } }
        else if (pc.inside[k]) { pc.inside[k] = false; this.press(pc, false); } }
      h.autoPoint = near;
      if (!hd) { for (const pc of this.pcs) if ((pc.cat === 'rot' || pc.cat === 'pull' || (pc.cat === 'lever' && !pc.p.tool)) && pc.c.distanceTo(h.pos) < hlD + 0.04) { hlD = pc.c.distanceTo(h.pos) - 0.04; this.hl = pc; } return; }
      if (hd.k === 'hinge') this.hinge(hd, h);
      else if (hd.k === 'part') this.partHold(hd, h);
      else this.itemHold(k, hd, h, head, fwd, dt);
      if (hd.k === 'item' && hd.tool && !hd.eng) { const tip = h.grip!.localToWorld(_c.copy(hd.tipL)); for (const pc of this.pcs) if (pc.p.tool && pc.c.distanceTo(tip) < hlD) { hlD = pc.c.distanceTo(tip); this.hl = pc; } }
    });
    this.fall(dt); this.rescueUpdate(dt, hands, head);
  }
  private press(pc: PC, on: boolean) {
    if (on) { pc.push = []; for (const o of pc.p.vis || []) { if (!o.parent) continue; const a = o.parent.worldToLocal(pc.c.clone()), b = o.parent.worldToLocal(pc.c.clone().addScaledVector(pc.n, -0.004)); const d = b.sub(a); o.position.add(d); pc.push.push({ o, d }); } }
    else if (pc.push) { for (const x of pc.push) x.o.position.sub(x.d); pc.push = null; }
  }
  /** Ação da peça (mesma do PC). Caixa de comando fechada não deixa apertar. */
  private fire(pc: PC, h: Hand) {
    const H = this.H, s = H.sess(), { p, t } = pc; if (!s) return;
    if (t.kind === 'bay') { const cb = H.W.yard.cabs[t.eq]; if (cb && cb.open < 0.5) { H.toast('Abra a porta da caixa de comando (grip na porta e puxe).', 'warn'); h.pulse(0.2, 20); return; } }
    if (p.act === 'inter:emerg') { H.inter.useDirect(t); h.pulse(0.7, 40); return; }
    if (String(p.act).startsWith('leitura:')) { const r = s.sim.leitura(p.data.ref); if (r) { H.cmd({ t: 'anotacao', ref: p.data.ref, valor: +r.valor.toFixed(2) }); H.toast(`${p.label}: ${n2(r.valor)} ${r.un}. Registrado no caderno de ronda.`, 'ok'); } h.pulse(0.4, 25); return; }
    if (p.act === 'ats') return;
    const ok = H.inter.actVR(t, p, (ops: [string, () => void][]) => H.fallback(t, ops)); h.pulse(ok ? 0.6 : 0.2, ok ? 35 : 15); H.audio?.click?.();
  }
  // ---------- pegar ----------
  private tryGrab(k: number, h: Hand, hands: Hand[], head: Vector3) {
    const W = this.H.W, I = W.indoor, Y = W.yard;
    // 1) peça manipulável pela mão (seletora, porta/tampa, alavanca de terra 138 kV)
    let best: PC | null = null, bd = 0.09;
    for (const pc of this.pcs) if ((pc.cat === 'rot' || pc.cat === 'pull' || (pc.cat === 'lever' && !pc.p.tool)) && this.inBox(pc, h.pos, 0.07)) { const d = pc.c.distanceTo(h.pos); if (d < bd) { bd = d; best = pc; } }
    if (best) { if (best.t.kind === 'bay') { const cb = Y.cabs[best.t.eq]; if (cb && cb.open < 0.5) { this.H.toast('Abra a porta da caixa de comando primeiro.', 'warn'); return; } }
      this.hold[k] = { k: 'part', pc: best, start: h.pos.clone(), ref: this.rollRef(h, best.n, new Vector3()), fired: false }; h.pulse(0.35, 25); return; }
    // 2) objetos: itens dos armários (porta aberta), soltos no chão, no cinto, e o DEA
    let obj: Object3D | null = null, uid: string | null = null, od = Infinity;
    const consider = (o: Object3D, u: string | null) => { if (!shown(o)) return; _b.setFromObject(o).expandByScalar(0.07); if (!_b.containsPoint(h.pos)) return; const d = _b.getCenter(_c).distanceTo(h.pos); if (d < od) { od = d; obj = o; uid = u; } };
    for (const cb of new Set<any>(Object.values(I.cabinets))) { if (cb.open < 0.4) continue; for (const [u, g] of Object.entries<any>(cb.items)) if (!g.userData.vr) consider(g, u); }
    for (const o of this.loose) consider(o, o.userData.uid ?? null);
    if (I.dea && !this.H.deaTaken()) consider(I.dea, null);
    const other = this.hold[1 - k]; if (other?.k === 'item') consider(other.obj, other.uid);
    if (obj) { this.grabItem(k, h, obj, uid, hands); return; }
    // 3) portas, portões, armários e porta da caixa de comando (giram na dobradiça)
    this.tryHinge(k, h); void head;
  }
  private rollRef(h: Hand, n: Vector3, out: Vector3) { out.set(1, 0, 0).applyQuaternion(h.quat); return out.addScaledVector(n, -out.dot(n)).normalize(); }
  private grabItem(k: number, h: Hand, obj: Object3D, uid: string | null, hands: Hand[]) {
    const H = this.H, s = H.sess(), other = this.hold[1 - k]; if (other?.k === 'item' && other.obj === obj) { this.hold[1 - k] = null; hands[1 - k].holding = false; }
    const dea = obj === H.W.indoor.dea, u = uid ? s.inv.unit(uid) : null, item = dea ? 'dea' : u?.item || obj.userData.item || '', def = item && !dea ? s.inv.def(item) : null;
    const epi = !!def && String(def.cat || '').startsWith('EPI'), tool = !epi;
    if (!obj.userData.home) obj.userData.home = { parent: obj.parent, pos: obj.position.clone(), quat: obj.quaternion.clone(), scale: obj.scale.clone() };
    obj.userData.vr = true; obj.userData.uid = uid; obj.userData.item = item; AutoBatch.cur?.detach(obj); this.loose.delete(obj); this.falling = this.falling.filter((f) => f.o !== obj);
    let tipL = new Vector3(0, 0, -0.1);
    if (tool && !dea) tipL = this.snapTool(obj, h.grip!); else h.grip!.attach(obj);
    obj.visible = true; this.hold[k] = { k: 'item', obj, uid, item, epi, tool, tipL, insp: 0, inspDone: false, eng: null }; h.holding = true;
    if (dea) { H.takeDea(); obj.visible = true; }
    else if (tool && u && !u.comigo) { const r = s.epi('pegar', uid); H.toast(r.txt, 'muted'); }
    if (tool) H.setTool(item); H.refreshEpi(); obj.visible = true; h.pulse(0.4, 30); H.audio?.click?.();
  }
  /** Ferramenta na mão: eixo mais longo para a frente, empunhada perto da base. Devolve a ponta (no espaço do grip). */
  private snapTool(obj: Object3D, grip: Group) {
    obj.updateMatrixWorld(true); const inv = _m.copy(obj.matrixWorld).invert(), box = new Box3(); const mm = new Matrix4();
    obj.traverse((o: any) => { if (o.isMesh && o.geometry) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox.clone().applyMatrix4(mm.multiplyMatrices(inv, o.matrixWorld))); } });
    const sz = box.getSize(new Vector3()), c = box.getCenter(new Vector3()), a = sz.x >= sz.y && sz.x >= sz.z ? new Vector3(1, 0, 0) : sz.y >= sz.z ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1), hl = Math.max(sz.x, sz.y, sz.z) / 2;
    const q = new Quaternion().setFromUnitVectors(a, new Vector3(0, 0, -1)), sc = obj.scale.x, gp = c.clone().addScaledVector(a, -hl * 0.55).multiplyScalar(sc).applyQuaternion(q);
    grip.add(obj); obj.quaternion.copy(q); obj.position.copy(gp).negate().add(new Vector3(0, -0.01, 0.0));
    return c.clone().addScaledVector(a, hl).multiplyScalar(sc).applyQuaternion(q).add(obj.position);
  }
  private release(k: number, h: Hand, hands: Hand[]) {
    const hd = this.hold[k]; this.hold[k] = null; h.holding = false; if (!hd) return;
    if (hd.k !== 'item') return; const H = this.H, s = H.sess(), obj = hd.obj; if (hd.eng) this.disengage(hd);
    const wp = _b.setFromObject(obj).getCenter(new Vector3()), home = obj.userData.home, homeW = home ? home.parent.localToWorld(home.pos.clone()) : null, head = hands.length ? this.headPos : null;
    if (hd.item === 'dea') { if (homeW && wp.distanceTo(homeW) < 0.5) { this.restore(obj); H.takeDea(); h.pulse(0.3, 20); return; } this.drop(obj, k); return; }
    if (hd.epi && s && hd.uid) { const other = hands[1 - k], hp = this.headPos;
      const ok = HEAD.test(hd.item) ? wp.distanceTo(hp) < 0.3 : HANDS.test(hd.item) ? other.connected && wp.distanceTo(other.pos) < 0.2 : wp.distanceTo(_v.copy(hp).setY(hp.y - 0.45)) < 0.5;
      if (ok) { const r = s.epi('pegar', hd.uid); H.toast(r.txt, r.ok === false ? 'warn' : 'ok'); this.restore(obj); H.refreshEpi(); h.pulse(0.6, 40); return; } }
    if (homeW && wp.distanceTo(homeW) < 0.35) { const u = hd.uid ? s?.inv.unit(hd.uid) : null; if (hd.tool && u?.comigo) H.toast(s.epi('devolver', hd.uid).txt, 'muted'); if (H.tool() === hd.item) H.setTool(null); this.restore(obj); H.refreshEpi(); h.pulse(0.3, 20); return; }
    if (hd.tool) { for (const sl of this.slots) if (!sl.children.length && sl.getWorldPosition(_v).distanceTo(wp) < 0.24) { const p = obj.position.clone(), q = obj.quaternion.clone(); sl.add(obj); obj.position.copy(p); obj.quaternion.copy(q); this.loose.add(obj); if (H.tool() === hd.item) H.setTool(null); H.toast(`${nome(hd.item)} no cinto.`, 'muted'); h.pulse(0.3, 20); return; } }
    void head; if (H.tool() === hd.item) H.setTool(null); this.drop(obj, k);
  }
  headPos = new Vector3();
  private drop(obj: Object3D, k: number) { this.H.scene.attach(obj); this.loose.add(obj); this.falling.push({ o: obj, v: this.vel[k].clone().clampLength(0, 4), t: 0 }); }
  private fall(dt: number) {
    for (const f of this.falling) { f.t += dt; f.v.y -= 9.8 * dt; f.o.position.addScaledVector(f.v, dt); f.o.updateMatrixWorld(true); const mn = _b.setFromObject(f.o).min.y; if (mn <= 0.005) { f.o.position.y += 0.005 - mn; f.t = 99; } }
    if (this.falling.some((f) => f.t > 4)) this.falling = this.falling.filter((f) => f.t <= 4);
  }
  private restore(obj: Object3D) { const hm = obj.userData.home; if (!hm) return; hm.parent.add(obj); obj.position.copy(hm.pos); obj.quaternion.copy(hm.quat); obj.scale.copy(hm.scale); obj.userData.vr = false; this.loose.delete(obj); AutoBatch.cur?.reattach(obj); }
  // ---------- segurando ----------
  private itemHold(k: number, hd: Extract<Hold, { k: 'item' }>, h: Hand, head: Vector3, fwd: Vector3, dt: number) {
    const H = this.H, s = H.sess(); this.headPos.copy(head);
    // inspecionar: segurar perto do rosto, na frente dos olhos, ~1,2 s
    if (!hd.inspDone && hd.uid && !hd.eng) { const c = _b.setFromObject(hd.obj).getCenter(_c), d = c.distanceTo(head); if (d < 0.4 && _w.copy(c).sub(head).normalize().dot(fwd) > 0.55) { hd.insp += dt; if (hd.insp > 1.0) { hd.inspDone = true; const r = s.epi('inspecionar', hd.uid); H.toast(r.txt, r.ok ? 'ok' : 'bad'); h.pulse(r.ok ? 0.3 : 0.8, r.ok ? 30 : 120); } } else hd.insp = Math.max(0, hd.insp - dt); }
    if (!hd.tool) return; if (hd.eng) { this.engUpdate(hd, h); return; }
    const tip = h.grip!.localToWorld(_c.copy(hd.tipL));
    for (const pc of this.pcs) { if (!pc.p.tool) continue; const inn = this.inBox(pc, tip, 0.035);
      if (!inn) { if (pc.inside[k] && !this.inBox(pc, tip, 0.07)) { pc.inside[k] = false; pc.warned[k] = false; } continue; } if (pc.inside[k]) continue; pc.inside[k] = true;
      const okTool = hd.item === pc.p.tool || (pc.p.tool === 'detector_mt' && hd.item === 'detector_at');
      if (!okTool) { if (!pc.warned[k]) { pc.warned[k] = true; H.toast(`Aqui precisa de: ${nome(pc.p.tool)}.`, 'warn'); h.pulse(0.2, 20); } continue; }
      H.setTool(hd.item);
      if (pc.cat === 'crank' || pc.cat === 'lever') { this.engage(hd, pc, h); return; }
      this.fire(pc, h); }
  }
  private hinge(hd: Extract<Hold, { k: 'hinge' }>, h: Hand) {
    const d = wrap(ang(h.pos, hd.pivot) - hd.a0), o = Math.min(1, Math.max(0, hd.o0 + d * hd.f)); hd.set(o);
    if (Math.abs(o - hd.last) > 0.07) { hd.last = o; h.pulse(0.12, 12); } if ((o <= 0 || o >= 1) && !hd.lim) { hd.lim = true; h.pulse(0.45, 30); } else if (o > 0.02 && o < 0.98) hd.lim = false;
  }
  private partHold(hd: Extract<Hold, { k: 'part' }>, h: Hand) {
    if (hd.fired) return; const pc = hd.pc, H = this.H, s = H.sess();
    if (pc.cat === 'rot') { const cur = this.rollRef(h, pc.n, _w), a = Math.atan2(_v.copy(hd.ref).cross(cur).dot(pc.n), hd.ref.dot(cur)); if (Math.abs(a) < 0.5) return; hd.fired = true; h.pulse(0.6, 35); H.audio?.click?.();
      if (pc.p.act === 'ats') { const ord = ['auto', 'TSA1', 'TSA2'], ca = s.sim.s.ca, i = ca.auto ? 0 : ord.indexOf(ca.ats), j = Math.min(2, Math.max(0, i + (a > 0 ? -1 : 1))); if (j === i) return; if (j === 0) H.cmd({ t: 'ats', auto: true }); else { H.cmd({ t: 'ats', auto: false }); H.cmd({ t: 'ats', to: ord[j] }); } return; }
      this.fire(pc, h); return; }
    const dv = _v.copy(h.pos).sub(hd.start); if (pc.cat === 'lever' ? Math.abs(dv.y) < 0.15 : dv.length() < 0.12) return; hd.fired = true; this.fire(pc, h);
  }
  // ---------- manivela (extração) e alavanca (terra 13,8 kV) encaixadas ----------
  private engage(hd: Extract<Hold, { k: 'item' }>, pc: PC, h: Hand) {
    const u = new Vector3(0, 1, 0); if (Math.abs(u.dot(pc.n)) > 0.9) u.set(1, 0, 0); u.addScaledVector(pc.n, -u.dot(pc.n)).normalize(); const w = new Vector3().crossVectors(pc.n, u);
    const g = new Group(), M = this.matTool; if (pc.cat === 'crank') { const sh = new Mesh(new CylinderGeometry(0.012, 0.012, 0.22, 10), M); sh.rotation.x = Math.PI / 2; sh.position.z = 0.11; const arm = new Mesh(new BoxGeometry(0.16, 0.02, 0.02), M); arm.position.set(0.08, 0, 0.22); const knob = new Mesh(new CylinderGeometry(0.018, 0.018, 0.09, 10), this.mat); knob.rotation.x = Math.PI / 2; knob.position.set(0.16, 0, 0.27); g.add(sh, arm, knob); }
    else { const bar = new Mesh(new CylinderGeometry(0.014, 0.014, 1, 10), M); bar.position.y = 0.5; g.add(bar); g.userData.bar = true; }
    g.traverse((o: any) => { o.userData.noPreset = true; }); g.position.copy(pc.c); this.H.scene.add(g); hd.obj.visible = false;
    hd.eng = { pc, cat: pc.cat as 'crank' | 'lever', a: this.engAng(h.pos, pc, u, w), acc: 0, q: 0, start: h.pos.clone(), u, w, model: g, fired: false }; h.pulse(0.6, 40);
    this.H.toast(pc.cat === 'crank' ? 'Manivela encaixada: gire. Anti-horário extrai, horário insere (3 voltas por posição).' : 'Alavanca encaixada: puxe para baixo ou empurre para cima.', 'muted');
  }
  private engAng(p: Vector3, pc: PC, u: Vector3, w: Vector3) { _v.copy(p).sub(pc.c); return Math.atan2(_v.dot(w), _v.dot(u)); }
  private engUpdate(hd: Extract<Hold, { k: 'item' }>, h: Hand) {
    const e = hd.eng!, pc = e.pc, H = this.H, s = H.sess(); _v.copy(h.pos).sub(pc.c); if (_v.length() > 0.55) { this.disengage(hd); return; }
    if (e.cat === 'crank') { const vp = _v.addScaledVector(pc.n, -_v.dot(pc.n)); if (vp.length() < 0.02) return; const a = Math.atan2(vp.dot(e.w), vp.dot(e.u)), d = wrap(a - e.a); e.a = a; e.acc += d; e.q += d;
      if (Math.abs(e.q) > Math.PI / 2) { e.q = 0; h.pulse(0.18, 12); }
      _m.makeBasis(vp.normalize(), _w.crossVectors(pc.n, vp), pc.n); e.model.quaternion.setFromRotationMatrix(_m);
      if (Math.abs(e.acc) >= 6 * Math.PI) { const ext = e.acc > 0; e.acc = 0; const brk = '52-' + pc.t.eq, pos = s.sim.s.eq[brk]?.pos, to = ext ? ({ servico: 'teste', teste: 'extraido' } as any)[pos] : ({ extraido: 'teste', teste: 'servico' } as any)[pos];
        if (!to) { H.toast(`Fim de curso: carrinho já em ${String(pos).toUpperCase()}.`, 'muted'); h.pulse(0.5, 60); return; } H.cmd({ t: 'rack', id: brk, to }); h.pulse(0.9, 80); } return; }
    const dir = _w.copy(h.pos).sub(pc.c), len = dir.length(); e.model.scale.set(1, len, 1); e.model.quaternion.setFromUnitVectors(_x.set(0, 1, 0), dir.normalize());
    if (!e.fired && Math.abs(h.pos.y - e.start.y) > 0.15) { e.fired = true; this.fire(pc, h); h.pulse(0.9, 80); }
  }
  private disengage(hd: Extract<Hold, { k: 'item' }>) { const e = hd.eng; if (!e) return; e.model.removeFromParent(); hd.eng = null; hd.obj.visible = true; }
  // ---------- dobradiças (movido da camada VR) ----------
  private tryHinge(k: number, h: Hand) {
    const W = this.H.W, I = W.indoor, Y = W.yard, C: { obj: Object3D; get: () => number; set: (o: number) => void; f: number }[] = [];
    for (const dd of I.doors) C.push({ obj: dd.g, get: () => dd.open, set: (o) => { dd.open = dd.tgt = o; }, f: 1 / dd.max });
    for (const g of Y.gates) for (const l of g.leaves) C.push({ obj: l.children[0], get: () => g.open, set: (o) => { g.open = g.tgt = o; }, f: 1 / ((l.userData.s || 1) * 1.5) });
    for (const cb of Object.values<any>(Y.cabs)) C.push({ obj: cb.door, get: () => cb.open, set: (o) => { cb.open = cb.tgt = o; }, f: -1 / 1.85 });
    for (const cb of new Set<any>(Object.values(I.cabinets))) for (const g of cb.doors) { const f = (g.userData.s || 1) * 1.9 * (g.userData.dir ?? (g.position.x > W.divX ? 1 : -1)); C.push({ obj: g, get: () => cb.open, set: (o) => { cb.open = cb.tgt = o; }, f: 1 / f }); }
    let best: (typeof C)[number] | null = null, bd = Infinity;
    for (const c of C) { if (!shown(c.obj)) continue; _b.setFromObject(c.obj).expandByScalar(0.1); if (!_b.containsPoint(h.pos)) continue; const d = _b.getCenter(_c).distanceTo(h.pos); if (d < bd) { bd = d; best = c; } }
    if (!best) return; const pivot = best.obj.getWorldPosition(new Vector3()), o0 = best.get();
    this.hold[k] = { k: 'hinge', pivot, a0: ang(h.pos, pivot), o0, f: best.f, set: best.set, last: o0, lim: false }; h.pulse(0.35, 30); this.H.audio?.click?.();
  }
  // ---------- resgate pelas mãos: tocar o ombro, olhar a respiração, RCP no peito, DEA perto do tórax ----------
  private rescueUpdate(dt: number, hands: Hand[], head: Vector3) {
    const H = this.H, v = H.safety?.vitima, s = H.sess(), R = this.rescue; if (!v || !s) { this.stopRcp(); return; } if (s.sim.der.energ[v.fonte]) return;
    const st = v.estado, c = (v.g.userData.chest ||= _b.setFromObject(v.g).getCenter(new Vector3()).setY(_b.max.y - 0.04)) as Vector3, on = hands.filter((x) => x.connected && x.pos.distanceTo(c) < 0.4);
    if (!st.consciencia && on.length) { st.consciencia = true; s.marcar('resgate:consciencia', 'Verificou consciência: vítima não responde'); H.toast('Não responde ao chamado nem ao toque. Peça socorro pelo rádio e o DEA. Aproxime o rosto para ver a respiração.', 'warn'); on[0].pulse(0.4, 40); return; }
    if (st.consciencia && !st.resp) { if (head.distanceTo(c) < 0.65) { R.t += dt; if (R.t > 2.5) { st.resp = true; s.marcar('resgate:respiracao', 'Verificou respiração: ausente/agônica → PCR'); H.toast('Sem respiração normal: parada cardiorrespiratória. Mãos no centro do peito e comprima no ritmo do bipe.', 'bad'); } } else R.t = 0; return; }
    if (st.resp) { if (on.length >= 1 && !R.rcp) R.rcp = { ts: [], hi: -1, lo: 9, armed: true, metro: setInterval(() => H.audio?.tick?.(), 545), idle: 0 };
      const r = R.rcp; if (r) { if (!on.length) { r.idle += dt; if (r.idle > 2) this.stopRcp(); } else { r.idle = 0; const y = on.reduce((a, x) => a + x.pos.y, 0) / on.length; let hit = false;
          if (r.armed) { r.hi = Math.max(r.hi, y); if (y < r.hi - 0.035) { hit = true; r.armed = false; r.lo = y; } } else { r.lo = Math.min(r.lo, y); if (y > r.lo + 0.025) { r.armed = true; r.hi = y; } }
          if (hit) { r.ts.push(performance.now()); H.audio?.thump?.(); on.forEach((x) => x.pulse(0.5, 30)); if (r.ts.length % 10 === 0 && r.ts.length < 30) H.toast(`RCP: ${r.ts.length}/30`, 'muted');
            if (r.ts.length >= 30) { const ok = H.rcpQualidade(r.ts), pc = Math.round(ok * 100); st.rcp++; this.stopRcp(); if (ok >= 0.7) s.marcar('resgate:rcp_ok', `RCP: 30 compressões, ${pc} % no ritmo`); else s.sim.lg('ev', 'treinando', `RCP fora do ritmo: só ${pc} % entre 100 e 120/min`);
              H.toast(`30 compressões: ${pc} % no ritmo (100–120/min). ${ok >= 0.7 ? 'Boa RCP.' : 'Ritmo irregular: repita.'} Continue até o DEA.`, ok >= 0.7 ? 'ok' : 'warn'); } } } }
      const dea = H.W.indoor.dea as Object3D | null; if (dea && H.deaTaken() && !st.dea && _b.setFromObject(dea).getCenter(_c).distanceTo(c) < 0.6) {
        if (!R.dea) { R.dea = 'analise'; H.toast('DEA: pás aplicadas. Analisando o ritmo: não toque no paciente.', 'warn'); R.deaT = setTimeout(() => { R.dea = 'choque'; H.toast('DEA: choque indicado. Afaste as mãos e aperte o gatilho.', 'bad'); }, 2200); }
        else if (R.dea === 'choque' && hands.some((x) => x.triggerDown)) { R.dea = ''; H.audio?.shockDea?.(); st.dea = true; s.marcar('resgate:dea', 'DEA: choque aplicado; RCP retomada'); H.toast('DEA: choque aplicado. Reinicie a RCP imediatamente.', 'ok'); hands.forEach((x) => x.pulse(1, 200)); } } }
  }
  private stopRcp() { const r = this.rescue.rcp; if (r) { clearInterval(r.metro); this.rescue.rcp = null; } }
  /** Reinício: tudo volta ao lugar. */
  reset(hands: Hand[]) {
    this.hold.forEach((hd, k) => { if (hd?.k === 'item' && hd.eng) this.disengage(hd); this.hold[k] = null; if (hands[k]) hands[k].holding = false; });
    for (const pc of this.pcs) if (pc.push) this.press(pc, false);
    const W = this.H.W; for (const cb of new Set<any>(Object.values(W.indoor.cabinets))) for (const g of Object.values<any>(cb.items)) if (g.userData.home && g.userData.vr) this.restore(g);
    for (const o of [...this.loose]) this.restore(o); if (W.indoor.dea?.userData.vr) this.restore(W.indoor.dea);
    this.falling = []; this.loose.clear(); this.stopRcp(); clearTimeout(this.rescue.deaT); this.rescue.dea = ''; this.rescue.t = 0;
  }
  /** Peça em destaque (perto do dedo, da mão ou da ponta da ferramenta). */
  get highlight() { return this.hl?.p.hit as Mesh | undefined; }
}
export { SphereGeometry };
