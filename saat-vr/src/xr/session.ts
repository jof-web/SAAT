// Camada VR do SAAT: entrada, rig com a câmera, locomoção com colisão, raio em peças e equipamentos (gatilho aciona,
// cartão de inspeção, supervisório), portas pela mão (grip), consequências (zona, choque, arco) com vibração,
// legenda de avisos, PiP da manobra, altura da pessoa, menu, depuração e relatório. Só lê o estado e envia comandos.
import { Group, Raycaster, Vector3, BoxGeometry, EdgesGeometry, LineSegments, LineBasicMaterial, Matrix4, type Mesh, type PerspectiveCamera } from 'three';
import type { Engine } from '../game/engine';
import type { GameWorld } from '../game/world';
import type { Player } from '../game/player';
import { GFX, presetLambert } from '../game/gfx';
import { XRInput, setGlove, type Hand } from './input';
import { Locomotion } from './locomotion';
import { Debug } from './debug';
import { Checklist, Menu, buildReport } from './validation';
import { Panel, UI } from './panel';
import { VRCard } from './card';
import { VRScada } from './scada';
import { VRFx, VRAccident, VRHud, VRPip, type AccHost } from './fx';
import { Physical } from './physical';
import { desenharBoneco, type Boneco } from '../ui/boneco';
import { TOOL_NAMES } from '../game/hands';

export interface XRHost {
  E: Engine; W: GameWorld; P: Player; inter: any; hud: any; safety: any; audio: any; acc: AccHost;
  livre(): boolean; area(): string; faltas(): number; boneco(): Boneco | null; gear(): { isolante: boolean; cobertura: boolean; pvc: boolean; fr: boolean };
  missao(): { codigo: string; titulo: string; passo: string }; pausar(): boolean; correndo(on: boolean, dt: number): void; onStart(): void; onEnd(): void;
  sess(): any; cmd(c: any): any; tool(): string | null; toolName(): string; setTool(id: string | null): void; usarFerramenta(): void; refreshEpi(): void; toast(m: string, k?: string): void;
  takeDea(): void; deaTaken(): boolean;
  dead(): boolean; ctx(): any; readback(): string | null; conferirEpi(): string; alturaPerfil(): number | null; salvarAltura(cm: number): void; rcpQualidade(ts: number[]): number;
}
const _h = new Vector3(), _d = new Vector3(), _f = new Vector3(), _p = new Vector3(), _m = new Matrix4();
const RANGE: Record<string, number> = { door: 3.5, gate: 3.5, eq: 7, reserva: 7, trafoBody: 7, caido: 9, scada: 3, arm: 3, vitima: 3 };

