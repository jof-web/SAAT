// Validação no VR: checklist (IDs do documento de passagem) com status e notas, relatório em texto e o menu
// flutuante (Y/B) e de pulso (palma para cima): Missão, Locomoção, Config, Checklist, Debug.
import { Vector3, Matrix4, type Group, type PerspectiveCamera, type Scene, type WebGLRenderer } from 'three';
import { Panel, UI } from './panel';
import { drawProcs } from './card';
import type { Hand } from './input';
import type { Locomotion } from './locomotion';
import type { Debug } from './debug';

export const FASE = 4; // V0.2: interação, supervisório, PiP, consequências e resgate no VR
export const ITEMS = ([
  ['S1', 'Menu pelo botão Y / B', 0], ['S2', 'Menu de pulso (palma para cima)', 0], ['S3', 'FPS e erros dentro do VR', 0], ['S4', 'Relatório 2D (copiar e baixar)', 0], ['S5', 'Desktop intacto', 0], ['S6', 'Mão dominante (destro/canhoto)', 0], ['S7', 'Calibrar chão / zerar altura', 0], ['S8', 'Boneco de EPI no VR', 0],
  ['L1', 'Andar (polegar, direção da cabeça)', 0], ['L2', 'Correr (clique no polegar) gera falta', 0], ['L3', 'Girar snap 30°/45° e suave', 0], ['L4', 'Vinheta de conforto', 0], ['L5', 'Colisão: paredes, cerca, equipamentos e portas fechadas', 0], ['L6', 'Room-scale: entrar na parede escurece', 0], ['L7', 'Teleporte só na prática livre', 0],
  ['X1', 'Raio + rótulo nos equipamentos', 1], ['X2', 'Portas e portões pelo raio + gatilho', 0], ['X3', 'Cartão ancorado ao equipamento', 1], ['X4', 'Botões dos painéis (poke)', 1], ['X5', 'Chave 43', 2], ['X6', 'Extração com manivela', 2], ['X7', 'Aterramento com alavanca', 2], ['X8', 'LOTO cadeado', 2], ['X9', 'Detector de tensão', 2], ['X10', 'Armário: inspecionar e vestir', 2], ['X11', 'Luvas visíveis nas mãos', 0], ['X12', 'Cinto: pegar e guardar', 2], ['X13', 'Tablet: Tarefa, Rádio, read-back', 1], ['X14', 'Tablet: Mapa, Leituras, APR/PT, Fichas', 5], ['X15', 'Supervisório na mesa', 3], ['X16', 'PiP da manobra', 3], ['X17', 'Choque/arco sem mover a câmera', 4], ['X18', 'Tensão de passo + pés juntos', 4], ['X19', 'RCP pelas mãos', 4], ['X20', 'DEA', 4], ['X21', 'Áudio espacial + voz do COS', 5], ['X22', 'Vibração', 4], ['X23', 'Mão: aberta, fechada (grip), indicador', 4], ['X24', 'Dedo aperta botão (afunda e vibra)', 4], ['X25', 'Grip: seletora 43, alavanca, porta/tampa', 4], ['X26', 'Manivela encaixada: 3 voltas por posição', 4], ['X27', 'EPI físico: olhar de perto e vestir', 4], ['X28', 'Cinto: guardar e pegar ferramenta', 4], ['X29', 'Supervisório de toque na mesa', 4], ['X30', 'Resgate pelas mãos (ombro, respiração, RCP, DEA)', 4],
  ['M-T0', 'Missão T0 completa no VR', 1], ['M-R1', 'Missão R1 completa no VR', 1], ['M-R2', 'Missão R2 completa no VR', 1], ['M-C1', 'Missão C1 completa no VR', 2], ['M-M1', 'Missão M1 completa no VR', 2], ['M-M2', 'Missão M2 completa no VR', 2], ['M-C2', 'Missão C2 completa no VR', 3], ['M-E1', 'Missão E1 completa no VR', 3], ['M-S1', 'Missão S1 completa no VR', 4], ['M-S2', 'Missão S2 completa no VR', 4],
] as [string, string, number][]).map(([id, name, fase]) => ({ id, name, fase, group: id[0] }));
export const STATUS: Record<string, string> = { ok: '✅', mal: '⚠️', falha: '❌', nt: '—' };
export const NOTES = ['enjoo', 'impreciso', 'travou', 'lento', 'não detectou', 'atravessou objeto'];
const KEY = 'saat:vrCheck';

