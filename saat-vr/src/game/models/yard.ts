// Pátio 138 kV: seccionadoras de abertura vertical, disjuntores SF6 tanque vivo, TC, TPC com bobina de bloqueio,
// para-raios, barramento tubular, pórtico treliçado, transformadores 25 MVA, cerca, iluminação e entorno.
import { Group, Mesh, Vector3, Vector2, MeshStandardMaterial, LatheGeometry, TorusGeometry, PlaneGeometry, Matrix4, Quaternion, MeshPhysicalMaterial } from 'three';
import { type MCtx, inter, part, colBox, dbox, dcyl, dmesh, plate, sign, canvasTex } from '../common';
import { insulatorProfile } from '../batch';
import { glow } from '../materials';
import { Print } from '../print';
import { padlock, type Lamp } from './indoor';

export const PH = [-3, 0, 3];
export interface DisD { id: string; blades: Group[]; earth: Group[] | null; termN: Vector3[]; termS: Vector3[]; ang: number; earthAng: number; cx: number; cz: number; terraId?: string; tgt: number; eTgt: number; lock: Group; earthLock: Group | null }
export interface CbrD { id: string; flagI: Mesh; flagO: Mesh; mola: Mesh; moving: Mesh[]; arcs: Mesh[]; chambers: Mesh[]; termN: Vector3[]; termS: Vector3[]; pos: number; tgt: number; arcT: number; cx: number; cz: number; sf6: Group[]; counter: ReturnType<typeof canvasTex> }
export interface BayCab { bay: string; lamps: Record<string, Lamp>; sel: Group; lock: Group; door: Group; x: number; z: number }
export interface TrfD { id: string; fans: Group[]; hv: Vector3[]; center: Vector3; vent: number; panel: { oil: Group; wnd: Group; lvl: Group; lcd: ReturnType<typeof canvasTex>; lamps: Record<string, Lamp>; lock: Group }; buch: Mesh; breather: Mesh }
export interface Yard { dis: Record<string, DisD>; cbr: Record<string, CbrD>; cabs: Record<string, BayCab>; trf: Record<string, TrfD>; gates: GateD[]; zones: { p: Vector3; nodes: string[]; nivel: 'AT' | 'MT' }[]; lights: Mesh[]; bus: { x1: number; x2: number; y: number; zs: number[] } }

const chamberMat = new MeshPhysicalMaterial({ color: 0x5b3022, roughness: 0.24, clearcoat: 0.8, clearcoatRoughness: 0.18 });
export const xrayMat = new MeshStandardMaterial({ color: 0x9fb4c0, transparent: true, opacity: 0.18, depthWrite: false, roughness: 0.1 });
export { chamberMat };

function foundation(c: MCtx, x: number, z: number, w = 0.7, h = 0.3) { c.b.box(w, h, w, c.M.concrete, x, h / 2 - 0.05, z); for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.b.cyl(0.012, 0.06, c.M.galv, x + sx * w * 0.32, h - 0.02, z + sz * w * 0.32, 0, 0, 6); }
function column(c: MCtx, x: number, z: number, top: number, r = 0.13) { const M = c.M, B = c.b; foundation(c, x, z); B.box(r * 3.4, 0.03, r * 3.4, M.galv, x, 0.265, z); B.cyl(r, top - 0.28, M.galv, x, 0.28 + (top - 0.28) / 2, z, 0, 0, 18); B.box(r * 3.2, 0.03, r * 3.2, M.galv, x, top, z); colBox(c, x, z, 0.4); groundLead(c, x, z, r); }
function groundLead(c: MCtx, x: number, z: number, r: number) { c.b.path([new Vector3(x + r + 0.01, 0.45, z), new Vector3(x + r + 0.04, 0.2, z + 0.02), new Vector3(x + r + 0.12, 0.0, z + 0.05)], 0.008, c.M.copper, 8, 5); }
function pad(c: MCtx, x: number, y: number, z: number, faceZ: number) { const B = c.b, M = c.M; B.box(0.12, 0.12, 0.016, M.alu, x, y, z); for (const sx of [-1, 1]) for (const sy of [-1, 1]) B.cyl(0.008, 0.02, M.galv, x + sx * 0.03, y + sy * 0.03, z + faceZ * 0.012, Math.PI / 2, 0, 6); }
function insul(c: MCtx, x: number, y: number, z: number, h: number, o: { core?: number; big?: number; small?: number; pitch?: number; mat?: any } = {}) {
  c.b.lathe(insulatorProfile(h, o.core ?? 0.07, o.big ?? 0.13, o.small ?? 0.105, o.pitch ?? 0.07), o.mat ?? c.M.porcelain, x, y, z, 16);
  c.b.cyl((o.core ?? 0.07) * 1.5, 0.05, c.M.galv, x, y + 0.025, z, 0, 0, 14); c.b.cyl((o.core ?? 0.07) * 1.5, 0.05, c.M.galv, x, y + h - 0.025, z, 0, 0, 14);
}
const plaqueta = (c: MCtx, id: string, x: number, y: number, z: number, ry = 0) => { plate(c, 'plaqueta', [id], 0.5, 0.13, x, y, z, ry); };

