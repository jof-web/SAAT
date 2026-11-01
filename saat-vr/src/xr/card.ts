// Cartão de inspeção no VR (gatilho num equipamento): estado real do local, peças acionáveis como botões
// (mesma lógica do PC), itens do armário (inspecionar, vestir, devolver) e leitura de instrumentos.
import { Vector3, type Scene } from 'three';
import { Panel, UI } from './panel';

export interface CardHost { inter: any; W: any; sess(): any; refreshEpi(): void; toast(m: string, k?: string): void; cmd(c: any): any; tool(): string | null; safety: any; audio: any; rcpQualidade(ts: number[]): number; ctx(): any }
const NOME: Record<string, string> = { cub: 'Cubículo 13,8 kV', cubR: 'Cubículo · traseira', bay: 'Caixa de comando do vão', trafo: 'Painel local do transformador', trafoBody: 'Transformador de potência', eq: 'Equipamento 138 kV', mec: 'Mecanismo do disjuntor', secmot: 'Acionamento da seccionadora', terraAT: 'Chave de terra 138 kV', cc: 'Serviços auxiliares', prot: 'Proteção e controle', arm: 'Armário', leitura: 'Instrumento de campo', reserva: 'LT-02 (desligada)', info: 'Painel', vitima: 'Atendimento à vítima', caido: 'Condutor rompido', encontro: 'Ponto de encontro' };
const _v = new Vector3(), _f = new Vector3();

/** Procedimentos e decisões da missão num local (mesmo conteúdo do cartão do PC). Decisão pede confirmação. */
export function drawProcs(p: Panel, x: number, y: number, w: number, loc: string, st: { page: number; ask: ((ops: [string, () => void][]) => void) }, ctx: any, per = 6) {
  const sc = ctx?.sc; if (!sc || !loc) return y; const { acoes, decisoes } = sc.acoesPara(loc); const L: { t: 'a' | 'd'; x: any }[] = [...acoes.map((a: any) => ({ t: 'a' as const, x: a })), ...decisoes.map((d: any) => ({ t: 'd' as const, x: d }))];
  if (!L.length) { p.text('Nenhum procedimento da missão neste local.', x, y + 24, { size: 22, color: UI.dim }); return y + 56; }
  const pages = Math.ceil(L.length / per); st.page = Math.min(st.page, pages - 1);
  for (const it of L.slice(st.page * per, st.page * per + per)) {
    if (it.t === 'a') { const a = it.x, done = ctx.tem(a.set || a.id); p.button('ac' + a.id, x, y, w, 62, (done ? 'Feito · ' : '') + a.label, () => ctx.acao(a.id), { size: 23, align: 'left', active: done, color: UI.ok }); y += 70; }
    else { const d = it.x, feita = d.opcoes.find((o: any) => ctx.tem(`decisao:${d.id}:${o.id}`)); p.button('dc' + d.id, x, y, w, 62, `Decisão: ${d.titulo}${feita ? ' → ' + feita.texto : ''}`, () => st.ask(d.opcoes.map((o: any) => [o.texto, () => ctx.decidir(d.id, o.id)] as [string, () => void])), { size: 23, align: 'left', active: !!feita, color: UI.info }); y += 70; }
  }
  if (pages > 1) { p.button('pp-', x, y, 120, 56, '<', () => { st.page = Math.max(0, st.page - 1); }, { size: 30, disabled: st.page === 0 }); p.text(`${st.page + 1}/${pages}`, x + w / 2, y + 28, { size: 24, align: 'center', mono: true }); p.button('pp+', x + w - 120, y, 120, 56, '>', () => { st.page = Math.min(pages - 1, st.page + 1); }, { size: 30, disabled: st.page >= pages - 1 }); y += 66; }
  return y;
}

