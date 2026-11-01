// panel-ui: popups dos painéis. Só leem estado e enviam comandos; nenhuma lógica elétrica aqui.
import { h, sv, fmt } from './dom';
import { createUnifilar } from './unifilar';
import type { Cmd } from '../core/sim';

export interface Ctx {
  view(): any; sim: any; d: any; sc: any;
  cmd(c: Cmd): void; acao(id: string): void; decidir(id: string, op: string): void; relatar(id: string): void;
  tem(flag: string): boolean;
  mesa?: () => boolean; ficha?: (id: string) => void; goTo?: (id: string) => boolean; previa?: (c: Cmd) => any; trend?: () => any[]; sess?: any; leitura?: (ref: string) => void;
}
export interface Panel { title: string; el: HTMLElement; update(v: any): void }
type U = (v: any) => void;

// ---------- componentes ----------
const lamp = (cor: string, txt: string) => { const e = h('div', { class: 'lampw' }, h('span', { class: 'lamp ' + cor }), h('small', {}, txt)); return { e, set: (on: boolean) => e.firstElementChild!.classList.toggle('on', on) }; };
const btn = (txt: string, fn: () => void, cls = '') => h('button', { class: 'hw ' + cls, onclick: fn, type: 'button' }, txt);
const sec = (t: string, ...k: any[]) => h('section', { class: 'psec' }, h('h4', {}, t), ...k);
const row = (...k: any[]) => h('div', { class: 'row' }, ...k);
function lcd() { const e = h('div', { class: 'lcd' }, h('div'), h('div')); return { e, set: (a: string, b: string) => { (e.children[0] as HTMLElement).textContent = a; (e.children[1] as HTMLElement).textContent = b; } }; }
function digital(label: string, unit: string) { const v = h('b'); const e = h('div', { class: 'digi' }, h('small', {}, label), v, h('i', {}, unit)); return { e, set: (x: string, warn = false) => { v.textContent = x; e.classList.toggle('warn', warn); } }; }
function dial(label: string, min: number, max: number, zones: [number, number, string][], unit: string) {
  const W = 120, cx = 60, cy = 56, r = 44; const ang = (x: number) => Math.PI * (1 - (Math.min(max, Math.max(min, x)) - min) / (max - min));
  const svg = sv('svg', { viewBox: `0 0 ${W} 100`, class: 'dial' });
  const arc = (a: number, b: number) => { const p0 = [cx + r * Math.cos(ang(a)), cy - r * Math.sin(ang(a))], p1 = [cx + r * Math.cos(ang(b)), cy - r * Math.sin(ang(b))]; return `M${p0[0]},${p0[1]} A${r},${r} 0 0 1 ${p1[0]},${p1[1]}`; };
  svg.append(sv('path', { d: arc(min, max), class: 'dtrack', fill: 'none' }));
  for (const [a, b, c] of zones) svg.append(sv('path', { d: arc(a, b), stroke: c, 'stroke-width': 6, fill: 'none' }));
  const nd = sv('line', { x1: cx, y1: cy, x2: cx, y2: cy - r + 6, class: 'needle' }); const tx = sv('text', { x: cx, y: 76, class: 'dval' });
  svg.append(nd, sv('circle', { cx, cy, r: 4, class: 'hub' }), tx, sv('text', { x: cx, y: 93, class: 'dlbl' }, label));
  return { e: h('div', { class: 'dialw' }, svg as any), set: (x: number) => { const a = ang(x); nd.setAttribute('x2', String(cx + (r - 6) * Math.cos(a))); nd.setAttribute('y2', String(cy - (r - 6) * Math.sin(a))); tx.textContent = `${fmt(x)} ${unit}`; } };
}
function selector43(ctx: Ctx, id: string) {
  const knob = h('div', { class: 'knob' }); const lbl = h('small');
  const e = h('button', { class: 'sel43', type: 'button', title: `Chave local/remoto ${id}`, onclick: () => { const lr = ctx.view().s.eq[id].lr; ctx.cmd({ t: 'lr', id, to: lr === 'local' ? 'remoto' : 'local' }); } }, h('span', { class: 'lL' }, 'LOC'), knob, h('span', { class: 'lR' }, 'REM'), lbl);
  return { e, set: (v: any) => { const b = v.s.eq[id]; knob.classList.toggle('rem', b.lr === 'remoto'); lbl.textContent = `${id}${b.loto.length ? ' · BLOQ.' : ''}`; } };
}
function lotoBlock(ctx: Ctx, ids: string[]) {
  const list = h('div', { class: 'lotolist' });
  const e = sec('Bloqueio e etiquetagem (LOTO) — cadeado pessoal + etiqueta', row(...ids.map((id) => btn(`Bloquear ${id.startsWith('90-') ? 'OLTC ' + id.slice(3) : id}`, () => ctx.cmd({ t: 'loto', op: 'apply', id }), 'sm'))), list);
  let sig = '';
  return { e, set: (v: any) => {
    const items = ids.flatMap((id) => v.s.eq[id].loto.map((l: any) => ({ id, dono: l.dono })));
    const ns = JSON.stringify(items); if (ns === sig) return; sig = ns; list.innerHTML = '';
    if (!items.length) list.append(h('small', { class: 'muted' }, 'Nenhum cadeado aplicado.'));
    for (const it of items) list.append(h('div', { class: 'lotoitem' }, h('span', { class: 'padlock' }, 'BLOQ.'), `${it.id} — cadeado de ${it.dono}`, btn('Remover', () => ctx.cmd({ t: 'loto', op: 'remove', id: it.id, dono: it.dono }), 'sm ghost')));
  } };
}
function detector(ctx: Ctx, ponto: string, nome: string, classe: string) {
  const out = h('small', { class: 'det' });
  const e = sec(`Detector de tensão ${classe}`, row(btn('Testar detector (fonte de prova)', () => ctx.cmd({ t: 'vtest', passo: 'provar' }), 'sm'), btn(`Medir em ${nome}`, () => ctx.cmd({ t: 'vtest', passo: 'medir', id: ponto }), 'sm')), out);
  return { e, set: (v: any) => { const r = v.s.vtest.rec[ponto]; out.textContent = r ? `Última medição em ${nome}: ${r.result === 'ausente' ? 'AUSÊNCIA de tensão' : 'TENSÃO PRESENTE'} · detector testado antes: ${r.antes ? 'sim' : 'NÃO'} · depois: ${r.depois ? 'sim' : 'NÃO'}${r.valid ? '' : ' · (sem validade)'}` : 'Sem medição registrada.'; } };
}
/** Ações e decisões da missão disponíveis neste local. */
export function missionBlock(ctx: Ctx, local: string): { e: HTMLElement | null; set: U } {
  if (!ctx.sc) return { e: null, set: () => {} };
  const { acoes, decisoes } = ctx.sc.acoesPara(local); if (!acoes.length && !decisoes.length) return { e: null, set: () => {} };
  const bs: [HTMLButtonElement, string][] = [];
  const e = sec('Procedimentos e comunicação', ...acoes.map((a: any) => { const b = btn(a.label, () => ctx.acao(a.id), 'proc'); bs.push([b, a.set || a.id]); return b; }),
    ...decisoes.map((d: any) => h('div', { class: 'decis' }, h('b', {}, d.titulo), ...d.opcoes.map((o: any) => { const b = btn(o.texto, () => { if (confirm(`Confirmar decisão?\n\n${o.texto}`)) ctx.decidir(d.id, o.id); }, 'opt'); bs.push([b, `decisao:${d.id}:${o.id}`]); return b; }))));
  return { e, set: () => { for (const [b, f] of bs) b.classList.toggle('done', ctx.tem(f)); } };
}
function mimicMT(kind: 'al' | 'in' | 'p') {
  const svg = sv('svg', { viewBox: '0 0 120 230', class: 'mimic' });
  const bus = sv('path', { d: kind === 'p' ? 'M10,30 H45 M75,30 H110' : 'M10,30 H110', 'stroke-width': 6 });
  const up = sv('path', { d: kind === 'p' ? '' : 'M60,30 V78', 'stroke-width': 4 });
  const cb = sv('rect', { x: kind === 'p' ? 48 : 48, y: kind === 'p' ? 18 : 80, width: 24, height: 24, rx: 3 });
  const dn = sv('path', { d: kind === 'p' ? '' : 'M60,106 V200', 'stroke-width': 4 });
  const es = sv('path', { d: 'M60,160 H80 L96,150', 'stroke-width': 4, fill: 'none' }); const gnd = sv('path', { d: 'M98,160 V172 M90,172 h16 M93,176 h10 M96,180 h4', 'stroke-width': 2, fill: 'none' });
  svg.append(bus, up, dn, cb); if (kind === 'al') svg.append(es, gnd, sv('path', { d: 'M52,200 L60,214 L68,200', fill: 'none', 'stroke-width': 3, class: 'ld' }));
  if (kind === 'in') svg.append(sv('circle', { cx: 60, cy: 190, r: 12, fill: 'none', 'stroke-width': 3, class: 'trs' }), sv('circle', { cx: 60, cy: 208, r: 12, fill: 'none', 'stroke-width': 3, class: 'trs' }));
  return { e: svg, set: (busOn: boolean, busOn2: boolean, cbSt: string, off: number, cableOn: boolean, earth: boolean | null, gndOn: boolean) => {
    const c = (on: boolean) => (on ? '#f5b041' : '#5d6873');
    bus.setAttribute('stroke', c(busOn)); if (kind === 'p') bus.setAttribute('stroke', c(busOn)), (bus as any).style.stroke = ''; up.setAttribute('stroke', c(busOn));
    if (kind === 'p') { bus.setAttribute('d', 'M10,30 H45'); bus.setAttribute('stroke', c(busOn)); dn.setAttribute('d', 'M75,30 H110'); dn.setAttribute('stroke', c(busOn2)); dn.setAttribute('stroke-width', '6'); }
    else dn.setAttribute('stroke', gndOn ? '#36c46b' : c(cableOn));
    cb.setAttribute('class', 'cbr ' + cbSt); cb.setAttribute('transform', kind === 'p' ? `translate(0,${off})` : `translate(${off},0)`);
    if (earth != null) { es.setAttribute('d', earth ? 'M60,160 H98' : 'M60,160 H80 L96,148'); es.setAttribute('stroke', earth ? '#36c46b' : '#9aa5ad'); gnd.setAttribute('stroke', '#9aa5ad'); }
  } };
}

