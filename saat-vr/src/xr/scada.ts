// Supervisório no VR (gatilho na mesa de operação): manobras remotas com confirmação (SELECIONAR → EXECUTAR),
// alarmes com reconhecimento e transformadores (TAP, automático/manual). Convenção do SCADA: vermelho = fechado.
import { Vector3, type Scene } from 'three';
import { Panel, UI } from './panel';
import { drawProcs } from './card';

export interface ScadaHost { sess(): any; cmd(c: any): any; ctx(): any }
const _f = new Vector3();
export class VRScada {
  panel = new Panel({ w: 0.92, h: 0.62, px: 1280 }); open = false; tab = 'man'; page = 0; sel: { id: string; op: 'open' | 'close' } | null = null; private t = 0; ask: [string, () => void][] | null = null; proc = { page: 0, ask: (ops: [string, () => void][]) => { this.ask = ops; this.panel.dirty = true; } };
  constructor(public H: ScadaHost, scene: Scene) { this.panel.render = (p) => this.draw(p); this.panel.mesh.visible = false; scene.add(this.panel.mesh); }
  show(head: Vector3, fwd: Vector3) { _f.copy(fwd).setY(0).normalize(); const m = this.panel.mesh; m.position.copy(head).addScaledVector(_f, 0.85); m.position.y = head.y - 0.1; m.lookAt(head.x, head.y - 0.05, head.z); m.visible = true; this.open = true; this.sel = null; this.panel.dirty = true; }
  close() { this.open = false; this.panel.mesh.visible = false; this.panel.clearHover(); }
  update(dt: number) { if (!this.open) return; this.t += dt; if (this.t > 0.4) { this.t = 0; this.panel.dirty = true; } this.panel.update(); }
  private draw(p: Panel) {
    const s = this.H.sess(); if (!s) return; const sim = s.sim, v = sim.view(), st = v.s;
    p.rect(0, 0, p.W, 84, '#1f2326'); p.text('SUPERVISÓRIO · SE VALE VERDE', 24, 42, { size: 30, weight: 700 }); p.text('vermelho = fechado · verde = aberto', 760, 42, { size: 22, color: UI.dim });
    p.button('x', p.W - 84, 10, 68, 64, 'X', () => this.close(), { size: 30 });
    ([['man', 'Manobras'], ['ala', 'Alarmes'], ['trf', 'Transformadores'], ['proc', 'Procedimentos']] as const).forEach(([k, l], i) => p.button('t' + k, 24 + i * 250, 98, 240, 60, l, () => { this.tab = k; this.page = 0; this.sel = null; this.ask = null; }, { active: this.tab === k, size: 26 }));
    if (this.ask) { p.text('Confirmar decisão:', 24, 200, { size: 26, color: UI.accent }); this.ask.forEach(([l, f], i) => p.button('ak' + i, 24, 230 + i * 76, 1232, 66, l, () => { this.ask = null; f(); }, { size: 24, align: 'left' })); p.button('akx', 24, 230 + this.ask.length * 76, 1232, 60, 'Cancelar', () => { this.ask = null; }, { size: 24 }); return; }
    if (this.tab === 'proc') { drawProcs(p, 24, 178, 1232, 'IHM', this.proc, this.H.ctx(), 7); return; }
    if (!v.ccOk) { p.text('Sem supervisão (falta de CC/comunicação): opere localmente.', 24, 210, { size: 28, color: UI.bad }); return; }
    const y0 = 178;
    if (this.tab === 'man') {
      const ids = Object.values<any>(sim.defs).filter((d) => d.type === 'CBR' || d.type === 'DIS').map((d) => d.id).sort(), per = 7, pages = Math.ceil(ids.length / per); this.page = Math.min(this.page, pages - 1);
      ids.slice(this.page * per, this.page * per + per).forEach((id: string, i: number) => { const b = st.eq[id], y = y0 + i * 66, fech = b.state === 'closed', mov = !!b.moving;
        p.rect(24, y, 18, 54, mov ? UI.warn : fech ? '#d9423a' : '#2f9e5b'); p.text(id, 56, y + 27, { size: 26, weight: 700, mono: true, max: 260 });
        p.text(mov ? 'EM MANOBRA' : fech ? 'FECHADO' : 'ABERTO', 330, y + 27, { size: 24, color: mov ? UI.warn : fech ? '#ff6b63' : UI.ok, weight: 700 }); p.text(b.lr ? `43: ${String(b.lr).toUpperCase()}` : '', 520, y + 27, { size: 20, color: UI.dim });
        if (b.loto?.length) p.text('BLOQUEADO', 660, y + 27, { size: 20, color: UI.warn });
        p.button('o' + id, 820, y, 200, 54, 'ABRIR', () => { this.sel = { id, op: 'open' }; }, { size: 22, active: this.sel?.id === id && this.sel.op === 'open', color: UI.ok });
        p.button('c' + id, 1036, y, 200, 54, 'FECHAR', () => { this.sel = { id, op: 'close' }; }, { size: 22, active: this.sel?.id === id && this.sel.op === 'close', color: '#d9423a' }); });
      const yb = y0 + per * 66 + 6;
      if (this.sel) { p.rect(24, yb, 1232, 66, '#2a2410'); p.text(`EXECUTAR: ${this.sel.op === 'open' ? 'ABRIR' : 'FECHAR'} ${this.sel.id} (remoto)?`, 40, yb + 33, { size: 26, color: UI.accent, weight: 700 });
        p.button('ok', 860, yb + 6, 180, 54, 'Executar', () => { const x = this.sel!; this.sel = null; this.H.cmd({ t: 'switch', id: x.id, op: x.op, via: 'remote' }); }, { size: 24, active: true }); p.button('no', 1056, yb + 6, 180, 54, 'Cancelar', () => { this.sel = null; }, { size: 24 }); }
      else if (pages > 1) { p.button('pg-', 24, yb + 6, 120, 54, '<', () => { this.page = Math.max(0, this.page - 1); }, { size: 30, disabled: this.page === 0 }); p.text(`${this.page + 1}/${pages}`, 640, yb + 33, { size: 24, align: 'center', mono: true }); p.button('pg+', 1116, yb + 6, 120, 54, '>', () => { this.page = Math.min(pages - 1, this.page + 1); }, { size: 30, disabled: this.page >= pages - 1 }); }
    } else if (this.tab === 'ala') {
      const al = st.alarmes.filter((a: any) => a.ativo).slice(-8).reverse();
      p.button('ack', 1036, 98, 200, 60, 'ACK todos', () => this.H.cmd({ t: 'ack' }), { size: 24, color: UI.accent });
      if (!al.length) p.text('Sem alarmes ativos.', 24, y0 + 30, { size: 26, color: UI.dim });
      al.forEach((a: any, i: number) => { const y = y0 + i * 56; p.rect(24, y, 10, 44, a.sev >= 3 ? UI.bad : UI.warn); p.text(`${a.ack ? '  ' : '! '}${a.text}`, 48, y + 22, { size: 22, mono: true, max: 1190, color: a.ack ? UI.dim : UI.text }); });
    } else {
      ['T1', 'T2'].forEach((T, i) => { const tr = st.tr[T], d = v.der.tr[T], y = y0 + i * 200;
        p.text(`${T === 'T1' ? 'TR-01' : 'TR-02'} · ${d.energ ? 'energizado' : 'desenergizado'} · ${d.mva.toFixed(1).replace('.', ',')} MVA · óleo ${Math.round(tr.oleo)} °C`, 24, y + 24, { size: 26, weight: 700, max: 1230 });
        p.text(`TAP ${tr.tap > 0 ? '+' : ''}${tr.tap} · ${tr.modo === 'auto' ? 'AUTOMÁTICO' : 'MANUAL'}`, 24, y + 70, { size: 28, mono: true, color: UI.info });
        p.button('u' + T, 24, y + 100, 220, 60, 'TAP ▲', () => this.H.cmd({ t: 'tap', id: T, dir: 1, via: 'remote' }), { size: 24 }); p.button('d' + T, 260, y + 100, 220, 60, 'TAP ▼', () => this.H.cmd({ t: 'tap', id: T, dir: -1, via: 'remote' }), { size: 24 });
        p.button('m' + T, 500, y + 100, 300, 60, tr.modo === 'auto' ? 'Passar para MANUAL' : 'Passar para AUTO', () => this.H.cmd({ t: 'oltc', id: T, modo: tr.modo === 'auto' ? 'manual' : 'auto', via: 'remote' }), { size: 24 }); });
    }
  }
}
