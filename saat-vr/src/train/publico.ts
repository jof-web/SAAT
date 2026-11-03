// Dados do ranking público (LGPD: minimização e pseudonimização). Sai daqui só o necessário para a tela de ranking:
// apelido (com consentimento) ou um código estável, nível e indicadores de treino. Nunca matrícula, empresa, função,
// validade NR-10, observações nem erros individuais. Segurança (acidentes, faltas) só em números da equipe.
import { progresso, type Treinando } from './trainees';

export interface PessoaPub { id: string; nome: string; publico: boolean; nivel: string; horas: number; horasVR: number; sessoes: number; aprovadas: number; total: number; pontos: number; media: number;
  melhor: number; dias: string[]; sequencia: number; ultima: string; semana: { horas: number; sessoes: number }; evolucao: number; recordes: Record<string, { nota: number; tempoS: number }> }
export interface EquipePub { pessoas: number; ativos30: number; horas: number; sessoes: number; aprovacao: number; semAcidente: number; acidentes: number; ultimoAcidente: string; faltas: number; missoesAprovadas: number }
export interface RankingPub { formato: 'saat-ranking'; versao: 1; origem: string; gerado: string; missoes: Record<string, string>; pessoas: PessoaPub[]; equipe: EquipePub }

/** Código estável (FNV-1a) — não identifica a pessoa sem a base local. */
export function codigo(id: string) { let h = 0x811c9dc5; for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(-6); }
/** Nome exibido: apelido (ou primeiro nome + inicial) só com consentimento; senão "Participante XXXX". */
export function nomePublico(t: Treinando) { if (!t.rankingPublico) return 'Participante ' + codigo(t.id).slice(0, 4); const a = (t.apelido || '').trim(); if (a) return a.slice(0, 24); const p = t.nome.trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0]; }
const diaDe = (iso: string) => iso.slice(0, 10);
function sequencia(dias: string[]) { const s = new Set(dias); let n = 0; const d = new Date(); for (;;) { const k = d.toISOString().slice(0, 10); if (s.has(k)) { n++; d.setDate(d.getDate() - 1); } else if (n === 0 && k === new Date().toISOString().slice(0, 10)) { d.setDate(d.getDate() - 1); } else break; } return n; }

export function rankingPublico(lista: Treinando[], levels: any, missoes: { id: string; nome: string }[], origem: string): RankingPub {
  const total = levels.niveis.reduce((a: number, n: any) => a + n.missoes.length, 0), agora = Date.now(), semana = agora - 7 * 864e5, mes = agora - 30 * 864e5;
  const pessoas: PessoaPub[] = lista.map((t) => { const R = t.resultados || [], best = new Map<string, { nota: number; tempoS: number }>();
    for (const r of R) { const b = best.get(r.missao); if (!b || r.nota > b.nota || (r.nota === b.nota && r.duracaoS < b.tempoS)) best.set(r.missao, { nota: r.nota, tempoS: r.duracaoS }); }
    const aprov = new Set(R.filter((r) => r.aprovado).map((r) => r.missao)), tempo = Math.max(t.tempoS || 0, R.reduce((a, r) => a + (r.duracaoS || 0), 0));
    const dias = [...new Set([...(t.dias || []), ...R.map((r) => diaDe(r.data))])].sort(), RS = R.filter((r) => Date.parse(r.data) >= semana);
    const notas = R.map((r) => r.nota), ini = notas.slice(0, 5), fim = notas.slice(-5), av = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    const nv = progresso(t, levels).atual;
    return { id: codigo(t.id), nome: nomePublico(t), publico: !!t.rankingPublico, nivel: nv.nome, horas: tempo / 3600, horasVR: (t.tempoVR || 0) / 3600, sessoes: R.length, aprovadas: aprov.size, total,
      pontos: [...best.values()].reduce((a, b) => a + b.nota, 0), media: av(notas), melhor: notas.length ? Math.max(...notas) : 0, dias: dias.slice(-120), sequencia: sequencia(dias), ultima: R.length ? R[R.length - 1].data : (dias[dias.length - 1] || ''),
      semana: { horas: RS.reduce((a, r) => a + (r.duracaoS || 0), 0) / 3600, sessoes: RS.length }, evolucao: notas.length >= 6 ? av(fim) - av(ini) : 0, recordes: Object.fromEntries(best) }; });
  const todos = lista.flatMap((t) => t.resultados || []), acid = todos.filter((r) => (r.erros || []).some((e) => /^Acidente/.test(e.msg))), ult = acid.map((r) => r.data).sort().pop() || '';
  const equipe: EquipePub = { pessoas: lista.length, ativos30: lista.filter((t) => [...(t.dias || []), ...(t.resultados || []).map((r) => r.data)].some((d) => Date.parse(d) >= mes)).length,
    horas: pessoas.reduce((a, p) => a + p.horas, 0), sessoes: todos.length, aprovacao: todos.length ? todos.filter((r) => r.aprovado).length / todos.length : 0, semAcidente: todos.length ? 1 - acid.length / todos.length : 1,
    acidentes: acid.length, ultimoAcidente: ult, faltas: todos.reduce((a, r) => a + (r.faltas || 0), 0), missoesAprovadas: pessoas.reduce((a, p) => a + p.aprovadas, 0) };
  return { formato: 'saat-ranking', versao: 1, origem, gerado: new Date().toISOString(), missoes: Object.fromEntries(missoes.map((m) => [m.id, m.nome])), pessoas, equipe };
}