// ---------- cubículo MT (AL1..AL4, T1M, T2M, P) ----------
export function cubiculo(ctx: Ctx, bay: string): Panel {
  const sim = ctx.sim, d = ctx.d; const brk = '52-' + bay; const def = sim.defs[brk]; const sel = def.lr;
  const isAL = bay.startsWith('AL'), isP = bay === 'P'; const rel = sim.relayByBrk[brk]; const terra = isAL ? '89T-' + bay : null;
  const ups: U[] = [];
  // relé
  const L = lcd(); const leds: Record<string, any> = {};
  const ledNames = isAL ? ['TRIP', '50', '51', '50N', '51N', '79 BLQ', '86', '50BF'] : isP ? ['25 OK', '25 BLQ', 'ΔV', 'ΔTAP'] : ['TRIP', '51', '51G', '50BF', '86BF'];
  const ledBox = h('div', { class: 'leds' }, ...ledNames.map((n) => { const l = lamp(n === 'TRIP' || n.startsWith('86') || n === '50BF' || n.includes('BLQ') ? 'red' : n === '25 OK' ? 'green' : 'amber', n); leds[n] = l; return l.e; }));
  let page = 0;
  const lks = Object.entries<any>(d.protections.bloqueios).filter(([, v]) => v.local === bay).map(([k]) => k);
  const relay = h('div', { class: 'relay' }, h('div', { class: 'rbrand' }, isP ? 'RELÉ 25 — VERIFICAÇÃO DE SINCRONISMO' : `${rel?.nome?.toUpperCase() || ''}`), L.e, ledBox,
    h('div', { class: 'rkeys' }, btn('◄', () => (page = (page + 2) % 3), 'key'), btn('►', () => (page = (page + 1) % 3), 'key'),
      ...lks.map((k) => btn(`RESET ${k}`, () => ctx.cmd({ t: 'reset86', id: k, via: 'local' }), 'key rst')),
      rel?.['79'] ? btn('79 ON/OFF', () => ctx.cmd({ t: 'r79', rele: rel.id, on: !ctx.view().s.rel[rel.id].r79, via: 'local' }), 'key') : null));
  ups.push((v) => {
    const s = v.s, der = v.der, b = s.eq[brk], cc = v.ccOk; relay.classList.toggle('dark', !cc);
    if (isP) {
      const [b1, b2] = ['MT-1', 'MT-2'].map((x) => der.barras[x]); const dV = Math.abs(b1.v - b2.v) * 100, dT = Math.abs(s.tr.T1.tap - s.tr.T2.tap);
      const icc = sim.icc('MT1', '3f', { [brk]: true });
      L.set(cc ? `ΔV ${fmt(dV, 1)}%  ΔTAP ${dT}` : '', cc ? `Icc paral. ${fmt(icc, 1)} kA` : '');
      const ok = b1.energ && b2.energ && dV <= d.params.paralelismo.dVmaxPu * 100 && dT <= d.params.paralelismo.dTapMax;
      leds['25 OK'].set(cc && ok); leds['25 BLQ'].set(cc && !ok && b1.energ && b2.energ); leds['ΔV'].set(cc && dV > 3); leds['ΔTAP'].set(cc && dT > 1);
      return;
    }
    const rt = s.rel[rel.id]; const I = der.I[brk] || 0;
    const pages = [[`IA ${fmt(I)} A`, `52 ${b.state === 'closed' ? 'FECHADO' : 'ABERTO'} ${b.pos ? b.pos.toUpperCase() : ''}`],
      [`79 ${rt.r79 ? 'SERVIÇO' : 'BLOQUEADO'}`, `ciclo: ${rt.ciclo}`],
      [Object.entries<any>(rel.el).map(([k, e]) => `${k}:${e.pickupA}`).slice(0, 2).join(' '), Object.entries<any>(rel.el).map(([k, e]) => `${k}:${e.pickupA}`).slice(2).join(' ')]];
    if (cc) L.set(pages[page][0], pages[page][1]); else L.set('', '');
    const al = rt.alvos;
    for (const n of ledNames) { let on = false;
      if (n === 'TRIP') on = al.length > 0; else if (n === '79 BLQ') on = !rt.r79 || rt.ciclo === 'bloqueado'; else if (n === '86') on = !!s.locks[rel['86']]; else if (n === '50BF' || n === '86BF') on = !!s.locks[rel.bf?.['86']] || lks.some((k) => s.locks[k]); else on = al.includes(n);
      leds[n].set(cc && on); }
  });
  // frente do cubículo
  const lr = selector43(ctx, sel); ups.push(lr.set);
  const lV = lamp('red', 'FECHADO'), lG = lamp('green', 'ABERTO'), lW = lamp('white', 'MOLA'), lA = lamp('amber', 'ALARME');
  const lampsRow = row(lV.e, lG.e, lW.e, lA.e);
  const amp = digital(isP ? 'I 52-P' : 'Corrente', 'A'), kv = digital('Barra', 'kV'); const term = h('div', { class: 'thermo' }, h('small', {}, 'Etiqueta térmica do compartimento de barras'), h('span'));
  const bFechar = btn('FECHAR', () => ctx.cmd({ t: 'switch', id: brk, op: 'close', via: 'local' }), 'push red'); const bAbrir = btn('ABRIR', () => ctx.cmd({ t: 'switch', id: brk, op: 'open', via: 'local' }), 'push green');
  const mim = mimicMT(isAL ? 'al' : isP ? 'p' : 'in');
  const front = h('div', { class: 'face' }, h('div', { class: 'tag' }, isAL ? `ALIMENTADOR ${bay}` : isP ? 'PARALELO 52-P' : `ENTRADA ${bay.replace('M', '')} — 13,8 kV`),
    h('div', { class: 'lv' }, relay, h('div', { class: 'lvctl' }, amp.e, kv.e, lampsRow, row(lr.e, bFechar, bAbrir))), h('div', { class: 'hv' }, mim.e as any, term));
  ups.push((v) => {
    const s = v.s, der = v.der, b = s.eq[brk], cc = v.ccOk, an = s.anomalias || [];
    const burnt = an.includes('lampada_' + bay);
    lV.set(cc && b.state === 'closed' && !burnt); lG.set(cc && b.state === 'open'); lW.set(cc && b.mola); lA.set(cc && (s.alarmes.some((a: any) => a.ativo && a.key.includes(brk)) || !!rel && s.rel[rel.id]?.alvos.length > 0));
    amp.set(fmt(der.I[brk] || 0)); const bus = def.bay === 'P' ? 'MT-1' : (d.topology.substation.voltageLevels[1].bays.find((x: any) => x.id === bay)?.barra || 'MT-1'); kv.set(fmt(der.barras[bus]?.kV || 0, 2));
    (term.lastElementChild as HTMLElement).className = 'tstrip ' + (an.includes('temp_' + bay) ? 'hot' : 'ok'); (term.lastElementChild as HTMLElement).textContent = an.includes('temp_' + bay) ? 'faixa VERMELHA' : 'faixa verde';
    const off = b.pos === 'servico' ? 0 : b.pos === 'teste' ? 10 : 22;
    mim.set(!!der.energ[def.nodes[0]], !!der.energ[def.nodes[1]], b.moving ? 'mov' : b.state, off, !!der.energ[def.nodes[1]], terra ? s.eq[terra].state === 'closed' : null, !!der.gnd[def.nodes[1]]);
  });
  // coluna de comandos
  const posTxt = h('b'); const doorTxt = h('b');
  const col: any[] = [
    sec('Disjuntor extraível (manivela)', row(h('span', {}, 'Posição: '), posTxt), row(btn('▲ Inserir', () => { const p = ctx.view().s.eq[brk].pos; ctx.cmd({ t: 'rack', id: brk, to: p === 'extraido' ? 'teste' : 'servico' }); }, 'sm'), btn('▼ Extrair', () => { const p = ctx.view().s.eq[brk].pos; ctx.cmd({ t: 'rack', id: brk, to: p === 'servico' ? 'teste' : 'extraido' }); }, 'sm')),
      row(h('span', {}, 'Porta: '), doorTxt, btn('Abrir porta', () => ctx.cmd({ t: 'door', id: brk, op: 'open' }), 'sm ghost'), btn('Fechar porta', () => ctx.cmd({ t: 'door', id: brk, op: 'close' }), 'sm ghost'))),
  ];
  ups.push((v) => { const b = v.s.eq[brk]; posTxt.textContent = (b.moving === 'racking' ? 'em movimento…' : { servico: 'SERVIÇO', teste: 'TESTE', extraido: 'EXTRAÍDO' }[b.pos as string]) + (b.falha ? ` · DANIFICADO (${b.falha})` : ''); doorTxt.textContent = b.porta ? 'ABERTA' : 'fechada'; });
  if (terra) { const st = h('b'); col.push(sec(`Chave de terra ${terra} (manual, local)`, row(h('span', {}, 'Estado: '), st), row(btn('Fechar terra', () => ctx.cmd({ t: 'switch', id: terra, op: 'close', via: 'local' }), 'sm'), btn('Abrir terra', () => ctx.cmd({ t: 'switch', id: terra, op: 'open', via: 'local' }), 'sm'))));
    ups.push((v) => { const b = v.s.eq[terra]; st.textContent = b.moving ? 'em manobra…' : b.state === 'closed' ? 'FECHADA (aterrado)' : 'aberta'; });
    const det = detector(ctx, bay + 'c', `cabo de ${bay}`, '13,8 kV'); col.push(det.e); ups.push(det.set); }
  if (bay === 'T1M' || bay === 'T2M') { const node = def.nodes[0]; const det = detector(ctx, node, `lado do trafo (${node})`, '13,8 kV'); col.push(det.e); ups.push(det.set);
    const stg = h('b'); col.push(sec(`Aterramento temporário — lado do trafo (${node})`, row(h('span', {}, 'Estado: '), stg), row(btn('Instalar (terra primeiro, depois fases)', () => ctx.cmd({ t: 'aterr', node, op: 'install' }), 'sm'), btn('Retirar (fases primeiro, terra por último)', () => ctx.cmd({ t: 'aterr', node, op: 'remove' }), 'sm')), h('small', { class: 'muted' }, 'Só depois de seccionar, bloquear e constatar. Instalar em ponto energizado = curto franco.')));
    ups.push((v) => { stg.textContent = v.s.terraTemp?.[node] ? 'INSTALADO' : 'não instalado'; }); }
  { let teste = 0; const msg = h('small', { class: 'muted' }); col.push(sec('Lâmpadas de sinalização', row(btn('Testar lâmpadas', () => { teste = Date.now() + 2500; }, 'sm'), btn('Trocar lâmpada queimada', () => ctx.cmd({ t: 'reparo', alvo: 'lampada_' + bay }), 'sm')), msg));
    ups.push((v) => { const burnt = (v.s.anomalias || []).includes('lampada_' + bay); if (Date.now() < teste) { [lV, lG, lW, lA].forEach((l, i) => l.set(!(burnt && i < 2))); msg.textContent = burnt ? 'Teste: uma lâmpada NÃO acendeu → queimada.' : 'Teste: todas acenderam.'; } }); }
  const lo = lotoBlock(ctx, [brk, sel]); col.push(lo.e); ups.push(lo.set);
  const mb = missionBlock(ctx, bay); if (mb.e) { col.push(mb.e); ups.push(mb.set); }
  if (rel) col.push(h('details', { class: 'psec' }, h('summary', {}, 'Ajustes do relé (somente leitura em missão)'), h('pre', { class: 'mono' }, Object.entries<any>(rel.el).map(([k, e]) => `${k.padEnd(4)} ${JSON.stringify(e).replace(/[{}"]/g, '').replace(/,/g, '  ')}`).join('\n') + (rel['79'] ? `\n79   tentativas ${rel['79'].tentativas}  tempo morto ${rel['79'].tempoMortoS} s  rearme ${rel['79'].rearmeS} s` : '') + (rel.bf ? `\n50BF ${rel.bf.atrasoMs} ms → ${rel.bf['86']} → trip ${rel.bf.trip.join(', ')}` : ''))));
  const sig = h('div', { class: 'signs' }); ups.push(() => { sig.innerHTML = ''; if (isAL && ctx.tem('sinalizacao') && !ctx.tem('sinalizacao_remover')) sig.append(h('span', { class: 'naooperar' }, 'NÃO OPERAR')); if (isAL && ctx.tem('barreira') && !ctx.tem('barreira_remover')) sig.append(h('span', { class: 'barreira' }, 'BARREIRA')); });
  const el = h('div', { class: 'pcub' }, h('div', { class: 'pleft' }, front, sig), h('div', { class: 'pright' }, ...col));
  return { title: isP ? 'Cubículo do paralelo 52-P' : isAL ? `Cubículo ${bay} — alimentador ${bay}` : `Cubículo de entrada ${bay} (52-${bay})`, el, update: (v) => ups.forEach((u) => u(v)) };
}

