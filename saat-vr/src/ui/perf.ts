// Relatório de desempenho do treinando (HTML autocontido, imprimível/exportável).
import type { Treinando } from '../train/trainees';
import { progresso, validade } from '../train/trainees';

const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const f1 = (x: number) => (isFinite(x) ? x.toFixed(1).replace('.', ',') : '—');
const DICA: Record<string, string> = {
  seguranca: 'Reforçar a sequência de desenergização (NR-10 10.5.1), o uso e a inspeção de EPI e o respeito às zonas de risco. Repetir M1 no nível básico com roteiro.',
  sequencia: 'Treinar a ordem das manobras (disjuntor antes de seccionadora, AT antes de MT na energização). Usar a prévia do assistente antes de atuar.',
  diagnostico: 'Ler relés, alarmes e medições antes de decidir. Praticar R1/R2 e C1 com foco na folha de leitura e no diagnóstico.',
  comunicacao: 'Fazer read-back de toda ordem do COS e registrar início/fim. Praticar com o instrutor no papel de COS.',
  tempo: 'Ganhar fluência nas telas e no 3D (atalhos, mapa) e evitar interrupções indevidas de carga.',
};

export function perfHTML(t: Treinando, d: any): string {
  const R = t.resultados.slice().sort((a, b) => a.data.localeCompare(b.data)); const P = progresso(t, d.levels);
  const n = R.length, apr = R.filter((r) => r.aprovado).length, media = n ? R.reduce((a, r) => a + r.nota, 0) / n : NaN, crit = R.reduce((a, r) => a + r.criticos, 0), horas = R.reduce((a, r) => a + r.duracaoS, 0) / 3600;
  const comps = Object.keys(d.scoring.pesos).map((k) => { const v = R.map((r) => r.comps[k]).filter((x) => x != null) as number[]; return { k, nome: d.scoring.nomes[k], peso: d.scoring.pesos[k], v: v.length ? v.reduce((a, b) => a + b, 0) / v.length : null }; });
  const fraca = comps.filter((c) => c.v != null).sort((a, b) => (a.v as number) - (b.v as number))[0];
  // gráfico de linha: nota por sessão (uma série; linha de aprovação como referência)
  const W = 640, H = 200, X = (i: number) => 44 + (n <= 1 ? 280 : (i / (n - 1)) * 576), Y = (v: number) => 176 - (v / 100) * 156;
  const linha = n ? `<svg viewBox="0 0 ${W} ${H}" class="ch" role="img" aria-label="Nota por sessão">
    ${[0, 50, 100].map((v) => `<line x1="44" x2="620" y1="${Y(v)}" y2="${Y(v)}" class="g"/><text x="36" y="${Y(v) + 4}" class="ax" text-anchor="end">${v}</text>`).join('')}
    <line x1="44" x2="620" y1="${Y(70)}" y2="${Y(70)}" class="ref"/><text x="620" y="${Y(70) - 5}" class="ax" text-anchor="end">aprovação 70 %</text>
    ${n > 1 ? `<polyline points="${R.map((r, i) => `${X(i)},${Y(r.nota)}`).join(' ')}" class="ln"/>` : ''}
    ${R.map((r, i) => `<circle cx="${X(i)}" cy="${Y(r.nota)}" r="5" class="pt ${r.aprovado ? '' : 'rp'}"><title>${esc(r.missao)} · ${new Date(r.data).toLocaleDateString('pt-BR')} · ${f1(r.nota)} % · ${r.aprovado ? 'aprovado' : 'reprovado'}</title></circle>`).join('')}
    ${R.length ? `<text x="${X(n - 1)}" y="${Y(R[n - 1].nota) - 10}" class="lb" text-anchor="middle">${f1(R[n - 1].nota)} %</text>` : ''}
  </svg>` : '<p class="muted">Sem sessões registradas.</p>';
  // barras horizontais: média por competência (magnitude, uma cor)
  const barras = `<svg viewBox="0 0 640 ${comps.length * 34 + 10}" class="ch" role="img" aria-label="Média por competência">${comps.map((c, i) => { const y = 8 + i * 34, w = c.v == null ? 0 : (c.v / 100) * 400;
    return `<text x="0" y="${y + 15}" class="ax">${esc(c.nome)} (${c.peso} %)</text><rect x="200" y="${y}" width="400" height="20" rx="4" class="bg"/>${c.v == null ? '' : `<rect x="200" y="${y}" width="${Math.max(4, w)}" height="20" rx="4" class="br"><title>${esc(c.nome)}: ${f1(c.v)} %</title></rect>`}<text x="${c.v == null ? 206 : 206 + w}" y="${y + 15}" class="lb">${c.v == null ? 'não avaliada' : f1(c.v) + ' %'}</text>`; }).join('')}</svg>`;
  const porMissao = d.missions.missoes.map((m: any) => { const rs = R.filter((r) => r.missao === m.id); return { m, n: rs.length, best: rs.length ? Math.max(...rs.map((r) => r.nota)) : NaN, last: rs[rs.length - 1], ok: rs.some((r) => r.aprovado) }; });
  const erros = new Map<string, number>(); for (const r of R) for (const e of r.erros) erros.set(`${e.sev}|${e.msg}`, (erros.get(`${e.sev}|${e.msg}`) || 0) + 1);
  const topErr = [...erros.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const v1 = validade(t.nr10Basico), v2 = validade(t.nr10Sep);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Desempenho — ${esc(t.nome)}</title><style>
:root{--ink:#0b0b0b;--ink2:#52514e;--mut:#7a7975;--line:#e6e4df;--s1:#2a78d6;--ok:#1a7f37;--bad:#b42318;--warn:#9a6700}
body{font:14px/1.45 system-ui,"Segoe UI",Arial;margin:28px;color:var(--ink);background:#fcfcfb}h1{font-size:21px;margin:0}h2{font-size:15px;margin:24px 0 8px;padding-bottom:4px;border-bottom:1px solid var(--line)}
.muted{color:var(--mut)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:14px 0}.kpi{border:1px solid var(--line);border-radius:10px;padding:10px;background:#fff}.kpi small{display:block;color:var(--ink2)}.kpi b{font-size:22px}
table{border-collapse:collapse;width:100%;background:#fff}td,th{border-bottom:1px solid var(--line);padding:5px 7px;text-align:left;font-size:13px}th{color:var(--ink2);font-weight:600}
.ok{color:var(--ok)}.bad{color:var(--bad)}.warn{color:var(--warn)}.tag{display:inline-block;padding:1px 8px;border-radius:99px;border:1px solid currentColor;font-size:12px}
.ch{width:100%;max-width:680px;height:auto;display:block}.ch .g{stroke:var(--line);stroke-width:1}.ch .ref{stroke:var(--ink2);stroke-width:1.5;stroke-dasharray:5 4}.ch .ax{fill:var(--ink2);font-size:11px}.ch .lb{fill:var(--ink);font-size:12px;font-weight:600}
.ch .ln{fill:none;stroke:var(--s1);stroke-width:2;stroke-linejoin:round}.ch .pt{fill:var(--s1);stroke:#fcfcfb;stroke-width:2}.ch .pt.rp{fill:#fcfcfb;stroke:var(--s1);stroke-width:2.5}.ch .bg{fill:#f1f0ec}.ch .br{fill:var(--s1)}
.lv{display:flex;gap:10px;flex-wrap:wrap}.lv div{flex:1;min-width:180px;border:1px solid var(--line);border-radius:10px;padding:10px;background:#fff}.bar{height:8px;background:#f1f0ec;border-radius:4px;margin-top:6px}.bar i{display:block;height:8px;background:var(--s1);border-radius:4px}
@media print{body{margin:10mm;background:#fff}}
</style></head><body>
<h1>Relatório de desempenho — SAAT</h1>
<p><b>${esc(t.nome)}</b> · matrícula ${esc(t.matricula || '—')} · ${esc(t.funcao)} · ${esc(t.empresa || '')}<br>
<span class="muted">NR-10 básico:</span> <span class="${v1.cls}">${esc(v1.txt)}</span> · <span class="muted">NR-10 SEP:</span> <span class="${v2.cls}">${esc(v2.txt)}</span> · <span class="muted">gerado em ${new Date().toLocaleString('pt-BR')}</span></p>
<div class="grid"><div class="kpi"><small>Nível atual</small><b>${esc(P.atual.nome)}</b></div><div class="kpi"><small>Sessões</small><b>${n}</b></div><div class="kpi"><small>Aprovação</small><b>${n ? Math.round((apr / n) * 100) : 0} %</b></div>
<div class="kpi"><small>Nota média</small><b>${f1(media)}</b></div><div class="kpi"><small>Erros críticos</small><b class="${crit ? 'bad' : 'ok'}">${crit}</b></div><div class="kpi"><small>Horas de treino</small><b>${f1(horas)}</b></div></div>
<h2>Progresso por nível</h2><div class="lv">${P.niveis.map((l: any) => `<div><b>${esc(l.nome)}</b> ${l.liberado ? '' : '<span class="muted">🔒 bloqueado</span>'}<br><small class="muted">${l.feitas.length}/${l.missoes.length} missões aprovadas: ${l.missoes.map((m: string) => `${m}${l.feitas.includes(m) ? ' ✓' : ''}`).join(', ')}</small><div class="bar"><i style="width:${(l.feitas.length / l.missoes.length) * 100}%"></i></div></div>`).join('')}</div>
<h2>Nota por sessão</h2>${linha}<p class="muted">Ponto cheio = aprovado; ponto vazio = reprovado. Passe o mouse para ver a missão.</p>
<h2>Média por competência</h2>${barras}
${fraca ? `<p><b>Ponto a desenvolver:</b> ${esc(fraca.nome)} (${f1(fraca.v as number)} %). ${esc(DICA[fraca.k] || '')}</p>` : ''}
<h2>Por missão</h2><table><tr><th>Missão</th><th>Nível</th><th>Tentativas</th><th>Melhor nota</th><th>Última</th><th>Situação</th></tr>${porMissao.map((x: any) => `<tr><td>${x.m.id} — ${esc(x.m.nome)}</td><td>${x.m.nivel}</td><td>${x.n}</td><td>${x.n ? f1(x.best) + ' %' : '—'}</td><td>${x.last ? f1(x.last.nota) + ' % · ' + new Date(x.last.data).toLocaleDateString('pt-BR') : '—'}</td><td>${x.n ? (x.ok ? '<span class="tag ok">✓ aprovado</span>' : '<span class="tag bad">✗ não aprovado</span>') : '<span class="muted">não feita</span>'}</td></tr>`).join('')}</table>
<h2>Erros mais frequentes</h2>${topErr.length ? `<table><tr><th>Gravidade</th><th>Erro</th><th>Vezes</th></tr>${topErr.map(([k, c]) => { const [sev, msg] = k.split('|'); return `<tr><td class="${sev === 'critico' ? 'bad' : sev === 'maior' ? 'warn' : ''}">${esc(sev)}</td><td>${esc(msg)}</td><td>${c}</td></tr>`; }).join('')}</table>` : '<p class="ok">Nenhum erro registrado.</p>'}
<h2>Histórico de sessões</h2><table><tr><th>Data</th><th>Missão</th><th>Nível</th><th>Nota</th><th>Situação</th><th>Críticos</th><th>Duração</th><th>Dicas</th></tr>${R.slice().reverse().map((r) => `<tr><td>${new Date(r.data).toLocaleString('pt-BR')}</td><td>${esc(r.missao)}</td><td>${esc(r.nivel)}</td><td>${f1(r.nota)} %</td><td class="${r.aprovado ? 'ok' : 'bad'}">${r.aprovado ? '✓' : '✗'} ${esc(r.status)}</td><td>${r.criticos}</td><td>${Math.round(r.duracaoS / 60)} min</td><td>${r.dicas}</td></tr>`).join('')}</table>
<p class="muted">Treinamento em simulador. Não substitui a capacitação NR-10 nem a autorização formal da empresa.</p></body></html>`;
}
