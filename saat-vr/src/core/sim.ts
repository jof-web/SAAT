// sim-core: fonte única da verdade. TS puro, sem DOM e sem Three.
// Tick fixo de 10 Hz + fila de eventos em ms (tempos de proteção exatos). Determinístico com semente.
// Toda regra elétrica vem de domain-data; os IDs do anexo estão citados nos comentários.
import type { Domain } from '../data';
import { Branch, Net, makeNet, solve, reach, curveTime, eval87T, mulberry32, Z_SW, Z_FAULT } from './net';

export type Actor = 'treinando' | 'instrutor' | 'supervisor' | 'cos' | 'manutencao' | 'protecao' | 'sistema';
export type Cmd = { t: string; [k: string]: any };
export interface CmdOpt { bypass?: string[]; just?: string; aprovadoPor?: Actor }
export interface CmdResult { result: 'ok' | 'bloqueado' | 'falha' | 'negado'; rules: string[]; msg: string; noop?: boolean; changed?: boolean; consequencia?: string }
export interface LogEntry {
  seq: number; t: number; hora: string; kind: 'cmd' | 'prot' | 'ev' | 'com' | 'err'; actor: Actor; msg: string;
  cmd?: Cmd; result?: string; rules?: string[]; just?: string; bypass?: string[]; noop?: boolean; [k: string]: any;
}
const SQ3 = Math.sqrt(3);
const CAT: Record<string, string> = { loto: 'loto', setting: 'ajustar_protecao', inject: 'injetar_falha', carga: 'injetar_falha' };

export class Sim {
  d: Domain; s: any; der: any = {};
  defs: Record<string, any> = {}; nodeLevel: Record<string, 'AT' | 'MT'> = {}; nodes: string[] = [];
  isoOf: Record<string, string[]> = {}; relayByBrk: Record<string, any> = {}; relayById: Record<string, any> = {};
  loads: any[] = []; trafos: string[] = []; terras: any[] = [];
  log: LogEntry[] = []; mode: 'missao' | 'sandbox' = 'missao';
  onLog: ((e: LogEntry) => void) | null = null;
  onEvent: ((name: string, data?: any) => void) | null = null;
  wallBase = Date.now();
  private qn = 0;

  constructor(d: Domain, seed = 1) { this.d = d; this.index(); this.reset(seed); }

  // ---------- índice da topologia ----------
  index() {
    this.defs = {}; this.isoOf = {}; this.relayByBrk = {}; this.relayById = {}; this.loads = []; this.trafos = []; this.terras = [];
    const ns = new Set<string>();
    for (const vl of this.d.topology.substation.voltageLevels) for (const b of vl.bays) for (const e of b.equipment) {
      const def = { ...e, nivel: vl.id, bay: b.id }; this.defs[e.id] = def;
      if (e.type === 'PTR' && e.nodes) { this.trafos.push(e.id); ns.add(e.nodes[0]); ns.add(e.nodes[1]); this.nodeLevel[e.nodes[0]] = 'AT'; this.nodeLevel[e.nodes[1]] = 'MT'; }
      else if (e.nodes) for (const n of e.nodes) if (n !== 'GND') { ns.add(n); this.nodeLevel[n] ??= vl.id; }
      if (e.node) { ns.add(e.node); this.nodeLevel[e.node] ??= vl.id === 'SA' ? 'MT' : vl.id; }
      if (e.type === 'LOAD') this.loads.push(def);
      if (e.type === 'DIS' && e.kind === 'earthing') { this.terras.push(def); for (const i of e.isolators || []) (this.isoOf[i] ||= []).push(e.id); }
    }
    this.nodes = [...ns];
    for (const T of this.trafos) this.defs['90-' + T] = { id: '90-' + T, type: 'OLTC', trafo: T, nivel: 'AT', bay: T + 'A', nome: `Comando do OLTC de ${T}` };
    for (const r of this.d.protections.reles) { this.relayByBrk[r.tc] = r; this.relayById[r.id] = r; }
  }

  reset(seed = 1) {
    const p = this.d.params; this.log = []; this.qn = 0; this.wallBase = Date.now();
    const s: any = this.s = {
      t: 0, seq: 0, seed, rng: seed >>> 0, eq: {}, rel: {}, locks: {}, tr: {},
      cc: { v: p.cc.flutuacaoV, soc: 1, rt: { RT1: true, RT2: true }, terra: false, forcaV: null },
      ca: { ats: 'TSA1', auto: true, geral: true, defeito: false, timer: 0 },
      fonte: { viva: true }, faltas: [], inj: {}, vtest: { provado: false, ultimo: null, rec: {} },
      alarmes: [], emergencia: false, nivelCarga: p.carga.nivelInicial, q: [], tm: {}, anomalias: [],
      terraTemp: {}, ops: {}, pr: {},
    };
    const I = p.instrumentos || { opsFaixa: [800, 4200], pararaiosFaixa: [0, 40], oltcOpsFaixa: [15000, 60000] };
    const faixa = (k: string, f: number[]) => Math.floor(f[0] + (f[1] - f[0]) * this.hsh(k));
    for (const e of Object.values<any>(this.defs)) {
      if (e.type === 'CBR' || e.type === 'DIS' || e.type === 'FUS')
        s.eq[e.id] = { state: e.normalState, moving: null, pos: e.normalPosition || null, mola: true, molaDef: false, sf6: 0, trava: null, falha: null, loto: [], porta: false };
      else if (e.type === 'SEL') s.eq[e.id] = { lr: e.normalState || 'remoto', loto: [] };
      else if (e.type === 'OLTC') s.eq[e.id] = { loto: [] };
      if (e.type === 'CBR') s.ops[e.id] = faixa('ops' + e.id, I.opsFaixa);
    }
    for (const pr of ['LT1', 'T1', 'T2']) for (const f of ['A', 'B', 'C']) s.pr[`PR-${pr}-${f}`] = faixa(`pr${pr}${f}`, I.pararaiosFaixa);
    for (const r of this.d.protections.reles) {
      const el: any = {}; for (const n of Object.keys(r.el)) el[n] = { frac: 0, rate: 0, t0: 0, tok: 0, on: false, disp: false };
      s.rel[r.id] = { el, r79: !!r['79'], tent: 0, ciclo: 'idle', alvos: [], tok: 0, manualAt: -1e12 };
    }
    for (const id of Object.keys(this.d.protections.bloqueios)) s.locks[id] = false;
    for (const T of this.trafos) s.tr[T] = { tap: p.trafo.oltc.tapInicial, modo: 'auto', travado: false, timer: 0, oleo: 0, enrol: 0, vent: 0, buch: 0, rps: false, nivel: 'ok', defeito: false, fogo: false, bias: 0, energ: true, alvos: [], ventMan: false, oltcOps: faixa('oltc' + T, I.oltcOpsFaixa) };
    this.resolve();
    for (const T of this.trafos) { const th = this.thermalTarget(T); s.tr[T].oleo = th.oleo; s.tr[T].enrol = th.enrol; }
  }