// ======================= seccionadora 145 kV (abertura vertical) =======================
export function seccionadora(c: MCtx, cx: number, cz: number, id: string, o: { terra?: string; terraLado?: 'N' | 'S'; reserva?: boolean } = {}): DisD {
  const M = c.M, B = c.b, root = c.root.patio, top = 2.5, y0 = 2.66, hI = 1.5, yT = y0 + hI, zH = cz - 0.85, zC = cz + 0.85;
  const blades: Group[] = [], earth: Group[] = [], termN: Vector3[] = [], termS: Vector3[] = [];
  for (const dx of PH) {
    const x = cx + dx; column(c, x, cz, top);
    B.box(0.16, 0.14, 2.2, M.galv, x, top + 0.085, cz); B.box(0.2, 0.02, 2.2, M.galv, x, top + 0.16, cz);
    insul(c, x, y0 - 0.06 + 0.06, zH, hI); insul(c, x, y0, zC, hI); insul(c, x, y0, zH + 0.34, hI - 0.05, { core: 0.05, big: 0.095, small: 0.08 });
    B.box(0.22, 0.17, 0.32, M.alu, x, yT + 0.09, zH); B.cyl(0.06, 0.26, M.aluDull, x, yT + 0.17, zH, 0, Math.PI / 2, 12); pad(c, x, yT + 0.12, zH - 0.24, -1);
    B.box(0.06, 0.06, 0.25, M.alu, x, yT + 0.08, zH + 0.22);
    B.box(0.2, 0.16, 0.22, M.alu, x, yT + 0.08, zC); for (const sx of [-0.045, 0.045]) B.box(0.02, 0.16, 0.2, M.alu, x + sx, yT + 0.24, zC); pad(c, x, yT + 0.12, zC + 0.2, 1);
    B.rod(new Vector3(x + 0.1, yT + 0.25, zC - 0.05), new Vector3(x + 0.12, yT + 0.55, zC + 0.12), 0.01, M.aluDull, 6);
    const pv = new Group(); pv.position.set(x, yT + 0.22, zH); root.add(pv);
    const bl = dcyl(0.038, 1.66, M.alu, 0, 0, 0.88, pv, 12); bl.rotation.x = Math.PI / 2; bl.castShadow = true; dbox(0.09, 0.05, 0.14, M.alu, 0, 0, 1.72, pv); dcyl(0.05, 0.2, M.aluDull, 0, 0, 0.06, pv, 12).rotation.z = Math.PI / 2;
    blades.push(pv); termN.push(new Vector3(x, yT + 0.12, zH - 0.3)); termS.push(new Vector3(x, yT + 0.12, zC + 0.26));
    if (o.terra) {
      const zt = o.terraLado === 'S' ? zC : zH, sgn = o.terraLado === 'S' ? 1 : -1, ey = top + 0.3, L = yT + 0.1 - ey;
      const eg = new Group(); eg.position.set(x - 0.2, ey, zt + sgn * 0.2); root.add(eg); const rod = dcyl(0.022, L, M.aluDull, 0, L / 2, 0, eg, 8); rod.castShadow = true; dbox(0.07, 0.05, 0.07, M.alu, 0, L, 0, eg);
      eg.userData.sgn = sgn; earth.push(eg); B.box(0.1, 0.08, 0.1, M.alu, x - 0.2, yT + 0.12, zt + sgn * 0.2); B.box(0.1, 0.12, 0.12, M.galv, x - 0.2, ey, zt + sgn * 0.2);
      B.path([new Vector3(x - 0.2, ey, zt + sgn * 0.2), new Vector3(x - 0.18, ey - 0.4, zt + sgn * 0.3), new Vector3(x - 0.14, 0.05, cz + sgn * 0.4)], 0.01, M.copper, 10, 5);
    }
  }
  const sh = (y: number) => B.rod(new Vector3(cx + PH[0] - 0.05, y, zH + 0.34), new Vector3(cx + PH[2] + 0.05, y, zH + 0.34), 0.028, M.galv, 10);
  sh(top - 0.12);
  // acionamento motorizado (polo A) com eixo vertical
  const mx = cx + PH[0] - 0.55; B.rbox(0.5, 0.78, 0.36, 0.015, M.ral7035, mx, 1.3, cz); B.box(0.52, 0.04, 0.4, M.ral7035, mx, 1.71, cz); B.box(0.02, 0.12, 0.03, M.black, mx + 0.2, 1.3, cz + 0.19);
  B.rod(new Vector3(mx, 1.7, cz), new Vector3(mx, top - 0.12, cz), 0.025, M.galv, 8); B.rod(new Vector3(mx, top - 0.12, cz), new Vector3(cx + PH[0], top - 0.12, zH + 0.34), 0.025, M.galv, 8);
  colBox(c, mx, cz, 0.3, 0.25);
  const lock = padlock(M, mx + 0.2, 1.18, cz + 0.2, root);
  let earthLock: Group | null = null;
  if (o.terra) { const ex = cx + PH[2] + 0.5; B.rbox(0.36, 0.5, 0.26, 0.012, M.ral7035, ex, 1.1, cz); B.box(0.04, 0.04, 0.12, M.black, ex + 0.1, 1.1, cz + 0.17); B.rod(new Vector3(ex, 1.35, cz), new Vector3(ex, top + 0.2, cz), 0.022, M.galv, 8); colBox(c, ex, cz, 0.25, 0.2); earthLock = padlock(M, ex - 0.08, 1.0, cz + 0.14, root); }
  plaqueta(c, id, cx + PH[1], 1.85, cz + 0.135, 0); plaqueta(c, id, cx + PH[1], 1.85, cz - 0.135, Math.PI); if (o.terra) plate(c, 'plaqueta', [o.terra], 0.5, 0.13, cx + PH[2], 1.85, cz + 0.135, 0, { bg: '#1f8a4c', fg: '#fff' });
  const vpos = new Vector3(cx + PH[2] + 4.2, 3.2, cz + 5.0), vlook = new Vector3(cx, 3.6, cz);
  if (o.reserva) inter(c, { id: 'res:' + id, kind: 'reserva', label: `Seccionadora ${id} · LT-02 desligada (fora de operação)`, verb: 'Inspecionar', box: [7.4, 4.8, 2.6], at: [cx, 2.6, cz], view: { pos: vpos, look: vlook } });
  else {
    inter(c, { id: 'eq:' + id, kind: 'eq', label: `Seccionadora ${id}${o.terra ? ` + terra ${o.terra}` : ''}`, verb: 'Inspecionar', box: [7.4, 2.4, 2.6], at: [cx, 3.6, cz], eq: id, view: { pos: vpos, look: vlook } });
    inter(c, { id: 'mot:' + id, kind: 'secmot', label: `Acionamento motorizado ${id}`, verb: 'Inspecionar', box: [0.6, 0.9, 0.5], at: [mx, 1.3, cz], eq: id, view: { pos: new Vector3(mx + 0.25, 1.5, cz + 1.0), look: new Vector3(mx, 1.3, cz) } });
    part(c, 'mot:' + id, 'loto', `Bloqueio (cadeado) do acionamento ${id}`, 'loto:dis', [lock], [0.1, 0.12, 0.08], new Vector3(mx + 0.2, 1.18, cz + 0.22), { tool: 'kit_bloqueio', data: { id } });
    part(c, 'mot:' + id, 'abrir', `Abrir ${id} (comando local)`, 'dis:open', [], [0.1, 0.08, 0.06], new Vector3(mx - 0.08, 1.42, cz + 0.2), { data: { id } });
    part(c, 'mot:' + id, 'fechar', `Fechar ${id} (comando local)`, 'dis:close', [], [0.1, 0.08, 0.06], new Vector3(mx + 0.06, 1.42, cz + 0.2), { data: { id } });
    if (o.terra) { const ex = cx + PH[2] + 0.5; inter(c, { id: 'ter:' + o.terra, kind: 'terraAT', label: `Acionamento manual da chave de terra ${o.terra}`, verb: 'Inspecionar', box: [0.5, 0.7, 0.4], at: [ex, 1.1, cz], eq: o.terra, view: { pos: new Vector3(ex + 0.3, 1.35, cz + 1.0), look: new Vector3(ex, 1.1, cz) } });
      part(c, 'ter:' + o.terra, 'manobra', `Operar a chave de terra ${o.terra} (manivela)`, 'terraAT', [], [0.2, 0.2, 0.1], new Vector3(ex + 0.1, 1.1, cz + 0.17), { tool: 'manivela_secc', data: { id: o.terra } });
      part(c, 'ter:' + o.terra, 'loto', `Bloqueio da chave de terra ${o.terra}`, 'loto:dis', [earthLock!], [0.08, 0.1, 0.08], new Vector3(ex - 0.08, 1.0, cz + 0.15), { tool: 'kit_bloqueio', data: { id: o.terra } }); }
    // botões do acionamento (impressão)
    const pr = new Print(0.5, 0.78, 600); pr.tag(id, 0.25, 0.7, 0.3, 0.06); pr.circle(0.17, 0.51, 0.025, '#1f8a4c'); pr.circle(0.31, 0.51, 0.025, '#c8102e'); pr.text('ABRIR', 0.17, 0.46, 0.018); pr.text('FECHAR', 0.31, 0.46, 0.018); pr.text('LOC/REM na caixa do bay', 0.25, 0.38, 0.016, { color: '#333' });
    const pm = pr.mesh(); pm.position.set(mx, 1.3, cz + 0.182); root.add(pm);
  }
  return { id, blades, earth: o.terra ? earth : null, termN, termS, ang: 0, earthAng: 0, cx, cz, terraId: o.terra, tgt: 0, eTgt: 0, lock, earthLock };
}

