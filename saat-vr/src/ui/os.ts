// Ordem de serviço, APR, PT, folha de leitura e roteiro (nível básico).
import { h, fmt } from './dom';

export function osDoc(d: any, sess: any): HTMLElement {
  const m = sess.sc?.m; if (!m) return h('div');
  const o = d.os.ordens[m.id] || { numero: m.id, tipo: '—', titulo: m.nome, local: '—', descricao: m.objetivo, epiTarefas: [] };
  const n = String(1000 + (sess.cfg.semente % 9000)); const num = String(o.numero).replace('{n}', n);
  const epi = new Set<string>(), ferr = new Set<string>(); for (const t of o.epiTarefas || []) { for (const i of d.epi.tarefas[t]?.epi || []) epi.add(i); for (const i of d.epi.tarefas[t]?.ferr || []) ferr.add(i); }
  const nome = (i: string) => d.epi.itens.find((x: any) => x.id === i)?.nome || i;
  const dt = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  return h('div', { class: 'osdoc' },
    h('div', { class: 'oshead' }, h('div', {}, h('b', {}, 'SAAT · SE VALE VERDE'), h('small', {}, '138/13,8 kV')), h('div', { class: 'osnum' }, h('small', {}, o.tipo), h('b', {}, num)), h('div', {}, h('small', {}, 'Emissão'), h('b', {}, dt))),
    h('h3', {}, o.titulo),
    h('table', { class: 'ostab' }, h('tr', {}, h('th', {}, 'Local'), h('td', {}, o.local)), h('tr', {}, h('th', {}, 'Executante'), h('td', {}, `${sess.cfg.treinando || '—'}${sess.cfg.matricula ? ' · mat. ' + sess.cfg.matricula : ''}`)), h('tr', {}, h('th', {}, 'Nível'), h('td', {}, sess.nivel ? sess.nivel.nome : '—')), h('tr', {}, h('th', {}, 'Perfil normativo'), h('td', {}, d.profiles[sess.cfg.perfil]?.nome || sess.cfg.perfil))),
    h('h4', {}, 'Descrição do serviço'), h('p', {}, o.descricao), h('p', { class: 'muted' }, 'Objetivo da missão: ' + m.objetivo),
    epi.size ? h('div', {}, h('h4', {}, 'EPI obrigatório'), h('div', { class: 'row' }, ...[...epi].map((i) => h('span', { class: 'chip' }, nome(i))))) : null,
    ferr.size ? h('div', {}, h('h4', {}, 'Ferramentas e EPC'), h('div', { class: 'row' }, ...[...ferr].map((i) => h('span', { class: 'chip' }, 'Ferramenta: ' + nome(i))))) : null,
    o.semAPR ? h('p', { class: 'muted' }, 'Atendimento a ocorrência: sem APR prévia. Registre tudo ao final.') : h('p', {}, h('b', {}, 'APR obrigatória antes de começar'), ' — identifique os riscos e as medidas de controle (tablet: Tab → APR / PT).'),
    h('p', { class: 'muted small' }, 'Modelo genérico de treinamento [VALIDAR com o modelo da empresa].'));
}

export function aprForm(d: any, sess: any, onDone: (r: any) => void): HTMLElement {
  const sel: Record<string, Set<string>> = {}; const out = h('div');
  const all = Object.keys(d.os.controles);
  const opcoes = (r: any) => { let hsh = 0; for (const ch of r.id) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0; const outros = all.filter((c) => !r.controles.includes(c)); const dist = [outros[hsh % outros.length], outros[(hsh * 7 + 3) % outros.length]].filter((x, i, a) => a.indexOf(x) === i);
    return [...r.controles, ...dist].sort((a, b) => ((hsh ^ a.length * 13) % 7) - ((hsh ^ b.length * 13) % 7)); };
  const rows = d.os.riscos.map((r: any) => { const ctl = h('div', { class: 'aprctl hidden' }, ...opcoes(r).map((c: string) => h('label', {}, h('input', { type: 'checkbox', onchange: (e: any) => { e.target.checked ? sel[r.id].add(c) : sel[r.id].delete(c); } }), ' ' + d.os.controles[c])));
    return h('div', { class: 'aprrow' }, h('label', { class: 'aprr' }, h('input', { type: 'checkbox', onchange: (e: any) => { if (e.target.checked) sel[r.id] = new Set(); else delete sel[r.id]; ctl.classList.toggle('hidden', !e.target.checked); } }), ' ', h('b', {}, r.nome)), ctl); });
  const prev = sess.sc?.st.apr;
  return h('div', { class: 'apr' }, h('p', { class: 'muted' }, 'Marque os riscos que existem NESTA tarefa e, para cada um, as medidas de controle corretas. Há medidas erradas misturadas.'), prev ? h('p', { class: prev.ok ? 'okc' : 'bad' }, `APR anterior: ${prev.pct} %`) : null, ...rows,
    h('button', { class: 'hw primary', onclick: () => { const r = sess.apr(Object.fromEntries(Object.entries(sel).map(([k, v]) => [k, [...v]]))); out.innerHTML = '';
      if (r) { const nm = (id: string) => d.os.riscos.find((x: any) => x.id === id)?.nome || id; out.append(h('p', { class: r.ok ? 'okc' : 'bad' }, `APR registrada: ${r.pct} % de acerto${r.ok ? ' — aprovada' : ' — revise'}`), r.faltou.length ? h('p', {}, 'Riscos que faltaram: ' + r.faltou.map(nm).join('; ')) : '', r.sobra.length ? h('p', { class: 'muted' }, 'Marcados sem necessidade: ' + r.sobra.map(nm).join('; ')) : ''); onDone(r); } } }, 'Assinar e registrar a APR'), out);
}

