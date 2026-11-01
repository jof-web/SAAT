// Camada VR do SAAT (V0): botão de entrada, preset leve, rig com a câmera, locomoção com colisão, portas pelo raio,
// menu (Y/B e pulso), depuração, checklist/relatório e boneco de EPI. Só lê o estado e envia comandos (como src/game).
import { Group, Raycaster, Vector3, type Mesh } from 'three';
import type { Engine } from '../game/engine';
import type { GameWorld } from '../game/world';
import type { Player } from '../game/player';
import { GFX, presetLambert } from '../game/gfx';
import { XRInput, setGlove, type Hand } from './input';
import { Locomotion } from './locomotion';
import { Debug } from './debug';
import { Checklist, Menu, buildReport } from './validation';
import { Panel, UI } from './panel';
import { desenharBoneco, type Boneco } from '../ui/boneco';

export interface XRHost {
  E: Engine; W: GameWorld; P: Player; inter: any;
  livre(): boolean; area(): string; faltas(): number; boneco(): Boneco | null; gear(): { isolante: boolean; cobertura: boolean; pvc: boolean; fr: boolean };
  missao(): { codigo: string; titulo: string; passo: string }; pausar(): boolean; correndo(on: boolean, dt: number): void; onStart(): void; onEnd(): void;
}
const _h = new Vector3(), _d = new Vector3();
const USAVEIS = ['door', 'gate'];

