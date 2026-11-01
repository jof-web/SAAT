// scenario-engine: missões, eventos agendados, pontuação, log auditável, checkpoints.
// norm-profile: a ordem de desenergização/reenergização vem do perfil JSON (nunca hardcoded).
import type { Domain } from '../data';
import type { Sim, Actor, Cmd, LogEntry } from '../core/sim';

export interface Erro { t: number; sev: 'critico' | 'maior' | 'menor'; comp: string; msg: string; regra?: string }
type Cond = any;

export class Scenario {
  sim: Sim; d: Domain; m: any; perfil: any; modo: 'instrutor' | 'autonomo';
  st: any; nivel: any = null;
  onChange: (() => void) | null = null;
  onFinish: ((rep: any) => void) | null = null;
  private lastLogSeq = 0;
  private prevOnLog: any;

  constructor(sim: Sim, d: Domain, missionId: string, perfilId: string, modo: 'instrutor' | 'autonomo', opts: { nivel?: any } = {}) {
    this.sim = sim; this.d = d; this.modo = modo; this.nivel = opts.nivel || null;
    this.m = JSON.parse(JSON.stringify(d.missions.missoes.find((x: any) => x.id === missionId)));
    if (!this.m) throw new Error('Missão inexistente: ' + missionId);
    this.perfil = d.profiles[perfilId];
    this.st = { flags: {}, etapas: {}, bonusEtapa: {}, checks: {}, erros: [] as Erro[], dicas: [], cos: [], fired: {}, whenAt: {}, fim: null, bonus: 0, bonusTxt: [],
      interr: {}, fec: {}, prevSup: {}, pendBypass: [], plantadas: [], relatos: [], noops: 0, inicio: sim.s.t, remotoBonus: {}, readbackErr: false, perfilId, missao: missionId, modo,
      leituras: {}, nivel: this.nivel?.id || null };
    this.prevOnLog = sim.onLog;
    sim.onLog = (e) => { this.prevOnLog?.(e); this.onLog(e); };
  }

  detach() { this.sim.onLog = this.prevOnLog; }

  start() {
    const sim = this.sim, m = this.m;
    sim.lg('ev', 'sistema', `Missão ${m.id} — ${m.nome} iniciada (perfil ${this.perfil.id}, modo ${this.modo})`, { missao: m.id });
    if (m.sorteio) { // R1: anomalias plantadas por semente
      const pool = [...m.anomalias]; const pick: any[] = [];
      while (pick.length < m.sorteio.n && pool.length) pick.push(pool.splice(Math.floor(sim.rand() * pool.length), 1)[0]);
      for (const a of pick) { sim.dispatch({ t: 'inject', ...a.inject }, 'sistema'); this.st.plantadas.push(a.id);
        m.checks.push({ id: 'relato_' + a.id, label: `Detectar e relatar: ${a.nome}`, comp: 'diagnostico', pts: 15, cond: { flag: 'relato:' + a.id }, grupo: 'Detecção' }); }
    }
    for (const it of m.setup || []) this.doAction(it, it.ator || 'sistema');
    for (const T of Object.keys(sim.der.supplied)) this.st.prevSup[T] = sim.der.supplied[T];
    this.update();
  }

  // ---------- condições declarativas ----------
  evalc(c: Cond, ctxId?: string): boolean {
    if (c === true || c == null) return true;
    if (c.all) return c.all.every((x: Cond) => this.evalc(x, ctxId));
    if (c.any) return c.any.some((x: Cond) => this.evalc(x, ctxId));
    if (c.not) return !this.evalc(c.not, ctxId);
    if (c.flag) return this.st.flags[c.flag] != null;
    if (c.etapa) return this.st.etapas[c.etapa] != null;
    if (c.check) return this.st.checks[c.check] != null;
    if (c.desde) { const f = this.st.flags[c.desde]; if (f == null) return false; const dt = (this.sim.s.t - f) / 1000; return c.lt != null ? dt < c.lt : dt >= c.gte; }
    if (c.fato) {
      const v = this.sim.fact(ctxId ? c.fato.replace('$id', ctxId) : c.fato);
      if ('eq' in c) return v === c.eq; if ('ne' in c) return v !== c.ne;
      if ('gt' in c) return v > c.gt; if ('lt' in c) return v < c.lt;
      if ('in' in c) return c.in.includes(v); if ('contem' in c) return String(v ?? '').split(',').includes(c.contem);
      return !!v;
    }
    return false;
  }
  private match(on: any, e: LogEntry): boolean {
    if (!on) return false;
    const kind = on.kind || 'cmd'; if (e.kind !== kind) return false;
    const actor = on.actor || (kind === 'cmd' ? 'treinando' : undefined); if (actor && e.actor !== actor) return false;
    for (const [k, want] of Object.entries<any>(on)) {
      if (k === 'kind' || k === 'actor') continue;
      let v: any = k === 'result' || k === 'consequencia' || k === 'medida' || k === 'antes' ? e[k] : k === 'rules' ? e.rules : e.cmd?.[k] ?? e[k];
      if (k === 'rules') { if (!(v || []).some((r: string) => (Array.isArray(want) ? want : [want]).includes(r))) return false; continue; }
      if (want === '*') { if (v == null) return false; continue; }
      if (Array.isArray(want) ? !want.includes(v) : v !== want) return false;
    }
    return true;
  }

