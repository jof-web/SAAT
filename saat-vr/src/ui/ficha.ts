// Ficha técnica "mastigada" do equipamento, instrumentos de campo (leituras) e painéis informativos.
import { h, fmt } from './dom';
import type { Ctx, Panel } from './panels';
import { tipoFicha, descEq } from '../assist/search';
import { diagramaComando } from './ctrldiag';

const sec = (t: string, ...k: any[]) => h('section', { class: 'psec' }, h('h4', {}, t), ...k);
const btn = (t: string, f: () => void, cls = '') => h('button', { class: 'hw ' + cls, type: 'button', onclick: f }, t);

export function fichaPanel(ctx: Ctx, id: string): Panel {
  const sim = ctx.sim, d = ctx.d; const e = sim.defs[id] || { id, type: '?' }; const tf = id === 'T1' || id === 'T2' ? 'trafo' : tipoFicha(e); const f = d.kb.fichas[tf || ''] || {};
  const b = d.plant.bays.find((x: any) => x.eq === id || x.terra === id || x.tc === id); const bayCub = id.match(/^(?:52|43|89T)-(AL\d|T\dM|P)$/);
  const onde = b ? `Pátio 138 kV, posição ${b.id} da planta${b.adaptacao ? ' (posição adaptada, sem marca na planta)' : ''}` : bayCub ? `Casa de comando, EQ-1, cubículo ${bayCub[1]}` : /^T\d$/.test(id) ? `Pátio, ${d.plant.trafos.find((t: any) => t.id === id)?.tag}` : '—';
  const est = h('div', { class: 'fest' }); const ups: ((v: any) => void)[] = [];
  ups.push((v) => { const st = v.s.eq[id]; est.innerHTML = ''; if (st?.state) est.append(h('span', { class: 'big ' + (st.moving ? 'mov' : st.state) }, st.moving ? 'EM TRÂNSITO' : st.state === 'closed' ? 'FECHADO' : 'ABERTO'), st.pos ? h('span', {}, String(st.pos).toUpperCase()) : '', h('span', {}, `${fmt(v.der.I[id] || 0)} A`), st.loto?.length ? h('span', { class: 'bad' }, 'BLOQUEADO: ' + st.loto.map((l: any) => l.dono).join(', ')) : '');
    else if (/^T\d$/.test(id)) est.append(h('span', { class: 'big ' + (v.der.tr[id].energ ? 'closed' : 'open') }, v.der.tr[id].energ ? 'ENERGIZADO' : 'DESENERGIZADO'), h('span', {}, `${fmt(v.der.tr[id].mva, 2)} MVA · TAP ${v.s.tr[id].tap}`)); });
  const regras: any[] = []; const seen = new Set<string>();
  for (const r of d.interlocks.regras) { const a = r.alvo || {}; if (!r.acoes.length) continue; if (a.type && !(Array.isArray(a.type) ? a.type.includes(e.type) : a.type === e.type)) continue; if (a.kind && a.kind !== e.kind) continue; if (a.extraivel && !e.extraivel) continue; if (a.isolador && !sim.isoOf[id]) continue; if (a.paralelo && d.topology.paralelo.disjuntor !== id) continue; if (a.comLR && !e.lr) continue; if (seen.has(r.id + r.msg)) continue; seen.add(r.id + r.msg); regras.push(r); }
  const perm = h('div'); if (e.type === 'CBR' || e.type === 'DIS') ups.push((v) => { void v; perm.innerHTML = ''; for (const op of ['open', 'close']) { const vv = sim.violations(e, [op], { via: e.kind === 'earthing' ? 'local' : 'remote', actor: 'treinando' }); perm.append(h('div', { class: vv.length ? 'bad' : 'okc' }, h('b', {}, op === 'open' ? 'Abrir agora: ' : 'Fechar agora: '), vv.length ? vv.map((x: any) => `${x.id} — ${x.det}`).join(' · ') : 'liberado pelos intertravamentos')); } });
  const rel = sim.relayByBrk?.[id];
  const tarefa = e.type === 'CBR' ? (e.ratings?.classe === 'at' ? 'manobra_local_at' : 'extracao_mt') : e.kind === 'earthing' ? (sim.nodeLevel[e.nodes?.[0]] === 'MT' ? 'aterramento_mt' : 'aterramento_at') : e.type === 'DIS' ? 'manobra_local_at' : /^T\d$/.test(id) ? 'trafo_local' : null;
  const nomeItem = (i: string) => d.epi.itens.find((x: any) => x.id === i)?.nome || i;
  const fm = d.fmea.tipos[tf === 'trafo' ? 'trafo' : tf || ''];
  const prev = h('div'); const diag = e.type === 'CBR' ? diagramaComando(ctx, id) : null; if (diag) ups.push(diag.update);
  const el = h('div', { class: 'ficha' },
    h('div', { class: 'fhead' }, h('div', {}, h('h2', {}, id), h('p', {}, `${descEq(e)} · ${onde}`)), est,
      h('div', { class: 'row' }, ctx.goTo ? btn('Ver no 3D', () => ctx.goTo!(id), 'sm') : null, ctx.previa && (e.type === 'CBR' || (e.type === 'DIS' && e.kind !== 'earthing')) ? btn('Simular ABRIR', () => showPrev('open'), 'sm ghost') : null, ctx.previa && (e.type === 'CBR' || (e.type === 'DIS' && e.kind !== 'earthing')) ? btn('Simular FECHAR', () => showPrev('close'), 'sm ghost') : null)),
    prev,
    h('div', { class: 'fgrid' },
      h('div', {}, f.funcao ? sec('Para que serve', h('p', {}, f.funcao)) : null, f.comoFunciona ? sec('Como funciona', h('p', {}, f.comoFunciona)) : null,
        f.operar ? sec('Como operar (passo a passo)', h('ol', {}, ...f.operar.map((x: string) => h('li', {}, x)))) : null,
        f.leituras ? sec('O que ler em campo', h('ul', {}, ...f.leituras.map((x: string) => h('li', {}, x)))) : null,
        (f.riscos || f.nunca) ? sec('Riscos e proibições', h('ul', {}, ...(f.riscos || []).map((x: string) => h('li', {}, x)), ...(f.nunca || []).map((x: string) => h('li', { class: 'bad' }, 'Nunca: ' + x)))) : null),
      h('div', {}, regras.length ? sec('Intertravamentos que se aplicam', h('ul', {}, ...regras.map((r) => h('li', {}, h('b', {}, r.id + ' '), r.msg))), perm) : null,
        rel ? sec('Proteção associada', h('p', {}, `${rel.nome}: ${Object.entries<any>(rel.el).map(([k, x]) => `${k} (${x.curva ? `curva ${x.curva}, Is ${x.pickupA} A, TMS ${x.tms}` : `${x.pickupA} A instantâneo`})`).join(' · ')}${rel['79'] ? ` · 79: ${rel['79'].tentativas} tentativa, ${rel['79'].tempoMortoS} s` : ''}${rel.bf ? ` · 50BF ${rel.bf.atrasoMs} ms → ${rel.bf['86']}` : ''}`)) : null,
        tarefa ? sec(`EPI para ${d.epi.tarefas[tarefa].nome.toLowerCase()}`, h('ul', {}, ...(d.epi.tarefas[tarefa].epi || []).map((i: string) => h('li', {}, nomeItem(i))), ...(d.epi.tarefas[tarefa].ferr || []).map((i: string) => h('li', {}, 'Ferramenta: ' + nomeItem(i))))) : null,
        fm ? sec(`FMEA — ${fm.nome}`, h('table', { class: 'mtab fmea' }, h('tr', {}, ...['Modo de falha', 'Efeito', 'Como detectar', 'Ação', 'NPR'].map((x) => h('th', {}, x))), ...fm.modos.slice().sort((a: any, b: any) => b.S * b.O * b.D - a.S * a.O * a.D).map((m: any) => h('tr', {}, h('td', {}, h('b', {}, m.modo), h('br'), h('small', {}, m.causa)), h('td', {}, m.efeito), h('td', {}, m.detecta), h('td', {}, m.acao), h('td', {}, String(m.S * m.O * m.D))))), h('small', { class: 'muted' }, 'S × O × D didáticos [VALIDAR].')) : null)),
    diag ? sec('Diagrama funcional de comando (ao vivo)', diag.el) : null);
  function showPrev(op: string) { const p = ctx.previa!({ t: 'switch', id, op, via: e.commandModes?.includes('remote') ? 'remote' : 'local' }); prev.innerHTML = ''; prev.className = 'fpprev ' + (p.alerta ? 'bad' : 'ok'); prev.append(h('b', {}, `Prévia: ${op === 'open' ? 'ABRIR' : 'FECHAR'} ${id} (simulado numa cópia, nada executado)`), h('ul', {}, ...p.linhas.map((l: string) => h('li', {}, l)))); }
  return { title: `Ficha técnica — ${id}`, el, update: (v) => ups.forEach((u) => u(v)) };
}