// ======================= disjuntor 145 kV SF6 tanque vivo (+ TC) =======================
export function disjuntor(c: MCtx, cx: number, cz: number, id: string, o: { tc?: string; bay?: string; cabine?: boolean; reserva?: boolean }, cabs: Record<string, BayCab>): CbrD {
  const M = c.M, B = c.b, root = c.root.patio, moving: Mesh[] = [], arcs: Mesh[] = [], chambers: Mesh[] = [], termN: Vector3[] = [], termS: Vector3[] = [], sf6: Group[] = [];
  B.box(7.3, 0.24, 0.3, M.galv, cx, 2.57, cz); B.box(7.3, 0.03, 0.4, M.galv, cx, 2.705, cz);
  const chamberG = new LatheGeometry(insulatorProfile(1.2, 0.15, 0.22, 0.19, 0.075), 20);
  for (const dx of PH) {
    const x = cx + dx; column(c, x, cz, 2.45, 0.14);
    B.box(0.42, 0.32, 0.42, M.galv, x, 2.88, cz); B.cyl(0.13, 0.06, M.alu, x, 3.06, cz, 0, 0, 16);
    insul(c, x, 3.07, cz, 1.3, { core: 0.09, big: 0.16, small: 0.135 });
    B.cyl(0.2, 0.3, M.alu, x, 4.52, cz, 0, 0, 20); B.cyl(0.215, 0.04, M.alu, x, 4.39, cz, 0, 0, 20); pad(c, x, 4.52, cz - 0.27, -1); B.box(0.1, 0.1, 0.1, M.alu, x, 4.52, cz - 0.2);
    const ch = new Mesh(chamberG, chamberMat); ch.position.set(x, 4.67, cz); ch.castShadow = true; ch.receiveShadow = true; root.add(ch); ch.userData.solo = true; chambers.push(ch);
    B.cyl(0.2, 0.3, M.alu, x, 6.02, cz, 0, 0, 20); B.cyl(0.215, 0.04, M.alu, x, 5.89, cz, 0, 0, 20); B.sphere(0.12, M.alu, x, 6.18, cz, 14); pad(c, x, 6.02, cz + 0.27, 1); B.box(0.1, 0.1, 0.1, M.alu, x, 6.02, cz + 0.2);
    // interior (visto no "raio-X")
    dcyl(0.05, 0.4, M.copper, x, 5.55, cz, root, 12); dcyl(0.08, 0.12, M.white, x, 5.3, cz, root, 14);
    const mv = dcyl(0.04, 0.6, M.copper, x, 4.98, cz, root, 12); mv.userData.y0 = 4.98; moving.push(mv);
    const arc = dcyl(0.035, 0.1, new MeshStandardMaterial({ color: 0xbfe6ff, emissive: 0x9fd6ff, emissiveIntensity: 4 }), x, 5.3, cz, root, 8); arc.visible = false; arcs.push(arc);
    // densímetro SF6 (frente)
    const g = new Group(); g.position.set(x + 0.12, 2.88, cz + 0.24); root.add(g); dcyl(0.06, 0.035, M.alu, 0, 0, 0, g, 18).rotation.x = Math.PI / 2; const face = dcyl(0.052, 0.002, M.white, 0, 0, 0.019, g, 18); face.rotation.x = Math.PI / 2; const nd = dbox(0.004, 0.045, 0.002, M.black, 0, 0.012, 0.022, g); g.userData.needle = nd; sf6.push(g);
    termN.push(new Vector3(x, 4.52, cz - 0.33)); termS.push(new Vector3(x, 6.02, cz + 0.33));
  }
  // caixa do mecanismo de mola (polo A, oeste) com visor
  const mx = cx - 4.15; B.rbox(0.9, 1.4, 0.58, 0.02, M.ral7035, mx, 1.75, cz); B.box(0.94, 0.04, 0.62, M.ral7035, mx, 2.47, cz); B.box(0.6, 0.18, 0.04, M.ral7016, mx, 1.0, cz);
  column(c, mx, cz, 1.05, 0.1); B.rod(new Vector3(mx + 0.45, 2.3, cz), new Vector3(cx + PH[0], 2.62, cz), 0.035, M.galv, 8); B.rod(new Vector3(cx + PH[0], 2.62, cz + 0.1), new Vector3(cx + PH[2], 2.62, cz + 0.1), 0.03, M.galv, 8);
  const win = new Mesh(new PlaneGeometry(0.5, 0.36), M.glassDark); win.position.set(mx, 1.95, cz + 0.295); root.add(win);
  const flagI = dbox(0.12, 0.08, 0.004, glow(0xc8102e), mx - 0.12, 1.98, cz + 0.29, root), flagO = dbox(0.12, 0.08, 0.004, glow(0x1f8a4c), mx - 0.12, 1.98, cz + 0.29, root);
  const mola = dbox(0.12, 0.08, 0.004, glow(0xe0b21e), mx + 0.12, 1.98, cz + 0.29, root);
  const counter = canvasTex(160, 48); const cm = new Mesh(new PlaneGeometry(0.12, 0.036), new MeshStandardMaterial({ map: counter.t, roughness: 0.4 })); cm.position.set(mx, 1.84, cz + 0.292); root.add(cm);
  const mpr = new Print(0.9, 1.4, 500); mpr.tag(id, 0.45, 1.3, 0.4, 0.07); mpr.text('MECANISMO DE MOLA', 0.45, 1.22, 0.025); mpr.text('I/O       MOLA', 0.45, 1.03, 0.02, { color: '#222' }); mpr.text('CONTADOR', 0.45, 0.82, 0.016); const mpm = mpr.mesh(); mpm.position.set(mx, 1.75, cz + 0.296); root.add(mpm);
  colBox(c, mx, cz, 0.5, 0.35);
  plaqueta(c, id, cx + PH[1], 1.85, cz + 0.15, 0); plaqueta(c, id, cx + PH[1], 1.85, cz - 0.15, Math.PI);
  // caixa de comando local do bay
  if (o.cabine && o.bay) cabs[o.bay] = bayCabinet(c, o.bay, cx - 5.9, cz);
  // TCs
  if (o.tc) {
    const zt = cz + 2.6;
    for (const dx of PH) { const x = cx + dx; column(c, x, zt, 2.3); B.rbox(0.5, 0.42, 0.5, 0.02, M.galv, x, 2.53, zt); B.box(0.24, 0.22, 0.14, M.ral7035, x, 2.48, zt + 0.32); insul(c, x, 2.74, zt, 1.5, { core: 0.12, big: 0.19, small: 0.16 });
      B.cyl(0.27, 0.32, M.alu, x, 4.4, zt, 0, 0, 20); B.sphere(0.27, M.alu, x, 4.56, zt, 16); B.box(0.12, 0.12, 0.02, M.glass, x, 4.38, zt + 0.27); pad(c, x, 4.42, zt - 0.3, -1); pad(c, x, 4.42, zt + 0.3, 1);
      B.wire(new Vector3(x, 6.02, cz + 0.36), new Vector3(x, 4.42, zt - 0.36), 0.025, M.conductor, 0.25, 12); termS[PH.indexOf(dx)] = new Vector3(x, 4.42, zt + 0.36); }
    plaqueta(c, o.tc, cx + PH[1], 1.8, zt + 0.15, 0); B.rbox(0.6, 0.8, 0.35, 0.015, M.ral7035, cx + PH[2] + 0.75, 1.1, zt); colBox(c, cx + PH[2] + 0.75, zt, 0.35, 0.25);
    inter(c, { id: 'eq:' + o.tc, kind: 'eq', label: `Transformadores de corrente ${o.tc}`, verb: 'Inspecionar', box: [7.2, 2.2, 1.0], at: [cx, 3.6, zt], eq: o.tc, view: { pos: new Vector3(cx + 6, 3.4, zt + 5), look: new Vector3(cx, 3.8, zt) } });
  }
  const vpos = new Vector3(cx + 5.5, 3.6, cz + 5.5), vlook = new Vector3(cx, 4.4, cz);
  if (o.reserva) inter(c, { id: 'res:' + id, kind: 'reserva', label: `Disjuntor ${id} · LT-02 desligada (fora de operação)`, verb: 'Inspecionar', box: [7.4, 6.2, 1.4], at: [cx, 3.1, cz], view: { pos: vpos, look: vlook } });
  else {
    inter(c, { id: 'eq:' + id, kind: 'eq', label: `Disjuntor ${id} 145 kV SF6`, verb: 'Inspecionar', box: [7.4, 3.8, 1.2], at: [cx, 4.4, cz], eq: id, view: { pos: vpos, look: vlook } });
    inter(c, { id: 'mec:' + id, kind: 'mec', label: `Mecanismo do ${id} (indicadores, contador, densímetro)`, verb: 'Inspecionar', box: [1.0, 1.5, 0.7], at: [mx, 1.75, cz], eq: id, view: { pos: new Vector3(mx + 0.2, 2.0, cz + 1.2), look: new Vector3(mx, 1.9, cz) } });
    PH.forEach((dx, i) => part(c, 'mec:' + id, 'sf6' + i, `Densímetro SF6 do ${id} (fase ${'ABC'[i]})`, 'leitura:sf6', [sf6[i]], [0.16, 0.16, 0.1], new Vector3(cx + dx + 0.12, 2.88, cz + 0.26), { data: { ref: 'sf6:' + id } }));
    part(c, 'mec:' + id, 'cont', `Contador de operações do ${id}`, 'leitura:ops', [cm], [0.2, 0.08, 0.06], new Vector3(mx, 1.84, cz + 0.3), { data: { ref: 'ops:' + id } });
  }
  return { id, flagI, flagO, mola, moving, arcs, chambers, termN, termS, pos: 0, tgt: 0, arcT: 0, cx, cz, sf6, counter };
}
function bayCabinet(c: MCtx, bay: string, x: number, z: number): BayCab {
  const M = c.M, B = c.b, root = c.root.patio;
  B.box(0.9, 0.3, 0.75, M.concrete, x, 0.1, z); B.rbox(1.0, 1.8, 0.62, 0.02, M.ral7035, x, 1.15, z); B.box(1.1, 0.04, 0.75, M.ral7035, x, 2.08, z + 0.03);
  const door = new Group(); door.position.set(x - 0.49, 0, z + 0.315); root.add(door); dbox(0.96, 1.7, 0.02, M.ral7035, 0.48, 1.15, 0, door).castShadow = true; dbox(0.03, 0.14, 0.03, M.black, 0.88, 1.15, 0.02, door);
  // painel interno (mímico com chaves e lâmpadas por equipamento)
  const pr = new Print(0.9, 1.0, 600); pr.rect(0, 0, 0.9, 1.0, '#c9cdc8'); pr.tag('BAY ' + (bay === 'LT1' ? 'LT-01' : bay), 0.45, 0.94, 0.4, 0.07); pr.text('COMANDO LOCAL', 0.45, 0.875, 0.022);
  const rows: [string, string][] = bay === 'LT1' ? [['89-LT1-2', 'SECC. LINHA'], ['52-LT1', 'DISJUNTOR'], ['89-LT1-1', 'SECC. BARRA']] : bay === 'T1A' ? [['89-T1-1', 'SECC. BARRA'], ['52-T1', 'DISJUNTOR'], ['89-T1-2', 'SECC. TRAFO']] : [['89-T2-1', 'SECC. BARRA'], ['52-T2', 'DISJUNTOR'], ['89-T2-2', 'SECC. TRAFO']];
  rows.forEach(([eq, nm], i) => { const y = 0.72 - i * 0.2; pr.text(eq, 0.08, y + 0.05, 0.022, { align: 'left', weight: 700 }); pr.text(nm, 0.08, y + 0.02, 0.016, { align: 'left', color: '#333' }); pr.text('ABRIR', 0.56, y - 0.045, 0.014); pr.text('FECHAR', 0.7, y - 0.045, 0.014); });
  pr.text('43  LOC · REM', 0.75, 0.13, 0.018); pr.text('MOLA', 0.18, 0.1, 0.016);
  const pm = pr.mesh(); pm.position.set(x, 1.25, z + 0.29); root.add(pm); B.box(0.9, 1.0, 0.01, M.ral7032, x, 1.25, z + 0.28);
  const lamps: Record<string, Lamp> = {};
  rows.forEach(([eq], i) => { const y = 1.25 - 0.5 + 0.72 - i * 0.2; lamps[eq + ':c'] = lampAt(c, 0xff3b30, x - 0.45 + 0.4, y + 0.04, z + 0.295); lamps[eq + ':o'] = lampAt(c, 0x2fd36b, x - 0.45 + 0.46, y + 0.04, z + 0.295);
    for (const [k, bx, col] of [['open', 0.56, 0x1f8a4c], ['close', 0.7, 0xc8102e]] as const) { const m = dcyl(0.018, 0.02, new MeshStandardMaterial({ color: col, roughness: 0.35 }), x - 0.45 + bx, y, z + 0.3, root, 14); m.rotation.x = Math.PI / 2;
      part(c, 'cab:' + bay, eq + ':' + k, `${k === 'open' ? 'ABRIR' : 'FECHAR'} ${eq} (comando local)`, k === 'open' ? 'bay:open' : 'bay:close', [m], [0.05, 0.05, 0.05], new Vector3(x - 0.45 + bx, y, z + 0.31), { data: { id: eq } }); } });
  lamps['mola'] = lampAt(c, 0xe0b21e, x - 0.45 + 0.18, 1.25 - 0.5 + 0.14, z + 0.295);
  const sel = new Group(); sel.position.set(x - 0.45 + 0.75, 1.25 - 0.5 + 0.2, z + 0.3); root.add(sel); dcyl(0.03, 0.02, M.black, 0, 0, 0, sel, 18).rotation.x = Math.PI / 2; dbox(0.012, 0.05, 0.02, M.black, 0, 0, 0.012, sel); dbox(0.004, 0.035, 0.004, M.white, 0, 0.005, 0.023, sel);
  const lock = padlock(M, x - 0.45 + 0.83, 1.25 - 0.5 + 0.16, z + 0.31, root);
  colBox(c, x, z, 0.55, 0.4);
  inter(c, { id: 'cab:' + bay, kind: 'bay', label: `Caixa de comando local — bay ${bay === 'LT1' ? 'LT-01' : bay}`, verb: 'Inspecionar', box: [1.1, 1.9, 0.75], at: [x, 1.1, z], eq: bay, view: { pos: new Vector3(x, 1.4, z + 1.25), look: new Vector3(x, 1.22, z + 0.3) } });
  part(c, 'cab:' + bay, '43', 'Chave local/remoto 43 do bay', 'bay:43', [sel], [0.08, 0.08, 0.05], new Vector3(sel.position.x, sel.position.y, z + 0.32));
  part(c, 'cab:' + bay, 'loto43', 'Bloqueio (cadeado) da chave 43 do bay', 'loto:43bay', [lock], [0.06, 0.08, 0.06], new Vector3(x - 0.45 + 0.83, 1.25 - 0.5 + 0.16, z + 0.32), { tool: 'kit_bloqueio' });
  return { bay, lamps, sel, lock, door, x, z };
}
function lampAt(c: MCtx, col: number, x: number, y: number, z: number): Lamp { const m = dcyl(0.014, 0.012, glow(col, false), x, y, z, c.root.patio, 14); m.rotation.x = Math.PI / 2; return { m, col }; }

