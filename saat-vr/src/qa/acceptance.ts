// Critérios de aceite do MVP (anexo, seção 10). Usado pelo Vitest e pelo modo "Teste de Funções".
import { defaultDomain, type Domain } from '../data';
import { Sim } from '../core/sim';
import { Scenario, runGolden } from '../scenario/engine';
import { curveTime, eval87T } from '../core/net';

export interface AResult { id: string; nome: string; esperado: string; obtido: string; pass: boolean }
const near = (v: number, ref: number, tol: number) => Math.abs(v - ref) <= Math.abs(ref) * tol;
const f = (x: number, d = 1) => x.toFixed(d).replace('.', ',');

export function runAcceptance(mk: () => Domain = defaultDomain): AResult[] {
  const out: AResult[] = [];
  const add = (id: string, nome: string, esperado: string, obtido: string, pass: boolean) => out.push({ id, nome, esperado, obtido, pass });
  const sim = () => new Sim(mk(), 7);
  const T = (fn: () => void, id: string, nome: string) => { try { fn(); } catch (e: any) { add(id, nome, '-', 'EXCEÇÃO: ' + e.message, false); } };

  T(() => { const s = sim(); const r = s.dispatch({ t: 'switch', id: '89-T1-1', op: 'open', via: 'remote' });
    add('A1', 'Abrir 89-T1-1 com 52-T1 fechado', 'Bloqueado, cita I-01', `${r.result}: ${r.msg}`, r.result === 'bloqueado' && r.rules.includes('I-01')); }, 'A1', 'I-01');

  T(() => { const s = sim();
    s.dispatch({ t: 'switch', id: '52-AL1', op: 'open', via: 'remote' }); s.advance(500); s.dispatch({ t: 'lr', id: '43-AL1', to: 'local' });
    s.dispatch({ t: 'rack', id: '52-AL1', to: 'teste' }); s.advance(3500); s.dispatch({ t: 'rack', id: '52-AL1', to: 'extraido' }); s.advance(3500);
    const r = s.dispatch({ t: 'switch', id: '89T-AL1', op: 'close', via: 'local' });
    add('A2', 'Fechar 89T-AL1 sem constatar ausência de tensão', 'Bloqueado, cita I-02', `${r.result}: ${r.msg}`, r.result === 'bloqueado' && r.rules.includes('I-02')); }, 'A2', 'I-02');

  T(() => { const s = sim(), I = s.der.I;
    const ok = near(I['52-T1M'], 455, 0.01) && near(I['52-T1'], 45.5, 0.01) && near(I['52-T2M'], 409, 0.01);
    add('A3', 'Operação normal', 'I_T1(MT)=455 A; I_T1(AT)=45,5 A; I_T2(MT)=409 A (±1 %)', `${f(I['52-T1M'])} A; ${f(I['52-T1'], 2)} A; ${f(I['52-T2M'])} A`, ok); }, 'A3', 'regime');

  T(() => { const s = sim(); s.dispatch({ t: 'oltc', id: 'T1', modo: 'manual' }); s.dispatch({ t: 'tap', id: 'T1', dir: 1 }); s.dispatch({ t: 'tap', id: 'T1', dir: 1 });
    const r = s.dispatch({ t: 'switch', id: '52-P', op: 'close', via: 'remote' });
    add('A4', 'Fechar 52-P com ΔTAP > 1', 'Bloqueado (I-05, I-12)', `${r.result}: ${r.msg}`, r.result === 'bloqueado' && r.rules.includes('I-05')); }, 'A4', 'I-05');

  T(() => { const s = sim(); const r1 = s.dispatch({ t: 'switch', id: '52-P', op: 'close', via: 'remote' }); s.advance(500);
    const r2 = s.dispatch({ t: 'switch', id: '52-T1M', op: 'open', via: 'remote' }); s.advance(500);
    const I = s.der.I['52-T2M'], pct = s.der.tr.T2.pct;
    add('A5', 'T1 fora, 52-P fechado', 'I_T2 = 864 A (±2 %), 83 %', `${f(I)} A, ${f(pct)} % (${r1.result}/${r2.result})`, near(I, 864, 0.02) && near(pct, 83, 0.02)); }, 'A5', 'paralelo');

  T(() => { const a = sim(); a.dispatch({ t: 'inject', falha: 'F04', alvo: 'MT-1' }, 'instrutor'); const k1 = a.der.faltas[0]?.kA || 0;
    const b = sim(); b.dispatch({ t: 'switch', id: '52-P', op: 'close', via: 'remote' }); b.advance(300); b.dispatch({ t: 'inject', falha: 'F04', alvo: 'MT-1' }, 'instrutor'); const k2 = b.der.faltas[0]?.kA || 0;
    add('A6', 'Falta 3φ franca na MT-1', '10,1 kA (1 trafo); 18,0 kA (52-P fechado) ±5 %', `${f(k1, 2)} kA; ${f(k2, 2)} kA`, near(k1, 10.1, 0.05) && near(k2, 18.0, 0.05)); }, 'A6', 'curto');

  T(() => { const d = mk(); const c = d.protections.curvas.NI; const tf = curveTime(c, 0.15, 2000, 450);
    const s = new Sim(d, 7); const kA = s.icc('AL1c', '3f'); const t0 = s.s.t;
    s.dispatch({ t: 'inject', prim: { t: 'falta', tipo: '3f', permanente: true }, alvo: 'AL1', sev: 2.0 / kA }, 'instrutor'); const Im = s.der.I['52-AL1'];
    s.advance(1500); const e = s.log.find((x) => x.kind === 'prot' && x.rele === 'REL-AL1' && x.el === '51'); const tm = e ? (e.t - t0) / 1000 : NaN;
    add('A7', '51 de AL1: I = 2,0 kA, Is = 450 A, NI, TMS 0,15', 'Trip em 0,69 s (±5 %)', `fórmula ${f(tf, 3)} s; simulado ${f(tm, 3)} s (I medida ${f(Im, 0)} A)`, near(tf, 0.69, 0.05) && near(tm, 0.69, 0.05)); }, 'A7', 'curva');

  T(() => { const s = sim(); s.dispatch({ t: 'inject', falha: 'F05', alvo: '52-AL1' }, 'instrutor'); const t0 = s.s.t;
    s.dispatch({ t: 'inject', prim: { t: 'falta', tipo: '3f', permanente: true }, alvo: 'AL1' }, 'instrutor'); s.advance(1000);
    const e = s.log.find((x) => x.kind === 'ev' && x.eq === '52-T1M' && x.estado === 'open'); const dt = e ? e.t - t0 : NaN;
    const ab = s.d.params.disjuntor.mt.aberturaMs;
    add('A9', 'C2: falha de abertura do 52-AL1', `86BF abre 52-T1M em ≈ 150 ms + ${ab} ms; MT-1 sem tensão`, `52-T1M aberto em ${f(dt, 0)} ms; MT-1 ${s.der.barras['MT-1'].energ ? 'energizada' : 'sem tensão'}; 86BF-MT1 ${s.s.locks['86BF-MT1'] ? 'atuado' : 'não atuado'}`,
      near(dt, 150 + ab, 0.02) && !s.der.barras['MT-1'].energ && s.s.locks['86BF-MT1']); }, 'A9', '50BF');

  T(() => { const s = sim(); s.dispatch({ t: 'inject', falha: 'F12', alvo: 'CC', nivel: 70 }, 'instrutor'); s.advance(200);
    const r = s.dispatch({ t: 'switch', id: '52-AL1', op: 'open', via: 'remote' });
    s.dispatch({ t: 'inject', prim: { t: 'falta', tipo: '3f', permanente: true }, alvo: 'AL1' }, 'instrutor'); s.advance(1000);
    const aberto = ['52-AL1', '52-T1M', '52-T1'].filter((x) => s.s.eq[x].state === 'open');
    add('A10', 'CC < 80 V', 'Nenhum disjuntor atua por comando ou proteção; sinalização CC apaga', `comando: ${r.result} (${r.rules.join(',')}); disjuntores abertos: ${aberto.length ? aberto.join(',') : 'nenhum'}; CC ${s.ccOk() ? 'presente' : 'ausente (sinalização apagada)'}`,
      r.result === 'bloqueado' && r.rules.includes('I-07') && aberto.length === 0 && !s.ccOk()); }, 'A10', 'CC');

  T(() => { const s = sim(); s.dispatch({ t: 'switch', id: '52-T1M', op: 'open', via: 'remote' }); s.dispatch({ t: 'switch', id: '52-T1', op: 'open', via: 'remote' }); s.advance(6000);
    s.dispatch({ t: 'switch', id: '52-T1', op: 'close', via: 'remote' }); s.advance(1000);
    const e = s.log.find((x) => x.inrush); const c = s.d.protections.trafo['87T']; const ctl = eval87T(c, { idiffPu: 7, ibiasPu: 3.5, h2Pct: 0, h5Pct: 0 });
    add('A11', 'Energização de T1 com inrush', '87T não atua (inrush 6–8×In, 2ª harm. ≥ 20 %)', e ? `${f(e.inrush.pk)}×In, ${f(e.inrush.h2, 0)} % → ${e.inrush.opera ? 'ATUOU' : 'não atuou'}; 52-T1 ${s.s.eq['52-T1'].state === 'closed' ? 'fechado' : 'aberto'}; controle sem harmônica: ${ctl.opera ? 'atua' : 'não atua'}` : 'sem inrush',
      !!e && !e.inrush.opera && e.inrush.pk >= 6 && e.inrush.pk <= 8 && e.inrush.h2 >= 20 && s.s.eq['52-T1'].state === 'closed' && ctl.opera); }, 'A11', 'inrush');

  const missao = (id: string, perfil: string, ordem?: string) => { const d = mk(); const s = new Sim(d, 7); const sc = new Scenario(s, d, id, perfil, 'autonomo'); sc.start(); runGolden(sc, sc.goldenSteps(ordem ? d.profiles[ordem] : undefined)); return sc; };
  T(() => { const a = missao('M1', 'nr10_vigente'); const sa = a.score();
    const b = missao('M1', 'nr10_vigente', 'nr10_2026'); const sb = b.score();
    add('A8', 'M1 na ordem do perfil vigente', 'Nota ≥ 90 %; trocar impedimento e constatação = erro crítico',
      `ordem correta: ${f(sa.final)} % (${sa.status}, ${a.st.erros.length} erros); trocada: ${sb.status}, críticos: ${b.st.erros.filter((e: any) => e.sev === 'critico').map((e: any) => e.msg).join(' | ')}`,
      sa.final >= 90 && sa.criticos === 0 && a.st.fim != null && sb.criticos > 0); }, 'A8', 'M1');

  T(() => { const s = sim(); s.dispatch({ t: 'switch', id: '89-T1-1', op: 'open', via: 'remote' }); s.dispatch({ t: 'switch', id: '52-AL1', op: 'open', via: 'remote' }); s.advance(200);
    const sc = missao('C2', 'nr10_vigente'); const all = [...s.log, ...sc.sim.log];
    const bad = all.filter((e) => !e.hora || !e.actor || !e.msg || (e.kind === 'cmd' && (!e.cmd || !e.result || !Array.isArray(e.rules))) || (e.result === 'bloqueado' && !e.rules?.length));
    add('A12', 'Log de qualquer sessão', 'Cada ação com horário, ator, comando, resultado e regra violada', `${all.length} entradas; ${bad.length} incompletas`, bad.length === 0); }, 'A12', 'log');

  T(() => { const a = missao('M1', 'nr10_2026'); const sa = a.score();
    const b = missao('M1', 'nr10_2026', 'nr10_vigente'); const eb = b.st.erros.filter((e: any) => e.regra?.startsWith('ordem'));
    add('A13', 'Trocar para o perfil nr10_2026', 'A ordem exigida muda sem alterar código',
      `golden na ordem 2026: ${f(sa.final)} % (${sa.status}); ordem vigente sob perfil 2026: ${eb.map((e: any) => e.msg).join(' | ') || 'sem erro'}`, sa.final >= 90 && sa.criticos === 0 && eb.length > 0); }, 'A13', 'perfil');

  // Sequências golden das demais missões do MVP (não são critérios do anexo, mas validam os dados)
  for (const id of ['C2', 'E1', 'R2', 'C1', 'M2']) T(() => { const sc = missao(id, 'nr10_vigente'); const s = sc.score();
    add('G-' + id, `Golden ${id}`, 'Missão concluída, sem erro crítico, nota ≥ 90 %', `${f(s.final)} % (${s.status}); erros: ${sc.st.erros.map((e: any) => e.msg).join(' | ') || 'nenhum'}`, sc.st.fim != null && s.criticos === 0 && s.final >= 90); }, 'G-' + id, id);
  T(() => { const d = mk(); const s = new Sim(d, 7); const sc = new Scenario(s, d, 'R1', 'nr10_vigente', 'autonomo'); sc.start();
    runGolden(sc, [{ wait: 5 }, ...sc.st.plantadas.map((p: string) => ({ relato: p })), { acao: 'relatorio' }]); const r = sc.score();
    add('G-R1', 'Golden R1 (anomalias por semente)', '5 anomalias plantadas e detectadas; nota ≥ 90 %', `plantadas: ${sc.st.plantadas.join(', ')}; ${f(r.final)} % (${r.status})`, sc.st.plantadas.length === 5 && r.final >= 90 && sc.st.fim != null); }, 'G-R1', 'R1');
  T(() => { const sc = missao('M2', 'nr10_2026', 'nr10_2026'); const s = sc.score();
    add('G-M2-2026', 'Golden M2 no perfil nr10_2026', 'Mesma missão na ordem do perfil 2026, sem erro crítico', `${f(s.final)} % (${s.status}); erros: ${sc.st.erros.map((e: any) => e.msg).join(' | ') || 'nenhum'}`, sc.st.fim != null && s.criticos === 0 && s.final >= 90); }, 'G-M2-2026', 'M2');
  return out.sort((a, b) => (a.id.startsWith('A') && b.id.startsWith('A') ? +a.id.slice(1) - +b.id.slice(1) : a.id.startsWith('A') ? -1 : 1));
}