// ---------- IHM / supervisório ----------
export function ihm(ctx: Ctx): Panel {
  const sim = ctx.sim, d = ctx.d; const menu = h('div', { class: 'cmenu hidden' });
  const uni = createUnifilar(d.layout, sim.defs, sim.nodeLevel, { onEq: (id, ev) => openMenu(id, ev) });
  function openMenu(id: string, ev: MouseEvent) {
    const def = sim.defs[id]; menu.innerHTML = ''; menu.classList.remove('hidden');
    const add = (t: string, c: Cmd) => menu.append(btn(t, () => { menu.classList.add('hidden'); ctx.cmd(c); }, 'sm'));
    menu.append(h('b', {}, id));
    if (def.type === 'CBR' || (def.type === 'DIS' && def.kind !== 'earthing')) { add('Abrir (remoto)', { t: 'switch', id, op: 'open', via: 'remote' }); add('Fechar (remoto)', { t: 'switch', id, op: 'close', via: 'remote' }); }
    if (def.type === 'DIS' && def.kind === 'earthing') menu.append(h('small', {}, 'Chave de terra: só operação local no equipamento.'));
    const rel = sim.relayByBrk[id]; if (rel?.['79']) { add('Bloquear 79', { t: 'r79', rele: rel.id, on: false, via: 'remote' }); add('Liberar 79', { t: 'r79', rele: rel.id, on: true, via: 'remote' }); }
    if (def.type === 'PTR' && def.nodes) { add('OLTC automático', { t: 'oltc', id, modo: 'auto' }); add('OLTC manual', { t: 'oltc', id, modo: 'manual' }); add('TAP ▲ (subir)', { t: 'tap', id, dir: 1 }); add('TAP ▼ (baixar)', { t: 'tap', id, dir: -1 }); }
    menu.append(btn('Fechar menu', () => menu.classList.add('hidden'), 'sm ghost'));
    const r = (uni.el.parentElement as HTMLElement).getBoundingClientRect(); menu.style.left = Math.min(ev.clientX - r.left + 8, r.width - 180) + 'px'; menu.style.top = ev.clientY - r.top + 8 + 'px';
  }
  const alarms = h('div', { class: 'alist' }); const meas = h('table', { class: 'mtab' }); const ev = h('div', { class: 'elist' });
  const mb = missionBlock(ctx, 'IHM');
  const tabs = h('div', { class: 'tabs' }); const body = h('div', { class: 'tabbody' });
  const panes: Record<string, HTMLElement> = { Alarmes: h('div', {}, row(btn('Reconhecer alarmes (ACK)', () => ctx.cmd({ t: 'ack' }), 'sm'), btn('EMERGÊNCIA', () => ctx.cmd({ t: 'emergencia', on: !ctx.view().s.emergencia }), 'sm danger')), alarms), Medições: meas, Eventos: ev };
  if (mb.e) panes['Comunicação'] = mb.e;
  let cur = 'Alarmes';
  const show = (k: string) => { cur = k; body.innerHTML = ''; body.append(panes[k]); [...tabs.children].forEach((c: any) => c.classList.toggle('on', c.textContent === k)); };
  for (const k of Object.keys(panes)) tabs.append(h('button', { class: 'tab', type: 'button', onclick: () => show(k) }, k));
  show('Alarmes');
  let lastSeq = 0, aSig = '';
  const update = (v: any) => {
    const s = v.s, der = v.der; uni.update({ ...v, bloqueios: d.protections.bloqueios }); mb.set(v);
    const al = v.ccOk ? s.alarmes : []; const sig = JSON.stringify(al.map((a: any) => [a.key, a.ativo, a.ack]));
    if (sig !== aSig) { aSig = sig; alarms.innerHTML = ''; if (!v.ccOk) alarms.append(h('div', { class: 'aitem s3' }, 'SUPERVISÓRIO SEM ALIMENTAÇÃO CC')); for (const a of [...al].reverse()) alarms.append(h('div', { class: `aitem s${a.sev} ${a.ack ? 'ack' : ''} ${a.ativo ? '' : 'norm'}` }, h('span', {}, new Date(sim.wallBase + a.t).toLocaleTimeString('pt-BR')), a.text, a.ativo ? '' : ' (normalizado)')); }
    if (cur === 'Medições') { meas.innerHTML = '<tr><th>Grandeza</th><th>Valor</th></tr>' + [
      ...Object.entries<any>(der.barras).map(([k, b]) => [`Tensão ${k}`, b.energ ? `${fmt(b.kV, 2)} kV (${fmt(b.v * 100, 1)} %)` : 'sem tensão']),
      ...['T1', 'T2'].flatMap((T) => [[`${T} carga`, `${fmt(der.tr[T].mva, 2)} MVA · ${fmt(der.tr[T].pct, 1)} % (ONAN ${fmt(der.tr[T].pctONAN, 0)} %)`], [`${T} óleo / enrolamento`, `${fmt(s.tr[T].oleo)} °C / ${fmt(s.tr[T].enrol)} °C · vent. G${s.tr[T].vent}`], [`${T} TAP`, `${s.tr[T].tap > 0 ? '+' : ''}${s.tr[T].tap} (${s.tr[T].modo})`]]),
      ...['AL1', 'AL2', 'AL3', 'AL4'].map((a) => [`Corrente ${a}`, `${fmt(der.I['52-' + a] || 0)} A`]),
      ['CC 125 V', `${fmt(s.cc.v, 1)} V · bateria ${fmt(Math.max(0, s.cc.soc) * 100)} %`], ['QGCA', s.ca.ok ? `CA normal (${s.ca.ats})` : 'SEM CA']].map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join(''); }
    if (cur === 'Eventos' && sim.log.length && sim.log[sim.log.length - 1].seq !== lastSeq) { lastSeq = sim.log[sim.log.length - 1].seq; ev.innerHTML = ''; for (const e of sim.log.slice(-60).reverse()) ev.append(h('div', { class: 'eitem k-' + e.kind + (e.result && e.result !== 'ok' ? ' bad' : '') }, h('span', {}, (e.t / 1000).toFixed(1) + ' s'), h('i', {}, e.actor), e.msg)); }
  };
  const el = h('div', { class: 'pihm' }, h('div', { class: 'unibox' }, uni.el as any, menu), h('div', { class: 'iside' }, tabs, body));
  return { title: 'Supervisório (IHM) — comando REMOTO', el, update };
}