  // ---------- eventos do sim ----------
  private onLog(e: LogEntry) {
    if (this.st.fim != null || e.kind !== 'cmd') return;
    const m = this.m, st = this.st;
    // etapas acionadas por evento (ex.: constatação = medição com resultado "ausente")
    for (const lst of ['desenergizacao', 'reenergizacao'] as const) for (const et of this.perfil[lst]) {
      const def = m.etapas?.[et.id]; if (!def?.on || st.etapas[et.id] != null) continue;
      if (lst === 'reenergizacao' && !this.evalc(m.inicioReenergizacao)) continue;
      if (this.match(def.on, e) && (!def.cond || this.evalc(def.cond))) this.completeEtapa(lst, et.id);
    }
    for (const r of [...(this.d.missions.regrasGerais || []), ...(m.regras || [])]) {
      if (!this.match(r.on, e)) continue;
      if (r.if && !this.evalc(r.if, e.cmd?.id)) continue;
      if (r.unless && this.evalc(r.unless, e.cmd?.id)) continue;
      if (r.unico && st.fired['regra:' + r.id]) continue; st.fired['regra:' + r.id] = true;
      if (r.set) st.flags[r.set] ??= this.sim.s.t;
      if (r.sev) this.erro(r.sev, r.comp || 'sequencia', r.msg, r.id);
      if (r.bonus) this.bonus(r.bonus, r.msg);
    }
    if (e.actor === 'treinando') {
      if (e.noop) { st.noops++; if (st.noops <= 3) this.erro('menor', 'sequencia', `Passo redundante: ${e.msg}`, 'redundante'); }
      // read-back antes da primeira manobra (anexo M1, erro maior)
      const primeira = st.cos.find((o: any) => o.readbackReq);
      if (primeira && !st.readbackErr && e.result === 'ok' && ['switch', 'rack', 'r79', 'lr'].includes(e.cmd?.t as string) && !primeira.readback) { st.readbackErr = true; this.erro('maior', 'comunicacao', `Manobra antes do read-back da ordem ${primeira.id}`, 'readback'); }
      // bônus remoto / penalidade por zona de risco de arco (anexo 6)
      if (e.cmd?.t === 'switch' && e.result === 'ok' && !e.noop) {
        const def = this.sim.defs[e.cmd.id];
        if (def?.type === 'CBR' && def.commandModes.includes('remote') && (!def.extraivel || this.sim.s.eq[def.id].pos === 'servico')) {
          if (e.cmd.via === 'remote') { if (!st.remotoBonus[def.id]) { st.remotoBonus[def.id] = 1; this.bonus(this.d.scoring.bonus.remoto, `Manobra remota de ${def.id}`); } }
          else if (!this.sim.s.inj.semSupervisao) this.erro('menor', 'seguranca', `Manobra local de ${def.id} com comando remoto disponível (zona de risco de arco)`, 'zona_arco');
        }
      }
    }
    this.onChange?.();
  }
  bonus(p: number, txt: string) { this.st.bonus += p; this.st.bonusTxt.push(txt); }
  /** Acrescenta um item avaliado em tempo de execução (APR, EPI, falha surpresa). */
  addCheck(c: any) { if (!this.m.checks.some((x: any) => x.id === c.id)) this.m.checks.push(c); }
  /** Valor de referência de uma leitura da folha (instrumento do sim). */
  refLeitura(id: string): number | null { const def = this.m.leituras?.find((x: any) => x.id === id); const r = def ? this.sim.leitura(def.ref) : null; return r ? r.valor : null; }
  /** Folha de leitura: compara o valor anotado com o instrumento, dentro da tolerância. */
  leitura(id: string, valor: number, actor: Actor = 'treinando') {
    const def = this.m.leituras?.find((x: any) => x.id === id); if (!def || this.st.fim != null) return { ok: false, msg: 'Leitura inexistente' };
    const ref = this.refLeitura(id); const momento = !def.cond || this.evalc(def.cond);
    const ok = ref != null && momento && isFinite(valor) && Math.abs(valor - ref) <= def.tol + 1e-9;
    this.st.leituras[id] = { valor, ref, ok, t: this.sim.s.t };
    const msg = `Folha de leitura — ${def.label}: anotado ${valor} ${def.un}${ok ? ' (confere)' : momento ? ' (NÃO confere com o instrumento)' : ' (fora do momento pedido)'}`;
    this.sim.lg('cmd', actor, msg, { cmd: { t: 'leitura', id, valor }, result: ok ? 'ok' : 'falha', rules: [] });
    if (ok) this.st.flags['leitura:' + id] ??= this.sim.s.t; else this.erro('menor', 'diagnostico', `Leitura incorreta ou fora do momento: ${def.label}`, 'leitura');
    this.update(); return { ok, msg };
  }
  erro(sev: Erro['sev'], comp: string, msg: string, regra?: string) {
    this.st.erros.push({ t: this.sim.s.t, sev, comp, msg, regra });
    this.sim.lg('err', 'sistema', `ERRO ${sev.toUpperCase()}: ${msg}`, { sev, comp, regraMissao: regra });
  }