export class XRLayer {
  rig = new Group(); input: XRInput; loco: Locomotion; debug = new Debug(); check = new Checklist(); menu: Menu; active = false; supported = false; reason = 'verificando…';
  card: VRCard; scada: VRScada; fx: VRFx; acc: VRAccident; hud: VRHud; pip: VRPip; phys: Physical; private poked = new Map<Panel, boolean[]>(); private deskIn = false;
  boneco = { on: true }; private bonecoPanel = new Panel({ w: 0.062, h: 0.118, px: 240, transparent: true }); private lastBoneco: Boneco | null = null;
  private label = new Panel({ w: 0.46, h: 0.09, px: 640 }); private ray = new Raycaster(); private t = 0; private zone = 0; private zoneT = 0;
  private cand = { t: 9, parts: [] as any[], partHits: [] as Mesh[], byPart: new Map<Mesh, any>(), interHits: [] as Mesh[], byInter: new Map<Mesh, any>() };
  private hl: LineSegments; private alturaT = 0;
  constructor(public H: XRHost, public version: string) {
    const E = H.E, R = E.renderer; R.xr.enabled = true; R.xr.setReferenceSpaceType('local-floor'); this.ray.layers.enableAll();
    this.rig.name = 'xr-rig'; E.scene.add(this.rig); this.input = new XRInput(R, this.rig, E.scene);
    this.loco = new Locomotion(this.rig, E.cam, E.scene, (x, z, r) => H.P.hit(x, z, r), () => H.livre());
    this.debug.attach(E.cam);
    this.menu = new Menu({ version, loco: this.loco, debug: this.debug, check: this.check, hands: this.input.hands, cam: E.cam, scene: E.scene, renderer: R,
      missao: () => { const m = H.missao(), b = this.lastBoneco; return { ...m, area: H.area(), livre: H.livre(), faltas: H.faltas(), epi: b ? (b.pronto ? 'EPI completo' : `faltam ${b.faltam.length} EPI`) : '—' }; },
      teleport: (k) => { const s = H.W.spawns[k]; if (s && H.livre()) { this.loco.placeHead(s.x, s.z, s.yaw); this.menu.hide(); } }, pausar: () => H.pausar(), sair: () => { void R.xr.getSession()?.end(); },
      boneco: this.boneco, setBoneco: (on) => { this.boneco.on = on; },
      extra: { radio: () => this.radio(), readback: () => H.readback(), conferir: () => H.conferirEpi(), tool: () => H.toolName(), usar: () => H.usarFerramenta(), guardar: () => H.setTool(null),
        altura: () => this.alturaCm(), setAltura: (cm: number) => { this.loco.s.alturaCm = Math.round(Math.min(210, Math.max(120, cm))); this.loco.save(); },
        aplicarAltura: () => { const cm = this.alturaCm(), e = this.loco.applyStature(cm); if (e === null) return 'Altura inválida.'; this.loco.s.autoAltura = true; this.loco.save(); H.salvarAltura(cm); return `Altura ${cm} cm aplicada: olhos a ${e.toFixed(2).replace('.', ',')} m.`; },
        perfil: () => H.alturaPerfil(), local: () => this.nearLocal(), ctx: () => H.ctx() } });
    this.card = new VRCard({ inter: H.inter, W: H.W, sess: () => H.sess(), refreshEpi: () => H.refreshEpi(), toast: (m, k) => H.toast(m, k), cmd: (c) => H.cmd(c), tool: () => H.tool(), safety: H.safety, audio: H.audio, rcpQualidade: (ts) => H.rcpQualidade(ts), ctx: () => H.ctx() }, E.scene);
    this.scada = new VRScada({ sess: () => H.sess(), cmd: (c) => H.cmd(c), ctx: () => H.ctx() }, E.scene);
    this.phys = new Physical({ W: H.W, inter: H.inter, scene: E.scene, sess: () => H.sess(), cmd: (c) => H.cmd(c), setTool: (id) => H.setTool(id), tool: () => H.tool(), toast: (m, k) => H.toast(m, k), refreshEpi: () => H.refreshEpi(),
      audio: H.audio, takeDea: () => H.takeDea(), deaTaken: () => H.deaTaken(), safety: H.safety, rcpQualidade: (ts) => H.rcpQualidade(ts),
      fallback: (t, ops) => { this.card.show(t, this.head(new Vector3()), this.fwd(new Vector3())); this.card.ask = ops; this.card.panel.dirty = true; } });
    this.fx = new VRFx(E.cam); this.acc = new VRAccident(H.acc, E.scene); this.hud = new VRHud(E.scene); this.pip = new VRPip(R, E.scene);
    H.hud.listeners.push((k: string, t: string, who?: string) => { if (this.active) this.hud.push(k, t, who); });
    // boneco de EPI no pulso (dorso da mão de andar), como um relógio
    const bm = this.bonecoPanel.mesh; bm.rotation.x = -Math.PI / 2; bm.position.set(0, 0.052, 0.085); bm.scale.setScalar(0.8); bm.visible = false;
    this.bonecoPanel.render = (p) => { if (this.lastBoneco) desenharBoneco(p.g, p.W, p.H, this.lastBoneco, 'EPI'); };
    this.label.mesh.visible = false; (this.label.mesh.material as any).depthTest = false; this.label.mesh.renderOrder = 999; E.scene.add(this.label.mesh);
    this.hl = new LineSegments(new EdgesGeometry(new BoxGeometry(1, 1, 1)), new LineBasicMaterial({ color: 0xf2c230, depthTest: false, transparent: true })); this.hl.matrixAutoUpdate = false; this.hl.renderOrder = 997; this.hl.visible = false; this.hl.userData.noPreset = true; E.scene.add(this.hl);
    R.xr.addEventListener('sessionstart', () => this.onStart()); R.xr.addEventListener('sessionend', () => this.onEnd());
    this.probe();
  }
  private async probe() {
    const xr = (navigator as any).xr;
    if (!xr) { this.reason = window.isSecureContext ? 'Este navegador não tem WebXR. Abra no Meta Quest.' : 'Precisa de HTTPS para o VR.'; return; }
    try { this.supported = await xr.isSessionSupported('immersive-vr'); this.reason = this.supported ? '' : 'VR indisponível aqui. Abra no navegador do Meta Quest.'; } catch { this.reason = 'VR indisponível.'; }
    for (const f of this.listeners) f();
  }
  listeners = new Set<() => void>();
  alturaCm() { return this.H.alturaPerfil() || this.loco.s.alturaCm || 170; }
  /** Chamar dentro do clique (gesto do usuário). Qualidade: escala do framebuffer e foveação (antes da sessão). */
  enter() {
    const xr = (navigator as any).xr; if (!xr) return Promise.resolve(false); const R = this.H.E.renderer, q = this.loco.s.vrq;
    try { R.xr.setFramebufferScaleFactor(q === 'alta' ? 1.25 : q === 'leve' ? 0.85 : 1); } catch { /* */ } try { R.xr.setFoveation(q === 'alta' ? 0.25 : q === 'leve' ? 1 : 0.5); } catch { /* */ }
    return xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] }).then((s: any) => R.xr.setSession(s)).then(() => true).catch((e: any) => { this.debug.error('Entrar em VR: ' + (e?.message || e)); return false; });
  }
  exit() { void this.H.E.renderer.xr.getSession()?.end(); }
  report() { return buildReport(this.version, this.check, this.debug); }
  /** Novo início/reinício de missão: limpa painéis e efeitos. */
  reset() { this.fx.reset(); this.acc.hide(); this.card.close(); this.scada.close(); this.pip.hide(); this.hud.clear(); this.phys?.reset(this.input.hands); this.zone = 0; this.deskIn = false; }
  head(out = _h) { return this.H.E.cam.getWorldPosition(out); }
  fwd(out = _f) { return this.H.E.cam.getWorldDirection(out); }
  /** Corpo real para a segurança: cabeça, mãos (palma e frente do controle) e pés. */
  body() { const head = this.head(new Vector3()), hands: Vector3[] = []; for (const h of this.input.hands) if (h.connected) hands.push(h.pos.clone(), h.rayO.clone()); return { head, hands, feet: new Vector3(head.x, 0.1, head.z) }; }
  setZone(z: number) { this.zone = z; this.fx.zone = z; }
  flash(hex: number, s: number, buzz = 0.6) { this.fx.doFlash(hex, s); for (const h of this.input.hands) h.pulse(buzz, 250); }
  accident(a: any) {
    this.card.close(); this.scada.close(); this.menu.hide(); this.fx.doFlash(a.tipo === 'arco' ? 0xfff3d6 : 0xeaf6ff, 0.9);
    const buzz = (n: number) => { for (const h of this.input.hands) h.pulse(1, 300); if (n > 0) setTimeout(() => buzz(n - 1), 330); }; buzz(3);
    setTimeout(() => { this.fx.fadeTgt = 1; }, 900); setTimeout(() => { if (this.active) this.acc.show(a, this.head(new Vector3()), this.fwd(new Vector3())); }, 2300);
  }
  private radioObj = new Group();
  /** Rádio (COS): cartão com read-back, comunicações e decisões da missão. */
  radio() { if (!this.radioObj.parent) this.H.E.cam.add(this.radioObj); this.menu.hide(); this.scada.close(); this.card.show({ kind: 'radio', id: 'radio', label: 'Rádio — COS', hit: this.radioObj }, this.head(new Vector3()), this.fwd(new Vector3())); }
  showPip(caption: string, until: number) { if (this.active) this.pip.show(caption, until, this.head(new Vector3()), this.fwd(new Vector3())); }
  private onStart() {
    const { E, P } = this.H; this.active = true; GFX.xr = true; presetLambert(E.scene, true); E.xrMode(true); this.reset();
    this.rig.position.set(P.pos.x, 0, P.pos.z); this.rig.rotation.set(0, P.yaw, 0); this.rig.add(E.cam); E.cam.position.set(0, 1.6, 0); E.cam.rotation.set(0, 0, 0); E.cam.near = 0.03; E.cam.updateProjectionMatrix();
    this.loco.applyHeight(); this.debug.setVisible(true); this.menu.hide(); this.alturaT = (this.H.alturaPerfil() || this.loco.s.autoAltura) ? 1.5 : 0; this.H.onStart();
  }
  private onEnd() {
    const { E, P } = this.H; this.active = false; GFX.xr = false; presetLambert(E.scene, false); E.xrMode(false);
    const h = this.loco.head(_h), yaw = this.loco.headYaw(); this.rig.remove(E.cam); E.cam.near = 0.05; E.cam.updateProjectionMatrix(); P.place(h.x, h.z, yaw); P.crouch = 0;
    this.debug.setVisible(false); this.bonecoPanel.mesh.visible = false; this.label.mesh.visible = false; this.hl.visible = false; this.reset(); this.H.onEnd();
  }
  update(dt: number) {
    if (!this.active) return; const H = this.H, hands = this.input.hands, dead = H.dead(), M = this.loco.s.hand === 'left' ? hands[1] : hands[0];
    this.input.read(); const pj = !dead && M.low;
    if (!dead) this.loco.update(dt, hands, pj); else { this.loco.moving = false; this.loco.running = false; }
    this.rig.updateMatrixWorld(true); this.input.poses();
    const h = this.loco.head(_h); H.P.pos.set(h.x, 0, h.z); H.P.yaw = this.loco.headYaw(); H.P.moving = this.loco.moving ? 1 : 0; H.P.crouch = pj ? 1 : 0;
    H.correndo(this.loco.running && this.loco.moving, dt);
    if (this.alturaT > 0) { this.alturaT -= dt; if (this.alturaT <= 0) { const cm = this.alturaCm(), e = this.loco.applyStature(cm); if (e !== null) H.toast(`Altura ${cm} cm aplicada (olhos ${e.toFixed(2).replace('.', ',')} m). Ajuste no menu › Config.`, 'muted'); } }
    const head = this.head(new Vector3()), fwd = this.fwd(new Vector3());
    this.input.animate(dt); this.phys.update(dt, hands, head, fwd, dead); this.desk(head); this.pokePanels(dead); this.rays(dead, dt);
    this.menu.update(dt); this.card.update(dt, head); this.scada.update(dt); this.acc.update(); this.hud.update(dt, head, fwd); this.pip.update(); this.fx.update(dt);
    if (this.card.rcp) { const c = hands.filter((x) => x.connected); this.card.rcpInput(c.length ? c.reduce((s, x) => s + x.pos.y, 0) / c.length : null, false); }
    // formigamento: vibração proporcional à proximidade da parte energizada (zona controlada / tensão de passo)
    this.zoneT += dt; if (!dead && this.zone > 0.05 && this.zoneT > 0.14) { this.zoneT = 0; for (const x of hands) x.pulse(0.12 + this.zone * 0.7, 45); }
    this.t += dt; if (this.t > 0.3) { this.t = 0; const g = H.gear(); for (const x of hands) setGlove(x.model, g); this.lastBoneco = H.boneco(); this.wristBoneco(M); }
    this.bonecoPanel.update(); this.debug.frame(dt, H.area(), H.E.renderer, true);
  }
  private wristBoneco(M: Hand) {
    const bm = this.bonecoPanel.mesh, on = this.boneco.on && !!this.lastBoneco && M.connected && !!M.grip;
    if (on && bm.parent !== M.grip) M.grip!.add(bm); bm.visible = on; if (on) this.bonecoPanel.dirty = true;
  }
  /** Mesa de operação: chegou perto, o supervisório aparece no monitor (tela de toque). */
  private desk(head: Vector3) {
    const I: any = this.H.W.indoor, ds = I.deskSeat; if (!ds) return; const d = Math.hypot(head.x - ds.pos.x, head.z - ds.pos.z);
    if (d < 1.1) { if (!this.deskIn) { this.deskIn = true; if (!this.H.dead()) { this.card.close(); this.scada.showAt(ds.look, ds.pos); } } } else if (d > 2.4 && this.deskIn) { this.deskIn = false; if (this.scada.atDesk) this.scada.close(); }
  }
  /** Dedo nos painéis (menu, supervisório, cartão, acidente): encostou = clique; perto = destaque. */
  private pokePanels(dead: boolean) {
    const panels = [this.acc.open && this.acc.panel, !dead && this.menu.mode && this.menu.panel, !dead && this.card.open && this.card.panel, !dead && this.scada.open && this.scada.panel].filter(Boolean) as Panel[];
    this.input.hands.forEach((h, k) => { if (!h.connected) return;
      for (const P of panels) { const n = _d.set(0, 0, 1).transformDirection(P.mesh.matrixWorld), o = _p.copy(h.finger).addScaledVector(n, 0.05), t = P.rayHit(o, _f.copy(n).negate()); const st = this.poked.get(P) || [false, false]; this.poked.set(P, st);
        if (!isFinite(t)) { st[k] = false; continue; } const depth = t - 0.05; if (depth < 0.1) h.autoPoint = true; if (depth < 0.06) P.hover(P.hitX, P.hitY);
        if (h.pointing && depth < 0.012 && !st[k]) { st[k] = true; if (P.click(P.hitX, P.hitY)) h.pulse(0.35, 15); } else if (depth > 0.03) st[k] = false; } });
  }
  /** Local da missão mais próximo (procedimentos no tablet do pulso). */
  private nearLocal() {
    const W: any = this.H.W, head = this.head(new Vector3()), ctx = this.H.ctx(); if (!ctx?.sc) return null; let best: any = null, bd = 3.2;
    for (const t of W.inter) { if (!t.hit || W.zones[t.zone]?.visible === false) continue; const loc = this.H.inter.localDe?.(t); if (!loc) continue; const d = t.hit.getWorldPosition(_p).distanceTo(head); if (d >= bd) continue; const r = ctx.sc.acoesPara(loc); if (!r.acoes.length && !r.decisoes.length) continue; bd = d; best = { loc, label: t.label }; }
    return best;
  }
  // ---------- raio: painéis, peças (≤ 2,5 m) e equipamentos ----------
  private refresh(head: Vector3) {
    const W: any = this.H.W, c = this.cand; c.t = 0; c.partHits = []; c.byPart.clear(); c.interHits = []; c.byInter.clear(); const zv = (z: string) => W.zones[z]?.visible !== false, byId = new Map<string, any>();
    for (const i of W.inter) { byId.set(i.id, i); if (!i.hit || !zv(i.zone)) continue; i.hit.getWorldPosition(_p); if (_p.distanceToSquared(head) < 100) { c.interHits.push(i.hit); c.byInter.set(i.hit, i); } }
    for (const p of W.parts) { const it = byId.get(p.inter); if (!p.hit || !it || !zv(it.zone)) continue; p.hit.getWorldPosition(_p); if (_p.distanceToSquared(head) < 16) { c.partHits.push(p.hit); c.byPart.set(p.hit, p); } }
  }
  private rays(dead: boolean, dt: number) {
    const H = this.H, head = this.head(new Vector3()); this.cand.t += dt; if (this.cand.t > 0.25) this.refresh(head);
    const panels = [this.acc.open && this.acc.panel, !dead && this.menu.mode && this.menu.panel, !dead && this.card.open && this.card.panel, !dead && this.scada.open && this.scada.panel].filter(Boolean) as Panel[];
    const hovered = new Set<Panel>(); let labelDone = false, hlDone = false;
    const order = this.loco.s.hand === 'left' ? [this.input.hands[0], this.input.hands[1]] : [this.input.hands[1], this.input.hands[0]];
    for (const h of order) {
      if (!h.connected || !h.line || !h.cursor) continue; let dist = Infinity, panel: Panel | null = null, part: any = null, it: any = null;
      for (const P of panels) { const t = P.rayHit(h.rayO, h.rayD); if (t < dist) { dist = t; panel = P; } }
      if (panel) { panel.rayHit(h.rayO, h.rayD); panel.hover(panel.hitX, panel.hitY); hovered.add(panel); }
      if (!dead && this.loco.s.ajuda) { this.ray.set(h.rayO, h.rayD);
        this.ray.far = 2.5; const rp = this.ray.intersectObjects(this.cand.partHits, false)[0]; if (rp && rp.distance < dist) { dist = rp.distance; panel = null; part = this.cand.byPart.get(rp.object as Mesh); }
        if (!part) { this.ray.far = 9; for (const r of this.ray.intersectObjects(this.cand.interHits, false)) { if (r.distance >= dist) break; const x = this.cand.byInter.get(r.object as Mesh); if (x && r.distance <= (RANGE[x.kind] ?? 3)) { dist = r.distance; panel = null; it = x; break; } } } }
      const showRay = this.loco.s.ajuda || !!panel; h.line.visible = showRay && !h.holding; if (!h.line.visible) { h.cursor.visible = false; if (h.triggerDown && this.card.rcp) this.card.rcpInput(null, true); continue; }
      h.line.scale.z = isFinite(dist) ? dist : 2; (h.line.material as any).color.setHex(panel ? 0xf2c230 : part ? 0x3ddc6a : it ? 0x6fb3e0 : 0xffffff);
      h.cursor.visible = isFinite(dist); if (h.cursor.visible) h.cursor.position.copy(h.rayO).addScaledVector(h.rayD, dist);
      if (part && !hlDone) { hlDone = true; this.highlight(part.hit); }
      if ((part || it) && !labelDone && !panels.length) { labelDone = true; this.showLabel(part, it); }
      if (h.triggerDown) {
        if (panel) { panel.click(panel.hitX, panel.hitY); h.pulse(0.3, 12); }
        else if (this.card.rcp) this.card.rcpInput(null, true);
        else if (part) this.firePart(part, h);
        else if (it) this.fireInter(it, h);
      }
    }
    for (const P of [this.menu.panel, this.card.panel, this.scada.panel, this.acc.panel]) if (!hovered.has(P)) P.clearHover();
    if (!labelDone) this.label.mesh.visible = false; if (!hlDone) { const ph = this.phys.highlight; if (ph) this.highlight(ph); else this.hl.visible = false; }
  }
  private highlight(hit: Mesh) { const g: any = hit.geometry, pr = g.parameters || {}; hit.updateWorldMatrix(true, false); _m.makeScale((pr.width || 0.1) * 1.08, (pr.height || 0.1) * 1.08, (pr.depth || 0.1) * 1.08); this.hl.matrix.multiplyMatrices(hit.matrixWorld, _m); this.hl.matrixWorldNeedsUpdate = true; this.hl.visible = true; }
  private firePart(part: any, h: Hand) {
    const H = this.H, W: any = H.W, t = W.inter.find((i: any) => i.id === part.inter); if (!t) return;
    if (t.kind === 'bay') { const cb = W.yard.cabs[t.eq]; if (cb && cb.open < 0.5) { H.toast('Abra a porta da caixa de comando: grip na porta (puxe) ou gatilho na caixa.', 'warn'); h.pulse(0.2, 20); return; } }
    if (String(part.act).startsWith('leitura:')) { this.card.show({ kind: 'leitura', label: part.label, data: part.data, hit: part.hit, id: 'lt:' + part.id }, this.head(new Vector3()), this.fwd(new Vector3())); h.pulse(0.3, 15); return; }
    const ok = H.inter.actVR(t, part, (ops: [string, () => void][]) => { this.card.show(t, this.head(new Vector3()), this.fwd(new Vector3())); this.card.ask = ops; this.card.panel.dirty = true; });
    h.pulse(ok ? 0.55 : 0.2, ok ? 30 : 15); if (this.card.open) this.card.panel.dirty = true;
  }
  private fireInter(t: any, h: Hand) {
    const H = this.H, head = this.head(new Vector3()), fwd = this.fwd(new Vector3()); h.pulse(0.4, 20);
    if (H.inter.useDirect(t)) return;
    if (t.kind === 'scada') { this.card.close(); this.scada.show(head, fwd); return; }
    this.scada.close(); this.card.show(t, head, fwd);
  }
  private verb(t: any) {
    const W: any = this.H.W;
    if (t.kind === 'door') return (W.indoor.doors.find((x: any) => 'door:' + x.id === t.id)?.tgt ?? 0) > 0.5 ? 'Fechar' : 'Abrir';
    if (t.kind === 'gate') return (W.yard.gates.find((g: any) => 'gate:' + g.id === t.id)?.tgt ?? 0) > 0.5 ? 'Fechar' : 'Abrir';
    return ({ scada: 'Supervisório', arm: 'Abrir', emerg: this.H.sess()?.sim.s.emergencia ? 'Desligar' : 'Acionar', dea: 'Pegar / devolver', vitima: 'Atender', bay: 'Abrir caixa' } as any)[t.kind] || 'Inspecionar';
  }
  private showLabel(part: any, it: any) {
    const L = this.label, H = this.H, tool = part?.tool && H.tool() !== part.tool && !(part.tool === 'detector_mt' && H.tool() === 'detector_at') ? part.tool : '';
    const verb = part ? 'Acionar' : this.verb(it), txt = part ? String(part.label).replace(/\s*\(comando local\)/, '') : it.label, warn = tool ? `usa: ${(TOOL_NAMES as any)[tool] || tool} (sai do cinto)` : '';
    const key = verb + '|' + txt + '|' + warn; if ((L as any)._k !== key) { (L as any)._k = key; L.render = (p) => { p.rect(0, 0, p.W, p.H, '#0d1012'); p.stroke(0, 0, p.W, p.H, part ? UI.ok : UI.accent, 3); p.text(`Gatilho · ${verb}`, 18, 34, { size: 26, color: part ? UI.ok : UI.accent, weight: 700, max: 260 }); p.text(txt, 290, 34, { size: 26, max: p.W - 304 }); if (warn) p.text(warn, 18, 92, { size: 22, color: UI.warn, max: p.W - 36 }); else p.text('Grip perto de porta: abrir com a mão', 18, 92, { size: 20, color: UI.dim, max: p.W - 36 }); }; L.dirty = true; }
    // legenda fixa abaixo do centro da visão (não cobre o alvo nem os botões vizinhos)
    const c = this.head(new Vector3()), f = this.fwd(_d).setY(0); if (f.lengthSq() < 1e-6) f.set(0, 0, -1); f.normalize();
    L.mesh.position.copy(c).addScaledVector(f, 0.9); L.mesh.position.y = c.y - 0.24; L.mesh.lookAt(c.x, c.y - 0.12, c.z); L.mesh.visible = true; L.update();
  }
}
export type { PerspectiveCamera };