  // ---------- utilidades ----------
  rand() { const r = mulberry32(this.s.rng); const v = r.next(); this.s.rng = r.s; return v; }
  /** Valor pseudoaleatório fixo por semente + chave (não consome o gerador principal). */
  hsh(key: string) { let h = (this.s?.seed ?? 1) ^ 0x9e3779b9; for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x5bd1e995) >>> 0; return mulberry32(h).next(); }
  hora(t = this.s.t) { return new Date(this.wallBase + t).toISOString(); }
  lg(kind: LogEntry['kind'], actor: Actor, msg: string, extra: any = {}): LogEntry {
    const e: LogEntry = { seq: ++this.s.seq, t: this.s.t, hora: this.hora(), kind, actor, msg, ...extra };
    this.log.push(e); this.onLog?.(e); return e;
  }
  sched(t: number, ev: any) { ev.t = t; ev.n = ++this.qn; const q = this.s.q; let i = q.length; while (i > 0 && (q[i - 1].t > t)) i--; q.splice(i, 0, ev); }
  ccOk() { return this.s.cc.v >= this.d.params.cc.mortoV; } // A10: CC < 80 V ⇒ nada atua
  ruleOn(id: string) { return this.d.interlocks.regras.some((r: any) => r.id === id && r.enabled); }
  opMs(e: any, op: string) { const c = this.d.params.disjuntor[e.ratings?.classe || 'mt']; return op === 'open' ? c.aberturaMs : c.fechamentoMs; }
  conduz(e: any, over?: Record<string, boolean>) {
    if (over && e.id in over) return over[e.id];
    const r = this.s.eq[e.id]; return r.state === 'closed' && (!e.extraivel || r.pos === 'servico');
  }
  alarm(key: string, text: string, sev = 2) {
    const a = this.s.alarmes.find((x: any) => x.key === key && x.ativo);
    if (a) return;
    this.s.alarmes.push({ key, text, sev, t: this.s.t, ativo: true, ack: false });
    this.lg('ev', 'sistema', `ALARME: ${text}`, { alarme: key });
    this.onEvent?.('ALARM', { key, text, sev });
  }
  clearAlarm(key: string) { for (const a of this.s.alarmes) if (a.key === key && a.ativo) a.ativo = false; this.s.alarmes = this.s.alarmes.filter((a: any) => a.ativo || !a.ack); }

  // ---------- solver F1 ----------
  buildNet(over?: Record<string, boolean>): Net {
    const br: Branch[] = [];
    for (const e of Object.values<any>(this.defs)) {
      if (e.type === 'PTR' && e.nodes) br.push({ id: e.id, a: e.nodes[0], b: e.nodes[1], z: this.d.params.trafo.zPu, nivel: 'TR' });
      else if ((e.type === 'CBR' || e.type === 'DIS' || e.type === 'FUS') && e.kind !== 'earthing' && this.conduz(e, over))
        br.push({ id: e.id, a: e.nodes[0], b: e.nodes[1], z: Z_SW, nivel: e.nivel });
    }
    return makeNet(this.nodes, br);
  }
  base() { const p = this.d.params; const Sb = p.base.mva; return { Sb, IbAT: (Sb * 1000) / (SQ3 * p.trafo.kVat), IbMT: (Sb * 1000) / (SQ3 * p.trafo.kVmt), Zs: Sb / (SQ3 * p.fonte.kV * p.fonte.icc3kA) }; }
  /** Corrente de falta franca (kA) no nó, na topologia atual ou hipotética. A6. */
  icc(node: string, tipo: '3f' | '1f' | '2f' = '3f', over?: Record<string, boolean>): number {
    const f = this.faultSol(this.buildNet(over), node, tipo, 1);
    return f ? (f.ipu * (this.nodeLevel[node] === 'AT' ? this.base().IbAT : this.base().IbMT)) / 1000 : 0;
  }
  private faultSol(net: Net, node: string, tipo: string, sev: number) {
    const b = this.base(), p = this.d.params;
    const sol3 = solve(net, { LINE: 1 / b.Zs, [node]: 1 / Z_FAULT }, { LINE: 1 / b.Zs });
    const i3 = sol3.V[node] / Z_FAULT; if (!(i3 > 1e-6)) return null;
    let scale = 1, kAT = 1, sol0: any = null, i1 = 0;
    if (this.nodeLevel[node] === 'MT') {
      if (tipo === '2f') { scale = p.falta.fator2f; kAT = 1 / p.falta.fator2f; } // Dyn: fase mais carregada no AT = equivalente 3f
      if (tipo === '1f') {
        // 1φ-terra = 3·In/(2·Z1 + Z0), Z0 = Z0t dos trafos ligados à ilha; delta bloqueia a seq. zero da fonte (anexo 1.2)
        const sh: Record<string, number> = {}; for (const T of this.trafos) sh[this.defs[T].nodes[1]] = 1 / p.trafo.z0Pu;
        sol0 = solve(net, sh, { [node]: 1 }, true);
        i1 = 3 / (2 / i3 + sol0.V[node]); scale = i1 / i3; kAT = 1 / SQ3;
      }
    }
    return { sol3, sol0, ipu: i3 * scale * sev, scale: scale * sev, kAT, i1: i1 * sev };
  }
  grounded(net: Net): Set<string> {
    const start: string[] = [];
    for (const e of this.terras) if (this.s.eq[e.id].state === 'closed') start.push(e.nodes[0]);
    for (const n of Object.keys(this.s.terraTemp || {})) start.push(n);
    return start.length ? reach(net, start, (b) => b.nivel !== 'TR') : new Set();
  }

  resolve() {
    const s = this.s, p = this.d.params, b = this.base();
    const net = this.buildNet();
    const energ = s.fonte.viva ? reach(net, ['LINE']) : new Set<string>();
    const energAT = s.fonte.viva ? reach(net, ['LINE'], (x) => x.nivel !== 'TR') : new Set<string>();
    const gnd = this.grounded(net);
    s.faltas = s.faltas.filter((f: any) => f.permanente || energ.has(f.node)); // falta transitória some ao desenergizar
    const faltas = s.faltas.filter((f: any) => energ.has(f.node)).map((f: any) => ({ ...f }));
    for (const e of this.terras) if (s.eq[e.id].state === 'closed' && energ.has(e.nodes[0])) faltas.push({ id: 'IMP:' + e.id, node: e.nodes[0], tipo: '3f', sev: 1, impl: true }); // energizado + aterrado = curto franco
    for (const n of Object.keys(s.terraTemp || {})) if (energ.has(n)) faltas.push({ id: 'IMP:ATERR:' + n, node: n, tipo: '3f', sev: 1, impl: true });
    const I: Record<string, number> = {}, Ires: Record<string, number> = {}, colapso = new Set<string>();
    const tr: any = {}; for (const T of this.trafos) tr[T] = { Imt: 0, Iat: 0, In: 0, mva: 0 };
    const fInfo: any[] = [];
    for (const f of faltas) {
      const fs = this.faultSol(net, f.node, f.tipo, f.sev ?? 1); if (!fs) continue;
      for (const n of this.nodes) if (energ.has(n) && fs.sol3.V[n] < 0.5) colapso.add(n);
      for (const br of net.branches) {
        const i3 = Math.abs(fs.sol3.I[br.id]);
        if (br.nivel === 'TR') { tr[br.id].Imt += i3 * fs.scale * b.IbMT; tr[br.id].Iat += i3 * fs.scale * fs.kAT * b.IbAT; if (fs.sol0) tr[br.id].In += Math.abs(fs.sol0.V[br.b] / p.trafo.z0Pu) * fs.i1 * b.IbMT; }
        else if (br.nivel === 'AT') I[br.id] = (I[br.id] || 0) + i3 * fs.scale * fs.kAT * b.IbAT;
        else { I[br.id] = (I[br.id] || 0) + i3 * fs.scale * b.IbMT; if (fs.sol0) Ires[br.id] = (Ires[br.id] || 0) + Math.abs(fs.sol0.I[br.id]) * fs.i1 * b.IbMT; }
      }
      fInfo.push({ id: f.id, node: f.node, tipo: f.tipo, kA: (fs.ipu * (this.nodeLevel[f.node] === 'AT' ? b.IbAT : b.IbMT)) / 1000, impl: !!f.impl });
    }
    // regime: cargas como corrente constante na tensão nominal (reproduz anexo 1.2)
    const inj: Record<string, number> = { LINE: s.fonte.viva ? 1 / b.Zs : 0 }; const supplied: Record<string, boolean> = {};
    for (const l of this.loads) {
      const ok = energ.has(l.node) && !colapso.has(l.node); supplied[l.ref] = ok;
      if (ok) inj[l.node] = (inj[l.node] || 0) - (p.carga.alimentadores[l.ref] * s.nivelCarga) / p.carga.fp / b.Sb;
    }
    const sl = solve(net, { LINE: 1 / b.Zs }, inj);
    for (const br of net.branches) {
      const a = Math.abs(sl.I[br.id]);
      if (br.nivel === 'TR') { const t = tr[br.id]; t.ipu = a; t.mva = a * b.Sb; t.Imt += a * b.IbMT; t.Iat += a * b.IbAT; }
      else I[br.id] = (I[br.id] || 0) + a * (br.nivel === 'AT' ? b.IbAT : b.IbMT);
    }
    // tensões (queda ≈ Zt·I·senφ; TAP do OLTC) — simplificação F1
    const sinphi = Math.sqrt(1 - p.carga.fp * p.carga.fp); const V: Record<string, number> = {};
    for (const T of this.trafos) { const d = this.defs[T]; tr[T].alimenta = energAT.has(d.nodes[0]) && energ.has(d.nodes[1]); tr[T].pct = (tr[T].mva / p.trafo.mvaONAF) * 100; tr[T].pctONAN = (tr[T].mva / p.trafo.mvaONAN) * 100; tr[T].energ = energ.has(d.nodes[0]) || energ.has(d.nodes[1]); }
    const done = new Set<string>();
    for (const n of this.nodes) {
      if (!energ.has(n)) { V[n] = 0; continue; }
      if (colapso.has(n)) { V[n] = 0.02; continue; }
      if (this.nodeLevel[n] === 'AT') { V[n] = 1; continue; }
      if (done.has(n)) continue;
      const comp = reach(net, [n], (x) => x.nivel === 'MT');
      const fs = this.trafos.filter((T) => tr[T].alimenta && comp.has(this.defs[T].nodes[1]));
      let v = 1;
      if (fs.length) { const tap = fs.reduce((a, T) => a + s.tr[T].tap, 0) / fs.length; const ip = fs.reduce((a, T) => a + (tr[T].ipu || 0), 0) / fs.length; v = 1 + tap * p.trafo.oltc.passoPu - p.trafo.zPu * ip * sinphi; }
      for (const c of comp) if (energ.has(c) && !colapso.has(c)) { V[c] = v; done.add(c); }
    }
    const barras: any = {}; for (const bb of this.d.topology.barras) barras[bb.id] = { energ: energ.has(bb.node), v: V[bb.node] || 0, kV: (V[bb.node] || 0) * (bb.nivel === 'AT' ? p.trafo.kVat : p.trafo.kVmt) };
    const toRec = (st: Set<string>) => { const o: Record<string, boolean> = {}; st.forEach((k) => (o[k] = true)); return o; };
    this.der = { energ: toRec(energ), gnd: toRec(gnd), I, Ires, tr, V, barras, supplied, faltas: fInfo };
    for (const [n, r] of Object.entries<any>(s.vtest.rec)) if (energ.has(n)) r.valid = false; // constatação perde validade se o trecho energizar
    for (const T of this.trafos) {
      const now = tr[T].energ, st = s.tr[T];
      if (now && !st.energ) this.inrush(T);
      st.energ = now;
      if (st.defeito && now && !st.pend87) { st.pend87 = true; this.sched(s.t + this.d.protections.instantaneoMs, { type: 'int87', T }); }
    }
    this.protUpdate();
  }

  // ---------- proteções (anexo, seção 4) ----------
  private protUpdate() {
    const s = this.s, pr = this.d.protections; const cc = this.ccOk();
    for (const r of pr.reles) {
      const rt = s.rel[r.id];
      for (const [name, cfg] of Object.entries<any>(r.el)) {
        const st = rt.el[name];
        let I = name === '51G' ? this.der.tr[r.neutro]?.In || 0 : name.endsWith('N') ? this.der.Ires[r.tc] || 0 : this.der.I[r.tc] || 0;
        if (!cc) I = 0;
        if (!cfg.curva) { // instantâneo (50 / 50N)
          const on = I >= cfg.pickupA;
          if (on && !st.on) { st.on = true; st.tok++; this.sched(s.t + pr.instantaneoMs, { type: 'elTrip', rele: r.id, el: name, tok: st.tok }); }
          else if (!on && st.on) { st.on = false; st.disp = false; st.tok++; }
        } else { // tempo inverso IEC: integra fração de operação quando a corrente muda
          if (st.rate > 0) st.frac += (s.t - st.t0) * st.rate;
          st.t0 = s.t; st.tok++;
          const tOp = curveTime(pr.curvas[cfg.curva], cfg.tms, I, cfg.pickupA);
          if (isFinite(tOp)) { st.on = true; st.rate = 1 / (tOp * 1000); if (!st.disp) this.sched(s.t + Math.max(0, (1 - st.frac) / st.rate), { type: 'elTrip', rele: r.id, el: name, tok: st.tok }); }
          else { st.on = false; st.disp = false; st.rate = 0; st.frac = 0; }
        }
      }
    }
  }
  private relayTrip(r: any, el: string) {
    const s = this.s, rt = s.rel[r.id]; if (!this.ccOk()) return;
    if (!rt.alvos.includes(el)) rt.alvos.push(el);
    this.lg('prot', 'protecao', `${r.nome}: função ${el} atuou → trip ${r.trip.join(' + ')}`, { rele: r.id, el });
    this.alarm(`TRIP:${r.id}:${el}`, `${r.nome}: trip por ${el}`, 3);
    if (r['79']) {
      const c = r['79'], b = s.eq[r.tc], d = this.defs[r.tc];
      // I-11: 79 inibido em manobra manual, em local, com 86 ou LOTO
      const inib = this.ruleOn('I-11') && (s.eq[d.lr]?.lr === 'local' || b.loto.length > 0 || s.locks[r['86']] || s.t - rt.manualAt < c.rearmeS * 1000);
      if (rt.r79 && rt.tent < c.tentativas && !inib) {
        rt.tent++; rt.ciclo = 'morto'; rt.tok++;
        this.sched(s.t + this.opMs(d, 'open') + c.tempoMortoS * 1000, { type: 'religar', rele: r.id, tok: rt.tok });
        this.lg('prot', 'protecao', `${r.nome}: 79 iniciado, tempo morto ${c.tempoMortoS} s`, { rele: r.id });
      } else {
        rt.ciclo = 'bloqueado'; rt.tok++; s.locks[r['86']] = true;
        this.lg('prot', 'protecao', `${r.nome}: trip definitivo, ${r['86']} atuado (rearme manual local)`, { rele: r.id });
        this.alarm(`86:${r['86']}`, `${r['86']} atuado`, 3);
      }
    }
    this.trip(r.trip, `${r.id}/${el}`);
    const cfg = r.el[el];
    if (cfg?.estagio2) this.sched(s.t + this.opMs(this.defs[r.tc], 'open') + cfg.estagio2.atrasoS * 1000, { type: 'g2', rele: r.id, el });
  }
  /** Ordem de abertura por proteção; inicia 50BF de cada disjuntor (anexo 4.3). */
  trip(ids: string[], causa: string) {
    const s = this.s; if (!this.ccOk()) { this.lg('prot', 'protecao', `Trip (${causa}) não executado: sem CC`); return; }
    for (const id of ids) {
      const b = s.eq[id], d = this.defs[id]; if (!b || b.state !== 'closed') continue;
      if (b.moving !== 'opening') {
        if (b.trava === 'fechado') this.lg('prot', 'protecao', `${id}: recebeu trip (${causa}) e NÃO abriu`, { falhaAbertura: id });
        else { b.moving = 'opening'; this.sched(s.t + this.opMs(d, 'open'), { type: 'swDone', id, to: 'open', prot: true }); }
      }
      const bf = this.relayByBrk[id]?.bf; if (bf) this.sched(s.t + bf.atrasoMs, { type: 'bf', brk: id });
    }
  }
  private tripTrafo(T: string, causa: string) {
    const c = this.d.protections.trafo[T], st = this.s.tr[T]; if (!this.ccOk()) return;
    if (!st.alvos.includes(causa)) st.alvos.push(causa);
    this.s.locks[c['86']] = true;
    this.lg('prot', 'protecao', `${T}: ${causa} atuou → trip ${c.trip.join(' + ')} + ${c['86']}`, { trafo: T, el: causa });
    this.alarm(`TRIP:${T}:${causa}`, `${T}: trip por ${causa}`, 3); this.alarm(`86:${c['86']}`, `${c['86']} atuado`, 3);
    this.trip(c.trip, `${T}/${causa}`);
  }
  private inrush(T: string) {
    const p = this.d.params.inrush, c = this.d.protections.trafo['87T'];
    const pk = Math.min(p.minPu + (p.maxPu - p.minPu) * this.rand(), c.instPu - 0.1), h2 = p.h2MinPct + (p.h2MaxPct - p.h2MinPct) * this.rand();
    const r = eval87T(c, { idiffPu: pk, ibiasPu: pk / 2, h2Pct: h2, h5Pct: 0 }); // A11
    this.lg('prot', 'protecao', `${T}: energização, inrush ${pk.toFixed(1)}×In com ${h2.toFixed(0)} % de 2ª harmônica → 87T ${r.opera ? 'ATUOU' : 'não atua'} (${r.motivo})`, { trafo: T, inrush: { pk, h2, opera: r.opera } });
    if (r.opera) this.tripTrafo(T, '87T');
  }

  private handle(ev: any) {
    const s = this.s;
    switch (ev.type) {
      case 'swDone': {
        const b = s.eq[ev.id], d = this.defs[ev.id]; b.moving = null; b.state = ev.to; if (d.type === 'CBR') s.ops[ev.id] = (s.ops[ev.id] || 0) + 1;
        if (d.type === 'CBR' && ev.to === 'closed') { b.mola = false; if (!b.molaDef) this.sched(s.t + this.d.params.disjuntor.molaCargaMs, { type: 'mola', id: ev.id }); }
        if (ev.arco) this.arco(ev.id, d.nodes[0]);
        for (const t of this.isoOf[ev.id] || []) { const r = s.vtest.rec[this.defs[t].nodes[0]]; if (r) r.valid = false; }
        this.lg('ev', ev.prot ? 'protecao' : 'sistema', `${ev.id} ${ev.to === 'closed' ? 'FECHADO' : 'ABERTO'}`, { eq: ev.id, estado: ev.to });
        this.resolve(); break;
      }
      case 'rackDone': {
        const b = s.eq[ev.id]; b.moving = null; b.pos = ev.to;
        if (ev.arco) this.arco(ev.id, this.defs[ev.id].nodes[0]);
        for (const t of this.isoOf[ev.id] || []) { const r = s.vtest.rec[this.defs[t].nodes[0]]; if (r) r.valid = false; }
        this.lg('ev', 'sistema', `${ev.id} na posição ${ev.to.toUpperCase()}`, { eq: ev.id, pos: ev.to });
        this.resolve(); break;
      }
      case 'mola': { const b = s.eq[ev.id]; if (!b.molaDef && this.ccOk()) b.mola = true; break; }
      case 'elTrip': { const st = s.rel[ev.rele].el[ev.el]; if (st.tok === ev.tok && st.on && !st.disp) { st.disp = true; this.relayTrip(this.relayById[ev.rele], ev.el); } break; }
      case 'g2': { const r = this.relayById[ev.rele], cfg = r.el[ev.el]; if ((this.der.tr[r.neutro]?.In || 0) >= cfg.pickupA) { this.lg('prot', 'protecao', `${r.nome}: ${ev.el} 2º estágio → trip ${cfg.estagio2.trip.join(' + ')}`); this.trip(cfg.estagio2.trip, `${r.id}/${ev.el}-2`); } break; }
      case 'bf': { // 50BF: corrente > 0,1×In após o trip (anexo 4.1/4.3)
        const bf = this.relayByBrk[ev.brk].bf, b = s.eq[ev.brk], d = this.defs[ev.brk];
        const thr = bf.minPu * this.d.protections.bfRefA[d.ratings?.classe || 'mt'];
        if (b.state === 'closed' && (this.der.I[ev.brk] || 0) > thr && this.ccOk()) {
          s.locks[bf['86']] = true; const rt = s.rel[this.relayByBrk[ev.brk].id]; rt.tok++; rt.ciclo = 'bloqueado';
          this.lg('prot', 'protecao', `50BF de ${ev.brk}: falha de abertura → ${bf['86']} → trip ${bf.trip.join(' + ')}`, { bf: ev.brk, lock: bf['86'] });
          this.alarm(`BF:${ev.brk}`, `Falha de disjuntor ${ev.brk} (50BF), ${bf['86']} atuado`, 3);
          this.onEvent?.('BF', { brk: ev.brk });
          this.trip(bf.trip, `50BF ${ev.brk}`);
        }
        break;
      }
      case 'religar': {
        const r = this.relayById[ev.rele], rt = s.rel[r.id], b = s.eq[r.tc], d = this.defs[r.tc]; if (rt.tok !== ev.tok) break;
        const lk = Object.entries<any>(this.d.protections.bloqueios).some(([k, v]) => s.locks[k] && v.bloqueia.includes(r.tc));
        if (b.state === 'open' && !b.moving && (!d.extraivel || b.pos === 'servico') && this.ccOk() && b.mola && !lk && b.trava !== 'naofecha') {
          b.moving = 'closing'; rt.ciclo = 'rearme'; this.sched(s.t + this.opMs(d, 'close'), { type: 'swDone', id: r.tc, to: 'closed', prot: true });
          this.sched(s.t + r['79'].rearmeS * 1000, { type: 'rearme79', rele: r.id, tok: rt.tok });
          this.lg('prot', 'protecao', `${r.nome}: 79 religando ${r.tc}`, { rele: r.id });
        } else { rt.ciclo = 'bloqueado'; this.lg('prot', 'protecao', `${r.nome}: 79 não religou (condição de fechamento não atendida)`); }
        break;
      }
      case 'rearme79': { const rt = s.rel[ev.rele]; if (rt.tok === ev.tok && rt.ciclo === 'rearme') { rt.tent = 0; rt.ciclo = 'idle'; this.lg('prot', 'protecao', `${ev.rele}: 79 rearmado (religamento com sucesso)`); } break; }
      case 'int87': {
        const st = s.tr[ev.T]; st.pend87 = false; if (!st.defeito || !this.der.tr[ev.T].energ) break;
        const r = eval87T(this.d.protections.trafo['87T'], { idiffPu: 5, ibiasPu: 2.5, h2Pct: 0, h5Pct: 0 });
        if (r.opera) this.tripTrafo(ev.T, '87T'); if (st.rps) this.tripTrafo(ev.T, '63RPS'); break;
      }
    }
  }
  private arco(id: string, node: string) {
    this.s.eq[id].falha = 'arco';
    this.s.faltas.push({ id: `ARCO:${id}:${this.s.seq}`, node, tipo: '3f', permanente: true, sev: 1, origem: 'arco' });
    this.lg('ev', 'sistema', `ARCO ELÉTRICO em ${id}: dano ao equipamento e evento de segurança`, { arco: id });
    this.alarm(`ARCO:${id}`, `Arco elétrico em ${id}`, 3); this.onEvent?.('ARCO', { id });
  }

  // ---------- tempo ----------
  advance(ms: number) {
    const s = this.s; const end = s.t + ms;
    while (s.t < end - 1e-6) {
      const tk = Math.floor(s.t / 100 + 1e-9) * 100 + 100;
      while (s.q.length && s.q[0].t <= tk) { const ev = s.q.shift(); if (ev.t > s.t) s.t = ev.t; this.handle(ev); }
      s.t = tk; this.tick(0.1);
    }
  }
  thermalTarget(T: string) {
    const p = this.d.params, th = p.termico, st = this.s.tr[T], mva = this.der.tr[T]?.mva || 0;
    const cap = st.vent >= 2 ? p.trafo.mvaONAF : st.vent === 1 ? p.trafo.mvaONAF1 : p.trafo.mvaONAN;
    const K = Math.pow(mva / cap, th.expoente);
    const oleo = th.ambienteC + th.elevOleoNominalK * K + st.bias;
    return { oleo, enrol: oleo + th.gradEnrolK * K };
  }
  private tick(dt: number) {
    const s = this.s, p = this.d.params, pr = this.d.protections; let dirty = false;
    // térmico de 1ª ordem (tempo comprimido) + ventilação forçada + 26/49
    for (const T of this.trafos) {
      const st = s.tr[T], tg = this.thermalTarget(T), a = Math.min(1, (dt * p.termico.compressao) / (p.termico.tauMin * 60));
      st.oleo += (tg.oleo - st.oleo) * (st.bias ? Math.min(1, a * 40) : a); st.enrol = st.oleo + (tg.enrol - tg.oleo);
      st.vent = st.oleo >= p.termico.ventG2C ? 2 : st.oleo >= p.termico.ventG1C ? Math.max(1, st.vent >= 2 && st.oleo >= p.termico.ventG2C - 5 ? 2 : 1) : st.vent && st.oleo >= p.termico.ventG1C - 5 ? 1 : 0;
      if (st.ventMan) st.vent = Math.max(st.vent, p.ventilacao?.manualForca ?? 2);
      const c26 = pr.trafo['26'], c49 = pr.trafo['49'];
      st.oleo >= c26.alarmeC ? this.alarm(`26:${T}`, `${T}: temperatura do óleo alta (26)`, 2) : this.clearAlarm(`26:${T}`);
      st.enrol >= c49.alarmeC ? this.alarm(`49:${T}`, `${T}: temperatura do enrolamento alta (49)`, 2) : this.clearAlarm(`49:${T}`);
      if (this.der.tr[T].energ && !s.locks[pr.trafo[T]['86']]) { if (st.oleo >= c26.tripC) { this.tripTrafo(T, '26'); dirty = true; } else if (st.enrol >= c49.tripC) { this.tripTrafo(T, '49'); dirty = true; } }
      st.buch === 1 ? this.alarm(`63:${T}`, `${T}: Buchholz estágio 1 (gás)`, 2) : this.clearAlarm(`63:${T}`);
      st.nivel === 'baixo' ? this.alarm(`71:${T}`, `${T}: nível de óleo baixo (71)`, 2) : this.clearAlarm(`71:${T}`);
      // 90 (OLTC) automático: 13,8 kV ± banda, atraso 30 s
      const bus = this.d.topology.trafos[T].barra, v = this.der.barras[bus]?.v || 0, o = p.trafo.oltc;
      if (st.modo === 'auto' && !st.travado && this.der.tr[T].alimenta && v > 0.5 && Math.abs(v - o.alvoPu) > o.bandaPu) {
        st.timer += dt;
        if (st.timer >= o.atrasoS) { const dir = v < o.alvoPu ? 1 : -1; if (Math.abs(st.tap + dir) <= o.degraus) { st.tap += dir; this.lg('ev', 'sistema', `${T}: OLTC automático → TAP ${st.tap > 0 ? '+' : ''}${st.tap}`); dirty = true; } st.timer = 0; }
      } else st.timer = 0;
    }
    // I-12: mestre-seguidor em paralelo / alerta ΔTAP
    const par = this.d.topology.paralelo, [ta, tb] = par.trafos;
    if (s.eq[par.disjuntor].state === 'closed' && this.der.tr[ta].alimenta && this.der.tr[tb].alimenta) {
      const seg = ta === par.mestre ? tb : ta;
      if (this.ruleOn('I-12') && s.tr[ta].modo === 'auto' && s.tr[tb].modo === 'auto' && !s.tr[seg].travado && s.tr[seg].tap !== s.tr[par.mestre].tap) { s.tr[seg].tap = s.tr[par.mestre].tap; dirty = true; }
      Math.abs(s.tr[ta].tap - s.tr[tb].tap) > p.paralelismo.dTapMax ? this.alarm('DTAP', 'Paralelo com ΔTAP > 1 (I-12)', 2) : this.clearAlarm('DTAP');
    } else this.clearAlarm('DTAP');
    // SA: ATS (I-13: uma fonte por vez) e CA
    const src = this.defs['ATS'].fontes, vivo = (k: string) => !!this.der.energ[src[k]] && this.s.eq['FU-' + k]?.state !== 'open';
    const outra = s.ca.ats === 'TSA1' ? 'TSA2' : 'TSA1';
    if (s.ca.auto && !vivo(s.ca.ats) && vivo(outra)) { s.ca.timer += dt; if (s.ca.timer >= p.sa.atsAtrasoS) { s.ca.ats = outra; s.ca.timer = 0; this.lg('ev', 'sistema', `ATS do QGCA transferiu para ${outra}`); } } else s.ca.timer = 0;
    const caOk = s.ca.geral && vivo(s.ca.ats); s.ca.ok = caOk;
    caOk ? this.clearAlarm('CA') : this.alarm('CA', 'QGCA sem tensão CA', 3);
    // CC: retificadores + bateria (tempo comprimido). C3/A10
    const c = p.cc, cc = s.cc, ret = caOk && (cc.rt.RT1 || cc.rt.RT2), antes = this.ccOk();
    if (cc.forcaV != null) cc.v = cc.forcaV;
    else if (ret) { cc.soc = Math.min(1, cc.soc + (dt * c.compressao) / (c.autonomiaH * 3600)); cc.v = Math.min(c.flutuacaoV, Math.max(cc.v, c.fimDescargaV) + dt * 2); }
    else { cc.soc -= (dt * c.compressao) / (c.autonomiaH * 3600); const lin = cc.soc >= 0 ? c.fimDescargaV + (c.nominalV - c.fimDescargaV) * cc.soc : Math.max(0, c.fimDescargaV * (1 + cc.soc / 0.25)); cc.v = Math.min(cc.v, lin); }
    if (!cc.rt.RT1 || !cc.rt.RT2) this.alarm('RT', `Falha de retificador (${!cc.rt.RT1 ? 'RT1' : ''}${!cc.rt.RT1 && !cc.rt.RT2 ? ' e ' : ''}${!cc.rt.RT2 ? 'RT2' : ''})`, 2); else this.clearAlarm('RT');
    cc.terra ? this.alarm('CC-TERRA', 'Terra no sistema CC', 2) : this.clearAlarm('CC-TERRA');
    cc.v < c.criticoV ? this.alarm('CC-CRIT', `Tensão CC crítica (< ${c.criticoV} V)`, 3) : this.clearAlarm('CC-CRIT');
    cc.v < c.alarmeV ? this.alarm('CC-SUB', `Subtensão CC (< ${c.alarmeV} V)`, 2) : this.clearAlarm('CC-SUB');
    cc.v > c.sobreV ? this.alarm('CC-SOBRE', `Sobretensão CC (> ${c.sobreV} V)`, 2) : this.clearAlarm('CC-SOBRE');
    if (antes !== this.ccOk()) { dirty = true; if (!this.ccOk()) this.lg('ev', 'sistema', `CC abaixo de ${c.mortoV} V: comandos e proteções inoperantes`); }
    // 27/59 de barra MT
    for (const b of this.d.topology.barras) {
      if (b.nivel !== 'MT') continue; const v = this.der.barras[b.id].v, bm = p.barraMT, k27 = 't27' + b.id, k59 = 't59' + b.id;
      s.tm[k27] = v < bm.u27Pu ? (s.tm[k27] || 0) + dt : 0; s.tm[k59] = v > bm.u59Pu ? (s.tm[k59] || 0) + dt : 0;
      s.tm[k27] >= bm.t27S ? this.alarm(`27:${b.id}`, `Subtensão na barra ${b.id} (27)`, 2) : v >= bm.u27Pu && this.clearAlarm(`27:${b.id}`);
      s.tm[k59] >= bm.t59S ? this.alarm(`59:${b.id}`, `Sobretensão na barra ${b.id} (59)`, 2) : v <= bm.u59Pu && this.clearAlarm(`59:${b.id}`);
    }
    // sensores de disjuntor
    for (const [id, b] of Object.entries<any>(s.eq)) { if (this.defs[id].type !== 'CBR') continue;
      b.sf6 ? this.alarm(`SF6:${id}`, `${id}: SF6 baixa densidade, estágio ${b.sf6}${b.sf6 === 2 ? ' (bloqueio)' : ''}`, b.sf6 + 1) : this.clearAlarm(`SF6:${id}`);
      b.molaDef ? this.alarm(`MOLA:${id}`, `${id}: mola descarregada`, 2) : this.clearAlarm(`MOLA:${id}`); }
    // proteção remota: única que elimina falta no AT ou com CC morta (anexo C3)
    const fAT = this.der.faltas.some((f: any) => this.nodeLevel[f.node] === 'AT'), fQ = this.der.faltas.length > 0;
    if (s.fonte.viva && (fAT || (fQ && !this.ccOk()))) { s.tm.rem = (s.tm.rem || 0) + dt; if (s.tm.rem >= p.protecaoRemota.atrasoS) { s.fonte.viva = false; s.tm.rem = 0; this.lg('prot', 'protecao', 'Proteção remota da LT-01 atuou: SE sem tensão'); this.alarm('LT', 'LT-01 sem tensão', 3); dirty = true; } } else s.tm.rem = 0;
    if (dirty) this.resolve();
  }

  // ---------- intertravamentos (anexo, seção 5) ----------
  private P: Record<string, (e: any, c: any) => string | null> = {
    assocAberto: (e) => { const x = (e.assoc || []).find((b: string) => this.s.eq[b].state !== 'open' || this.s.eq[b].moving); return x ? `disjuntor ${x} não está aberto` : null; },
    correnteZero: (e) => ((this.der.I[e.id] || 0) > 1 ? `corrente de ${(this.der.I[e.id]).toFixed(0)} A no equipamento` : null),
    fontesSeccionadas: (e) => { const x = (e.isolators || []).find((i: string) => this.conduz(this.defs[i]) || (!this.defs[i].extraivel && this.s.eq[i].state !== 'open')); return x ? `fonte não seccionada (${x})` : null; },
    ausenciaConstatada: (e) => { const r = this.s.vtest.rec[e.nodes[0]]; return r && r.valid && r.result === 'ausente' ? null : 'ausência de tensão não constatada com instrumento'; },
    semLotoTerceiros: (e, c) => (this.s.eq[e.id].loto.some((l: any) => l.dono !== c.actor) ? 'LOTO de terceiros no dispositivo' : null),
    trechoNaoAterrado: (e, c) => { if (e.extraivel && c.acao === 'close' && this.s.eq[e.id].pos !== 'servico') return null; const x = (this.isoOf[e.id] || []).find((t) => this.s.eq[t].state === 'closed'); return x ? `trecho aterrado por ${x}` : null; },
    disjuntorAberto: (e) => (this.s.eq[e.id].state !== 'open' ? 'disjuntor fechado' : null),
    foraDeServico: (e) => (this.s.eq[e.id].pos === 'servico' ? 'disjuntor na posição serviço' : null),
    condicoesParalelo: (e) => this.paralelo(e),
    sem86: (e) => { const x = Object.entries<any>(this.d.protections.bloqueios).find(([k, v]) => this.s.locks[k] && v.bloqueia.includes(e.id)); return x ? `${x[0]} atuado` : null; },
    ccPresente: () => (this.ccOk() ? null : 'sem tensão CC de comando'),
    sf6Ok: (e) => (this.s.eq[e.id].sf6 === 2 ? 'SF6 em estágio 2' : null),
    semTransito: (e) => (this.s.eq[e.id].moving ? 'posição intermediária' : null),
    molaCarregada: (e) => (this.s.eq[e.id].mola ? null : 'mola descarregada'),
    chaveLRcoerente: (e, c) => { const lr = this.s.eq[e.lr].lr; return (c.via === 'remote') === (lr === 'remoto') ? null : `chave ${e.lr} em ${lr.toUpperCase()}`; },
    semLoto: (e) => (this.s.eq[e.id].loto.length ? `cadeado/etiqueta de ${this.s.eq[e.id].loto.map((l: any) => l.dono).join(', ')}` : null),
    terminaisNaoAterrados: (e) => { if (e.extraivel && this.s.eq[e.id].pos !== 'servico') return null; const n = e.nodes.find((x: string) => this.der.gnd[x]); return n ? `terminal aterrado` : null; },
  };
  /** I-05 + função 25 do 52-P. */
  private paralelo(e: any): string | null {
    const pp = this.d.params.paralelismo, par = this.d.topology.paralelo, [b1, b2] = par.barras.map((b: string) => this.der.barras[b]);
    const cap = this.d.params.disjuntor.mt.kA, node = this.d.topology.barras.find((b: any) => b.id === par.barras[0]).node;
    const icc = this.icc(node, '3f', { [e.id]: true });
    if (!b1.energ && !b2.energ) return 'ambas as barras sem tensão';
    if (icc > cap) return `Icc resultante ${icc.toFixed(1)} kA > capacidade ${cap} kA`;
    if (!b1.energ || !b2.energ) return pp.permiteBarraMorta ? null : 'uma das barras sem tensão';
    if (pp.politica !== 'permitido') return 'política de paralelismo não permite';
    const [ta, tb] = par.trafos, dTap = Math.abs(this.s.tr[ta].tap - this.s.tr[tb].tap), dV = Math.abs(b1.v - b2.v);
    if (dTap > pp.dTapMax) return `ΔTAP = ${dTap} > ${pp.dTapMax}`;
    if (dV > pp.dVmaxPu) return `ΔV = ${(dV * 100).toFixed(1)} % > ${pp.dVmaxPu * 100} %`;
    return null;
  }
  private matchAlvo(a: any, e: any) {
    if (a.type && !(Array.isArray(a.type) ? a.type.includes(e.type) : a.type === e.type)) return false;
    if (a.kind && a.kind !== e.kind) return false;
    if (a.extraivel && !e.extraivel) return false;
    if (a.isolador && !this.isoOf[e.id]) return false;
    if (a.paralelo && this.d.topology.paralelo.disjuntor !== e.id) return false;
    if (a.comLR && !e.lr) return false;
    if (a.funcao) return false;
    return true;
  }
  violations(e: any, acoes: string[], ctx: any): { id: string; det: string; msg: string }[] {
    const out: any[] = [];
    for (const r of this.d.interlocks.regras) {
      if (!r.enabled || !r.acoes.some((a: string) => acoes.includes(a)) || !this.matchAlvo(r.alvo, e)) continue;
      for (const p of r.exige) { const det = this.P[p]?.(e, { ...ctx, acao: acoes[0] }); if (det) out.push({ id: r.id, det, msg: r.msg }); }
    }
    return out;
  }
  /** I-14: liberação de emergência — disjuntor travado fechado e ambos os lados sem tensão. */
  i14(e: any) { const b = this.s.eq[e.id]; return b.trava === 'fechado' && !e.nodes.some((n: string) => this.der.energ[n]); }

  // ---------- comandos ----------
  can(actor: Actor, cat: string) { return (this.d.scoring.permissoes[this.mode][actor] || []).includes(cat); }
  dispatch(cmd: Cmd, actor: Actor = 'treinando', opt: CmdOpt = {}): CmdResult {
    const r = this.exec(cmd, actor, opt);
    this.lg('cmd', actor, r.msg, { cmd, result: r.result, rules: r.rules, just: opt.just, bypass: opt.bypass, aprovadoPor: opt.aprovadoPor, noop: r.noop, consequencia: r.consequencia, medida: (r as any).medida, antes: (r as any).antes });
    if (r.result === 'ok' && !r.noop) this.resolve();
    return r;
  }
  private exec(cmd: Cmd, actor: Actor, opt: CmdOpt): CmdResult {
    const s = this.s, p = this.d.params;
    const ok = (msg: string, x: any = {}): CmdResult => ({ result: 'ok', rules: [], msg, ...x });
    const fail = (msg: string): CmdResult => ({ result: 'falha', rules: [], msg });
    const cat = CAT[cmd.t] || 'manobrar';
    if (!this.can(actor, cat)) return { result: 'negado', rules: [], msg: `Perfil ${actor} sem permissão para ${cat}` };
    if (opt.bypass?.length && !this.can(opt.aprovadoPor || actor, 'bypass')) return { result: 'negado', rules: opt.bypass, msg: 'Bypass de intertravamento só com liberação do Supervisor' };
    const block = (v: any[]): CmdResult | null => {
      const left = v.filter((x) => !opt.bypass?.includes(x.id));
      return left.length ? { result: 'bloqueado', rules: [...new Set(left.map((x) => x.id))] as string[], msg: 'Bloqueado — ' + left.map((x) => `${x.id}: ${x.det}`).join('; ') } : null;
    };
    switch (cmd.t) {
      case 'switch': {
        const e = this.defs[cmd.id], b = s.eq[cmd.id]; if (!e || !b || !['CBR', 'DIS'].includes(e.type)) return fail(`Equipamento ${cmd.id} inexistente`);
        const want = cmd.op === 'close' ? 'closed' : 'open', nome = `${cmd.op === 'close' ? 'Fechar' : 'Abrir'} ${cmd.id} (${cmd.via === 'remote' ? 'remoto' : 'local'})`;
        if (!e.commandModes.includes(cmd.via)) return { result: 'bloqueado', rules: ['I-08'], msg: `${nome}: equipamento sem comando ${cmd.via === 'remote' ? 'remoto' : 'local'}` };
        if (cmd.via === 'remote' && s.inj.semSupervisao) return fail(`${nome}: sem supervisão remota`);
        if (b.falha) return fail(`${nome}: equipamento danificado (${b.falha})`);
        if (b.state === want && !b.moving) return ok(`${nome}: já estava ${want === 'closed' ? 'fechado' : 'aberto'}`, { noop: true });
        const v = this.violations(e, [cmd.op], { via: cmd.via, actor }), bl = block(v); if (bl) return { ...bl, msg: `${nome}: ${bl.msg}` };
        if (e.type === 'CBR' && cmd.op === 'open' && b.trava === 'fechado') { this.alarm(`DISC:${cmd.id}`, `${cmd.id}: discordância de comando (não abriu)`, 2); return fail(`${nome}: comando emitido, disjuntor não abriu`); }
        if (e.type === 'CBR' && cmd.op === 'close' && b.trava === 'naofecha') { this.alarm(`DISC:${cmd.id}`, `${cmd.id}: discordância de comando (não fechou)`, 2); return fail(`${nome}: comando emitido, disjuntor não fechou`); }
        if (e.type === 'DIS' && b.trava === 'emperrada') return fail(`${nome}: seccionadora emperrada, não forçar`);
        const by = v.filter((x) => opt.bypass?.includes(x.id)).map((x) => x.id); let cons = '';
        const arco = by.includes('I-01') && (this.der.I[cmd.id] || 0) > 1; // bypass de I-01 sob carga → arco
        if (arco) cons = 'arco_seccionadora'; else if (by.some((x) => ['I-02', 'I-03', 'I-10'].includes(x))) cons = 'curto_franco';
        const ms = e.type === 'CBR' ? this.opMs(e, cmd.op) : e.kind === 'earthing' ? p.manobra.terraMs : p.manobra.seccionadoraMs;
        b.moving = cmd.op === 'close' ? 'closing' : 'opening';
        this.sched(s.t + ms, { type: 'swDone', id: cmd.id, to: want, arco });
        if (e.type === 'CBR' && cmd.op === 'close' && this.relayByBrk[cmd.id]) s.rel[this.relayByBrk[cmd.id].id].manualAt = s.t;
        return ok(`${nome}: executado${by.length ? ` com BYPASS de ${by.join(', ')}` : ''}`, { changed: true, consequencia: cons || undefined });
      }
      case 'rack': {
        const e = this.defs[cmd.id], b = s.eq[cmd.id]; if (!e?.extraivel) return fail(`${cmd.id} não é extraível`);
        const ord = ['servico', 'teste', 'extraido'], i = ord.indexOf(b.pos), j = ord.indexOf(cmd.to), nome = `Mover ${cmd.id} para ${String(cmd.to).toUpperCase()}`;
        if (j < 0) return fail(`${nome}: posição inválida`); if (i === j) return ok(`${nome}: já estava`, { noop: true });
        if (Math.abs(i - j) !== 1) return fail(`${nome}: passe pela posição TESTE`); if (b.moving) return fail(`${nome}: em movimento`);
        if (b.falha) return fail(`${nome}: cubículo danificado`);
        const v = this.violations(e, cmd.to === 'servico' ? ['rack', 'rack:servico'] : ['rack'], { actor }), bl = block(v); if (bl) return { ...bl, msg: `${nome}: ${bl.msg}` };
        const by = v.filter((x) => opt.bypass?.includes(x.id)).map((x) => x.id); let cons = '', arco = false;
        if (by.includes('I-04')) { if (this.i14(e)) cons = 'liberacao_emergencia_I-14'; else { arco = e.nodes.some((n: string) => this.der.energ[n]); cons = arco ? 'arco_cubiculo' : 'falha_mecanica'; if (!arco) b.falha = 'mecanica'; } }
        b.moving = 'racking'; this.sched(s.t + p.manobra.extracaoMs, { type: 'rackDone', id: cmd.id, to: cmd.to, arco });
        return ok(`${nome}: executado${by.length ? ` com BYPASS de ${by.join(', ')}` : ''}`, { changed: true, consequencia: cons || undefined });
      }
      case 'lr': {
        const e = this.defs[cmd.id], b = s.eq[cmd.id]; if (e?.type !== 'SEL') return fail(`${cmd.id} não é chave L/R`);
        if (b.lr === cmd.to) return ok(`Chave ${cmd.id} já em ${cmd.to.toUpperCase()}`, { noop: true });
        const bl = block(this.violations(e, ['lr'], { actor })); if (bl) return { ...bl, msg: `Chave ${cmd.id}: ${bl.msg}` };
        b.lr = cmd.to; return ok(`Chave ${cmd.id} em ${cmd.to.toUpperCase()}`);
      }
      case 'door': {
        const e = this.defs[cmd.id], b = s.eq[cmd.id]; if (!e?.extraivel) return fail('Sem porta');
        if (b.porta === (cmd.op === 'open')) return ok(`Porta do cubículo ${e.bay} já ${cmd.op === 'open' ? 'aberta' : 'fechada'}`, { noop: true });
        if (cmd.op === 'open') { const bl = block(this.violations(e, ['door:open'], { actor })); if (bl) return { ...bl, msg: `Porta do cubículo ${e.bay}: ${bl.msg}` }; }
        b.porta = cmd.op === 'open'; return ok(`Porta do cubículo ${e.bay} ${b.porta ? 'aberta' : 'fechada'}`);
      }
      case 'r79': {
        const rt = s.rel[cmd.rele]; if (!rt || !this.relayById[cmd.rele]['79']) return fail('Relé sem 79');
        if (rt.r79 === !!cmd.on) return ok(`79 de ${cmd.rele} já ${cmd.on ? 'em serviço' : 'bloqueado'}`, { noop: true });
        if (cmd.via === 'remote' && s.inj.semSupervisao) return fail('Sem supervisão remota');
        rt.r79 = !!cmd.on; if (!cmd.on) { rt.tok++; if (rt.ciclo !== 'bloqueado') rt.ciclo = 'idle'; }
        return ok(`79 de ${cmd.rele} ${cmd.on ? 'em serviço' : 'BLOQUEADO'}`);
      }
      case 'reset86': {
        if (!(cmd.id in s.locks)) return fail(`${cmd.id} inexistente`);
        if (cmd.via !== 'local') return { result: 'bloqueado', rules: ['I-06'], msg: `Rearme de ${cmd.id}: só local (I-06)` };
        if (!s.locks[cmd.id]) return ok(`${cmd.id} já rearmado`, { noop: true });
        if (!this.ccOk()) return fail('Sem CC');
        s.locks[cmd.id] = false; this.clearAlarm(`86:${cmd.id}`);
        for (const r of this.d.protections.reles) if (r['86'] === cmd.id) { const rt = s.rel[r.id]; rt.ciclo = 'idle'; rt.tent = 0; rt.alvos = []; }
        for (const r of this.d.protections.reles) if (r.bf?.['86'] === cmd.id) { s.rel[r.id].alvos = []; if (s.rel[r.id].ciclo === 'bloqueado' && !s.locks[r['86']]) s.rel[r.id].ciclo = 'idle'; this.clearAlarm(`BF:${r.tc}`); }
        for (const T of this.trafos) if (this.d.protections.trafo[T]['86'] === cmd.id) s.tr[T].alvos = [];
        return ok(`${cmd.id} rearmado localmente`);
      }
      case 'loto': {
        const b = s.eq[cmd.id]; if (!b) return fail(`${cmd.id} inexistente`);
        const dono = cmd.dono || actor;
        if (cmd.op === 'apply') { if (b.loto.some((l: any) => l.dono === actor)) return ok(`LOTO de ${actor} já aplicado em ${cmd.id}`, { noop: true }); b.loto.push({ dono: actor, t: s.t }); return ok(`Cadeado e etiqueta de ${actor} aplicados em ${cmd.id}`); }
        if (!b.loto.some((l: any) => l.dono === dono)) return fail(`Não há LOTO de ${dono} em ${cmd.id}`);
        if (dono !== actor) return { result: 'bloqueado', rules: ['I-09'], msg: `Remover LOTO de ${dono} em ${cmd.id}: só o dono remove (I-09)` };
        b.loto = b.loto.filter((l: any) => l.dono !== actor); return ok(`Cadeado e etiqueta de ${actor} removidos de ${cmd.id}`);
      }
      case 'vtest': {
        const vt = s.vtest;
        if (cmd.passo === 'provar') { vt.provado = true; if (vt.ultimo && vt.rec[vt.ultimo]) vt.rec[vt.ultimo].depois = true; vt.ultimo = null; return ok('Detector de tensão testado em fonte conhecida: funcionando'); }
        const e = this.defs[cmd.id]; const node = e ? e.nodes?.[0] || e.node : cmd.id; if (!(node in this.nodeLevel)) return fail('Ponto de medição inválido');
        const viva = !!this.der.energ[node];
        vt.rec[node] = { t: s.t, result: viva ? 'presente' : 'ausente', antes: vt.provado, depois: false, valid: !viva }; vt.provado = false; vt.ultimo = node;
        return ok(`Detector em ${cmd.id}: ${viva ? 'TENSÃO PRESENTE' : 'ausência de tensão'}${vt.rec[node].antes ? '' : ' (detector não testado antes)'}`, { changed: true, medida: viva ? 'presente' : 'ausente', antes: vt.rec[node].antes });
      }
      case 'tap': {
        const st = s.tr[cmd.id]; if (!st) return fail('Trafo inexistente');
        if (s.eq['90-' + cmd.id]?.loto.length) return { result: 'bloqueado', rules: ['I-09'], msg: `${cmd.id}: comando do OLTC bloqueado por cadeado/etiqueta (I-09)` };
        if (st.modo !== 'manual') return fail(`${cmd.id}: OLTC em automático`); if (st.travado) return fail(`${cmd.id}: OLTC não respondeu`);
        if (Math.abs(st.tap + cmd.dir) > p.trafo.oltc.degraus) return fail(`${cmd.id}: fim de curso do OLTC`);
        st.tap += cmd.dir; st.oltcOps = (st.oltcOps || 0) + 1; return ok(`${cmd.id}: TAP ${st.tap > 0 ? '+' : ''}${st.tap}`);
      }
      case 'oltc': { const st = s.tr[cmd.id]; if (!st) return fail('Trafo inexistente');
        if (s.eq['90-' + cmd.id]?.loto.length) return { result: 'bloqueado', rules: ['I-09'], msg: `${cmd.id}: comando do OLTC bloqueado por cadeado/etiqueta (I-09)` };
        if (st.modo === cmd.modo) return ok(`${cmd.id}: OLTC já em ${cmd.modo}`, { noop: true }); st.modo = cmd.modo; return ok(`${cmd.id}: OLTC em ${cmd.modo}`); }
      case 'vent': { const st = s.tr[cmd.id]; if (!st) return fail('Trafo inexistente'); if (st.ventMan === !!cmd.on) return ok(`${cmd.id}: ventilação já em ${cmd.on ? 'manual (forçada)' : 'automático'}`, { noop: true });
        st.ventMan = !!cmd.on; return ok(`${cmd.id}: ventilação forçada ${cmd.on ? 'LIGADA em manual (grupos 1 e 2)' : 'de volta ao automático'}`); }
      case 'aterr': {
        const node = cmd.node; if (!(node in this.nodeLevel)) return fail('Ponto de aterramento inválido');
        const nome = `${cmd.op === 'install' ? 'Instalar' : 'Retirar'} aterramento temporário em ${node}`;
        if (cmd.op === 'install') {
          if (s.terraTemp[node]) return ok(`${nome}: já instalado`, { noop: true });
          const viva = !!this.der.energ[node]; s.terraTemp[node] = { t: s.t, dono: actor };
          if (viva) { this.lg('ev', 'sistema', `ARCO ELÉTRICO: aterramento temporário instalado em ponto energizado (${node})`, { arco: 'ATERR:' + node }); this.alarm('ARCO:ATERR:' + node, `Arco no aterramento temporário em ${node}`, 3); this.onEvent?.('ARCO', { id: 'ATERR:' + node }); }
          return ok(`${nome}: instalado (terra primeiro, depois as fases)${viva ? ' — PONTO ENERGIZADO' : ''}`, { changed: true, consequencia: viva ? 'curto_franco' : undefined });
        }
        if (!s.terraTemp[node]) return ok(`${nome}: não havia aterramento`, { noop: true });
        delete s.terraTemp[node]; return ok(`${nome}: retirado (fases primeiro, terra por último)`, { changed: true });
      }
      case 'reparo': {
        const a = String(cmd.alvo || ''); if (!s.anomalias.includes(a)) return fail(`Nada a reparar em ${a || '—'}`);
        s.anomalias = s.anomalias.filter((x: string) => x !== a);
        return ok(a.startsWith('lampada_') ? `Lâmpada de sinalização do cubículo ${a.slice(8)} trocada e testada` : `Reparo em ${a} concluído`, { changed: true });
      }
      case 'ats': { if (cmd.auto != null) { s.ca.auto = !!cmd.auto; return ok(`ATS em ${cmd.auto ? 'automático' : 'manual'}`); } if (s.ca.auto) return fail('ATS em automático'); s.ca.ats = cmd.to; return ok(`QGCA alimentado por ${cmd.to} (I-13: fonte única)`); }
      case 'ca': { if (s.ca.defeito) return fail('Disjuntor geral do QGCA desarmou novamente'); s.ca.geral = true; return ok('Disjuntor geral do QGCA rearmado'); }
      case 'ack': { for (const a of s.alarmes) a.ack = true; s.alarmes = s.alarmes.filter((a: any) => a.ativo); this.onEvent?.('ACK'); return ok('Alarmes reconhecidos'); }
      case 'emergencia': { if (s.emergencia === !!cmd.on) return ok('Emergência: sem alteração', { noop: true }); s.emergencia = !!cmd.on; this.onEvent?.('ALARM_EMERGENCY', { on: s.emergencia }); return ok(s.emergencia ? 'EMERGÊNCIA ACIONADA (sirene)' : 'Emergência desligada'); }
      case 'carga': { s.nivelCarga = cmd.nivel; return ok(`Nível de carga ${(cmd.nivel * 100).toFixed(0)} %`); }
      case 'setting': {
        const r = this.relayById[cmd.rele]; const el = r?.el[cmd.el]; if (!el || !(cmd.campo in el) || !(cmd.valor > 0)) return fail('Ajuste inválido');
        const old = el[cmd.campo]; el[cmd.campo] = cmd.valor; return ok(`Ajuste ${cmd.rele}.${cmd.el}.${cmd.campo}: ${old} → ${cmd.valor}`);
      }
      case 'anotacao': { const r = this.leitura(String(cmd.ref)); return ok(`Caderno de ronda: ${r?.nome || cmd.ref} = ${cmd.valor}${r?.un ? ' ' + r.un : ''}`); }
      case 'inject': return this.inject(cmd);
    }
    return fail(`Comando desconhecido: ${cmd.t}`);
  }
  private inject(cmd: Cmd): CmdResult {
    const s = this.s, f = this.d.faults.falhas.find((x: any) => x.id === cmd.falha), prim = cmd.prim || f?.prim, a = cmd.alvo, off = !!cmd.off;
    const nome = `${cmd.falha || prim?.t} em ${a}${off ? ' REMOVIDA' : ''}`; const ok: CmdResult = { result: 'ok', rules: [], msg: `Falha ${nome}` };
    if (!prim) return { result: 'falha', rules: [], msg: `Falha ${cmd.falha} fora do escopo do MVP` };
    switch (prim.t) {
      case 'falta': {
        const node = this.d.topology.barras.find((b: any) => b.id === a)?.node || this.loads.find((l) => l.ref === a)?.node || a;
        if (off) s.faltas = s.faltas.filter((x: any) => x.node !== node);
        else s.faltas.push({ id: `${cmd.falha || 'F'}:${a}:${s.seq}`, node, tipo: cmd.tipo || prim.tipo, permanente: cmd.permanente ?? prim.permanente, sev: cmd.sev ?? 1 });
        break;
      }
      case 'travar': s.eq[a].trava = off ? null : prim.modo; break;
      case 'mola': s.eq[a].molaDef = !off; s.eq[a].mola = off; break;
      case 'sf6': s.eq[a].sf6 = off ? 0 : cmd.nivel || 1; break;
      case 'ca': s.ca.defeito = !off; if (!off) s.ca.geral = false; break;
      case 'retificador': s.cc.rt[a] = off; break;
      case 'terracc': s.cc.terra = !off; break;
      case 'vcc': s.cc.forcaV = off ? null : cmd.nivel || 105; if (off) s.cc.v = this.d.params.cc.nominalV; break;
      case 'temp': s.tr[a].bias = off ? 0 : prim.deltaC; break;
      case 'buchholz': s.tr[a].buch = off ? 0 : cmd.nivel || 1; if (s.tr[a].buch === 2) this.tripTrafo(a, '63'); break;
      case 'nivel': s.tr[a].nivel = off ? 'ok' : 'baixo'; break;
      case 'oltc': s.tr[a].travado = !off; break;
      case 'fonte': s.fonte.viva = off; off ? this.clearAlarm('LT') : this.alarm('LT', 'LT-01 sem tensão', 3); break;
      case 'supervisao': s.inj.semSupervisao = !off; break;
      case 'incendio': s.tr[a].fogo = !off; s.tr[a].defeito = !off; s.tr[a].rps = !off; if (!off) this.onEvent?.('FOGO', { trafo: a }); break;
      case 'anomalia': s.anomalias = s.anomalias.filter((x: string) => x !== a); if (!off) s.anomalias.push(a); break;
      default: return { result: 'falha', rules: [], msg: `Primitiva ${prim.t} desconhecida` };
    }
    return ok;
  }

  // ---------- leitura ----------
  /** Fatos consultados pelo scenario-engine (condições declarativas das missões). */
  fact(path: string): any {
    const [k, id, f] = path.split('.'); const s = this.s;
    switch (k) {
      case 'eq': { const b = s.eq[id]; if (!b) return undefined; if (f === 'loto') return b.loto.length; if (f === 'conduz') return this.conduz(this.defs[id]); if (f === 'lotoDe') return b.loto.map((l: any) => l.dono).join(','); return b[f]; }
      case 'no': return f === 'aterrado' ? !!this.der.gnd[id] : !!this.der.energ[id];
      case 'carga': return !!this.der.supplied[id];
      case 'barra': return f === 'v' ? this.der.barras[id]?.v : !!this.der.barras[id]?.energ;
      case 'rele': return s.rel[id]?.[f];
      case 'lock': return !!s.locks[id];
      case 'vtest': { const r = s.vtest.rec[id]; const okk = !!r && r.valid && r.result === 'ausente'; return f === 'completo' ? okk && r.antes && r.depois : f === 'antes' ? !!r?.antes : f === 'depois' ? !!r?.depois : okk; }
      case 'cc': return f === 'ok' ? s.cc.v >= this.d.params.cc.alarmeV : s.cc.v;
      case 'tr': return f === 'pct' ? this.der.tr[id]?.pct : s.tr[id]?.[f];
      case 'I': return this.der.I[id] || 0;
      case 'alarmes': return s.alarmes.filter((a: any) => a.ativo).length;
      case 'emergencia': return s.emergencia;
      case 't': return s.t / 1000;
      case 'terra': return !!s.terraTemp?.[id];
      case 'dtap': return Math.abs(s.tr.T1.tap - s.tr.T2.tap);
      case 'anomalia': return s.anomalias.includes(id);
    }
    return undefined;
  }
  /** Leituras de instrumento de campo (folha de leitura, ronda). ref = tipo:alvo. */
  leitura(ref: string): { valor: number; un: string; nome: string } | null {
    const [k, id] = ref.split(':'); const s = this.s, der = this.der, P = this.d.params.instrumentos || {};
    switch (k) {
      case 'v': return { valor: der.barras[id]?.kV ?? 0, un: 'kV', nome: `Tensão da barra ${id}` };
      case 'tap': return s.tr[id] ? { valor: s.tr[id].tap, un: '', nome: `TAP do ${id}` } : null;
      case 'mva': return der.tr[id] ? { valor: der.tr[id].mva, un: 'MVA', nome: `Carga do ${id}` } : null;
      case 'i': return { valor: der.I[id] || 0, un: 'A', nome: `Corrente em ${id}` };
      case 'oleo': return s.tr[id] ? { valor: s.tr[id].oleo, un: '°C', nome: `Óleo do ${id}` } : null;
      case 'enrol': return s.tr[id] ? { valor: s.tr[id].enrol, un: '°C', nome: `Enrolamento do ${id}` } : null;
      case 'vcc': return { valor: s.cc.v, un: 'V', nome: 'Barra CC' };
      case 'sf6': { const b = s.eq[id]; if (!b) return null; const f = P.sf6 || { nominalBar: 6, est1Bar: 5.4, est2Bar: 5.1 };
        const v = b.sf6 === 2 ? f.est2Bar - 0.06 : b.sf6 === 1 ? f.est1Bar - 0.06 : f.nominalBar + (this.hsh('sf6' + id) - 0.5) * 0.14; return { valor: v, un: 'bar', nome: `Densidade SF6 ${id}` }; }
      case 'ops': return s.ops?.[id] != null ? { valor: s.ops[id], un: 'op.', nome: `Contador de operações ${id}` } : null;
      case 'pr': return s.pr?.[id] != null ? { valor: s.pr[id], un: 'desc.', nome: `Contador do para-raios ${id}` } : null;
      case 'oltcops': return s.tr[id] ? { valor: s.tr[id].oltcOps, un: 'op.', nome: `Contador do OLTC ${id}` } : null;
      case 'nivel': return s.tr[id] ? { valor: s.tr[id].nivel === 'baixo' ? 15 : 62, un: '%', nome: `Nível de óleo ${id}` } : null;
    }
    return null;
  }
  view() { return { s: this.s, der: this.der, mode: this.mode, ccOk: this.ccOk() }; }
  snapshot() { return JSON.parse(JSON.stringify({ s: this.s, qn: this.qn })); }
  restore(snap: any) { const c = JSON.parse(JSON.stringify(snap)); this.s = c.s; this.qn = c.qn; this.resolve(); this.lg('ev', 'sistema', 'Checkpoint restaurado'); }
}