  private completeEtapa(lst: 'desenergizacao' | 'reenergizacao', id: string) {
    const st = this.st, ordem = this.perfil[lst].map((x: any) => x.id), i = ordem.indexOf(id);
    // boa prática: constatação extra entre seccionamento e impedimento (perfil vigente) = bônus, sem concluir etapa
    for (const bp of this.perfil.boaPratica?.repeticoes || []) if (bp.etapa === id && st.etapas[bp.entre[0]] != null && st.etapas[bp.entre[1]] == null) {
      if (!st.bonusEtapa[id]) { st.bonusEtapa[id] = 1; this.bonus(this.d.scoring.bonus.boaPratica, 'Constatação adicional logo após o seccionamento (boa prática)'); }
      return;
    }
    st.etapas[id] = this.sim.s.t;
    const nome = (x: string) => this.perfil[lst].find((e: any) => e.id === x)?.nome || x;
    this.sim.lg('ev', 'sistema', `Etapa concluída: ${nome(id)}`, { etapa: id });
    for (const prev of ordem.slice(0, i)) if (st.etapas[prev] == null) {
      const crit = this.perfil.paresCriticos.some((p: string[]) => p[0] === prev && p[1] === id);
      this.erro(crit ? 'critico' : 'maior', 'sequencia', `${nome(id)} antes de ${nome(prev)} (ordem do perfil ${this.perfil.id})`, crit ? 'ordem_critica' : 'ordem');
    }
  }

  // ---------- laço ----------
  update() {
    const st = this.st, m = this.m, sim = this.sim; if (st.fim != null) return;
    for (const sc of m.script || []) { // eventos agendados
      if (st.fired[sc.id]) continue;
      if (this.modo === 'instrutor' && sc.gatilho === 'instrutor') continue;
      let due = false;
      if (sc.at != null) due = (sim.s.t - st.inicio) / 1000 >= sc.at;
      else if (sc.when && this.evalc(sc.when)) { st.whenAt[sc.id] ??= sim.s.t; due = (sim.s.t - st.whenAt[sc.id]) / 1000 >= (sc.apos || 0); }
      if (due) this.fire(sc.id);
    }
    for (const lst of ['desenergizacao', 'reenergizacao'] as const) {
      if (lst === 'reenergizacao' && !this.evalc(m.inicioReenergizacao)) continue;
      for (const et of this.perfil[lst]) { const def = m.etapas?.[et.id]; if (def?.cond && !def.on && st.etapas[et.id] == null && this.evalc(def.cond)) this.completeEtapa(lst, et.id); }
    }
    for (const c of m.checks) if (st.checks[c.id] == null && this.evalc(c.cond)) { st.checks[c.id] = sim.s.t; sim.lg('ev', 'sistema', `✓ ${c.label}`, { check: c.id }); }
    // continuidade didática (DEC/FEC) — interrupção indevida por ação do treinando
    const last = sim.log.slice(-8).filter((e) => e.seq > this.lastLogSeq);
    for (const [al, sup] of Object.entries<boolean>(sim.der.supplied)) {
      if (st.prevSup[al] && !sup) { st.fec[al] = (st.fec[al] || 0) + 1;
        if (!m.cargasPlanejadas?.includes(al) && last.some((e) => e.kind === 'cmd' && e.actor === 'treinando' && e.result === 'ok')) this.erro('maior', 'tempo', `Interrupção indevida de ${al}`, 'continuidade'); }
      st.prevSup[al] = sup;
    }
    this.lastLogSeq = sim.s.seq;
    if (m.fim && this.evalc(m.fim)) this.finish('concluída');
    this.onChange?.();
  }
  tickContinuidade(dtS: number) { for (const [al, sup] of Object.entries<boolean>(this.sim.der.supplied)) if (!sup) this.st.interr[al] = (this.st.interr[al] || 0) + dtS; }

