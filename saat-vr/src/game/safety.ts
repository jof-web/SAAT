// Consequências físicas: zona de risco/controlada (NR-10 Anexo II), tensão de passo, arco elétrico com lesão
// conforme o EPI, e o resgate (vítima, avaliação, RCP com ritmo, DEA). Tudo é registrado na sessão (replay).
import { Vector3, Mesh, MeshStandardMaterial, CylinderGeometry, Group } from 'three';
import { h, fmt } from '../ui/dom';
import { ic } from './icons';
import { inter, type MCtx } from './common';
import type { GameApp } from './interact';

export interface Accident { tipo: 'choque' | 'arco' | 'passo' | 'quimico' | 'contato'; causa: string; lesao: string; regra: string; evitar: string; onde: Vector3 }

export class Safety {
  private zoneT = 0; private warned = new Set<string>(); dead = false; acc: Accident | null = null; private card = h('div', { class: 'acc hidden' });
  vitima: { g: Group; fonte: string; p: Vector3; estado: { consciencia: boolean; resp: boolean; rcp: number; dea: boolean; viva: boolean } } | null = null;
  caido: { a: Vector3; b: Vector3; node: string; g: Group } | null = null;
  private cpr = h('div', { class: 'cpr hidden' });
  constructor(private A: GameApp & { restart(): void; home(): void; startRescue(kind: string, p: Vector3): void; finalizar(): void }) { document.body.append(this.card, this.cpr); }
  reset() { this.dead = false; this.acc = null; this.card.classList.add('hidden'); this.cpr.classList.add('hidden'); this.warned.clear(); this.removeScene(); }
  private rr(nivel: string) { const kv = nivel === 'AT' ? 138 : nivel === 'MT' ? 13.8 : 0.38; const f = this.A.d.kb.nr10Zonas.faixas.find((x: any) => kv >= x.de && kv < x.ate); return { rr: f?.rr ?? 0.2, rc: f?.rc ?? 0.7 }; }
  private body() { const P = this.A.P, head = P.headPos(), dir = P.dir(); const hand = head.clone().add(dir.clone().multiplyScalar(0.55)).add(new Vector3(0, -0.25, 0)); return { head, hand, feet: new Vector3(P.pos.x, 0.1, P.pos.z) }; }
  /** Laço: zonas de risco, tensão de passo, contato com vítima. */
  update(dt: number) {
    const A = this.A, s = A.sess; if (!s || this.dead || A.P.view) { A.hud.setZone(0); return; } const der = s.sim.der; const b = this.body(); let zone = 0;
    for (const hz of A.W.hazards) {
      if (!der.energ[hz.node]) continue; if (hz.kind === 'cabo') { const bay = Object.keys(A.W.indoor.cub).find((k) => Math.abs(A.W.indoor.cub[k].x - (hz.p.x + 0.22 * 0)) < 0.45); if (!bay || !A.rearOpen[bay]) continue; }
      const { rr, rc } = this.rr(hz.nivel); const d = Math.min(b.head.distanceTo(hz.p), b.hand.distanceTo(hz.p));
      if (d < rr) { this.accident({ tipo: 'choque', causa: `Entrou na zona de risco (${fmt(rr, 2)} m) de parte energizada ${hz.nivel === 'MT' ? '13,8 kV (cabo do cubículo)' : '138 kV'}`, lesao: 'Choque elétrico: parada cardiorrespiratória e queimaduras de entrada/saída', regra: 'NR-10 10.2.8 e Anexo II — zona de risco só com técnicas de trabalho energizado', evitar: 'Desenergizar e aterrar antes (10.5.1) ou manter-se fora de Rr. Tampa traseira só com a chave de terra fechada.', onde: hz.p.clone() }); return; }
      if (d < rc) zone = Math.max(zone, 1 - (d - rr) / (rc - rr));
    }
    if (zone > 0.05 && !this.warned.has('rc')) { this.warned.add('rc'); s.erroJogo('maior', 'seguranca', 'Entrou na zona controlada de parte energizada exposta', 'zona_controlada'); A.hud.toast('Zona controlada de parte ENERGIZADA: afaste-se.', 'bad', 4000); }
    // tensão de passo (condutor caído)
    if (this.caido && der.energ[this.caido.node]) { const dd = distSeg(b.feet, this.caido.a, this.caido.b), juntos = A.P.crouch > 0.6;
      if (dd < 10) zone = Math.max(zone, 0.35 + (1 - dd / 10) * 0.65);
      if (dd < 10 && !this.warned.has('passo')) { this.warned.add('passo'); s.erroJogo('maior', 'seguranca', 'Entrou no raio de 10 m do condutor caído com a linha energizada', 'passo10'); A.hud.toast('Formigamento nos pés: tensão de passo! Saia com passos curtos, pés juntos (segure C).', 'bad', 6000); }
      if ((dd < 6 && !juntos && A.P.moving > 0.3) || dd < 1.5) { this.accident({ tipo: 'passo', causa: `Caminhou a ${fmt(dd, 1)} m do condutor caído energizado (tensão de passo)`, lesao: 'Choque pelas pernas: queda, queimaduras nos pés e risco de parada cardíaca', regra: 'NR-10 10.2.8 / Plano de emergência — distância mínima de 10 m de condutor caído', evitar: 'Não se aproximar. Isolar a área, pedir o desligamento ao COS, aguardar confirmação, constatar e aterrar.', onde: b.feet.clone() }); return; } }
    if (this.caido) { const sp = (this.caido.g as any).sparks as Group; const on = !!der.energ[this.caido.node]; sp.visible = on && Math.random() < 0.35; if (on && Math.random() < 0.04) A.audio?.click?.(); }
    // vítima energizada
    const v = this.vitima; if (v) { const dv = b.feet.distanceTo(new Vector3(v.p.x, 0.1, v.p.z)); const viva = !!der.energ[v.fonte];
      if (dv < 0.95) { if (viva) { const vara = A.tool === 'vara_manobra' && s.inv.tem('luva_isolante'); if (!vara) { this.accident({ tipo: 'contato', causa: 'Tocou na vítima ainda energizada', lesao: 'Você também recebeu o choque: duas vítimas', regra: 'NR-10 10.12.2 — primeiro isolar a fonte; nunca tocar vítima energizada', evitar: 'Abrir o disjuntor que alimenta (52-AL3) ou afastar a vítima com vara isolante, com luvas isolantes.', onde: v.p.clone() }); return; } }
        else if (!s.sc?.st.flags['resgate:alcancou']) s.marcar('resgate:alcancou', 'Chegou até a vítima com a fonte isolada'); } }
    A.hud.setZone(zone); A.audio?.zone(zone);
  }
  /** Arco elétrico disparado pelo sim (ARCO). A lesão depende da distância e do EPI. */
  onArc(id: string) {
    const A = this.A, s = A.sess; if (!s || this.dead) return; let p: Vector3 | null = null, nivel: 'MT' | 'AT' = 'MT';
    const bay = id.replace(/^52-/, '').replace(/^ATERR:/, ''); const cu = A.W.indoor.cub[bay] || (id.startsWith('ATERR:T1') ? A.W.indoor.cub.T1M : id.startsWith('ATERR:T2') ? A.W.indoor.cub.T2M : null);
    if (cu) p = new Vector3(cu.x, 1.2, cu.zf); else { const r = A.W.yard.cbr[id] || A.W.yard.dis[id]; if (r) { p = new Vector3(r.cx, 4.5, r.cz); nivel = 'AT'; } }
    if (!p) return; const nomeArc = id.startsWith('ATERR:') ? `no aterramento temporário (${id.slice(6)})` : `em ${id}`; const d = A.P.headPos().distanceTo(p); A.audio?.arc(Math.max(0.2, 1 - d / 30));
    if (d > (nivel === 'MT' ? 3.5 : 8)) { A.hud.flash('#e9f6ff', 500); A.P.shake = 0.6; A.hud.toast(`Arco elétrico ${nomeArc}! Você estava a ${fmt(d, 1)} m.`, 'bad', 5000); return; }
    const inv = s.inv, falta = ['vestimenta', 'protetor_facial', 'balaclava', 'luva_isolante'].filter((i) => !inv.tem(i));
    const lesao = !falta.length ? 'Sem lesão: a vestimenta e o protetor facial (ATPV) seguraram a energia incidente. Mesmo assim é falha grave de procedimento.' : falta.includes('protetor_facial') && falta.includes('vestimenta') ? 'Queimaduras de 2º e 3º grau no rosto, braços e tronco' : falta.includes('protetor_facial') ? 'Queimaduras de 2º grau no rosto e lesão ocular' : falta.includes('vestimenta') ? 'Queimaduras de 2º grau nos braços e tronco' : 'Queimaduras nas mãos e pescoço';
    if (!falta.length) { A.hud.flash('#e9f6ff', 700); A.P.shake = 1; s.marcar('arco_protegido', 'Arco elétrico com EPI completo: sem lesão'); A.hud.toast('Arco elétrico! O EPI contra arco protegeu você. O erro de procedimento foi registrado.', 'bad', 7000); return; }
    this.accident({ tipo: 'arco', causa: `Arco elétrico ${nomeArc} com você a ${fmt(d, 1)} m`, lesao: lesao + ` (sem: ${falta.map((i) => inv.nome(i)).join(', ')})`, regra: 'NR-10 10.2.9.2 e NR-6 — vestimenta e protetor facial com ATPV adequado à energia incidente', evitar: 'Operar pelo supervisório (fora da zona de arco), não extrair sob carga e usar o EPI completo contra arco.', onde: p });
  }
  accident(a: Accident) {
    const A = this.A, s = A.sess; if (this.dead) return; this.dead = true; this.acc = a; s.acidente(a.tipo, a.causa, a.lesao);
    A.audio?.accident(a.tipo); A.hud.flash(a.tipo === 'arco' ? '#fff3d6' : '#eaf6ff', 900); A.P.shake = 2.2; A.P.enabled = false; A.tablet.hide(); A.P.unlock();
    const t0 = performance.now(); const fall = () => { const k = Math.min(1, (performance.now() - t0) / 1200); A.P.fall = k * k; A.P.roll = k * 0.9; if (k < 1) requestAnimationFrame(fall); }; requestAnimationFrame(fall);
    setTimeout(() => A.hud.fade(true, 1400), 900);
    setTimeout(() => this.showCard(a), 2300);
  }
  private showCard(a: Accident) {
    const A = this.A, c = this.card; c.innerHTML = ''; c.classList.remove('hidden');
    const titulo = { choque: 'Choque elétrico', arco: 'Arco elétrico', passo: 'Tensão de passo', quimico: 'Acidente químico', contato: 'Segunda vítima' }[a.tipo];
    c.append(h('div', { class: 'acc-box' }, h('small', {}, 'ACIDENTE — FALHA CRÍTICA'), h('h2', {}, titulo),
      h('dl', {}, h('dt', {}, 'O que aconteceu'), h('dd', {}, a.causa), h('dt', {}, 'Consequência'), h('dd', {}, a.lesao), h('dt', {}, 'Regra'), h('dd', {}, a.regra), h('dt', {}, 'Como evitar'), h('dd', {}, a.evitar)),
      h('div', { class: 'row' }, a.tipo !== 'arco' || true ? h('button', { class: 'hw primary', onclick: () => { c.classList.add('hidden'); A.startRescue(a.tipo === 'passo' ? 'S2' : 'S1', a.onde); } }, ic('HeartPulse', 16), ' Treinar o resgate desta situação') : null,
        h('button', { class: 'hw', onclick: () => { c.classList.add('hidden'); A.finalizar(); } }, ic('FileText', 16), ' Ver relatório'),
        h('button', { class: 'hw', onclick: () => { c.classList.add('hidden'); A.restart(); } }, ic('RotateCcw', 16), ' Tentar de novo'),
        h('button', { class: 'hw ghost', onclick: () => { c.classList.add('hidden'); A.home(); } }, 'Menu inicial'))));
  }
  // ---------- cenas de resgate ----------
  removeScene() { if (this.vitima) { this.vitima.g.parent?.remove(this.vitima.g); this.vitima = null; } if (this.caido) { this.caido.g.parent?.remove(this.caido.g); this.caido = null; } const W = this.A.W; W.inter = W.inter.filter((i: any) => i.kind !== 'vitima' && i.kind !== 'caido'); W.parts = W.parts.filter((p: any) => p.inter !== 'caido'); }
  /** Monta a cena da missão (vítima, tampa aberta, condutor caído). */
  setupScene(m: any) {
    this.removeScene(); const cena = m?.cena; if (!cena) return; const A = this.A, W = A.W;
    if (cena.tampa) { A.rearOpen[cena.tampa] = true; W.indoor.cub[cena.tampa].rearT = 1; }
    if (cena.caido) { const ltX = A.d.plant.lt.ancoragemX.map((x: number) => W.P(x, 0)[0]), [, gz] = W.P(0, A.d.plant.portico.y); const x = ltX[cena.caido.fase ?? 1];
      const a = new Vector3(x, 0.05, gz + 2.0), b = new Vector3(x + 3.5, 0.05, gz + 6.5); const g = new Group(); const len = a.distanceTo(b);
      const m2 = new Mesh(new CylinderGeometry(0.022, 0.022, len, 8), W.M.conductor); m2.position.copy(a).lerp(b, 0.5); m2.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize()); g.add(m2);
      const up = new Mesh(new CylinderGeometry(0.022, 0.022, 7.5, 8), W.M.conductor); up.position.set(x, 3.8, gz + 1.0); up.rotation.x = 0.28; g.add(up); W.zones.patio.add(g);
      const sp = new Group(); sp.position.copy(b); g.add(sp); for (let k = 0; k < 7; k++) { const s2 = new Mesh(new CylinderGeometry(0.004, 0.004, 0.12, 4), new MeshStandardMaterial({ color: 0xcfeaff, emissive: 0xbfe6ff, emissiveIntensity: 6 })); s2.position.set((Math.random() - 0.5) * 0.3, 0.06, (Math.random() - 0.5) * 0.3); s2.rotation.set(Math.random() * 3, Math.random() * 3, 0); sp.add(s2); } (g as any).sparks = sp;
      this.caido = { a, b, node: cena.fonte || 'LINE', g };
      const c: MCtx = { b: null as any, M: W.M, root: W.zones, col: W.col, inter: W.inter, parts: W.parts, zone: 'patio' };
      inter(c, { id: 'caido', kind: 'caido', label: 'Condutor rompido no solo (LT-01)', verb: 'Inspecionar', box: [3, 1, 3], at: [(a.x + b.x) / 2, 0.5, (a.z + b.z) / 2], range: 14, view: { pos: new Vector3(b.x + 5, 2.0, b.z + 8), look: a.clone().lerp(b, 0.5) } });
      W.parts.push({ inter: 'caido', id: 'vt', label: 'Constatar ausência de tensão no condutor (detector 145 kV com vara)', act: 'vtest:LINE', hit: (W.inter[W.inter.length - 1] as any).hit, vis: [m2], tool: 'detector_at' } as any); }
    if (cena.vitima) { let p: Vector3; let rot = 0.4;
      if (cena.vitima.cubiculo) { const cu = W.indoor.cub[cena.vitima.cubiculo]; p = new Vector3(cu.x + 0.15, 0, cu.zc - 0.8 - 1.05); rot = 1.2; }
      else { const cd = this.caido!; p = cd.b.clone().add(new Vector3(-1.5, 0, cena.vitima.dist ?? 4.5)); }
      const g = W.placeVictim(p.x, p.z, rot); this.vitima = { g, fonte: cena.fonte, p, estado: { consciencia: false, resp: false, rcp: 0, dea: false, viva: true } };
      const c: MCtx = { b: null as any, M: W.M, root: W.zones, col: W.col, inter: W.inter, parts: W.parts, zone: W.areaAt(p.x, p.z) === 'patio' ? 'patio' : 'casa' };
      inter(c, { id: 'vitima', kind: 'vitima', label: 'Vítima (colega caído)', verb: 'Atender', box: [1.9, 0.6, 1.0], at: [p.x, 0.3, p.z], range: 2.2 }); }
  }
  /** Cartão de atendimento à vítima (E sobre a vítima). */
  rescueCard() {
    const A = this.A, s = A.sess, v = this.vitima; if (!v || !s) return; if (s.sim.der.energ[v.fonte]) { A.hud.toast('A fonte ainda está ENERGIZADA. Não toque: isole primeiro.', 'bad', 5000); return; }
    if (!s.sc?.st.flags['resgate:alcancou']) s.marcar('resgate:alcancou', 'Chegou até a vítima com a fonte isolada');
    const A2 = A as any; A2.P.unlock(); A2.P.goView(new Vector3(v.p.x + 0.6, 1.0, v.p.z + 0.7), new Vector3(v.p.x, 0.2, v.p.z), 0.6);
    const c = this.cpr; c.innerHTML = ''; c.classList.remove('hidden'); const out = h('p', { class: 'cpr-out' });
    const close = () => { c.classList.add('hidden'); A2.P.leaveView(0.4); setTimeout(() => A2.P.lock(), 60); };
    const step = (t: string, f: () => void) => h('button', { class: 'hw', onclick: f }, t);
    c.append(h('div', { class: 'cpr-box' }, h('header', {}, h('b', {}, 'Atendimento à vítima'), h('button', { class: 'icard-x', onclick: close }, ic('X', 18))),
      h('p', { class: 'muted' }, 'Fonte isolada. Siga o protocolo: consciência → socorro → respiração → RCP → DEA.'),
      h('div', { class: 'row' }, step('Chamar e tocar os ombros', () => { v.estado.consciencia = true; s.marcar('resgate:consciencia', 'Verificou consciência: vítima não responde'); out.textContent = 'Não responde ao chamado nem ao toque. Peça socorro (rádio: 192/193) e o DEA.'; }),
        step('Ver respiração (10 s)', () => { if (!v.estado.consciencia) { out.textContent = 'Primeiro verifique a consciência.'; return; } out.textContent = 'Observando o tórax… (10 s)'; setTimeout(() => { v.estado.resp = true; s.marcar('resgate:respiracao', 'Verificou respiração: ausente/agônica → PCR'); if (!out.querySelector('.cpr-game, .dea-voz')) out.textContent = 'Sem respiração normal (agônica): parada cardiorrespiratória. Inicie a RCP.'; }, 2500); }),
        step('Iniciar RCP', () => { if (!v.estado.resp) { out.textContent = 'Verifique a respiração antes.'; return; } this.rcp(out); }),
        step('Usar o DEA', () => this.dea(out))), out));
  }
  private rcp(out: HTMLElement) {
    const A = this.A, s = A.sess; const box = h('div', { class: 'cpr-game' }); const bar = h('i'); const info = h('b', {}, 'Aperte ESPAÇO no ritmo: 100–120 por minuto (≈ 2 por segundo)'); const cnt = h('span');
    box.append(info, h('div', { class: 'cpr-meter' }, bar), cnt); out.innerHTML = ''; out.append(box);
    const ts: number[] = []; const metro = setInterval(() => A.audio?.tick(), 545);
    const onKey = (e: KeyboardEvent) => { if (e.code !== 'Space') return; e.preventDefault(); ts.push(e.timeStamp || performance.now()); A.audio?.thump(); const n = ts.length;
      if (n > 1) { const bpm = 60000 / (ts[n - 1] - ts[n - 2]); bar.style.width = Math.min(100, (bpm / 160) * 100) + '%'; bar.className = bpm >= 100 && bpm <= 120 ? 'ok' : bpm < 100 ? 'slow' : 'fast'; cnt.textContent = `${n}/30 · ${fmt(bpm, 0)}/min`; }
      if (n >= 30) { removeEventListener('keydown', onKey, true); clearInterval(metro); const ok = rcpQualidade(ts);
        const v = this.vitima!; v.estado.rcp++; if (ok >= 0.7) s.marcar('resgate:rcp_ok', `RCP: 30 compressões, ${fmt(ok * 100, 0)} % no ritmo`); else s.sim.lg('ev', 'treinando', `RCP fora do ritmo: só ${fmt(ok * 100, 0)} % entre 100 e 120/min`);
        out.innerHTML = ''; out.append(h('p', {}, `30 compressões: ${fmt(ok * 100, 0)} % no ritmo certo. ${ok >= 0.7 ? 'Boa RCP.' : 'Ritmo irregular — repita.'} Faça 2 ventilações (se treinado) e continue até o DEA chegar.`)); } };
    addEventListener('keydown', onKey, true);
  }
  private dea(out: HTMLElement) {
    const A = this.A, s = A.sess, v = this.vitima!; if (A.tool !== 'dea') { out.textContent = A.deaTaken ? 'Pegue o DEA na mão (1–9).' : 'Busque o DEA (caixa verde ao lado da porta norte da casa de comando).'; return; }
    out.innerHTML = ''; const msg = h('p', { class: 'dea-voz' }, 'DEA: "Aplique as pás no tórax nu do paciente."');
    out.append(msg, h('div', { class: 'row' }, h('button', { class: 'hw', onclick: () => { msg.textContent = 'DEA: "Analisando o ritmo. Não toque no paciente."'; setTimeout(() => { msg.textContent = 'DEA: "Choque indicado. Afaste-se! Pressione o botão laranja."'; }, 2200); } }, 'Aplicar as pás'),
      h('button', { class: 'hw danger', onclick: () => { if (!/Choque indicado/.test(msg.textContent || '')) { msg.textContent = 'Aguarde a análise do DEA.'; return; } A.audio?.shockDea(); v.estado.dea = true; s.marcar('resgate:dea', 'DEA: choque aplicado; RCP retomada'); msg.textContent = 'DEA: "Choque aplicado. Reinicie a RCP imediatamente."'; } }, 'CHOQUE')));
  }
}
/** Fração das compressões com ritmo entre 100 e 120/min (diretriz de RCP). */
export function rcpQualidade(ts: number[]) { if (ts.length < 2) return 0; const iv = ts.slice(1).map((t, i) => 60000 / (t - ts[i])); return iv.filter((b) => b >= 100 && b <= 120).length / iv.length; }
function distSeg(p: Vector3, a: Vector3, b: Vector3) { const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / ab.lengthSq())); return p.distanceTo(a.clone().add(ab.multiplyScalar(t))); }
export { MeshStandardMaterial };
