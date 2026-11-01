// Interação: mira + E (alcance curto), modo inspeção (câmera aproxima, peças reais clicáveis), cartão lateral com
// estado e procedimentos do local, e a tradução de cada peça em comando do simulador (com ferramenta na mão).
import { Raycaster, Vector2, Vector3, Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { h, fmt } from '../ui/dom';
import { missionBlock } from '../ui/panels';
import { leituraPanel } from '../ui/ficha';
import { ic } from './icons';
import { TOOL_NAMES } from './hands';
import type { Inter, Part } from './common';
import type { Cmd } from '../core/sim';

export interface GameApp {
  W: any; P: any; E: any; hands: any; hud: any; tablet: any; d: any; sess: any; tool: string | null;
  cmd(c: Cmd, quiet?: boolean): any; ctx(): any; setTool(id: string | null): void; sit(): void; sfx: any; livre(): boolean; openFicha(id: string): void; refreshEpi(): void;
  rearOpen: Record<string, boolean>; deaTaken: boolean; takeDea(): void; audio?: any; safety?: any;
}
const LOCAL: Record<string, (id: string) => string> = { cub: (id) => id, cubR: (id) => id, cab: (id) => id, trp: (id) => id, trf: (id) => id, sa: () => 'CC', bat: () => 'CC', ppc: () => 'PROT', scada: () => 'IHM', encontro: () => 'patio', emerg: () => 'radio' };

export class Interaction {
  target: Inter | null = null; insp: Inter | null = null; private vrInsp: Inter | null = null; private vrAsk: ((ops: [string, () => void][]) => void) | null = null; hover: Part | null = null; hoverItem: string | null = null; lastPart: string | null = null;
  private rc = new Raycaster(); private mouse = new Vector2(); private card = h('aside', { class: 'icard hidden' }); private tip = h('div', { class: 'itip hidden' });
  private choice = h('div', { class: 'ichoice hidden' }); private cardUps: (() => void)[] = []; private hl: { m: MeshStandardMaterial; e: number; c: number }[] = [];
  private exitBtn = h('button', { class: 'icard-x', onclick: () => this.exit() }, ic('X', 18));
  constructor(private A: GameApp) {
    document.body.append(this.card, this.tip, this.choice);
    addEventListener('mousemove', (e) => { if (!this.insp) return; this.mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); this.tip.style.left = e.clientX + 16 + 'px'; this.tip.style.top = e.clientY + 14 + 'px'; this.pick(); });
    A.E.canvas.addEventListener('click', (e: MouseEvent) => { if (!this.insp) return; e.stopPropagation(); this.click(e); });
    addEventListener('mousedown', (e) => { if (!this.choice.contains(e.target as Node)) this.choice.classList.add('hidden'); });
  }
  // ---------- mira ----------
  update() {
    if (this.insp) return;
    const A = this.A; if (A.tablet.open || !A.sess || A.P.view) { this.setTarget(null); return; }
    this.rc.setFromCamera(new Vector2(0, 0), A.E.cam); this.rc.far = 7;
    const hits = this.rc.intersectObjects(A.W.inter.filter((i: Inter) => A.W.zones[i.zone].visible).map((i: Inter) => i.hit), false);
    let found: Inter | null = null;
    for (const hh of hits) { const it = A.W.inter.find((i: Inter) => i.hit === hh.object); if (!it) continue; const range = it.range ?? (['eq', 'reserva', 'trafoBody'].includes(it.kind) ? 6 : 1.9); if (hh.distance <= range) { found = it; break; } }
    this.setTarget(found);
  }
  private setTarget(t: Inter | null) {
    this.target = t; const A = this.A; A.hud.setCross(t ? 'target' : A.P.locked ? 'dot' : 'off');
    if (!t) { A.hud.setPrompt(null); return; }
    let verb = t.verb, warn = '';
    if (t.kind === 'door') { const dd = A.W.indoor.doors.find((x: any) => 'door:' + x.id === t.id); verb = dd && dd.tgt > 0.5 ? 'Fechar' : 'Abrir'; }
    if (t.kind === 'gate') verb = (A.W.yard.gates.find((g: any) => 'gate:' + g.id === t.id)?.tgt ?? 0) > 0.5 ? 'Fechar' : 'Abrir';
    if (t.kind === 'arm') { const cb = A.W.indoor.cabinets[t.eq!]; verb = t.eq === 'LOTO' ? 'Usar' : 'Abrir'; void cb; }
    if (t.kind === 'emerg') verb = A.sess.sim.s.emergencia ? 'Desligar' : 'Acionar';
    if (t.kind === 'dea' && A.deaTaken) { verb = 'Devolver'; }
    A.hud.setPrompt({ key: 'E', verb, label: t.label, warn });
  }
  /** Tecla E. */
  use() {
    if (this.insp) { this.exit(); return; } const t = this.target, A = this.A; if (!t || !A.sess) return;
    switch (t.kind) {
      case 'door': { const dd = A.W.indoor.doors.find((x: any) => 'door:' + x.id === t.id); if (!dd) return; const pair = A.W.indoor.doors.filter((x: any) => x.id[0] === dd.id[0]); const open = dd.tgt < 0.5; pair.forEach((x: any) => (x.tgt = open ? 1 : 0)); A.sfx.door?.(open); return; }
      case 'gate': { const g = A.W.yard.gates.find((x: any) => 'gate:' + x.id === t.id); if (g) g.tgt = g.tgt > 0.5 ? 0 : 1; A.sfx.gate?.(); return; }
      case 'emerg': A.cmd({ t: 'emergencia', on: !A.sess.sim.s.emergencia }); return;
      case 'dea': A.takeDea(); return;
      case 'scada': A.sit(); return;
      case 'vitima': A.safety?.rescueCard(); return;
    }
    this.inspect(t);
  }
  inspect(t: Inter) {
    const A = this.A; this.insp = t; A.hud.setPrompt(null); A.hud.setCross('off'); A.P.unlock();
    if (t.view) A.P.goView(t.view.pos, t.view.look, 0.5);
    if (t.kind === 'arm') { const cb = A.W.indoor.cabinets[t.eq!]; if (cb) cb.tgt = 1; A.sfx.door?.(true); }
    if (t.kind === 'bay') { const cb = A.W.yard.cabs[t.eq!]; if (cb) { cb.tgt = 1; A.sfx.door?.(true); } }
    this.buildCard(t); A.hud.setHint('Clique nas peças · E ou Esc para sair');
  }
  exit() {
    const A = this.A, t = this.insp; if (!t) return; this.insp = null; this.unhl(); this.tip.classList.add('hidden'); this.choice.classList.add('hidden'); this.card.classList.add('hidden'); this.cardUps = [];
    if (t.kind === 'arm') { const cb = A.W.indoor.cabinets[t.eq!]; if (cb && t.eq !== 'LOTO') cb.tgt = 0; }
    if (t.kind === 'bay') { const cb = A.W.yard.cabs[t.eq!]; if (cb) cb.tgt = 0; }
    A.P.leaveView(0.35); A.hud.setHint(''); setTimeout(() => A.P.lock(), 50);
  }
  // ---------- peças ----------
  private partsOf(t: Inter) { return this.A.W.parts.filter((p: Part) => p.inter === t.id); }
  private pick() {
    const t = this.insp; if (!t) return; const A = this.A; this.rc.setFromCamera(this.mouse, A.E.cam); this.rc.far = 4;
    let label = '', warn = '', part: Part | null = null, item: string | null = null;
    if (t.kind === 'arm') { const cb = A.W.indoor.cabinets[t.eq!]; const objs = Object.entries<any>(cb.items).filter(([, g]) => g.visible); const hit = this.rc.intersectObjects(objs.map(([, g]) => g), true)[0];
      if (hit) { let o: Object3D | null = hit.object; while (o && !objs.some(([, g]) => g === o)) o = o.parent; const e = objs.find(([, g]) => g === o); if (e) { item = e[0]; const u = A.sess.inv.unit(item); label = `${A.sess.inv.nome(u.item)} (unidade ${u.n})${u.inspecionado ? ' · inspecionado' : ''}`; } } }
    else { const ps = this.partsOf(t); const hit = this.rc.intersectObjects(ps.map((p) => p.hit), false)[0]; if (hit) { part = ps.find((p) => p.hit === hit.object) || null; if (part) { label = part.label; if (part.tool && A.tool !== part.tool && !(part.tool === 'detector_mt' && A.tool === 'detector_at')) warn = `Precisa de: ${TOOL_NAMES[part.tool] || part.tool} na mão`; } } }
    if (part !== this.hover || item !== this.hoverItem) { this.unhl(); this.hover = part; this.hoverItem = item;
      const vis: Object3D[] = part ? part.vis : item ? [A.W.indoor.cabinets[t.eq!].items[item]] : []; for (const v of vis) v.traverse((o: any) => { if (o.isMesh && o.material?.emissive) { const m = o.material as MeshStandardMaterial; if (!o.userData.ownMat) { o.material = m.clone(); o.userData.ownMat = true; } const mm = o.material as MeshStandardMaterial; this.hl.push({ m: mm, e: mm.emissive.getHex(), c: mm.emissiveIntensity }); mm.emissive.setHex(0x5a4400); mm.emissiveIntensity = 1; } }); }
    this.tip.classList.toggle('hidden', !label); this.tip.innerHTML = ''; if (label) this.tip.append(h('b', {}, label), warn ? h('em', {}, warn) : ''); A.E.canvas.style.cursor = label ? 'pointer' : 'default';
  }
  private unhl() { for (const x of this.hl) { x.m.emissive.setHex(x.e); x.m.emissiveIntensity = x.c; } this.hl = []; }
  private click(e: MouseEvent) {
    const A = this.A; if (this.hoverItem) { this.itemCard(this.hoverItem); return; } const p = this.hover; if (!p) return;
    if (p.tool && A.tool !== p.tool && !(p.tool === 'detector_mt' && A.tool === 'detector_at')) {
      const has = A.sess.inv.usar(p.tool); A.hud.toast(has ? `Pegue ${TOOL_NAMES[p.tool]} na mão (teclas 1–9).` : `Você não tem ${TOOL_NAMES[p.tool] || p.tool}. Busque no armário de ferramentas.`, 'warn'); if (!(p.act.startsWith('loto') && this.isMineLocked(p))) return; }
    this.lastPart = p.id; this.act(p, e);
  }
  private isMineLocked(p: Part) { const id = this.lotoId(p); return !!id && this.A.sess.sim.s.eq[id]?.loto?.some((l: any) => l.dono === 'treinando'); }
  private lotoId(p: Part) { const bay = (this.insp || this.vrInsp)?.eq || ''; return p.act === 'loto:52' ? '52-' + bay : p.act === 'loto:43' ? '43-' + bay : p.act === 'loto:43bay' ? this.selOf(bay) : p.data?.id || null; }
  private selOf(bay: string) { return this.A.d.topology.substation.voltageLevels[0].bays.find((b: any) => b.id === bay)?.equipment.find((e: any) => e.type === 'SEL')?.id; }
  private ask(e: MouseEvent, ops: [string, () => void][]) {
    if (this.vrAsk) { this.vrAsk(ops); return; }
    this.choice.innerHTML = ''; for (const [t, f] of ops) this.choice.append(h('button', { class: 'hw', onclick: () => { this.choice.classList.add('hidden'); f(); } }, t));
    this.choice.style.left = e.clientX + 'px'; this.choice.style.top = e.clientY + 'px'; this.choice.classList.remove('hidden');
  }
  private act(p: Part, e: MouseEvent) {
    const A = this.A, s = A.sess.sim.s, bay = (this.insp || this.vrInsp)?.eq || '', brk = '52-' + bay, C = (c: Cmd) => { A.hands.use(); return A.cmd(c); };
    switch (p.act) {
      case 'sel43': { const id = '43-' + bay; C({ t: 'lr', id, to: s.eq[id].lr === 'local' ? 'remoto' : 'local' }); A.sfx.click?.(); break; }
      case 'fechar': C({ t: 'switch', id: brk, op: 'close', via: 'local' }); break;
      case 'abrir': C({ t: 'switch', id: brk, op: 'open', via: 'local' }); break;
      case 'lamptest': { const cu = A.W.indoor.cub[bay]; cu.testeAte = performance.now() + 2500; A.W.update(A.sess.sim.view(), A.sess.sc?.st.flags || {}); const burnt = s.anomalias.includes('lampada_' + bay); A.hud.toast(burnt ? 'Teste: a lâmpada vermelha NÃO acendeu → queimada.' : 'Teste: todas as lâmpadas acenderam.', burnt ? 'warn' : 'ok'); break; }
      case 'lampada': C({ t: 'reparo', alvo: 'lampada_' + bay }); break;
      case 'relay:page': { const cu = A.W.indoor.cub[bay]; cu.page = ((cu.page || 0) + 1) % 3; A.sfx.click?.(); break; }
      case 'relay:reset': { const lks = Object.entries<any>(A.d.protections.bloqueios).filter(([, v]) => v.local === bay).map(([k]) => k); if (!lks.length) { A.hud.toast('Nenhum bloqueio 86 neste relé.', 'muted'); break; } for (const k of lks) C({ t: 'reset86', id: k, via: 'local' }); break; }
      case 'relay:79': { const rel = A.sess.sim.relayByBrk[brk]; if (rel) C({ t: 'r79', rele: rel.id, on: !s.rel[rel.id].r79, via: 'local' }); break; }
      case 'porta': C({ t: 'door', id: brk, op: s.eq[brk].porta ? 'close' : 'open' }); A.sfx.door?.(!s.eq[brk].porta); break;
      case 'rack': { const pos = s.eq[brk].pos; this.ask(e, [['▼ Extrair (anti-horário)', () => { C({ t: 'rack', id: brk, to: pos === 'servico' ? 'teste' : 'extraido' }); }], ['▲ Inserir (horário)', () => { C({ t: 'rack', id: brk, to: pos === 'extraido' ? 'teste' : 'servico' }); }]]); break; }
      case 'terra': { const id = '89T-' + bay; C({ t: 'switch', id, op: s.eq[id].state === 'closed' ? 'open' : 'close', via: 'local' }); break; }
      case 'loto:52': case 'loto:43': case 'loto:43bay': case 'loto:dis': case 'loto:oltc': { const id = this.lotoId(p); if (!id) break; const mine = s.eq[id]?.loto?.some((l: any) => l.dono === 'treinando'); C({ t: 'loto', op: mine ? 'remove' : 'apply', id }); break; }
      case 'vpis': { const cu = A.W.indoor.cub[bay]; const on = cu.vpis.some((l: any) => (l.m.material as MeshStandardMaterial).emissiveIntensity > 0); A.hud.toast(`Indicador de presença de tensão: L1 L2 L3 ${on ? 'ACESAS — cabo energizado' : 'apagadas (não substitui a constatação com detector)'}`, on ? 'warn' : 'muted', 5000); break; }
      case 'vtest': { const node = bay.startsWith('AL') ? bay + 'c' : A.sess.sim.defs[brk]?.nodes?.[0]; C({ t: 'vtest', passo: 'medir', id: node }); break; }
      case 'termo': A.hud.toast(s.anomalias.includes('temp_' + bay) ? 'Etiqueta térmica com faixa VERMELHA: sobreaquecimento no compartimento de barras. Relate.' : 'Etiqueta térmica: faixa verde (normal).', s.anomalias.includes('temp_' + bay) ? 'warn' : 'ok', 5000); break;
      case 'aterr': { const node = bay === 'T1M' ? 'T1m' : 'T2m'; if (A.sess.inv.faltando('aterr_temp_mt').ferr.includes('vara_manobra')) { A.hud.toast('Instalar aterramento temporário exige também a vara de manobra.', 'warn'); break; } C({ t: 'aterr', node, op: s.terraTemp?.[node] ? 'remove' : 'install' }); break; }
      case 'tampa': { const open = !A.rearOpen[bay]; const earth = s.eq['89T-' + bay]?.state === 'closed'; const cu = A.W.indoor.cub[bay];
        if (open && bay.startsWith('AL') && !earth) { A.hud.toast('Intertravamento mecânico: a tampa traseira só sai com a chave de terra 89T FECHADA.', 'bad', 5000); break; }
        A.rearOpen[bay] = open; cu.rearT = open ? 1 : 0; A.sess.marcar(open ? 'tampa_aberta:' + bay : 'tampa_fechada:' + bay, `${open ? 'Removeu' : 'Recolocou'} a tampa traseira do cubículo ${bay}`); A.sfx.click?.(); break; }
      case 'bay:open': C({ t: 'switch', id: p.data.id, op: 'open', via: 'local' }); break;
      case 'bay:close': C({ t: 'switch', id: p.data.id, op: 'close', via: 'local' }); break;
      case 'bay:43': { const id = this.selOf(bay); if (id) C({ t: 'lr', id, to: s.eq[id].lr === 'local' ? 'remoto' : 'local' }); break; }
      case 'dis:open': C({ t: 'switch', id: p.data.id, op: 'open', via: 'local' }); break;
      case 'dis:close': C({ t: 'switch', id: p.data.id, op: 'close', via: 'local' }); break;
      case 'terraAT': { const id = p.data.id; C({ t: 'switch', id, op: s.eq[id].state === 'closed' ? 'open' : 'close', via: 'local' }); break; }
      case 'leitura:sf6': case 'leitura:ops': this.leituraCard(p.data.ref); break;
      case 'tap:+1': C({ t: 'tap', id: p.data.id, dir: 1, via: 'local' }); break;
      case 'tap:-1': C({ t: 'tap', id: p.data.id, dir: -1, via: 'local' }); break;
      case 'oltc': C({ t: 'oltc', id: p.data.id, modo: s.tr[p.data.id].modo === 'auto' ? 'manual' : 'auto', via: 'local' }); break;
      case 'vent': C({ t: 'vent', id: p.data.id, on: !s.tr[p.data.id].ventMan, via: 'local' }); break;
      case 'buch': { const b = s.tr[p.data.id].buch; A.hud.toast(b ? `Buchholz: GÁS ACUMULADO no visor (estágio ${b}). Não rearme sem análise do óleo.` : 'Buchholz: visor cheio de óleo, sem gás.', b ? 'bad' : 'ok', 5000); break; }
      case 'silica': A.hud.toast('Sílica gel: laranja na maior parte (seca). Trocar quando 2/3 ficar verde/incolor.', 'muted', 5000); break;
      case 'ats': { const ca = s.ca; this.ask(e, [['AUTOMÁTICO', () => C({ t: 'ats', auto: true })], ['MANUAL → TSA1', () => { C({ t: 'ats', auto: false }); C({ t: 'ats', to: 'TSA1' }); }], ['MANUAL → TSA2', () => { C({ t: 'ats', auto: false }); C({ t: 'ats', to: 'TSA2' }); }]]); void ca; break; }
      case 'ca:rearme': C({ t: 'ca' }); break;
      case 'ppc:reset': { const lks = Object.entries<any>(A.d.protections.bloqueios).filter(([k, v]) => v.local === 'PROT' && k.includes(p.data.T)).map(([k]) => k); for (const k of lks) C({ t: 'reset86', id: k, via: 'local' }); if (!lks.length) A.hud.toast('Sem bloqueio a rearmar.', 'muted'); break; }
      case 'vtest:LINE': C({ t: 'vtest', passo: 'medir', id: 'LINE' }); break;
      case 'qdcc:porta': if (s.anomalias.includes('porta_QDCC')) C({ t: 'reparo', alvo: 'porta_QDCC' }); else A.hud.toast('Porta do QDCC fechada.', 'muted'); break;
      default: A.hud.toast(p.label, 'muted');
    }
    setTimeout(() => this.cardUps.forEach((u) => u()), 60);
  }
  // ---------- VR: mesma lógica, sem modo inspeção da câmera ----------
  partsOfInter(t: Inter) { return this.partsOf(t); }
  /** Local da missão (procedimentos/decisões) correspondente ao equipamento. */
  localDe(t: Inter) { if ((t as any).kind === 'radio') return 'radio'; const pre = t.id.split(':')[0]; return LOCAL[pre]?.(t.eq || '') || (t.kind === 'cub' ? t.eq || null : null); }
  /** Aciona a peça p do local t (raio + gatilho no VR). Ferramenta exigida sai do cinto se a pessoa tiver. ask = escolha num painel. */
  actVR(t: Inter, p: Part, ask: (ops: [string, () => void][]) => void) {
    const A = this.A; if (!A.sess) return false;
    if (p.tool && A.tool !== p.tool && !(p.tool === 'detector_mt' && A.tool === 'detector_at')) {
      const has = A.sess.inv.usar(p.tool); if (has) { A.setTool(p.tool); A.hud.toast(`${TOOL_NAMES[p.tool] || p.tool} na mão (cinto).`, 'muted', 2000); }
      else { A.hud.toast(`Você não tem ${TOOL_NAMES[p.tool] || p.tool}. Busque no armário de ferramentas.`, 'warn'); if (!(p.act.startsWith('loto') && this.isMineLocked(p))) return false; } }
    this.vrInsp = t; this.vrAsk = ask; this.lastPart = p.id;
    try { this.act(p, null as any); } finally { this.vrInsp = null; this.vrAsk = null; } return true;
  }
  /** Ação direta (portas, emergência, DEA) ou null se o local abre um cartão. */
  useDirect(t: Inter) { if (!['door', 'gate', 'emerg', 'dea'].includes(t.kind)) return false; this.setTarget(t); this.use(); return true; }
  // ---------- cartão lateral ----------
  private buildCard(t: Inter) {
    const A = this.A, c = this.card; c.innerHTML = ''; c.classList.remove('hidden'); this.cardUps = [];
    const st = h('div', { class: 'ic-st' }); c.append(h('header', {}, h('div', {}, h('small', {}, kindName(t.kind)), h('b', {}, t.label)), this.exitBtn), st);
    const sim = A.sess.sim, eq = t.eq;
    const lines = () => this.linhas(t);
    const draw = () => { st.innerHTML = ''; for (const [k, v, cls] of lines()) st.append(h('div', { class: 'ic-row' }, h('span', {}, k), h('b', { class: cls ? 'c-' + cls : '' }, v))); };
    draw(); this.cardUps.push(draw);
    // procedimentos/decisões da missão neste local
    const pre = t.id.split(':')[0]; const loc = LOCAL[pre]?.(eq || '') || (t.kind === 'cub' ? eq : null);
    if (loc && A.sess.sc) { const mb = missionBlock(A.ctx(), loc); if (mb.e) { c.append(mb.e); mb.set(null); this.cardUps.push(() => mb.set(null)); } }
    if (t.kind === 'leitura') { this.leituraCard(t.data.ref, true); }
    if (t.kind === 'reserva') c.append(h('p', { class: 'muted' }, 'Vão montado sem linha conectada (interpretação da planta: 1 linha). Sem efeito elétrico.'));
    if (t.kind === 'arm') { const lst = h('div', { class: 'ic-items' }); c.append(h('p', { class: 'muted' }, 'Clique no item (na prateleira ou na lista). Inspecione antes de usar: pode haver defeito.'), lst, this.epiConf()); const draw2 = () => this.itemList(lst, t.eq!); draw2(); this.cardUps.push(draw2); }
    const ficha = eq && A.sess.sim.defs[t.kind === 'cub' || t.kind === 'cubR' ? '52-' + eq : eq] ? (t.kind === 'cub' || t.kind === 'cubR' ? '52-' + eq : eq) : /^T\d$/.test(eq || '') ? eq : null;
    const tools = h('div', { class: 'ic-foot' }); if (ficha) tools.append(h('button', { class: 'hw sm ghost', onclick: () => A.openFicha(ficha!) }, ic('BookOpen', 15), ' Ficha técnica'));
    tools.append(h('span', { class: 'muted' }, h('kbd', {}, 'E'), ' / ', h('kbd', {}, 'Esc'), ' sair')); c.append(tools);
  }
  /** Estado do local em linhas [rótulo, valor, cor]. */
  linhas(t: Inter): [string, string, string?][] { const A = this.A, sim = A.sess.sim, eq = t.eq, s = sim.s, der = sim.der; const L: [string, string, string?][] = [];
      if (t.kind === 'cub' || t.kind === 'cubR') { const b = s.eq['52-' + eq]; if (b) { L.push(['Disjuntor', b.state === 'closed' ? 'FECHADO' : 'ABERTO', b.state === 'closed' ? 'r' : 'g'], ['Posição', String(b.pos).toUpperCase()], ['Chave 43', String(s.eq['43-' + eq]?.lr || '—').toUpperCase()], ['Corrente', `${fmt(der.I['52-' + eq] || 0)} A`]); if (s.eq['89T-' + eq]) L.push(['Terra 89T', s.eq['89T-' + eq].state === 'closed' ? 'FECHADA' : 'aberta', s.eq['89T-' + eq].state === 'closed' ? 'g' : '']); if (b.loto.length) L.push(['Bloqueio', b.loto.map((l: any) => l.dono).join(', '), 'w']); if (t.kind === 'cubR') L.push(['Tampa traseira', A.rearOpen[eq!] ? 'REMOVIDA' : 'instalada', A.rearOpen[eq!] ? 'r' : '']); } }
      else if (t.kind === 'bay') { const bay = A.d.topology.substation.voltageLevels[0].bays.find((b: any) => b.id === eq); for (const e of bay?.equipment || []) if (e.type === 'CBR' || e.type === 'DIS') { const b = s.eq[e.id]; L.push([e.id, b.moving ? 'em manobra' : b.state === 'closed' ? 'FECHADO' : 'ABERTO', b.state === 'closed' ? 'r' : 'g']); } const sel = this.selOf(eq!); if (sel) L.push(['43 do bay', String(s.eq[sel].lr).toUpperCase()]); }
      else if (t.kind === 'trafo' || t.kind === 'trafoBody') { const tr = s.tr[eq!], dt = der.tr[eq!]; L.push(['Estado', dt.energ ? 'ENERGIZADO' : 'desenergizado', dt.energ ? 'r' : ''], ['Carga', `${fmt(dt.mva, 2)} MVA (${fmt(dt.pct)} %)`], ['Óleo / enrol.', `${fmt(tr.oleo)} / ${fmt(tr.enrol)} °C`], ['TAP', `${tr.tap > 0 ? '+' : ''}${tr.tap} · ${tr.modo === 'auto' ? 'AUTO' : 'MANUAL'}`], ['Ventilação', `G${tr.vent}${tr.ventMan ? ' (manual)' : ''}`]); }
      else if (t.kind === 'eq' || t.kind === 'mec' || t.kind === 'secmot' || t.kind === 'terraAT') { const b = s.eq[eq!]; if (b) L.push(['Estado', b.moving ? 'em manobra' : b.state === 'closed' ? 'FECHADO' : 'ABERTO', b.state === 'closed' ? 'r' : 'g'], ['Corrente', `${fmt(der.I[eq!] || 0)} A`]); if (b?.sf6) L.push(['SF6', `estágio ${b.sf6}`, 'r']); if (b?.loto?.length) L.push(['Bloqueio', b.loto.map((l: any) => l.dono).join(', '), 'w']); }
      else if (t.kind === 'cc') { L.push(['CA (QGCA)', s.ca.ok ? `normal · ${s.ca.ats}` : 'SEM CA', s.ca.ok ? '' : 'r'], ['ATS', s.ca.auto ? 'automático' : 'manual'], ['Barra CC', `${fmt(s.cc.v, 1)} V`, s.cc.v < A.d.params.cc.alarmeV ? 'r' : ''], ['Bateria', `${fmt(Math.max(0, s.cc.soc) * 100)} %`]); if (s.cc.terra) L.push(['Terra CC', 'ATUADO', 'r']); }
      else if (t.kind === 'prot') { for (const T of ['T1', 'T2']) L.push([`86T-${T}`, s.locks['86T-' + T] ? 'ATUADO' : 'normal', s.locks['86T-' + T] ? 'r' : '']); }
      return L; }
  private itemList(box: HTMLElement, local: string) {
    const A = this.A, inv = A.sess.inv; const sig = JSON.stringify(inv.units.map((u: any) => [u.comigo, u.inspecionado, u.descartado])); if ((box as any)._sig === sig) return; (box as any)._sig = sig; box.innerHTML = '';
    const locs = local === 'EPI' ? ['EPI', 'FERR', 'EPIQ'] : [local]; const us = inv.units.filter((u: any) => locs.includes(inv.def(u.item).local) && !u.descartado);
    for (const u of us) { const it = inv.def(u.item);
      box.append(h('div', { class: 'ic-it' + (u.comigo ? ' on' : '') }, h('span', {}, h('b', {}, it.nome), h('small', {}, `unid. ${u.n} · ${u.comigo ? 'com você' : 'no armário'}${u.inspecionado ? ' · inspecionado' : ''}`)),
        u.comigo ? h('button', { class: 'hw sm ghost', onclick: () => { A.hud.toast(A.sess.epi('devolver', u.uid).txt, 'muted'); const g = A.W.indoor.cabinets[local]?.items[u.uid]; if (g) g.visible = true; A.refreshEpi(); } }, 'Devolver')
          : h('button', { class: 'hw sm', onclick: () => this.itemCard(u.uid) }, 'Ver'))); }
  }
  private epiConf() { const A = this.A, m = A.sess.cfg.missao, tar = (m && A.d.epi.missao[m]) || []; if (!tar.length) return h('span');
    return h('button', { class: 'hw sm', onclick: () => { const x = A.sess.conferirEpi(); A.hud.toast(x.txt, x.ok ? 'ok' : 'warn', 6000); A.refreshEpi(); } }, ic('ClipboardCheck', 15), ' Conferir EPI para a tarefa'); }
  private itemCard(uid: string) {
    const A = this.A, inv = A.sess.inv, u = inv.unit(uid), it = inv.def(u.item); const box = h('section', { class: 'psec ic-item' }); this.card.querySelector('.ic-item')?.remove();
    const res = h('p', { class: 'epires' });
    const pegar = () => { const r = A.sess.epi('pegar', uid); A.hud.toast(r.txt, 'ok'); const g = A.W.indoor.cabinets[this.insp!.eq!].items[uid]; if (g) g.visible = false; A.refreshEpi(); box.remove(); A.sfx.click?.(); };
    box.append(h('b', {}, `${it.nome} · unidade ${u.n}`), h('p', {}, it.serve), h('details', {}, h('summary', {}, 'Como inspecionar'), h('p', {}, it.inspecao), it.atpv ? h('p', {}, 'ATPV: ' + it.atpv) : ''), res,
      h('div', { class: 'row' }, h('button', { class: 'hw sm', onclick: () => { const r = A.sess.epi('inspecionar', uid); res.textContent = r.txt; res.className = 'epires ' + (r.ok ? 'okc' : 'bad'); } }, 'Inspecionar'),
        h('button', { class: 'hw sm primary', onclick: pegar }, it.cat?.startsWith('EPI') ? 'Vestir' : 'Pegar'),
        h('button', { class: 'hw sm ghost', onclick: () => { if (!u.inspecionado || !u.defeito) { A.hud.toast('Só separe item inspecionado e reprovado.', 'muted'); return; } A.hud.toast(A.sess.epi('descartar', uid).txt, 'warn'); const g = A.W.indoor.cabinets[this.insp!.eq!].items[uid]; if (g) g.visible = false; box.remove(); } }, 'Separar (defeito)')));
    this.card.insertBefore(box, this.card.querySelector('.ic-foot'));
  }
  private leituraCard(ref: string, inline = false) {
    const A = this.A; const p = leituraPanel(A.ctx(), ref); const sec = h('section', { class: 'psec ic-lt' }, h('h4', {}, p.title), p.el); this.card.querySelector('.ic-lt')?.remove(); this.card.insertBefore(sec, this.card.querySelector('.ic-foot') || null); this.cardUps.push(() => p.update(A.sess.sim.view())); void inline;
  }
  tick() { if (this.insp) this.cardUps.forEach((u) => u()); }
}
function kindName(k: string) { return ({ cub: 'Cubículo 13,8 kV', cubR: 'Cubículo — traseira', bay: 'Caixa de comando local', trafo: 'Painel local do transformador', trafoBody: 'Transformador de potência', eq: 'Equipamento 138 kV', mec: 'Mecanismo do disjuntor', secmot: 'Acionamento da seccionadora', terraAT: 'Chave de terra 138 kV', cc: 'Serviços auxiliares', prot: 'Proteção e controle', arm: 'Armário', leitura: 'Instrumento de campo', reserva: 'Vão reserva', encontro: 'Ponto de encontro', info: 'Painel', cubinfo: 'Cubículo' } as any)[k] || ''; }
export { Vector3, Mesh };
