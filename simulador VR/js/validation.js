// validation.js — checklist (status + notas), persistência, relatório em texto e o menu de pulso/flutuante
// (estações, locomoção, checklist, debug). O menu é um painel em canvas clicado pelo raio (I18) ou mouse.
import * as THREE from 'three';
import { Panel, UI } from './kit.js';

export const BUILD_PHASE = 2;
const KEY = 'vrlab:checklist';

// grupo S = sistema (menu, debug, relatório, desktop): itens extras, fora da lista original L/I/E
export const ITEMS = [
  ['S1', 'Menu de pulso (palma para cima)', 1], ['S2', 'Menu pelo botão Y / tecla M', 1], ['S3', 'FPS e erros dentro do VR', 1],
  ['S4', 'Relatório 2D (copiar e baixar .txt)', 1], ['S5', 'Modo desktop (mouse + WASD)', 1], ['S6', 'Config: mão dominante (destro/canhoto)', 1], ['S7', 'Config: calibrar chão / zerar altura', 2],
  ['L1', 'Teleporte com arco', 1], ['L2', 'Locomoção contínua', 1], ['L3', 'Snap turn 30°/45°', 1], ['L4', 'Giro suave', 1],
  ['L5', 'Room-scale (andar fisicamente)', 1], ['L6', 'Modo sentado / altura', 1], ['L7', 'Vinheta de conforto', 1], ['L8', 'Teleporte pelo menu', 1], ['L9', 'Correr (clique no polegar de andar)', 1],
  ['I1', 'Pegar direto (grip)', 1], ['I2', 'Pegar à distância (raio + gatilho)', 1], ['I3', 'Arremessar', 1], ['I4', 'Pegar com duas mãos', 1],
  ['I5', 'Segurado colide (não atravessa)', 1], ['I6', 'Peso simulado (atrasa/oscila)', 1], ['I7', 'Botão por poke', 1], ['I8', 'Interruptor liga/desliga', 1],
  ['I9', 'Alavanca 1 eixo com travas', 1], ['I10', 'Válvula pelo pulso', 1], ['I11', 'Manivela', 1], ['I12', 'Slider linear', 1],
  ['I13', 'Porta (dobradiça) e gaveta (trilho)', 1], ['I14', 'Encaixe em soquete', 3], ['I15', 'Ligar cabo entre terminais', 3], ['I16', 'Puxar corda/cabo', 4],
  ['I17', 'Joystick de máquina', 1], ['I18', 'Raio em painéis de UI', 1], ['I19', 'Hand tracking', 5], ['I20', 'Vibração (haptics)', 5],
  ['E0.1', 'Pegada: objetos, prateleira, alvo, prancha, caixa 15 kg', 1], ['E0.2', 'Pegada: botão RESET restaura tudo', 1],
  ['E4.1', 'Botão: LED e contador', 1], ['E4.2', 'Interruptor: LED e ON/OFF', 1], ['E4.3', 'Alavanca: ângulo e travas', 1],
  ['E4.4', 'Válvula: voltas e %', 1], ['E4.5', 'Manivela: rpm e voltas', 1], ['E4.6', 'Slider: %', 1], ['E4.7', 'Porta: ângulo e trinco', 1],
  ['E4.8', 'Gaveta: cm', 1], ['E4.9', 'Joystick: X/Y e volta ao centro', 1], ['E4.10', 'Controles: botão RESET', 1],
  ['E1.1', 'Engrenagens com manivela e relação', 2], ['E1.2', 'Polias simples e compostas', 2], ['E1.3', 'Plano inclinado', 2], ['E1.4', 'Mola com massa', 2],
  ['E1.5', 'Mecânica: botão RESET', 2],
  ['E5.1', 'Biela-manivela', 2], ['E5.2', 'Came e seguidor', 2], ['E5.3', 'Macaco de rosca', 2], ['E5.4', 'Porta com maçaneta e trinco', 2],
  ['E5.5', 'Arquivo: gavetas com objeto dentro', 2], ['E5.6', 'Mecanismos: botão RESET', 2],
  ['E2.1', 'Circuito série', 3], ['E2.2', 'Circuito paralelo', 3], ['E2.3', 'Brilho ∝ corrente', 3], ['E2.4', 'Motor gira', 3],
  ['E2.5', 'Curto queima fusível', 3], ['E2.6', 'Multímetro', 3],
  ['E6.1', 'Caixas 5/20/50 kg', 4], ['E6.2', 'Paleteira', 4], ['E6.3', 'Empilhadeira', 4], ['E6.4', 'Ponte rolante', 4],
  ['E7.1', 'Esteira com velocidade', 4], ['E7.2', 'Desviador por alavanca', 4], ['E7.3', 'Prateleiras endereçadas', 4], ['E7.4', 'Tarefa 10 pedidos', 4],
  ['E3.1', 'Quebra acima do limite', 5], ['E3.2', 'Fragmentos somem em 5 s', 5], ['E3.3', 'Copo derrama', 5], ['E3.4', 'Painel de vidro', 5],
].map(([id, name, phase]) => ({ id, name, phase, group: id[0] }));