// ---------- painel de proteção (sala de comando) ----------
export function protecao(ctx: Ctx): Panel {
  const d = ctx.d, ups: U[] = [];
  const col = (T: string) => {
    const L = lcd(); const names = ['87T', '63', '63RPS', '26', '49', '50', '51', '86T']; const leds: any = {};
    const lb = h('div', { class: 'leds' }, ...names.map((n) => { const l = lamp(n === '86T' ? 'red' : 'amber', n); leds[n] = l; return l.e; }));
    const lockIds = Object.entries<any>(d.protections.bloqueios).filter(([k, v]) => v.local === 'PROT' && k.includes(T)).map(([k]) => k);
    const r = h('div', { class: 'relay' }, h('div', { class: 'rbrand' }, `PROTEÇÃO DO TRANSFORMADOR ${T} — 87T · 50/51 AT · 63 · 26/49`), L.e, lb, h('div', { class: 'rkeys' }, ...lockIds.map((k) => btn(`RESET ${k}`, () => ctx.cmd({ t: 'reset86', id: k, via: 'local' }), 'key rst'))));
    ups.push((v) => { const s = v.s, cc = v.ccOk, st = s.tr[T], rel = s.rel['REL-' + T + 'A']; r.classList.toggle('dark', !cc);
      L.set(cc ? `IAT ${fmt(v.der.I['52-' + T] || 0, 1)} A  IMT ${fmt(v.der.I['52-' + T + 'M'] || 0)} A` : '', cc ? `Óleo ${fmt(st.oleo)}°C Enr ${fmt(st.enrol)}°C` : '');
      for (const n of names) { let on = false; if (n === '86T') on = !!s.locks['86T-' + T]; else if (n === '50' || n === '51') on = rel.alvos.includes(n); else if (n === '63') on = st.buch > 0 || st.alvos.includes('63'); else on = st.alvos.includes(n); leds[n].set(cc && on); } });
    return r;
  };
  const lt = h('div', { class: 'face small' }, h('div', { class: 'tag' }, 'ENTRADA LT-01 — 52-LT1'), h('div', { class: 'leds' }));
  const ltl = [lamp('red', 'FECHADO'), lamp('green', 'ABERTO'), lamp('amber', 'SF6'), lamp('red', 'LT SEM TENSÃO')]; (lt.lastElementChild as HTMLElement).append(...ltl.map((x) => x.e));
  ups.push((v) => { const b = v.s.eq['52-LT1'], cc = v.ccOk; ltl[0].set(cc && b.state === 'closed'); ltl[1].set(cc && b.state === 'open'); ltl[2].set(cc && b.sf6 > 0); ltl[3].set(cc && !v.der.energ['LINE']); });
  const mb = missionBlock(ctx, 'PROT'); if (mb.e) ups.push(mb.set);
  const el = h('div', { class: 'pprot' }, h('div', { class: 'face' }, h('div', { class: 'tag' }, 'PAINEL DE PROTEÇÃO E CONTROLE — 138 kV'), col('T1'), col('T2')), h('div', { class: 'pright' }, lt, mb.e, h('p', { class: 'muted' }, 'Rearme dos bloqueios 86T/86BF é local, neste painel (I-06). Os relés de alimentador e de entrada MT estão nos cubículos.')));
  return { title: 'Painel de proteção (sala de comando)', el, update: (v) => ups.forEach((u) => u(v)) };
}

