// Efeitos e painéis auxiliares do VR: clarão/escurecimento/tinta de zona (esfera na câmera, sem mover a câmera),
// cartão de acidente, legenda de avisos (toasts e rádio do COS) que segue o olhar com atraso e o PiP da manobra.
import { Mesh, SphereGeometry, PlaneGeometry, MeshBasicMaterial, BackSide, Color, Group, Vector3, WebGLRenderTarget, HalfFloatType, UnsignedByteType, SRGBColorSpace, type Object3D, type PerspectiveCamera, type Scene, type WebGLRenderer } from 'three';
import { Panel, UI, FONT } from './panel';

const UP = new Vector3(0, 1, 0), _f = new Vector3();
const noPreset = (o: Object3D) => o.traverse((x: any) => { x.userData.noPreset = true; });
/** Texto com quebra de linha; devolve o y depois da última linha. */
export function wrap(p: Panel, s: string, x: number, y: number, maxW: number, { size = 24, lh = 1.25, color = UI.text, weight = 500, maxLines = 6 } = {}) {
  const g = p.g; g.font = `${weight} ${size}px ${FONT}`; const words = s.split(/\s+/); let line = '', n = 0;
  const flush = (last: boolean) => { let t = line; if (!last && n === maxLines - 1) { while (t.length > 1 && g.measureText(t + '…').width > maxW) t = t.slice(0, -1); t += '…'; } p.text(t, x, y + size / 2, { size, color, weight }); y += size * lh; n++; line = ''; };
  for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { flush(false); if (n >= maxLines) return y; line = w; } else line = t; }
  if (line && n < maxLines) flush(true); return y;
}
function place(m: Object3D, head: Vector3, fwd: Vector3, dist: number, dy: number, yawOff = 0) {
  _f.copy(fwd).setY(0); if (_f.lengthSq() < 1e-6) _f.set(0, 0, -1); _f.normalize().applyAxisAngle(UP, yawOff); m.position.copy(head).addScaledVector(_f, dist); m.position.y = head.y + dy; m.lookAt(head.x, head.y + dy * 0.5, head.z);
}

/** Esfera presa à câmera: clarão (choque/arco), escurecimento (desmaio) e tinta vermelha na zona controlada. */
export class VRFx {
  mat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: BackSide, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
  sphere = new Mesh(new SphereGeometry(0.4, 16, 10), this.mat); flash = 0; flashCol = new Color(); fade = 0; fadeTgt = 0; zone = 0;
  constructor(cam: PerspectiveCamera) { this.sphere.renderOrder = 1002; this.sphere.visible = false; this.sphere.frustumCulled = false; noPreset(this.sphere); cam.add(this.sphere); }
  doFlash(hex: number, s: number) { this.flash = s; this.flashCol.setHex(hex); }
  reset() { this.flash = 0; this.fade = this.fadeTgt = 0; this.zone = 0; }
  update(dt: number) {
    this.flash = Math.max(0, this.flash - dt); this.fade += (this.fadeTgt - this.fade) * Math.min(1, dt * 1.6); let op = 0;
    if (this.flash > 0) { this.mat.color.copy(this.flashCol); op = Math.min(1, this.flash * 1.6); }
    else if (this.fade > 0.01) { this.mat.color.setHex(0x0b0d0f); op = this.fade * 0.94; }
    else if (this.zone > 0.02) { this.mat.color.setHex(0xc81e1e); op = 0.05 + this.zone * 0.2; }
    this.mat.opacity = op; this.sphere.visible = op > 0.005;
  }
}

export interface AccHost { restart(): void; rescue(a: any): void; report(): void; home(): void }
/** Cartão do acidente (o que aconteceu, consequência, regra, como evitar) com as mesmas saídas do PC. */
export class VRAccident {
  panel = new Panel({ w: 0.86, h: 0.64, px: 1280 }); a: any = null;
  constructor(public H: AccHost, scene: Scene) { const m = this.panel.mesh; m.visible = false; Object.assign(m.material as any, { depthTest: false, transparent: true }); m.renderOrder = 1003; scene.add(m); this.panel.render = (p) => this.draw(p); } // transparente: desenha depois da esfera de escurecimento
  get open() { return this.panel.mesh.visible; }
  show(a: any, head: Vector3, fwd: Vector3) { this.a = a; place(this.panel.mesh, head, fwd, 0.95, -0.06); this.panel.mesh.visible = true; this.panel.dirty = true; }
  hide() { this.panel.mesh.visible = false; this.a = null; this.panel.clearHover(); }
  update() { if (this.open) this.panel.update(); }
  private draw(p: Panel) {
    const a = this.a; if (!a) return; const T: Record<string, string> = { choque: 'Choque elétrico', arco: 'Arco elétrico', passo: 'Tensão de passo', quimico: 'Acidente químico', contato: 'Segunda vítima' };
    p.rect(0, 0, p.W, 110, '#3a1214'); p.text('ACIDENTE — FALHA CRÍTICA', 32, 34, { size: 24, color: '#ffb4b0', weight: 700 }); p.text(T[a.tipo] || 'Acidente', 32, 78, { size: 44, weight: 700 });
    let y = 132; for (const [k, v] of [['O que aconteceu', a.causa], ['Consequência', a.lesao], ['Regra', a.regra], ['Como evitar', a.evitar]] as [string, string][]) { p.text(k.toUpperCase(), 32, y + 12, { size: 20, color: UI.accent, weight: 700 }); y = wrap(p, v, 32, y + 30, p.W - 64, { size: 25, maxLines: 3 }) + 10; }
    const by = p.H - 96, bw = (p.W - 64 - 3 * 16) / 4;
    ([['Treinar o resgate', () => this.H.rescue(a), UI.accent], ['Tentar de novo', () => this.H.restart(), ''], ['Relatório (sai do VR)', () => this.H.report(), ''], ['Menu inicial', () => this.H.home(), '']] as [string, () => void, string][])
      .forEach(([l, f, c], i) => p.button('acc' + i, 32 + i * (bw + 16), by, bw, 72, l, () => { this.hide(); f(); }, { size: 26, active: !!c, color: c }));
  }
}

