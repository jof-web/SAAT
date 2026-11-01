// Relatório pós-sessão em HTML autocontido (exportável).
const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const t = (ms: number) => { const s = Math.floor((ms || 0) / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
export function reportHTML(r: any): string {
  const n = r.nota || {}; const comps = Object.entries<any>(n.comps || {});
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório ${esc(r.missao?.id)}</title><style>
body{font:14px/1.45 system-ui,Segoe UI,Arial;margin:24px;color:#1b1f24;background:#fff}h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:22px 0 6px;border-bottom:1px solid #ccd;padding-bottom:3px}
table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #e3e6ea;padding:4px 6px;text-align:left;vertical-align:top}th{background:#f3f5f7}.ok{color:#1a7f37}.bad{color:#b42318}.crit{background:#fde8e8}.big{font-size:28px;font-weight:700}.muted{color:#667}small{color:#667}
</style></head><body>
<h1>Relatório de treinamento — SAAT · SE Vale Verde</h1>${r.treinando ? `<div><b>${esc(r.treinando.nome)}</b> · matrícula ${esc(r.treinando.matricula || '—')} · ${esc(r.treinando.funcao || '')}${r.nivel ? ` · nível <b>${esc(r.nivel.nome)}</b>` : ''}</div>` : ''}
<div class="muted">Missão ${esc(r.missao?.id)} — ${esc(r.missao?.nome)} · perfil ${esc(r.perfil)} · modo ${esc(r.modo)} · semente ${esc(r.semente)} · duração ${t((n.elapsed || 0) * 1000)}</div>
<p><span class="big ${String(n.status).startsWith('APROVADO') ? 'ok' : 'bad'}">${(n.final ?? 0).toFixed(1)} %</span> &nbsp; <b>${esc(n.status)}</b> · dicas: −${n.dicasPen || 0} p.p. · bônus: +${n.bonus || 0} p.p.</p>
<h2>Nota por competência</h2><table><tr><th>Competência</th><th>Peso</th><th>Nota</th></tr>${comps.map(([k, v]) => `<tr><td>${esc(r.nomes?.[k] || k)}</td><td>${r.pesos?.[k]} %</td><td>${v == null ? '— (não avaliada)' : v.toFixed(0) + ' %'}</td></tr>`).join('')}</table>
<h2>Erros por gravidade</h2>${r.erros?.length ? `<table><tr><th>Tempo</th><th>Gravidade</th><th>Competência</th><th>Descrição</th><th>Regra</th></tr>${r.erros.map((e: any) => `<tr class="${e.sev === 'critico' ? 'crit' : ''}"><td>${t(e.t)}</td><td>${esc(e.sev)}</td><td>${esc(e.comp)}</td><td>${esc(e.msg)}</td><td>${esc(e.regra || '')}</td></tr>`).join('')}</table>` : '<p class="ok">Nenhum erro registrado.</p>'}
<h2>Critérios da missão</h2><table>${(r.checks || []).map((c: any) => `<tr><td class="${c.feito ? 'ok' : 'bad'}">${c.feito ? '✓' : '✗'}</td><td>${esc(c.label)}</td><td>${esc(c.comp)}</td><td>${c.pts}</td><td>${c.feito ? t(c.t) : ''}</td></tr>`).join('')}</table>
${r.etapas?.length ? `<h2>Etapas do perfil normativo</h2><table>${r.etapas.map((e: any) => `<tr><td>${esc(e.nome)}</td><td>${e.t != null ? t(e.t) : '<span class="bad">não concluída</span>'}</td></tr>`).join('')}</table>` : ''}
${r.leituras && Object.keys(r.leituras).length ? `<h2>Folha de leitura</h2><table><tr><th>Item</th><th>Anotado</th><th>Instrumento</th><th></th></tr>${Object.entries<any>(r.leituras).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v.valor)}</td><td>${v.ref == null ? '—' : esc(Number(v.ref).toFixed(2))}</td><td class="${v.ok ? 'ok' : 'bad'}">${v.ok ? '✓' : '✗'}</td></tr>`).join('')}</table>` : ''}
${r.apr ? `<h2>APR</h2><p>Acerto ${esc(r.apr.pct)} % · riscos esquecidos: ${esc((r.apr.faltou || []).join(', ') || 'nenhum')}</p>` : ''}
${r.epiUso?.length ? `<h2>EPI e ferramentas</h2><ul>${r.epiUso.map((x: string) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
${r.bonus?.length ? `<h2>Bônus</h2><ul>${r.bonus.map((b: string) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
<h2>Continuidade (DEC/FEC didático)</h2><table><tr><th>Alimentador</th><th>Interrupções</th><th>Minutos sem fornecimento (simulado)</th></tr>${(r.continuidade || []).map((c: any) => `<tr><td>${c.al}</td><td>${c.interrupcoes}</td><td>${c.minutos}</td></tr>`).join('')}</table>
<h2>Linha do tempo</h2><table><tr><th>Tempo</th><th>Horário</th><th>Ator</th><th>Evento</th><th>Resultado</th><th>Regra</th></tr>${(r.log || []).map((e: any) => `<tr class="${e.kind === 'err' && e.sev === 'critico' ? 'crit' : ''}"><td>${t(e.t)}</td><td><small>${esc(e.hora?.slice(11, 19))}</small></td><td>${esc(e.actor)}</td><td>${esc(e.msg)}${e.just ? `<br><small>justificativa: ${esc(e.just)}</small>` : ''}</td><td>${esc(e.result || '')}</td><td>${esc((e.rules || []).join(', '))}</td></tr>`).join('')}</table>
<p class="muted">Procedimentos didáticos, sujeitos à validação do engenheiro responsável. Não constitui declaração de conformidade normativa.</p>
</body></html>`;
}
