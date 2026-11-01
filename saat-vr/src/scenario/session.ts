// Sessão = sim-core + scenario-engine + EPI/ferramentas + nível + registro de entradas (replay determinístico e checkpoints).
import type { Domain } from '../data';
import { Sim, type Actor, type Cmd, type CmdOpt, type CmdResult } from '../core/sim';
import { Scenario } from './engine';
import { Inventory, tarefaDe } from '../train/inventory';

export interface SessionCfg {
  missao: string | null; perfil: string; modo: 'instrutor' | 'autonomo'; semente: number; treinando: string; sandbox: boolean;
  nivel?: string; treinandoId?: string; matricula?: string; funcao?: string; exigirEpi?: boolean;
}
export type Input = { t: number; k: string; a: any[] };

export class Session {
  d: Domain; cfg: SessionCfg; sim: Sim; sc: Scenario | null = null; inv: Inventory; nivel: any = null;
  inputs: Input[] = []; checkpoints: { id: string; t: number; snap: any; st: any; nIn: number; inv: any }[] = [];
  paused = false; speed = 1; replaying = false; areaAtual = '';
  surpresa: { at: number; item: any; feito: boolean } | null = null;
  avisos: string[] = []; // mensagens didáticas pendentes para a UI (EPI, área)
  private avisados = new Set<string>();
  onTick: (() => void) | null = null;

  constructor(d: Domain, cfg: SessionCfg) {
    this.d = d; this.cfg = cfg;
    this.sim = new Sim(d, cfg.semente);
    this.sim.mode = cfg.sandbox ? 'sandbox' : 'missao';
    this.inv = new Inventory(d, cfg.semente);
    this.nivel = d.levels?.niveis.find((n: any) => n.id === cfg.nivel) || (cfg.nivel === 'avaliacao' ? d.levels?.avaliacao : null) || null;
    if (cfg.missao) {
      this.sc = new Scenario(this.sim, d, cfg.missao, cfg.perfil, cfg.modo, { nivel: this.nivel });
      const os = d.os?.ordens?.[cfg.missao];
      if (os && !os.semAPR) this.sc.addCheck({ id: 'apr', label: 'APR feita (riscos e controles da tarefa)', comp: 'seguranca', pts: 10, cond: { flag: 'apr_ok' }, grupo: 'Planejamento' });
      if (this.exigeEpi() && (d.epi?.missao?.[cfg.missao] || []).length) this.sc.addCheck({ id: 'epi', label: 'Conferir EPI e ferramentas (inspecionados, sem defeito)', comp: 'seguranca', pts: 10, cond: { flag: 'epi_ok' }, grupo: 'Planejamento' });
      if (this.nivel?.surpresa && this.nivel.surpresas?.length) {
        const [a, b] = this.nivel.surpresaJanelaS || [60, 180]; const h = this.sim.hsh('surpresa' + cfg.missao);
        const item = this.nivel.surpresas[Math.floor(this.sim.hsh('surpresaItem' + cfg.missao) * this.nivel.surpresas.length)];
        this.surpresa = { at: (a + (b - a) * h) * 1000, item, feito: false };
      }
    }
  }
  exigeEpi() { return (!this.cfg.sandbox || !!(this.cfg as any).livreErros) && this.cfg.exigirEpi !== false; }
  start() {
    this.sim.lg('ev', 'sistema', `Sessão iniciada — treinando: ${this.cfg.treinando || '—'}${this.nivel ? `, nível ${this.nivel.nome}` : ''}, semente ${this.cfg.semente}${this.cfg.sandbox ? ', modo LIVRE (sandbox)' : ''}`);
    this.sc?.start();
  }

