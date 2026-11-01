// domain-data: JSON versionado. Nenhuma lógica aqui.
import topology from './topology.json';
import params from './params.json';
import interlocks from './interlocks.json';
import protections from './protections.json';
import faults from './faults.json';
import scoring from './scoring.json';
import missions from './missions.json';
import layout from './layout.json';
import plant from './plant.json';
import epi from './epi.json';
import os from './os.json';
import fmea from './fmea.json';
import kb from './kb.json';
import levels from './levels.json';
import nr10_vigente from './profiles/nr10_vigente.json';
import nr10_2026 from './profiles/nr10_2026.json';

export interface Domain {
  topology: any; params: any; interlocks: any; protections: any; faults: any;
  scoring: any; missions: any; layout: any; profiles: Record<string, any>;
  plant: any; epi: any; os: any; fmea: any; kb: any; levels: any;
}
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
export function defaultDomain(): Domain {
  return clone({ topology, params, interlocks, protections, faults, scoring, missions, layout, plant, epi, os, fmea, kb, levels,
    profiles: { nr10_vigente, nr10_2026 } }) as Domain;
}
/** Completa um pacote salvo de versão anterior com as seções novas (compatibilidade de backup). */
export function upgradeDomain(d: any): Domain {
  const def = defaultDomain();
  for (const k of Object.keys(def) as (keyof Domain)[]) if (d[k] == null) d[k] = def[k];
  if ((d.missions?.versao || '1') < '2') d.missions = def.missions;
  if ((d.params?.versao || '1') < '2') d.params = { ...def.params, ...d.params, instrumentos: def.params.instrumentos, ventilacao: def.params.ventilacao, versao: '2.0.0' };
  return d as Domain;
}
/** Validação estrutural mínima (schema) do pacote de domínio. Retorna lista de erros. */
export function validateDomain(d: Domain): string[] {
  const err: string[] = [];
  const ids = new Set<string>(); const nodes = new Set<string>(['GND']);
  try {
    for (const vl of d.topology.substation.voltageLevels) for (const b of vl.bays) for (const e of b.equipment) {
      if (!e.id || !e.type) err.push(`equipamento sem id/type no bay ${b.id}`);
      if (ids.has(e.id)) err.push(`id duplicado: ${e.id}`);
      ids.add(e.id); (e.nodes || (e.node ? [e.node] : [])).forEach((n: string) => nodes.add(n));
    }
    for (const vl of d.topology.substation.voltageLevels) for (const b of vl.bays) for (const e of b.equipment) {
      for (const k of ['assoc', 'isolators']) for (const r of e[k] || []) if (!ids.has(r)) err.push(`${e.id}.${k}: ${r} inexistente`);
      if (e.lr && !ids.has(e.lr)) err.push(`${e.id}.lr: ${e.lr} inexistente`);
    }
    for (const r of d.protections.reles) {
      if (!ids.has(r.tc)) err.push(`relé ${r.id}: tc ${r.tc} inexistente`);
      for (const t of r.trip) if (!ids.has(t)) err.push(`relé ${r.id}: trip ${t} inexistente`);
      for (const [n, el] of Object.entries<any>(r.el)) if (!(el.pickupA > 0)) err.push(`relé ${r.id}.${n}: pickup inválido`);
    }
    for (const b of d.topology.barras) if (!nodes.has(b.node)) err.push(`barra ${b.id}: nó ${b.node} inexistente`);
    for (const p of Object.values<any>(d.profiles)) if (!Array.isArray(p.desenergizacao) || !p.desenergizacao.length) err.push(`perfil ${p.id}: sem etapas`);
    const w = Object.values<number>(d.scoring.pesos).reduce((a, b) => a + b, 0);
    if (Math.abs(w - 100) > 1e-6) err.push(`pesos de pontuação somam ${w}, não 100`);
    if (!(d.params.trafo.zPu > 0) || !(d.params.fonte.icc3kA > 0)) err.push('params: zPu/icc3kA inválidos');
    if (d.plant) for (const b of d.plant.bays) if (b.eq && !ids.has(b.eq)) err.push(`planta ${b.id}: equipamento ${b.eq} inexistente`);
    if (d.levels) for (const n of d.levels.niveis) for (const m of n.missoes) if (!d.missions.missoes.some((x: any) => x.id === m)) err.push(`nível ${n.id}: missão ${m} inexistente`);
  } catch (e: any) { err.push('estrutura inválida: ' + e.message); }
  return err;
}
