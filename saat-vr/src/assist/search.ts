// Busca offline da base de conhecimento (sem IA): normalização, sinônimos, pontuação por campo.
import type { Domain } from '../data';

export interface Doc { id: string; tipo: string; titulo: string; texto: string; chaves: string; ref?: any }
export const norm = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9.,\-+ ]+/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set('a o os as de da do das dos e em no na nos nas um uma uns umas para por com que qual quais como se eu me meu minha voce isso esse essa este esta ao aos sobre entre ou mais menos muito pouco ser tem ter ha'.split(' '));
export const toks = (s: string) => norm(s).split(/[\s,.]+/).filter((t) => t && !STOP.has(t));

export function tipoFicha(e: any): string | null {
  if (!e) return null;
  if (e.type === 'CBR') return e.ratings?.classe === 'at' ? 'disjuntor_at' : 'disjuntor_mt';
  if (e.type === 'DIS') return e.kind === 'earthing' ? 'chave_terra' : 'seccionadora_at';
  return ({ CTR: 'tc', VTR: 'tp', PTR: e.kind === 'sa' ? 'qgca' : 'trafo', OLTC: 'trafo', SEL: 'rele', BAT: 'bateria', RET: 'retificador', ATS: 'qgca', FUS: 'tp', LOAD: 'cabo_mt' } as any)[e.type] || null;
}
export function descEq(e: any) {
  const t = tipoFicha(e); const nome = e.type === 'SEL' ? 'Chave local/remoto' : e.type === 'OLTC' ? 'Comando do OLTC' : e.type === 'LOAD' ? 'Carga do alimentador' : null;
  return nome || ({ disjuntor_at: 'Disjuntor 145 kV SF6', disjuntor_mt: 'Disjuntor 15 kV a vácuo (extraível)', seccionadora_at: 'Seccionadora 145 kV', chave_terra: 'Chave de terra', tc: 'Transformador de corrente', tp: 'TP / fusível', trafo: 'Transformador de potência', qgca: 'Serviço auxiliar', rele: 'Relé', bateria: 'Banco de baterias', retificador: 'Retificador', cabo_mt: 'Cabo MT' } as any)[t || ''] || e.type;
}