// ---------- QGCA / CC ----------
export function cc(ctx: Ctx): Panel {
  const ups: U[] = []; const p = ctx.d.params.cc;
  const lT1 = lamp('red', 'TSA1 → QGCA'), lT2 = lamp('red', 'TSA2 → QGCA'), lCA = lamp('white', 'CA PRESENTE'), lAuto = lamp('amber', 'ATS AUTO');
  const vcc = digital('Barra CC', 'V'), soc = digital('Bateria BB1', '%');
  const lR1 = lamp('green', 'RT1 OK'), lR2 = lamp('green', 'RT2 OK'), lTerra = lamp('red', 'TERRA CC'), lSub = lamp('amber', `< ${p.alarmeV} V`), lCrit = lamp('red', `< ${p.criticoV} V`), lSob = lamp('amber', `> ${p.sobreV} V`);
  const porta = h('b');
  const q = h('div', { class: 'face' }, h('div', { class: 'tag' }, 'QGCA 380/220 V — TRANSFERÊNCIA AUTOMÁTICA (I-13)'), row(lT1.e, lT2.e, lCA.e, lAuto.e),
    row(btn('ATS automático', () => ctx.cmd({ t: 'ats', auto: true }), 'sm'), btn('ATS manual', () => ctx.cmd({ t: 'ats', auto: false }), 'sm'), btn('Transferir p/ TSA1', () => ctx.cmd({ t: 'ats', to: 'TSA1' }), 'sm'), btn('Transferir p/ TSA2', () => ctx.cmd({ t: 'ats', to: 'TSA2' }), 'sm'), btn('Rearmar disjuntor geral', () => ctx.cmd({ t: 'ca' }), 'sm')),
    h('div', { class: 'tag' }, 'SISTEMA 125 Vcc — RT1 / RT2 / BB1 (QDCC)'), row(vcc.e, soc.e), row(lR1.e, lR2.e, lTerra.e, lSub.e, lCrit.e, lSob.e), row(h('span', {}, 'Porta do QDCC: '), porta));
  ups.push((v) => { const s = v.s; lT1.set(s.ca.ok && s.ca.ats === 'TSA1'); lT2.set(s.ca.ok && s.ca.ats === 'TSA2'); lCA.set(s.ca.ok); lAuto.set(s.ca.auto);
    vcc.set(fmt(s.cc.v, 1), s.cc.v < p.alarmeV || s.cc.v > p.sobreV); soc.set(fmt(Math.max(0, s.cc.soc) * 100)); lR1.set(s.cc.rt.RT1 && s.ca.ok); lR2.set(s.cc.rt.RT2 && s.ca.ok);
    lTerra.set(s.cc.terra); lSub.set(s.cc.v < p.alarmeV); lCrit.set(s.cc.v < p.criticoV); lSob.set(s.cc.v > p.sobreV); porta.textContent = s.anomalias.includes('porta_QDCC') ? 'ABERTA' : 'fechada'; });
  const mb = missionBlock(ctx, 'CC'); if (mb.e) ups.push(mb.set);
  return { title: 'Serviços auxiliares: QGCA e sistema CC', el: h('div', { class: 'pcc' }, q, mb.e), update: (v) => ups.forEach((u) => u(v)) };
}

