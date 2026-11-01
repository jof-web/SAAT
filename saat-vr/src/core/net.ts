// sim-core / solver F1: análise nodal em pu (base do trafo). TS puro.
// Chaves fechadas = ramos de impedância desprezível; trafos = ramos com Zt.
// Fonte = barra infinita atrás de Zs (anexo 0.4 e 1.2).
export interface Branch { id: string; a: string; b: string; z: number; nivel: 'AT' | 'MT' | 'TR' }
export interface Net { nodes: string[]; idx: Record<string, number>; branches: Branch[] }
export const Z_SW = 1e-6, Z_FAULT = 1e-8, Y_LEAK = 1e-9;

export function makeNet(nodes: string[], branches: Branch[]): Net {
  const idx: Record<string, number> = {}; nodes.forEach((n, i) => (idx[n] = i));
  return { nodes, idx, branches };
}
function gauss(A: number[][], b: number[]): number[] {
  const n = b.length;
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (p !== c) { [A[p], A[c]] = [A[c], A[p]]; [b[p], b[c]] = [b[c], b[p]]; }
    const d = A[c][c]; if (Math.abs(d) < 1e-300) continue;
    for (let r = c + 1; r < n; r++) { const f = A[r][c] / d; if (f === 0) continue; for (let k = c; k < n; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) { let s = b[r]; for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k]; x[r] = Math.abs(A[r][r]) < 1e-300 ? 0 : s / A[r][r]; }
  return x;
}
export interface Sol { V: Record<string, number>; I: Record<string, number> }
/** Resolve Y·V = J. shunts: admitâncias à referência; inj: correntes injetadas (pu). */
export function solve(net: Net, shunts: Record<string, number>, inj: Record<string, number>, skipTR = false): Sol {
  const n = net.nodes.length;
  const Y = Array.from({ length: n }, () => new Array(n).fill(0)); const J = new Array(n).fill(0);
  for (let i = 0; i < n; i++) Y[i][i] = Y_LEAK;
  for (const br of net.branches) {
    if (skipTR && br.nivel === 'TR') continue;
    const i = net.idx[br.a], j = net.idx[br.b], y = 1 / br.z;
    Y[i][i] += y; Y[j][j] += y; Y[i][j] -= y; Y[j][i] -= y;
  }
  for (const k in shunts) if (k in net.idx) Y[net.idx[k]][net.idx[k]] += shunts[k];
  for (const k in inj) if (k in net.idx) J[net.idx[k]] += inj[k];
  const v = gauss(Y, J);
  const V: Record<string, number> = {}; net.nodes.forEach((nd, i) => (V[nd] = v[i]));
  const I: Record<string, number> = {};
  for (const br of net.branches) I[br.id] = skipTR && br.nivel === 'TR' ? 0 : (V[br.a] - V[br.b]) / br.z;
  return { V, I };
}
/** Componentes conexos a partir de um conjunto de nós, atravessando os ramos aceitos. */
export function reach(net: Net, from: string[], accept: (b: Branch) => boolean = () => true): Set<string> {
  const adj: Record<string, string[]> = {};
  for (const b of net.branches) if (accept(b)) { (adj[b.a] ||= []).push(b.b); (adj[b.b] ||= []).push(b.a); }
  const seen = new Set<string>(from); const st = [...from];
  while (st.length) { const x = st.pop()!; for (const y of adj[x] || []) if (!seen.has(y)) { seen.add(y); st.push(y); } }
  return seen;
}
/** Tempo de operação IEC (s): t = TMS·k/((I/Is)^a − 1). Infinity se I ≤ Is. */
export function curveTime(curva: { k: number; a: number }, tms: number, I: number, Is: number): number {
  const m = I / Is; if (!(m > 1)) return Infinity;
  return (tms * curva.k) / (Math.pow(m, curva.a) - 1);
}
/** 87T percentual com restrição harmônica (anexo 4.1). true = opera. */
export function eval87T(cfg: any, x: { idiffPu: number; ibiasPu: number; h2Pct: number; h5Pct: number }): { opera: boolean; motivo: string } {
  if (x.idiffPu >= cfg.instPu) return { opera: true, motivo: 'elemento instantâneo' };
  const lim = x.ibiasPu <= cfg.joelhoPu ? Math.max(cfg.idiffMinPu, cfg.slope1 * x.ibiasPu)
    : Math.max(cfg.idiffMinPu, cfg.slope1 * cfg.joelhoPu + cfg.slope2 * (x.ibiasPu - cfg.joelhoPu));
  if (x.idiffPu < lim) return { opera: false, motivo: 'abaixo da característica' };
  if (x.h2Pct >= cfg.h2Pct) return { opera: false, motivo: `restrição 2ª harmônica (${x.h2Pct.toFixed(0)} % ≥ ${cfg.h2Pct} %)` };
  if (x.h5Pct >= cfg.h5Pct) return { opera: false, motivo: `restrição 5ª harmônica` };
  return { opera: true, motivo: 'diferencial percentual' };
}
export function mulberry32(a: number) {
  return { s: a >>> 0, next() { let t = (this.s += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; } };
}