/** Avisos do jogo (toasts) e rádio do COS em legenda: segue a cabeça com atraso, 1 m à frente, abaixo da linha dos olhos. */
export class VRHud {
  panel = new Panel({ w: 0.62, h: 0.17, px: 992, transparent: true }); items: { k: string; t: string; who?: string; until: number }[] = []; private tgt = new Vector3(); private placed = false;
  constructor(scene: Scene) { const m = this.panel.mesh; m.visible = false; (m.material as any).depthTest = false; m.renderOrder = 998; scene.add(m); this.panel.render = (p) => this.draw(p); }
  push(k: string, t: string, who?: string) { if (k === 'muted' && /^(Prática livre|Você está na casa)/.test(t)) return; const now = performance.now(), last = this.items[this.items.length - 1];
    if (last && last.t === t) { last.until = now + 4000; return; } this.items.push({ k, t, who, until: now + (k === 'say' ? 10000 : k === 'bad' ? 7000 : 4500) }); while (this.items.length > 3) this.items.shift(); this.panel.dirty = true; }
  clear() { this.items = []; this.panel.mesh.visible = false; this.placed = false; }
  update(dt: number, head: Vector3, fwd: Vector3) {
    const now = performance.now(), n = this.items.length; this.items = this.items.filter((i) => i.until > now); if (this.items.length !== n) this.panel.dirty = true;
    const m = this.panel.mesh, vis = this.items.length > 0; if (!vis) { m.visible = false; this.placed = false; return; }
    _f.copy(fwd).setY(0); if (_f.lengthSq() < 1e-6) _f.set(0, 0, -1); _f.normalize(); this.tgt.copy(head).addScaledVector(_f, 1.0); this.tgt.y = head.y - 0.34;
    if (!this.placed) { m.position.copy(this.tgt); this.placed = true; } else m.position.lerp(this.tgt, Math.min(1, dt * 1.8)); m.lookAt(head); m.visible = true; this.panel.update();
  }
  private draw(p: Panel) {
    let y = p.H; const col: Record<string, string> = { ok: UI.ok, bad: UI.bad, warn: UI.warn, say: UI.info, muted: UI.dim, info: UI.dim };
    for (const it of [...this.items].reverse()) { const say = it.k === 'say', txt = say ? `${it.who || 'COS'}: ${it.t}` : it.t, size = 26, lines = say || txt.length > 70 ? 2 : 1, h = lines * size * 1.25 + 18; y -= h + 6; if (y < 0) break;
      p.rect(0, y, p.W, h, 'rgba(13,16,18,0.88)'); p.rect(0, y, 10, h, col[it.k] || UI.dim); wrap(p, txt, 24, y + 9, p.W - 40, { size, maxLines: lines, color: it.k === 'muted' ? UI.dim : UI.text, weight: 600 }); }
  }
}

/** PiP da manobra no VR: câmera fixa sobre o equipamento renderizada numa textura (1 a cada 3 quadros). */
export class VRPip {
  rt: WebGLRenderTarget; g = new Group(); cap = new Panel({ w: 0.5, h: 0.055, px: 800 }); until = 0; caption = ''; private n = 0;
  constructor(R: WebGLRenderer, scene: Scene) {
    const half = R.extensions.has('EXT_color_buffer_half_float') || R.extensions.has('EXT_color_buffer_float');
    this.rt = new WebGLRenderTarget(640, 360, { type: half ? HalfFloatType : UnsignedByteType }); if (!half) this.rt.texture.colorSpace = SRGBColorSpace;
    const back = new Mesh(new PlaneGeometry(0.52, 0.355), new MeshBasicMaterial({ color: 0x0d1012, fog: false, toneMapped: false })); back.position.set(0, -0.022, -0.003);
    const scr = new Mesh(new PlaneGeometry(0.5, 0.28125), new MeshBasicMaterial({ map: this.rt.texture, toneMapped: half, fog: false }));
    this.cap.mesh.position.set(0, -0.17, 0.001); this.cap.render = (p) => { p.rect(0, 0, p.W, p.H, '#0d1012'); p.text('CFTV · ' + this.caption, 14, p.H / 2, { size: 26, mono: true, max: p.W - 28 }); };
    this.g.add(back, scr, this.cap.mesh); this.g.visible = false; noPreset(this.g); scene.add(this.g);
  }
  show(caption: string, until: number, head: Vector3, fwd: Vector3) { if (!this.g.visible) place(this.g, head, fwd, 1.15, 0.04, -0.5); this.caption = caption; this.cap.dirty = true; this.until = until; this.g.visible = true; this.n = 0; }
  hide() { this.g.visible = false; }
  get active() { return this.g.visible; }
  update() { if (this.g.visible && performance.now() > this.until) this.g.visible = false; if (this.g.visible) this.cap.update(); }
  render(R: WebGLRenderer, scene: Scene, cam: PerspectiveCamera, before: () => void, after: () => void) {
    if (!this.g.visible || this.n++ % 3) return; this.g.visible = false; before(); const xrOn = R.xr.enabled, prev = R.getRenderTarget();
    R.xr.enabled = false; R.setRenderTarget(this.rt); R.render(scene, cam); R.setRenderTarget(prev); R.xr.enabled = xrOn; after(); this.g.visible = true;
  }
}