  /** Avança exatamente um tick de 100 ms (determinístico). */
  tick() {
    this.sim.advance(100);
    if (this.surpresa && !this.surpresa.feito && this.sc && this.sc.st.fim == null && this.sim.s.t >= this.surpresa.at) this.dispararSurpresa();
    if (this.sc) { this.sc.tickContinuidade(0.1); this.sc.update(); }
    this.onTick?.();
  }
  private dispararSurpresa() {
    const s = this.surpresa!, sc = this.sc!; s.feito = true;
    this.sim.dispatch({ t: 'inject', falha: s.item.falha, alvo: s.item.alvo }, 'sistema');
    this.sim.lg('ev', 'sistema', 'Nível avançado: falha surpresa injetada (identifique e registre)', { surpresa: true });
    const ops = this.nivel.surpresas.map((x: any, i: number) => ({ id: 's' + i, texto: x.nome, correta: x === s.item }));
    sc.m.decisoes = [...(sc.m.decisoes || []), { id: 'surpresa', titulo: 'Registrar a falha surpresa identificada', local: ['IHM', 'radio'], opcoes: ops }];
    const ok = ops.find((o: any) => o.correta).id;
    sc.addCheck({ id: 'surpresa', label: 'Identificar e registrar a falha surpresa', comp: 'diagnostico', pts: 10, cond: { flag: `decisao:surpresa:${ok}` }, grupo: 'Falha surpresa' });
    sc.m.regras = [...(sc.m.regras || []), { id: 'surpresa_errada', on: { t: 'decisao', id: 'surpresa', correta: false }, sev: 'menor', comp: 'diagnostico', msg: 'Falha surpresa identificada errado' }];
  }
  private rec(k: string, a: any[]) { if (!this.replaying) this.inputs.push({ t: this.sim.s.t, k, a: JSON.parse(JSON.stringify(a)) }); }
  private avisar(chave: string, txt: string) { if (this.avisados.has(chave)) return; this.avisados.add(chave); this.avisos.push(txt); }

