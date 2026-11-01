// Tablet robusto (diegético): o DOM é desenhado por cima da tela do tablet 3D (homografia em hands.ts).
// Apps: Tarefa, APR/PT, Rádio, Assistente, Mapa, Fichas, Meu EPI, Leituras.
import { h, fmt, mmss } from '../ui/dom';
import { ic } from './icons';
import { osDoc, aprForm, ptBox, folha, roteiro } from '../ui/os';
import { missionBlock, type Ctx } from '../ui/panels';
import { fichaPanel } from '../ui/ficha';
import { armario } from '../ui/epiui';
import { descEq } from '../assist/search';

export interface TabletCtx {
  d: any; sess: () => any; ctx: () => Ctx; toast: (m: string, k?: any) => void; assistEl: HTMLElement; assistAsk: (q: string) => void;
  map: { svg: SVGSVGElement; update: (p: any) => void }; mapPos: () => any; livre: () => boolean; finish: () => void; refreshEpi: () => void; readback: (id: string) => void;
}
const APPS: [string, string, string][] = [['tarefa', 'Tarefa', 'ClipboardList'], ['apr', 'APR / PT', 'ClipboardCheck'], ['radio', 'Rádio', 'Radio'], ['assist', 'Assistente', 'MessageSquare'], ['mapa', 'Mapa', 'Map'], ['fichas', 'Fichas', 'BookOpen'], ['epi', 'Meu EPI', 'HardHat'], ['leituras', 'Leituras', 'Gauge']];