export const STATUS = { ok: '✅', mal: '⚠️', falha: '❌', nt: '—' };
export const NOTES = ['enjoo', 'impreciso', 'travou', 'lento', 'não detectou', 'atravessou objeto'];

export class Checklist {
  constructor() {
    this.data = {}; try { this.data = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { }
  }
  get(id) { return this.data[id] || { s: 'nt', n: [] }; }
  set(id, s) { const e = this.get(id); e.s = s; this.data[id] = e; this.save(); }
  toggleNote(id, note) { const e = this.get(id); const i = e.n.indexOf(note); if (i >= 0) e.n.splice(i, 1); else e.n.push(note); this.data[id] = e; this.save(); }
  clear() { this.data = {}; this.save(); }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { } }
  counts(group) {
    const c = { ok: 0, mal: 0, falha: 0, nt: 0 };
    for (const it of ITEMS) if (!group || it.group === group) c[this.get(it.id).s]++;
    return c;
  }
}

// Relatório em texto no formato pedido
export function buildReport(version, check, debug) {
  const d = new Date(), pad = (n) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const L = [`v${version} | ${date}`, '', 'ID | status | notas'];
  for (const it of ITEMS) {
    const e = check.get(it.id);
    L.push(`${it.id} | ${STATUS[e.s]} | ${e.n.length ? e.n.join(', ') : '—'}${it.phase > BUILD_PHASE ? ' (fase ' + it.phase + ')' : ''}`);
  }
  L.push('', 'FPS médio por estação');
  const t = debug.fpsTable(); if (!t.length) L.push('— sem medição');
  for (const [k, f, s] of t) L.push(`${k} | ${f.toFixed(1)} fps | ${Math.round(s)} s`);
  L.push('', 'erros capturados');
  if (!debug.errors.length) L.push('— nenhum');
  for (const e of debug.errors) L.push(`[${e.t}] ${e.msg}${e.n > 1 ? ' (×' + e.n + ')' : ''}`);
  return L.join('\n');
}

// ---------------- Menu ----------------
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
const TABS = [['est', 'Estações'], ['loc', 'Locomoção'], ['cfg', 'Config'], ['chk', 'Checklist'], ['dbg', 'Debug']];
const ROWS = 7;

