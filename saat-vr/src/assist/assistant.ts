// Assistente SAAT (offline, sem IA): pesquisa por palavra-chave, compara equipamentos, mostra FMEA, EPI, zonas NR-10
// e simula uma manobra antes de executá-la (prévia numa cópia do sim).
import type { Domain } from '../data';
import type { Sim, Cmd } from '../core/sim';
import { h, fmt } from '../ui/dom';
import { Indice, norm, tipoFicha, descEq } from './search';
import { preverManobra } from './preview';

export interface AssistCtx { d: Domain; sim: () => Sim | null; goTo: (id: string) => boolean; ficha: (id: string) => void; scada: (id?: string) => void; sessaoAtiva: () => boolean }

export function createAssistant(ctx: AssistCtx) {
  let idx: Indice | null = null, idxSim: Sim | null = null;
  const index = () => { const s = ctx.sim(); if (!idx || idxSim !== s) { idx = new Indice(ctx.d, s ? s.defs : {}); idxSim = s; } return idx; };
  const msgs = h('div', { class: 'amsgs' });
  const inp = h('input', { placeholder: 'Pergunte: "comparar 52-T1 e 52-T1M", "e se eu abrir 52-P?", "FMEA disjuntor"…', 'aria-label': 'Pergunta ao assistente' }) as HTMLInputElement;
  const chips = ['O que acontece se eu abrir 52-T1M?', 'Comparar 52-T1 e 52-T1M', 'FMEA do transformador', 'EPI para constatação MT', 'Zona de risco 138 kV', 'Onde fica o 89-T1-2?', 'Como extrair o disjuntor do AL1?', 'O que é 50BF?'];
  const el = h('div', { class: 'assist hidden', role: 'dialog', 'aria-label': 'Assistente SAAT' },
    h('header', {}, h('b', {}, 'Assistente SAAT'), h('small', { class: 'muted' }, 'offline · busca na base técnica, não é IA'), h('button', { class: 'x', onclick: () => toggle(false), 'aria-label': 'Fechar' }, '×')),
    msgs, h('div', { class: 'achips' }, ...chips.map((c) => h('button', { class: 'chip btn', onclick: () => ask(c) }, c))),
    h('form', { class: 'aform', onsubmit: (e: Event) => { e.preventDefault(); if (inp.value.trim()) { ask(inp.value.trim()); inp.value = ''; } } }, inp, h('button', { class: 'hw primary', type: 'submit' }, 'Perguntar')));
  function toggle(on?: boolean) { const v = on ?? el.classList.contains('hidden'); el.classList.toggle('hidden', !v); if (v) { if (!msgs.childElementCount) bot(h('div', {}, h('p', {}, 'Pergunte sobre equipamentos, circuitos, EPI, falhas (FMEA), normas e intertravamentos. Também simulo uma manobra antes de você executar: "e se eu fechar 52-P?".'))); setTimeout(() => inp.focus(), 50); } }
  function user(t: string) { msgs.append(h('div', { class: 'amsg u' }, t)); }
  function bot(c: HTMLElement) { msgs.append(h('div', { class: 'amsg b' }, c)); msgs.scrollTop = msgs.scrollHeight; }
  const eqBtns = (id: string) => h('div', { class: 'row' }, h('button', { class: 'hw sm', onclick: () => ctx.ficha(id) }, 'Ficha técnica'), ctx.sessaoAtiva() ? h('button', { class: 'hw sm ghost', onclick: () => { if (!ctx.goTo(id)) bot(h('p', {}, 'Esse item não tem posição no 3D.')); } }, 'Ir até no 3D') : null, ctx.sessaoAtiva() ? h('button', { class: 'hw sm ghost', onclick: () => ctx.scada(id) }, 'Ver no supervisório') : null);

  // ---------- resolução de equipamento ----------
  function ids(q: string): string[] {
    const s = ctx.sim(); const defs: Record<string, any> = s ? s.defs : {}; const all = Object.keys(defs);
    const byNorm = new Map(all.map((i) => [norm(i).replace(/[\s-]/g, ''), i])); const out: string[] = []; const push = (i: string | undefined) => { if (i && defs[i] && !out.includes(i)) out.push(i); };
    const n = norm(q);
    const re = /\b(52|89t|89|43|90|tc|tp)[\s-]?(lt[\s-]?0?1|t1m|t2m|t1a|t2a|al[1-4]|p|t1|t2|b1|b2|tsa[12])(?:[\s-]?([12abc]))?\b/g; let m: RegExpExecArray | null;
    while ((m = re.exec(n))) { const key = (m[1] + m[2].replace(/[\s-]|0(?=1)/g, '') + (m[3] || '')).replace(/[\s-]/g, ''); push(byNorm.get(key) || byNorm.get(key.replace('lt01', 'lt1'))); if (m[1] === '89' && !m[3]) { push(byNorm.get(`89${m[2]}1`)); } }
    for (const b of ctx.d.plant.bays) if (new RegExp(`\\b${b.id.toLowerCase()}\\b`).test(n)) push(b.eq || undefined);
    const tr = n.match(/\b(tr[\s-]?0?([12])|trafo\s?([12])|transformador\s?(t?[12]))\b/); if (tr) push('T' + (tr[2] || tr[3] || tr[4].replace('t', '')));
    if (/\bt([12])\b/.test(n) && !out.length) push('T' + n.match(/\bt([12])\b/)![1]);
    const sem = n.match(/\b(disjuntor|dj|seccionadora|chave de terra|terra)\s(?:do |da |de )?(alimentador\s)?(al[1-4]|paralelo|p|t1m|t2m|lt1|lt[\s-]?01|t1|t2)\b/);
    if (sem && !out.length) { const alvo = sem[3].replace(/lt[\s-]?01/, 'lt1').replace('paralelo', 'p').toUpperCase(); if (sem[1].startsWith('disj') || sem[1] === 'dj') push(['T1', 'T2'].includes(alvo) ? '52-' + alvo : '52-' + alvo); else if (sem[1].includes('terra')) push('89T-' + alvo); else push(`89-${alvo}-1`); }
    if (/\bparalelo\b/.test(n) && !out.length) push('52-P');
    return out;
  }
  const tipoDeTexto = (n: string) => /disjuntor/.test(n) ? (/(mt|vacuo|15 ?kv|al\d|cubiculo)/.test(n) ? 'disjuntor_mt' : 'disjuntor_at') : /seccionadora/.test(n) ? 'seccionadora_at' : /terra/.test(n) ? 'chave_terra' : /(trafo|transformador|oltc|buchholz)/.test(n) ? 'trafo' : /\btc\b|corrente/.test(n) ? 'tc' : /\btp\b|potencial/.test(n) ? 'tp' : /para.?raios/.test(n) ? 'pararaios' : /bateria/.test(n) ? 'bateria' : /retificador/.test(n) ? 'retificador' : /(qgca|ats|auxiliar)/.test(n) ? 'qgca' : /(rele|ied|protecao)/.test(n) ? 'rele' : /cabo/.test(n) ? 'cabo_mt' : null;

  // ---------- respostas ----------
  function ask(q: string) {
    user(q); const n = norm(q); const I = ids(q); const s = ctx.sim();
    try {
      if (/(o que acontece|e se|simular|prever|previa|se eu)\b/.test(n) && /(abr|fech|deslig|liga|extra|inser|aterr|subir|baixar|tap)/.test(n)) return previa(n, I, s);
      if (/(compar|diferenca|\bvs\b|versus)/.test(n) && I.length >= 2) return comparar(I[0], I[1], s);
      if (/(fmea|modos? de falha|falhas? (do|da|de|no|na)|o que pode falhar)/.test(n)) return fmea(I[0] ? tipoFicha(s?.defs[I[0]]) : tipoDeTexto(n));
      if (/(zona|distancia|raio|aproximacao)/.test(n)) return zonas(n);
      if (/\bepi\b|equipamento de protecao|o que vestir|luva|capacete/.test(n) && !I.length) return epi(n);
      if (/(onde fica|onde esta|localiza|posicao)/.test(n) && I.length) return onde(I[0]);
      if (/^(como|passo)/.test(n) && (I.length || tipoDeTexto(n))) return como(I[0] ? tipoFicha(s?.defs[I[0]]) : tipoDeTexto(n), I[0]);
      if (/(estado|status|situacao|esta aberto|esta fechado)/.test(n) && I.length) return estado(I[0], s);
      if (I.length === 1 && n.replace(/[^a-z0-9]/g, '').length <= 10) return estado(I[0], s);
      return busca(q);
    } catch (e: any) { bot(h('p', {}, 'Não consegui responder: ' + e.message)); }
  }
  function previa(n: string, I: string[], s: Sim | null) {
    if (!s) return bot(h('p', {}, 'A prévia precisa de uma sessão aberta (missão ou modo livre).'));
    const id = I[0]; if (!id) return bot(h('p', {}, 'Diga qual equipamento. Ex.: "e se eu abrir 52-T1M?"'));
    const e = s.defs[id], b = s.s.eq[id]; let cmd: Cmd | null = null;
    if (/(subir|baixar|tap)/.test(n) && (e.type === 'PTR' || e.type === 'OLTC')) cmd = { t: 'tap', id: e.trafo || id, dir: /baixar/.test(n) ? -1 : 1 };
    else if (/extra/.test(n) && e.extraivel) cmd = { t: 'rack', id, to: b.pos === 'servico' ? 'teste' : 'extraido' };
    else if (/inser/.test(n) && e.extraivel) cmd = { t: 'rack', id, to: b.pos === 'extraido' ? 'teste' : 'servico' };
    else if (e.type === 'CBR' || e.type === 'DIS') { const op = /(fech|liga|aterr)/.test(n) && !/deslig/.test(n) ? 'close' : 'open'; cmd = { t: 'switch', id, op, via: e.commandModes?.includes('remote') ? 'remote' : 'local' }; }
    if (!cmd) return bot(h('p', {}, `Não sei simular essa manobra em ${id}.`));
    const p = preverManobra(ctx.d, s, cmd);
    const nome = cmd.t === 'rack' ? `mover ${id} para ${String(cmd.to).toUpperCase()}` : cmd.t === 'tap' ? `${(cmd as any).dir > 0 ? 'subir' : 'baixar'} o TAP de ${cmd.id}` : `${cmd.op === 'close' ? 'fechar' : 'abrir'} ${id} (${cmd.via === 'remote' ? 'remoto' : 'local'})`;
    bot(h('div', { class: p.alerta ? 'prev bad' : 'prev ok' }, h('b', {}, `Prévia: ${nome}`), h('small', { class: 'muted' }, ' simulado numa cópia — nada foi executado'),
      h('ul', {}, ...p.linhas.map((l) => h('li', {}, l))), p.regras.length ? h('p', {}, 'Regras: ', ...p.regras.map((r) => h('code', {}, r + ' '))) : null, eqBtns(id)));
  }
  function aplicaveis(e: any, s: Sim) { const out = new Set<string>(); for (const r of ctx.d.interlocks.regras) { const a = r.alvo || {}; if (!r.acoes.length) continue;
      if (a.type && !(Array.isArray(a.type) ? a.type.includes(e.type) : a.type === e.type)) continue; if (a.kind && a.kind !== e.kind) continue; if (a.extraivel && !e.extraivel) continue;
      if (a.isolador && !(s as any).isoOf[e.id]) continue; if (a.paralelo && ctx.d.topology.paralelo.disjuntor !== e.id) continue; if (a.comLR && !e.lr) continue; out.add(r.id); } return [...out]; }
  function linhaEq(id: string, s: Sim | null) {
    const e = s?.defs[id]; const f = ctx.d.kb.fichas[tipoFicha(e) || ''] || {}; const b = s?.s.eq[id]; const rel = s?.relayByBrk[id];
    const fm = (ctx.d.fmea.tipos[tipoFicha(e) || '']?.modos || []).slice().sort((a: any, b: any) => b.S * b.O * b.D - a.S * a.O * a.D).slice(0, 2).map((m: any) => `${m.modo} (NPR ${m.S * m.O * m.D})`).join('; ');
    const tarefa = e?.type === 'CBR' ? (e.ratings?.classe === 'at' ? 'manobra_local_at' : 'extracao_mt') : e?.kind === 'earthing' ? (s?.nodeLevel[e.nodes[0]] === 'MT' ? 'aterramento_mt' : 'aterramento_at') : e?.type === 'DIS' ? 'manobra_local_at' : null;
    const epi = tarefa ? (ctx.d.epi.tarefas[tarefa].epi || []).map((i: string) => ctx.d.epi.itens.find((x: any) => x.id === i)?.nome).join(', ') : '—';
    return { 'Tipo': descEq(e || {}), 'Função': f.funcao || '—', 'Nível': e ? (e.ratings?.classe === 'mt' || s?.nodeLevel[e.nodes?.[0]] === 'MT' ? '13,8 kV' : '138 kV') : '—',
      'Comando': (e?.commandModes || []).map((m: string) => (m === 'remote' ? 'remoto' : 'local')).join(' + ') || '—', 'Estado agora': b ? `${b.state === 'closed' ? 'FECHADO' : b.state === 'open' ? 'ABERTO' : b.lr || '—'}${b.pos ? ' · ' + String(b.pos).toUpperCase() : ''}${b.loto?.length ? ' · BLOQUEADO' : ''}` : '—',
      'Corrente agora': s ? `${fmt(s.der.I[id] || 0)} A` : '—', 'Intertravamentos': e && s ? aplicaveis(e, s).join(', ') || '—' : '—', 'Proteção': rel ? `${rel.nome} (${Object.keys(rel.el).join(', ')}${rel['79'] ? ', 79' : ''})` : e?.type === 'PTR' ? '87T, 63, 63RPS, 26/49, 71' : '—',
      'EPI p/ operar local': epi, 'Falhas mais críticas': fm || '—', 'Nunca': (f.nunca || []).join('; ') || '—' } as Record<string, string>;
  }
  function comparar(a: string, b: string, s: Sim | null) {
    const A = linhaEq(a, s), B = linhaEq(b, s);
    bot(h('div', {}, h('b', {}, `Comparação: ${a} × ${b}`), h('table', { class: 'mtab cmp' }, h('tr', {}, h('th', {}, ''), h('th', {}, a), h('th', {}, b)), ...Object.keys(A).map((k) => h('tr', { class: A[k] !== B[k] ? 'dif' : '' }, h('td', {}, k), h('td', {}, A[k]), h('td', {}, B[k])))),
      h('small', { class: 'muted' }, 'Linhas destacadas = diferença.'), eqBtns(a), eqBtns(b)));
  }
  function fmea(tipo: string | null) {
    const t = tipo && ctx.d.fmea.tipos[tipo]; if (!t) return bot(h('div', {}, h('p', {}, 'FMEA disponível para: '), h('div', { class: 'row' }, ...Object.entries<any>(ctx.d.fmea.tipos).map(([k, v]) => h('button', { class: 'chip btn', onclick: () => { user('FMEA ' + v.nome); fmea(k); } }, v.nome)))));
    const ms = t.modos.slice().sort((a: any, b: any) => b.S * b.O * b.D - a.S * a.O * a.D);
    bot(h('div', {}, h('b', {}, `FMEA — ${t.nome}`), h('small', { class: 'muted' }, ' S×O×D = NPR (valores didáticos [VALIDAR])'),
      h('table', { class: 'mtab fmea' }, h('tr', {}, ...['Componente', 'Modo de falha', 'Causa', 'Efeito', 'Como detectar', 'Ação', 'S', 'O', 'D', 'NPR', 'Simulador'].map((x) => h('th', {}, x))),
        ...ms.map((m: any) => { const npr = m.S * m.O * m.D; return h('tr', { class: npr >= 100 ? 'hi' : '' }, h('td', {}, m.comp), h('td', {}, m.modo), h('td', {}, m.causa), h('td', {}, m.efeito), h('td', {}, m.detecta), h('td', {}, m.acao), h('td', {}, String(m.S)), h('td', {}, String(m.O)), h('td', {}, String(m.D)), h('td', {}, h('b', {}, String(npr))), h('td', {}, (m.falhas || []).join(', ') || '—')); }))));
  }
  function zonas(n: string) {
    const z = ctx.d.kb.nr10Zonas; const num = n.match(/(\d+(?:[.,]\d+)?)\s*kv/) || n.match(/\b(138|13[.,]8|145|15|0[.,]?38|0[.,]?22)\b/);
    const kv = num ? parseFloat(num[1].replace(',', '.')) : null; const rows = kv != null ? z.faixas.filter((f: any) => kv >= f.de && kv < f.ate) : z.faixas.filter((f: any) => (138 >= f.de && 138 < f.ate) || (13.8 >= f.de && 13.8 < f.ate));
    bot(h('div', {}, h('b', {}, 'Zonas de risco e controlada (NR-10)'), h('table', { class: 'mtab' }, h('tr', {}, h('th', {}, 'Faixa (kV)'), h('th', {}, 'Rr — zona de risco'), h('th', {}, 'Rc — zona controlada')),
      ...rows.map((f: any) => h('tr', {}, h('td', {}, `≥ ${f.de} e < ${f.ate}`), h('td', {}, `${fmt(f.rr, 2)} m`), h('td', {}, `${fmt(f.rc, 2)} m`)))),
      h('p', {}, 'Dentro de Rr só entra profissional autorizado, com técnicas e ferramentas próprias de trabalho energizado. Entre Rr e Rc só profissional autorizado. Ative "Zonas NR-10" no HUD para ver as esferas em volta das partes energizadas.'), h('small', { class: 'muted' }, 'Fonte: ' + z.fonte)));
  }
  function epi(n: string) {
    const T = ctx.d.epi.tarefas; const k = /constat/.test(n) ? (/(at|138|145|patio)/.test(n) ? 'constatacao_at' : 'constatacao_mt') : /extra|inser/.test(n) ? 'extracao_mt' : /aterr/.test(n) ? (/(at|138|patio)/.test(n) ? 'aterramento_at' : 'aterramento_mt') : /bateria/.test(n) ? 'bateria' : /patio|ronda/.test(n) ? 'patio' : /(manobra|cubiculo)/.test(n) ? 'manobra_local_mt' : null;
    const nome = (i: string) => ctx.d.epi.itens.find((x: any) => x.id === i)?.nome || i;
    const show = (key: string) => h('div', { class: 'psec' }, h('b', {}, T[key].nome), h('ul', {}, ...(T[key].epi || []).map((i: string) => h('li', {}, nome(i))), ...(T[key].ferr || []).map((i: string) => h('li', {}, 'Ferramenta: ' + nome(i)))));
    bot(h('div', {}, h('b', {}, 'EPI e ferramentas por tarefa'), k ? show(k) : h('div', {}, ...Object.keys(T).slice(0, 8).map(show)), h('small', { class: 'muted' }, ctx.d.epi._niveis)));
  }
  function onde(id: string) {
    const b = ctx.d.plant.bays.find((x: any) => x.eq === id || x.terra === id || x.tc === id); const bay = id.match(/^(?:52|43|89T)-(AL\d|T\dM|P)$/);
    const txt = b ? `${id} está na posição ${b.id} da planta (pátio 138 kV${b.adaptacao ? ', posição adaptada' : ''}).` : bay ? `${id} está no cubículo ${bay[1]} da linha EQ-1 (casa de comando).` : /^T\d$/.test(id) ? `${id} = ${ctx.d.plant.trafos.find((t: any) => t.id === id)?.tag} no pátio, perto da casa de comando.` : `${id}: sem posição física específica.`;
    bot(h('div', {}, h('p', {}, txt), eqBtns(id)));
  }
  function como(tipo: string | null, id?: string) {
    const f = tipo && ctx.d.kb.fichas[tipo]; if (!f) return busca(id || '');
    bot(h('div', {}, h('b', {}, `${f.nome}: como operar`), h('ol', {}, ...(f.operar || []).map((x: string) => h('li', {}, x))), f.nunca ? h('p', { class: 'bad' }, 'Nunca: ' + f.nunca.join('; ')) : null, id ? eqBtns(id) : null));
  }
  function estado(id: string, s: Sim | null) { const L = linhaEq(id, s); bot(h('div', {}, h('b', {}, `${id} — ${L['Tipo']}`), h('table', { class: 'mtab' }, ...['Estado agora', 'Corrente agora', 'Comando', 'Intertravamentos', 'Proteção'].map((k) => h('tr', {}, h('td', {}, k), h('td', {}, L[k])))), eqBtns(id))); }
  function busca(q: string) {
    const r = index().buscar(q, 6); if (!r.length) return bot(h('p', {}, 'Não encontrei nada. Tente outra palavra (ex.: "seccionadora", "86", "inrush", "luva").'));
    bot(h('div', {}, h('small', { class: 'muted' }, `${r.length} resultado(s) na base local`), ...r.map(({ doc }) => h('div', { class: 'ares' }, h('span', { class: 'atag' }, doc.tipo), h('b', {}, doc.titulo), h('p', {}, doc.texto.length > 280 ? doc.texto.slice(0, 280) + '…' : doc.texto),
      doc.tipo === 'equipamento' ? eqBtns(doc.ref) : doc.tipo === 'FMEA' ? h('button', { class: 'hw sm ghost', onclick: () => fmea(doc.ref.tipo) }, 'Ver FMEA completa') : null))));
  }
  return { el, ask, toggle };
}