// ======================= para-raios, TPC, TP =======================
export function pararaios(c: MCtx, xs: number[], z: number, ids: string[], comLeitura = true) {
  const M = c.M, B = c.b, tops: Vector3[] = [], top = 2.6;
  xs.forEach((x, i) => { column(c, x, z, top, 0.12); for (const sx of [-1, 1]) B.cyl(0.04, 0.12, M.polymer, x + sx * 0.1, top + 0.07, z, 0, 0, 10); B.box(0.36, 0.03, 0.2, M.galv, x, top + 0.14, z);
    insul(c, x, top + 0.16, z, 1.45, { core: 0.08, big: 0.14, small: 0.12, mat: M.polymer }); B.cyl(0.11, 0.08, M.alu, x, top + 1.65, z, 0, 0, 16);
    const tor = new TorusGeometry(0.3, 0.022, 8, 28); tor.rotateX(Math.PI / 2); tor.translate(x, top + 1.5, z); B.add(tor, M.alu); for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; B.rod(new Vector3(x, top + 1.62, z), new Vector3(x + Math.cos(a) * 0.3, top + 1.5, z + Math.sin(a) * 0.3), 0.008, M.alu, 5); }
    // contador de descargas
    B.rbox(0.14, 0.18, 0.08, 0.01, M.galv, x, 1.5, z + 0.18); B.cyl(0.045, 0.01, M.white, x, 1.52, z + 0.225, Math.PI / 2, 0, 16);
    B.path([new Vector3(x + 0.1, top + 0.14, z), new Vector3(x + 0.16, 2.0, z + 0.15), new Vector3(x + 0.05, 1.6, z + 0.18)], 0.009, M.copper, 10, 5);
    tops.push(new Vector3(x, top + 1.7, z));
    if (comLeitura) inter(c, { id: 'pr:' + ids[i], kind: 'leitura', label: `Contador de descargas ${ids[i]}`, verb: 'Ler', box: [0.35, 0.4, 0.3], at: [x, 1.5, z + 0.2], eq: 'pr:' + ids[i], view: { pos: new Vector3(x, 1.55, z + 0.75), look: new Vector3(x, 1.5, z + 0.2) }, data: { ref: 'pr:' + ids[i] } });
  });
  return tops;
}
export function tpc(c: MCtx, xs: number[], z: number, trap = -1) {
  const M = c.M, B = c.b, tops: Vector3[] = [], top = 2.3;
  xs.forEach((x, i) => { column(c, x, z, top); B.rbox(0.6, 0.55, 0.55, 0.02, M.trafo, x, top + 0.3, z); B.box(0.25, 0.25, 0.14, M.trafo, x + 0.12, top + 0.15, z + 0.33);
    insul(c, x, top + 0.58, z, 1.05, { core: 0.12, big: 0.19, small: 0.16 }); B.cyl(0.17, 0.08, M.alu, x, top + 1.66, z, 0, 0, 16); insul(c, x, top + 1.7, z, 1.0, { core: 0.12, big: 0.19, small: 0.16 }); B.cyl(0.15, 0.12, M.alu, x, top + 2.76, z, 0, 0, 16);
    let tt = top + 2.85;
    if (i === trap) { B.cyl(0.42, 0.9, M.aluDull, x, tt + 0.5, z, 0, 0, 24, 0); for (const yy of [tt + 0.07, tt + 0.93]) { B.cyl(0.46, 0.04, M.alu, x, yy, z, 0, 0, 24); } for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI; B.box(0.92, 0.02, 0.03, M.alu, x, tt + 0.96, z, a); } tt += 1.0; }
    tops.push(new Vector3(x, tt + 0.02, z)); });
  return tops;
}
export function tp(c: MCtx, xs: number[], z: number) {
  const M = c.M, B = c.b, tops: Vector3[] = [], top = 2.4;
  for (const x of xs) { column(c, x, z, top); B.rbox(0.5, 0.45, 0.5, 0.02, M.trafo, x, top + 0.24, z); insul(c, x, top + 0.47, z, 1.4, { core: 0.1, big: 0.17, small: 0.14 }); B.cyl(0.13, 0.1, M.alu, x, top + 1.92, z, 0, 0, 14); tops.push(new Vector3(x, top + 1.98, z)); }
  return tops;
}