  fire(id: string) {
    const sc = this.m.script.find((x: any) => x.id === id); if (!sc || this.st.fired[id]) return;
    this.st.fired[id] = true; this.sim.lg('ev', 'sistema', `Evento do cenário: ${sc.desc}`, { script: id });
    for (const a of sc.do) this.doAction(a, a.ator || sc.ator || 'sistema');
  }
  private doAction(a: any, ator: Actor) {
    if (a.cos) this.cosOrdem(a.cos.id, a.cos.texto, a.cos.readback !== false);
    if (a.msg) this.sim.lg('com', ator, a.msg);
    if (a.cmd) this.sim.dispatch(a.cmd, ator);
    if (a.inject) this.sim.dispatch({ t: 'inject', ...a.inject }, 'sistema');
    if (a.set) this.st.flags[a.set] ??= this.sim.s.t;
  }
  cosOrdem(id: string, texto: string, readbackReq = true) {
    if (this.st.cos.some((o: any) => o.id === id)) id = id + '-' + this.st.cos.length;
    this.st.cos.push({ id, texto, t: this.sim.s.t, readback: false, readbackReq });
    this.sim.lg('com', 'cos', texto, { ordem: id }); this.onChange?.();
  }

  // ---------- ações do treinando ----------
  executar(id: string, actor: Actor = 'treinando') {
    const a = this.m.acoes?.find((x: any) => x.id === id); if (!a) return;
    const okc = this.evalc(a.cond); const flag = a.set || id;
    if (okc) this.st.flags[flag] ??= this.sim.s.t;
    this.sim.lg('cmd', actor, `${a.label}: ${okc ? 'feito' : 'não aplicável — ' + (a.falha || 'condição não atendida')}`, { cmd: { t: 'proc', id }, result: okc ? 'ok' : 'falha', rules: [] });
    this.update();
  }
  readback(ordem: string) {
    const o = this.st.cos.find((x: any) => x.id === ordem); if (!o || o.readback) return;
    o.readback = true; this.st.flags['readback:' + ordem] = this.sim.s.t;
    this.sim.lg('cmd', 'treinando', `Read-back da ordem ${ordem}: "${o.texto}"`, { cmd: { t: 'proc', id: 'readback', ordem }, result: 'ok', rules: [] });
    this.update();
  }
  decidir(id: string, op: string) {
    const dd = this.m.decisoes?.find((x: any) => x.id === id); const o = dd?.opcoes.find((x: any) => x.id === op); if (!o) return;
    if (this.st.flags['decisao:' + id] != null) return;
    this.st.flags['decisao:' + id] = this.sim.s.t; this.st.flags[`decisao:${id}:${op}`] = this.sim.s.t;
    this.sim.lg('cmd', 'treinando', `Decisão "${dd.titulo}": ${o.texto}`, { cmd: { t: 'decisao', id, op, correta: !!o.correta }, result: 'ok', rules: [] });
    this.update();
  }
  relatar(id: string) {
    if (this.st.relatos.includes(id)) return; this.st.relatos.push(id);
    const a = [...(this.m.anomalias || []), ...(this.m.distratores || [])].find((x: any) => x.id === id);
    const ok = this.st.plantadas.includes(id);
    this.sim.lg('cmd', 'treinando', `Relato de anomalia: ${a?.nome || id}`, { cmd: { t: 'relato', id }, result: ok ? 'ok' : 'falha', rules: [] });
    if (ok) this.st.flags['relato:' + id] = this.sim.s.t; else this.erro('menor', 'diagnostico', `Relato incorreto: ${a?.nome || id}`, 'relato');
    this.update();
  }
  /** Bypass: treinando solicita, Supervisor (instrutor ou script) decide com justificativa. */
  pedirBypass(cmd: Cmd, rules: string[]) {
    const req = { id: 'BP' + (this.st.pendBypass.length + 1) + '-' + this.sim.s.seq, cmd, rules, t: this.sim.s.t, estado: 'pendente' };
    this.sim.lg('cmd', 'treinando', `Solicitação de bypass de ${rules.join(', ')} para ${cmd.t} ${cmd.id || ''}`, { cmd: { ...cmd, t: 'pedido_bypass', tipo: cmd.t }, result: 'ok', rules });
    if (this.modo === 'autonomo') {
      const ab = (this.m.autoBypass || []).find((x: any) => rules.every((r) => r === x.regra) && x.id === cmd.id && this.evalc(x.if));
      this.st.pendBypass.push(req); this.decidirBypass(req.id, !!ab, ab ? ab.just : 'Supervisor (script): condições de liberação não atendidas');
    } else { this.st.pendBypass.push(req); this.onChange?.(); }
    return req;
  }
  decidirBypass(id: string, aprova: boolean, just: string) {
    const r = this.st.pendBypass.find((x: any) => x.id === id); if (!r || r.estado !== 'pendente') return;
    r.estado = aprova ? 'aprovado' : 'negado'; r.just = just;
    this.sim.lg('cmd', 'supervisor', `Bypass ${r.rules.join(', ')} ${aprova ? 'APROVADO' : 'NEGADO'}: ${just}`, { cmd: { t: 'bypass', ref: id }, result: aprova ? 'ok' : 'negado', rules: r.rules, just });
    if (aprova) this.sim.dispatch(r.cmd, 'treinando', { bypass: r.rules, just, aprovadoPor: 'supervisor' });
    this.update();
  }
  dica(nivel: 1 | 2 | 3): string {
    const pend = this.m.checks.find((c: any) => this.st.checks[c.id] == null);
    const txt = nivel === 1 ? `Objetivo: ${this.m.objetivo}` : !pend ? 'Todas as etapas avaliadas foram cumpridas.' : nivel === 2 ? `Próxima etapa: ${pend.grupo}` : `Ação: ${pend.label}`;
    this.st.dicas.push({ nivel, t: this.sim.s.t, txt });
    this.sim.lg('com', 'instrutor', `Dica N${nivel}: ${txt}`, { dica: nivel }); this.onChange?.();
    return txt;
  }
  acoesPara(local: string) {
    return { acoes: (this.m.acoes || []).filter((a: any) => a.local?.includes(local)), decisoes: (this.m.decisoes || []).filter((a: any) => a.local?.includes(local)) };
  }

