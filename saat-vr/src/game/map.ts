// Planta da SE em SVG (coordenadas do desenho de referência) com a posição do operador.
import { sv } from '../ui/dom';

export function plantMap(pl: any, onClick?: (px: number, py: number) => void) {
  const svg = sv('svg', { viewBox: '55 40 760 1080', class: 'pmap', role: 'img', 'aria-label': 'Planta da SE' }) as SVGSVGElement;
  const A = (t: string, a: any, txt?: string) => { const e = sv(t, a, txt ?? null); svg.append(e); return e; };
  const [x1, y1, x2, y2] = pl.cerca.rect; A('rect', { x: 55, y: 40, width: 760, height: 1080, class: 'm-bg' }); A('rect', { x: x1, y: y1, width: x2 - x1, height: y2 - y1, class: 'm-gr' });
  A('rect', { x: x1, y: y1, width: x2 - x1, height: y2 - y1, class: 'm-fence' }); const k = pl.escala.mPorPx, oy = pl.escala.origem[1]; for (const g of pl.cerca.portoes || []) A('line', { x1: x2, x2: x2, y1: oy + g.zM[0] / k, y2: oy + g.zM[1] / k, class: 'm-gate' });
  A('line', { x1: pl.portico.x[0], x2: pl.portico.x[1], y1: pl.portico.y, y2: pl.portico.y, class: 'm-at' }); for (const x of pl.porticosLaterais?.xM || []) A('line', { x1: pl.escala.origem[0] + x / pl.escala.mPorPx, x2: pl.escala.origem[0] + x / pl.escala.mPorPx, y1: pl.escala.origem[1] + pl.porticosLaterais.zM[0] / pl.escala.mPorPx, y2: pl.escala.origem[1] + pl.porticosLaterais.zM[2] / pl.escala.mPorPx, class: 'm-at' }); A('line', { x1: pl.barramento.x[0], x2: pl.barramento.x[1], y1: pl.barramento.y, y2: pl.barramento.y, class: 'm-at' });
  for (const t of pl.trincheiras) A('line', { x1: t.x, x2: t.x, y1: t.y[0], y2: t.y[1], class: 'm-tr' });
  for (const b of pl.bays) { A('rect', { x: b.px[0] - 50, y: b.px[1] - 12, width: 100, height: 24, rx: 2, class: 'm-bay' + (b.reserva ? ' res' : '') }); A('text', { x: b.px[0], y: b.px[1] + 6, class: 'm-tx' }, b.eq || b.rotulo || 'reserva'); }
  for (const t of pl.trafos) { A('rect', { x: t.px[0] - 45, y: t.px[1] - 30, width: 90, height: 60, rx: 3, class: 'm-trf' }); A('text', { x: t.px[0], y: t.px[1] + 8, class: 'm-tx b' }, t.tag); }
  const [c1, c2, c3, c4] = pl.casa.rect; A('rect', { x: c1, y: c2, width: c3 - c1, height: c4 - c2, class: 'm-casa' }); A('line', { x1: pl.casa.divisoriaX, x2: pl.casa.divisoriaX, y1: c2, y2: c4, class: 'm-wall' });
  for (const k of ['EQ1', 'EQ2', 'EQ3', 'BAT']) { const r = pl.casa[k].rect; A('rect', { x: r[0], y: r[1], width: r[2] - r[0], height: r[3] - r[1], class: 'm-eq' }); A('text', { x: (r[0] + r[2]) / 2, y: (r[1] + r[3]) / 2 + 6, class: 'm-tx s' }, k === 'EQ1' ? 'EQ-1' : k === 'EQ2' ? 'EQ-2' : k === 'EQ3' ? 'EQ-3' : 'BAT'); }
  A('circle', { cx: pl.pontoEncontro.px[0], cy: pl.pontoEncontro.px[1], r: 12, class: 'm-pe' });
  A('text', { x: 437, y: 66, class: 'm-tx' }, 'N ↑  LT-01 · LT-02');
  const me = A('path', { d: 'M0,-24 L15,15 L0,7 L-15,15 Z', class: 'm-me' });
  if (onClick) svg.addEventListener('click', (e) => { const pt = svg.createSVGPoint(); pt.x = (e as MouseEvent).clientX; pt.y = (e as MouseEvent).clientY; const p = pt.matrixTransform(svg.getScreenCTM()!.inverse()); onClick(p.x, p.y); });
  return { svg, update: (p: { px: number; py: number; yaw: number }) => me.setAttribute('transform', `translate(${p.px},${p.py}) rotate(${(-p.yaw * 180) / Math.PI})`) };
}