export class Menu {
  constructor(app) {
    this.app = app; this.check = app.check;
    this.panel = new Panel({ w: 0.64, h: 0.5, px: 1024 });
    this.panel.render = (p) => this.draw(p);
    this.panel.mesh.visible = false; this.mode = null; this.palmT = 0; this.offT = 0;
    this.tab = 'est'; this.group = 'I'; this.page = 0; this.sel = null; this.refreshT = 0; this.calib = 0; this.calibMsg = '';
    app.ix.addPanel(this.panel); app.scene.add(this.panel.mesh);
    app.debug.listeners.add(() => { if (this.tab === 'dbg') this.panel.dirty = true; });
    window.addEventListener('keydown', (e) => {
      if (app.xrActive) return; const a = document.activeElement; if (a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT')) return;
      if (e.code === 'KeyM' || e.code === 'Tab') { e.preventDefault(); this.toggleFloat(); }
      if (e.code === 'Escape' && this.mode) this.hide();
      if (e.code === 'KeyF') app.debug.setFps(!app.debug.showFps);
    });
  }
  hide() { this.mode = null; this.panel.mesh.visible = false; this.panel.clearHover(); }
  toggleFloat() {
    if (this.mode === 'float') { this.hide(); return; }
    const app = this.app, cam = app.camera;
    app.scene.attach(this.panel.mesh);
    cam.getWorldPosition(_v); cam.getWorldDirection(_v2); _v2.y = 0; _v2.normalize();
    this.panel.mesh.position.copy(_v).addScaledVector(_v2, 0.75); this.panel.mesh.position.y -= 0.12;
    this.panel.mesh.lookAt(_v.x, _v.y - 0.05, _v.z); this.panel.mesh.scale.setScalar(1);
    this.mode = 'float'; this.panel.mesh.visible = true; this.panel.dirty = true;
  }
  // menu de pulso: palma esquerda virada para cima e olhando para ela
  wrist(h, dt) {
    if (this.mode === 'float' || !h.connected) { this.palmT = 0; return; }
    if (this.mode === 'wrist' && this.panel.mesh.parent !== h.gripObj) this.hide();   // trocou a mão dominante
    const sx = h.handedness === 'left' ? 1 : -1;                // normal da palma: +X do grip esquerdo, −X do direito [testar]
    _x.set(sx, 0, 0).applyQuaternion(h.quat);
    this.app.camera.getWorldPosition(_v); _v2.copy(h.pos).sub(_v).normalize();
    this.app.camera.getWorldDirection(_z);
    const up = _x.y > 0.6 && _z.dot(_v2) > 0.7;
    if (up) { this.palmT += dt; this.offT = 0; } else { this.offT += dt; this.palmT = 0; }
    if (this.mode !== 'wrist' && this.palmT > 0.25) {
      const m = this.panel.mesh; h.gripObj.add(m);
      // painel: +Z = normal da palma, +Y = direção dos dedos (−Z do grip), +X = Y × Z
      _x.set(0, -sx, 0); _y.set(0, 0, -1); _z.set(sx, 0, 0);
      _m.makeBasis(_x, _y, _z); m.quaternion.setFromRotationMatrix(_m);
      m.position.set(0.07 * sx, 0, -0.12); m.scale.setScalar(0.55);
      this.mode = 'wrist'; m.visible = true; this.panel.dirty = true;
    }
    if (this.mode === 'wrist' && this.offT > 0.4) this.hide();
  }
  update(dt) {
    const app = this.app;
    if (app.xrActive) {
      // menu na mão NÃO dominante: Y (destro) ou B (canhoto); menu de pulso na mesma mão
      const M = app.loco.s.hand === 'left' ? app.ix.hands[1] : app.ix.hands[0];
      if (M.topDown) this.toggleFloat();
      this.wrist(M, dt);
    }
    // contagem da calibração do chão (S7): no fim, usa o controle mais baixo
    if (this.calib > 0) {
      const before = Math.ceil(this.calib); this.calib -= dt;
      if (this.calib <= 0) {
        this.calib = 0; const v = app.loco.calibrateFloor(app.ix.hands);
        this.calibMsg = v === null ? 'Nenhum controle conectado.' : `Chão calibrado: ajuste ${(v >= 0 ? '+' : '') + v.toFixed(2)} m.`;
        app.ix.hands.forEach(h => h.pulse(0.6, 60)); this.panel.dirty = true;
      } else if (Math.ceil(this.calib) !== before) this.panel.dirty = true;
    }
    if (this.mode && (this.tab === 'dbg' || this.tab === 'cfg')) { this.refreshT += dt; if (this.refreshT > 0.5) { this.refreshT = 0; this.panel.dirty = true; } }
    if (this.mode) this.panel.update();
  }

  // ---------- desenho ----------
  draw(p) {
    TABS.forEach(([id, label], i) => p.button('tab' + id, 16 + i * 184, 12, 176, 64, label, () => { this.tab = id; }, { active: this.tab === id, size: 24 }));
    p.text('v' + this.app.version, p.W - 12, 44, { size: 22, color: UI.dim, align: 'right', mono: true });
    p.rect(0, 86, p.W, 2, UI.line);
    if (this.tab === 'est') this.drawStations(p);
    else if (this.tab === 'loc') this.drawLoco(p);
    else if (this.tab === 'cfg') this.drawConfig(p);
    else if (this.tab === 'chk') this.drawCheck(p);
    else this.drawDebug(p);
  }
  drawStations(p) {
    const app = this.app;
    p.text('L8 · Teleporte para estação', 24, 120, { size: 28, color: UI.dim });
    app.stations.forEach((s, i) => {
      const x = 24 + (i % 2) * 496, y = 150 + Math.floor(i / 2) * 92;
      const tag = s.error ? ' · ERRO' : s.loaded ? '' : ` · Fase ${s.phase}`;
      p.button('st' + s.id, x, y, 480, 80, `${s.id}  ${s.name}${tag}`, () => app.goStation(s.id), { size: 28, align: 'left', color: s.error ? UI.bad : null });
    });
    const y = 150 + Math.ceil(app.stations.length / 2) * 92 + 10;
    p.button('home', 24, y, 310, 80, 'Início', () => app.goHome(), { size: 28 });
    p.button('recenter', 350, y, 310, 80, 'Recentrar (L5)', () => app.loco.goHome(), { size: 28 });
    p.button('reset', 676, y, 324, 80, 'Reset estação próxima', () => app.resetNearest(), { size: 26 });
  }
  drawLoco(p) {
    const lo = this.app.loco, s = lo.s, save = () => lo.save();
    const row = (y, label) => p.text(label, 24, y + 32, { size: 28 });
    const tog = (id, y, on, fn) => p.button(id, 760, y, 240, 64, on ? 'Ligado' : 'Desligado', () => { fn(); save(); }, { active: on, color: UI.ok });
    let y = 104;
    row(y, 'L1 Teleporte (polegar dominante à frente)'); tog('tp', y, s.teleport, () => { s.teleport = !s.teleport; }); y += 78;
    row(y, 'L2 Andar (polegar da outra mão)'); tog('ct', y, s.continuous, () => { s.continuous = !s.continuous; }); y += 78;
    row(y, 'Velocidade');
    p.button('sp-', 600, y, 90, 64, '−', () => { s.speed = Math.max(0.5, +(s.speed - 0.25).toFixed(2)); save(); }, { size: 36 });
    p.text(s.speed.toFixed(2) + ' m/s', 795, y + 32, { size: 28, align: 'center', mono: true });
    p.button('sp+', 910, y, 90, 64, '+', () => { s.speed = Math.min(4, +(s.speed + 0.25).toFixed(2)); save(); }, { size: 36 }); y += 78;
    row(y, 'L3/L4 Giro');
    [['snap30', 'Snap 30°'], ['snap45', 'Snap 45°'], ['smooth', 'Suave'], ['off', 'Off']].forEach(([k, l], i) =>
      p.button('tr' + k, 300 + i * 176, y, 168, 64, l, () => { s.turn = k; save(); }, { active: s.turn === k, size: 26 })); y += 78;
    row(y, 'Giro suave');
    p.button('ss-', 600, y, 90, 64, '−', () => { s.smoothSpeed = Math.max(30, s.smoothSpeed - 15); save(); }, { size: 36 });
    p.text(s.smoothSpeed + ' °/s', 795, y + 32, { size: 28, align: 'center', mono: true });
    p.button('ss+', 910, y, 90, 64, '+', () => { s.smoothSpeed = Math.min(180, s.smoothSpeed + 15); save(); }, { size: 36 }); y += 78;
    row(y, 'L7 Vinheta de conforto'); tog('vg', y, s.vignette, () => { s.vignette = !s.vignette; }); y += 78;
    row(y, 'L6 Modo sentado'); tog('se', y, s.seated, () => lo.setSeated(!s.seated, this.app.xrActive)); y += 78;
    row(y, 'Altura extra');
    p.button('h-', 600, y, 90, 64, '−5', () => lo.nudgeHeight(-0.05), { size: 28 });
    p.text((s.manual >= 0 ? '+' : '') + s.manual.toFixed(2) + ' m', 795, y + 32, { size: 28, align: 'center', mono: true });
    p.button('h+', 910, y, 90, 64, '+5', () => lo.nudgeHeight(0.05), { size: 28 }); y += 78;
    p.text('L5 Room-scale: ande fisicamente. "Recentrar" fica na aba Estações.', 24, y + 20, { size: 22, color: UI.dim });
  }
  drawConfig(p) {
    const lo = this.app.loco, s = lo.s, save = () => lo.save();
    p.text('Mão dominante (gira e teleporta; a outra anda, corre e abre o menu)', 24, 124, { size: 24, color: UI.dim });
    p.button('hr', 24, 150, 480, 72, 'Destro (mão direita)', () => { s.hand = 'right'; save(); }, { active: s.hand !== 'left', size: 28 });
    p.button('hl', 520, 150, 480, 72, 'Canhoto (mão esquerda)', () => { s.hand = 'left'; save(); }, { active: s.hand === 'left', size: 28 });
    p.text('L9 Correr: clique o polegar de andar (vale até soltar o polegar)', 24, 262, { size: 24, color: UI.dim });
    p.text(`Velocidade da corrida (${(s.speed * s.run).toFixed(1)} m/s)`, 24, 318, { size: 28 });
    p.button('rn-', 600, 286, 90, 64, '−', () => { s.run = Math.max(1.25, +(s.run - 0.25).toFixed(2)); save(); }, { size: 36 });
    p.text(s.run.toFixed(2) + '×', 795, 318, { size: 28, align: 'center', mono: true });
    p.button('rn+', 910, 286, 90, 64, '+', () => { s.run = Math.min(4, +(s.run + 0.25).toFixed(2)); save(); }, { size: 36 });
    const menuBtn = s.hand === 'left' ? 'B (direita)' : 'Y (esquerda)';
    p.text(`Menu: botão ${menuBtn} ou palma dessa mão para cima.`, 24, 400, { size: 24, color: UI.dim });
    p.text('Desktop: Shift corre.', 24, 436, { size: 24, color: UI.dim });
    // S7 altura: calibração pelo chão real (resolve piso virtual alto/baixo demais)
    p.rect(16, 466, p.W - 32, 2, UI.line);
    p.text(`Altura · olhos ${lo.eyeHeight().toFixed(2)} m · ajuste ${(s.manual >= 0 ? '+' : '') + s.manual.toFixed(2)} m${s.seated ? ' · sentado' : ''}`, 24, 500, { size: 26, mono: true });
    if (this.calib > 0) p.button('cal', 24, 530, 560, 80, `Encoste um controle no chão… ${Math.ceil(this.calib)}`, null, { active: true, color: UI.warn, size: 26 });
    else p.button('cal', 24, 530, 560, 80, 'Calibrar chão (3 s)', () => { this.calib = 3; this.calibMsg = ''; }, { size: 28, disabled: !this.app.xrActive });
    p.button('h0', 600, 530, 400, 80, 'Zerar altura', () => { lo.zeroHeight(); this.calibMsg = 'Altura zerada.'; }, { size: 28 });
    p.text(this.calibMsg || (this.app.xrActive ? 'Toque, abaixe-se e encoste o controle no chão até o fim da contagem.' : 'Calibração só no VR.'), 24, 640, { size: 22, color: UI.dim, max: p.W - 48 });
    p.button('def', 24, 680, 400, 72, 'Restaurar padrões', () => { lo.resetSettings(); }, { size: 26 });
    p.text('v' + this.app.version, 1000, 716, { size: 24, color: UI.dim, align: 'right', mono: true });
  }
  drawCheck(p) {
    const ck = this.check, groups = ['S', 'L', 'I', 'E'];
    groups.forEach((g, i) => p.button('g' + g, 16 + i * 92, 100, 84, 56, g, () => { this.group = g; this.page = 0; this.sel = null; }, { active: this.group === g, size: 30 }));
    const list = ITEMS.filter(it => it.group === this.group), pages = Math.max(1, Math.ceil(list.length / ROWS));
    this.page = Math.min(this.page, pages - 1);
    const c = ck.counts(this.group);
    p.text(`OK ${c.ok}  MAL ${c.mal}  FALHA ${c.falha}  — ${c.nt}`, 400, 128, { size: 24, color: UI.dim, mono: true });
    p.button('pg-', 800, 100, 80, 56, '<', () => { this.page = Math.max(0, this.page - 1); }, { size: 32, disabled: this.page === 0 });
    p.text(`${this.page + 1}/${pages}`, 920, 128, { size: 24, align: 'center', mono: true });
    p.button('pg+', 960, 100, 56, 56, '>', () => { this.page = Math.min(pages - 1, this.page + 1); }, { size: 32, disabled: this.page >= pages - 1 });
    const chips = [['ok', 'OK', UI.ok], ['mal', 'MAL', UI.warn], ['falha', 'FALHA', UI.bad], ['nt', '—', '#8a949c']];
    list.slice(this.page * ROWS, this.page * ROWS + ROWS).forEach((it, r) => {
      const y = 166 + r * 66, e = ck.get(it.id), future = it.phase > BUILD_PHASE;
      const label = `${it.id}  ${it.name}${future ? ' (F' + it.phase + ')' : ''}`;
      p.button('it' + it.id, 16, y, 556, 58, label, () => { this.sel = this.sel === it.id ? null : it.id; }, { align: 'left', size: 23, active: this.sel === it.id, disabled: future });
      chips.forEach(([k, l, col], j) => p.button(`s${it.id}${k}`, 582 + j * 108, y, 100, 58, l, () => ck.set(it.id, k), { active: e.s === k, color: col, size: 22, disabled: future }));
    });
    const y = 640;
    if (this.sel) {
      const e = ck.get(this.sel);
      p.text(`Notas de ${this.sel}:`, 20, y + 4, { size: 24, color: UI.dim });
      NOTES.forEach((n, i) => p.button('n' + n, 16 + (i % 3) * 336, y + 28 + Math.floor(i / 3) * 62, 326, 54, n, () => ck.toggleNote(this.sel, n), { active: e.n.includes(n), color: UI.info, size: 24 }));
    } else p.text('Toque no nome de um item para marcar notas.', 20, y + 30, { size: 24, color: UI.dim });
  }
  drawDebug(p) {
    const app = this.app, d = app.debug;
    p.button('fps', 16, 100, 300, 64, d.showFps ? 'FPS no VR: ligado' : 'FPS no VR: desligado', () => d.setFps(!d.showFps), { active: d.showFps, color: UI.ok, size: 24 });
    p.button('err', 332, 100, 300, 64, 'Gerar erro de teste', () => { setTimeout(() => { throw new Error('erro de teste (S3)'); }, 0); }, { size: 24 });
    p.button('clr', 648, 100, 360, 64, 'Limpar erros e FPS', () => { d.clear(); d.clearFps(); }, { size: 24 });
    const info = app.renderer.info.render;
    const lines = [
      `FPS ${d.fps.toFixed(1)}   draw calls ${info.calls}   triângulos ${(info.triangles / 1000).toFixed(1)}k`,
      `Estação ${d.station}   modo ${app.xrActive ? 'VR' : 'desktop'}   física ${(1 / app.physics.dt).toFixed(0)} Hz`,
      'FPS médio: ' + (d.fpsTable().map(([k, f]) => `${k} ${f.toFixed(0)}`).join(' · ') || '—'),
    ];
    lines.forEach((l, i) => p.text(l, 20, 196 + i * 38, { size: 24, mono: true, max: p.W - 40 }));
    p.text(`Erros capturados (${d.errors.length}/10)`, 20, 320, { size: 26, color: UI.dim });
    d.errors.slice().reverse().forEach((e, i) => p.text(`[${e.t}] ${e.msg}${e.n > 1 ? ' ×' + e.n : ''}`, 20, 360 + i * 42, { size: 21, mono: true, color: UI.warn, max: p.W - 40 }));
  }
}
