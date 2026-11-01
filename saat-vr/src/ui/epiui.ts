// Armários de EPI/ferramentas/LOTO: pegar, inspecionar (com defeitos sorteados), devolver, separar; conferência para a tarefa.
import { h } from './dom';
import { ic, EPI_ICON } from '../game/icons';
import type { Panel } from './panels';

export const icone = (_d: any, item: string) => ic(EPI_ICON[item] || 'Package', 20);
export function armario(ctx: { d: any; sess: any; toast: (m: string, c?: string) => void; refresh: () => void }, local: string): Panel {
  const d = ctx.d, s = ctx.sess, inv = s.inv; const list = h('div', { class: 'epilist' }); const conf = h('div', { class: 'epiconf' });
  const nomes: Record<string, string> = { EPI: 'Armário de EPI', FERR: 'Armário de ferramentas e aterramento temporário', LOTO: 'Quadro de bloqueio (LOTO)', EPIQ: 'Armário de EPI químico (sala de baterias)', MOCHILA: 'Meu EPI e ferramentas' };
  function render() {
    list.innerHTML = '';
    const units = inv.units.filter((u: any) => local === 'MOCHILA' ? u.comigo : inv.def(u.item).local === local);
    if (!units.length) list.append(h('p', { class: 'muted' }, local === 'MOCHILA' ? 'Você não está com nenhum item. Vá aos armários da casa de comando.' : 'Vazio.'));
    for (const u of units) { const it = inv.def(u.item); const st = u.descartado ? 'separado (defeito)' : u.comigo ? 'com você' : 'no armário';
      const res = h('div', { class: 'epires' });
      const card = h('div', { class: 'epicard ' + (u.comigo ? 'on' : '') + (u.descartado ? ' off' : '') },
        h('div', { class: 'epiic' }, icone(d, u.item)), h('div', { class: 'epitx' }, h('b', {}, `${it.nome}`), h('small', {}, `unidade ${u.n} · ${st}${u.inspecionado ? ' · inspecionado' : ''}`),
          h('details', {}, h('summary', {}, 'Para que serve / como inspecionar'), h('p', {}, h('b', {}, 'Serve: '), it.serve), h('p', {}, h('b', {}, 'Inspeção: '), it.inspecao), h('p', {}, h('b', {}, 'Quando: '), it.quando), it.atpv ? h('p', {}, h('b', {}, 'ATPV: '), it.atpv) : null), res),
        h('div', { class: 'epibt' }, u.descartado ? null : h('button', { class: 'hw sm', onclick: () => { const r = s.epi('inspecionar', u.uid); res.textContent = r.txt; res.className = 'epires ' + (r.ok ? 'okc' : 'bad'); } }, 'Inspecionar'),
          u.descartado ? null : u.comigo ? h('button', { class: 'hw sm ghost', onclick: () => { ctx.toast(s.epi('devolver', u.uid).txt, 'muted'); render(); ctx.refresh(); } }, 'Devolver') : h('button', { class: 'hw sm primary', onclick: () => { ctx.toast(s.epi('pegar', u.uid).txt, 'ok'); render(); ctx.refresh(); } }, it.cat?.startsWith('EPI') ? 'Vestir' : 'Pegar'),
          u.descartado || !u.inspecionado || !u.defeito ? null : h('button', { class: 'hw sm danger', onclick: () => { ctx.toast(s.epi('descartar', u.uid).txt, 'warn'); render(); ctx.refresh(); } }, 'Separar p/ descarte')));
      list.append(card); }
    conf.innerHTML = ''; const m = s.cfg.missao; const tar = (m && d.epi.missao[m]) || [];
    if (tar.length) { const r = inv.conferir(tar); conf.append(h('b', {}, 'Para esta missão você precisa de: '), h('div', { class: 'row' }, ...r.req.map((i: string) => { const u = inv.usar(i); return h('span', { class: 'chip ' + (u && !u.defeito ? (u.inspecionado || !inv.def(i).defeitavel ? 'ok' : 'warn') : 'bad') }, icone(d, i), ' ' + inv.nome(i)); })),
      h('button', { class: 'hw sm', onclick: () => { const x = s.conferirEpi(); ctx.toast(x.txt, x.ok ? 'ok' : 'warn'); render(); ctx.refresh(); } }, 'Conferir EPI para a tarefa (vale ponto)')); }
  }
  render();
  return { title: nomes[local] || local, el: h('div', { class: 'parm' }, h('p', { class: 'muted' }, 'Inspecione antes de usar: alguns itens podem estar com defeito (como na vida real). Item com defeito deve ser separado e trocado por outra unidade.'), conf, list), update: () => {} };
}