export function ptBox(d: any, sess: any, acao: (id: string) => void) {
  const items = h('div'); const btn = h('button', { class: 'hw primary', onclick: () => { if (!confirm('Emitir a PT e liberar a equipe?')) return; acao('pt_emitir'); } }, 'Emitir a PT e liberar a equipe');
  const tem = !!sess.sc?.m.acoes?.some((a: any) => a.id === 'pt_emitir');
  return { e: tem ? h('section', { class: 'psec' }, h('h4', {}, 'Permissão de trabalho (PT)'), items, btn) : null, set: () => { if (!tem) return; const st = sess.sc.st; items.innerHTML = '';
    for (const it of d.os.pt) { const ok = it.id === 'equipe' ? true : it.id === 'cos' ? !!st.cos[0]?.readback : it.flag ? st.flags[it.flag] != null : it.etapa ? st.etapas[it.etapa] != null : false;
      items.append(h('div', { class: 'ptit ' + (ok ? 'okc' : 'bad') }, ok ? '✓ ' : '✗ ', it.texto)); }
    const emit = st.flags['pt_emitida'] != null; btn.textContent = emit ? 'PT emitida ✓' : 'Emitir a PT e liberar a equipe'; (btn as HTMLButtonElement).disabled = emit; } };
}

export function folha(d: any, sess: any, toast: (m: string, c?: string) => void): HTMLElement | null {
  const L = sess.sc?.m.leituras; if (!L?.length) return null;
  return h('section', { class: 'psec' }, h('h4', {}, 'Folha de leitura'), h('p', { class: 'muted' }, 'Leia no supervisório (Medições/Trafos) ou nos instrumentos locais e anote. A tolerância é a de um instrumento de painel.'),
    ...L.map((x: any) => { const inp = h('input', { type: 'number', step: 'any', class: 'num', placeholder: x.un }) as HTMLInputElement; const st = h('span');
      const upd = () => { const r = sess.sc.st.leituras[x.id]; st.textContent = r ? (r.ok ? ' ✓' : ' ✗') : ''; st.className = r ? (r.ok ? 'okc' : 'bad') : ''; }; upd();
      return h('div', { class: 'flrow' }, h('label', {}, x.label, x.quando ? h('small', { class: 'muted' }, ` (${x.quando})`) : null), h('div', { class: 'row' }, inp, h('small', {}, x.un), h('button', { class: 'hw sm', onclick: () => { const v = parseFloat(inp.value.replace(',', '.')); if (!isFinite(v)) return toast('Digite um número.', 'warn'); const r = sess.leitura(x.id, v); toast(r.msg, r.ok ? 'ok' : 'warn'); upd(); } }, 'Anotar'), st)); }));
}

export function roteiro(sess: any) {
  const ul = h('ol', { class: 'rot' });
  return { e: h('section', { class: 'psec' }, h('h4', {}, 'Roteiro (nível básico)'), ul), set: () => { const sc = sess.sc; if (!sc) return; ul.innerHTML = ''; let next = false;
    for (const c of sc.m.checks) { const ok = sc.st.checks[c.id] != null; const li = h('li', { class: ok ? 'okc' : !next ? 'next' : '' }, (ok ? '✓ ' : '') + c.label); if (!ok && !next) next = true; ul.append(li); } } };
}
export const fmtNota = (x: number) => fmt(x, 1) + ' %';
