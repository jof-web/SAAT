// Cadastro de treinandos, histórico de resultados e progressão por nível. Persistência local (localStorage) + backup JSON.
import { LS } from '../ui/dom';

export interface Resultado {
  id: string; data: string; missao: string; missaoNome: string; nivel: string; perfil: string; modo: string;
  nota: number; status: string; aprovado: boolean; comps: Record<string, number | null>; criticos: number;
  erros: { sev: string; msg: string; comp: string }[]; duracaoS: number; dicas: number; semente: number; faltas?: number; vr?: boolean;
}
export interface Treinando {
  id: string; nome: string; matricula: string; funcao: string; empresa: string;
  nr10Basico: string; nr10Sep: string; obs: string; criado: string; resultados: Resultado[];
}
const KEY = 'treinandos';
export const FUNCOES = ['Operador de subestação', 'Eletricista de manutenção', 'Técnico de eletrotécnica', 'Técnico de segurança', 'Engenheiro', 'Supervisor', 'Estagiário', 'Outro'];

export function listar(): Treinando[] { const v = LS.get(KEY, []); return Array.isArray(v) ? v : []; }
function gravar(l: Treinando[]) { return LS.set(KEY, l); }
export function obter(id: string) { return listar().find((t) => t.id === id) || null; }
export function salvar(t: Partial<Treinando> & { nome: string }): Treinando {
  const l = listar(); let x = t.id ? l.find((y) => y.id === t.id) : undefined;
  if (!x) { x = { id: 'T' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), nome: '', matricula: '', funcao: FUNCOES[0], empresa: '', nr10Basico: '', nr10Sep: '', obs: '', criado: new Date().toISOString(), resultados: [] }; l.push(x); }
  const { id: _id, resultados: _r, ...rest } = t as any; void _id; void _r; Object.assign(x, rest); gravar(l); return x;
}
export function remover(id: string) { gravar(listar().filter((t) => t.id !== id)); }
export function addResultado(id: string, r: Resultado) { const l = listar(); const x = l.find((t) => t.id === id); if (!x) return; x.resultados.push(r); if (x.resultados.length > 400) x.resultados.splice(0, x.resultados.length - 400); gravar(l); }

/** Progresso: missões aprovadas por nível e níveis liberados (o 1º sempre liberado). */
export function progresso(t: Treinando | null, levels: any) {
  const aprov = new Set((t?.resultados || []).filter((r) => r.aprovado).map((r) => r.missao));
  const niveis = levels.niveis.map((n: any) => ({ ...n, feitas: n.missoes.filter((m: string) => aprov.has(m)), completo: n.missoes.every((m: string) => aprov.has(m)) }));
  let liberado = true; for (const n of niveis) { n.liberado = liberado; liberado = liberado && n.completo; }
  const atual = [...niveis].reverse().find((n: any) => n.liberado) || niveis[0];
  return { niveis, atual, aprov };
}
export function validade(data: string) { if (!data) return { txt: 'não informado', cls: 'muted' }; const d = new Date(data + 'T00:00:00'); const dias = Math.floor((d.getTime() - Date.now()) / 864e5);
  return dias < 0 ? { txt: `VENCIDO (${d.toLocaleDateString('pt-BR')})`, cls: 'bad' } : dias < 60 ? { txt: `vence em ${dias} dias`, cls: 'warn' } : { txt: `válido até ${d.toLocaleDateString('pt-BR')}`, cls: 'ok' }; }
export function exportar() { return JSON.stringify({ formato: 'saat-treinandos', versao: 1, data: new Date().toISOString(), treinandos: listar() }, null, 1); }
export function importar(txt: string): number {
  const o = JSON.parse(txt); const lst: Treinando[] = Array.isArray(o) ? o : o.treinandos; if (!Array.isArray(lst)) throw new Error('arquivo sem lista de treinandos');
  const l = listar(); let n = 0;
  for (const t of lst) { if (!t?.nome) continue; const ex = l.find((x) => x.id === t.id); if (ex) { const ids = new Set(ex.resultados.map((r) => r.id)); for (const r of t.resultados || []) if (!ids.has(r.id)) ex.resultados.push(r); Object.assign(ex, { ...t, resultados: ex.resultados }); } else l.push({ ...t, resultados: t.resultados || [] }); n++; }
  gravar(l); return n;
}
export function csv(t: Treinando) {
  const head = ['data', 'missao', 'nivel', 'nota', 'status', 'criticos', 'duracao_s', 'dicas', 'seguranca', 'sequencia', 'diagnostico', 'comunicacao', 'tempo'];
  const rows = t.resultados.map((r) => [r.data, r.missao, r.nivel, r.nota.toFixed(1), r.status, r.criticos, Math.round(r.duracaoS), r.dicas, ...['seguranca', 'sequencia', 'diagnostico', 'comunicacao', 'tempo'].map((k) => (r.comps[k] == null ? '' : (r.comps[k] as number).toFixed(0)))]);
  return [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
}

/** Ranking da turma: pontos = soma da melhor nota de cada missão; tempo = horas de sessão; faltas = corridas e outras faltas de conduta. */
export interface LinhaRanking { t: Treinando; pontos: number; aprovadas: number; total: number; media: number; horas: number; faltas: number; sessoes: number; ultima: string; nivel: string }
export function ranking(levels: any): LinhaRanking[] {
  const total = levels.niveis.reduce((a: number, n: any) => a + n.missoes.length, 0);
  return listar().map((t) => { const R = t.resultados, best = new Map<string, number>(); for (const r of R) best.set(r.missao, Math.max(best.get(r.missao) ?? 0, r.nota));
    const aprov = new Set(R.filter((r) => r.aprovado).map((r) => r.missao));
    return { t, pontos: [...best.values()].reduce((a, b) => a + b, 0), aprovadas: aprov.size, total, media: R.length ? R.reduce((a, r) => a + r.nota, 0) / R.length : 0, horas: R.reduce((a, r) => a + (r.duracaoS || 0), 0) / 3600,
      faltas: R.reduce((a, r) => a + (r.faltas || 0), 0), sessoes: R.length, ultima: R.length ? R[R.length - 1].data : '', nivel: progresso(t, levels).atual.nome }; });
}