  // ---- entradas (todas passam por aqui para o replay) ----
  cmd(c: Cmd, actor: Actor = 'treinando', opt: CmdOpt = {}): CmdResult {
    this.rec('cmd', [c, actor, opt]);
    let pos: (() => void) | null = null;
    if (actor === 'treinando' && this.exigeEpi() && !opt.bypass) {
      if (c.t === 'vtest' && c.passo === 'provar') {
        const det = this.inv.usar('detector_mt') || this.inv.usar('detector_at');
        if (!det) return this.recusa(c, 'Sem detector de tensão. Pegue o detector adequado no armário de ferramentas.');
        if (det.defeito) { det.inspecionado = true; return this.recusa(c, `Teste do detector FALHOU (${det.defeito}). Não use: troque por outra unidade.`); }
      }
      const tar = tarefaDe(c, this.sim);
      if (tar) {
        const f = this.inv.faltando(tar);
        if (f.ferr.length) { const msg = `${f.nome}: falta ${f.ferr.map((i) => this.inv.nome(i)).join(', ')}. Pegue no armário de ferramentas.`; return this.recusa(c, msg); }
        if (c.t === 'vtest' && c.passo === 'medir' && tar === 'constatacao_at' && !this.inv.usar('detector_at')) return this.recusa(c, 'Detector inadequado: use o detector 145 kV com vara.');
        if (f.epi.length) {
          const lista = f.epi.map((i) => this.inv.nome(i)).join(', ');
          if (this.nivel?.epi === 'bloqueia') return this.recusa(c, `${f.nome}: falta EPI — ${lista}. Volte ao armário de EPI. (No nível Básico a ação fica bloqueada para você aprender a sequência.)`);
          pos = () => { if (this.sc && !this.avisados.has('epi:' + tar)) { this.avisados.add('epi:' + tar); this.sc.erro('maior', 'seguranca', `${f.nome} sem EPI completo: ${lista}`, 'epi'); } this.avisos.push(`Atenção: ${f.nome} sem ${lista}.`); };
        }
        const prev = pos;
        if (f.defeituosos.length || f.naoInspecionados.length) pos = () => { prev?.();
          for (const u of f.defeituosos) if (this.sc && !this.avisados.has('def:' + u.uid)) { this.avisados.add('def:' + u.uid); this.sc.erro('maior', 'seguranca', `Usou ${this.inv.nome(u.item)} com defeito (${u.defeito})`, 'epi_defeito'); }
          for (const u of f.naoInspecionados) if (this.sc && !this.avisados.has('insp:' + u.uid)) { this.avisados.add('insp:' + u.uid); this.sc.erro('menor', 'seguranca', `Usou ${this.inv.nome(u.item)} sem inspecionar`, 'epi_inspecao'); } };
      }
    }
    const r = this.sim.dispatch(c, actor, opt);
    if (r.result === 'ok') pos?.();
    this.sc?.update(); return r;
  }
  private recusa(c: Cmd, msg: string): CmdResult {
    const r: CmdResult = { result: 'falha', rules: [], msg };
    this.sim.lg('cmd', 'treinando', msg, { cmd: c, result: 'falha', rules: [], epi: true });
    return r;
  }
  acao(id: string) { this.rec('acao', [id]); this.sc?.executar(id); }
  readback(id: string) { this.rec('readback', [id]); this.sc?.readback(id); }
  decidir(id: string, op: string) { this.rec('decidir', [id, op]); this.sc?.decidir(id, op); }
  relatar(id: string) { this.rec('relatar', [id]); this.sc?.relatar(id); }
  leitura(id: string, valor: number) { this.rec('leitura', [id, valor]); return this.sc?.leitura(id, valor) || { ok: false, msg: 'Sem missão' }; }
  pedirBypass(c: Cmd, rules: string[]) { this.rec('pedirBypass', [c, rules]); return this.sc?.pedirBypass(c, rules); }
  decidirBypass(id: string, ap: boolean, just: string) { this.rec('decidirBypass', [id, ap, just]); this.sc?.decidirBypass(id, ap, just); }
  dica(n: 1 | 2 | 3) { if (this.nivel && this.nivel.dicaFator > 1 && !this.replaying && this.cfg.modo !== 'instrutor') { /* avançado: dicas só pelo instrutor */ }
    this.rec('dica', [n]); return this.sc?.dica(n) || ''; }
  fire(id: string) { this.rec('fire', [id]); this.sc?.fire(id); this.sc?.update(); }
  cos(texto: string, readback = true) { this.rec('cos', [texto, readback]); if (this.sc) this.sc.cosOrdem('COS-' + (this.sc.st.cos.length + 1), 'COS: ' + texto, readback); else this.sim.lg('com', 'cos', 'COS: ' + texto); }
  papel(ator: Actor, texto: string) { this.rec('papel', [ator, texto]); this.sim.lg('com', ator, texto); }
  finish(motivo: string) { this.rec('finish', [motivo]); this.sc?.finish(motivo); }
  /** Marca um fato observado pela camada de jogo (posição, contato, etapa de resgate). Entra no replay. */
  marcar(flag: string, msg?: string) { this.rec('marcar', [flag, msg]); if (msg) this.sim.lg('ev', 'treinando', msg, { flag }); if (this.sc && this.sc.st.flags[flag] == null) { this.sc.st.flags[flag] = this.sim.s.t; this.sc.update(); } }
  /** Acidente detectado pela camada de jogo: erro crítico + registro. */
  acidente(tipo: string, causa: string, lesao: string) {
    this.rec('acidente', [tipo, causa, lesao]); this.sim.lg('ev', 'sistema', `ACIDENTE (${tipo}): ${causa} — ${lesao}`, { acidente: tipo });
    if (this.sc) { this.sc.st.flags['acidente'] ??= this.sim.s.t; this.sc.st.flags['acidente:' + tipo] ??= this.sim.s.t; this.sc.erro('critico', 'seguranca', `Acidente — ${causa}`, 'acidente'); this.sc.update(); }
  }
  /** Erro avaliado pela camada de jogo (ex.: entrou em zona controlada sem necessidade). */
  erroJogo(sev: 'menor' | 'maior' | 'critico', comp: string, msg: string, regra: string) { this.rec('erroJogo', [sev, comp, msg, regra]); if (this.sc && !this.sc.st.fired['jogo:' + regra]) { this.sc.st.fired['jogo:' + regra] = true; this.sc.erro(sev, comp, msg, regra); } }