// ---------- bay AT (pátio, comando local) ----------
export function bayAT(ctx: Ctx, bay: string): Panel {
  const sim = ctx.sim; const eqs = sim.d.topology.substation.voltageLevels[0].bays.find((b: any) => b.id === bay).equipment;
  const sel = eqs.find((e: any) => e.type === 'SEL').id; const brk = eqs.find((e: any) => e.type === 'CBR').id; const terra = eqs.find((e: any) => e.kind === 'earthing')?.id;
  const ups: U[] = []; const lr = selector43(ctx, sel); ups.push(lr.set);
  const rows = eqs.filter((e: any) => e.type === 'CBR' || e.type === 'DIS').map((e: any) => {
    const st = h('b'); const lam = lamp('red', ''); const loc = e.commandModes.includes('local');
    ups.push((v) => { const b = v.s.eq[e.id]; st.textContent = b.moving ? 'em manobra…' : b.state === 'closed' ? 'FECHADO' : 'ABERTO'; lam.set(v.ccOk && b.state === 'closed'); st.className = b.state; });
    return h('tr', {}, h('td', {}, lam.e), h('td', {}, e.id, h('small', {}, e.kind === 'earthing' ? ' chave de terra (manual)' : e.type === 'CBR' ? ' disjuntor SF6 145 kV' : ' seccionadora motorizada')), h('td', {}, st),
      h('td', {}, loc ? btn('Abrir', () => ctx.cmd({ t: 'switch', id: e.id, op: 'open', via: 'local' }), 'sm') : '', loc ? btn('Fechar', () => ctx.cmd({ t: 'switch', id: e.id, op: 'close', via: 'local' }), 'sm') : ''));
  });
  const P = ctx.d.params.instrumentos?.sf6 || { nominalBar: 6, est1Bar: 5.4, est2Bar: 5.1 };
  const sf6 = dial('SF6 ' + brk, 4.5, 7, [[4.5, P.est2Bar, '#e5484d'], [P.est2Bar, P.est1Bar, '#f5b041'], [P.est1Bar, 7, '#36c46b']], 'bar');
  const mola = lamp('white', 'MOLA CARREGADA'); const ops = digital('Contador', 'op.');
  ups.push((v) => { const b = v.s.eq[brk]; sf6.set(sim.leitura('sf6:' + brk)?.valor ?? 0); mola.set(v.ccOk && b.mola); ops.set(String(sim.leitura('ops:' + brk)?.valor ?? '—')); });
  const fichas = ctx.ficha ? row(...eqs.filter((e: any) => ['CBR', 'DIS', 'CTR'].includes(e.type)).map((e: any) => btn('ⓘ ' + e.id, () => ctx.ficha!(e.id), 'sm ghost'))) : null;
  const col: any[] = [sec('Comando local do bay (caixa de comando)', row(lr.e, mola.e), h('table', { class: 'baytab' }, ...rows)), sec(`Mecanismo e densímetro do ${brk}`, row(sf6.e, ops.e), h('small', { class: 'muted' }, `Faixas didáticas [VALIDAR]: nominal ${P.nominalBar} bar, alarme (est. 1) < ${P.est1Bar} bar, bloqueio (est. 2) < ${P.est2Bar} bar.`)), fichas ? sec('Fichas técnicas', fichas) : null].filter(Boolean);
  if (terra) { const node = sim.defs[terra].nodes[0]; const det = detector(ctx, node, bay === 'LT1' ? 'lado da linha' : `terminal AT do ${bay.replace('A', '')}`, '145 kV'); col.push(det.e); ups.push(det.set); }
  const tr = bay.match(/^T(\d)A$/); const lo = lotoBlock(ctx, [...eqs.filter((e: any) => (e.type === 'CBR' || e.type === 'DIS') && e.kind !== 'earthing').map((e: any) => e.id), sel, ...(tr ? ['90-T' + tr[1]] : [])]); col.push(lo.e); ups.push(lo.set);
  const mb = missionBlock(ctx, bay); if (mb.e) { col.push(mb.e); ups.push(mb.set); }
  return { title: `Caixa de comando local — bay ${bay === 'LT1' ? 'LT-01' : bay}`, el: h('div', { class: 'pbay' }, ...col), update: (v) => ups.forEach((u) => u(v)) };
}

