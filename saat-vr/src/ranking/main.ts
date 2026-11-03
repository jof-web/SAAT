// Tela de ranking do SAAT (TV/segunda tela). Fontes: o cadastro deste navegador (mesma origem do simulador, ao vivo)
// e arquivos "Exportar ranking público" de outros aparelhos (Quest, outros PCs). Guarda só a versão pública (LGPD:
// apelido com consentimento ou código, nível e indicadores). Telas giram sozinhas: Pontuação, Horas, Destaques da
// semana, Recordes por missão e Equipe.
import '../game/fonts.css';
import * as TR from '../train/trainees';
import { rankingPublico, type RankingPub, type PessoaPub } from '../train/publico';
import levels from '../data/levels.json';
import missions from '../data/missions.json';

const KEY = 'saat-ranking:importados', ROT = 15000;
const MISS = (missions as any).missoes.map((m: any) => ({ id: m.id, nome: m.nome }));
const n1 = (v: number, d = 1) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const hhmm = (h: number) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`; };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function importados(): Record<string, RankingPub> { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } }
function guardar(o: Record<string, RankingPub>) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* cheio */ } }
function local(): RankingPub | null { const l = TR.listar(); return l.length ? rankingPublico(l, levels, MISS, 'este aparelho') : null; }
/** Aceita o arquivo público ou o backup completo (este é convertido na hora e só a versão pública fica guardada). */
async function importar(f: File) { const o = JSON.parse(await f.text()), all = importados(); let pub: RankingPub;
  if (o?.formato === 'saat-ranking') pub = o; else if (o?.formato === 'saat-treinandos' || Array.isArray(o) || Array.isArray(o?.treinandos)) pub = rankingPublico(Array.isArray(o) ? o : o.treinandos, levels, MISS, f.name.replace(/\.json$/i, ''));
  else throw new Error('arquivo não é do SAAT'); all[pub.origem] = pub; guardar(all); return pub.pessoas.length; }

interface Junto { pessoas: PessoaPub[]; fontes: string[]; equipe: RankingPub['equipe']; missoes: Record<string, string>; gerado: string }
function juntar(): Junto {
  const src = [local(), ...Object.values(importados())].filter(Boolean) as RankingPub[], by = new Map<string, PessoaPub>();
  for (const r of src) for (const p of r.pessoas) { const e = by.get(p.id); if (!e || p.sessoes > e.sessoes || (p.sessoes === e.sessoes && p.horas > e.horas)) by.set(p.id, p); } // mesma pessoa em dois aparelhos: fica o registro mais completo
  const pessoas = [...by.values()], ss = src.reduce((a, r) => a + r.equipe.sessoes, 0) || 1, mes = Date.now() - 30 * 864e5;
  const equipe = { pessoas: pessoas.length, ativos30: pessoas.filter((p) => p.ultima && Date.parse(p.ultima) >= mes).length, horas: pessoas.reduce((a, p) => a + p.horas, 0), sessoes: pessoas.reduce((a, p) => a + p.sessoes, 0),
    aprovacao: src.reduce((a, r) => a + r.equipe.aprovacao * r.equipe.sessoes, 0) / ss, semAcidente: src.reduce((a, r) => a + r.equipe.semAcidente * r.equipe.sessoes, 0) / ss, acidentes: src.reduce((a, r) => a + r.equipe.acidentes, 0),
    ultimoAcidente: src.map((r) => r.equipe.ultimoAcidente).filter(Boolean).sort().pop() || '', faltas: src.reduce((a, r) => a + r.equipe.faltas, 0), missoesAprovadas: pessoas.reduce((a, p) => a + p.aprovadas, 0) };
  return { pessoas, fontes: src.map((r) => r.origem), equipe, missoes: Object.assign({}, ...src.map((r) => r.missoes)), gerado: new Date().toISOString() };
}

// ---------------- telas ----------------
const SLIDES: [string, string, (J: Junto) => string][] = [
  ['pontos', 'Pontuação', (J) => { const L = [...J.pessoas].filter((p) => p.sessoes).sort((a, b) => b.pontos - a.pontos || b.media - a.media).slice(0, 10);
    return tabela(['', 'Participante', 'Nível', 'Missões', 'Média', 'Pontos'], L.map((p, i) => [pos(i), nome(p), esc(p.nivel), `${p.aprovadas}/${p.total}`, n1(p.media), `<b class="big">${n1(p.pontos, 0)}</b>`]), 'Pontos = soma da melhor nota de cada missão. Média de todas as tentativas.'); }],
  ['horas', 'Horas de treino', (J) => { const L = [...J.pessoas].sort((a, b) => b.horas - a.horas).slice(0, 10), mx = Math.max(0.01, ...L.map((p) => p.horas));
    return `<div class="bars">${L.map((p, i) => `<div class="br"><span class="bp">${pos(i)}</span><span class="bn">${nome(p)}</span><span class="bt"><i style="width:${(p.horas / mx) * 100}%"></i></span><b>${hhmm(p.horas)}</b><small>${p.horasVR >= 0.05 ? 'VR ' + hhmm(p.horasVR) : ''}</small></div>`).join('') || vazio()}</div><p class="nota">Tempo real de treino no simulador (PC e VR).</p>`; }],
  ['semana', 'Destaques da semana', (J) => { const P = J.pessoas, top = (f: (p: PessoaPub) => number, fmt: (v: number) => string, t: string, s: string) => { const p = [...P].sort((a, b) => f(b) - f(a))[0]; return card(t, p && f(p) > 0 ? nome(p) : '—', p && f(p) > 0 ? fmt(f(p)) : 'sem registro', s); };
    return `<div class="cards">${top((p) => p.semana.horas, hhmm, 'Mais horas', 'últimos 7 dias')}${top((p) => p.semana.sessoes, (v) => v + ' sessões', 'Mais sessões', 'últimos 7 dias')}${top((p) => p.evolucao, (v) => '+' + n1(v) + ' pts', 'Maior evolução', 'média das 5 últimas × 5 primeiras')}${top((p) => p.sequencia, (v) => v + (v > 1 ? ' dias' : ' dia'), 'Maior sequência', 'dias seguidos treinando')}</div>`; }],
  ['recordes', 'Recordes por missão', (J) => { const ids = Object.keys(J.missoes).filter((m) => J.pessoas.some((p) => p.recordes[m]));
    return tabela(['Missão', 'Recorde', 'Tempo', 'Participante'], ids.map((m) => { const p = [...J.pessoas].filter((x) => x.recordes[m]).sort((a, b) => b.recordes[m].nota - a.recordes[m].nota || a.recordes[m].tempoS - b.recordes[m].tempoS)[0], r = p.recordes[m];
      return [`<b>${esc(m)}</b> <span class="mut">${esc(J.missoes[m] || '')}</span>`, `<b class="big">${n1(r.nota)}</b>`, `${Math.floor(r.tempoS / 60)}:${String(Math.round(r.tempoS % 60)).padStart(2, '0')}`, nome(p)]; }), 'Empate na nota: vence o menor tempo.'); }],
  ['equipe', 'Equipe', (J) => { const E = J.equipe, dias = E.ultimoAcidente ? Math.floor((Date.now() - Date.parse(E.ultimoAcidente)) / 864e5) : null;
    return `<div class="kpis">${kpi(hhmm(E.horas), 'horas treinadas')}${kpi(String(E.sessoes), 'sessões avaliadas')}${kpi(`${E.ativos30}/${E.pessoas}`, 'ativos nos últimos 30 dias')}${kpi(n1(E.aprovacao * 100, 0) + ' %', 'taxa de aprovação')}${kpi(n1(E.semAcidente * 100, 0) + ' %', 'sessões sem acidente simulado', E.semAcidente >= 0.95 ? 'ok' : 'warn')}${kpi(dias === null ? '—' : String(dias), dias === null ? 'nenhum acidente simulado' : 'dias sem acidente simulado')}${kpi(String(E.missoesAprovadas), 'missões aprovadas')}</div><p class="nota">Segurança só em números da equipe: ninguém é exposto individualmente.</p>`; }],
];
const pos = (i: number) => `<span class="pos p${i + 1}">${i + 1}</span>`;
const nome = (p: PessoaPub) => `<span class="nm">${esc(p.nome)}</span>`;
const vazio = () => '<p class="vazio">Sem dados ainda. Treine no simulador neste aparelho ou importe o arquivo “Exportar ranking público” do Admin.</p>';
const card = (t: string, quem: string, v: string, s: string) => `<div class="card"><small>${t}</small><b>${quem}</b><strong>${v}</strong><span>${s}</span></div>`;
const kpi = (v: string, l: string, c = '') => `<div class="kpi ${c}"><b>${v}</b><span>${l}</span></div>`;
const tabela = (H: string[], R: string[][], nota: string) => R.length ? `<table class="${R.length > 7 ? 'compacta' : ''}"><thead><tr>${H.map((x) => `<th>${x}</th>`).join('')}</tr></thead><tbody>${R.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table><p class="nota">${nota}</p>` : vazio();

// ---------------- página ----------------
const css = `:root{--bg:#0f1214;--panel:#171b1f;--panel2:#1e2328;--line:#2a3036;--tx:#e8ebed;--tx2:#9aa3aa;--acc:#f2c230;--ok:#3da56a;--warn:#e39b2d;--f:"Barlow",system-ui,sans-serif;--fc:"Barlow Condensed","Barlow","Arial Narrow",sans-serif}
*{box-sizing:border-box}html,body{margin:0;height:100%;background:var(--bg);color:var(--tx);font:500 18px/1.35 var(--f)}
#app{display:grid;grid-template-rows:auto 1fr auto;height:100vh;padding:clamp(12px,2.2vw,36px);gap:clamp(10px,1.6vw,24px)}
header{display:flex;align-items:center;gap:20px;flex-wrap:wrap}header h1{margin:0;font:700 clamp(24px,3vw,46px)/1 var(--fc);letter-spacing:.02em}header h1 span{color:var(--acc)}
.tabs{display:flex;gap:6px;flex-wrap:wrap}.tabs button{background:var(--panel);color:var(--tx2);border:1px solid var(--line);border-radius:3px;padding:6px 12px;font:600 15px var(--fc);letter-spacing:.04em;cursor:pointer}.tabs button.on{background:var(--acc);color:#111;border-color:var(--acc)}
.clock{margin-left:auto;text-align:right;font:600 clamp(18px,2vw,30px) var(--fc)}.clock small{display:block;font:500 13px var(--f);color:var(--tx2)}
main{background:var(--panel);border:1px solid var(--line);border-radius:4px;padding:clamp(14px,2vw,32px);overflow:hidden;min-height:0}
main h2{margin:0 0 clamp(10px,1.4vw,20px);font:700 clamp(28px,3.4vw,56px)/1 var(--fc)}
table{width:100%;border-collapse:collapse;font-size:clamp(16px,1.6vw,26px)}th{text-align:left;color:var(--tx2);font:600 clamp(13px,1.1vw,17px) var(--fc);letter-spacing:.08em;text-transform:uppercase;padding:6px 10px;border-bottom:1px solid var(--line)}
td{padding:clamp(6px,0.8vw,12px) 10px;border-bottom:1px solid var(--line)}table.compacta{font-size:clamp(14px,1.3vw,21px)}table.compacta td{padding:clamp(3px,0.45vw,8px) 10px}table.compacta .big{font-size:clamp(17px,1.6vw,26px)}td .big,.big{font:700 clamp(20px,2vw,32px) var(--fc);color:var(--tx)}.mut{color:var(--tx2);font-size:.85em}
.pos{display:inline-grid;place-items:center;width:1.7em;height:1.7em;border-radius:50%;background:var(--panel2);font:700 1em var(--fc)}.pos.p1{background:var(--acc);color:#111}.pos.p2{background:#c9ced1;color:#111}.pos.p3{background:#b07a4a;color:#111}
.nm{font-weight:600}.nota{color:var(--tx2);font-size:14px;margin:12px 0 0}.vazio{color:var(--tx2);font-size:22px}
.bars{display:grid;gap:clamp(6px,0.9vw,12px)}.br{display:grid;grid-template-columns:2.4em minmax(8em,16em) 1fr 6.5em 6em;align-items:center;gap:12px;font-size:clamp(16px,1.6vw,26px)}
.bt{height:14px;background:var(--panel2);border-radius:7px;overflow:hidden}.bt i{display:block;height:100%;background:var(--acc);border-radius:7px}.br b{font:700 1em var(--fc);text-align:right}.br small{color:var(--tx2);font-size:.7em}
.cards,.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:clamp(10px,1.4vw,20px)}
.card,.kpi{background:var(--panel2);border:1px solid var(--line);border-radius:4px;padding:clamp(14px,1.6vw,26px);display:flex;flex-direction:column;gap:6px}
.card small{color:var(--acc);font:700 15px var(--fc);letter-spacing:.1em;text-transform:uppercase}.card b{font:700 clamp(24px,2.4vw,40px)/1.1 var(--fc)}.card strong{font:700 clamp(20px,2vw,32px) var(--fc);color:var(--tx)}.card>span{color:var(--tx2);font-size:14px}
.kpi b{font:700 clamp(36px,4vw,72px)/1 var(--fc)}.kpi span{color:var(--tx2)}.kpi.ok b{color:var(--ok)}.kpi.warn b{color:var(--warn)}
footer{display:flex;align-items:center;gap:12px;flex-wrap:wrap;color:var(--tx2);font-size:13px}footer button{background:var(--panel);color:var(--tx);border:1px solid var(--line);border-radius:3px;padding:7px 12px;font:600 14px var(--f);cursor:pointer}
footer .lgpd{margin-left:auto;max-width:60ch}.msg{color:var(--acc)}
@media (max-width:700px){.br{grid-template-columns:2em 1fr 5.5em}.br .bt,.br small{display:none}.clock{margin-left:0}}`;
const st = document.createElement('style'); st.textContent = css; document.head.append(st);
const app = document.getElementById('app')!; let idx = 0, auto = true, timer = 0 as any, msg = '';
function render() {
  const J = juntar(), [id, titulo, fn] = SLIDES[idx], agora = new Date();
  app.innerHTML = `<header><h1>SAAT <span>·</span> Ranking do treinamento</h1><div class="tabs">${SLIDES.map(([k, t], i) => `<button data-i="${i}" class="${i === idx ? 'on' : ''}">${t}</button>`).join('')}</div>
    <div class="clock">${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}<small>${agora.toLocaleDateString('pt-BR')} · ${J.pessoas.length} participantes · ${J.fontes.length} fonte(s)</small></div></header>
    <main data-tela="${id}"><h2>${titulo}</h2>${fn(J)}</main>
    <footer><button id="imp">Importar arquivo do ranking</button><button id="fs">Tela cheia</button><button id="rot">${auto ? 'Pausar rotação' : 'Girar telas'}</button><button id="lim">Limpar importados</button><span class="msg">${esc(msg)}</span>
      <span class="lgpd">LGPD: dados pseudonimizados. Aparece o apelido só de quem autorizou no cadastro; os demais aparecem por código. Sem matrícula, empresa, função ou erros individuais.</span></footer>`;
  app.querySelectorAll<HTMLButtonElement>('.tabs button').forEach((b) => (b.onclick = () => { idx = +b.dataset.i!; render(); restart(); }));
  (app.querySelector('#imp') as HTMLButtonElement).onclick = () => { const f = document.createElement('input'); f.type = 'file'; f.accept = '.json,application/json'; f.multiple = true; f.onchange = async () => { let n = 0; try { for (const x of Array.from(f.files || [])) n += await importar(x); msg = `${n} participante(s) importado(s).`; } catch (e: any) { msg = 'Não importou: ' + e.message; } render(); }; f.click(); };
  (app.querySelector('#fs') as HTMLButtonElement).onclick = () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); };
  (app.querySelector('#rot') as HTMLButtonElement).onclick = () => { auto = !auto; restart(); render(); };
  (app.querySelector('#lim') as HTMLButtonElement).onclick = () => { if (confirm('Remover os dados importados de outros aparelhos desta tela?')) { localStorage.removeItem(KEY); msg = 'Importados removidos.'; render(); } };
}
function restart() { clearInterval(timer); if (auto) timer = setInterval(() => { idx = (idx + 1) % SLIDES.length; render(); }, ROT); }
addEventListener('storage', (e) => { if (!e.key || e.key === 'saat:treinandos' || e.key === KEY) render(); }); // treino ao vivo em outra aba/janela
setInterval(() => { if (!auto) render(); }, 30000);
render(); restart();
(window as any).__ranking = { juntar, importar, render };
