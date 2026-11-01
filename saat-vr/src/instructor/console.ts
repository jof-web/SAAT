// Console do instrutor: espelho ao vivo, linha do tempo, injeção de falhas, COS, dicas, bypass, relatório e replay.
// Roda na janela separada (#instrutor) ou acoplado (fallback). Fala com o app só pelo Transport.
import { h, fmt, mmss, download } from '../ui/dom';
import { createUnifilar } from '../ui/unifilar';
import { Sim } from '../core/sim';
import { Session } from '../scenario/session';
import type { Transport } from './link';
import { reportHTML } from '../ui/report';
import { plantMap } from '../game/map';

export function mountConsole(root: HTMLElement, tr: Transport) {
  root.innerHTML = ''; root.classList.add('console');
  let domain: any = null, cfg: any = null, mission: any = null, sim: Sim | null = null, uni: any = null;
  let last: any = null, log: any[] = [], soTreinando = false, replay: any = null, pmap: any = null; const liveKv = h('div', { class: 'livekv' });
  const status = h('span', { class: 'chip' }, 'aguardando o simulador…'), clock = h('b', { class: 'clock' }, '00:00');
  const send = (m: any) => tr.send(m); const input = (k: string, ...a: any[]) => send({ type: 'input', k, a });
  const hdr = h('header', { class: 'chead' }, h('b', {}, 'SAAT · Instrutor'), status, clock,
    h('span', { class: 'grp' }, h('button', { class: 'hw sm', onclick: () => send({ type: 'ctl', op: 'pause' }) }, '⏸ Pausar'), h('button', { class: 'hw sm', onclick: () => send({ type: 'ctl', op: 'resume' }) }, '▶ Retomar'),
      ...[1, 2, 5, 10].map((x) => h('button', { class: 'hw sm', onclick: () => send({ type: 'ctl', op: 'speed', v: x }) }, '×' + x))),
    h('span', { class: 'grp' }, h('button', { class: 'hw sm', onclick: () => input('checkpoint') }, 'Checkpoint'), h('select', { id: 'cps', onchange: (e: any) => { if (e.target.value) { input('restore', e.target.value); e.target.value = ''; } } }, h('option', { value: '' }, 'Restaurar…')),
      h('button', { class: 'hw sm', onclick: () => { if (confirm('Reiniciar o cenário?')) send({ type: 'ctl', op: 'restart' }); } }, 'Reiniciar')),
    h('button', { class: 'hw sm danger', onclick: () => input('cmd', { t: 'emergencia', on: !last?.v.s.emergencia }, 'instrutor') }, 'EMERGÊNCIA (sirene)'));
  const left = h('div', { class: 'cleft' }); const tabs = h('nav', { class: 'tabs' }); const body = h('div', { class: 'cbody' });
  root.append(hdr, h('div', { class: 'cmain' }, left, h('div', { class: 'cright' }, tabs, body)));
  const panes: Record<string, HTMLElement> = {}; let cur = '';
  const pane = (k: string, el: HTMLElement) => { panes[k] = el; tabs.append(h('button', { class: 'tab', onclick: () => show(k) }, k)); };
  const show = (k: string) => { cur = k; body.innerHTML = ''; body.append(panes[k]); [...tabs.children].forEach((c: any) => c.classList.toggle('on', c.textContent === k)); refresh(); };

  // ---- Linha do tempo ----
  const tl = h('div', { class: 'elist big' });
  pane('Linha do tempo', h('div', {}, h('label', {}, h('input', { type: 'checkbox', onchange: (e: any) => { soTreinando = e.target.checked; drawLog(true); } }), ' só ações do treinando'), tl));
  function drawLog(full = false) {
    if (full) tl.innerHTML = '';
    const items = (full ? log : log.slice(-40)).filter((e) => !soTreinando || e.actor === 'treinando');
    if (!full) tl.innerHTML = '';
    for (const e of [...items].reverse().slice(0, 400)) tl.append(h('div', { class: `eitem k-${e.kind} ${e.result && e.result !== 'ok' ? 'bad' : ''} ${e.sev ? 'sev-' + e.sev : ''}` }, h('span', {}, mmss(e.t)), h('i', {}, e.actor), e.msg, e.rules?.length ? h('em', {}, ' [' + e.rules.join(', ') + ']') : null, e.just ? h('em', {}, ' — just.: ' + e.just) : null));
  }
  // ---- Falhas ----
  const fl = h('div', { class: 'flist' }); const ag = h('div', { class: 'aglist' });
  pane('Falhas', h('div', {}, h('p', { class: 'muted' }, 'Catálogo F01–F25. Agendamento em tempo de simulação (T+mm:ss). Oculta = o treinando não é avisado.'), fl, h('h4', {}, 'Agendadas'), ag));
  // ---- Cenário ----
  const scn = h('div');
  pane('Avaliação', scn);
  // ---- COS e papéis ----
  const cosTxt = h('textarea', { rows: 3, placeholder: 'Texto da ordem do COS…' }) as HTMLTextAreaElement; const presets = h('div', { class: 'col' });
  const papelSel = h('select', {}, ...['manutencao', 'cos', 'sistema'].map((x) => h('option', { value: x }, x === 'sistema' ? 'brigada/bombeiros' : x))) as HTMLSelectElement; const papelTxt = h('input', { placeholder: 'Mensagem do papel simulado…' }) as HTMLInputElement;
  pane('COS e papéis', h('div', {}, h('h4', {}, 'Ordem do COS (exige read-back)'), cosTxt, h('button', { class: 'hw sm', onclick: () => { if (cosTxt.value.trim()) { input('cos', cosTxt.value.trim(), true); cosTxt.value = ''; } } }, 'Emitir ordem'), presets,
    h('h4', {}, 'Papel simulado'), h('div', { class: 'row' }, papelSel, papelTxt, h('button', { class: 'hw sm', onclick: () => { if (papelTxt.value.trim()) { input('papel', papelSel.value, papelTxt.value.trim()); papelTxt.value = ''; } } }, 'Enviar'))));
  // ---- Dicas e bypass ----
  const dicas = h('div'); const bp = h('div');
  pane('Dicas e bypass', h('div', {}, h('h4', {}, 'Dicas (com penalidade)'), h('div', { class: 'row' }, ...[1, 2, 3].map((n) => h('button', { class: 'hw sm', onclick: () => input('dica', n) }, `N${n} ${['lembra o objetivo', 'aponta a etapa', 'revela a ação'][n - 1]}`))), dicas, h('h4', {}, 'Pedidos de bypass (perfil Supervisor)'), bp));
  // ---- Relatório e replay ----
  const rep = h('div'); const rp = h('div', { class: 'replay' });
  pane('Relatório e replay', h('div', {}, h('div', { class: 'row' }, h('button', { class: 'hw sm', onclick: () => send({ type: 'ctl', op: 'report' }) }, 'Gerar relatório'), h('button', { class: 'hw sm', onclick: () => { if (confirm('Encerrar a missão agora?')) input('finish', 'encerrada pelo instrutor'); } }, 'Encerrar missão'), h('button', { class: 'hw sm', onclick: () => send({ type: 'ctl', op: 'inputs' }) }, 'Replay da sessão')), rep, rp));

  function buildFaults() {
    fl.innerHTML = '';
    for (const f of domain.faults.falhas) {
      const tSel = h('select', {}, ...(f.alvos.length ? f.alvos : ['—']).map((a: string) => h('option', { value: a }, a))) as HTMLSelectElement;
      const nv = f.niveis ? (h('select', {}, ...f.niveis.map((n: any) => h('option', { value: n }, String(n)))) as HTMLSelectElement) : null;
      const quando = h('input', { placeholder: 'agora ou mm:ss', size: 7 }) as HTMLInputElement; const oc = h('input', { type: 'checkbox', checked: true }) as HTMLInputElement;
      const mk = (off: boolean) => ({ t: 'inject', falha: f.id, alvo: tSel.value, nivel: nv ? +nv.value : undefined, off, oculta: oc.checked });
      fl.append(h('div', { class: 'fitem' + (f.mvp ? '' : ' off') }, h('b', {}, f.id), h('span', {}, f.nome, h('small', {}, ' → ' + f.efeito)), tSel, nv, quando, h('label', {}, oc, 'oculta'),
        f.mvp ? h('button', { class: 'hw sm', onclick: () => { const q = quando.value.trim(); if (q && q !== 'agora') { const [m, s] = q.split(':').map(Number); send({ type: 'ctl', op: 'agendar', at: ((m || 0) * 60 + (s || 0)) * 1000, input: { k: 'cmd', a: [mk(false), 'instrutor'] }, desc: `${f.id} em ${tSel.value}` }); } else input('cmd', mk(false), 'instrutor'); } }, 'Injetar') : h('small', {}, 'fase 2'),
        f.mvp ? h('button', { class: 'hw sm ghost', onclick: () => input('cmd', mk(true), 'instrutor') }, 'Remover') : null));
    }
  }
  function refresh() {
    if (!last) return; const st = last.sc;
    if (cur === 'Avaliação') {
      scn.innerHTML = '';
      if (!mission) { scn.append(h('p', {}, 'Modo livre (sandbox): sem missão.')); return; }
      scn.append(h('h3', {}, `${mission.id} — ${mission.nome}`), h('p', { class: 'muted' }, mission.objetivo), h('p', {}, `Modo: ${cfg.modo} · perfil: ${cfg.perfil} · semente ${cfg.semente} · treinando: ${cfg.treinando || '—'}`));
      scn.append(h('h4', {}, 'Eventos do cenário'), ...(mission.script || []).map((s: any) => h('div', { class: 'row' }, h('span', { class: 'chip ' + (st.st.fired[s.id] ? 'ok' : '') }, st.st.fired[s.id] ? 'disparado' : s.gatilho === 'instrutor' ? 'aguarda instrutor' : 'automático'), s.desc, !st.st.fired[s.id] ? h('button', { class: 'hw sm', onclick: () => input('fire', s.id) }, 'Disparar agora') : null)));
      if (st.st.plantadas?.length) scn.append(h('p', {}, 'Anomalias plantadas: ' + st.st.plantadas.join(', ')));
      const sc = st.score; scn.append(h('h4', {}, `Avaliação parcial: ${fmt(sc.final, 1)} % — ${sc.status}`), h('div', { class: 'comps' }, ...Object.entries<any>(sc.comps).map(([k, v]) => h('div', {}, h('small', {}, domain.scoring.nomes[k]), h('b', {}, v == null ? '—' : fmt(v) + ' %')))));
      scn.append(h('h4', {}, 'Critérios'), ...mission.checks.map((c: any) => h('div', { class: 'chk ' + (st.st.checks[c.id] != null ? 'ok' : '') }, (st.st.checks[c.id] != null ? '✓ ' : '○ ') + c.label, h('small', {}, ` (${c.comp}, ${c.pts})`))));
      scn.append(h('h4', {}, 'Erros'), ...(st.st.erros.length ? st.st.erros.map((e: any) => h('div', { class: 'err sev-' + e.sev }, `${mmss(e.t)} ${e.sev.toUpperCase()} — ${e.msg}`)) : [h('small', { class: 'muted' }, 'nenhum')]));
    }
    if (cur === 'Dicas e bypass') {
      dicas.innerHTML = ''; for (const d of st?.st.dicas || []) dicas.append(h('div', {}, `${mmss(d.t)} N${d.nivel}: ${d.txt}`));
      bp.innerHTML = ''; const pend = (st?.st.pendBypass || []);
      if (!pend.length) bp.append(h('small', { class: 'muted' }, 'Nenhum pedido.'));
      for (const r of pend) { const j = h('input', { placeholder: 'Justificativa (obrigatória)', size: 40 }) as HTMLInputElement;
        bp.append(h('div', { class: 'bpi' }, h('b', {}, `${r.cmd.t} ${r.cmd.id || ''} → ${r.cmd.to || r.cmd.op || ''}`), ` regras: ${r.rules.join(', ')} · ${r.estado}`, r.estado === 'pendente' ? h('div', { class: 'row' }, j,
          h('button', { class: 'hw sm', onclick: () => { if (!j.value.trim()) return alert('Justificativa obrigatória.'); input('decidirBypass', r.id, true, j.value.trim()); } }, 'Aprovar (Supervisor)'),
          h('button', { class: 'hw sm ghost', onclick: () => input('decidirBypass', r.id, false, j.value.trim() || 'negado pelo Supervisor') }, 'Negar')) : h('small', {}, ' ' + (r.just || '')))); }
    }
    if (cur === 'Falhas') { ag.innerHTML = ''; for (const a of last.agendados || []) ag.append(h('div', {}, `T+${mmss(a.at)} — ${a.desc}${a.feito ? ' (executada)' : ''}`)); }
  }
  tr.onMessage((m) => {
    if (m.type === 'hello') {
      domain = m.domain; cfg = m.cfg; mission = m.mission; sim = new Sim(domain, 1); left.innerHTML = '';
      uni = createUnifilar(domain.layout, sim.defs, sim.nodeLevel); pmap = plantMap(domain.plant);
      left.append(h('h4', {}, 'Treinando ao vivo'), h('div', { class: 'livebox' }, pmap.svg as any, liveKv), h('h4', {}, 'Unifilar espelhado'), uni.el as any, h('div', { class: 'cinfo' }));
      buildFaults(); presets.innerHTML = '';
      for (const s of mission?.script || []) for (const a of s.do) if (a.cos) presets.append(h('button', { class: 'hw sm ghost', onclick: () => input('cos', a.cos.texto.replace(/^COS[^:]*:\s*/, ''), true) }, 'Modelo: ' + a.cos.id));
      log = []; status.textContent = `conectado (${tr.kind}) · ${mission ? mission.id : 'LIVRE'} · ${cfg.modo}`; status.className = 'chip ok'; if (!cur) show('Avaliação');
    }
    if (m.type === 'state' && !replay) {
      last = m; log.push(...m.log); if (log.length > 3000) log = log.slice(-3000);
      uni?.update({ ...m.v, bloqueios: domain.protections.bloqueios });
      if (m.player && pmap) { const pl = m.player; pmap.update(pl); liveKv.innerHTML = ''; const row = (k: string, v: string, cls = '') => liveKv.append(h('div', { class: 'ic-row' }, h('span', {}, k), h('b', { class: cls }, v)));
        row('Local', ({ casa: 'Casa de comando', bateria: 'Sala de baterias', patio: 'Pátio 138 kV', externo: 'Área externa' } as any)[pl.area] || pl.area); row('Olhando / atuando', pl.alvo || '—'); row('Na mão', pl.tool || 'mãos livres'); row('Situação', pl.sentado ? 'na mesa (supervisório)' : pl.tablet ? 'com o tablet aberto' : 'em campo');
        row('EPI vestido', pl.epi.length ? pl.epi.join(', ') : 'NENHUM', pl.epi.length ? '' : 'c-r'); if (pl.acidente) row('ACIDENTE', pl.acidente, 'c-r'); }
      clock.textContent = mmss(m.v.s.t) + (m.paused ? ' ⏸' : ` ×${m.speed}`);
      const ci = left.querySelector('.cinfo') as HTMLElement; if (ci) ci.textContent = `CC ${fmt(m.v.s.cc.v, 1)} V · QGCA ${m.v.s.ca.ok ? m.v.s.ca.ats : 'SEM CA'} · faltas ativas: ${m.v.der.faltas.map((f: any) => `${f.node} ${f.tipo} ${fmt(f.kA, 1)} kA`).join(', ') || 'nenhuma'} · emergência: ${m.v.s.emergencia ? 'ACIONADA' : 'não'}`;
      const sel = hdr.querySelector('#cps') as HTMLSelectElement; if (sel && sel.options.length - 1 !== m.checkpoints.length) { sel.innerHTML = '<option value="">Restaurar…</option>'; for (const c of m.checkpoints) sel.append(h('option', { value: c.id }, `${c.id} (${mmss(c.t)})`)); }
      if (cur === 'Linha do tempo' && m.log.length) drawLog(); else refresh();
    }
    if (m.type === 'report') { rep.innerHTML = ''; const html = reportHTML(m.rep);
      rep.append(h('div', { class: 'row' }, h('button', { class: 'hw sm', onclick: () => download(`relatorio-${m.rep.missao?.id || 'sessao'}.html`, html, 'text/html') }, 'Exportar HTML'), h('button', { class: 'hw sm', onclick: () => download(`relatorio-${m.rep.missao?.id || 'sessao'}.json`, JSON.stringify(m.rep, null, 1)) }, 'Exportar JSON')),
        h('iframe', { class: 'repframe', srcdoc: html })); }
    if (m.type === 'inputs') startReplay(m);
  });
  function startReplay(m: any) {
    rp.innerHTML = ''; const s = new Session(domain, m.cfg); s.replaying = true; s.checkpoints = m.checkpoints; s.start(); let i = 0, sp = 10, run = true;
    const end = (m.inputs.length ? m.inputs[m.inputs.length - 1].t : 0) + 3000; const prog = h('progress', { max: end, value: 0 }) as HTMLProgressElement; const t = h('b');
    const stop = () => { run = false; replay = null; status.textContent = 'conectado — replay encerrado'; };
    rp.append(h('h4', {}, 'Replay (determinístico, a partir das entradas registradas)'), h('div', { class: 'row' }, prog, t, ...[1, 10, 50].map((x) => h('button', { class: 'hw sm', onclick: () => (sp = x) }, '×' + x)), h('button', { class: 'hw sm ghost', onclick: stop }, 'Parar e voltar ao vivo')));
    replay = s; status.textContent = 'REPLAY';
    const step = () => { if (!run) return; for (let k = 0; k < sp && s.sim.s.t < end; k++) { while (i < m.inputs.length && m.inputs[i].t <= s.sim.s.t) { const x = m.inputs[i++]; (s as any)[x.k](...x.a); } s.tick(); }
      uni.update({ ...s.sim.view(), bloqueios: domain.protections.bloqueios }); prog.value = s.sim.s.t; t.textContent = mmss(s.sim.s.t); log = s.sim.log.slice(); drawLog(true);
      if (s.sim.s.t < end) requestAnimationFrame(step); else { t.textContent += ' — fim'; if (s.sc) { const r = s.sc.score(); t.textContent += ` · nota ${fmt(r.final, 1)} % (${r.status})`; } } };
    requestAnimationFrame(step);
  }
  send({ type: 'ready' });
}
