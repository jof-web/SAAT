// Supervisório (SCADA) da SE: telas, faceplate com selecionar → executar, alarmes, eventos (SOE), tendências e
// matriz de intertravamentos ao vivo. Convenção: VERMELHO = fechado/energizado · VERDE = aberto.
import { h, sv, fmt } from './dom';
import { createUnifilar } from './unifilar';
import { missionBlock, type Ctx, type Panel } from './panels';
import { diagramaComando } from './ctrldiag';
import type { Cmd } from '../core/sim';

export interface Trend { t: number; v1: number; v2: number; m1: number; m2: number; o1: number; o2: number; vcc: number }
const btn = (t: string, f: () => void, cls = '') => h('button', { class: 'hw ' + cls, type: 'button', onclick: f }, t);

export function scada(ctx: Ctx, foco?: string): Panel {
  const sim = ctx.sim, d = ctx.d; const mesa = () => !!ctx.mesa?.();
  const ups: ((v: any) => void)[] = [];
  const telas: Record<string, HTMLElement> = {}; const nav = h('nav', { class: 'snav' }); const body = h('div', { class: 'sbody' });
  let cur = ''; const show = (k: string) => { cur = k; body.innerHTML = ''; fp.classList.add('hidden', 'wide'); fp.classList.remove('wide'); fpUp = null; body.append(telas[k]); [...nav.children].forEach((c: any) => c.classList.toggle('on', c.dataset.k === k)); };
  const tela = (k: string, el: HTMLElement) => { telas[k] = el; nav.append(h('button', { class: 'snb', 'data-k': k, type: 'button', onclick: () => show(k) }, k)); };
  // ---------- cabeçalho e banner de alarme ----------
  const clock = h('b', { class: 'mono' }), modo = h('span', { class: 'chip' }), sup = h('span', { class: 'chip' }), ccc = h('span', { class: 'chip' });
  const head = h('div', { class: 'shead' }, h('b', {}, 'SE VALE VERDE · 138/13,8 kV'), clock, sup, ccc, modo);
  const banner = h('div', { class: 'sban' });
  ups.push((v) => { clock.textContent = new Date(sim.wallBase + v.s.t).toLocaleTimeString('pt-BR');
    const m = mesa(); modo.textContent = m ? 'COMANDO HABILITADO (mesa)' : 'SOMENTE LEITURA — vá até a mesa para comandar'; modo.className = 'chip ' + (m ? 'ok' : 'warn');
    sup.textContent = v.s.inj.semSupervisao ? 'SUPERVISÃO PERDIDA' : 'comunicação OK'; sup.className = 'chip ' + (v.s.inj.semSupervisao ? 'bad' : 'ok');
    ccc.textContent = `CC ${fmt(v.s.cc.v, 1)} V`; ccc.className = 'chip ' + (v.s.cc.v < d.params.cc.alarmeV ? 'bad' : '');
    const na = v.ccOk ? v.s.alarmes.filter((a: any) => !a.ack) : []; banner.innerHTML = '';
    if (!v.ccOk) banner.append(h('span', { class: 'blinkt' }, 'SUPERVISÓRIO SEM ALIMENTAÇÃO CC'));
    else if (na.length) banner.append(h('span', { class: 'blinkt' }, `▲ ${na.length} alarme(s) não reconhecido(s): ${na[na.length - 1].text}`), btn('Reconhecer (ACK)', () => ctx.cmd({ t: 'ack' }), 'sm'));
    else banner.append(h('span', { class: 'muted' }, 'Sem alarmes pendentes')); });

  // ---------- faceplate (selecionar → executar) ----------
  const fp = h('div', { class: 'faceplate hidden' }); let fpId = '', sel: { id: string; ate: number } | null = null; let fpUp: ((v: any) => void) | null = null;
  function faceplate(id: string) {
    fpId = id; sel = null; fp.innerHTML = ''; fp.classList.remove('hidden'); const e = sim.defs[id]; const isT = e.type === 'PTR';
    const st = h('div', { class: 'fpst' }), meas = h('div', { class: 'fpm' }), perm = h('div', { class: 'fpp' }), cmds = h('div', { class: 'fpc' }), prev = h('div', { class: 'fpprev' });
    const send = (c: Cmd, txt: string) => { if (!mesa()) return alert('Comando remoto só na mesa de operação (casa de comando).'); if (!sel || sel.id !== id || Date.now() > sel.ate) return alert('Selecione o equipamento antes (SELECIONAR) — a seleção vale 30 s.'); if (!confirm(`Confirma: ${txt}?`)) return; sel = null; ctx.cmd(c); };
    const selBtn = btn('SELECIONAR', () => { if (!mesa()) return alert('Comando remoto só na mesa de operação (casa de comando).'); sel = { id, ate: Date.now() + 30000 }; }, 'sm sel');
    if (e.type === 'CBR' || (e.type === 'DIS' && e.kind !== 'earthing')) cmds.append(selBtn, btn('ABRIR', () => send({ t: 'switch', id, op: 'open', via: 'remote' }, `ABRIR ${id}`), 'sm green'), btn('FECHAR', () => send({ t: 'switch', id, op: 'close', via: 'remote' }, `FECHAR ${id}`), 'sm red'));
    if (e.type === 'DIS' && e.kind === 'earthing') cmds.append(h('small', { class: 'muted' }, 'Chave de terra: operação somente LOCAL no equipamento.'));
    const rel = sim.relayByBrk[id]; if (rel?.['79']) cmds.append(btn('Bloquear 79', () => mesa() && confirm(`Bloquear o religamento (79) de ${id}?`) && ctx.cmd({ t: 'r79', rele: rel.id, on: false, via: 'remote' }), 'sm'), btn('Liberar 79', () => mesa() && confirm(`Liberar o religamento (79) de ${id}?`) && ctx.cmd({ t: 'r79', rele: rel.id, on: true, via: 'remote' }), 'sm'));
    if (isT) cmds.append(selBtn, btn('TAP ▲', () => send({ t: 'tap', id, dir: 1, via: 'remote' }, `SUBIR TAP de ${id}`), 'sm'), btn('TAP ▼', () => send({ t: 'tap', id, dir: -1, via: 'remote' }, `BAIXAR TAP de ${id}`), 'sm'),
      btn('OLTC AUTO', () => send({ t: 'oltc', id, modo: 'auto', via: 'remote' }, `OLTC de ${id} em AUTOMÁTICO`), 'sm'), btn('OLTC MANUAL', () => send({ t: 'oltc', id, modo: 'manual', via: 'remote' }, `OLTC de ${id} em MANUAL`), 'sm'),
      btn('Ventilação forçada LIGA', () => send({ t: 'vent', id, on: true, via: 'remote' }, `ligar ventilação forçada de ${id}`), 'sm'), btn('Ventilação AUTO', () => send({ t: 'vent', id, on: false, via: 'remote' }, `ventilação de ${id} em automático`), 'sm'));
    const prevCmd = (op: string): Cmd => isT ? { t: 'tap', id, dir: op === 'close' ? 1 : -1 } : { t: 'switch', id, op, via: 'remote' };
    const tools = h('div', { class: 'row' }, ctx.previa && !isT && e.kind !== 'earthing' ? btn('Simular ABRIR', () => showPrev(prevCmd('open')), 'sm ghost') : null, ctx.previa && !isT && e.kind !== 'earthing' ? btn('Simular FECHAR', () => showPrev(prevCmd('close')), 'sm ghost') : null,
      ctx.previa && isT ? btn('Simular TAP ▲', () => showPrev(prevCmd('close')), 'sm ghost') : null,
      e.type === 'CBR' ? btn('Diagrama de comando', () => diag(), 'sm ghost') : null, ctx.ficha ? btn('Ficha técnica', () => ctx.ficha!(id), 'sm ghost') : null, ctx.goTo ? btn('Ver no 3D', () => ctx.goTo!(id), 'sm ghost') : null);
    function showPrev(c: Cmd) { const p = ctx.previa!(c); prev.innerHTML = ''; prev.className = 'fpprev ' + (p.alerta ? 'bad' : 'ok'); prev.append(h('b', {}, 'Prévia (cópia do sistema, nada executado):'), h('ul', {}, ...p.linhas.map((l: string) => h('li', {}, l)))); }
    function diag() { fp.classList.add('wide'); const dg = diagramaComando(ctx, id); prev.innerHTML = ''; prev.className = 'fpprev'; prev.append(dg.el); const u = (v: any) => dg.update(v); u(ctx.view()); diagUp = u; }
    let diagUp: ((v: any) => void) | null = null;
    fp.append(h('header', {}, h('b', {}, id), h('small', {}, isT ? 'Transformador de potência' : e.type === 'CBR' ? (e.ratings?.classe === 'at' ? 'Disjuntor 145 kV SF6' : 'Disjuntor 15 kV extraível') : e.kind === 'earthing' ? 'Chave de terra' : 'Seccionadora 145 kV'), btn('×', () => { fp.classList.add('hidden'); fpUp = null; }, 'x')), st, meas, perm, cmds, tools, prev);
    fpUp = (v) => {
      const s = v.s, b = s.eq[id];
      if (isT) { const t = s.tr[id], dt = v.der.tr[id]; st.innerHTML = ''; st.append(h('span', { class: 'big ' + (dt.energ ? 'on' : '') }, dt.energ ? 'ENERGIZADO' : 'DESENERGIZADO'), h('span', {}, `TAP ${t.tap > 0 ? '+' : ''}${t.tap} · OLTC ${t.modo === 'auto' ? 'AUTO' : 'MANUAL'}${s.eq['90-' + id]?.loto.length ? ' · BLOQ.' : ''}`), h('span', {}, `Vent. G${t.vent}${t.ventMan ? ' (manual)' : ''}`));
        meas.textContent = `${fmt(dt.mva, 2)} MVA (${fmt(dt.pct)} % de 25 MVA) · óleo ${fmt(t.oleo)} °C · enrol. ${fmt(t.enrol)} °C`; perm.textContent = ''; }
      else {
        const est = b.moving ? 'EM TRÂNSITO' : b.state === 'closed' ? 'FECHADO' : 'ABERTO'; st.innerHTML = '';
        st.append(h('span', { class: 'big ' + (b.moving ? 'mov' : b.state) }, est), b.pos ? h('span', {}, 'Posição: ' + String(b.pos).toUpperCase()) : '', e.lr ? h('span', {}, `43: ${String(s.eq[e.lr]?.lr).toUpperCase()}`) : '',
          e.type === 'CBR' ? h('span', {}, b.mola ? 'mola carregada' : 'MOLA DESCARREGADA') : '', b.sf6 ? h('span', { class: 'bad' }, `SF6 estágio ${b.sf6}`) : '', b.loto?.length ? h('span', { class: 'bad' }, `BLOQ.: ${b.loto.map((l: any) => l.dono).join(', ')}`) : '',
          rel?.['79'] ? h('span', {}, `79: ${s.rel[rel.id].r79 ? 'em serviço' : 'BLOQUEADO'}`) : '');
        meas.textContent = `Corrente: ${fmt(v.der.I[id] || 0)} A`;
        perm.innerHTML = ''; for (const op of ['open', 'close']) { const via = e.kind === 'earthing' ? 'local' : 'remote'; const vv = sim.violations(e, [op], { via, actor: 'treinando' });
          perm.append(h('div', { class: vv.length ? 'bad' : 'okc' }, h('b', {}, op === 'open' ? 'Permissivo ABRIR: ' : 'Permissivo FECHAR: '), vv.length ? vv.map((x: any) => `${x.id} ${x.det}`).join(' · ') : 'liberado')); }
      }
      const sl = sel && sel.id === id && Date.now() < sel.ate; selBtn.classList.toggle('armed', !!sl); selBtn.textContent = sl ? `SELECIONADO (${Math.ceil((sel!.ate - Date.now()) / 1000)} s)` : 'SELECIONAR';
      diagUp?.(v);
    };
    fpUp(ctx.view());
  }

  // ---------- tela Geral (unifilar) ----------
  const uni = createUnifilar(d.layout, sim.defs, sim.nodeLevel, { onEq: (id) => faceplate(id) });
  const resumo = h('div', { class: 'sres' });
  ups.push((v) => { uni.update({ ...v, bloqueios: d.protections.bloqueios }); const der = v.der, s = v.s; resumo.innerHTML = '';
    resumo.append(...Object.entries<any>(der.barras).map(([k, b]) => h('div', { class: 'kv ' + (b.energ ? 'on' : '') }, h('small', {}, k), h('b', {}, b.energ ? `${fmt(b.kV, 2)} kV` : 'sem tensão'))),
      ...['T1', 'T2'].map((T) => h('div', { class: 'kv' }, h('small', {}, `${T} (${T === 'T1' ? 'TR-01' : 'TR-02'})`), h('b', {}, `${fmt(der.tr[T].mva, 2)} MVA · ${fmt(der.tr[T].pct)} %`), h('small', {}, `TAP ${s.tr[T].tap > 0 ? '+' : ''}${s.tr[T].tap} ${s.tr[T].modo === 'auto' ? 'A' : 'M'} · óleo ${fmt(s.tr[T].oleo)} °C`))),
      h('div', { class: 'kv' }, h('small', {}, 'Serviço auxiliar'), h('b', {}, s.ca.ok ? `CA ok (${s.ca.ats})` : 'SEM CA'), h('small', {}, `CC ${fmt(s.cc.v, 1)} V · bateria ${fmt(Math.max(0, s.cc.soc) * 100)} %`))); });
  tela('Geral', h('div', { class: 'sgeral' }, h('div', { class: 'unibox' }, uni.el as any, h('div', { class: 'leg' }, h('i', { class: 'lr' }), 'fechado', h('i', { class: 'lg' }), 'aberto', h('i', { class: 'la' }), '138 kV energ.', h('i', { class: 'lm' }), '13,8 kV energ.', h('i', { class: 'ld' }), 'sem tensão', h('i', { class: 'lt' }), 'aterrado')), resumo));

  // ---------- tela Trafos ----------
  const trCard = (T: string) => {
    const c = h('div', { class: 'trc' }); const pr = d.protections.trafo;
    const bar = (lbl: string, max: number, al: number, tr: number) => { const f = h('i'); const val = h('b'); const e = h('div', { class: 'tbar' }, h('small', {}, lbl), h('div', { class: 'tb' }, f, h('em', { style: { left: `${(al / max) * 100}%` } }), h('em', { class: 'tr', style: { left: `${(tr / max) * 100}%` } })), val); return { e, set: (x: number, u: string) => { f.style.width = `${Math.min(100, (x / max) * 100)}%`; f.className = x >= tr ? 'bad' : x >= al ? 'warn' : ''; val.textContent = `${fmt(x)} ${u}`; } }; };
    const oil = bar('Óleo (26)', 120, pr['26'].alarmeC, pr['26'].tripC), wnd = bar('Enrolamento (49)', 140, pr['49'].alarmeC, pr['49'].tripC), ld = bar('Carga', 130, 100, 120);
    const info = h('div', { class: 'trinfo' }), lamps = h('div', { class: 'trl' });
    c.append(h('header', {}, h('b', {}, `${T} · ${T === 'T1' ? 'TR-01' : 'TR-02'}`), btn('Faceplate', () => faceplate(T), 'sm ghost')), oil.e, wnd.e, ld.e, info, lamps);
    ups.push((v) => { const s = v.s.tr[T], t = v.der.tr[T]; oil.set(s.oleo, '°C'); wnd.set(s.enrol, '°C'); ld.set(t.pct, '%');
      info.textContent = `${fmt(t.mva, 2)} MVA · TAP ${s.tap > 0 ? '+' : ''}${s.tap} (${s.modo === 'auto' ? 'AUTO' : 'MANUAL'}${s.travado ? ', SEM RESPOSTA' : ''}) · ventilação G${s.vent}${s.ventMan ? ' manual' : ''} · ${t.energ ? 'energizado' : 'desenergizado'}`;
      lamps.innerHTML = ''; const L = (n: string, on: boolean, cls = 'r') => lamps.append(h('span', { class: 'sl ' + (on ? cls : '') }, n));
      L('87T', s.alvos.includes('87T')); L('63', s.buch > 0 || s.alvos.includes('63'), s.buch === 1 ? 'a' : 'r'); L('63RPS', s.rps); L('26', s.oleo >= pr['26'].alarmeC, 'a'); L('49', s.enrol >= pr['49'].alarmeC, 'a'); L('71', s.nivel === 'baixo', 'a'); L('86T', !!v.s.locks['86T-' + T]); L('FOGO', s.fogo); });
    return c; };
  tela('Trafos', h('div', { class: 'strafos' }, trCard('T1'), trCard('T2')));

  // ---------- tela MT (cubículos) ----------
  const mt = h('div', { class: 'smt' }); const bays = ['AL1', 'AL2', 'T1M', 'P', 'T2M', 'AL3', 'AL4'];
  const cells = bays.map((b) => { const id = '52-' + b; const box = h('button', { class: 'mtc', type: 'button', onclick: () => faceplate(id) }); mt.append(box); return { b, id, box }; });
  ups.push((v) => { const s = v.s, der = v.der; for (const c of cells) { const x = s.eq[c.id], rel = sim.relayByBrk[c.id]; const lk = Object.entries<any>(d.protections.bloqueios).filter(([k, y]) => s.locks[k] && y.bloqueia.includes(c.id)).map(([k]) => k);
    c.box.className = 'mtc ' + (x.moving ? 'mov' : x.state); c.box.innerHTML = '';
    c.box.append(h('b', {}, c.id), h('span', { class: 'st' }, x.moving ? 'TRÂNSITO' : x.state === 'closed' ? 'FECHADO' : 'ABERTO'), h('small', {}, `${String(x.pos).toUpperCase()} · 43 ${String(s.eq['43-' + c.b]?.lr).toUpperCase()}`),
      h('small', {}, `${fmt(der.I[c.id] || 0)} A`), rel?.['79'] ? h('small', {}, `79 ${s.rel[rel.id].r79 ? 'ON' : 'BLOQ'}`) : '', lk.length ? h('small', { class: 'bad' }, lk.join(' ')) : '', x.loto.length ? h('small', { class: 'bad' }, 'BLOQ.') : '',
      s.eq['89T-' + c.b] ? h('small', { class: s.eq['89T-' + c.b].state === 'closed' ? 'okc' : '' }, `89T ${s.eq['89T-' + c.b].state === 'closed' ? 'ATERRADO' : 'aberta'}`) : ''); } });
  const mtBus = h('div', { class: 'mtbus' }); ups.push((v) => { mtBus.innerHTML = ''; for (const b of ['MT-1', 'MT-2']) { const x = v.der.barras[b]; mtBus.append(h('div', { class: 'kv ' + (x.energ ? 'onm' : '') }, h('small', {}, b), h('b', {}, x.energ ? `${fmt(x.kV, 2)} kV (${fmt(x.v * 100, 1)} %)` : 'sem tensão'))); } });
  tela('MT 13,8 kV', h('div', {}, mtBus, mt));

  // ---------- tela Serviços auxiliares ----------
  const sa = h('div', { class: 'ssa' }); const saBtns = h('div', { class: 'row' }, btn('ATS automático', () => mesa() && ctx.cmd({ t: 'ats', auto: true }), 'sm'), btn('ATS manual', () => mesa() && ctx.cmd({ t: 'ats', auto: false }), 'sm'), btn('Transferir p/ TSA1', () => mesa() && confirm('Transferir QGCA para TSA1?') && ctx.cmd({ t: 'ats', to: 'TSA1' }), 'sm'), btn('Transferir p/ TSA2', () => mesa() && confirm('Transferir QGCA para TSA2?') && ctx.cmd({ t: 'ats', to: 'TSA2' }), 'sm'));
  const saSvg = sv('svg', { viewBox: '0 0 520 220', class: 'sasvg' });
  ups.push((v) => { const s = v.s, der = v.der, c = s.cc; saSvg.innerHTML = '';
    const L = (x1: number, y1: number, x2: number, y2: number, on: boolean, cor = '#f5b041') => saSvg.append(sv('line', { x1, y1, x2, y2, stroke: on ? cor : '#4b5a66', 'stroke-width': 4 }));
    const T = (x: number, y: number, t: string, cls = '') => saSvg.append(sv('text', { x, y, class: 'st ' + cls }, t));
    const t1 = !!der.energ.TSA1p, t2 = !!der.energ.TSA2p; L(60, 30, 60, 90, t1); L(180, 30, 180, 90, t2); T(40, 22, 'TSA1'); T(160, 22, 'TSA2');
    saSvg.append(sv('rect', { x: 45, y: 90, width: 30, height: 24, fill: s.ca.ats === 'TSA1' && s.ca.ok ? '#e5484d' : '#30a46c' }), sv('rect', { x: 165, y: 90, width: 30, height: 24, fill: s.ca.ats === 'TSA2' && s.ca.ok ? '#e5484d' : '#30a46c' }));
    L(60, 114, 60, 140, s.ca.ok && s.ca.ats === 'TSA1'); L(180, 114, 180, 140, s.ca.ok && s.ca.ats === 'TSA2'); L(30, 140, 230, 140, s.ca.ok); T(90, 160, `QGCA 380/220 V · ATS ${s.ca.auto ? 'AUTO' : 'MANUAL'}`);
    L(130, 140, 130, 185, s.ca.ok); T(300, 22, 'RT1'); T(380, 22, 'RT2'); L(320, 30, 320, 120, s.ca.ok && c.rt.RT1, '#4aa3ff'); L(400, 30, 400, 120, s.ca.ok && c.rt.RT2, '#4aa3ff');
    L(280, 120, 500, 120, c.v > 80, '#4aa3ff'); T(420, 140, `Barra CC ${fmt(c.v, 1)} V`, c.v < d.params.cc.alarmeV ? 'bad' : ''); L(460, 120, 460, 180, c.v > 80, '#4aa3ff'); T(430, 200, `BB1 ${fmt(Math.max(0, c.soc) * 100)} %`); if (c.terra) T(300, 200, 'TERRA CC', 'bad'); });
  tela('Serviços auxiliares', h('div', { class: 'ssaw' }, saSvg as any, saBtns, h('p', { class: 'muted' }, 'Retificadores, banco de baterias e QGCA ficam no EQ-3 e na sala de baterias.')));

  // ---------- Alarmes, Eventos (SOE), Tendências, Intertravamentos ----------
  const alist = h('div', { class: 'alist' }); let aSig = '';
  ups.push((v) => { const al = v.ccOk ? v.s.alarmes : []; const sig = JSON.stringify(al.map((a: any) => [a.key, a.ativo, a.ack])); if (sig === aSig) return; aSig = sig; alist.innerHTML = '';
    if (!v.ccOk) alist.append(h('div', { class: 'aitem s3' }, 'SUPERVISÓRIO SEM ALIMENTAÇÃO CC'));
    for (const a of [...al].reverse()) alist.append(h('div', { class: `aitem s${a.sev} ${a.ack ? 'ack' : ''} ${a.ativo ? '' : 'norm'}` }, h('span', {}, new Date(sim.wallBase + a.t).toLocaleTimeString('pt-BR')), h('b', {}, a.sev >= 3 ? 'P1' : 'P2'), a.text, a.ativo ? '' : ' (normalizado)', a.ack ? ' ✓' : '')); });
  tela('Alarmes', h('div', {}, h('div', { class: 'row' }, btn('Reconhecer todos (ACK)', () => ctx.cmd({ t: 'ack' }), 'sm'), btn('EMERGÊNCIA (sirene)', () => confirm('Acionar/desligar a emergência?') && ctx.cmd({ t: 'emergencia', on: !ctx.view().s.emergencia }), 'sm danger')), alist));
  const soe = h('div', { class: 'elist' }); let lastSeq = -1;
  ups.push(() => { if (cur !== 'Eventos (SOE)') return; const L = sim.log; if (!L.length || L[L.length - 1].seq === lastSeq) return; lastSeq = L[L.length - 1].seq; soe.innerHTML = '';
    for (const e of L.slice(-120).reverse()) soe.append(h('div', { class: 'eitem k-' + e.kind + (e.result && e.result !== 'ok' ? ' bad' : '') }, h('span', {}, e.hora.slice(11, 23)), h('i', {}, e.actor), e.msg)); });
  tela('Eventos (SOE)', soe);
  const trd = h('div', { class: 'strend' }); let tT = 0;
  const chart = (titulo: string, series: [string, (x: Trend) => number, string][], un: string) => { const s = sv('svg', { viewBox: '0 0 600 150', class: 'tchart' }); const w = h('div', { class: 'tcw' }, h('b', {}, titulo), s as any);
    return { w, draw: (buf: Trend[]) => { s.innerHTML = ''; if (buf.length < 2) return; const vals = buf.flatMap((b) => series.map(([, f]) => f(b))); let lo = Math.min(...vals), hi = Math.max(...vals); if (hi - lo < 1e-6) { hi += 1; lo -= 1; } const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
      const X = (i: number) => 40 + (i / (buf.length - 1)) * 550, Y = (y: number) => 140 - ((y - lo) / (hi - lo)) * 125;
      s.append(sv('text', { x: 2, y: 18, class: 'tl' }, `${fmt(hi, 1)} ${un}`), sv('text', { x: 2, y: 140, class: 'tl' }, fmt(lo, 1)));
      for (const yy of [20, 80, 140]) s.append(sv('line', { x1: 40, x2: 590, y1: yy, y2: yy, class: 'tgrid' }));
      series.forEach(([n, f, cor], k) => { const pl = sv('polyline', { points: buf.map((b, i) => `${X(i)},${Y(f(b))}`).join(' '), fill: 'none', stroke: cor, 'stroke-width': 2, 'stroke-linejoin': 'round' }); pl.append(sv('title', {}, `${n}: ${fmt(f(buf[buf.length - 1]), 2)} ${un}`)); s.append(pl);
        s.append(sv('line', { x1: 60 + k * 150, x2: 76 + k * 150, y1: 8, y2: 8, stroke: cor, 'stroke-width': 3 }), sv('text', { x: 80 + k * 150, y: 12, class: 'tl' }, `${n}: ${fmt(f(buf[buf.length - 1]), 2)} ${un}`)); }); } }; };
  const cs = [chart('Tensão das barras MT', [['MT-1', (x) => x.v1, '#3987e5'], ['MT-2', (x) => x.v2, '#d95926']], 'kV'), chart('Carga dos trafos', [['T1', (x) => x.m1, '#3987e5'], ['T2', (x) => x.m2, '#d95926']], 'MVA'), chart('Temperatura do óleo', [['T1', (x) => x.o1, '#3987e5'], ['T2', (x) => x.o2, '#d95926']], '°C'), chart('Tensão CC', [['Barra CC', (x) => x.vcc, '#3987e5']], 'V')];
  trd.append(...cs.map((c) => c.w), h('small', { class: 'muted' }, 'Últimos 10 min de tempo simulado.'));
  ups.push(() => { if (cur !== 'Tendências' || !ctx.trend) return; if (performance.now() - tT < 900) return; tT = performance.now(); const b = ctx.trend(); cs.forEach((c) => c.draw(b)); });
  tela('Tendências', trd);
  const ilt = h('table', { class: 'mtab ilt' }); const ilIds = ['52-LT1', '89-LT1-2', '89-LT1-1', '89T-LT1', '52-T1', '89-T1-1', '89-T1-2', '89T-T1', '52-T2', '89-T2-1', '89-T2-2', '89T-T2', '52-T1M', '52-T2M', '52-P', '52-AL1', '52-AL2', '52-AL3', '52-AL4', '89T-AL1', '89T-AL2', '89T-AL3', '89T-AL4'];
  ups.push((v) => { if (cur !== 'Intertravamentos') return; ilt.innerHTML = ''; ilt.append(h('tr', {}, h('th', {}, 'Equipamento'), h('th', {}, 'Estado'), h('th', {}, 'ABRIR'), h('th', {}, 'FECHAR')));
    for (const id of ilIds) { const e = sim.defs[id]; if (!e) continue; const b = v.s.eq[id]; const via = e.kind === 'earthing' ? 'local' : 'remote';
      const cell = (op: string) => { const vv = sim.violations(e, [op], { via, actor: 'treinando' }); return h('td', { class: vv.length ? 'bad' : 'okc', title: vv.map((x: any) => `${x.id}: ${x.det}`).join('\n') }, vv.length ? '✗ ' + [...new Set(vv.map((x: any) => x.id))].join(', ') : '✓'); };
      ilt.append(h('tr', { onclick: () => faceplate(id) }, h('td', {}, id), h('td', { class: b.state }, b.state === 'closed' ? 'FECHADO' : 'ABERTO'), cell('open'), cell('close'))); } });
  tela('Intertravamentos', h('div', {}, h('p', { class: 'muted' }, 'Permissivos ao vivo (comando remoto; chaves de terra = local). Passe o mouse no ✗ para ver o motivo. Clique na linha para abrir o faceplate.'), ilt));
  const mb = missionBlock(ctx, 'IHM'); if (mb.e) { tela('Comunicação', h('div', {}, mb.e)); ups.push(mb.set); }

  const el = h('div', { class: 'scada' }, head, h('div', { class: 'smain' }, nav, h('div', { class: 'sview' }, body, fp)), banner);
  show(foco && sim.defs[foco] ? 'Geral' : 'Geral'); if (foco && sim.defs[foco]) setTimeout(() => faceplate(foco), 0);
  return { title: mesa() ? 'Supervisório — mesa de operação (comando remoto)' : 'Supervisório (somente leitura)', el, update: (v) => { ups.forEach((u) => u(v)); fpUp?.(v); } };
}