// ======================= transformador 138/13,8 kV 20/25 MVA =======================
export function transformador(c: MCtx, cx: number, cz: number, id: string, tag: string): TrfD {
  const M = c.M, B = c.b, root = c.root.patio, y0 = 0.62, H = 3.1, W = 4.4, D = 2.6, yc = y0 + H;
  // bacia de contenção com brita
  B.box(10.2, 0.08, 7.8, M.gravel, cx + 0.5, 0.0, cz + 0.1); for (const [w, d, x, z] of [[10.4, 0.2, cx + 0.5, cz - 3.8], [10.4, 0.2, cx + 0.5, cz + 4.0], [0.2, 7.8, cx - 4.6, cz + 0.1], [0.2, 7.8, cx + 5.6, cz + 0.1]] as const) B.box(w, 0.3, d, M.concrete, x, 0.1, z);
  B.box(W + 0.6, 0.45, D + 0.4, M.concrete, cx, 0.2, cz); trilhos(c, cx, cz);
  for (const sx of [-0.75, 0.75]) for (const sz of [-0.95, 0.95]) B.cyl(0.13, 0.1, M.black, cx + sx, 0.56, cz + sz, Math.PI / 2, Math.PI / 2, 16);
  // tanque com reforços e flange da tampa
  B.box(W + 0.1, 0.08, D + 0.1, M.trafoDark, cx, y0 + 0.04, cz); B.rbox(W, H, D, 0.06, M.trafo, cx, y0 + H / 2, cz);
  for (let i = -2; i <= 2; i++) { B.box(0.1, H - 0.1, 0.08, M.trafo, cx + i * 0.95, y0 + H / 2, cz + D / 2 + 0.03); B.box(0.1, H - 0.1, 0.08, M.trafo, cx + i * 0.95, y0 + H / 2, cz - D / 2 - 0.03); }
  B.box(W + 0.18, 0.1, D + 0.18, M.trafoDark, cx, yc + 0.02, cz); B.box(W, 0.06, D, M.trafo, cx, yc + 0.1, cz);
  for (let i = 0; i < 22; i++) { const t = i / 22; const px = cx - W / 2 + t * W; B.cyl(0.012, 0.02, M.galv, px, yc + 0.08, cz + D / 2 + 0.07, 0, 0, 6); B.cyl(0.012, 0.02, M.galv, px, yc + 0.08, cz - D / 2 - 0.07, 0, 0, 6); }
  // buchas AT (norte) com torretas e chifres
  const hv: Vector3[] = [];
  for (const dx of [-1.25, 0, 1.25]) { B.cyl(0.25, 0.32, M.trafo, cx + dx, yc + 0.27, cz - 0.75, 0, 0, 18); insul(c, cx + dx, yc + 0.43, cz - 0.75, 2.0, { core: 0.12, big: 0.2, small: 0.17 }); B.cyl(0.1, 0.18, M.alu, cx + dx, yc + 2.52, cz - 0.75, 0, 0, 14); pad(c, cx + dx, yc + 2.6, cz - 0.85, -1); hv.push(new Vector3(cx + dx, yc + 2.62, cz - 0.95));
    B.rod(new Vector3(cx + dx + 0.12, yc + 0.5, cz - 0.75), new Vector3(cx + dx + 0.3, yc + 0.6, cz - 0.75), 0.01, M.aluDull, 5); B.rod(new Vector3(cx + dx + 0.12, yc + 2.35, cz - 0.75), new Vector3(cx + dx + 0.3, yc + 2.25, cz - 0.75), 0.01, M.aluDull, 5);
    // para-raios do trafo (suporte no tanque)
    B.box(0.5, 0.08, 0.8, M.galv, cx + dx, yc - 0.2, cz - D / 2 - 0.4); insul(c, cx + dx, yc - 0.16, cz - D / 2 - 0.6, 1.35, { core: 0.07, big: 0.12, small: 0.1, mat: M.polymer });
    B.wire(new Vector3(cx + dx, yc + 1.2, cz - D / 2 - 0.6), new Vector3(cx + dx, yc + 2.5, cz - 0.9), 0.02, M.conductor, 0.12, 10);
    B.path([new Vector3(cx + dx + 0.08, yc - 0.15, cz - D / 2 - 0.6), new Vector3(cx + dx + 0.1, 1.6, cz - D / 2 - 0.7), new Vector3(cx + dx + 0.12, 0.05, cz - D / 2 - 0.9)], 0.009, M.copper, 10, 5); }
  // buchas MT na caixa de cabos (sul)
  B.rbox(2.4, 1.0, 0.65, 0.04, M.trafo, cx, yc - 0.45, cz + D / 2 + 0.33); for (const dx of [-0.6, 0, 0.6]) B.cyl(0.055, yc - 0.95, M.cable, cx + dx, (yc - 0.95) / 2, cz + D / 2 + 0.5, 0, 0, 10);
  B.cyl(0.07, 0.45, M.porcelain, cx + 1.4, yc + 0.32, cz + 0.9, 0, 0, 12); B.box(0.04, yc + 0.3, 0.04, M.copper, cx + 1.6, (yc + 0.3) / 2, cz + D / 2 + 0.05); // neutro aterrado
  plate(c, 'aviso', ['CABOS 13,8 kV', 'ENERGIZADOS'], 0.5, 0.3, cx, yc - 0.45, cz + D / 2 + 0.66, 0);
  // conservador, Buchholz, secador de sílica, alívio de pressão
  const kz = cz + 0.35, ky = yc + 1.75; B.cylX(0.5, 2.8, M.trafo, cx - 0.6, ky, kz, 22); B.sphere(0.5, M.trafo, cx - 2.0, ky, kz, 16); B.sphere(0.5, M.trafo, cx + 0.8, ky, kz, 16);
  for (const dx of [-1.6, 0.4]) { B.box(0.12, ky - yc - 0.2, 0.12, M.trafoDark, cx + dx, yc + (ky - yc) / 2, kz); B.box(0.5, 0.06, 0.12, M.trafoDark, cx + dx, ky - 0.42, kz); }
  B.cyl(0.13, 0.04, M.white, cx + 0.86, ky, kz + 0.32, Math.PI / 2, 0, 16); B.cyl(0.14, 0.03, M.black, cx + 0.86, ky, kz + 0.3, Math.PI / 2, 0, 16); // indicador de nível magnético
  B.rod(new Vector3(cx - 0.1, ky - 0.5, kz), new Vector3(cx + 0.3, yc + 0.12, kz - 0.05), 0.05, M.trafoDark, 10);
  B.rbox(0.28, 0.24, 0.22, 0.02, M.trafoDark, cx + 0.12, ky - 0.85, kz - 0.02);
  const buch = dbox(0.08, 0.06, 0.01, new MeshStandardMaterial({ color: 0xfff2b0, roughness: 0.2, transparent: true, opacity: 0.85 }), cx + 0.12, ky - 0.83, kz + 0.095, root);
  B.rod(new Vector3(cx - 1.9, ky - 0.45, kz), new Vector3(cx - 1.95, 1.7, kz + 0.2), 0.02, M.trafoDark, 8); B.cyl(0.09, 0.42, M.glass, cx - 1.95, 1.45, kz + 0.2, 0, 0, 14);
  const breather = dcyl(0.075, 0.38, M.silica, cx - 1.95, 1.45, kz + 0.2, root, 14);
  B.cyl(0.13, 0.22, M.trafoDark, cx + 1.4, yc + 0.22, cz - 0.1, 0, 0, 14); B.cyl(0.2, 0.04, M.trafoDark, cx + 1.4, yc + 0.36, cz - 0.1, 0, 0, 16);
  // radiadores (leste) com coletores e ventiladores
  const rx0 = cx + W / 2 + 0.2; for (const yy of [y0 + 0.5, y0 + H - 0.35]) B.cylX(0.07, 0.5, M.trafoDark, rx0 + 0.15, yy, cz, 10);
  for (const bank of [-0.7, 0.7]) { B.box(0.15, 0.15, 1.2, M.trafoDark, rx0 + 0.45, y0 + H - 0.35, cz + bank); B.box(0.15, 0.15, 1.2, M.trafoDark, rx0 + 0.45, y0 + 0.5, cz + bank);
    for (let i = 0; i < 9; i++) B.box(1.25, H - 0.75, 0.05, M.trafo, rx0 + 1.0, y0 + H / 2 + 0.08, cz + bank - 0.52 + i * 0.13); }
  const fans: Group[] = [];
  for (let i = 0; i < 4; i++) { const fx = rx0 + 1.0, fz = cz + (i < 2 ? -0.7 : 0.7) + (i % 2 ? 0.0 : 0), fy = i % 2 ? 0.55 : 0.55; const gx = fx + (i % 2 ? 0.35 : -0.35);
    B.cyl(0.36, 0.14, M.trafoDark, gx, fy, fz, 0, 0, 20); const g = new Group(); g.position.set(gx, fy + 0.04, fz); root.add(g);
    for (let b = 0; b < 5; b++) { const bl = dbox(0.3, 0.012, 0.09, M.aluDull, 0.15, 0, 0, new Group()); const piv = new Group(); piv.rotation.y = (b / 5) * Math.PI * 2; bl.rotation.x = 0.35; piv.add(bl); g.add(piv); }
    const grill = new TorusGeometry(0.34, 0.006, 4, 24); grill.rotateX(Math.PI / 2); grill.translate(gx, fy + 0.08, fz); B.add(grill, M.black); g.userData.grupo = i < 2 ? 1 : 2; fans.push(g); }
  // OLTC (oeste) com acionamento motorizado
  B.rbox(0.8, 2.4, 1.3, 0.04, M.trafo, cx - W / 2 - 0.42, y0 + 1.5, cz - 0.3); B.rbox(0.5, 0.9, 0.38, 0.02, M.ral7035, cx - W / 2 - 0.62, 1.45, cz + 0.7); B.rod(new Vector3(cx - W / 2 - 0.62, 1.9, cz + 0.7), new Vector3(cx - W / 2 - 0.62, yc - 0.3, cz + 0.7), 0.02, M.galv, 8);
  // painel local (marshalling kiosk) a oeste
  const px = cx - 5.0; B.box(0.9, 0.25, 0.75, M.concrete, px, 0.1, cz); B.rbox(1.0, 1.9, 0.6, 0.02, M.ral7035, px, 1.2, cz); B.box(1.1, 0.04, 0.72, M.ral7035, px, 2.17, cz + 0.03);
  const pnl = new Print(0.9, 1.1, 560); pnl.rect(0, 0, 0.9, 1.1, '#c9cdc8'); pnl.tag('PAINEL LOCAL ' + tag, 0.45, 1.04, 0.6, 0.07);
  pnl.circle(0.22, 0.82, 0.11, '#f4f2ec', '#222', 0.008); pnl.circle(0.52, 0.82, 0.11, '#f4f2ec', '#222', 0.008); pnl.circle(0.79, 0.86, 0.07, '#f4f2ec', '#222', 0.006); pnl.text('ÓLEO °C', 0.22, 0.68, 0.02); pnl.text('ENROL. °C', 0.52, 0.68, 0.02); pnl.text('NÍVEL', 0.79, 0.76, 0.018);
  for (let k = 0; k <= 10; k++) { const a = Math.PI * (1.25 - (k / 10) * 1.5); for (const [cx2, r2] of [[0.22, 0.11], [0.52, 0.11]] as const) pnl.line([[cx2 + Math.cos(a) * r2 * 0.82, 0.82 + Math.sin(a) * r2 * 0.82], [cx2 + Math.cos(a) * r2 * 0.95, 0.82 + Math.sin(a) * r2 * 0.95]], '#222', 0.004); }
  pnl.text('OLTC (90)', 0.25, 0.54, 0.02); pnl.rect(0.1, 0.38, 0.3, 0.12, '#1b1d20'); pnl.text('▲ SUBIR   ▼ BAIXAR', 0.25, 0.32, 0.016); pnl.text('AUTO · MAN', 0.62, 0.48, 0.018); pnl.text('VENTILAÇÃO  AUTO · MAN', 0.65, 0.3, 0.016);
  ['G1', 'G2', '63', '26'].forEach((s, i) => pnl.text(s, 0.12 + i * 0.12, 0.08, 0.016));
  const pm2 = pnl.mesh(); pm2.position.set(px, 1.3, cz + 0.305); root.add(pm2);
  const needle = (x2: number, y2: number, r2: number) => { const g = new Group(); g.position.set(px - 0.45 + x2, 1.3 - 0.55 + y2, cz + 0.31); root.add(g); dbox(0.004, r2, 0.002, M.red, 0, r2 / 2, 0, g); return g; };
  const oil = needle(0.22, 0.82, 0.085), wnd = needle(0.52, 0.82, 0.085), lvl = needle(0.79, 0.86, 0.055);
  const lcd = canvasTex(160, 64); const lm = new Mesh(new PlaneGeometry(0.28, 0.11), new MeshStandardMaterial({ map: lcd.t, emissiveMap: lcd.t, emissive: 0xffffff, emissiveIntensity: 0.9 })); lm.position.set(px - 0.45 + 0.25, 1.3 - 0.55 + 0.44, cz + 0.307); root.add(lm);
  const lamps: Record<string, Lamp> = {}; ['G1', 'G2', '63', '26'].forEach((s, i) => { const m = dcyl(0.014, 0.012, glow(i < 2 ? 0x2fd36b : 0xffb02e, false), px - 0.45 + 0.12 + i * 0.12, 1.3 - 0.55 + 0.13, cz + 0.31, root, 14); m.rotation.x = Math.PI / 2; lamps[s] = { m, col: i < 2 ? 0x2fd36b : 0xffb02e }; });
  const lockT = padlock(M, px - 0.45 + 0.42, 1.3 - 0.55 + 0.44, cz + 0.32, root);
  colBox(c, px, cz, 0.55, 0.4);
  plaqueta(c, tag, cx + 0.8, y0 + H - 0.3, cz - D / 2 - 0.09, Math.PI); plaqueta(c, tag, cx - 0.8, y0 + H - 0.3, cz + D / 2 + 0.09, 0);
  const np = new Print(0.6, 0.4, 600); np.rect(0, 0, 0.6, 0.4, '#d9dcd9', '#555', 0.004); np.text('TRANSFORMADOR DE POTÊNCIA', 0.3, 0.36, 0.024); [`${tag} (${id})`, '138 / 13,8 kV · 20/25 MVA ONAN/ONAF', 'Dyn1 · Z = 9 % · 60 Hz', 'OLTC ±8 × 1,25 %', 'Óleo mineral 14 000 L', 'NBR 5356 · Nº série 2019-0' + id.slice(1)].forEach((l, i) => np.text(l, 0.04, 0.3 - i * 0.045, 0.022, { align: 'left', weight: 500 }));
  const npm = np.mesh(0.3); npm.position.set(cx - 1.2, y0 + 1.2, cz + D / 2 + 0.075); root.add(npm);
  c.col.push([cx - 4.7, cz - 3.9, cx + 5.7, cz + 4.1]);
  inter(c, { id: 'trf:' + id, kind: 'trafoBody', label: `Transformador ${tag} (${id}) 138/13,8 kV 20/25 MVA`, verb: 'Inspecionar', box: [W + 0.4, H + 3.0, D + 0.6], at: [cx, y0 + H / 2 + 1.0, cz], eq: id, view: { pos: new Vector3(cx - 2.5, 3.0, cz + 7.5), look: new Vector3(cx + 0.5, 3.0, cz) } });
  inter(c, { id: 'trp:' + id, kind: 'trafo', label: `Painel local do ${tag}: temperaturas, OLTC, ventilação`, verb: 'Inspecionar', box: [1.1, 2.0, 0.75], at: [px, 1.2, cz], eq: id, view: { pos: new Vector3(px, 1.45, cz + 1.25), look: new Vector3(px, 1.3, cz + 0.3) } });
  const P3 = (a: number, b: number) => new Vector3(px - 0.45 + a, 1.3 - 0.55 + b, cz + 0.32);
  part(c, 'trp:' + id, 'tapUp', 'TAP ▲ (subir) — comando local', 'tap:+1', [], [0.08, 0.05, 0.05], P3(0.18, 0.32), { data: { id } });
  part(c, 'trp:' + id, 'tapDn', 'TAP ▼ (baixar) — comando local', 'tap:-1', [], [0.08, 0.05, 0.05], P3(0.33, 0.32), { data: { id } });
  part(c, 'trp:' + id, 'oltc', 'Seletor OLTC automático/manual', 'oltc', [], [0.12, 0.08, 0.05], P3(0.62, 0.48), { data: { id } });
  part(c, 'trp:' + id, 'vent', 'Seletor da ventilação forçada (auto/manual)', 'vent', [], [0.2, 0.06, 0.05], P3(0.65, 0.3), { data: { id } });
  part(c, 'trp:' + id, 'loto', 'Bloqueio (cadeado) do comando do OLTC', 'loto:oltc', [lockT], [0.06, 0.08, 0.06], P3(0.42, 0.44), { tool: 'kit_bloqueio', data: { id: '90-' + id } });
  part(c, 'trf:' + id, 'buch', 'Relé Buchholz (63) — visor de gás', 'buch', [buch], [0.3, 0.3, 0.3], new Vector3(cx + 0.12, ky - 0.85, kz + 0.1), { data: { id } });
  part(c, 'trf:' + id, 'secador', 'Secador de ar (sílica gel)', 'silica', [breather], [0.25, 0.5, 0.25], new Vector3(cx - 1.95, 1.45, kz + 0.2), { data: { id } });
  return { id, fans, hv, center: new Vector3(cx, 2.5, cz), vent: 0, panel: { oil, wnd, lvl, lcd, lamps, lock: lockT }, buch, breather };
}