  // ---------- avaliação ----------
  score() {
    const sc = this.d.scoring, st = this.st, m = this.m;
    const elapsed = ((st.fim ?? this.sim.s.t) - st.inicio) / 1000;
    const comps: any = {};
    for (const k of Object.keys(sc.pesos)) {
      const cs = m.checks.filter((c: any) => c.comp === k);
      let poss = cs.reduce((a: number, c: any) => a + c.pts, 0), got = cs.filter((c: any) => st.checks[c.id] != null).reduce((a: number, c: any) => a + c.pts, 0);
      if (k === 'tempo' && m.tempoPrevistoS && st.fim != null) { poss += 10; if (elapsed <= m.tempoPrevistoS) got += 10; }
      const errs = st.erros.filter((e: Erro) => e.comp === k && e.sev !== 'critico');
      if (!poss && !errs.length) { comps[k] = null; continue; }
      const base = poss ? (got / poss) * 100 : 100;
      const pen = errs.reduce((a: number, e: Erro) => a + (e.sev === 'maior' ? sc.penalidades.maior : sc.penalidades.menor), 0);
      comps[k] = Math.max(0, Math.min(100, base - pen));
    }
    let wsum = 0, tot = 0; for (const [k, v] of Object.entries<any>(comps)) if (v != null) { wsum += sc.pesos[k]; tot += sc.pesos[k] * v; }
    const fat = this.nivel?.dicaFator ?? 1; const dicasPen = st.dicas.reduce((a: number, d: any) => a + sc.dicas['N' + d.nivel] * fat, 0);
    const final = Math.max(0, Math.min(100, (wsum ? tot / wsum : 0) - dicasPen + st.bonus));
    const criticos = st.erros.filter((e: Erro) => e.sev === 'critico');
    return { comps, final, elapsed, dicasPen, bonus: st.bonus, criticos: criticos.length, status: criticos.length ? 'REPROVADO (erro crítico)' : st.fim == null ? 'em andamento' : final >= sc.aprovacao ? 'APROVADO' : 'REPROVADO' };
  }
  finish(motivo: string) {
    if (this.st.fim != null) return; this.st.fim = this.sim.s.t;
    const m = this.m, elapsed = (this.st.fim - this.st.inicio) / 1000;
    const tf = this.nivel?.tempoFator ?? this.d.scoring.tempoMenorFator;
    if (m.tempoPrevistoS && elapsed > m.tempoPrevistoS * tf) { this.st.fim = null; this.erro('menor', 'tempo', `Tempo ${elapsed.toFixed(0)} s > ${Math.round(tf * 100)} % do previsto (${m.tempoPrevistoS} s)`, 'tempo'); this.st.fim = this.sim.s.t; }
    this.sim.lg('ev', 'sistema', `Missão ${m.id} encerrada (${motivo})`, { fimMissao: m.id });
    this.onFinish?.(this.report()); this.onChange?.();
  }
  report() {
    const s = this.score(); const st = this.st, m = this.m;
    return { versao: 2, missao: { id: m.id, nome: m.nome }, perfil: this.perfil.id, modo: this.modo, semente: this.sim.s.seed, encerrada: st.fim != null, nivel: this.nivel ? { id: this.nivel.id, nome: this.nivel.nome } : null, leituras: st.leituras,
      nota: s, pesos: this.d.scoring.pesos, nomes: this.d.scoring.nomes,
      checks: m.checks.map((c: any) => ({ id: c.id, label: c.label, comp: c.comp, pts: c.pts, feito: st.checks[c.id] != null, t: st.checks[c.id] })),
      etapas: [...this.perfil.desenergizacao, ...this.perfil.reenergizacao].map((e: any) => ({ ...e, t: st.etapas[e.id] })).filter(() => !!m.etapas),
      erros: st.erros, dicas: st.dicas, bonus: st.bonusTxt, cos: st.cos, bypass: st.pendBypass, plantadas: st.plantadas, relatos: st.relatos,
      continuidade: Object.keys(this.sim.der.supplied).map((al) => ({ al, interrupcoes: st.fec[al] || 0, minutos: +((st.interr[al] || 0) / 60).toFixed(2) })),
      log: this.sim.log };
  }