// ---------- transformador (painel local) ----------
export function trafo(ctx: Ctx, T: string): Panel {
  const pr = ctx.d.protections.trafo, ups: U[] = [];
  const oil = dial('Óleo', 20, 120, [[20, 85, '#36c46b'], [85, 95, '#f5b041'], [95, 120, '#e5484d']], '°C');
  const wnd = dial('Enrolamento', 20, 140, [[20, pr['49'].alarmeC, '#36c46b'], [pr['49'].alarmeC, pr['49'].tripC, '#f5b041'], [pr['49'].tripC, 140, '#e5484d']], '°C');
  const lvl = dial('Nível de óleo (71)', 0, 10, [[0, 2, '#e5484d'], [2, 10, '#36c46b']], '');
  const buch = h('div', { class: 'buch' }, h('small', {}, 'Relé Buchholz (63) — visor'), h('div', { class: 'bvis' }, h('span')));
  const g1 = lamp('green', 'VENT. G1'), g2 = lamp('green', 'VENT. G2'), rps = lamp('red', '63RPS'), fire = h('div', { class: 'fire hidden' }, 'FOGO NO TRANSFORMADOR — não se aproxime');
  const tap = digital('OLTC (90)', ''), load = digital('Carga', 'MVA'), oltcOps = digital('Contador OLTC', 'op.'), nivel = digital('Nível de óleo', '%');
  const vent = lamp('amber', 'VENT. MANUAL');
  ups.push((v) => { const s = v.s.tr[T], t = v.der.tr[T]; oil.set(s.oleo); wnd.set(s.enrol); lvl.set(s.nivel === 'baixo' ? 1.2 : 7.5);
    (buch.querySelector('span') as HTMLElement).style.height = s.buch ? (s.buch === 2 ? '80%' : '40%') : '0%'; g1.set(s.vent >= 1); g2.set(s.vent >= 2); rps.set(s.rps);
    tap.set(`${s.tap > 0 ? '+' : ''}${s.tap} ${s.modo === 'auto' ? 'AUTO' : 'MAN'}${s.travado ? ' (travado)' : ''}${v.s.eq['90-' + T]?.loto.length ? ' · BLOQ.' : ''}`); load.set(`${fmt(t.mva, 2)} (${fmt(t.pct)} %)`, t.pct > 100); fire.classList.toggle('hidden', !s.fogo);
    oltcOps.set(String(s.oltcOps ?? '—')); nivel.set(s.nivel === 'baixo' ? '15' : '62', s.nivel === 'baixo'); vent.set(!!s.ventMan); });
  const mb = missionBlock(ctx, T); if (mb.e) ups.push(mb.set); const loT = lotoBlock(ctx, ['90-' + T]); ups.push(loT.set);
  return { title: `Transformador ${T} — 138/13,8 kV 20/25 MVA (painel local)`, el: h('div', { class: 'ptr' }, fire, h('div', { class: 'face' }, h('div', { class: 'tag' }, `${T} — INSTRUMENTOS`), row(oil.e, wnd.e, lvl.e), row(buch, g1.e, g2.e, rps.e), row(load.e, tap.e,
    btn('OLTC auto', () => ctx.cmd({ t: 'oltc', id: T, modo: 'auto', via: 'local' }), 'sm'), btn('OLTC manual', () => ctx.cmd({ t: 'oltc', id: T, modo: 'manual', via: 'local' }), 'sm'), btn('TAP ▲', () => ctx.cmd({ t: 'tap', id: T, dir: 1, via: 'local' }), 'sm'), btn('TAP ▼', () => ctx.cmd({ t: 'tap', id: T, dir: -1, via: 'local' }), 'sm')),
    row(oltcOps.e, nivel.e, vent.e, btn('Ventilação forçada: LIGAR (manual)', () => ctx.cmd({ t: 'vent', id: T, on: true, via: 'local' }), 'sm'), btn('Ventilação: AUTOMÁTICO', () => ctx.cmd({ t: 'vent', id: T, on: false, via: 'local' }), 'sm'))),
    loT.e, ctx.ficha ? row(btn('ⓘ Ficha técnica do ' + T, () => ctx.ficha!(T), 'sm ghost'), btn('ⓘ FMEA do transformador', () => ctx.ficha!(T), 'sm ghost')) : null, mb.e), update: (v) => ups.forEach((u) => u(v)) };
}