// ======================= estruturas: pórtico, torre, barramento =======================
export function lattice(c: MCtx, x: number, z: number, h: number, w: number, wTop = w, legS = 0.1) {
  const M = c.M, B = c.b, legs: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const P = (sx: number, sz: number, y: number) => { const ww = w + ((wTop - w) * y) / h; return new Vector3(x + (sx * ww) / 2, y, z + (sz * ww) / 2); };
  for (const [sx, sz] of legs) B.angle(P(sx, sz, 0.3), P(sx, sz, h), legS, M.galv);
  const step = Math.max(1.0, w * 1.05); let flip = false;
  for (let y = 0.3; y < h - 0.05; y += step) { const y2 = Math.min(h, y + step); flip = !flip;
    for (let k = 0; k < 4; k++) { const [ax, az] = legs[k], [bx, bz] = legs[(k + 1) % 4]; B.angle(P(ax, az, y2), P(bx, bz, y2), legS * 0.6, M.galv); B.angle(flip ? P(ax, az, y) : P(bx, bz, y), flip ? P(bx, bz, y2) : P(ax, az, y2), legS * 0.5, M.galv); } }
  B.box(w + 0.6, 0.5, w + 0.6, M.concrete, x, 0.2, z); colBox(c, x, z, w / 2 + 0.35);
}
export function truss(c: MCtx, x1: number, x2: number, y: number, z: number, hgt = 1.0, dep = 1.0) {
  const M = c.M, B = c.b; const ch = (dy: number, dz: number) => B.angle(new Vector3(x1, y + dy, z + dz), new Vector3(x2, y + dy, z + dz), 0.09, M.galv);
  ch(-hgt / 2, -dep / 2); ch(-hgt / 2, dep / 2); ch(hgt / 2, -dep / 2); ch(hgt / 2, dep / 2);
  const n = Math.ceil((x2 - x1) / 1.1);
  for (let i = 0; i < n; i++) { const a = x1 + ((x2 - x1) * i) / n, b = x1 + ((x2 - x1) * (i + 1)) / n; const up = i % 2 === 0;
    for (const dz of [-dep / 2, dep / 2]) B.angle(new Vector3(a, y + (up ? -hgt : hgt) / 2, z + dz), new Vector3(b, y + (up ? hgt : -hgt) / 2, z + dz), 0.05, M.galv);
    for (const dy of [-hgt / 2, hgt / 2]) B.angle(new Vector3(b, y + dy, z - dep / 2), new Vector3(b, y + dy, z + dep / 2), 0.05, M.galv);
    B.angle(new Vector3(a, y - hgt / 2, z - dep / 2), new Vector3(b, y - hgt / 2, z + dep / 2), 0.04, M.galv); }
}
/** Cadeia de isoladores de vidro (disco) entre dois pontos. */
export function glassString(c: MCtx, a: Vector3, b: Vector3, n = 10) {
  const M = c.M, B = c.b, dir = b.clone().sub(a), len = dir.length(), u = dir.clone().normalize();
  const prof = [new Vector2(0.0, 0.0), new Vector2(0.03, 0.0), new Vector2(0.125, 0.035), new Vector2(0.13, 0.05), new Vector2(0.06, 0.07), new Vector2(0.03, 0.11), new Vector2(0.0, 0.11)];
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), u), m = new Matrix4();
  for (let i = 0; i < n; i++) { const g = new LatheGeometry(prof, 16); const p = a.clone().add(u.clone().multiplyScalar(0.12 + ((len - 0.24) * i) / (n - 1) - 0.05)); m.compose(p, q, new Vector3(1, 1, 1)); g.applyMatrix4(m); B.add(g, M.glassGreen as any); }
  B.rod(a, b, 0.012, M.galv, 6);
}