  // ---- EPI e ferramentas ----
  epi(op: 'pegar' | 'devolver' | 'inspecionar' | 'descartar', uid: string) {
    this.rec('epi', [op, uid]); let txt = '', ok = true;
    if (op === 'inspecionar') { const r = this.inv.inspecionar(uid); txt = r.txt; ok = r.ok; } else txt = (this.inv as any)[op](uid);
    this.sim.lg('cmd', 'treinando', txt, { cmd: { t: 'epi', op, uid }, result: ok ? 'ok' : 'falha', rules: [] });
    return { ok, txt };
  }
  conferirEpi() {
    this.rec('conferirEpi', []); const m = this.cfg.missao; const tar = (m && this.d.epi.missao[m]) || [];
    const r = this.inv.conferir(tar);
    const txt = r.ok ? 'Conferência de EPI e ferramentas: tudo certo para a tarefa.' : `Conferência de EPI: ${[r.faltam.length ? 'falta ' + r.faltam.map((i) => this.inv.nome(i)).join(', ') : '', r.def.length ? 'com defeito: ' + r.def.map((u) => this.inv.nome(u.item)).join(', ') : '', r.naoInsp.length ? 'sem inspeção: ' + r.naoInsp.map((u) => this.inv.nome(u.item)).join(', ') : ''].filter(Boolean).join(' · ')}`;
    this.sim.lg('cmd', 'treinando', txt, { cmd: { t: 'conferir_epi' }, result: r.ok ? 'ok' : 'falha', rules: [] });
    if (r.ok && this.sc) { this.sc.st.flags['epi_ok'] ??= this.sim.s.t; this.sc.update(); }
    return { ...r, txt };
  }
  /** Entrada em área com exigência de EPI (pátio, sala de baterias). */
  area(nome: string) {
    if (nome === this.areaAtual) return; this.rec('area', [nome]); this.areaAtual = nome;
    const tar = nome === 'patio' ? 'patio' : nome === 'bateria' ? 'bateria' : null; if (!tar || !this.exigeEpi()) return;
    const f = this.inv.faltando(tar); if (!f.epi.length) return;
    const lista = f.epi.map((i) => this.inv.nome(i)).join(', ');
    this.sim.lg('ev', 'sistema', `Entrou em ${tar === 'patio' ? 'área do pátio 138 kV' : 'sala de baterias'} sem: ${lista}`, { area: nome });
    if (this.sc && this.nivel?.epi !== 'bloqueia') { if (!this.avisados.has('area:' + tar)) { this.avisados.add('area:' + tar); this.sc.erro('menor', 'seguranca', `Entrou em ${tar === 'patio' ? 'área do pátio' : 'sala de baterias'} sem EPI: ${lista}`, 'epi_area'); } }
    this.avisar('aviso-area:' + tar, `EPI obrigatório para ${f.nome.toLowerCase()}: ${lista}.`);
  }
  /** APR: riscos marcados e controles escolhidos. */
  apr(sel: Record<string, string[]>) {
    this.rec('apr', [sel]); const sc = this.sc; if (!sc) return null;
    const os = this.d.os.ordens[sc.m.id]; const esperado: string[] = os?.riscos || [];
    const marcados = Object.keys(sel); const acert = esperado.filter((r) => marcados.includes(r)); const faltou = esperado.filter((r) => !marcados.includes(r)); const sobra = marcados.filter((r) => !esperado.includes(r));
    const ctlOk = acert.filter((r) => { const cat = this.d.os.riscos.find((x: any) => x.id === r)?.controles || []; return (sel[r] || []).some((c) => cat.includes(c)); });
    const pct = esperado.length ? Math.round(((acert.length + ctlOk.length) / (2 * esperado.length)) * 100 - sobra.length * 5) : 100;
    const criticos = ['choque', 'arco', 'reenergizacao'].filter((r) => esperado.includes(r) && faltou.includes(r));
    const ok = pct >= 80 && !criticos.length;
    sc.st.apr = { pct, faltou, sobra, ctlOk: ctlOk.length, ok };
    this.sim.lg('cmd', 'treinando', `APR registrada: ${pct} % de acerto${faltou.length ? ` · riscos esquecidos: ${faltou.join(', ')}` : ''}`, { cmd: { t: 'apr' }, result: ok ? 'ok' : 'falha', rules: [] });
    if (ok) sc.st.flags['apr_ok'] ??= this.sim.s.t; else if (!sc.st.flags['apr_err']) { sc.st.flags['apr_err'] = this.sim.s.t; sc.erro(criticos.length ? 'maior' : 'menor', 'seguranca', `APR incompleta (${pct} %)${criticos.length ? ': faltou ' + criticos.join(', ') : ''}`, 'apr'); }
    sc.update(); return sc.st.apr;
  }

