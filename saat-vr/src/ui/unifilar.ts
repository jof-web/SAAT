// Unifilar gerado a partir do layout (dados). Só renderiza estado e emite cliques.
import { sv, fmt } from './dom';

export interface UniOpts { onEq?: (id: string, ev: MouseEvent) => void; compact?: boolean }
const COL = { AT: '#eef1f3', MT: '#d9b44a', dead: '#5e666d', gnd: '#3da56a', fault: '#e5484d' };

export function createUnifilar(layout: any, defs: Record<string, any>, nodeLevel: Record<string, string>, opts: UniOpts = {}) {
  const L = layout.unifilar;
  const svg = sv('svg', { viewBox: L.viewBox, class: 'uni', role: 'img', 'aria-label': 'Unifilar da SE-TREINO' }) as SVGSVGElement;
  const gW = sv('g', { class: 'wires' }), gE = sv('g', { class: 'eqs' }), gT = sv('g', { class: 'txt' });
  svg.append(gW, gE, gT);
  const wires = L.wires.map((w: any) => { const p = sv('path', { d: w.d, 'stroke-width': w.w || 2, fill: 'none', 'stroke-linecap': 'round' }); gW.append(p); return { p, node: w.node }; });
  for (const l of L.labels) gT.append(sv('text', { x: l.x, y: l.y, class: 'lbl-' + l.c }, l.t));
  const eqs: Record<string, any> = {};
  for (const [id, pos] of Object.entries<any>(L.eq)) {
    const { x, y, o } = pos; const g = sv('g', { 'data-eq': id, class: 'eq eq-' + o, tabindex: opts.onEq ? 0 : null });
    const d = defs[id] || {};
    let parts: any = {};
    if (o === 'v' || o === 'h') {
      if (d.type === 'CBR') {
        const r = sv('rect', { x: x - 8, y: y - 8, width: 16, height: 16, rx: 2, class: 'cbr' }); g.append(r); parts.r = r;
        if (d.extraivel) { const ch = sv('path', { d: o === 'v' ? `M${x - 5},${y - 13} l5,-4 l5,4 M${x - 5},${y + 13} l5,4 l5,-4` : `M${x - 13},${y - 5} l-4,5 l4,5 M${x + 13},${y - 5} l4,5 l-4,5`, class: 'chev', fill: 'none' }); g.append(ch); parts.ch = ch; }
      } else { // seccionadora vertical
        g.append(sv('circle', { cx: x, cy: y + 8, r: 2, class: 'pin' }), sv('circle', { cx: x, cy: y - 8, r: 2, class: 'pin' }));
        const bl = sv('line', { x1: x, y1: y + 8, x2: x, y2: y - 8, class: 'blade', 'stroke-width': 3 }); g.append(bl); parts.bl = bl; parts.open = [x + 9, y - 5]; parts.closed = [x, y - 8];
      }
      g.append(sv('text', { x: o === 'h' ? x - 18 : x + 13, y: o === 'h' ? y - 14 : y + 4, class: 'eqlbl' }, id));
    } else if (o === 'e') { // chave de terra horizontal
      g.append(sv('circle', { cx: x - 12, cy: y, r: 2, class: 'pin' }), sv('path', { d: `M${x + 8},${y} V${y + 9} M${x + 2},${y + 9} h12 M${x + 4},${y + 12} h8 M${x + 6},${y + 15} h4`, class: 'gndsym', fill: 'none' }));
      const bl = sv('line', { x1: x - 12, y1: y, x2: x + 8, y2: y, class: 'blade', 'stroke-width': 3 }); g.append(bl); parts.bl = bl; parts.open = [x + 4, y - 10]; parts.closed = [x + 8, y]; parts.e = true;
      g.append(sv('text', { x: x - 10, y: y - 10, class: 'eqlbl sm' }, id));
    } else if (o === 'tr') {
      const c1 = sv('circle', { cx: x, cy: y - 10, r: 13, class: 'trw' }), c2 = sv('circle', { cx: x, cy: y + 10, r: 13, class: 'trw' }); g.append(c1, c2); parts.c = [c1, c2];
      g.append(sv('text', { x: x + 18, y: y + 4, class: 'eqlbl big' }, id));
    } else if (o === 'src') { const c = sv('circle', { cx: x, cy: y, r: 12, class: 'src' }); g.append(c, sv('path', { d: `M${x - 6},${y} q3,-6 6,0 t6,0`, fill: 'none', class: 'srcw' })); parts.c = [c]; }
    else if (o === 'load') { g.append(sv('path', { d: `M${x - 6},${y - 8} L${x},${y + 2} L${x + 6},${y - 8}`, class: 'load', fill: 'none' })); }
    else if (o === 'fu') { const r = sv('rect', { x: x - 4, y: y - 7, width: 8, height: 14, class: 'fu' }); g.append(r); parts.r = r; }
    else if (o === 'tsa') { const c1 = sv('circle', { cx: x, cy: y - 7, r: 8, class: 'trw' }), c2 = sv('circle', { cx: x, cy: y + 5, r: 8, class: 'trw' }); g.append(c1, c2, sv('text', { x: x + 12, y: y + 3, class: 'eqlbl sm' }, id)); parts.c = [c1, c2]; }
    const badge = sv('text', { x: x + (o === 'e' ? 16 : 13), y: y - (o === 'e' ? -2 : 8), class: 'badge' }); g.append(badge); parts.badge = badge;
    if (opts.onEq && (d.type === 'CBR' || d.type === 'DIS' || d.type === 'PTR')) { g.classList.add('click'); g.addEventListener('click', (ev) => opts.onEq!(id, ev as MouseEvent)); g.addEventListener('keydown', (ev: any) => { if (ev.key === 'Enter') opts.onEq!(id, ev); }); }
    gE.append(g); eqs[id] = { g, parts, x, y, o, d };
  }
  const meas: any[] = L.meas.map((m: any) => { const t = sv('text', { x: m.x, y: m.y, class: 'meas meas-' + m.k }); gT.append(t); return { ...m, t }; });

  function update(v: any) {
    const { s, der } = v; const faultNodes = new Set((der.faltas || []).map((f: any) => f.node));
    for (const w of wires) {
      const n = w.node; let c = COL.dead, cls = '';
      if (faultNodes.has(n)) { c = COL.fault; cls = 'flt'; } else if (der.gnd[n] && !der.energ[n]) { c = COL.gnd; cls = 'gnd'; } else if (der.energ[n]) c = (COL as any)[nodeLevel[n] || 'MT'];
      w.p.setAttribute('stroke', c); w.p.setAttribute('class', cls);
    }
    for (const [id, e] of Object.entries<any>(eqs)) {
      const b = s.eq[id]; const P = e.parts;
      if (e.d.type === 'CBR' && b) {
        const st = b.moving ? 'mov' : b.state; P.r.setAttribute('class', 'cbr ' + st + (b.falha ? ' dmg' : ''));
        const off = e.d.extraivel && b.pos !== 'servico' ? (b.pos === 'teste' ? 12 : 22) : 0;
        P.r.setAttribute('transform', e.o === 'v' ? `translate(${off},0)` : `translate(0,${off})`); if (P.ch) P.ch.style.opacity = off ? '0.25' : '1';
      }
      if (P.bl && b) { const [x2, y2] = b.state === 'closed' ? P.closed : P.open; P.bl.setAttribute('x2', x2); P.bl.setAttribute('y2', y2); P.bl.setAttribute('class', 'blade ' + (b.moving ? 'mov' : b.state) + (P.e && b.state === 'closed' ? ' earthed' : '')); }
      if (P.r && e.d.type === 'FUS') P.r.setAttribute('class', 'fu ' + (der.energ[e.d.nodes[1]] ? 'on' : ''));
      if (e.o === 'tr' && P.c) { const tr = s.tr[id]; P.c.forEach((c: any) => c.setAttribute('class', 'trw' + (tr?.fogo ? ' fire' : '') + (der.tr[id]?.energ ? ' on' : ''))); }
      if (e.o === 'src' && P.c) P.c[0].setAttribute('class', 'src' + (s.fonte.viva ? ' on' : ''));
      let bd = ''; if (b?.loto?.length) bd += 'BLQ '; if (b?.trava) bd += '! '; if (b?.sf6) bd += ' SF6' + b.sf6;
      if (e.d.type === 'CBR') { const lk = Object.entries<any>(v.bloqueios || {}).find(([k, x]) => s.locks[k] && x.bloqueia.includes(id)); if (lk) bd += ' ' + lk[0].replace(/-.*$/, ''); }
      P.badge.textContent = bd;
    }
    for (const m of meas) {
      if (m.k === 'al') { const I = der.I['52-' + m.ref] || 0; m.t.textContent = `${m.ref} ${fmt(I)} A`; m.t.setAttribute('class', 'meas ' + (der.supplied[m.ref] ? '' : 'off')); }
      else if (m.k === 'bus') { const b = der.barras[m.ref]; m.t.textContent = b?.energ ? `${fmt(b.kV, 2)} kV` : 'sem tensão'; }
      else if (m.k === 'tr') { const t = der.tr[m.ref], st = s.tr[m.ref]; m.t.textContent = `${fmt(t.mva, 2)} MVA ${fmt(t.pct)}% TAP ${st.tap > 0 ? '+' : ''}${st.tap} ${st.modo === 'auto' ? 'A' : 'M'}`; }
      else if (m.k === 'sa') m.t.textContent = `QGCA ← ${s.ca.ats}${s.ca.ok ? '' : ' (SEM CA)'} · CC ${fmt(s.cc.v)} V`;
    }
  }
  return { el: svg, update };
}
