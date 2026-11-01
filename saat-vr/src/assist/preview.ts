// Prévia de manobra ("simular antes de atuar"): roda o comando numa CÓPIA do sim e compara antes × depois.
// Não altera a sessão real nem a pontuação.
import { Sim, type Cmd } from '../core/sim';
import type { Domain } from '../data';

export interface Previa { resultado: string; msg: string; regras: string[]; linhas: string[]; alerta: boolean }
export function preverManobra(d: Domain, sim: Sim, cmd: Cmd): Previa {
  const c = new Sim(d, sim.s.seed); c.mode = sim.mode; c.restore(sim.snapshot()); c.log = [];
  const ant = foto(c);
  const r = c.dispatch({ ...cmd }, 'treinando');
  if (r.result !== 'ok') return { resultado: r.result, msg: r.msg, regras: r.rules, linhas: [r.result === 'bloqueado' ? `O intertravamento impede: ${r.msg}` : r.msg], alerta: true };
  if (r.noop) return { resultado: 'ok', msg: r.msg, regras: [], linhas: ['Nada muda: o equipamento já está nessa condição.'], alerta: false };
  const e = cmd.id ? c.defs[cmd.id] : null;
  const ms = e?.type === 'DIS' ? (e.kind === 'earthing' ? d.params.manobra.terraMs : d.params.manobra.seccionadoraMs) : cmd.t === 'rack' ? d.params.manobra.extracaoMs : 300;
  c.advance(ms + 2500); const dep = foto(c); const L: string[] = []; let alerta = false;
  if (r.consequencia) { L.push(`Consequência: ${d.interlocks.consequencias?.[r.consequencia] || r.consequencia}`); alerta = true; }
  for (const [b, v] of Object.entries<any>(dep.barras)) { const a = ant.barras[b]; if (a.energ && !v.energ) { L.push(`Barra ${b} PERDE tensão`); alerta = true; } else if (!a.energ && v.energ) L.push(`Barra ${b} passa a ter tensão (${v.kV.toFixed(2)} kV)`); else if (v.energ && Math.abs(v.kV - a.kV) > 0.05) L.push(`Barra ${b}: ${a.kV.toFixed(2)} → ${v.kV.toFixed(2)} kV`); }
  for (const [al, s] of Object.entries<boolean>(dep.cargas)) if (ant.cargas[al] && !s) { L.push(`Alimentador ${al} fica SEM energia (interrupção de carga)`); alerta = true; } else if (!ant.cargas[al] && s) L.push(`Alimentador ${al} volta a ter energia`);
  for (const T of ['T1', 'T2']) { const a = ant.tr[T], b = dep.tr[T]; if (Math.abs(a.pct - b.pct) > 2) L.push(`${T}: carregamento ${a.pct.toFixed(0)} % → ${b.pct.toFixed(0)} %${b.pct > 100 ? ' (ACIMA DA NOMINAL)' : ''}`); if (b.pct > 100) alerta = true; if (a.energ && !b.energ) L.push(`${T} fica desenergizado`); if (!a.energ && b.energ) L.push(`${T} é energizado (inrush: o 87T deve ser bloqueado pela 2ª harmônica)`); }
  if (cmd.id === '52-P' && cmd.op === 'close') { const k = c.icc('MT1', '3f'); L.push(`Curto-circuito na MT passa a ≈ ${k.toFixed(1)} kA (capacidade dos disjuntores MT: ${d.params.disjuntor.mt.kA} kA)`); }
  const prot = c.log.filter((x) => x.kind === 'prot'); for (const p of prot.slice(0, 6)) { L.push(`Proteção: ${p.msg}`); alerta = true; }
  const novos = dep.alarmes.filter((a: string) => !ant.alarmes.includes(a)); if (novos.length) L.push(`Alarmes novos: ${novos.slice(0, 5).join('; ')}`);
  if (!L.length) L.push('Sem efeito elétrico relevante (nenhuma barra ou carga muda).');
  return { resultado: 'ok', msg: r.msg, regras: [], linhas: L, alerta };
}
function foto(c: Sim) {
  const barras: any = {}; for (const [k, v] of Object.entries<any>(c.der.barras)) barras[k] = { energ: v.energ, kV: v.kV };
  const tr: any = {}; for (const T of ['T1', 'T2']) tr[T] = { pct: c.der.tr[T]?.pct || 0, energ: !!c.der.tr[T]?.energ };
  return { barras, cargas: { ...c.der.supplied }, tr, alarmes: c.s.alarmes.filter((a: any) => a.ativo).map((a: any) => a.text) };
}