export class Tablet {
  W = 860; H = 538; el = h('div', { id: 'tablet', class: 'hidden', role: 'dialog', 'aria-label': 'Tablet' });
  private bar = h('div', { class: 'tb-bar' }); private body = h('div', { class: 'tb-body' }); private cur = 'home'; private ups: (() => void)[] = []; private badge: Record<string, HTMLElement> = {};
  open = false;
  constructor(private c: TabletCtx) { this.el.append(this.bar, this.body); document.body.append(this.el); this.home(); }
  show(app?: string) { this.open = true; this.el.classList.remove('hidden'); if (app) this.go(app); else if (this.cur === 'home') this.home(); }
  hide() { this.open = false; this.el.classList.add('hidden'); }
  setTransform(t: string) { this.el.style.transform = t; }
  private header(title: string) {
    this.bar.innerHTML = ''; const sess = this.c.sess();
    this.bar.append(this.cur !== 'home' ? h('button', { class: 'tb-back', onclick: () => this.home(), 'aria-label': 'Voltar' }, ic('ArrowLeft', 18)) : h('span', { class: 'tb-logo' }, 'SAAT'), h('b', {}, title),
      h('span', { class: 'tb-st' }, sess ? mmss(sess.sim.s.t) : '', ic('Signal', 14), ic('Battery', 16)));
  }
  home() {
    this.cur = 'home'; this.ups = []; this.header('Início'); this.body.innerHTML = ''; const sess = this.c.sess(), m = sess?.sc?.m;
    const grid = h('div', { class: 'tb-grid' });
    for (const [k, n, i] of APPS) { const b = h('span', { class: 'tb-badge hidden' }); this.badge[k] = b; grid.append(h('button', { class: 'tb-app', onclick: () => this.go(k) }, ic(i, 30, 1.5), h('span', {}, n), b)); }
    this.body.append(h('div', { class: 'tb-home' }, h('div', { class: 'tb-mis' }, h('small', {}, m ? `${m.id} · ${sess.nivel?.nome || ''}` : 'Prática livre'), h('b', {}, m ? m.nome : 'Sem missão — explore e opere livremente'), m ? h('p', {}, m.objetivo) : ''), grid,
      h('p', { class: 'tb-tip' }, h('kbd', {}, 'Tab'), ' fecha o tablet · ', h('kbd', {}, 'M'), ' minimapa · ', h('kbd', {}, 'R'), ' read-back')));
    this.ups.push(() => this.badges());
  }
  private badges() { const sess = this.c.sess(); if (!sess?.sc) return; const pend = sess.sc.st.cos.filter((o: any) => o.readbackReq && !o.readback).length; this.badge.radio?.classList.toggle('hidden', !pend); if (this.badge.radio) this.badge.radio.textContent = String(pend); }
  go(app: string) {
    this.cur = app; this.ups = []; this.body.innerHTML = ''; const name = APPS.find((a) => a[0] === app)?.[1] || app; this.header(name);
    const sess = this.c.sess(), d = this.c.d; const box = h('div', { class: 'tb-app-body tb-' + app }); this.body.append(box);
    if (!sess) { box.append(h('p', {}, 'Sem sessão.')); return; }
    const sc = sess.sc;
    if (app === 'tarefa') {
      if (!sc) { box.append(h('p', {}, 'Prática livre: sem OS. Use o supervisório, os painéis e o assistente à vontade.')); return; }
      box.append(h('div', { class: 'tb-cols' }, h('div', {}, osDoc(d, sess)), h('div', { class: 'tb-side' })));
      const side = box.querySelector('.tb-side') as HTMLElement;
      if (sess.nivel?.roteiro) { const r = roteiro(sess); side.append(r.e); r.set(); this.ups.push(r.set); }
      else { const prog = h('div', { class: 'psec' }); side.append(prog); this.ups.push(() => { const n = sc.score(); prog.innerHTML = ''; prog.append(h('h4', {}, 'Andamento'), h('p', {}, `${Object.keys(sc.st.checks).length} de ${sc.m.checks.length} critérios cumpridos`), n.criticos ? h('p', { class: 'bad' }, 'Erro crítico registrado') : ''); }); }
      if (sc.m.anomalias) { const all = [...sc.m.anomalias, ...(sc.m.distratores || [])].sort((a: any, b: any) => a.nome.localeCompare(b.nome));
        side.append(h('section', { class: 'psec' }, h('h4', {}, 'Relatar anomalia encontrada'), ...all.map((a: any) => h('button', { class: 'hw proc' + (sc.st.relatos.includes(a.id) ? ' done' : ''), onclick: (e: any) => { sess.relatar(a.id); e.currentTarget.classList.add('done'); this.c.toast('Anomalia registrada: ' + a.nome, 'ok'); } }, a.nome)))); }
      if (!sess.nivel || sess.nivel.dicaFator <= 1) side.append(h('section', { class: 'psec' }, h('h4', {}, 'Dica (custa pontos)'), h('div', { class: 'row' }, ...[1, 2, 3].map((n) => h('button', { class: 'hw sm ghost', onclick: () => { const t = sess.dica(n); side.querySelector('.tb-dica')?.remove(); side.append(h('p', { class: 'tb-dica' }, `Dica N${n}: ${t}`)); } }, `N${n} · −${(d.scoring.dicas['N' + n] * (sess.nivel?.dicaFator ?? 1)).toFixed(0)}`)))));
      side.append(h('section', { class: 'psec' }, h('button', { class: 'hw sm danger', onclick: () => { if (confirm('Encerrar a missão e gerar o relatório?')) this.c.finish(); } }, 'Encerrar missão')));
    }
    if (app === 'apr') {
      if (!sc) { box.append(h('p', {}, 'Sem OS na prática livre.')); return; }
      const o = d.os.ordens[sc.m.id];
      if (o && !o.semAPR) box.append(h('h4', {}, sc.st.apr ? `APR registrada: ${sc.st.apr.pct} %` : 'APR — análise preliminar de risco'), aprForm(d, sess, () => this.go('apr')));
      else box.append(h('p', { class: 'muted' }, 'Atendimento a ocorrência: sem APR prévia.'));
      const pt = ptBox(d, sess, (id) => { sess.acao(id); this.go('apr'); }); if (pt.e) { box.append(pt.e); pt.set(); this.ups.push(pt.set); }
    }
    if (app === 'radio') {
      const log = h('div', { class: 'tb-radio' }), pend = h('div'); box.append(h('div', { class: 'tb-cols' }, h('div', {}, h('h4', {}, 'Comunicação com o COS'), log, pend), h('div', { class: 'tb-side' })));
      const mb = missionBlock(this.c.ctx(), 'radio'); if (mb.e) { (box.querySelector('.tb-side') as HTMLElement).append(mb.e); mb.set(null); this.ups.push(() => mb.set(null)); } else (box.querySelector('.tb-side') as HTMLElement).append(h('p', { class: 'muted' }, 'Nenhuma comunicação prevista agora.'));
      let sig = ''; this.ups.push(() => { const com = sess.sim.log.filter((e: any) => e.kind === 'com').slice(-14); const p = sc ? sc.st.cos.filter((o: any) => o.readbackReq && !o.readback) : []; const ns = JSON.stringify([com.map((e: any) => e.seq), p.map((o: any) => o.id)]); if (ns === sig) return; sig = ns;
        log.innerHTML = ''; for (const e of com) log.append(h('div', { class: 'tb-msg a-' + e.actor }, h('small', {}, `${mmss(e.t)} · ${e.actor === 'cos' ? 'COS' : e.actor === 'treinando' ? 'Você' : e.actor}`), h('p', {}, e.msg.replace(/^COS[^:]*:\s*/, ''))));
        if (!com.length) log.append(h('p', { class: 'muted' }, 'Sem mensagens.')); log.scrollTop = log.scrollHeight;
        pend.innerHTML = ''; for (const o of p) pend.append(h('button', { class: 'hw primary', onclick: () => { this.c.readback(o.id); } }, ic('Radio', 16), ` Repetir a ordem ${o.id} (read-back)`)); });
    }
    if (app === 'assist') { box.append(this.c.assistEl); this.c.assistEl.classList.remove('hidden'); }
    if (app === 'mapa') { box.append(this.c.map.svg as any, h('p', { class: 'muted' }, this.c.livre() ? 'Prática livre: toque no mapa para ir até o ponto.' : 'Sua posição está marcada pela seta amarela.')); this.ups.push(() => this.c.map.update(this.c.mapPos())); }
    if (app === 'fichas') {
      const inp = h('input', { placeholder: 'Buscar equipamento (ex.: 52-T1, seccionadora, AL3)', class: 'full' }) as HTMLInputElement; const list = h('div', { class: 'tb-list' }), view = h('div', { class: 'tb-ficha' });
      const ids = Object.values<any>(sess.sim.defs).filter((e) => ['CBR', 'DIS', 'PTR', 'CTR', 'VTR', 'SAR'].includes(e.type)).map((e) => e.id);
      const draw = () => { const q = inp.value.trim().toLowerCase(); list.innerHTML = ''; for (const id of ids.filter((i) => !q || (i + ' ' + descEq(sess.sim.defs[i])).toLowerCase().includes(q)).slice(0, 40)) list.append(h('button', { class: 'tb-li', onclick: () => { view.innerHTML = ''; const p = fichaPanel(this.c.ctx(), id); view.append(p.el); p.update(sess.sim.view()); this.ups = [() => p.update(sess.sim.view())]; } }, h('b', {}, id), h('small', {}, descEq(sess.sim.defs[id])))); };
      inp.addEventListener('input', draw); draw(); box.append(h('div', { class: 'tb-cols f' }, h('div', {}, inp, list), view));
    }
    if (app === 'epi') { const p = armario({ d, sess, toast: this.c.toast, refresh: this.c.refreshEpi }, 'MOCHILA'); box.append(p.el); }
    if (app === 'leituras') { const f = sc ? folha(d, sess, this.c.toast) : null; box.append(f || h('p', { class: 'muted' }, 'Esta missão não tem folha de leitura.')); }
  }
  /** Atualização periódica do app aberto. */
  tick() { if (!this.open) return; this.ups.forEach((u) => u()); const sess = this.c.sess(); const st = this.bar.querySelector('.tb-st') as HTMLElement | null; if (st && sess) (st.firstChild as any).textContent = mmss(sess.sim.s.t); void fmt; }
}