/** Instrumento de campo (densímetro SF6, contador de operações, contador de para-raios). */
export function leituraPanel(ctx: Ctx, ref: string): Panel {
  const [tipo, alvo] = ref.split(':'); const sim = ctx.sim; const val = h('div', { class: 'instr' }); const nota = h('small', { class: 'muted' });
  const txt: Record<string, string> = { sf6: 'Densímetro de SF6 com contatos de alarme (estágio 1) e bloqueio (estágio 2). Leia o ponteiro e compare com as faixas da placa.', ops: 'Contador mecânico de operações do disjuntor e indicadores de posição (I/O) e de mola. Anote para o plano de manutenção.', pr: 'Contador de descargas do para-raios. Anote e compare com a última ronda: aumento indica surtos (raios/manobras).' };
  const P = ctx.d.params.instrumentos?.sf6 || { nominalBar: 6, est1Bar: 5.4, est2Bar: 5.1 };
  const reg = btn('Registrar no caderno de ronda', () => { const r = sim.leitura(ref); if (r) ctx.cmd({ t: 'anotacao', ref, valor: +r.valor.toFixed(2) } as any); }, 'sm');
  const upd = () => { const r = sim.leitura(ref); if (!r) { val.textContent = '—'; return; } val.innerHTML = '';
    if (tipo === 'sf6') { const ang = (Math.min(7, Math.max(4.5, r.valor)) - 4.5) / 2.5; val.append(h('div', { class: 'gauge' }, h('div', { class: 'gz', style: { background: `conic-gradient(from 225deg, #e5484d 0 ${((P.est2Bar - 4.5) / 2.5) * 270}deg, #f5b041 0 ${((P.est1Bar - 4.5) / 2.5) * 270}deg, #36c46b 0 270deg, transparent 0)` } }), h('div', { class: 'gn', style: { transform: `rotate(${-135 + ang * 270}deg)` } }), h('b', {}, `${fmt(r.valor, 2)} bar`)));
      nota.textContent = `Faixas didáticas [VALIDAR]: nominal ${P.nominalBar} · est. 1 < ${P.est1Bar} · est. 2 < ${P.est2Bar} bar.`; }
    else { val.append(h('div', { class: 'odo' }, ...String(Math.round(r.valor)).padStart(5, '0').split('').map((c) => h('span', {}, c))), h('small', {}, r.nome));
      if (tipo === 'ops') { const b = ctx.view().s.eq[alvo]; val.append(h('div', { class: 'row' }, h('span', { class: 'flag ' + (b.state === 'closed' ? 'fi' : 'fo') }, b.state === 'closed' ? 'I  FECHADO' : 'O  ABERTO'), h('span', { class: 'flag ' + (b.mola ? 'mc' : 'md') }, b.mola ? 'MOLA CARREGADA' : 'MOLA DESCARREGADA'))); } } };
  upd();
  return { title: ref.startsWith('sf6') ? `Densímetro SF6 — ${alvo}` : ref.startsWith('ops') ? `Mecanismo do disjuntor ${alvo}` : `Para-raios ${alvo}`, el: h('div', { class: 'pleit' }, val, h('p', {}, txt[tipo] || ''), nota, reg), update: () => upd() };
}
export function infoPanel(titulo: string, ...linhas: string[]): Panel { return { title: titulo, el: h('div', {}, ...linhas.map((l) => h('p', {}, l))), update: () => {} }; }