export class Checklist {
  data: Record<string, { s: string; n: string[] }> = {};
  constructor() { try { this.data = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* */ } }
  get(id: string) { return this.data[id] || { s: 'nt', n: [] }; }
  set(id: string, s: string) { const e = this.get(id); e.s = s; this.data[id] = e; this.save(); }
  toggleNote(id: string, n: string) { const e = this.get(id); const i = e.n.indexOf(n); if (i >= 0) e.n.splice(i, 1); else e.n.push(n); this.data[id] = e; this.save(); }
  clear() { this.data = {}; this.save(); }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* */ } }
  counts(g?: string) { const c: Record<string, number> = { ok: 0, mal: 0, falha: 0, nt: 0 }; for (const it of ITEMS) if (!g || it.group === g) c[this.get(it.id).s]++; return c; }
}
export function buildReport(version: string, ck: Checklist, dbg: Debug) {
  const d = new Date(), p = (n: number) => String(n).padStart(2, '0');
  const L = [`${version} | ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`, '', 'ID | status | notas'];
  for (const it of ITEMS) { const e = ck.get(it.id); L.push(`${it.id} | ${STATUS[e.s]} | ${e.n.length ? e.n.join(', ') : '—'}${it.fase > FASE ? ' (V' + it.fase + ')' : ''}`); }
  L.push('', 'FPS médio por área (meta 72)'); const t = dbg.fpsTable(); if (!t.length) L.push('— sem medição no VR'); for (const [k, f, s] of t) L.push(`${k} | ${f.toFixed(1)} fps | ${Math.round(s)} s`);
  L.push('', 'erros capturados'); if (!dbg.errors.length) L.push('— nenhum'); for (const e of dbg.errors) L.push(`[${e.t}] ${e.msg}${e.n > 1 ? ' (×' + e.n + ')' : ''}`);
  return L.join('\n');
}

export interface MenuHost {
  version: string; loco: Locomotion; debug: Debug; check: Checklist; hands: Hand[]; cam: PerspectiveCamera; scene: Scene; renderer: WebGLRenderer;
  missao(): { codigo: string; titulo: string; passo: string; area: string; livre: boolean; faltas: number; epi: string };
  teleport(k: string): void; pausar(): boolean; sair(): void; boneco: { on: boolean }; setBoneco(on: boolean): void;
  extra: { radio(): void; readback(): string | null; conferir(): string; tool(): string; usar(): void; guardar(): void; altura(): number; setAltura(cm: number): void; aplicarAltura(): string; perfil(): number | null; local(): { loc: string; label: string } | null; ctx(): any };
}
const TABS: [string, string][] = [['mis', 'Missão'], ['proc', 'Tarefas'], ['loc', 'Locomoção'], ['cfg', 'Config'], ['chk', 'Checklist'], ['dbg', 'Debug']];
const ROWS = 7, _v = new Vector3(), _v2 = new Vector3(), _m = new Matrix4(), _x = new Vector3(), _y = new Vector3(), _z = new Vector3();