export function emergencia(ctx: Ctx): Panel {
  const st = h('b'); const b = h('button', { class: 'mushroom', type: 'button', onclick: () => ctx.cmd({ t: 'emergencia', on: !ctx.view().s.emergencia }) }, 'EMERGÊNCIA');
  const mb = missionBlock(ctx, 'radio');
  return { title: 'Botoeira de emergência (aciona sirene e sinaleira)', el: h('div', { class: 'pemerg' }, b, h('p', {}, 'Estado: ', st), h('p', { class: 'muted' }, 'Aperte para acionar; aperte de novo para desligar.'), mb.e), update: (v) => { st.textContent = v.s.emergencia ? 'ACIONADA' : 'desligada'; b.classList.toggle('on', v.s.emergencia); mb.set(v); } };
}
export function encontro(ctx: Ctx): Panel {
  const mb = missionBlock(ctx, 'patio');
  return { title: 'Ponto de encontro', el: h('div', { class: 'pemerg' }, h('div', { class: 'meet' }, 'PONTO DE ENCONTRO'), h('p', { class: 'muted' }, 'Em emergência, reúna a equipe aqui e confira a presença.'), mb.e || h('p', {}, 'Sem ações de missão neste local.')), update: (v) => mb.set(v) };
}

export function buildPanel(ctx: Ctx, kind: string, id: string): Panel {
  switch (kind) {
    case 'cub': return cubiculo(ctx, id);
    case 'ihm': return ihm(ctx);
    case 'prot': return protecao(ctx);
    case 'cc': return cc(ctx);
    case 'bay': return bayAT(ctx, id);
    case 'trafo': return trafo(ctx, id);
    case 'emerg': return emergencia(ctx);
    case 'encontro': return encontro(ctx);
  }
  throw new Error('painel ' + kind);
}
