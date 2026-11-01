// Utilitários mínimos de DOM (sem framework).
export const SVGNS = 'http://www.w3.org/2000/svg';
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, any> = {}, ...kids: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids) if (c != null && c !== false) e.append(c as any);
  return e;
}
export function sv(tag: string, attrs: Record<string, any> = {}, ...kids: (Node | string | null)[]): SVGElement {
  const e = document.createElementNS(SVGNS, tag) as SVGElement;
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) { if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v); else e.setAttribute(k, String(v)); }
  for (const c of kids) if (c != null) e.append(c as any);
  return e;
}
export const fmt = (x: number, d = 0) => (isFinite(x) ? x.toFixed(d).replace('.', ',') : '—');
export const mmss = (ms: number) => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
export function download(name: string, data: string, type = 'application/json') {
  const a = h('a', { href: URL.createObjectURL(new Blob([data], { type })), download: name }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
export const LS = {
  get(k: string, d: any = null) { try { const v = localStorage.getItem('saat:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k: string, v: any) { try { localStorage.setItem('saat:' + k, JSON.stringify(v)); return true; } catch { return false; } },
};