export class Menu {
  panel = new Panel({ w: 0.64, h: 0.5, px: 1024 }); mode: null | 'float' | 'wrist' = null; tab = 'mis'; group = 'S'; page = 0; sel: string | null = null; calib = 0; calibMsg = ''; msg = ''; procTab: 'loc' | 'radio' = 'loc'; ask: [string, () => void][] | null = null; procSt = { page: 0, ask: (ops: [string, () => void][]) => { this.ask = ops; this.panel.dirty = true; } }; private palmT = 0; private offT = 0; private refreshT = 0;
  constructor(public A: MenuHost) {
    this.panel.render = (p) => this.draw(p); this.panel.mesh.visible = false; A.scene.add(this.panel.mesh);
    A.debug.listeners.add(() => { if (this.tab === 'dbg') this.panel.dirty = true; });
  }
  hide() { this.mode = null; this.panel.mesh.visible = false; this.panel.clearHover(); }
  toggleFloat() {
    if (this.mode === 'float') { this.hide(); return; } const m = this.panel.mesh; this.A.scene.attach(m);
    this.A.cam.getWorldPosition(_v); this.A.cam.getWorldDirection(_v2); _v2.y = 0; _v2.normalize();
    m.position.copy(_v).addScaledVector(_v2, 0.75); m.position.y -= 0.12; m.lookAt(_v.x, _v.y - 0.05, _v.z); m.scale.setScalar(1); this.mode = 'float'; m.visible = true; this.panel.dirty = true;
  }
  /** Menu de pulso: palma da mão não dominante para cima e olhando para ela. */
  private wrist(h: Hand, dt: number) {
    if (this.mode === 'float' || !h.connected || !h.grip) { this.palmT = 0; return; }
    if (this.mode === 'wrist' && this.panel.mesh.parent !== h.grip) this.hide();
    const sx = h.handedness === 'left' ? 1 : -1; _x.set(sx, 0, 0).applyQuaternion(h.quat); this.A.cam.getWorldPosition(_v); _v2.copy(h.pos).sub(_v).normalize(); this.A.cam.getWorldDirection(_z);
    const up = _x.y > 0.6 && _z.dot(_v2) > 0.7; if (up) { this.palmT += dt; this.offT = 0; } else { this.offT += dt; this.palmT = 0; }
    if (this.mode !== 'wrist' && this.palmT > 0.25) { const m = this.panel.mesh; h.grip.add(m); _x.set(0, -sx, 0); _y.set(0, 0, -1); _z.set(sx, 0, 0); _m.makeBasis(_x, _y, _z); m.quaternion.setFromRotationMatrix(_m); m.position.set(0.07 * sx, 0, -0.12); m.scale.setScalar(0.55); this.mode = 'wrist'; m.visible = true; this.panel.dirty = true; }
    if (this.mode === 'wrist' && this.offT > 0.4) this.hide();
  }
  update(dt: number) {
    const A = this.A, M = A.loco.s.hand === 'left' ? A.hands[1] : A.hands[0];
    if (M.topDown) this.toggleFloat(); this.wrist(M, dt);
    if (this.calib > 0) { const b = Math.ceil(this.calib); this.calib -= dt; if (this.calib <= 0) { this.calib = 0; const v = A.loco.calibrateFloor(A.hands); this.calibMsg = v === null ? 'Nenhum controle conectado.' : `Chão calibrado: ajuste ${(v >= 0 ? '+' : '') + v.toFixed(2)} m.`; A.hands.forEach((h) => h.pulse(0.6, 60)); this.panel.dirty = true; } else if (Math.ceil(this.calib) !== b) this.panel.dirty = true; }
    if (this.mode) { this.refreshT += dt; if (this.refreshT > 0.5) { this.refreshT = 0; if (this.tab !== 'chk') this.panel.dirty = true; } this.panel.update(); }
  }
  private draw(p: Panel) {
    TABS.forEach(([id, l], i) => p.button('tab' + id, 12 + i * 167, 12, 160, 64, l, () => { this.tab = id; this.ask = null; }, { active: this.tab === id, size: 24 }));
    p.text(this.A.version, p.W - 14, 96, { size: 20, color: UI.dim, align: 'right', mono: true }); p.rect(0, 84, p.W, 2, UI.line);
    if (this.tab === 'mis') this.drawMissao(p); else if (this.tab === 'proc') this.drawProc(p); else if (this.tab === 'loc') this.drawLoco(p); else if (this.tab === 'cfg') this.drawCfg(p); else if (this.tab === 'chk') this.drawCheck(p); else this.drawDebug(p);
  }
  private drawMissao(p: Panel) {
    const m = this.A.missao(), X = this.A.extra;
    p.text(m.codigo, 24, 122, { size: 24, color: UI.accent, weight: 700, max: 760 }); p.text(m.titulo, 24, 160, { size: 32, weight: 700, max: 970 });
    p.text(m.passo || '—', 24, 204, { size: 26, color: UI.dim, max: 970 });
    p.text(`Área: ${m.area}   ·   Faltas: ${m.faltas}   ·   ${m.epi}   ·   Na mão: ${X.tool()}`, 24, 246, { size: 23, max: 970, color: m.faltas ? UI.warn : UI.text });
    p.text('Dedo aperta botão · grip pega, gira e puxa · ferramenta encosta no ponto · X/A segurado: pés juntos', 24, 284, { size: 21, color: UI.dim, max: 970 });
    const B = (id: string, x: number, l: string, f: () => void) => p.button(id, x, 312, 236, 64, l, f, { size: 23 });
    B('rb', 24, 'Rádio / COS', () => { this.tab = 'proc'; this.procTab = 'radio'; }); B('ce', 272, 'Conferir EPI', () => { this.msg = X.conferir(); });
    B('us', 520, 'Usar ferramenta', () => { X.usar(); }); B('gd', 768, 'Guardar ferramenta', () => { X.guardar(); });
    if (this.msg) p.text(this.msg, 24, 396, { size: 21, color: UI.info, max: 970 });
    if (m.livre) { p.text('Teleporte (prática livre)', 24, 430, { size: 22, color: UI.dim });
      [['casa', 'Casa'], ['patio', 'Pátio'], ['trafos', 'Trafos'], ['lt01', 'LT-01']].forEach(([k, l], i) => p.button('tp' + k, 24 + i * 248, 450, 236, 60, l, () => this.A.teleport(k), { size: 24 })); }
    p.button('bon', 24, 530, 480, 64, this.A.boneco.on ? 'Boneco de EPI no pulso: ligado' : 'Boneco de EPI no pulso: desligado', () => this.A.setBoneco(!this.A.boneco.on), { active: this.A.boneco.on, color: UI.ok, size: 24 });
    p.button('pause', 520, 530, 480, 64, 'Pausar / continuar', () => { this.A.pausar(); }, { size: 24 });
    p.button('exit', 24, 612, 976, 72, 'Sair do VR (resultado e relatório na tela 2D)', () => this.A.sair(), { size: 26, color: UI.bad });
    p.text('APR/PT: preencha no PC antes de entrar. Botão Meta também sai do VR.', 24, 716, { size: 21, color: UI.dim, max: 970 });
  }
  /** Tarefas: procedimentos e decisões do local mais próximo ou do rádio (o 'tablet' do pulso). */
  private drawProc(p: Panel) {
    const X = this.A.extra, ctx = X.ctx(); if (!ctx?.sc) { p.text('Prática livre: sem procedimentos de missão.', 24, 130, { size: 26, color: UI.dim }); return; }
    const L = X.local(); if (!L && this.procTab === 'loc') this.procTab = 'radio';
    p.button('prl', 24, 96, 480, 60, L ? `Aqui: ${L.label}` : 'Aqui: nada perto', () => { this.procTab = 'loc'; this.procSt.page = 0; }, { active: this.procTab === 'loc', size: 22, disabled: !L });
    p.button('prr', 520, 96, 480, 60, 'Rádio / COS', () => { this.procTab = 'radio'; this.procSt.page = 0; }, { active: this.procTab === 'radio', size: 22 });
    let y = 172;
    if (this.ask) { p.text('Confirmar decisão:', 24, y + 16, { size: 24, color: UI.accent }); y += 40; this.ask.forEach(([l, f], i) => p.button('ak' + i, 24, y + i * 72, 976, 62, l, () => { this.ask = null; f(); }, { size: 23, align: 'left' })); p.button('akx', 24, y + this.ask.length * 72, 976, 58, 'Cancelar', () => { this.ask = null; }, { size: 23 }); return; }
    if (this.procTab === 'radio') { const pend = ctx.sc.st.cos.find((o: any) => o.readbackReq && !o.readback); p.button('rbk', 24, y, 976, 60, pend ? 'Read-back da última ordem do COS' : 'Nenhuma ordem aguardando read-back', () => { this.msg = X.readback() || ''; }, { size: 23, active: !!pend, color: UI.accent, disabled: !pend }); y += 70; }
    drawProcs(p, 24, y, 976, this.procTab === 'radio' ? 'radio' : L!.loc, this.procSt, ctx, this.procTab === 'radio' ? 6 : 7);
    if (this.msg) p.text(this.msg, 24, p.H - 26, { size: 21, color: UI.info, max: 970 });
  }
  private drawLoco(p: Panel) {
    const lo = this.A.loco, s = lo.s, sv = () => lo.save(), row = (y: number, l: string) => p.text(l, 24, y + 32, { size: 26, max: 560 });
    const tog = (id: string, y: number, on: boolean, fn: () => void, dis = false) => p.button(id, 760, y, 240, 64, on ? 'Ligado' : 'Desligado', () => { fn(); sv(); }, { active: on, color: UI.ok, disabled: dis });
    let y = 100;
    row(y, 'L7 Teleporte (só prática livre)'); tog('tp', y, s.teleport, () => { s.teleport = !s.teleport; }); y += 76;
    row(y, 'L1 Andar (polegar da outra mão)'); tog('ct', y, s.continuous, () => { s.continuous = !s.continuous; }); y += 76;
    row(y, 'Velocidade'); p.button('sp-', 600, y, 90, 64, '−', () => { s.speed = Math.max(0.5, +(s.speed - 0.25).toFixed(2)); sv(); }, { size: 36 }); p.text(s.speed.toFixed(2).replace('.', ',') + ' m/s', 795, y + 32, { size: 26, align: 'center', mono: true }); p.button('sp+', 910, y, 90, 64, '+', () => { s.speed = Math.min(3, +(s.speed + 0.25).toFixed(2)); sv(); }, { size: 36 }); y += 76;
    row(y, 'L3 Giro'); ([['snap30', 'Snap 30°'], ['snap45', 'Snap 45°'], ['smooth', 'Suave'], ['off', 'Off']] as const).forEach(([k, l], i) => p.button('tr' + k, 300 + i * 176, y, 168, 64, l, () => { s.turn = k; sv(); }, { active: s.turn === k, size: 24 })); y += 76;
    row(y, 'Giro suave'); p.button('ss-', 600, y, 90, 64, '−', () => { s.smoothSpeed = Math.max(30, s.smoothSpeed - 15); sv(); }, { size: 36 }); p.text(s.smoothSpeed + ' °/s', 795, y + 32, { size: 26, align: 'center', mono: true }); p.button('ss+', 910, y, 90, 64, '+', () => { s.smoothSpeed = Math.min(180, s.smoothSpeed + 15); sv(); }, { size: 36 }); y += 76;
    row(y, 'L4 Vinheta de conforto'); tog('vg', y, s.vignette, () => { s.vignette = !s.vignette; }); y += 76;
    row(y, 'Modo sentado'); tog('se', y, s.seated, () => lo.setSeated(!s.seated)); y += 76;
    row(y, 'Altura extra'); p.button('h-', 600, y, 90, 64, '−5', () => lo.nudgeHeight(-0.05), { size: 26 }); p.text((s.manual >= 0 ? '+' : '') + s.manual.toFixed(2).replace('.', ',') + ' m', 795, y + 32, { size: 26, align: 'center', mono: true }); p.button('h+', 910, y, 90, 64, '+5', () => lo.nudgeHeight(0.05), { size: 26 });
  }
  private drawCfg(p: Panel) {
    const lo = this.A.loco, s = lo.s, sv = () => lo.save();
    p.text('Mão dominante (gira e teleporta; a outra anda, corre e abre o menu)', 24, 122, { size: 24, color: UI.dim, max: 970 });
    p.button('hr', 24, 146, 480, 72, 'Destro (mão direita)', () => { s.hand = 'right'; sv(); }, { active: s.hand !== 'left', size: 26 });
    p.button('hl', 520, 146, 480, 72, 'Canhoto (mão esquerda)', () => { s.hand = 'left'; sv(); }, { active: s.hand === 'left', size: 26 });
    p.text('Cartão de ajuda (mirar + gatilho mostra o estado e as peças)', 24, 262, { size: 24, max: 700 }); p.button('aj', 760, 232, 240, 60, s.ajuda ? 'Ligado' : 'Desligado', () => { s.ajuda = !s.ajuda; sv(); }, { active: s.ajuda, color: UI.ok, size: 24 });
    p.text(`Velocidade da corrida (${(s.speed * s.run).toFixed(1).replace('.', ',')} m/s)`, 24, 306, { size: 26 });
    p.button('rn-', 600, 274, 90, 64, '−', () => { s.run = Math.max(1.25, +(s.run - 0.25).toFixed(2)); sv(); }, { size: 36 }); p.text(s.run.toFixed(2).replace('.', ',') + '×', 795, 306, { size: 26, align: 'center', mono: true }); p.button('rn+', 910, 274, 90, 64, '+', () => { s.run = Math.min(3, +(s.run + 0.25).toFixed(2)); sv(); }, { size: 36 });
    p.text(`Menu: botão ${s.hand === 'left' ? 'B (direita)' : 'Y (esquerda)'} ou palma dessa mão para cima.`, 24, 380, { size: 24, color: UI.dim });
    p.rect(16, 404, p.W - 32, 2, UI.line);
    const X = this.A.extra, cm = X.altura(), pf = X.perfil();
    p.text(`Altura da pessoa${pf ? ' (do perfil)' : ''}`, 24, 434, { size: 26, weight: 700 }); p.text(`olhos ${lo.eyeHeight().toFixed(2).replace('.', ',')} m`, p.W - 24, 434, { size: 22, color: UI.dim, align: 'right', mono: true });
    ([['a5-', -5, 24], ['a1-', -1, 128]] as const).forEach(([id, d, x]) => p.button(id, x, 458, 96, 68, (d > 0 ? '+' : '−') + Math.abs(d), () => X.setAltura(cm + d), { size: 26 }));
    p.text(`${cm} cm`, 330, 492, { size: 34, mono: true, weight: 700, align: 'center' });
    ([['a1+', 1, 436], ['a5+', 5, 540]] as const).forEach(([id, d, x]) => p.button(id, x, 458, 96, 68, '+' + d, () => X.setAltura(cm + d), { size: 26 }));
    p.button('ap', 652, 458, 348, 68, 'Aplicar altura', () => { this.calibMsg = X.aplicarAltura(); }, { size: 26, active: true });
    p.text(this.calibMsg || 'Fique na postura em que vai jogar e aplique. Fica salvo no perfil.', 24, 552, { size: 21, color: UI.dim, max: 970 });
    if (this.calib > 0) p.button('cal', 24, 576, 470, 60, `Encoste um controle no chão… ${Math.ceil(this.calib)}`, null, { active: true, color: UI.warn, size: 23 });
    else p.button('cal', 24, 576, 470, 60, 'Alternativa: calibrar pelo chão (3 s)', () => { this.calib = 3; this.calibMsg = ''; }, { size: 23 });
    p.button('h0', 510, 576, 240, 60, 'Zerar ajuste', () => { lo.zeroHeight(); this.calibMsg = 'Ajuste zerado.'; }, { size: 23 }); p.button('def', 766, 576, 234, 60, 'Padrões', () => lo.reset(), { size: 23 });
    p.text('Qualidade do VR (vale ao entrar de novo)', 24, 668, { size: 23, color: UI.dim });
    ([['leve', 'Leve (mais FPS)'], ['normal', 'Normal'], ['alta', 'Alta (mais nítida)']] as const).forEach(([k, l], i) => p.button('q' + k, 24 + i * 328, 690, 318, 64, l, () => { s.vrq = k; sv(); }, { active: s.vrq === k, size: 24 }));
  }
  private drawCheck(p: Panel) {
    const ck = this.A.check; ['S', 'L', 'X', 'M'].forEach((g, i) => p.button('g' + g, 16 + i * 92, 100, 84, 56, g, () => { this.group = g; this.page = 0; this.sel = null; }, { active: this.group === g, size: 30 }));
    const list = ITEMS.filter((it) => it.group === this.group), pages = Math.max(1, Math.ceil(list.length / ROWS)); this.page = Math.min(this.page, pages - 1); const c = ck.counts(this.group);
    p.text(`OK ${c.ok}  MAL ${c.mal}  FALHA ${c.falha}  — ${c.nt}`, 400, 128, { size: 22, color: UI.dim, mono: true });
    p.button('pg-', 800, 100, 80, 56, '<', () => { this.page = Math.max(0, this.page - 1); }, { size: 32, disabled: this.page === 0 }); p.text(`${this.page + 1}/${pages}`, 920, 128, { size: 22, align: 'center', mono: true }); p.button('pg+', 960, 100, 56, 56, '>', () => { this.page = Math.min(pages - 1, this.page + 1); }, { size: 32, disabled: this.page >= pages - 1 });
    const chips: [string, string, string][] = [['ok', 'OK', UI.ok], ['mal', 'MAL', UI.warn], ['falha', 'FALHA', UI.bad], ['nt', '—', '#8a949c']];
    list.slice(this.page * ROWS, this.page * ROWS + ROWS).forEach((it, r) => { const y = 166 + r * 66, e = ck.get(it.id), fut = it.fase > FASE;
      p.button('it' + it.id, 16, y, 556, 58, `${it.id}  ${it.name}${fut ? ' (V' + it.fase + ')' : ''}`, () => { this.sel = this.sel === it.id ? null : it.id; }, { align: 'left', size: 23, active: this.sel === it.id, disabled: fut });
      chips.forEach(([k, l, col], j) => p.button(`s${it.id}${k}`, 582 + j * 108, y, 100, 58, l, () => ck.set(it.id, k), { active: e.s === k, color: col, size: 22, disabled: fut })); });
    const y = 640; if (this.sel) { const e = ck.get(this.sel); p.text(`Notas de ${this.sel}:`, 20, y + 4, { size: 22, color: UI.dim }); NOTES.forEach((n, i) => p.button('n' + n, 16 + (i % 3) * 336, y + 26 + Math.floor(i / 3) * 60, 326, 54, n, () => ck.toggleNote(this.sel!, n), { active: e.n.includes(n), color: UI.info, size: 22 })); }
    else p.text('Toque no nome de um item para marcar notas.', 20, y + 30, { size: 22, color: UI.dim });
  }
  private drawDebug(p: Panel) {
    const d = this.A.debug, info = this.A.renderer.info.render;
    p.button('fps', 16, 100, 300, 64, d.showFps ? 'FPS no VR: ligado' : 'FPS no VR: desligado', () => d.setFps(!d.showFps), { active: d.showFps, color: UI.ok, size: 24 });
    p.button('err', 332, 100, 300, 64, 'Gerar erro de teste', () => { setTimeout(() => { throw new Error('erro de teste (S3)'); }, 0); }, { size: 24 });
    p.button('clr', 648, 100, 360, 64, 'Limpar erros e FPS', () => d.clear(), { size: 24 });
    [`FPS ${d.fps.toFixed(1)}   draw calls ${info.calls}   triângulos ${(info.triangles / 1000).toFixed(0)} mil`, `Área ${d.area}   olhos ${this.A.loco.eyeHeight().toFixed(2)} m`, 'FPS médio: ' + (d.fpsTable().map(([k, f]) => `${k} ${f.toFixed(0)}`).join(' · ') || '—')]
      .forEach((l, i) => p.text(l, 20, 196 + i * 38, { size: 24, mono: true, max: p.W - 40 }));
    p.text(`Erros capturados (${d.errors.length}/10)`, 20, 320, { size: 24, color: UI.dim });
    d.errors.slice().reverse().forEach((e, i) => p.text(`[${e.t}] ${e.msg}${e.n > 1 ? ' ×' + e.n : ''}`, 20, 358 + i * 40, { size: 20, mono: true, color: UI.warn, max: p.W - 40 }));
  }
}
export type { Group };