  // ---------- sequência golden (dados) ----------
  goldenSteps(ordemPerfil?: any): any[] {
    const g = this.m.golden; if (!g) return [];
    const p = ordemPerfil || this.perfil; const out: any[] = [...(g.inicio || [])];
    if (g.seccionamento) { for (const e of p.desenergizacao) out.push(...(g[e.id] || [])); out.push(...(g.meio || [])); for (const e of p.reenergizacao) out.push(...(g[e.id] || [])); }
    out.push(...(g.fim || [])); return out;
  }
}

/** Executa uma sequência golden no modo autônomo (testes e Teste de Funções). */
export function runGolden(sc: Scenario, steps: any[], maxWaitS = 600) {
  const sim = sc.sim; const adv = (s: number) => { for (let i = 0; i < Math.round(s * 10); i++) { sim.advance(100); sc.tickContinuidade(0.1); sc.update(); } };
  for (const it of steps) {
    if (it.wait != null) adv(it.wait);
    else if (it.waitFlag) { let n = 0; while (sc.st.flags[it.waitFlag] == null && n++ < maxWaitS * 10) adv(0.1); }
    else if (it.readback) sc.readback(it.readback);
    else if (it.acao) sc.executar(it.acao);
    else if (it.decisao) sc.decidir(it.decisao[0], it.decisao[1]);
    else if (it.relato) sc.relatar(it.relato);
    else if (it.leitura) sc.leitura(it.leitura, sc.refLeitura(it.leitura) ?? NaN);
    else if (it.bypassReq) { const r = sim.dispatch(it.bypassReq, 'treinando'); if (r.result === 'bloqueado') sc.pedirBypass(it.bypassReq, r.rules); }
    else if (it.cmd) sim.dispatch(it.cmd, it.ator || 'treinando');
    sc.update();
  }
  adv(1);
}
