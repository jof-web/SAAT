// Diagrama funcional de comando do disjuntor (vivo): mostra quais contatos estão fechados e o que impede abrir/fechar.
import { sv, h } from './dom';

export function diagramaComando(ctx: { view(): any; sim: any; d: any }, id: string) {
  const sim = ctx.sim, d = ctx.d, e = sim.defs[id], lr = e.lr, at = e.ratings?.classe === 'at';
  const svg = sv('svg', { viewBox: '0 0 560 330', class: 'cdiag', role: 'img', 'aria-label': `Diagrama de comando do ${id}` }) as SVGSVGElement;
  const g = (t: string, a: any = {}, txt?: string) => { const el = sv(t, a, txt ?? null); svg.append(el); return el; };
  const RP = g('line', { x1: 30, y1: 34, x2: 530, y2: 34, class: 'rail' }), RN = g('line', { x1: 30, y1: 300, x2: 530, y2: 300, class: 'rail' });
  g('text', { x: 6, y: 38, class: 'ct' }, '+'); g('text', { x: 6, y: 304, class: 'ct' }, '−'); g('text', { x: 36, y: 24, class: 'ct sm' }, '125 Vcc');
  type Ct = { y: number; nome: string; ok: (v: any) => boolean; nota?: string };
  const ramo = (x: number, titulo: string, cts: Ct[], bobina: string) => {
    g('text', { x, y: 322, class: 'ct sm mid' }, titulo);
    const segs: SVGElement[] = []; let y0 = 34; const parts: { ct: Ct; seg: SVGElement; a: SVGElement; b: SVGElement; lbl: SVGElement }[] = [];
    for (const ct of cts) { const seg = g('line', { x1: x, y1: y0, x2: x, y2: ct.y - 9, class: 'w' }); segs.push(seg);
      const a = g('line', { x1: x - 10, y1: ct.y - 9, x2: x + 10, y2: ct.y - 9, class: 'cp' }), b = g('line', { x1: x - 10, y1: ct.y + 9, x2: x + 10, y2: ct.y + 9, class: 'cp' });
      const lbl = g('text', { x: x + 16, y: ct.y + 4, class: 'ct sm' }, ct.nome); parts.push({ ct, seg, a, b, lbl }); y0 = ct.y + 9; }
    const last = g('line', { x1: x, y1: y0, x2: x, y2: 250, class: 'w' });
    const coil = g('rect', { x: x - 22, y: 250, width: 44, height: 26, rx: 4, class: 'coil' }); g('text', { x, y: 268, class: 'ct sm mid' }, bobina); g('line', { x1: x, y1: 276, x2: x, y2: 300, class: 'w' });
    return (v: any, cc: boolean) => { let live = cc; const falhas: string[] = [];
      for (const p of parts) { p.seg.setAttribute('class', 'w' + (live ? ' on' : '')); const ok = p.ct.ok(v); p.b.setAttribute('transform', ok ? 'translate(0,-6)' : ''); p.a.setAttribute('class', 'cp' + (live ? ' on' : '')); p.b.setAttribute('class', 'cp' + (live && ok ? ' on' : ''));
        p.lbl.setAttribute('class', 'ct sm ' + (ok ? 'okc' : 'bad')); if (!ok) falhas.push(p.ct.nome + (p.ct.nota ? ` (${p.ct.nota})` : '')); live = live && ok; }
      last.setAttribute('class', 'w' + (live ? ' on' : '')); coil.setAttribute('class', 'coil' + (live ? ' ready' : '')); return { pronto: live, falhas }; };
  };
  const st = (v: any) => v.s.eq[id];
  const lock = (v: any) => Object.entries<any>(d.protections.bloqueios).find(([k, x]) => v.s.locks[k] && x.bloqueia.includes(id));
  const plug = (v: any) => !e.extraivel || st(v).pos !== 'extraido';
  const fechar = ramo(120, 'FECHAMENTO', [
    { y: 70, nome: 'Plugue de comando', ok: plug, nota: 'carrinho extraído' },
    { y: 110, nome: `43 (${'L/R'})`, ok: (v) => !v.s.eq[lr]?.loto.length && !st(v).loto.length, nota: 'cadeado/etiqueta' },
    { y: 150, nome: '86 (NF)', ok: (v) => !lock(v), nota: 'bloqueio atuado' },
    ...(at ? [{ y: 185, nome: '63G SF6', ok: (v: any) => st(v).sf6 !== 2, nota: 'SF6 estágio 2' }] : []),
    { y: at ? 218 : 195, nome: '33 mola carregada', ok: (v) => st(v).mola, nota: 'mola descarregada' },
    { y: at ? 244 - 6 : 228, nome: '52b (aberto)', ok: (v) => st(v).state === 'open', nota: 'já fechado' },
  ], 'BF');
  const abrir = ramo(310, 'ABERTURA', [
    { y: 70, nome: 'Plugue de comando', ok: plug, nota: 'carrinho extraído' },
    ...(at ? [{ y: 150, nome: '63G SF6', ok: (v: any) => st(v).sf6 !== 2, nota: 'SF6 estágio 2' }] : []),
    { y: 200, nome: '52a (fechado)', ok: (v) => st(v).state === 'closed', nota: 'já aberto' },
  ], 'BA');
  const motor = ramo(470, 'MOTOR DA MOLA', [
    { y: 110, nome: 'CA/CC presente', ok: (v) => v.ccOk },
    { y: 170, nome: '33b fim de curso', ok: (v) => !st(v).mola && !st(v).molaDef, nota: 'mola cheia ou motor com defeito' },
  ], 'M');
  g('text', { x: 200, y: 92, class: 'ct sm' }, '↖ comando local (botão) ou remoto (UTR) conforme a 43'); g('text', { x: 360, y: 110, class: 'ct sm' }, '+ trip da proteção (50/51, 86, 50BF)');
  const info = h('div', { class: 'cinfo2' });
  return { el: h('div', { class: 'cdw' }, svg as any, info), update: (v: any) => {
    const cc = v.ccOk; RP.setAttribute('class', 'rail' + (cc ? ' on' : '')); RN.setAttribute('class', 'rail' + (cc ? ' onn' : ''));
    const f = fechar(v, cc), a = abrir(v, cc); motor(v, cc);
    const lrPos = v.s.eq[lr]?.lr; const il = sim.violations(e, ['close'], { via: lrPos === 'remoto' ? 'remote' : 'local', actor: 'treinando' }).filter((x: any) => !['I-07', 'I-06', 'I-09'].includes(x.id));
    info.innerHTML = ''; info.append(
      h('p', {}, h('b', {}, 'Fechar: '), f.pronto && !il.length ? h('span', { class: 'okc' }, 'circuito pronto — falta só o comando (botão local ou remoto, conforme a 43)') : h('span', { class: 'bad' }, [...f.falhas, ...il.map((x: any) => `${x.id}: ${x.det}`)].join(' · ') || '—')),
      h('p', {}, h('b', {}, 'Abrir: '), a.pronto ? h('span', { class: 'okc' }, 'circuito pronto') : h('span', { class: 'bad' }, a.falhas.join(' · '))),
      h('p', { class: 'muted' }, `43 em ${String(lrPos || '—').toUpperCase()} · CC ${cc ? 'presente' : 'AUSENTE (nada opera)'} · contatos verdes = fechados (passam corrente), vermelhos = abertos (impedem).`));
  } };
}
