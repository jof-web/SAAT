// EPI, EPC e ferramentas da sessão: o que está no armário, com o treinando, inspecionado e com defeito.
// Determinístico: defeitos sorteados pela semente. Nenhuma regra elétrica aqui.
import type { Domain } from '../data';
import type { Cmd } from '../core/sim';
import { mulberry32 } from '../core/net';

export interface Unit { uid: string; item: string; n: number; defeito: string | null; inspecionado: boolean; comigo: boolean; descartado: boolean }
export interface Falta { tarefa: string; nome: string; epi: string[]; ferr: string[]; defeituosos: Unit[]; naoInspecionados: Unit[] }

export class Inventory {
  units: Unit[] = [];
  constructor(private d: Domain, seed: number) {
    const r = mulberry32((seed * 2654435761) >>> 0 ^ 0x51a7);
    const rnd = () => { const v = r.next(); return v; };
    for (const it of d.epi.itens) for (let n = 1; n <= (it.qtd || 1); n++) this.units.push({ uid: `${it.id}#${n}`, item: it.id, n, defeito: null, inspecionado: false, comigo: false, descartado: false });
    // até 2 unidades com defeito escondido, sempre deixando uma reserva boa do mesmo item
    const cand = this.units.filter((u) => this.def(u.item)?.defeitavel && this.units.filter((x) => x.item === u.item).length > 1 && u.n === 1);
    for (const u of cand) if (rnd() < 0.75) { const ds = this.def(u.item).defeitos || ['defeito']; u.defeito = ds[Math.floor(rnd() * ds.length)]; }
  }
  def(item: string) { return this.d.epi.itens.find((x: any) => x.id === item); }
  nome(item: string) { return this.def(item)?.nome || item; }
  unit(uid: string) { return this.units.find((u) => u.uid === uid); }
  comigo(item?: string) { return this.units.filter((u) => u.comigo && (!item || u.item === item)); }
  tem(item: string) { return this.comigo(item).length > 0; }

  pegar(uid: string) { const u = this.unit(uid); if (!u || u.descartado) return 'Item indisponível';
    if (u.comigo) return `${this.nome(u.item)} já está com você`;
    const outro = this.comigo(u.item)[0]; if (outro && this.def(u.item).cat !== 'Material') { outro.comigo = false; }
    u.comigo = true; return `${this.def(u.item).cat?.startsWith('EPI') ? 'Vestiu' : 'Pegou'}: ${this.nome(u.item)} (unidade ${u.n})`; }
  devolver(uid: string) { const u = this.unit(uid); if (!u?.comigo) return 'Não está com você'; u.comigo = false; return `Devolveu: ${this.nome(u.item)} (unidade ${u.n})`; }
  inspecionar(uid: string) { const u = this.unit(uid); if (!u) return { ok: false, txt: 'Item inexistente' }; u.inspecionado = true; const def = this.def(u.item);
    return u.defeito ? { ok: false, txt: `${def.nome} (unidade ${u.n}): REPROVADO — ${u.defeito}. Separe para descarte/ensaio e use outra unidade.` } : { ok: true, txt: `${def.nome} (unidade ${u.n}): aprovado na inspeção.` }; }
  descartar(uid: string) { const u = this.unit(uid); if (!u) return 'Item inexistente'; u.comigo = false; u.descartado = true; return `${this.nome(u.item)} (unidade ${u.n}) separado como defeituoso`; }
  usar(item: string) { return this.comigo(item).find((u) => !u.descartado) || null; }

  /** EPI/ferramentas que faltam para uma tarefa da matriz. */
  faltando(tarefa: string): Falta {
    const t = this.d.epi.tarefas[tarefa] || { epi: [], ferr: [] }; const f: Falta = { tarefa, nome: t.nome || tarefa, epi: [], ferr: [], defeituosos: [], naoInspecionados: [] };
    for (const i of t.epi || []) { const u = this.usar(i); if (!u) f.epi.push(i); else { if (u.defeito) f.defeituosos.push(u); else if (!u.inspecionado && this.def(i).defeitavel) f.naoInspecionados.push(u); } }
    for (const i of t.ferr || []) { const u = this.usar(i); if (!u) f.ferr.push(i); else { if (u.defeito) f.defeituosos.push(u); else if (!u.inspecionado && this.def(i).defeitavel) f.naoInspecionados.push(u); } }
    return f;
  }
  /** Conferência geral de EPI para a missão (antes da PT). */
  conferir(tarefas: string[]) {
    const req = new Set<string>(); for (const t of tarefas) for (const i of this.d.epi.tarefas[t]?.epi || []) req.add(i);
    const faltam = [...req].filter((i) => !this.usar(i)); const def = [...req].map((i) => this.usar(i)).filter((u) => u && u.defeito) as Unit[];
    const naoInsp = [...req].map((i) => this.usar(i)).filter((u) => u && !u.inspecionado && this.def(u.item).defeitavel) as Unit[];
    return { ok: !faltam.length && !def.length && !naoInsp.length, faltam, def, naoInsp, req: [...req] };
  }
  snapshot() { return JSON.parse(JSON.stringify(this.units)); }
}

/** Tarefa da matriz de EPI exigida por um comando do treinando (null = sem exigência, ex.: comando remoto). */
export function tarefaDe(c: Cmd, sim: any): string | null {
  const e = c.id ? sim.defs[c.id] : null;
  switch (c.t) {
    case 'switch': {
      if (!e || c.via === 'remote') return null;
      if (e.type === 'CBR') return e.ratings?.classe === 'at' ? 'manobra_local_at' : 'manobra_local_mt';
      if (e.kind === 'earthing') return sim.nodeLevel[e.nodes[0]] === 'MT' ? 'aterramento_mt' : 'aterramento_at';
      return 'manobra_local_at';
    }
    case 'rack': return 'extracao_mt';
    case 'door': return 'porta_mt';
    case 'vtest': { if (c.passo === 'provar') return null; const node = e ? e.nodes?.[0] || e.node : c.id; return sim.nodeLevel[node] === 'AT' ? 'constatacao_at' : 'constatacao_mt'; }
    case 'loto': return c.op === 'apply' ? 'bloqueio' : null;
    case 'aterr': return 'aterr_temp_mt';
    case 'reparo': return 'troca_lampada';
    case 'tap': case 'oltc': case 'vent': return c.via === 'local' ? 'trafo_local' : null;
  }
  return null;
}