// ======================= estruturas de concreto (pórticos), torre, muro, trilhos =======================
/** Coluna de concreto pré-moldada vazada (dois montantes + travessas) com haste para-raios no topo. alongZ: face vazada voltada para X. */
export function colunaConcreto(c: MCtx, x: number, z: number, h: number, o: { alongZ?: boolean; w?: number; d?: number; haste?: number } = {}) {
  const M = c.M, B = c.b, w = o.w ?? 0.6, d = o.d ?? 0.4, f = 0.15, az = !!o.alongZ;
  const bx = (sx: number, sy: number, sz: number, px: number, py: number, pz: number, m = M.concreteLight) => (az ? B.box(sz, sy, sx, m, x + pz, py, z + px) : B.box(sx, sy, sz, m, x + px, py, z + pz));
  B.box(w + 0.6, 0.35, d + 0.6, M.concrete, x, 0.1, z);
  for (const s of [-1, 1]) bx(f, h, d, s * (w / 2 - f / 2), h / 2, 0);
  for (let y = 0.9; y < h - 0.6; y += 1.25) bx(w - 2 * f, 0.18, d * 0.75, 0, y, 0);
  bx(w, 0.45, d, 0, h - 0.225, 0); bx(w + 0.06, 0.06, d + 0.06, 0, h - 0.48, 0, M.concrete);
  const ha = o.haste ?? 2.0; B.box(0.22, 0.04, 0.22, M.galv, x, h + 0.02, z); B.cyl(0.02, ha, M.galv, x, h + ha / 2, z, 0, 0, 6); B.sphere(0.035, M.galv, x, h + ha, z, 8);
  B.path([new Vector3(x + 0.12, h, z + 0.12), new Vector3(x + w / 2 + 0.02, h * 0.5, z + d / 2 + 0.02), new Vector3(x + w / 2 + 0.05, 0.05, z + d / 2 + 0.1)], 0.007, M.copper, 12, 4);
  colBox(c, x, z, (az ? d : w) / 2 + 0.3, (az ? w : d) / 2 + 0.3);
  return new Vector3(x, h - 0.05, z);
}
/** Viga de concreto entre duas colunas (eixo X ou Z), base em y. */
export function vigaConcreto(c: MCtx, x1: number, z1: number, x2: number, z2: number, y: number, hh = 0.7, ww = 0.4) {
  const B = c.b, M = c.M, L = Math.hypot(x2 - x1, z2 - z1), mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1);
  if (alongX) { B.box(L, hh, ww, M.concreteLight, mx, y + hh / 2, mz); B.box(L, 0.05, ww + 0.06, M.concrete, mx, y + hh - 0.02, mz); }
  else { B.box(ww, hh, L, M.concreteLight, mx, y + hh / 2, mz); B.box(ww + 0.06, 0.05, L, M.concrete, mx, y + hh - 0.02, mz); }
}
/** Cabo para-raios (cordoalha de aço) entre topos de estruturas. */
export function caboGuarda(c: MCtx, a: Vector3, b: Vector3, sag = 0.6) { c.b.wire(a, b, 0.007, c.M.galv, sag, Math.max(10, Math.round(a.distanceTo(b) / 1.6)), 4); }
/** Torre treliçada quadrada simples (circuito duplo vertical). Retorna pontas das cadeias (oeste/leste) e picos do cabo para-raios. */
export function torre(c: MCtx, tx: number, tz: number, H = 30.5) {
  const M = c.M, B = c.b, hb = H - 3.0;
  lattice(c, tx, tz, hb, 2.6, 1.3, 0.12);
  const top = 0.65; for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.angle(new Vector3(tx + sx * top, hb, tz + sz * top), new Vector3(tx + sx * 0.35, H, tz + sz * 0.2), 0.08, M.galv);
  B.box(3.6, 0.12, 0.5, M.galv, tx, H, tz);
  const peaks = [new Vector3(tx - 1.7, H + 0.05, tz), new Vector3(tx + 1.7, H + 0.05, tz)];
  const oeste: Vector3[] = [], leste: Vector3[] = [];
  [[hb - 6.6, 4.2], [hb - 3.3, 5.2], [hb, 4.2]].forEach(([y, L]) => {
    for (const s of [-1, 1]) { for (const dz of [-0.45, 0.45]) { B.angle(new Vector3(tx + s * 0.62, y, tz + dz), new Vector3(tx + s * L, y, tz), 0.08, M.galv); B.angle(new Vector3(tx + s * 0.62, y - 1.3, tz + dz), new Vector3(tx + s * L, y, tz), 0.07, M.galv); }
      const a = new Vector3(tx + s * (L - 0.1), y - 0.08, tz), e = new Vector3(tx + s * (L - 0.1), y - 1.7, tz); glassString(c, a, e, 9); (s < 0 ? oeste : leste).push(e); }
  });
  return { oeste: oeste.reverse(), leste, peaks };
}
/** Muro corta-fogo: pilares de concreto + blocos, viga de coroamento. Eixo ao longo de Z. */
export function muroCortaFogo(c: MCtx, x: number, z: number, L = 5.5, H = 5.5) {
  const M = c.M, B = c.b, t = 0.25;
  B.box(t + 0.6, 0.35, L + 0.6, M.concrete, x, 0.1, z); B.box(t, H - 0.35, L - 0.2, M.wallOut, x, (H - 0.35) / 2, z);
  for (const zz of [z - L / 2 + 0.15, z, z + L / 2 - 0.15]) B.box(t + 0.12, H, 0.32, M.concreteLight, x, H / 2, zz);
  B.box(t + 0.12, 0.32, L + 0.04, M.concreteLight, x, H - 0.16, z);
  colBox(c, x, z, (t + 0.3) / 2, L / 2 + 0.1);
}
/** Trilhos do transformador (N-S) sobre vigas de concreto, saindo da bacia para a área de manobra. */
export function trilhos(c: MCtx, cx: number, cz: number, ate = 11.5) {
  const M = c.M, B = c.b, z0 = cz - 1.6, z1 = cz + ate, L = z1 - z0, zm = (z0 + z1) / 2;
  for (const s of [-0.75, 0.75]) { B.box(0.45, 0.42, L - 1.6 * 2, M.concrete, cx + s, 0.2, zm + 1.6); B.box(0.07, 0.08, L, M.steelDark, cx + s, 0.47, zm); B.box(0.14, 0.02, L, M.steelDark, cx + s, 0.43, zm); }
}
/** Base reservada para transformador futuro: bacia, base e trilhos, sem equipamento. */
export function trafoReserva(c: MCtx, cx: number, cz: number, tag: string) {
  const M = c.M, B = c.b;
  B.box(10.2, 0.08, 7.8, M.gravel, cx + 0.5, 0.0, cz + 0.1); for (const [w, d, x, z] of [[10.4, 0.2, cx + 0.5, cz - 3.8], [10.4, 0.2, cx + 0.5, cz + 4.0], [0.2, 7.8, cx - 4.6, cz + 0.1], [0.2, 7.8, cx + 5.6, cz + 0.1]] as const) B.box(w, 0.3, d, M.concrete, x, 0.1, z);
  B.box(5.0, 0.45, 3.0, M.concrete, cx, 0.2, cz); trilhos(c, cx, cz);
  plate(c, 'placa', ['ÁREA RESERVADA', tag + ' (FUTURO)'], 1.6, 0.5, cx, 1.2, cz + 1.52, 0, { bg: '#5e666d', fg: '#f4f2ec' });
  B.box(0.08, 1.0, 0.08, M.galv, cx - 0.7, 0.45, cz + 1.5); B.box(0.08, 1.0, 0.08, M.galv, cx + 0.7, 0.45, cz + 1.5);
}