export class XRLayer {
  rig = new Group(); input: XRInput; loco: Locomotion; debug = new Debug(); check = new Checklist(); menu: Menu; active = false; supported = false; reason = 'verificando…';
  boneco = { on: true }; private bonecoPanel = new Panel({ w: 0.062, h: 0.118, px: 240, transparent: true }); private lastBoneco: Boneco | null = null;
  private label = new Panel({ w: 0.42, h: 0.07, px: 600 }); private ray = new Raycaster(); private t = 0; private hover: any[] = [null, null];
  constructor(public H: XRHost, public version: string) {
    const E = H.E, R = E.renderer; R.xr.enabled = true; R.xr.setReferenceSpaceType('local-floor'); try { R.xr.setFoveation(1); } catch { /* */ }
    this.rig.name = 'xr-rig'; E.scene.add(this.rig); this.input = new XRInput(R, this.rig, E.scene);
    this.loco = new Locomotion(this.rig, E.cam, E.scene, (x, z, r) => H.P.hit(x, z, r), () => H.livre());
    this.debug.attach(E.cam);
    this.menu = new Menu({ version, loco: this.loco, debug: this.debug, check: this.check, hands: this.input.hands, cam: E.cam, scene: E.scene, renderer: R,
      missao: () => { const m = H.missao(), b = this.lastBoneco; return { ...m, area: H.area(), livre: H.livre(), faltas: H.faltas(), epi: b ? (b.pronto ? 'EPI completo' : `faltam ${b.faltam.length} EPI`) : '—' }; },
      teleport: (k) => { const s = H.W.spawns[k]; if (s && H.livre()) { this.loco.placeHead(s.x, s.z, s.yaw); this.menu.hide(); } }, pausar: () => H.pausar(), sair: () => { void R.xr.getSession()?.end(); },
      boneco: this.boneco, setBoneco: (on) => { this.boneco.on = on; this.bonecoPanel.mesh.visible = on && this.active; } });
    const bm = this.bonecoPanel.mesh; bm.position.set(0.115, -0.085, -0.38); bm.renderOrder = 1001; (bm.material as any).depthTest = false; bm.visible = false; E.cam.add(bm);
    this.bonecoPanel.render = (p) => { if (this.lastBoneco) desenharBoneco(p.g, p.W, p.H, this.lastBoneco, 'EPI'); };
    this.label.mesh.visible = false; (this.label.mesh.material as any).depthTest = false; this.label.mesh.renderOrder = 999; E.scene.add(this.label.mesh);
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
  /** Chamar dentro do clique (gesto do usuário). */
  enter() {
    const xr = (navigator as any).xr; if (!xr) return Promise.resolve(false);
    return xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] }).then((s: any) => this.H.E.renderer.xr.setSession(s)).then(() => true).catch((e: any) => { this.debug.error('Entrar em VR: ' + (e?.message || e)); return false; });
  }
  exit() { void this.H.E.renderer.xr.getSession()?.end(); }
  report() { return buildReport(this.version, this.check, this.debug); }
  private onStart() {
    const { E, P } = this.H; this.active = true; GFX.xr = true; presetLambert(E.scene, true); E.xrMode(true);
    this.rig.position.set(P.pos.x, 0, P.pos.z); this.rig.rotation.set(0, P.yaw, 0); this.rig.add(E.cam); E.cam.position.set(0, 1.6, 0); E.cam.rotation.set(0, 0, 0); E.cam.near = 0.03; E.cam.updateProjectionMatrix();
    this.loco.applyHeight(); this.debug.setVisible(true); this.bonecoPanel.mesh.visible = this.boneco.on; this.menu.hide(); this.H.onStart();
  }
  private onEnd() {
    const { E, P } = this.H; this.active = false; GFX.xr = false; presetLambert(E.scene, false); E.xrMode(false);
    const h = this.loco.head(_h), yaw = this.loco.headYaw(); this.rig.remove(E.cam); E.cam.near = 0.05; E.cam.updateProjectionMatrix(); P.place(h.x, h.z, yaw);
    this.debug.setVisible(false); this.bonecoPanel.mesh.visible = false; this.menu.hide(); this.label.mesh.visible = false; this.H.onEnd();
  }
  update(dt: number) {
    if (!this.active) return; const H = this.H, hands = this.input.hands;
    this.input.read(); this.loco.update(dt, hands); this.rig.updateMatrixWorld(true); this.input.poses();
    const h = this.loco.head(_h); H.P.pos.set(h.x, 0, h.z); H.P.yaw = this.loco.headYaw();
    H.correndo(this.loco.running && this.loco.moving, dt);
    this.rays(); this.menu.update(dt);
    this.t += dt; if (this.t > 0.3) { this.t = 0; const g = H.gear(); for (const x of hands) setGlove(x.model, g); this.lastBoneco = H.boneco(); if (this.boneco.on) this.bonecoPanel.dirty = true; }
    this.bonecoPanel.update(); this.debug.frame(dt, H.area(), H.E.renderer, true);
  }
  /** Raio: painel do menu (gatilho clica) ou porta/portão a até 3,5 m (gatilho abre/fecha). */
  private rays() {
    const H = this.H, P = this.menu.panel; let shown = false;
    const hits = H.W.inter.filter((i: any) => USAVEIS.includes(i.kind)).map((i: any) => i.hit as Mesh);
    this.input.hands.forEach((h: Hand, k) => {
      if (!h.connected || !h.line || !h.cursor) return; let dist = Infinity, onPanel = false, tgt: any = null;
      if (this.menu.mode) { const t = P.rayHit(h.rayO, h.rayD); if (t < dist) { dist = t; onPanel = true; P.hover(P.hitX, P.hitY); } }
      if (!onPanel) { this.ray.set(h.rayO, h.rayD); this.ray.far = 3.5; const r = this.ray.intersectObjects(hits, false)[0]; if (r) { dist = r.distance; tgt = H.W.inter.find((i: any) => i.hit === r.object); } }
      if (!onPanel && this.hover[k] && this.menu.mode) P.clearHover(); this.hover[k] = tgt;
      h.line.visible = true; h.line.scale.z = isFinite(dist) ? dist : 2; (h.line.material as any).color.setHex(onPanel ? 0xf2c230 : tgt ? 0x6fb3e0 : 0xffffff);
      h.cursor.visible = isFinite(dist); if (h.cursor.visible) h.cursor.position.copy(h.rayO).addScaledVector(h.rayD, dist);
      if (tgt && !shown) { shown = true; this.showLabel(tgt, h); }
      if (h.triggerDown) { if (onPanel) { P.click(P.hitX, P.hitY); h.pulse(0.3, 12); } else if (tgt) { (H.inter as any).setTarget(tgt); H.inter.use(); h.pulse(0.5, 25); } }
    });
    if (!shown) this.label.mesh.visible = false;
  }
  private showLabel(t: any, h: Hand) {
    const L = this.label, verb = t.kind === 'gate' ? ((this.H.W.yard.gates.find((g) => 'gate:' + g.id === t.id)?.tgt ?? 0) > 0.5 ? 'Fechar' : 'Abrir') : ((this.H.W.indoor.doors.find((x: any) => 'door:' + x.id === t.id)?.tgt ?? 0) > 0.5 ? 'Fechar' : 'Abrir');
    const key = verb + t.label; if ((L as any)._k !== key) { (L as any)._k = key; L.render = (p) => { p.rect(0, 0, p.W, p.H, '#0d1012'); p.stroke(0, 0, p.W, p.H, UI.accent, 3); p.text(`Gatilho · ${verb}`, 18, p.H / 2, { size: 30, color: UI.accent, weight: 700 }); p.text(t.label, 250, p.H / 2, { size: 28, max: p.W - 268 }); }; L.dirty = true; }
    const cam = this.H.E.cam; t.hit.getWorldPosition(_d); cam.getWorldPosition(_h); const dir = _d.clone().sub(_h); const dd = Math.min(dir.length() - 0.3, 1.6); dir.normalize();
    L.mesh.position.copy(_h).addScaledVector(dir, Math.max(0.6, dd)); L.mesh.position.y = _h.y - 0.18; L.mesh.lookAt(_h); L.mesh.visible = true; L.update(); void h;
  }
}
