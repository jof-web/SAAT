// HUD mínimo (docs/GDD.md §8): objetivo, relógio/alarmes, mira, prompt de interação, EPI vestido, ferramenta na mão,
// legendas do rádio, avisos curtos e efeitos de tela (clarão, vinheta, escurecer).
import { h } from '../ui/dom';
import { ic, EPI_ICON } from './icons';
import { TOOL_NAMES } from './hands';

export class Hud {
  root = h('div', { id: 'hud', class: 'hidden' });
  private obj = h('div', { class: 'h-obj' }); private stat = h('div', { class: 'h-stat' }); private cross = h('div', { class: 'h-cross' });
  private prompt = h('div', { class: 'h-prompt hidden' }); private epi = h('div', { class: 'h-epi' }); private bar = h('div', { class: 'h-bar' });
  private subs = h('div', { class: 'h-subs' }); private toasts = h('div', { class: 'h-toasts' }); private zone = h('div', { class: 'h-zone' });
  flashEl = h('div', { class: 'h-flash' }); fadeEl = h('div', { class: 'h-fade' }); private hint = h('div', { class: 'h-hint' });
  private clock = h('b', { class: 'mono' }); private bell = h('span', { class: 'h-bell' });
  constructor() {
    this.stat.append(h('span', { class: 'h-clock' }, ic('Clock', 15), this.clock), this.bell);
    this.root.append(this.zone, this.obj, this.stat, this.cross, this.prompt, this.epi, this.bar, this.subs, this.toasts, this.hint, this.flashEl, this.fadeEl);
    document.body.append(this.root);
  }
  show(on: boolean) { this.root.classList.toggle('hidden', !on); }
  setObjective(code: string, title: string, step: string) { this.obj.innerHTML = ''; if (!title) return; this.obj.append(h('small', {}, code), h('b', {}, title), step ? h('span', {}, step) : ''); }
  setStatus(clock: string, alarms: number, unack: number) { this.clock.textContent = clock; this.bell.innerHTML = ''; this.bell.append(ic(unack ? 'Bell' : 'Bell', 15), h('b', {}, String(alarms))); this.bell.className = 'h-bell' + (unack ? ' on' : alarms ? ' some' : ''); }
  setCross(mode: 'off' | 'dot' | 'target') { this.cross.className = 'h-cross ' + mode; }
  setPrompt(p: { key: string; verb: string; label: string; warn?: string } | null) {
    if (!p) { this.prompt.classList.add('hidden'); return; } this.prompt.classList.remove('hidden'); this.prompt.innerHTML = '';
    this.prompt.append(h('kbd', {}, p.key), h('b', {}, p.verb), h('span', {}, p.label), p.warn ? h('em', {}, p.warn) : '');
  }
  setEpi(items: { id: string; nome: string; ok: boolean }[], faltam: string[]) {
    this.epi.innerHTML = ''; if (!items.length && !faltam.length) return;
    for (const it of items) { const s = h('span', { class: 'h-ep' + (it.ok ? '' : ' warn'), title: it.nome }); s.append(ic(EPI_ICON[it.id] || 'Package', 17)); this.epi.append(s); }
    if (faltam.length) this.epi.append(h('em', { title: 'Exigido aqui: ' + faltam.join(', ') }, ic('TriangleAlert', 15), `falta ${faltam.length}`));
  }
  setHotbar(slots: { item: string; n: number }[], sel: string | null) {
    this.bar.innerHTML = ''; if (!slots.length) return;
    const row = h('div', { class: 'h-slots' }); slots.slice(0, 9).forEach((s, i) => { const b = h('span', { class: 'h-slot' + (s.item === sel ? ' on' : ''), title: TOOL_NAMES[s.item] || s.item }, h('i', {}, String(i + 1))); b.append(ic(EPI_ICON[s.item] || 'Wrench', 17)); row.append(b); });
    this.bar.append(row, h('small', {}, sel ? TOOL_NAMES[sel] || sel : 'mãos livres  ·  1–9 escolhe · Q guarda'));
  }
  say(actor: string, text: string, rb?: string) {
    const el = h('div', { class: 'h-sub a-' + actor }, h('b', {}, actor === 'cos' ? 'COS' : actor === 'manutencao' ? 'Manutenção' : actor === 'sistema' ? 'Brigada' : actor.toUpperCase()), h('span', {}, text.replace(/^COS[^:]*:\s*/, '')), rb ? h('em', {}, h('kbd', {}, 'R'), ' repetir a ordem (read-back)') : '');
    this.subs.append(el); while (this.subs.children.length > 3) this.subs.firstElementChild!.remove(); setTimeout(() => el.classList.add('out'), rb ? 20000 : 9000); setTimeout(() => el.remove(), rb ? 20600 : 9600);
  }
  toast(msg: string, kind: '' | 'ok' | 'warn' | 'bad' | 'muted' = '', ms = 3800) {
    const t = h('div', { class: 'h-toast ' + kind }, msg); this.toasts.append(t); while (this.toasts.children.length > 2) this.toasts.firstElementChild!.remove(); setTimeout(() => t.classList.add('out'), ms); setTimeout(() => t.remove(), ms + 400);
  }
  setHint(txt: string) { this.hint.textContent = txt; this.hint.classList.toggle('hidden', !txt); }
  /** Vinheta vermelha pulsante (zona controlada / tensão de passo). */
  setZone(level: number) { this.zone.style.opacity = String(Math.min(1, level)); this.zone.classList.toggle('pulse', level > 0.5); }
  flash(color = '#dff3ff', ms = 600) { const f = this.flashEl; f.style.background = color; f.classList.remove('go'); void f.offsetWidth; f.style.animationDuration = ms + 'ms'; f.classList.add('go'); }
  fade(on: boolean, ms = 900) { this.fadeEl.style.transitionDuration = ms + 'ms'; this.fadeEl.classList.toggle('on', on); }
}