// ======================= cerca, portões, iluminação, entorno =======================
export interface GateD { id: string; leaves: Group[]; open: number; tgt: number; col: [number, number, number, number] }
/** Cerca de tela com postes de concreto (braço 45° e 3 fios farpados). A parede sul da casa fecha a divisa; portões de 6 m a leste. */
export function cerca(c: MCtx, rect: [number, number, number, number], casa: [number, number, number], portoes: { id: string; zM: [number, number] }[], H: number, step: number): GateD[] {
  const M = c.M, B = c.b, [x1, z1, x2, z2] = rect, [ca, cb, cz] = casa;
  const panel = (ax: number, az: number, bx: number, bz: number) => { const L = Math.hypot(bx - ax, bz - az); if (L < 0.2) return; const horiz = Math.abs(az - bz) < 1e-6;
    const t = (M.fence.map as any).clone(); t.needsUpdate = true; t.repeat.set(L / 0.12, (H - 0.25) / 0.12); const mat = M.fence.clone(); mat.map = t;
    const m = new Mesh(new PlaneGeometry(L, H - 0.25), mat); m.position.set((ax + bx) / 2, 0.25 + (H - 0.25) / 2, (az + bz) / 2); m.rotation.y = horiz ? 0 : Math.PI / 2; m.castShadow = false; m.receiveShadow = false; c.root.externo.add(m);
    B.box(horiz ? L : 0.15, 0.25, horiz ? 0.15 : L, M.concrete, (ax + bx) / 2, 0.12, (az + bz) / 2);
    c.col.push([Math.min(ax, bx) - 0.12, Math.min(az, bz) - 0.12, Math.max(ax, bx) + 0.12, Math.max(az, bz) + 0.12]); };
  const posts = (ax: number, az: number, bx: number, bz: number, out: [number, number], brace = [true, true]) => {
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / step)), ux = (bx - ax) / L, uz = (bz - az) / L;
    for (let i = 0; i <= n; i++) { const x = ax + ((bx - ax) * i) / n, z = az + ((bz - az) * i) / n;
      B.box(0.12, H + 0.05, 0.12, M.concreteLight, x, (H + 0.05) / 2, z);
      const ex = x + out[0] * 0.32, ez = z + out[1] * 0.32; B.rod(new Vector3(x, H, z), new Vector3(ex, H + 0.32, ez), 0.045, M.concreteLight, 4); }
    for (const k of [0.12, 0.22, 0.32]) B.rod(new Vector3(ax + out[0] * k, H + k, az + out[1] * k), new Vector3(bx + out[0] * k, H + k, bz + out[1] * k), 0.004, M.galv, 3);
    B.rod(new Vector3(ax, H - 0.05, az), new Vector3(bx, H - 0.05, bz), 0.018, M.galv, 5);
    if (brace[0]) B.rod(new Vector3(ax, H * 0.7, az), new Vector3(ax + ux * 1.3, 0.05, az + uz * 1.3), 0.05, M.concreteLight, 4);
    if (brace[1]) B.rod(new Vector3(bx, H * 0.7, bz), new Vector3(bx - ux * 1.3, 0.05, bz - uz * 1.3), 0.05, M.concreteLight, 4);
    panel(ax, az, bx, bz); };
  B.zone = 'externo'; c.zone = 'externo';
  posts(x1, z1, x2, z1, [0, -1]); posts(x1, z1, x1, z2, [-1, 0]); posts(x1, z2, ca, z2, [0, 1]); posts(ca, z2, ca, cz, [1, 0], [false, false]); posts(cb, cz, cb, z2, [-1, 0], [false, false]); posts(cb, z2, x2, z2, [0, 1]);
  const gs = [...portoes].sort((a, b) => a.zM[0] - b.zM[0]); let zc = z1;
  for (const g of gs) { posts(x2, zc, x2, g.zM[0], [1, 0]); zc = g.zM[1]; } posts(x2, zc, x2, z2, [1, 0]);
  for (let x = x1 + step * 1.5; x < x2 - 1; x += step * 5) plate(c, 'perigo', ['ALTA TENSÃO', 'NÃO ULTRAPASSE'], 0.5, 0.33, x, 1.5, z1 - 0.03, Math.PI);
  for (let z = z1 + step * 2; z < z2 - 1; z += step * 5) { plate(c, 'perigo', ['ALTA TENSÃO'], 0.5, 0.33, x1 - 0.03, 1.5, z, -Math.PI / 2); if (!gs.some((g) => z > g.zM[0] - 1 && z < g.zM[1] + 1)) plate(c, 'perigo', ['ALTA TENSÃO'], 0.5, 0.33, x2 + 0.03, 1.5, z, Math.PI / 2); }
  const out: GateD[] = [];
  for (const g of gs) { const [za, zb] = g.zM, w = (zb - za) / 2 - 0.08, leaves: Group[] = [];
    for (const zz of [za, zb]) { B.box(0.26, H + 0.5, 0.26, M.concreteLight, x2, (H + 0.5) / 2, zz); B.box(0.5, 0.4, 0.5, M.concrete, x2, 0.1, zz); }
    for (const [hz, s] of [[za, 1], [zb, -1]] as const) { const lg = new Group(); lg.position.set(x2, 0, hz); c.root.externo.add(lg); const leaf = new Group(); leaf.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; lg.add(leaf);
      const t = (M.fence.map as any).clone(); t.needsUpdate = true; t.repeat.set(w / 0.12, 2.0 / 0.12); const mat = M.fence.clone(); mat.map = t;
      const m = new Mesh(new PlaneGeometry(w, 2.0), mat); m.position.set(w / 2, 1.2, 0); leaf.add(m);
      for (const [yy, hh] of [[0.18, 0.05], [2.22, 0.05], [1.2, 0.04]] as const) dbox(w, hh, 0.05, M.galv, w / 2, yy, 0, leaf);
      for (const xx of [0.04, w - 0.04]) dbox(0.05, 2.1, 0.05, M.galv, xx, 1.2, 0, leaf); dcyl(0.06, 0.05, M.black, w - 0.2, 0.08, 0, leaf, 10).rotation.x = Math.PI / 2;
      lg.userData.s = s; leaves.push(lg); }
    plate(c, 'perigo', ['PORTÃO ' + g.id, 'ALTA TENSÃO'], 0.6, 0.4, x2 + 0.06, 1.5, za + w / 2, Math.PI / 2);
    inter(c, { id: 'gate:' + g.id, kind: 'gate', label: `Portão ${g.id} (acesso de caminhões)`, verb: 'Abrir', box: [0.6, 2.4, zb - za], at: [x2, 1.2, (za + zb) / 2], zone: 'externo', range: 2.4 });
    out.push({ id: g.id, leaves, open: 0, tgt: 0, col: [x2 - 0.12, za, x2 + 0.12, zb] }); }
  B.zone = 'patio'; c.zone = 'patio'; return out;
}
export function poste(c: MCtx, x: number, z: number): Mesh[] {
  const M = c.M, B = c.b; B.cyl(0.07, 10, M.galv, x, 5, z, 0, 0, 12, 0, 0.045); B.box(0.5, 0.3, 0.5, M.concrete, x, 0.1, z); B.box(1.0, 0.06, 0.08, M.galv, x, 9.7, z); colBox(c, x, z, 0.28);
  const out: Mesh[] = []; for (const sx of [-0.4, 0.4]) { B.rbox(0.36, 0.08, 0.26, 0.01, M.ral7016, x + sx, 9.62, z, 0); const m = dbox(0.3, 0.012, 0.2, new MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xfff2d8, emissiveIntensity: 0.0 }), x + sx, 9.575, z, c.root.patio); m.castShadow = false; out.push(m); }
  return out;
}
/** Entorno enxuto: gramado limitado, via de caminhões a leste, calçada até a porta sul da casa. Sem árvores (desempenho). */
export function entorno(c: MCtx, rect: [number, number, number, number], casa: [number, number, number], portoes: { zM: [number, number] }[]) {
  const M = c.M, B = c.b, [x1, z1, x2, z2] = rect, mx = (x1 + x2) / 2, W = 320, D = 320;
  const grass = new Mesh(new PlaneGeometry(W, D), M.grass); grass.rotation.x = -Math.PI / 2; grass.position.set(mx + 4, -0.03, (z1 + z2) / 2 - 12); grass.receiveShadow = true; c.root.externo.add(grass);
  ((M.grass.map as any).repeat as Vector2).set(W / 14, D / 14);
  B.zone = 'externo'; B.cast = false;
  const rx = x2 + 8.5, zr0 = Math.min(...portoes.map((p) => p.zM[0])) - 4, zr1 = z2 + 10;
  B.box(6.0, 0.06, zr1 - zr0, M.asphalt, rx, 0.0, (zr0 + zr1) / 2);
  for (const p of portoes) B.box(rx - 3 - x2, 0.06, p.zM[1] - p.zM[0], M.asphalt, (x2 + rx - 3) / 2, 0.003, (p.zM[0] + p.zM[1]) / 2);
  B.box(rx + 3 - (x1 + 14), 0.06, 6, M.asphalt, (rx + 3 + x1 + 14) / 2, 0.004, zr1 - 3);
  const [ca, cb, cz] = casa, pz0 = cz, pz1 = zr1 - 6; B.box(3.0, 0.08, pz1 - pz0, M.concreteLight, (ca + cb) / 2 + 0.7 + (cb - ca) * 0.0 - 0, 0.01, (pz0 + pz1) / 2);
  B.cast = true; B.zone = 'patio'; void z1;
}
export { sign, dmesh, Group };