export class VRCard {
  panel = new Panel({ w: 0.62, h: 0.56, px: 1024 }); t: any = null; page = 0; tab: 'pecas' | 'proc' = 'pecas'; proc = { page: 0, ask: (ops: [string, () => void][]) => { this.ask = ops.map(([l, f]) => ['Confirmar: ' + l, f] as [string, () => void]); this.panel.dirty = true; } }; ask: [string, () => void][] | null = null; msg = ''; msgCor = UI.dim; private refreshT = 0;
  constructor(public H: CardHost, scene: Scene) { this.panel.render = (p) => this.draw(p); this.panel.mesh.visible = false; scene.add(this.panel.mesh); }
  get open() { return !!this.t; }
  show(t: any, head: Vector3, fwd: Vector3) {
    if (this.t && this.t !== t) this.close(); this.t = t; this.page = 0; this.proc.page = 0; this.ask = null; this.msg = ''; this.tab = t.kind === 'radio' ? 'proc' : 'pecas'; const W = this.H.W;
    if (t.kind === 'arm') { const cb = W.indoor.cabinets[t.eq]; if (cb) cb.tgt = 1; }
    if (t.kind === 'bay') { const cb = W.yard.cabs[t.eq]; if (cb) cb.tgt = 1; }
    _f.copy(fwd).setY(0).normalize(); const m = this.panel.mesh; m.position.copy(head).addScaledVector(_f, 0.62); m.position.y = head.y - 0.14; m.lookAt(head.x, head.y - 0.08, head.z); m.visible = true; this.panel.dirty = true;
  }
  close() { const t = this.t, W = this.H.W; if (!t) return; this.stopRcp(); if (t.kind === 'arm' && t.eq !== 'LOTO') { const cb = W.indoor.cabinets[t.eq]; if (cb) cb.tgt = 0; } if (t.kind === 'bay') { const cb = W.yard.cabs[t.eq]; if (cb) cb.tgt = 0; } this.t = null; this.panel.mesh.visible = false; this.panel.clearHover(); }
  update(dt: number, head: Vector3) {
    if (!this.t) return; this.t.hit.getWorldPosition(_v); if (Math.hypot(_v.x - head.x, _v.z - head.z) > 5.5) { this.close(); return; }
    this.refreshT += dt; if (this.refreshT > 0.5) { this.refreshT = 0; this.panel.dirty = true; } this.panel.update();
  }
  private say(m: string, ok?: boolean) { this.msg = m; this.msgCor = ok === undefined ? UI.dim : ok ? UI.ok : UI.bad; this.panel.dirty = true; }
  private draw(p: Panel) {
    const t = this.t; if (!t) return; const H = this.H, s = H.sess(); if (!s) return;
    p.rect(0, 0, p.W, 92, '#0d1012'); p.text(NOME[t.kind] || 'Local', 24, 28, { size: 24, color: UI.accent, weight: 700, max: 820 }); p.text(t.label, 24, 64, { size: 30, weight: 700, max: 870 });
    p.button('x', p.W - 84, 14, 68, 64, 'X', () => this.close(), { size: 30 });
    let y = 110;
    let L: [string, string, string?][] = []; try { L = H.inter.linhas(t) || []; } catch { L = []; }
    L.slice(0, 8).forEach(([k, v, c], i) => { const x = 24 + (i % 2) * 500, yy = y + Math.floor(i / 2) * 44; p.text(k, x, yy + 18, { size: 22, color: UI.dim, max: 200 }); p.text(v, x + 210, yy + 18, { size: 24, weight: 700, color: c === 'r' ? UI.bad : c === 'g' ? UI.ok : c === 'w' ? UI.warn : UI.text, max: 270 }); });
    y += Math.ceil(Math.min(8, L.length) / 2) * 44 + (L.length ? 14 : 0);
    if (this.ask) { p.text('Escolha:', 24, y + 20, { size: 26, color: UI.dim }); y += 44;
      this.ask.forEach(([lab, f], i) => p.button('ask' + i, 24, y + i * 76, 976, 66, lab, () => { this.ask = null; f(); }, { size: 26 }));
      p.button('askx', 24, y + this.ask.length * 76, 976, 60, 'Cancelar', () => { this.ask = null; }, { size: 24 }); return; }
    const loc = H.inter.localDe?.(t), ctx = H.ctx(), np = loc && ctx?.sc ? (() => { const r = ctx.sc.acoesPara(loc); return r.acoes.length + r.decisoes.length; })() : 0;
    if (t.kind === 'radio') { const rb = s.sc?.st.cos.find((o: any) => o.readbackReq && !o.readback); if (rb) { p.button('rb', 24, y, 976, 62, 'Read-back da última ordem do COS', () => { s.readback(rb.id); this.say(`Read-back ${rb.id} registrado.`, true); }, { size: 24, color: UI.accent, active: true }); y += 74; } y = drawProcs(p, 24, y, 976, 'radio', this.proc, ctx); }
    else if (np && t.kind !== 'arm' && t.kind !== 'vitima') { p.button('tbp', 24, y, 484, 56, 'Peças', () => { this.tab = 'pecas'; }, { size: 24, active: this.tab === 'pecas' }); p.button('tbr', 516, y, 484, 56, `Procedimentos (${np})`, () => { this.tab = 'proc'; }, { size: 24, active: this.tab === 'proc' }); y += 68; }
    if (t.kind === 'radio') { /* já desenhado */ }
    else if (this.tab === 'proc' && np && t.kind !== 'arm') y = drawProcs(p, 24, y, 976, loc, this.proc, ctx);
    else if (t.kind === 'leitura' && t.data?.ref) { const r = s.sim.leitura(t.data.ref);
      p.rect(24, y, 976, 120, '#0f1215'); p.text(r ? `${r.valor.toFixed(r.valor < 20 ? 2 : 0).replace('.', ',')} ${r.un}` : '—', 512, y + 60, { size: 64, align: 'center', mono: true, color: UI.info, weight: 700 }); y += 140;
      p.button('reg', 24, y, 976, 70, 'Registrar no caderno de ronda', () => { const rr = s.sim.leitura(t.data.ref); if (rr) { H.cmd({ t: 'anotacao', ref: t.data.ref, valor: +rr.valor.toFixed(2) }); this.say('Leitura registrada.', true); } }, { size: 26 }); y += 90; }
    else if (t.kind === 'vitima') y = this.drawVitima(p, y);
    else if (t.kind === 'arm') y = this.drawArm(p, t, y);
    else y = this.drawParts(p, t, y);
    if (this.msg) p.text(this.msg, 24, p.H - 30, { size: 22, color: this.msgCor, max: 976 });
  }
  // ---------- resgate (vítima): consciência → socorro → respiração → RCP pelas mãos → DEA ----------
  rcp: { ts: number[]; hi: number; lo: number; armed: boolean; metro: any } | null = null; private dea = ''; private deaT: any = null;
  private stopRcp() { if (this.rcp) { clearInterval(this.rcp.metro); this.rcp = null; } clearTimeout(this.deaT); this.dea = ''; }
  /** Chamado a cada quadro com a altura média das mãos e se algum gatilho foi apertado (alternativa). */
  rcpInput(y: number | null, trig: boolean) {
    const r = this.rcp; if (!r) return; let hit = trig;
    if (y !== null) { if (r.armed) { r.hi = Math.max(r.hi, y); if (y < r.hi - 0.035) { hit = true; r.armed = false; r.lo = y; } } else { r.lo = Math.min(r.lo, y); if (y > r.lo + 0.025) { r.armed = true; r.hi = y; } } }
    if (!hit) return; r.ts.push(performance.now()); this.H.audio?.thump?.(); this.panel.dirty = true;
    if (r.ts.length >= 30) { const s = this.H.sess(), v = this.H.safety?.vitima, ok = this.H.rcpQualidade(r.ts), pc = Math.round(ok * 100); clearInterval(r.metro); this.rcp = null; if (v) v.estado.rcp++;
      if (ok >= 0.7) s.marcar('resgate:rcp_ok', `RCP: 30 compressões, ${pc} % no ritmo`); else s.sim.lg('ev', 'treinando', `RCP fora do ritmo: só ${pc} % entre 100 e 120/min`);
      this.say(`30 compressões: ${pc} % no ritmo. ${ok >= 0.7 ? 'Boa RCP.' : 'Ritmo irregular — repita.'} Continue até o DEA chegar.`, ok >= 0.7); }
  }
  private drawVitima(p: Panel, y: number) {
    const H = this.H, s = H.sess(), v = H.safety?.vitima; if (!v) { p.text('Sem vítima nesta cena.', 24, y + 24, { size: 24, color: UI.dim }); return y + 60; }
    if (s.sim.der.energ[v.fonte]) { p.text('A fonte ainda está ENERGIZADA. Não toque: isole primeiro.', 24, y + 24, { size: 26, color: UI.bad, max: 976 }); return y + 60; }
    if (!s.sc?.st.flags['resgate:alcancou']) s.marcar('resgate:alcancou', 'Chegou até a vítima com a fonte isolada');
    if (this.rcp) { const r = this.rcp, n = r.ts.length, bpm = n > 1 ? 60000 / (r.ts[n - 1] - r.ts[n - 2]) : 0, ok = bpm >= 100 && bpm <= 120;
      p.text('RCP: mãos juntas, empurre para baixo e solte (5 cm), no ritmo do bipe. O gatilho também conta.', 24, y + 20, { size: 22, color: UI.dim, max: 976 });
      p.rect(24, y + 50, 976, 40, '#0f1215'); p.rect(24, y + 50, Math.min(976, (bpm / 160) * 976), 40, ok ? UI.ok : bpm < 100 ? UI.warn : UI.bad); p.text(`${n}/30 · ${Math.round(bpm)}/min`, 512, y + 70, { size: 26, align: 'center', mono: true, weight: 700 });
      p.button('rcpx', 24, y + 104, 976, 60, 'Parar a RCP', () => this.stopRcp(), { size: 24 }); return y + 180; }
    const st = v.estado, B = (id: string, yy: number, l: string, f: () => void, on = false) => p.button(id, 24, yy, 976, 64, l, f, { size: 25, align: 'left', active: on, color: UI.ok });
    B('vc', y, '1. Chamar e tocar os ombros', () => { st.consciencia = true; s.marcar('resgate:consciencia', 'Verificou consciência: vítima não responde'); this.say('Não responde. Peça socorro (rádio: 192/193) e o DEA.'); }, st.consciencia);
    B('vr', y + 74, '2. Ver respiração (10 s)', () => { if (!st.consciencia) { this.say('Primeiro verifique a consciência.', false); return; } this.say('Observando o tórax…'); setTimeout(() => { st.resp = true; s.marcar('resgate:respiracao', 'Verificou respiração: ausente/agônica → PCR'); this.say('Sem respiração normal: parada cardiorrespiratória. Inicie a RCP.'); }, 2500); }, st.resp);
    B('vp', y + 148, '3. Iniciar RCP (30 compressões)', () => { if (!st.resp) { this.say('Verifique a respiração antes.', false); return; } this.rcp = { ts: [], hi: -1, lo: 9, armed: true, metro: setInterval(() => H.audio?.tick?.(), 545) }; }, st.rcp > 0);
    const dl = this.dea === 'choque' ? 'CHOQUE (afaste-se)' : this.dea === 'analise' ? 'DEA analisando… não toque' : '4. Usar o DEA: aplicar as pás';
    p.button('vd', 24, y + 222, 976, 64, dl, () => {
      if (H.tool() !== 'dea') { this.say(H.inter.A?.deaTaken ? 'Pegue o DEA na mão.' : 'Busque o DEA (caixa verde ao lado da porta norte da casa de comando).', false); return; }
      if (this.dea === 'choque') { H.audio?.shockDea?.(); st.dea = true; s.marcar('resgate:dea', 'DEA: choque aplicado; RCP retomada'); this.dea = ''; this.say('DEA: choque aplicado. Reinicie a RCP imediatamente.', true); return; }
      if (this.dea) return; this.dea = 'analise'; this.say('DEA: analisando o ritmo. Não toque no paciente.'); this.deaT = setTimeout(() => { this.dea = 'choque'; this.say('DEA: choque indicado. Afaste-se e aperte CHOQUE.'); this.panel.dirty = true; }, 2200); },
      { size: 25, align: 'left', active: this.dea === 'choque' || st.dea, color: this.dea === 'choque' ? UI.bad : UI.ok, disabled: this.dea === 'analise' });
    return y + 300;
  }
  private drawParts(p: Panel, t: any, y: number) {
    const H = this.H, ps = (H.inter.partsOfInter(t) || []) as any[];
    if (!ps.length) { p.text(t.kind === 'eq' || t.kind === 'trafoBody' ? 'Aproxime-se: as peças (acionamento, mecanismo, painel) têm cartão próprio.' : 'Sem peças acionáveis aqui.', 24, y + 24, { size: 22, color: UI.dim, max: 976 }); return y + 60; }
    p.text('Aponte para a peça real ou toque aqui:', 24, y + 18, { size: 22, color: UI.dim }); y += 40;
    const per = 8, pages = Math.ceil(ps.length / per); this.page = Math.min(this.page, pages - 1);
    ps.slice(this.page * per, this.page * per + per).forEach((pt, i) => p.button('pt' + pt.id, 24 + (i % 2) * 492, y + Math.floor(i / 2) * 74, 484, 66, pt.label.replace(/\s*\(comando local\)/, ''), () => {
      const ok = H.inter.actVR(t, pt, (ops: [string, () => void][]) => { this.ask = ops; this.panel.dirty = true; }); if (!ok) this.say('Ação não executada (ver aviso).', false); }, { size: 22, align: 'left' }));
    y += Math.ceil(Math.min(per, ps.length - this.page * per) / 2) * 74 + 6;
    if (pages > 1) { p.button('pg-', 24, y, 120, 56, '<', () => { this.page = Math.max(0, this.page - 1); }, { size: 30, disabled: this.page === 0 }); p.text(`${this.page + 1}/${pages}`, 512, y + 28, { size: 24, align: 'center', mono: true }); p.button('pg+', 880, y, 120, 56, '>', () => { this.page = Math.min(pages - 1, this.page + 1); }, { size: 30, disabled: this.page >= pages - 1 }); y += 66; }
    return y;
  }
  private drawArm(p: Panel, t: any, y: number) {
    const H = this.H, s = H.sess(), inv = s.inv, W = H.W, locs = t.eq === 'EPI' ? ['EPI', 'FERR', 'EPIQ'] : [t.eq];
    const us = inv.units.filter((u: any) => locs.includes(inv.def(u.item).local) && !u.descartado), per = 5, pages = Math.max(1, Math.ceil(us.length / per)); this.page = Math.min(this.page, pages - 1);
    us.slice(this.page * per, this.page * per + per).forEach((u: any, i: number) => { const it = inv.def(u.item), yy = y + i * 70;
      p.text(`${it.nome}`, 24, yy + 20, { size: 22, weight: 700, max: 470, color: u.comigo ? UI.ok : UI.text }); p.text(`unid. ${u.n} · ${u.comigo ? 'com você' : 'no armário'}${u.inspecionado ? ' · inspecionado' + (u.defeito ? ' (DEFEITO)' : '') : ''}`, 24, yy + 46, { size: 18, color: u.defeito && u.inspecionado ? UI.bad : UI.dim, max: 470 });
      if (u.comigo) p.button('dv' + u.uid, 760, yy + 4, 240, 58, 'Devolver', () => { this.say(s.epi('devolver', u.uid).txt); const g = W.indoor.cabinets[t.eq]?.items[u.uid]; if (g) g.visible = true; H.refreshEpi(); }, { size: 22 });
      else { p.button('in' + u.uid, 506, yy + 4, 244, 58, 'Inspecionar', () => { const r = s.epi('inspecionar', u.uid); this.say(r.txt, r.ok); }, { size: 22 });
        p.button('vs' + u.uid, 760, yy + 4, 240, 58, it.cat?.startsWith('EPI') ? 'Vestir' : 'Pegar', () => { const r = s.epi('pegar', u.uid); this.say(r.txt, true); const g = W.indoor.cabinets[t.eq]?.items[u.uid]; if (g) g.visible = false; H.refreshEpi(); }, { size: 22, color: UI.accent }); } });
    y += Math.min(per, us.length) * 70 + 6;
    if (pages > 1) { p.button('pg-', 24, y, 120, 56, '<', () => { this.page = Math.max(0, this.page - 1); }, { size: 30, disabled: this.page === 0 }); p.text(`${this.page + 1}/${pages}`, 512, y + 28, { size: 24, align: 'center', mono: true }); p.button('pg+', 880, y, 120, 56, '>', () => { this.page = Math.min(pages - 1, this.page + 1); }, { size: 30, disabled: this.page >= pages - 1 }); y += 66; }
    return y;
  }
}