  checkpoint(): string { const id = 'CP' + (this.checkpoints.length + 1); this.checkpoints.push({ id, t: this.sim.s.t, snap: this.sim.snapshot(), st: this.sc ? JSON.parse(JSON.stringify(this.sc.st)) : null, nIn: this.inputs.length, inv: this.inv.snapshot() }); this.sim.lg('ev', 'instrutor', `Checkpoint ${id} salvo`); return id; }
  restore(id: string) {
    const cp = this.checkpoints.find((c) => c.id === id); if (!cp) return;
    this.rec('restore', [id]); this.sim.restore(cp.snap); if (this.sc && cp.st) this.sc.st = JSON.parse(JSON.stringify(cp.st)); if (cp.inv) this.inv.units = JSON.parse(JSON.stringify(cp.inv));
  }
  private applyInput(i: Input) { const a = i.a; (this as any)[i.k](...a); }

  /** Reconstrói a sessão a partir das entradas (replay). Retorna nova sessão posicionada no fim. */
  static replay(d: Domain, cfg: SessionCfg, inputs: Input[], checkpoints: any[] = [], untilT = Infinity, onStep?: (s: Session) => void): Session {
    const s = new Session(d, cfg); s.replaying = true; s.checkpoints = checkpoints; s.start();
    let i = 0; const end = Math.min(untilT, inputs.length ? inputs[inputs.length - 1].t + 2000 : 0);
    while (s.sim.s.t <= end) {
      while (i < inputs.length && inputs[i].t <= s.sim.s.t) s.applyInput(inputs[i++]);
      if (i >= inputs.length && s.sim.s.t >= end) break;
      s.tick(); onStep?.(s);
    }
    s.replaying = false; return s;
  }
  exportJSON() { return { formato: 'saat-sessao', versao: 2, cfg: this.cfg, inputs: this.inputs, relatorio: this.report() }; }
  report() { const r: any = this.sc?.report() || { log: this.sim.log }; r.treinando = { nome: this.cfg.treinando, matricula: this.cfg.matricula, funcao: this.cfg.funcao };
    r.apr = this.sc?.st.apr || null; r.epiUso = this.inv.units.filter((u) => u.comigo || u.inspecionado || u.descartado).map((u) => `${this.inv.nome(u.item)} #${u.n}: ${u.comigo ? 'em uso' : 'devolvido'}${u.inspecionado ? ', inspecionado' : ''}${u.defeito && u.inspecionado ? ` (defeito encontrado: ${u.defeito})` : u.defeito && u.comigo ? ` (DEFEITO NÃO PERCEBIDO: ${u.defeito})` : ''}${u.descartado ? ', separado' : ''}`); return r; }
}