export class Indice {
  docs: Doc[] = []; private df = new Map<string, number>(); private syn = new Map<string, string[]>(); private tk: { t: string[]; k: string[]; x: string[] }[] = [];
  constructor(private d: Domain, private defs: Record<string, any>) {
    for (const [k, vs] of Object.entries<string[]>(d.kb.sinonimos)) { const g = [k, ...vs].map(norm); for (const w of g) for (const p of w.split(' ')) this.syn.set(p, [...new Set([...(this.syn.get(p) || []), ...g.flatMap((x) => x.split(' '))])]); }
    const bayDe: Record<string, string> = {}; for (const vl of d.topology.substation.voltageLevels) for (const b of vl.bays) for (const e of b.equipment) bayDe[e.id] = b.nome;
    const planta: Record<string, string> = {}; for (const b of d.plant.bays) { if (b.eq) planta[b.eq] = b.id; if (b.terra) planta[b.terra] = b.id; if (b.tc) planta[b.tc] = b.id; }
    for (const e of Object.values<any>(defs)) { if (['SRC'].includes(e.type)) continue; const f = d.kb.fichas[tipoFicha(e) || ''];
      this.add({ id: 'eq:' + e.id, tipo: 'equipamento', titulo: `${e.id} — ${descEq(e)}`, texto: [bayDe[e.id], planta[e.id] ? `posição ${planta[e.id]} da planta` : '', f?.funcao, f?.comoFunciona].filter(Boolean).join('. '), chaves: [e.id, e.id.replace(/-/g, ''), e.id.replace(/-/g, ' '), planta[e.id] || ''].join(' '), ref: e.id }); }
    for (const [k, f] of Object.entries<any>(d.kb.fichas)) this.add({ id: 'ficha:' + k, tipo: 'ficha', titulo: `${f.nome} (${f.simbolo})`, texto: [f.funcao, f.comoFunciona, ...(f.operar || []), ...(f.riscos || []), ...(f.nunca || [])].join(' '), chaves: `${f.simbolo} ${k.replace('_', ' ')}`, ref: k });
    for (const g of d.kb.glossario) this.add({ id: 'glo:' + g.t, tipo: 'glossário', titulo: g.t, texto: g.d, chaves: g.t, ref: g });
    for (const [k, t] of Object.entries<any>(d.fmea.tipos)) for (const m of t.modos) this.add({ id: `fmea:${k}:${m.modo}`, tipo: 'FMEA', titulo: `${t.nome}: ${m.modo}`, texto: `${m.comp}. Causa: ${m.causa}. Efeito: ${m.efeito}. Detecção: ${m.detecta}. Ação: ${m.acao}`, chaves: `fmea falha ${k.replace('_', ' ')} ${m.comp} ${(m.falhas || []).join(' ')}`, ref: { tipo: k, m } });
    for (const f of d.faults.falhas) this.add({ id: 'falha:' + f.id, tipo: 'falha', titulo: `${f.id} — ${f.nome}`, texto: `Efeito: ${f.efeito}. Alvos: ${(f.alvos || []).join(', ')}`, chaves: f.id, ref: f });
    const seen = new Set<string>(); for (const r of d.interlocks.regras) { if (seen.has(r.id + r.msg)) continue; seen.add(r.id + r.msg); this.add({ id: 'il:' + r.id + ':' + seen.size, tipo: 'intertravamento', titulo: `${r.id} — ${r.tipo}`, texto: r.msg, chaves: `${r.id} ${r.id.replace('-', '')} intertravamento`, ref: r }); }
    for (const it of d.epi.itens) this.add({ id: 'epi:' + it.id, tipo: 'EPI/ferramenta', titulo: it.nome, texto: `${it.serve} Inspeção: ${it.inspecao} Quando: ${it.quando}`, chaves: `${it.cat} epi ${it.id.replace('_', ' ')}`, ref: it });
    for (const [k, t] of Object.entries<any>(d.epi.tarefas)) this.add({ id: 'tarefa:' + k, tipo: 'EPI por tarefa', titulo: `EPI para: ${t.nome}`, texto: `EPI: ${(t.epi || []).map((i: string) => d.epi.itens.find((x: any) => x.id === i)?.nome).join(', ')}. Ferramentas: ${(t.ferr || []).map((i: string) => d.epi.itens.find((x: any) => x.id === i)?.nome).join(', ') || '—'}`, chaves: `epi ${t.nome}`, ref: k });
    for (const m of d.missions.missoes) this.add({ id: 'missao:' + m.id, tipo: 'missão', titulo: `${m.id} — ${m.nome}`, texto: m.objetivo, chaves: m.id, ref: m });
    for (const n of this.tk) for (const w of new Set([...n.t, ...n.k, ...n.x])) this.df.set(w, (this.df.get(w) || 0) + 1);
  }
  private add(d: Doc) { this.docs.push(d); this.tk.push({ t: toks(d.titulo), k: toks(d.chaves), x: toks(d.texto) }); }
  expand(q: string): string[] { const out = new Set<string>(); for (const t of toks(q)) { out.add(t); for (const s of this.syn.get(t) || []) out.add(s); } return [...out]; }
  buscar(q: string, n = 6, tipos?: string[]) {
    const base = toks(q), qs = this.expand(q), N = this.docs.length; const res: { doc: Doc; s: number }[] = [];
    this.docs.forEach((doc, i) => { if (tipos && !tipos.includes(doc.tipo)) return; const T = this.tk[i]; let s = 0;
      for (const w of qs) { const idf = Math.log(1 + N / (1 + (this.df.get(w) || 0))); const orig = base.includes(w) ? 1 : 0.55;
        s += orig * idf * ((T.t.includes(w) ? 3 : 0) + (T.k.includes(w) ? 4 : 0) + (T.x.filter((x) => x === w).length ? 1 + Math.min(2, T.x.filter((x) => x === w).length) * 0.3 : 0) + (T.x.some((x) => x.length > 4 && w.length > 4 && x.startsWith(w.slice(0, 5))) ? 0.4 : 0)); }
      if (s > 0) res.push({ doc, s }); });
    return res.sort((a, b) => b.s - a.s).slice(0, n);
  }
}
