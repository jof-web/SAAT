// Tela inicial: modos separados (Treinamento, Avaliação, Emergência e resgate, Prática livre, Resultados, Instrutor),
// treinando ativo e configurações. A subestação gira ao fundo.
import { h, sv, fmt, download, LS } from '../ui/dom';
import { ic } from './icons';
import * as TR from '../train/trainees';
import { perfHTML } from '../ui/perf';
import type { SessionCfg } from '../scenario/session';
import type { Quality } from './engine';

export interface HomeOpts {
  d: () => any; start: (c: SessionCfg) => void; resume?: () => void; teste: () => void; dados: () => void; diag: () => void;
  modal: (t: string, b: HTMLElement, wide?: boolean) => any; toast: (m: string, k?: string) => void; quality: (q: Quality, auto: boolean) => void; instrutor: () => void; audio: (v: number, voz: boolean) => void;
  vr: { status: () => { ok: boolean; motivo: string }; entrar: (c: SessionCfg) => Promise<boolean>; relatorio: () => void; versao: string; listen: (f: () => void) => void };
}
const MODES: [string, string, string, string][] = [
  ['treino', 'Treinamento', 'GraduationCap', 'Missões guiadas por nível'], ['avaliacao', 'Avaliação', 'ClipboardCheck', 'Prova sem dicas, nota oficial'],
  ['emergencia', 'Emergência e resgate', 'HeartPulse', 'Choque, tensão de passo, incêndio'], ['livre', 'Prática livre', 'Compass', 'Explore e opere sem nota'],
  ['resultados', 'Resultados', 'ChartColumn', 'Evolução e relatórios'], ['admin', 'Administração', 'ShieldCheck', 'Pessoas, ranking e dados'], ['instrutor', 'Instrutor', 'Users', 'Turma e console'],
];
export function mountHome(root: HTMLElement, o: HomeOpts) {
  const d = o.d(); let mode = LS.get('homeMode', 'treino'); let selId: string | null = LS.get('selTreinando', null); if (!selId || !TR.obter(selId)) selId = TR.listar()[0]?.id || null;
  const cfg: any = { perfil: 'nr10_vigente', modo: 'autonomo', semente: 1, exigirEpi: true, liberarTudo: false, livreErros: true, ...(LS.get('homeCfg', {}) || {}) }; const save = () => LS.set('homeCfg', cfg);
  let adminOk = false; const vrBox = h('div', { class: 'hm-vr' });
  let nivelSel = LS.get('homeNivel', null);
  const main = h('main', { class: 'hm-main' }), nav = h('nav', { class: 'hm-nav' }), who = h('div', { class: 'hm-who' });
  root.innerHTML = ''; root.append(h('div', { class: 'hm' }, h('aside', { class: 'hm-side' },
    h('div', { class: 'hm-brand' }, h('b', {}, 'SAAT'), h('span', {}, 'Simulador de Atividades', h('br'), 'de Alta Tensão'), h('small', { class: 'mono hm-ver' }, o.vr.versao)), who, vrBox, nav,
    h('div', { class: 'hm-foot' }, o.resume ? h('button', { class: 'hw primary', onclick: o.resume }, ic('Play', 16), ' Voltar à sessão') : null, h('button', { class: 'hw ghost', onclick: settings }, ic('Settings', 16), ' Configurações'),
      h('small', {}, 'SE Vale Verde · 138/13,8 kV · offline'))), main));
  const T = () => (selId ? TR.obter(selId) : null);
  function renderWho() {
    const t = T(); who.innerHTML = '';
    who.append(h('small', {}, 'Usuário'), t ? h('div', { class: 'hm-tr' }, h('span', { class: 'av' }, t.nome.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase()), h('span', {}, h('b', {}, t.nome), h('small', {}, t.funcao)))
      : h('div', { class: 'hm-tr' }, h('span', { class: 'av' }, 'V'), h('span', {}, h('b', {}, 'Visitante'), h('small', {}, 'resultados não são salvos'))),
      h('button', { class: 'hw sm ghost', onclick: () => { LS.set('logado', null); adminOk = false; login(); } }, ic('LogOut', 14), ' Trocar usuário'));
  }
  function renderVr() {
    const st = o.vr.status(); vrBox.innerHTML = '';
    vrBox.append(h('button', { class: 'hw vr lg', disabled: !st.ok, onclick: () => o.vr.entrar(startCfg(null, { livreErros: cfg.livreErros })) }, ic('Headset', 20), ' Entrar em VR'),
      h('small', {}, st.ok ? 'Abre a prática livre no óculos. Para missões, use "Iniciar em VR" na ordem de serviço.' : st.motivo), h('button', { class: 'hw sm ghost', onclick: o.vr.relatorio }, ic('FileText', 14), ' Relatório do VR'));
  }
  o.vr.listen(renderVr);
  /** Tela de entrada: escolher o usuário (lembrado neste aparelho), visitante, cadastro ou administração. */
  function login() {
    const box = h('div', { class: 'login' }); root.querySelector('.login')?.remove(); root.append(box); const list = h('div', { class: 'plist' });
    const go = (id: string | null) => { selId = id; LS.set('selTreinando', id); LS.set('logado', id || 'visitante'); box.remove(); renderWho(); render(); };
    const draw = (q = '') => { list.innerHTML = ''; for (const t of TR.listar().filter((x) => !q || (x.nome + x.matricula).toLowerCase().includes(q.toLowerCase()))) list.append(h('button', { class: 'prow pmain', onclick: () => go(t.id) }, h('span', { class: 'av' }, t.nome.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase()), h('span', {}, h('b', {}, t.nome), h('small', {}, `${t.funcao}${t.matricula ? ' · ' + t.matricula : ''}`))));
      if (!list.childElementCount) list.append(h('p', { class: 'muted' }, 'Nenhum usuário cadastrado. Use "Cadastrar" ou entre como visitante.')); };
    box.append(h('div', { class: 'lcard' }, h('div', { class: 'hm-brand' }, h('b', {}, 'SAAT'), h('span', {}, 'Simulador de Atividades de Alta Tensão'), h('small', { class: 'mono hm-ver' }, o.vr.versao)),
      h('h2', {}, 'Quem vai treinar?'), h('input', { placeholder: 'Buscar por nome ou matrícula', oninput: (e: any) => draw(e.target.value) }), list,
      h('div', { class: 'row' }, h('button', { class: 'hw', onclick: () => form(null, (x) => go(x.id)) }, ic('Plus', 15), ' Cadastrar'), h('button', { class: 'hw ghost', onclick: () => go(null) }, ic('LogIn', 15), ' Entrar como visitante'),
        h('button', { class: 'hw ghost', onclick: () => pedirPin(() => { go(selId); mode = 'admin'; LS.set('homeMode', mode); renderNav(); render(); }) }, ic('KeyRound', 15), ' Administração'))));
    draw();
  }
  function pedirPin(ok: () => void) {
    if (adminOk) { ok(); return; } const inp = h('input', { type: 'password', inputmode: 'numeric', placeholder: 'PIN do administrador' }) as HTMLInputElement; const msg = h('p', { class: 'muted' }, 'PIN padrão: 1234 (troque em Administração › Dados).');
    const tryIt = () => { if (inp.value === String(LS.get('adminPin', '1234'))) { adminOk = true; document.querySelectorAll('.modal').forEach((m) => m.remove()); ok(); } else msg.textContent = 'PIN incorreto.'; };
    inp.addEventListener('keydown', (e: any) => { if (e.key === 'Enter') tryIt(); });
    o.modal('Administração', h('div', {}, h('div', { class: 'form' }, h('label', {}, 'PIN', inp)), msg, h('div', { class: 'row' }, h('button', { class: 'hw primary', onclick: tryIt }, 'Entrar')))); setTimeout(() => inp.focus(), 50);
  }
  function renderNav() { nav.innerHTML = ''; for (const [k, n, i, s] of MODES) nav.append(h('button', { class: 'hm-mode' + (k === mode ? ' on' : ''), onclick: () => { const go = () => { mode = k; LS.set('homeMode', k); renderNav(); render(); }; if (k === 'admin') pedirPin(go); else go(); } }, ic(i, 20, 1.6), h('span', {}, h('b', {}, n), h('small', {}, s)))); }
  const startCfg = (missao: string | null, extra: any = {}): SessionCfg => { const t = T(); return { missao, perfil: cfg.perfil, modo: cfg.modo, semente: cfg.semente, treinando: t?.nome || 'Visitante', treinandoId: t?.id, matricula: t?.matricula, funcao: t?.funcao, sandbox: !missao, exigirEpi: cfg.exigirEpi, ...extra }; };
  const M = (id: string) => d.missions.missoes.find((x: any) => x.id === id);
  const best = (t: any, m: string) => { const rs = (t?.resultados || []).filter((r: any) => r.missao === m); return rs.length ? { n: rs.length, best: Math.max(...rs.map((r: any) => r.nota)), ok: rs.some((r: any) => r.aprovado) } : null; };
  function missionCard(id: string, onGo: () => void, lock = false, tag = '') {
    const m = M(id), t = T(), b = best(t, id), dur = Math.round((m.tempoPrevistoS || 600) / 60);
    return h('div', { class: 'mc' + (lock ? ' lock' : '') }, h('div', { class: 'mc-top' }, h('span', { class: 'mc-id' }, id), tag ? h('span', { class: 'mc-tag' }, tag) : null, b ? h('span', { class: 'mc-res ' + (b.ok ? 'ok' : 'warn') }, `${b.ok ? 'aprovado' : 'não aprovado'} · melhor ${fmt(b.best, 0)} %`) : h('span', { class: 'mc-res' }, 'não feita')),
      h('b', {}, m.nome), h('p', {}, m.objetivo), h('div', { class: 'mc-foot' }, h('small', {}, ic('Clock', 13), ` ~${dur} min`), h('button', { class: 'hw ' + (lock ? 'ghost' : 'primary'), disabled: lock, onclick: onGo }, lock ? 'Bloqueada' : 'Iniciar')));
  }
  function render() {
    main.innerHTML = ''; const t = T(), P = TR.progresso(t, d.levels);
    if (mode === 'treino') {
      if (!nivelSel || !P.niveis.some((n: any) => n.id === nivelSel)) nivelSel = P.atual.id;
      main.append(h('header', { class: 'hm-h' }, h('h1', {}, 'Treinamento'), h('p', {}, 'Níveis 0 a 3: Como jogar, Operador, Eletromecânico e Técnico. Aprove todas as missões de um nível (nota ≥ 70 %, sem erro crítico) para liberar o próximo. Correr dentro da SE conta falta.')),
        h('div', { class: 'lvls' }, ...P.niveis.map((n: any) => { const lib = n.liberado || cfg.liberarTudo; return h('button', { class: 'lv' + (n.id === nivelSel ? ' on' : '') + (lib ? '' : ' lock'), onclick: () => { nivelSel = n.id; LS.set('homeNivel', n.id); render(); } },
          h('span', { class: 'lv-n' }, n.sigla), h('span', {}, h('b', {}, n.nome), h('small', {}, n.descricao)), h('span', { class: 'lv-p' }, h('i', { style: { width: `${(n.feitas.length / n.missoes.length) * 100}%` } })), h('small', { class: 'lv-c' }, lib ? `${n.feitas.length}/${n.missoes.length} aprovadas` : 'bloqueado')); })));
      const n = P.niveis.find((x: any) => x.id === nivelSel); const lib = n.liberado || cfg.liberarTudo;
      main.append(h('div', { class: 'mcs' }, ...n.missoes.map((id: string) => missionCard(id, () => o.start(startCfg(id, { nivel: n.id })), !lib, n.sigla))));
      if (!t) main.append(h('p', { class: 'hm-note' }, ic('Info', 15), ' Sem treinando selecionado: a sessão roda como visitante e não salva o resultado.'));
    }
    if (mode === 'avaliacao') {
      const libs = P.niveis.filter((n: any) => n.liberado || cfg.liberarTudo).flatMap((n: any) => n.missoes);
      main.append(h('header', { class: 'hm-h' }, h('h1', {}, 'Avaliação'), h('p', {}, 'Prova: sem roteiro, sem dicas, sem assistente de prévia; EPI faltando conta erro maior. O resultado entra no histórico como avaliação.')),
        h('div', { class: 'mcs' }, ...libs.map((id: string) => missionCard(id, () => { if (!t) return o.toast('Avaliação exige treinando cadastrado.', 'warn'); o.start(startCfg(id, { nivel: 'avaliacao' })); }, false, 'AV'))));
    }
    if (mode === 'emergencia') {
      main.append(h('header', { class: 'hm-h' }, h('h1', {}, 'Emergência e resgate'), h('p', {}, 'NR-10 10.12: quem trabalha com eletricidade deve saber resgatar e prestar primeiros socorros. Primeiro isolar a fonte; nunca tocar vítima energizada; RCP 100–120/min; DEA o quanto antes.')),
        h('div', { class: 'mcs' }, ...(d.levels.emergencia?.missoes || ['S1', 'S2', 'E1']).map((id: string) => missionCard(id, () => o.start(startCfg(id, { nivel: id === 'E1' ? 'avancado' : undefined })), false, 'EMERG'))));
    }
    if (mode === 'livre') {
      main.append(h('header', { class: 'hm-h' }, h('h1', {}, 'Prática livre'), h('p', {}, 'A subestação inteira, sem nota. Opere pelo supervisório ou no campo, veja as zonas NR-10 (tecla Z), vá a qualquer ponto pelo mapa do tablet. Falhas podem ser injetadas pelo console do instrutor.')),
        h('div', { class: 'hm-big' }, h('div', {}, h('b', {}, 'O que dá para fazer'), h('ul', {}, h('li', {}, 'Manobrar disjuntores e seccionadoras (supervisório ou caixa de comando)'), h('li', {}, 'Extrair disjuntores MT, aterrar, bloquear (LOTO)'), h('li', {}, 'Ler instrumentos: SF6, contadores, temperaturas, TAP'), h('li', {}, 'Perguntar ao assistente e comparar equipamentos (tablet)'))),
          h('div', {}, h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: cfg.livreErros, onchange: (e: any) => { cfg.livreErros = e.target.checked; save(); } }), ' Erros, EPI e consequências valendo (recomendado)'),
            h('div', { class: 'row' }, h('button', { class: 'hw primary lg', onclick: () => o.start(startCfg(null, { livreErros: cfg.livreErros })) }, ic('Play', 18), ' Entrar na subestação'), o.vr.status().ok ? h('button', { class: 'hw vr lg', onclick: () => o.vr.entrar(startCfg(null, { livreErros: cfg.livreErros })) }, ic('Headset', 18), ' Entrar em VR') : null))));
    }
    if (mode === 'resultados') renderResults(t);
    if (mode === 'admin') { if (!adminOk) { mode = 'treino'; render(); return; } renderAdmin(); }
    if (mode === 'instrutor') {
      const all = TR.listar();
      main.append(h('header', { class: 'hm-h' }, h('h1', {}, 'Instrutor'), h('p', {}, 'Acompanhe a turma e conduza sessões. O console abre em outra janela (ou acoplado, se o navegador bloquear pop-ups) e mostra ao vivo: posição do treinando na planta, EPI, ferramenta na mão, alarmes, critérios e erros. Dali você injeta falhas, fala como COS, dá dicas e roda o replay.')),
        h('div', { class: 'row' }, h('button', { class: 'hw primary', onclick: o.instrutor }, ic('Users', 16), ' Abrir console (com sessão ativa)'), h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: cfg.modo === 'instrutor', onchange: (e: any) => { cfg.modo = e.target.checked ? 'instrutor' : 'autonomo'; save(); } }), ' Próximas sessões no modo "com instrutor" (eventos disparados pelo console)')),
        h('h3', {}, `Turma (${all.length})`), all.length ? h('table', { class: 'tbl' }, h('tr', {}, ...['Treinando', 'Função', 'Nível', 'Sessões', 'Média', 'Críticos', 'NR-10'].map((x) => h('th', {}, x))),
          ...all.map((x) => { const p = TR.progresso(x, d.levels), R = x.resultados, md = R.length ? R.reduce((a, r) => a + r.nota, 0) / R.length : NaN, v = TR.validade(x.nr10Basico);
            return h('tr', { onclick: () => { selId = x.id; LS.set('selTreinando', selId); mode = 'resultados'; renderWho(); renderNav(); render(); } }, h('td', {}, h('b', {}, x.nome)), h('td', {}, x.funcao), h('td', {}, p.atual.nome), h('td', {}, String(R.length)), h('td', {}, fmt(md, 0)), h('td', { class: R.some((r) => r.criticos) ? 'c-r' : '' }, String(R.reduce((a, r) => a + r.criticos, 0))), h('td', { class: 'c-' + (v.cls === 'bad' ? 'r' : v.cls === 'warn' ? 'w' : '') }, v.txt)); })) : h('p', { class: 'muted' }, 'Nenhum treinando cadastrado.'));
    }
  }
  function renderResults(t: any) {
    main.append(h('header', { class: 'hm-h' }, h('h1', {}, 'Resultados'), h('p', {}, t ? `${t.nome} · ${t.funcao}${t.matricula ? ' · mat. ' + t.matricula : ''}` : 'Selecione um treinando.')));
    if (!t) return; const R = t.resultados.slice().sort((a: any, b: any) => a.data.localeCompare(b.data)), n = R.length, apr = R.filter((r: any) => r.aprovado).length, md = n ? R.reduce((a: number, r: any) => a + r.nota, 0) / n : NaN, crit = R.reduce((a: number, r: any) => a + r.criticos, 0), hrs = R.reduce((a: number, r: any) => a + r.duracaoS, 0) / 3600;
    main.append(h('div', { class: 'kpis' }, ...[['Sessões', String(n)], ['Aprovação', n ? `${Math.round((apr / n) * 100)} %` : '—'], ['Nota média', fmt(md, 1)], ['Erros críticos', String(crit), crit ? 'r' : ''], ['Horas', fmt(hrs, 1)], ['Nível atual', TR.progresso(t, d.levels).atual.nome]].map(([k, v, c]) => h('div', { class: 'kpi' }, h('small', {}, k), h('b', { class: c ? 'c-' + c : '' }, v)))));
    // nota por sessão: uma série (linha + pontos), referência de aprovação, tooltip
    const W = 720, H = 220, X = (i: number) => 46 + (n <= 1 ? 320 : (i / (n - 1)) * 650), Y = (v: number) => 196 - (v / 100) * 170;
    const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': 'Nota por sessão' }); const tip = h('div', { class: 'ctip hidden' });
    for (const v of [0, 50, 100]) svg.append(sv('line', { x1: 46, x2: 700, y1: Y(v), y2: Y(v), class: 'grid' }), sv('text', { x: 38, y: Y(v) + 4, class: 'ax', 'text-anchor': 'end' }, String(v)));
    svg.append(sv('line', { x1: 46, x2: 700, y1: Y(70), y2: Y(70), class: 'ref' }), sv('text', { x: 700, y: Y(70) - 6, class: 'ax', 'text-anchor': 'end' }, 'aprovação 70 %'));
    if (n > 1) svg.append(sv('polyline', { points: R.map((r: any, i: number) => `${X(i)},${Y(r.nota)}`).join(' '), class: 'ln' }));
    R.forEach((r: any, i: number) => { const c = sv('circle', { cx: X(i), cy: Y(r.nota), r: 5, class: 'pt' + (r.aprovado ? '' : ' rp') }); const hit = sv('circle', { cx: X(i), cy: Y(r.nota), r: 14, class: 'hit' });
      hit.addEventListener('mouseenter', (e: any) => { tip.innerHTML = ''; tip.append(h('b', {}, `${r.missao} · ${fmt(r.nota, 1)} %`), h('small', {}, `${new Date(r.data).toLocaleString('pt-BR')} · ${r.aprovado ? 'aprovado' : 'reprovado'}${r.criticos ? ' · crítico' : ''}`)); tip.classList.remove('hidden'); const b = svg.getBoundingClientRect(); tip.style.left = (X(i) / W) * b.width + 'px'; tip.style.top = (Y(r.nota) / H) * b.height - 8 + 'px'; void e; });
      hit.addEventListener('mouseleave', () => tip.classList.add('hidden')); svg.append(c, hit); });
    if (n) svg.append(sv('text', { x: X(n - 1), y: Y(R[n - 1].nota) - 12, class: 'lb', 'text-anchor': 'middle' }, `${fmt(R[n - 1].nota, 0)} %`));
    const comps = Object.keys(d.scoring.pesos).map((k) => { const v = R.map((r: any) => r.comps[k]).filter((x: any) => x != null) as number[]; return { k, nome: d.scoring.nomes[k], v: v.length ? v.reduce((a, b) => a + b, 0) / v.length : null }; });
    const bars = sv('svg', { viewBox: `0 0 520 ${comps.length * 34 + 6}`, class: 'chart', role: 'img', 'aria-label': 'Média por competência' });
    comps.forEach((c, i) => { const y = 4 + i * 34; bars.append(sv('text', { x: 0, y: y + 15, class: 'ax' }, c.nome), sv('rect', { x: 150, y, width: 330, height: 20, rx: 4, class: 'bg' })); if (c.v != null) bars.append(sv('rect', { x: 150, y, width: Math.max(4, (c.v / 100) * 330), height: 20, rx: 4, class: 'br' }), sv('text', { x: 486, y: y + 15, class: 'lb' }, `${fmt(c.v, 0)} %`)); else bars.append(sv('text', { x: 158, y: y + 15, class: 'ax' }, 'sem dado')); });
    main.append(h('div', { class: 'charts' }, h('section', { class: 'card2' }, h('h3', {}, 'Nota por sessão'), h('div', { class: 'cwrap' }, svg as any, tip), h('small', { class: 'muted' }, 'Ponto cheio = aprovado · vazio = reprovado')), h('section', { class: 'card2' }, h('h3', {}, 'Média por competência'), bars as any)));
    const errs = new Map<string, number>(); for (const r of R) for (const e of r.erros) errs.set(`${e.sev}|${e.msg}`, (errs.get(`${e.sev}|${e.msg}`) || 0) + 1);
    const top = [...errs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    main.append(h('div', { class: 'charts' }, h('section', { class: 'card2' }, h('h3', {}, 'Erros mais frequentes'), top.length ? h('table', { class: 'tbl' }, ...top.map(([k, c]) => { const [sev, msg] = k.split('|'); return h('tr', {}, h('td', { class: sev === 'critico' ? 'c-r' : sev === 'maior' ? 'c-w' : '' }, sev), h('td', {}, msg), h('td', {}, `${c}×`)); })) : h('p', { class: 'muted' }, 'Nenhum erro registrado.')),
      h('section', { class: 'card2' }, h('h3', {}, 'Últimas sessões'), n ? h('table', { class: 'tbl' }, ...R.slice(-8).reverse().map((r: any) => h('tr', {}, h('td', {}, new Date(r.data).toLocaleDateString('pt-BR')), h('td', {}, h('b', {}, r.missao)), h('td', {}, r.nivel), h('td', { class: r.aprovado ? 'c-g' : 'c-r' }, `${fmt(r.nota, 1)} %`)))) : h('p', { class: 'muted' }, 'Sem sessões.'))),
      h('div', { class: 'row' }, h('button', { class: 'hw', onclick: () => { const html = perfHTML(t, d); o.modal(`Desempenho — ${t.nome}`, h('div', {}, h('div', { class: 'row' }, h('button', { class: 'hw sm', onclick: () => download(`desempenho-${t.nome.replace(/\s+/g, '_')}.html`, html, 'text/html') }, ic('Download', 15), ' HTML (imprimível)')), h('iframe', { class: 'repframe', srcdoc: html })), true); } }, ic('FileText', 16), ' Relatório para impressão'),
        h('button', { class: 'hw ghost', onclick: () => download(`desempenho-${t.nome.replace(/\s+/g, '_')}.csv`, TR.csv(t), 'text/csv') }, ic('Download', 16), ' CSV')));
  }
  let admTab = 'ranking', ordem = 'pontos';
  function renderAdmin() {
    main.append(h('header', { class: 'hm-h' }, h('h1', {}, 'Administração'), h('p', {}, 'Cadastro e gestão de pessoas, ranking da turma e dados deste aparelho. Para juntar vários aparelhos, exporte em cada um e importe aqui (os resultados são mesclados).')));
    main.append(h('div', { class: 'row tabs' }, ...([['ranking', 'Ranking', 'Trophy'], ['pessoas', 'Pessoas', 'Users'], ['dados', 'Dados', 'Download']] as const).map(([k, n, i]) => h('button', { class: 'hw' + (admTab === k ? ' primary' : ''), onclick: () => { admTab = k; render(); } }, ic(i, 15), ' ' + n))));
    const rk = TR.ranking(d.levels);
    if (admTab === 'ranking') {
      const ords: [string, string][] = [['pontos', 'Pontuação'], ['aprovadas', 'Missões aprovadas'], ['horas', 'Tempo de treino'], ['faltas', 'Menos faltas'], ['media', 'Nota média']];
      const sorted = rk.slice().sort((a: any, b: any) => (ordem === 'faltas' ? a.faltas - b.faltas || b.pontos - a.pontos : b[ordem] - a[ordem]));
      main.append(h('div', { class: 'row' }, h('small', { class: 'muted' }, 'Ordenar por'), ...ords.map(([k, n]) => h('button', { class: 'hw sm' + (ordem === k ? ' primary' : ''), onclick: () => { ordem = k; render(); } }, n))),
        sorted.length ? h('table', { class: 'tbl rank' }, h('tr', {}, ...['#', 'Pessoa', 'Função', 'Nível', 'Pontos', 'Missões', 'Nota média', 'Tempo', 'Faltas', 'Última sessão'].map((x) => h('th', {}, x))),
          ...sorted.map((r, i) => h('tr', { class: i < 3 ? 'top' : '' }, h('td', {}, h('b', {}, String(i + 1))), h('td', {}, h('b', {}, r.t.nome)), h('td', {}, r.t.funcao), h('td', {}, r.nivel), h('td', { class: 'mono' }, fmt(r.pontos, 0)), h('td', {}, `${r.aprovadas}/${r.total}`), h('td', {}, r.sessoes ? fmt(r.media, 1) : '—'), h('td', {}, `${fmt(r.horas, 1)} h`), h('td', { class: r.faltas ? 'c-r' : '' }, String(r.faltas)), h('td', {}, r.ultima ? new Date(r.ultima).toLocaleDateString('pt-BR') : '—'))))
          : h('p', { class: 'muted' }, 'Sem pessoas cadastradas.'));
      const mis = d.levels.niveis.flatMap((n: any) => n.missoes); const best = mis.map((m: string) => { let b: any = null; for (const r of rk) for (const x of r.t.resultados) if (x.missao === m && x.aprovado && (!b || x.duracaoS < b.x.duracaoS)) b = { t: r.t, x }; return [m, b] as const; });
      main.append(h('h3', {}, 'Recorde por missão (aprovado no menor tempo)'), h('table', { class: 'tbl' }, h('tr', {}, ...['Missão', 'Pessoa', 'Tempo', 'Nota'].map((x) => h('th', {}, x))), ...best.map(([m, b]) => h('tr', {}, h('td', {}, h('b', {}, m)), h('td', {}, b ? b.t.nome : '—'), h('td', {}, b ? `${Math.floor(b.x.duracaoS / 60)} min ${Math.round(b.x.duracaoS % 60)} s` : '—'), h('td', {}, b ? fmt(b.x.nota, 1) : '—')))));
    }
    if (admTab === 'pessoas') {
      main.append(h('div', { class: 'row' }, h('button', { class: 'hw primary', onclick: () => form(null, () => render()) }, ic('Plus', 15), ' Cadastrar pessoa')),
        h('table', { class: 'tbl' }, h('tr', {}, ...['Nome', 'Matrícula', 'Função', 'Nível', 'Sessões', 'Faltas', 'NR-10', ''].map((x) => h('th', {}, x))),
          ...rk.map((r) => { const v = TR.validade(r.t.nr10Basico); return h('tr', {}, h('td', {}, h('b', {}, r.t.nome)), h('td', {}, r.t.matricula || '—'), h('td', {}, r.t.funcao), h('td', {}, r.nivel), h('td', {}, String(r.sessoes)), h('td', { class: r.faltas ? 'c-r' : '' }, String(r.faltas)), h('td', { class: 'c-' + (v.cls === 'bad' ? 'r' : v.cls === 'warn' ? 'w' : '') }, v.txt),
            h('td', {}, h('button', { class: 'icard-x', title: 'Resultados', onclick: () => { selId = r.t.id; LS.set('selTreinando', selId); mode = 'resultados'; renderWho(); renderNav(); render(); } }, ic('ChartColumn', 15)), h('button', { class: 'icard-x', title: 'Editar', onclick: () => form(r.t, () => render()) }, ic('Pencil', 15)), h('button', { class: 'icard-x', title: 'Excluir', onclick: () => { if (confirm(`Excluir ${r.t.nome} e todo o histórico?`)) { TR.remover(r.t.id); if (selId === r.t.id) selId = null; renderWho(); render(); } } }, ic('Trash2', 15)))); })));
    }
    if (admTab === 'dados') {
      const file = h('input', { type: 'file', accept: '.json', class: 'hidden', onchange: async (e: any) => { const f = e.target.files[0]; if (!f) return; try { const n = TR.importar(await f.text()); o.toast(`${n} pessoa(s) importada(s) e mesclada(s).`, 'ok'); render(); } catch (er: any) { o.toast('Arquivo inválido: ' + er.message, 'bad'); } } }) as HTMLInputElement;
      const pin = h('input', { type: 'password', inputmode: 'numeric', placeholder: 'novo PIN (4+ dígitos)' }) as HTMLInputElement;
      main.append(h('div', { class: 'hm-big' }, h('div', {}, h('b', {}, 'Exportar e juntar aparelhos'), h('p', { class: 'muted' }, 'O navegador pode apagar dados. Exporte com frequência. Importar mescla as pessoas e os resultados (sem duplicar).'),
        h('div', { class: 'row' }, h('button', { class: 'hw primary', onclick: () => download(`saat-pessoas-${new Date().toISOString().slice(0, 10)}.json`, TR.exportar()) }, ic('Download', 15), ' Exportar tudo (JSON)'), h('button', { class: 'hw', onclick: () => file.click() }, ic('Upload', 15), ' Importar e mesclar'), file)),
        h('div', {}, h('b', {}, 'PIN do administrador'), h('div', { class: 'row' }, pin, h('button', { class: 'hw', onclick: () => { if (!/^\d{4,}$/.test(pin.value)) return o.toast('Use 4 ou mais dígitos.', 'warn'); LS.set('adminPin', pin.value); pin.value = ''; o.toast('PIN alterado.', 'ok'); } }, 'Salvar')))));
    }
  }
  function pick() {
    const list = h('div', { class: 'plist' }); const draw = (q = '') => { list.innerHTML = ''; for (const t of TR.listar().filter((x) => !q || (x.nome + x.matricula + x.funcao).toLowerCase().includes(q.toLowerCase()))) { const p = TR.progresso(t, d.levels);
      list.append(h('div', { class: 'prow' + (t.id === selId ? ' on' : '') }, h('button', { class: 'pmain', onclick: () => { selId = t.id; LS.set('selTreinando', selId); ov.remove(); renderWho(); render(); } }, h('span', { class: 'av' }, t.nome.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase()), h('span', {}, h('b', {}, t.nome), h('small', {}, `${t.funcao}${t.matricula ? ' · ' + t.matricula : ''} · ${p.atual.nome}`))),
        h('button', { class: 'icard-x', title: 'Editar', onclick: () => form(t) }, ic('Pencil', 15)), h('button', { class: 'icard-x', title: 'Excluir', onclick: () => { if (confirm(`Excluir ${t.nome} e todo o histórico?`)) { TR.remover(t.id); if (selId === t.id) selId = null; draw(); renderWho(); render(); } } }, ic('Trash2', 15)))); }
      if (!list.childElementCount) list.append(h('p', { class: 'muted' }, 'Nenhum treinando.')); };
    const file = h('input', { type: 'file', accept: '.json', class: 'hidden', onchange: async (e: any) => { const f = e.target.files[0]; if (!f) return; try { const n = TR.importar(await f.text()); o.toast(`${n} importado(s).`, 'ok'); draw(); } catch (er: any) { o.toast('Arquivo inválido: ' + er.message, 'bad'); } } }) as HTMLInputElement;
    const ov = o.modal('Treinandos', h('div', {}, h('div', { class: 'row' }, h('input', { placeholder: 'Buscar', oninput: (e: any) => draw(e.target.value), class: 'grow' }), h('button', { class: 'hw primary', onclick: () => form(null) }, ic('Plus', 15), ' Cadastrar')), list,
      h('div', { class: 'row' }, h('button', { class: 'hw sm ghost', onclick: () => download(`saat-treinandos-${new Date().toISOString().slice(0, 10)}.json`, TR.exportar()) }, ic('Download', 14), ' Backup'), h('button', { class: 'hw sm ghost', onclick: () => file.click() }, ic('Upload', 14), ' Restaurar'), file, h('small', { class: 'muted' }, 'Os dados ficam neste navegador. Faça backup.'))));
    draw();
  }
  function form(t: any, after?: (x: any) => void) {
    const v = (k: string) => (t ? String(t[k] ?? '') : ''); const nome = h('input', { value: v('nome') }) as HTMLInputElement, mat = h('input', { value: v('matricula') }) as HTMLInputElement, emp = h('input', { value: v('empresa') }) as HTMLInputElement;
    const fun = h('select', {}, ...TR.FUNCOES.map((f) => h('option', { selected: f === v('funcao') }, f))) as HTMLSelectElement; const n1 = h('input', { type: 'date', value: v('nr10Basico') }) as HTMLInputElement, n2 = h('input', { type: 'date', value: v('nr10Sep') }) as HTMLInputElement;
    const alt = h('input', { type: 'number', min: '120', max: '210', step: '1', placeholder: 'ex.: 175', value: v('alturaCm') }) as HTMLInputElement;
    o.modal(t ? 'Editar treinando' : 'Cadastrar treinando', h('div', {}, h('div', { class: 'form' }, h('label', {}, 'Nome completo', nome), h('label', {}, 'Matrícula', mat), h('label', {}, 'Função', fun), h('label', {}, 'Empresa / área', emp), h('label', {}, 'Validade NR-10 básico', n1), h('label', {}, 'Validade NR-10 SEP', n2), h('label', {}, 'Altura (cm) — usada no VR e na câmera do PC', alt)),
      h('div', { class: 'row' }, h('button', { class: 'hw primary', onclick: () => { if (!nome.value.trim()) return o.toast('Informe o nome.', 'warn'); const x = TR.salvar({ id: t?.id, nome: nome.value.trim(), matricula: mat.value.trim(), funcao: fun.value, empresa: emp.value.trim(), nr10Basico: n1.value, nr10Sep: n2.value, obs: '', alturaCm: (+alt.value >= 120 && +alt.value <= 210) ? Math.round(+alt.value) : undefined }); document.querySelectorAll('.modal').forEach((m) => m.remove()); if (after) after(x); else { selId = x.id; LS.set('selTreinando', selId); renderWho(); render(); } o.toast('Cadastro salvo.', 'ok'); } }, 'Salvar'))));
  }

  function settings() {
    const qv = LS.get('qual', 'medio'), qa = LS.get('qualAuto', true), vol = LS.get('vol', 0.8), voz = LS.get('voz', true);
    const q = h('select', {}, ...[['auto', 'Automática (recomendado)'], ['baixo', 'Baixa — notebook sem placa de vídeo'], ['medio', 'Média'], ['alto', 'Alta — placa dedicada']].map(([k, n]) => h('option', { value: k, selected: (qa ? 'auto' : qv) === k }, n))) as HTMLSelectElement;
    const vr = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: vol }) as HTMLInputElement, vz = h('input', { type: 'checkbox', checked: voz }) as HTMLInputElement;
    const perfil = h('select', {}, ...Object.values<any>(d.profiles).map((x) => h('option', { value: x.id, selected: x.id === cfg.perfil }, x.nome))) as HTMLSelectElement;
    const seed = h('input', { type: 'number', min: 1, value: cfg.semente }) as HTMLInputElement, epi = h('input', { type: 'checkbox', checked: cfg.exigirEpi }) as HTMLInputElement, lib = h('input', { type: 'checkbox', checked: cfg.liberarTudo }) as HTMLInputElement;
    o.modal('Configurações', h('div', {}, h('div', { class: 'form' }, h('label', {}, 'Qualidade gráfica', q), h('label', {}, 'Volume', vr), h('label', { class: 'chk' }, vz, ' Voz do rádio (sintetizada)'), h('label', {}, 'Perfil normativo', perfil), h('label', {}, 'Semente do cenário', seed), h('label', { class: 'chk' }, epi, ' Exigir EPI e ferramentas'), h('label', { class: 'chk' }, lib, ' Liberar todos os níveis (instrutor)')),
      h('div', { class: 'row' }, h('button', { class: 'hw primary', onclick: () => { const auto = q.value === 'auto'; o.quality((auto ? 'medio' : q.value) as Quality, auto); LS.set('vol', +vr.value); LS.set('voz', vz.checked); o.audio(+vr.value, vz.checked); cfg.perfil = perfil.value; cfg.semente = +seed.value || 1; cfg.exigirEpi = epi.checked; cfg.liberarTudo = lib.checked; save(); document.querySelectorAll('.modal').forEach((m) => m.remove()); render(); o.toast('Configurações salvas.', 'ok'); } }, 'Salvar')),
      h('h4', {}, 'Avançado'), h('div', { class: 'row' }, h('button', { class: 'hw sm ghost', onclick: o.teste }, 'Teste de funções'), h('button', { class: 'hw sm ghost', onclick: o.dados }, 'Dados (JSON)'), h('button', { class: 'hw sm ghost', onclick: o.diag }, 'Diagnóstico'), h('button', { class: 'hw sm ghost', onclick: o.vr.relatorio }, 'Relatório do VR'))));
  }
  renderWho(); renderNav(); renderVr(); render(); o.audio(LS.get('vol', 0.8), LS.get('voz', true));
  if (!LS.get('logado', null)) login();
}
