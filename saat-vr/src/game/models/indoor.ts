// Casa de comando conforme a planta do usuário (31/10/2026) e as fotos do local.
// Salão único com PDMT 13,8 kV (10 cubículos), PSPC, RET-1/RET-2, QDCC/QDCA/QSA, mesa do supervisório, armário de EPI,
// sala de baterias (dividida dentro do salão) e duas salas anexas com acesso pelo pátio (TSA e almoxarifado).
// Coordenadas da planta: u = m a partir da parede do portão (leste) para oeste; v = m a partir da parede do pátio (norte)
// para o sul. Mundo: x = xE - u, z = zN + v (rotação de 180° da planta, sem espelhar).
import { Group, Mesh, Vector3, MeshStandardMaterial, PlaneGeometry, CylinderGeometry, SphereGeometry, PointLight, TorusGeometry, CapsuleGeometry, BoxGeometry, type Material } from 'three';
import { type MCtx, inter, part, colBox, dbox, dcyl, dmesh, plate, canvasTex, FONT, MONO } from '../common';
import { glow } from '../materials';
import { Print } from '../print';
import { cubiculo, lamp, padlock, type CubTag } from './cubiculo';

export interface Lamp { m: Mesh; col: number }
export interface CubD {
  bay: string; kind: string; x: number; zf: number; zc: number; W: number;
  lamps: Lamp[]; leds: Lamp[]; lcd: ReturnType<typeof canvasTex> | null; meter: ReturnType<typeof canvasTex> | null;
  sel: Group | null; lock43: Group | null; lockDoor: Group | null; door: Group | null; doorAng: number;
  truck: Group | null; tPos: number; flagI: Mesh | null; flagO: Mesh | null; mola: Mesh | null;
  earthInd: Group | null; earthHex: Mesh | null; vpis: Lamp[]; sign: Object3DLike | null; barrier: Object3DLike | null;
  tempGround: Group | null; therm: Mesh | null; rear: Group | null; rearOpen: number; shutter: Group | null; burnt: Mesh | null;
}
type Object3DLike = { visible: boolean };
export interface DoorD { id: string; g: Group; open: number; tgt: number; max: number; hinge: Vector3; w: number; axisX: boolean; dir: number; col: [number, number, number, number]; label: string }
export interface PanelD { id: string; leds: Lamp[]; lcd: ReturnType<typeof canvasTex> | null; extra?: any }
type Rect = [number, number, number, number];
export interface Indoor {
  cub: Record<string, CubD>; doors: DoorD[]; panels: Record<string, PanelD>; monitors: ReturnType<typeof canvasTex>[]; ceiling: Mesh[]; lights: PointLight[];
  qdccDoor: Group | null; beacons: Mesh[]; cabinets: Record<string, { doors: Group[]; open: number; tgt: number; items: Record<string, Group> }>; dea: Group | null;
  rt: Record<string, ReturnType<typeof canvasTex>>; qgca: { lamps: Lamp[]; needle: Group[] } | null; qdcc: ReturnType<typeof canvasTex> | null; bat: { v: ReturnType<typeof canvasTex> } | null;
  clock: ReturnType<typeof canvasTex> | null; sinotico: Mesh | null; deskSeat: { pos: Vector3; look: Vector3 }; emerg: Mesh | null;
  /** retângulo externo do prédio, sala de baterias (x1,z1,x2,z2) e pontos de partida */
  rect: Rect; batRect: Rect; spawns: Record<string, { x: number; z: number; yaw: number }>;
  /** lâmpadas do mímico do PSPC: [equipamento da simulação | null, verde (aberto), vermelha (fechado)] */
  pspc: [string | null, Lamp, Lamp][];
}

export function setLamp(l: Lamp, on: boolean) { const m = l.m.material as MeshStandardMaterial; m.color.setHex(on ? l.col : 0x34373a); m.emissive.setHex(on ? l.col : 0); m.emissiveIntensity = on ? 2.4 : 0; }

/** Parede com aberturas (portas/janelas). Eixo X (z fixo) ou Z (x fixo). */
function wall(c: MCtx, axisX: boolean, fixed: number, a0: number, a1: number, H: number, t: number, holes: { a0: number; a1: number; y0: number; y1: number }[], mat: Material, matOut?: Material, outSign = 1) {
  const B = c.b; const hs = [...holes].sort((p, q) => p.a0 - q.a0); let s = a0;
  const seg = (p: number, q: number, y0: number, y1: number) => { if (q - p < 0.005 || y1 - y0 < 0.005) return; const L = q - p, cc = (p + q) / 2, h = y1 - y0, yc = (y0 + y1) / 2;
    if (matOut) { const off = (t / 4) * outSign; if (axisX) { B.box(L, h, t / 2, mat, cc, yc, fixed - off); B.box(L, h, t / 2, matOut, cc, yc, fixed + off); } else { B.box(t / 2, h, L, mat, fixed - off, yc, cc); B.box(t / 2, h, L, matOut, fixed + off, yc, cc); } }
    else if (axisX) B.box(L, h, t, mat, cc, yc, fixed); else B.box(t, h, L, mat, fixed, yc, cc); };
  for (const o of hs) { seg(s, o.a0, 0, H); seg(o.a0, o.a1, 0, o.y0); seg(o.a0, o.a1, o.y1, H); s = o.a1; }
  seg(s, a1, 0, H);
  let s2 = a0; for (const o of hs.filter((h) => h.y0 < 1.0)) { if (o.a0 - s2 > 0.01) c.col.push(axisX ? [s2, fixed - t / 2 - 0.05, o.a0, fixed + t / 2 + 0.05] : [fixed - t / 2 - 0.05, s2, fixed + t / 2 + 0.05, o.a0]); s2 = o.a1; }
  if (a1 - s2 > 0.01) c.col.push(axisX ? [s2, fixed - t / 2 - 0.05, a1, fixed + t / 2 + 0.05] : [fixed - t / 2 - 0.05, s2, fixed + t / 2 + 0.05, a1]);
}

export function buildIndoor(c: MCtx, d: any, _P: (px: number, py: number) => [number, number]): Indoor {
  const M = c.M, B = c.b, Ly = d.plant.casa.layout, H = Ly.H as number, t = Ly.t as number, LL = Ly.L as number, WW = Ly.W as number;
  const X = (u: number) => Ly.xE - u, Z = (v: number) => Ly.zN + v;
  const xW = X(LL), xE = X(0), zN = Z(0), zS = Z(WW);
  const R: Indoor = { cub: {}, doors: [], panels: {}, monitors: [], ceiling: [], lights: [], qdccDoor: null, beacons: [], cabinets: {}, dea: null, rt: {}, qgca: null, qdcc: null, bat: null, clock: null, sinotico: null,
    deskSeat: { pos: new Vector3(), look: new Vector3() }, emerg: null, rect: [xW - t, zN - t, xE + t, zS + t], batRect: [X(Ly.bat.u[1]), Z(Ly.bat.v[0]), X(Ly.bat.u[0]), Z(Ly.bat.v[1])], spawns: {}, pspc: [] };
  /** caixa em coordenadas da planta (u0..u1, v0..v1) */
  const ubox = (u0: number, u1: number, v0: number, v1: number, y0: number, y1: number, mat: Material) => B.box(Math.abs(u1 - u0), y1 - y0, Math.abs(v1 - v0), mat, X((u0 + u1) / 2), (y0 + y1) / 2, Z((v0 + v1) / 2));
  const aV = Ly.anexoV as number, bat = Ly.bat;

  // ================= casca: piso, paredes, pilares, vigas, laje =================
  c.zone = 'shell'; B.zone = 'shell';
  ubox(0, LL, 0, WW, 0, 0.06, M.floorPaint);
  B.zone = 'externo'; B.box(LL + 2.6, 0.08, WW + 2.6, M.concreteLight, (xW + xE) / 2, 0.02, (zN + zS) / 2); B.zone = 'shell';
  const gate = Ly.portao, pS = Ly.portaS, pN = Ly.portaN, anx = Ly.anexos as any[];
  const holesN = [{ a0: X(pN.u[1]), a1: X(pN.u[0]), y0: 0, y1: pN.h }, ...anx.map((a) => ({ a0: X(a.porta[1]), a1: X(a.porta[0]), y0: 0, y1: 2.4 }))];
  const holesS = [{ a0: X(pS.u[1]), a1: X(pS.u[0]), y0: 0, y1: pS.h }, ...Ly.janelasS.map((w: number[]) => ({ a0: X(w[1]), a1: X(w[0]), y0: 2.4, y1: 3.4 }))];
  wall(c, true, zN - t / 2, xW - t, xE + t, H, t, holesN, M.wallPaint, M.wallOut, -1);
  wall(c, true, zS + t / 2, xW - t, xE + t, H, t, holesS, M.wallPaint, M.wallOut, 1);
  wall(c, false, xE + t / 2, zN, zS, H, t, [{ a0: Z(gate.v[0]), a1: Z(gate.v[1]), y0: 0, y1: gate.h }], M.wallPaint, M.wallOut, 1);
  wall(c, false, xW - t / 2, zN, zS, H, t, [{ a0: Z(bat.janelaO[0]), a1: Z(bat.janelaO[1]), y0: 2.3, y1: 3.3 }], M.wallPaint, M.wallOut, -1);
  // divisórias: sala de baterias e anexos
  const tp = 0.15;
  wall(c, false, X(bat.u[0]), Z(bat.v[0]), zS, H, tp, [{ a0: Z(bat.porta[0]), a1: Z(bat.porta[1]), y0: 0, y1: 2.1 }], M.wallPaint);
  wall(c, true, Z(aV), X(LL), X(anx[0].u[0]) + tp / 2, H, tp, [], M.wallPaint);
  wall(c, false, X(anx[0].u[0]), zN, Z(aV), H, tp, [], M.wallPaint);
  wall(c, false, X(anx[1].u[0]), zN, Z(aV), H, tp, [], M.wallPaint);
  // rodapé cinza e eletroduto horizontal (paredes externas do salão)
  B.cast = false;
  const strip = (axisX: boolean, f: number, a0: number, a1: number, gaps: [number, number][], y: number, h: number, m: Material, dep = 0.012) => {
    const pts = [a0, ...gaps.flat().sort((p, q) => p - q), a1]; for (let i = 0; i < pts.length; i += 2) { const p = pts[i], q = pts[i + 1]; if (q - p < 0.02) continue; if (axisX) B.box(q - p, h, dep, m, (p + q) / 2, y, f); else B.box(dep, h, q - p, m, f, y, (p + q) / 2); } };
  strip(true, zN + 0.006, X(anx[0].u[0]), xE, [[X(pN.u[1]), X(pN.u[0])]], 0.135, 0.15, M.baseboard);
  strip(true, zS - 0.006, X(bat.u[0]), xE, [[X(pS.u[1]), X(pS.u[0])]], 0.135, 0.15, M.baseboard);
  strip(false, xE - 0.006, zN, zS, [[Z(gate.v[0]), Z(gate.v[1])]], 0.135, 0.15, M.baseboard);
  strip(true, Z(aV) + 0.08, X(LL), X(anx[0].u[0]), [], 0.135, 0.15, M.baseboard);
  B.cast = true;
  for (const [axisX, f, a0, a1, gaps] of [[true, zS - 0.04, X(bat.u[0]) + 0.1, xE - 0.3, [[X(pS.u[1]) - 0.1, X(pS.u[0]) + 0.1]]], [true, zN + 0.04, X(anx[0].u[0]) + 0.1, xE - 0.3, []], [false, xE - 0.04, zN + 0.3, Z(gate.v[0]) - 0.15, []]] as const) {
    const pts = [a0, ...(gaps as any).flat(), a1]; for (let i = 0; i < pts.length; i += 2) { const p = pts[i], q = pts[i + 1]; if (axisX) B.cylX(0.013, q - p, M.galv, (p + q) / 2, 2.45, f as number, 8); else B.cylZ(0.013, q - p, M.galv, f as number, 2.45, (p + q) / 2, 8); } }
  // pilares de concreto aparente
  const pil = (x: number, z: number, wx: number, wz: number) => { B.box(wx, H, wz, M.formwork, x, H / 2, z); c.col.push([x - wx / 2, z - wz / 2, x + wx / 2, z + wz / 2]); };
  for (const u of Ly.pilaresS) pil(X(u), zS - 0.15, 0.4, 0.3);
  for (const u of Ly.pilaresN) pil(X(u), zN + 0.15, 0.4, 0.3);
  for (const v of Ly.pilaresL) pil(xE - 0.15, Z(v), 0.3, 0.4);
  pil(xW + 0.15, zS - 0.15, 0.3, 0.3); pil(X(bat.u[0]) - 0.2, zS - 0.15, 0.3, 0.3);
  // laje (forma de tábua) e vigas
  B.cast = true; B.box(xE - xW + 2 * t, 0.2, zS - zN + 2 * t, M.formwork, (xE + xW) / 2, H + 0.1, (zN + zS) / 2);
  for (const u of Ly.vigas) B.box(0.3, 0.45, WW, M.formwork, X(u), H - 0.225, (zN + zS) / 2);
  B.box(xE - xW, 0.45, 0.3, M.formwork, (xE + xW) / 2, H - 0.225, zN + 0.15); B.box(xE - xW, 0.45, 0.3, M.formwork, (xE + xW) / 2, H - 0.225, zS - 0.15);
  B.box(0.3, 0.45, WW, M.formwork, xE - 0.15, H - 0.225, (zN + zS) / 2); B.box(0.3, 0.45, WW - aV, M.formwork, X(bat.u[0]), H - 0.225, Z((aV + WW) / 2));

  // ================= exterior (provisório até a revisão externa) =================
  B.zone = 'externo';
  B.box(xE - xW + 2 * t + 0.2, 0.22, zS - zN + 2 * t + 0.2, M.concrete, (xE + xW) / 2, H + 0.31, (zN + zS) / 2);
  for (const [w, dd, x, z] of [[xE - xW + 0.6, 0.16, (xE + xW) / 2, zN - t - 0.05], [xE - xW + 0.6, 0.16, (xE + xW) / 2, zS + t + 0.05], [0.16, zS - zN + 2 * t, xW - t - 0.05, (zN + zS) / 2], [0.16, zS - zN + 2 * t, xE + t + 0.05, (zN + zS) / 2]] as const) { B.box(w, 0.7, dd, M.wallOut, x, H + 0.55, z); B.box(w + 0.04, 0.05, dd + 0.06, M.concreteLight, x, H + 0.92, z); }
  for (const x of [xW + 0.3, xE - 0.3]) for (const z of [zN - t - 0.08, zS + t + 0.08]) B.cyl(0.05, H + 0.3, M.aluDull, x, (H + 0.3) / 2, z, 0, 0, 10);
  B.rbox(0.8, 0.55, 0.3, 0.03, M.white, xW - t - 0.25, 0.55, Z(8.0), Math.PI / 2); B.cylX(0.18, 0.01, M.plastic, xW - t - 0.41, 0.58, Z(8.0), 20); // condensadora (split da sala de baterias)
  c.zone = 'externo';
  plate(c, 'placa', ['CASA DE COMANDO', 'SE VALE VERDE 138/13,8 kV'], 2.6, 0.55, X(4.5), 3.4, zN - t - 0.02, Math.PI, { bg: '#1d252c', fg: '#f4f2ec' });
  plate(c, 'perigo', ['EQUIPAMENTOS', 'ENERGIZADOS'], 0.6, 0.4, xE + t + 0.015, 1.7, Z(gate.v[0]) - 0.7, Math.PI / 2);
  plate(c, 'obrig', ['USO OBRIGATÓRIO', 'DE EPI'], 0.42, 0.55, X(pN.u[1]) - 0.7, 1.6, zN - t - 0.015, Math.PI, { picto: 'capacete' });
  plate(c, 'perigo', ['ALTA TENSÃO', 'TSA 13,8 kV'], 0.5, 0.33, X((anx[0].u[0] + anx[0].u[1]) / 2), 2.75, zN - t - 0.015, Math.PI);
  for (const [bx, bz] of [[X((pN.u[0] + pN.u[1]) / 2), zN - t - 0.12], [xE + t + 0.12, Z(gate.v[0]) - 0.4]] as const) R.beacons.push(dcyl(0.07, 0.14, glow(0xff2a1a, false), bx, H - 0.3, bz, c.root.externo, 16));
  c.zone = 'shell'; B.zone = 'shell';

  // ================= portas (abrem com E) =================
  const doorLeaf = (id: string, hx: number, hz: number, w: number, h: number, axisX: boolean, dir: number, max: number, label: string, mat: Material, estilo: 'portao' | 'lisa', zone: 'shell' | 'casa' = 'shell') => {
    const g = new Group(); g.position.set(hx, 0, hz); c.root[zone].add(g);
    const W2 = w - 0.02, cx0 = axisX ? (dir * w) / 2 : 0, cz0 = axisX ? 0 : (dir * w) / 2;
    const body = dbox(axisX ? W2 : 0.05, h - 0.03, axisX ? 0.05 : W2, mat, cx0, h / 2, cz0, g); body.castShadow = true; body.receiveShadow = true;
    if (estilo === 'portao') { // quadros com vincos em X (reforço) e travessas
      const n = Math.max(3, Math.round(h / 0.95)); for (let k = 1; k < n; k++) dbox(axisX ? W2 : 0.07, 0.05, axisX ? 0.07 : W2, mat, cx0, (k * h) / n, cz0, g);
      for (let k = 0; k < n; k++) { const yc = ((k + 0.5) * h) / n, ph = h / n, diag = Math.hypot(W2, ph), ang = Math.atan2(ph, W2);
        for (const s of [-1, 1]) { const m = dbox(axisX ? diag : 0.06, 0.025, axisX ? 0.06 : diag, mat, cx0, yc, cz0, g); if (axisX) m.rotation.z = s * ang; else m.rotation.x = s * ang; } }
      for (const s of [-1, 1]) { const lb = dbox(axisX ? 0.03 : 0.08, 1.3, axisX ? 0.08 : 0.03, M.steelDark, axisX ? dir * (w - 0.08) : s * 0.04, h * 0.45, axisX ? s * 0.04 : dir * (w - 0.08), g); lb.castShadow = false; }
    }
    for (const s of [-1, 1]) dbox(axisX ? 0.03 : 0.06, 0.16, axisX ? 0.06 : 0.03, M.black, axisX ? dir * (w - 0.1) : s * 0.045, 1.05, axisX ? s * 0.045 : dir * (w - 0.1), g);
    const col: [number, number, number, number] = axisX ? [Math.min(hx, hx + dir * w), hz - 0.08, Math.max(hx, hx + dir * w), hz + 0.08] : [hx - 0.08, Math.min(hz, hz + dir * w), hx + 0.08, Math.max(hz, hz + dir * w)];
    const D: DoorD = { id, g, open: 0, tgt: 0, max, hinge: new Vector3(hx, 0, hz), w, axisX, dir, col, label }; R.doors.push(D);
    inter(c, { id: 'door:' + id, kind: 'door', label, verb: 'Abrir', box: [axisX ? w : 0.35, 2.1, axisX ? 0.35 : w], at: [axisX ? hx + cx0 : hx, 1.05, axisX ? hz : hz + cz0], zone, range: 2.0 });
    return g;
  };
  const A = 1.45;
  { const gw = (gate.v[1] - gate.v[0]) / 2; doorLeaf('G1', xE + t / 2, Z(gate.v[0]), gw, gate.h, false, 1, -A, 'Portão (pátio)', M.steelDark, 'portao'); doorLeaf('G2', xE + t / 2, Z(gate.v[1]), gw, gate.h, false, -1, A, 'Portão (pátio)', M.steelDark, 'portao'); }
  doorLeaf('N1', X(pN.u[1]), zN - t / 2, pN.u[1] - pN.u[0], pN.h, true, 1, A, 'Porta (pátio)', M.steelDark, 'portao');
  doorLeaf('S1', X(pS.u[1]), zS + t / 2, pS.u[1] - pS.u[0], pS.h, true, 1, A, 'Porta externa', M.steelDark, 'portao');
  { const dg = doorLeaf('I1', X(bat.u[0]), Z(bat.porta[0]), bat.porta[1] - bat.porta[0], 2.1, false, 1, A, 'Porta da sala de baterias', M.doorGray, 'lisa');
    const sp = new Print(0.34, 0.2, 500); sp.rect(0, 0, 0.34, 0.2, '#f2c230', '#111', 0.004); sp.text('SALA DE', 0.17, 0.14, 0.06, { weight: 800 }); sp.text('BATERIAS', 0.17, 0.065, 0.06, { weight: 800 });
    const sm = sp.mesh(); sm.rotation.y = Math.PI / 2; sm.position.set(0.028, 1.55, 0.45); dg.add(sm); }
  for (const [k, a] of anx.entries()) { const w2 = (a.porta[1] - a.porta[0]) / 2, nm = k ? 'Porta do almoxarifado' : 'Porta da sala dos TSA';
    doorLeaf((k ? 'B' : 'A') + '1', X(a.porta[1]), zN - t / 2, w2, 2.4, true, 1, A, nm, M.ral7035, 'lisa'); doorLeaf((k ? 'B' : 'A') + '2', X(a.porta[0]), zN - t / 2, w2, 2.4, true, -1, -A, nm, M.ral7035, 'lisa'); }
  // batentes metálicos
  const jamb = (axisX: boolean, f: number, a: number, b: number, h: number) => { if (axisX) { B.box(b - a + 0.12, 0.08, t + 0.04, M.steelDark, (a + b) / 2, h + 0.04, f); for (const e of [a - 0.03, b + 0.03]) B.box(0.06, h, t + 0.04, M.steelDark, e, h / 2, f); } else { B.box(t + 0.04, 0.08, b - a + 0.12, M.steelDark, f, h + 0.04, (a + b) / 2); for (const e of [a - 0.03, b + 0.03]) B.box(t + 0.04, h, 0.06, M.steelDark, f, h / 2, e); } };
  jamb(false, xE + t / 2, Z(gate.v[0]), Z(gate.v[1]), gate.h); jamb(true, zN - t / 2, X(pN.u[1]), X(pN.u[0]), pN.h); jamb(true, zS + t / 2, X(pS.u[1]), X(pS.u[0]), pS.h);
  for (const a of anx) jamb(true, zN - t / 2, X(a.porta[1]), X(a.porta[0]), 2.4);
  // janelas altas (basculante com grade externa)
  const janela = (axisX: boolean, f: number, a0: number, a1: number, y0: number, y1: number, sgOut: number) => { const L = a1 - a0, cc = (a0 + a1) / 2, yc = (y0 + y1) / 2, h = y1 - y0;
    const bx = (w2: number, h2: number, d2: number, m: Material, a: number, y: number, o = 0) => axisX ? B.box(w2, h2, d2, m, a, y, f + o) : B.box(d2, h2, w2, m, f + o, y, a);
    bx(L, 0.05, t + 0.04, M.white, cc, y0); bx(L, 0.05, t, M.white, cc, y1); bx(0.05, h, t, M.white, a0, yc); bx(0.05, h, t, M.white, a1, yc); for (let k = 1; k < 4; k++) bx(L, 0.03, 0.05, M.white, cc, y0 + (k * h) / 4);
    const gl = new Mesh(new PlaneGeometry(L - 0.06, h - 0.06), M.glass); if (axisX) gl.position.set(cc, yc, f); else { gl.position.set(f, yc, cc); gl.rotation.y = Math.PI / 2; } c.root.shell.add(gl);
    B.zone = 'externo'; for (let i = 1; i < 8; i++) bx(0.018, h, 0.018, M.steelDark, a0 + (L * i) / 8, yc, sgOut * (t / 2 + 0.04)); bx(L, 0.03, 0.03, M.steelDark, cc, y0 + 0.05, sgOut * (t / 2 + 0.04)); bx(L, 0.03, 0.03, M.steelDark, cc, y1 - 0.05, sgOut * (t / 2 + 0.04)); B.zone = 'shell'; };
  for (const w of Ly.janelasS) janela(true, zS + t / 2, X(w[1]), X(w[0]), 2.4, 3.4, 1);
  janela(false, xW - t / 2, Z(bat.janelaO[0]), Z(bat.janelaO[1]), 2.3, 3.3, -1);

  // ================= iluminação: perfilado + luminárias tubulares herméticas =================
  const lumi = (x: number, z: number, zone: 'casa' | 'bateria', yH = H - 0.55) => {
    B.box(1.32, 0.07, 0.12, M.white, x, yH, z); const tb = dbox(1.24, 0.02, 0.08, M.emissiveWhite, x, yH - 0.04, z, c.root[zone]); tb.castShadow = false; R.ceiling.push(tb);
    for (const s of [-0.45, 0.45]) B.cyl(0.005, H - yH - 0.02, M.galv, x + s, (H + yH) / 2, z, 0, 0, 5);
  };
  const lv = Ly.luminarias; c.zone = 'casa'; B.zone = 'casa';
  for (const v of lv.v) { B.box(X(0.6) - X(23.2), 0.04, 0.04, M.galv, (X(0.6) + X(23.2)) / 2, H - 0.03, Z(v)); for (const u of lv.u) if (u < 23) lumi(X(u), Z(v), 'casa'); }
  for (const u of [5.5, 12.5, 19.0]) { const g = new Group(); g.position.set(X(u), H - 0.13, Z(lv.v[0])); c.root.casa.add(g); dbox(0.3, 0.12, 0.09, M.white, 0, 0, 0, g); for (const s of [-1, 1]) { const sp2 = dcyl(0.03, 0.05, M.white, s * 0.1, -0.08, 0.04, g, 10); sp2.rotation.x = 0.6; } }
  lumi(X((anx[0].u[0] + anx[0].u[1]) / 2), Z(1.5), 'casa'); lumi(X((anx[1].u[0] + anx[1].u[1]) / 2), Z(1.5), 'casa');
  for (const [u, v] of [[3.0, 5.6], [9.5, 5.0], [15.5, 5.0], [21.5, 5.6], [14.5, 0.9]] as const) { const L2 = new PointLight(0xfff3e2, 6, 13, 1.6); L2.position.set(X(u), H - 0.7, Z(v)); c.root.casa.add(L2); R.lights.push(L2); }

  // ================= piso: faixas, canaleta, áreas =================
  B.cast = false; const yF = 0.062;
  const fl = (u0: number, u1: number, v0: number, v1: number, m: Material, dy = 0) => ubox(u0, u1, v0, v1, yF + dy, yF + dy + 0.003, m);
  const cn = Ly.canaleta; fl(cn.u[0], cn.u[1], cn.faixa[0], cn.faixa[1], M.creamPaint); ubox(cn.u[0] + 0.15, cn.u[1], cn.chapa[0], cn.chapa[1], yF + 0.003, yF + 0.012, M.checker);
  for (const k of [1, 2, 3, 4, 5, 6, 7]) fl(cn.u[0] + 0.15 + k * ((cn.u[1] - cn.u[0] - 0.15) / 8) - 0.006, cn.u[0] + 0.15 + k * ((cn.u[1] - cn.u[0] - 0.15) / 8) + 0.006, cn.chapa[0], cn.chapa[1], M.black, 0.01);
  // PDMT: posição
  const pd = Ly.pdmt, ws = pd.ordem.map((b: string) => pd.larg[b] ?? pd.largPadrao), uEnd = pd.u0 + ws.reduce((a: number, b: number) => a + b, 0), vF = pd.vTras + pd.prof;
  fl(pd.u0 - 0.15, uEnd + 0.15, pd.vTras - 0.12, vF + 0.12, M.creamPaint, -0.001);
  const rf = Ly.faixaVermelhaFrente, ry1 = vF + rf; // linha vermelha: frente + laterais até a parede do pátio
  fl(pd.u0 - 0.5, uEnd + 0.5, ry1 - 0.04, ry1 + 0.04, M.lineRed); fl(pd.u0 - 0.54, pd.u0 - 0.46, 0, ry1, M.lineRed); fl(uEnd + 0.46, uEnd + 0.54, 0, ry1, M.lineRed);
  const fa = Ly.faixaAmarela; fl(fa.u[0], fa.u[1], fa.v - 0.04, fa.v + 0.04, M.lineYellow); fl(fa.u[0] - 0.04, fa.u[0] + 0.04, vF - 0.2, fa.v, M.lineYellow); fl(fa.u[1] - 0.04, fa.u[1] + 0.04, 0, fa.v, M.lineYellow);
  // PSPC / retificadores / QDCC: base amarela + chapa
  const ps = Ly.pspc; fl(ps.armVidro[0] - 0.15, ps.u[1] + 0.15, WW - 1.15, WW, M.creamPaint);
  fl(Ly.ret.RT2[0] - 0.3, Ly.ret.RT1[1] + 0.3, WW - 1.45, WW, M.creamPaint); ubox(Ly.ret.RT2[0] - 0.12, Ly.ret.RT1[1] + 0.12, WW - 1.27, WW, yF + 0.003, yF + 0.012, M.checker);
  fl(bat.u[0] - 0.85, bat.u[0], Ly.parede.QDCA[0] - 0.35, Ly.parede.QDCC[1] + 0.35, M.creamPaint); ubox(bat.u[0] - 0.7, bat.u[0], Ly.parede.QDCA[0] - 0.2, Ly.parede.QDCC[1] + 0.2, yF + 0.003, yF + 0.012, M.checker);
  // áreas de extintor (vermelho com borda amarela)
  { const [u0, u1] = Ly.extintorPiso; fl(u0, u1, WW - 1.0, WW, M.lineYellow); fl(u0 + 0.12, u1 - 0.12, WW - 0.88, WW, M.lineRed, 0.001); }
  { const [u, v] = Ly.extintorCarreta; fl(u - 0.45, u + 0.45, v - 0.45, v + 0.45, M.lineYellow); fl(u - 0.33, u + 0.33, v - 0.33, v + 0.33, M.floorPaint, 0.001); fl(u - 0.3, u + 0.3, v - 0.3, v + 0.3, M.lineRed, 0.002); fl(u - 0.25, u + 0.25, v - 0.25, v + 0.25, M.floorPaint, 0.003); }
  B.cast = true;

  // ================= PDMT 13,8 kV =================
  const zcP = Z(pd.vTras + pd.prof / 2), Hc = pd.alt, Dp = pd.prof; let acc = pd.u0;
  pd.ordem.forEach((bay: string, i: number) => { const w = ws[i]; R.cub[bay] = cubiculo(c, bay, X(acc + w / 2), zcP, w, Dp, Hc, pd.tags[bay] as CubTag); acc += w; });
  const lx1 = X(uEnd), lx2 = X(pd.u0), zfP = Z(vF), zbP = Z(pd.vTras), Lp = lx2 - lx1;
  // tampas laterais aparafusadas (até a capota)
  for (const [xe, s] of [[lx1 - 0.02, -1], [lx2 + 0.02, 1]] as const) { B.box(0.04, Hc + 0.45, Dp, M.ral7035, xe, (Hc + 0.45) / 2, zcP); for (let k = 0; k < 5; k++) for (const zz of [zbP + 0.08, zfP - 0.08, zcP]) B.cyl(0.008, 0.01, M.aluDull, xe + s * 0.022, 0.25 + k * 0.6, zz, 0, Math.PI / 2, 6); }
  // capota de alívio de arco: frente inclinada + topo + fundo
  const ang = Math.atan2(0.55, 0.5), sl = Math.hypot(0.55, 0.5);
  B.box(Lp + 0.08, sl, 0.02, M.ral7035, (lx1 + lx2) / 2, Hc + 0.25, zfP - 0.275, 0, -ang);
  B.box(Lp + 0.08, 0.02, Dp - 0.55, M.ral7035, (lx1 + lx2) / 2, Hc + 0.5, zbP + (Dp - 0.55) / 2); B.box(Lp + 0.08, 0.5, 0.02, M.ral7035, (lx1 + lx2) / 2, Hc + 0.25, zbP);
  let ux = pd.u0; for (const w of ws) { B.box(0.012, sl * 0.98, 0.03, M.ral7016, X(ux), Hc + 0.25, zfP - 0.27, 0, -ang); ux += w; }
  B.box(Lp + 0.08, 0.04, 0.05, M.ral7035, (lx1 + lx2) / 2, Hc + 0.02, zfP + 0.005);
  { const sg = new Print(1.1, 0.42, 420); sg.rect(0, 0, 1.1, 0.42, '#f4f4f0', '#222', 0.006); sg.text('PDMT - 13,8kV', 0.55, 0.21, 0.16, { weight: 800 });
    const m = sg.mesh(0.6); m.position.set(X(uEnd - 1.0), Hc + 0.25 + 0.012 * Math.sin(ang), zfP - 0.275 + 0.012 * Math.cos(ang)); m.rotation.x = -ang; c.root.casa.add(m); }
  colBox(c, (lx1 + lx2) / 2, zcP, Lp / 2 + 0.05, Dp / 2);

  // ================= PSPC (2 portas, mímico) + armário de vidro =================
  pspc(c, R, X(ps.u[0]), X(ps.u[1]), zS - 0.02);
  armVidro(c, X(ps.armVidro[0]), X(ps.armVidro[1]), zS - 0.02);
  // ================= retificadores =================
  for (const [nm, uu] of Object.entries<number[]>(Ly.ret)) retificador(c, R, nm, X(uu[0]), X(uu[1]), zS - 0.03);
  // ================= QDCC / QDCA / QSA na divisória da sala de baterias =================
  servAux(c, R, X(bat.u[0]) + tp / 2, Ly.parede, Z, H);
  // quadro de avisos (parede do anexo 1, lado do salão) e extintor sobre rodas
  { const pr = new Print(1.0, 0.7, 380); pr.rect(0, 0, 1, 0.7, '#f4f3ee', '#555', 0.01); pr.text('PROCEDIMENTOS OPERACIONAIS', 0.5, 0.64, 0.045, { weight: 700 });
    ['1. Toda manobra exige OS e autorização do COS', '2. APR antes de iniciar a tarefa', '3. Desenergizar: seccionar, bloquear, constatar,', '    aterrar, proteger, sinalizar (NR-10 10.5.1)', '4. EPI inspecionado antes do uso', '5. Comunicação com read-back', '6. Emergência: 193 · SAMU 192 · COS ramal 2100'].forEach((l, i) => pr.text(l, 0.06, 0.55 - i * 0.07, 0.034, { align: 'left', weight: 500 }));
    const [q0, q1] = Ly.quadro, m = pr.mesh(0.7); m.position.set(X((q0 + q1) / 2), 1.6, Z(aV) + tp / 2 + 0.015); c.root.casa.add(m); B.box(q1 - q0 + 0.04, 0.74, 0.02, M.aluDull, X((q0 + q1) / 2), 1.6, Z(aV) + tp / 2 + 0.005); }
  extintorCarreta(c, X(Ly.extintorCarreta[0]), Z(Ly.extintorCarreta[1]));
  plate(c, 'extintor', ['EXTINTOR'], 0.24, 0.32, X(anx[0].u[0]) + tp / 2 + 0.012, 1.95, Z(Ly.extintorCarreta[1]), Math.PI / 2);
  plate(c, 'saida', ['SAÍDA'], 0.42, 0.16, X((Ly.ret.RT2[0] + Ly.ret.RT1[1]) / 2), 2.2, zS - 0.012, Math.PI);
  plate(c, 'saida', ['SAÍDA'], 0.42, 0.16, X(11.0), 2.2, zS - 0.012, Math.PI);
  plate(c, 'saida', ['SAÍDA'], 0.42, 0.16, xE - 0.012, gate.h + 0.25, Z((gate.v[0] + gate.v[1]) / 2), -Math.PI / 2);

  // ================= mesa do supervisório, TV, armário de EPI, vara, objetos =================
  mesa(c, R, X(Ly.mesa[1]), X(Ly.mesa[0]), zN);
  armarioEPI(c, R, X(Ly.armEPI[1]), X(Ly.armEPI[0]), zN);
  { const [u0, u1] = Ly.vara, g = new Group(); c.root.casa.add(g); const v2 = dcyl(0.02, u1 - u0, M.lineYellow, (X(u0) + X(u1)) / 2, 1.45, zN + 0.07, g, 10); v2.rotation.z = Math.PI / 2; v2.material = new MeshStandardMaterial({ color: 0xe8661c, roughness: 0.45 });
    const hd = dcyl(0.035, 0.22, M.black, X(u1) + 0.1, 1.45, zN + 0.07, g, 12); hd.rotation.z = Math.PI / 2; R.cabinets.EPI.items['vara_manobra#1'] = g;
    for (const u of [u0 + 0.3, u1 - 0.3]) { B.box(0.03, 0.12, 0.1, M.steelDark, X(u), 1.4, zN + 0.05); } }
  for (const [u, v] of Ly.estacao) { // tripés (estação meteorológica / anemômetro)
    const x = X(u), z = Z(v); for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; B.rod(new Vector3(x, 0.75, z), new Vector3(x + Math.cos(a) * 0.4, 0.06, z + Math.sin(a) * 0.4), 0.01, M.aluDull, 6); }
    B.cyl(0.015, 1.4, M.aluDull, x, 1.4, z, 0, 0, 8); B.rbox(0.28, 0.12, 0.2, 0.02, M.white, x, 2.12, z); for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; B.rod(new Vector3(x, 2.3, z), new Vector3(x + Math.cos(a) * 0.16, 2.3, z + Math.sin(a) * 0.16), 0.004, M.aluDull, 4); B.sphere(0.03, M.black, x + Math.cos(a) * 0.16, 2.3, z + Math.sin(a) * 0.16, 8); } }
  carrinhoDJ(c, X(Ly.carrinho[0]), Z(Ly.carrinho[1]));
  // quadro LOTO, DEA e botoeira de emergência (parede do portão)
  loto(c, R, xE, Z((Ly.loto[0] + Ly.loto[1]) / 2));
  { const z = Z(Ly.dea), x = xE - 0.09; B.rbox(0.16, 0.5, 0.42, 0.02, M.white, x, 1.35, z); B.box(0.162, 0.08, 0.42, M.green, x, 1.56, z); const dea = new Group(); dea.position.set(x - 0.02, 1.32, z); c.root.casa.add(dea);
    dbox(0.1, 0.32, 0.3, M.yellow, 0, 0, 0, dea); dbox(0.02, 0.06, 0.16, M.plastic, -0.055, 0.09, 0, dea); R.dea = dea; const gl = new Mesh(new PlaneGeometry(0.38, 0.44), M.glass); gl.rotation.y = -Math.PI / 2; gl.position.set(x - 0.085, 1.35, z); c.root.casa.add(gl);
    plate(c, 'verde', ['DEA'], 0.3, 0.1, x - 0.01, 1.72, z, -Math.PI / 2); inter(c, { id: 'dea', kind: 'dea', label: 'Desfibrilador externo automático (DEA)', verb: 'Pegar', box: [0.3, 0.6, 0.5], at: [x - 0.1, 1.35, z], range: 1.6 }); }
  { const z = Z(Ly.emerg), x = xE - 0.07; B.rbox(0.1, 0.2, 0.16, 0.01, M.yellow, x, 1.45, z); const mush = dcyl(0.045, 0.05, glow(0xc8102e, false), x - 0.07, 1.45, z, c.root.casa, 20); mush.rotation.z = Math.PI / 2; mush.userData.axis = 'x'; R.emerg = mush;
    plate(c, 'info', ['EMERGÊNCIA'], 0.2, 0.05, x - 0.055, 1.6, z, -Math.PI / 2, { bg: '#c8102e' });
    inter(c, { id: 'emerg', kind: 'emerg', label: 'Botoeira de emergência (sirene e sinaleira)', verb: 'Acionar', box: [0.3, 0.4, 0.3], at: [x - 0.08, 1.45, z], range: 1.6 }); }

  // ================= anexo 1 (TSA a seco em grade) e anexo 2 (almoxarifado) =================
  salaTSA(c, X(anx[0].u[1]), X(anx[0].u[0]), zN, Z(aV));
  // ================= sala de baterias =================
  c.zone = 'bateria'; B.zone = 'bateria'; baterias(c, R, X(bat.u[1]), X(bat.u[0]), Z(bat.v[0]), zS, H, lumi); c.zone = 'casa'; B.zone = 'casa';
  { const L2 = new PointLight(0xfff3e2, 6, 10, 1.6); L2.position.set(X((bat.u[0] + bat.u[1]) / 2), H - 0.7, Z(6.3)); c.root.bateria.add(L2); R.lights.push(L2); }

  // pontos de partida (yaw: 0 = olhando para o norte/-z; π/2 = oeste/-x; π = sul; -π/2 = leste)
  R.spawns = { casa: { x: X(2.6), z: Z(7.3), yaw: Math.PI / 2 }, scada: { x: X(1.4), z: Z(1.75), yaw: 0 }, cubiculos: { x: X(14.5), z: Z(6.2), yaw: 0 }, sa: { x: X(23.5), z: Z(6.0), yaw: Math.PI }, bat: { x: X(27.8), z: Z(4.2), yaw: Math.PI } };
  void FONT; void MONO;
  return R;
}

// ======================= PSPC: painel de supervisão, proteção e controle (2 portas, mímico pintado) =======================
// Frente para o norte (-z). Coordenadas do mímico vistas de frente: px da esquerda (leste) para a direita (oeste).
function pspc(c: MCtx, R: Indoor, xL: number, xR: number, zBack: number) {
  const M = c.M, B = c.b, root = c.root.casa, W = xL - xR, Dd = 0.6, zc = zBack - Dd / 2, zf = zBack - Dd, xc = (xL + xR) / 2;
  B.box(W, 0.1, Dd, M.black, xc, 0.05, zc); B.box(W, 2.2, Dd - 0.02, M.ral7035, xc, 1.2, zc + 0.01); B.box(W + 0.02, 0.03, Dd + 0.02, M.ral7035, xc, 2.31, zc);
  B.box(0.006, 2.18, 0.01, M.ral7016, xc, 1.2, zf - 0.004); // fresta entre as portas
  for (const s of [-1, 1]) { B.box(0.035, 0.24, 0.035, M.black, xc + s * 0.07, 1.25, zf - 0.03); B.cyl(0.012, 0.02, M.aluDull, xc + s * 0.07, 1.12, zf - 0.012, Math.PI / 2, 0, 10); }
  for (const [x2, y2] of [[xL - 0.06, 2.2], [xR + 0.06, 2.2]] as const) for (let k = 0; k < 5; k++) B.box(0.008, 0.03, 0.04, M.ral7016, x2, y2 - k * 0.012, zc); // venezianas laterais (simplif.)
  const P = (px: number) => xL - px, Y = (py: number) => 0.1 + py;
  const pr = new Print(W, 2.2, 420), WH = '#f7f8f6', OR = '#e8742a', BK = '#111';
  const ln = (pts: [number, number][], col = WH, w = 0.02) => { if (col === WH) pr.line(pts, '#4d5357', w + 0.01); pr.line(pts, col, w); };
  const lab = (s: string, x: number, y: number, sz = 0.034, al: CanvasTextAlign = 'center') => pr.text(s, x, y, sz, { weight: 800, align: al });
  const brk = (x: number, y: number, s = 0.075) => pr.rect(x - s / 2, y - s / 2, s, s, BK);
  const sec = (x: number, y: number, len = 0.08) => pr.line([[x, y + len / 2], [x + 0.045, y - len / 2]], BK, 0.012);
  const earth = (x: number, y: number) => { for (let k = 0; k < 3; k++) pr.line([[x + k * 0.016, y - 0.03 + k * 0.006], [x + k * 0.016, y + 0.03 - k * 0.006]], BK, 0.008); };
  const ct = (x: number, y: number) => { pr.circle(x - 0.012, y, 0.014, undefined, BK, 0.004); pr.circle(x + 0.012, y, 0.014, undefined, BK, 0.004); };
  const trafo = (x: number, y: number) => { for (let k = 0; k < 4; k++) { pr.circle(x - 0.06 + k * 0.04, y + 0.03, 0.022, undefined, BK, 0.012); pr.circle(x - 0.06 + k * 0.04, y - 0.03, 0.022, undefined, BK, 0.012); } };
  const fuse = (x: number, y: number) => { pr.rect(x - 0.03, y - 0.07, 0.06, 0.14, 'rgba(0,0,0,0)', BK, 0.006); pr.rect(x - 0.015, y - 0.05, 0.03, 0.1, 'rgba(0,0,0,0)', BK, 0.004); };
  const arrow = (x: number, y: number, col = BK) => pr.poly([[x - 0.03, y + 0.04], [x + 0.03, y + 0.04], [x, y - 0.02]], col);
  const tagp = (s: string, x: number, y: number) => { pr.rect(x - 0.07, y - 0.02, 0.14, 0.04, '#1b1d20'); pr.text(s, x, y, 0.014, { color: '#eee', weight: 700 }); };
  // ---- 138 kV: linhas, seccionadoras, disjuntores ----
  ln([[0.16, 2.08], [0.16, 1.2]]); ln([[1.86, 2.08], [1.86, 1.2]]); ln([[0.16, 1.2], [1.86, 1.2]], WH, 0.022); // barra 138 kV
  arrow(0.16, 2.12); arrow(1.86, 2.12); lab('LINHA 1 - 138kV', 0.04, 2.19, 0.036, 'left'); lab('LINHA 2 - 138kV', 1.97, 2.19, 0.036, 'right');
  ct(0.16, 2.02); ct(1.86, 2.02); ln([[0.16, 2.02], [0.44, 2.02], [0.44, 1.96]], BK, 0.008); ln([[1.86, 2.02], [1.31, 2.02], [1.31, 1.96]], BK, 0.008);
  for (const [x, nm] of [[0.44, 'PV1'], [1.31, 'PV2']] as const) { pr.rect(x - 0.07, 1.82, 0.14, 0.13, '#f4f3ee', BK, 0.006); pr.text('kV', x - 0.04, 1.92, 0.016, { weight: 600 }); pr.line([[x - 0.05, 1.86], [x + 0.03, 1.92]], BK, 0.004); lab(nm, x, 2.0); }
  pr.rect(0.55, 1.83, 0.3, 0.09, '#ffffff', '#555', 0.002); pr.text('PSPC', 0.62, 1.875, 0.036, { weight: 800 }); pr.text('Controle e Proteção', 0.76, 1.872, 0.016, { weight: 500 });
  sec(0.14, 1.8); lab('SC-89-1', 0.2, 1.73, 0.026); earth(0.04, 1.63); ln([[0.16, 1.63], [0.07, 1.63]], BK, 0.01); sec(0.1, 1.63, 0.05); lab('SC-89-1T', 0.21, 1.58, 0.024);
  brk(0.16, 1.44); lab('DJ-52-1', 0.07, 1.36, 0.022); ct(0.16, 1.53); pr.line([[0.32, 1.52], [0.32, 1.44], [0.21, 1.44]], BK, 0.004);
  sec(1.84, 1.8); lab('SC-89-2', 1.83, 1.73, 0.03); earth(1.95, 1.63); ln([[1.86, 1.63], [1.94, 1.63]], BK, 0.01); sec(1.88, 1.63, 0.05); lab('SC-89-2T', 1.8, 1.56, 0.03);
  brk(1.86, 1.42, 0.13); lab('DJ-52-2', 1.86, 1.31, 0.034); ct(1.86, 1.53); pr.line([[1.5, 1.5], [1.5, 1.42], [1.79, 1.42]], BK, 0.004);
  lab('138kV', 0.45, 1.14, 0.028); lab('138kV', 1.42, 1.1, 0.03);
  // medição ampla
  ln([[1.05, 1.2], [1.05, 1.08]], BK, 0.01); ct(1.05, 1.12); pr.rect(1.2, 1.03, 0.28, 0.09, 'rgba(0,0,0,0)', BK, 0.003); pr.text('MEDIÇÃO', 1.34, 1.085, 0.02, { weight: 700 }); pr.text('AMPLA', 1.34, 1.055, 0.02, { weight: 700 });
  // TR-01 / TR-02
  ln([[0.17, 1.2], [0.17, 0.66]], BK, 0.01); sec(0.15, 1.06); lab('SC-89-3', 0.07, 1.06, 0.022); trafo(0.17, 0.93); lab('TR-01', 0.04, 0.95, 0.022); ct(0.17, 0.84); brk(0.17, 0.76); lab('52-3', 0.17, 0.7, 0.022); lab('(3Q1)', 0.17, 0.675, 0.018);
  ln([[1.86, 1.2], [1.86, 0.74]], BK, 0.012); sec(1.84, 1.02); lab('SC-89-4', 1.8, 0.95, 0.03); trafo(1.78, 0.84); lab('TR-02', 1.88, 0.77, 0.036, 'left'); ct(1.86, 0.74); brk(1.86, 0.62, 0.12); lab('52-4', 1.86, 0.53, 0.034); lab('(9Q1)', 1.86, 0.5, 0.03);
  pr.text('TRIPs', 0.6, 1.05, 0.016, { weight: 700 }); pr.text('DJ-52-1', 0.62, 1.03, 0.014); pr.text('DJ-52-2', 0.62, 1.01, 0.014); pr.text('TRIPs', 1.12, 0.95, 0.018, { weight: 700 }); pr.text('DJ-52-1', 1.12, 0.925, 0.016); pr.text('DJ-52-2', 1.12, 0.9, 0.016);
  // 13,8 kV: barras (laranja), saídas e interligação
  ln([[0.12, 0.62], [0.72, 0.62]], OR, 0.016); lab('13,8kV', 0.42, 0.65, 0.026); ln([[0.17, 0.72], [0.17, 0.62]], OR, 0.016);
  ln([[1.0, 0.5], [1.95, 0.5]], OR, 0.02); lab('13,8kV', 1.25, 0.53, 0.034); ln([[1.86, 0.56], [1.86, 0.5]], OR, 0.02);
  for (const [x, t1, t2, cub] of [[0.17, '52-6', '(1Q1)', 'CUBÍCULO 1'], [0.33, '52-7', '(2Q1)', 'CUBÍCULO 2'], [0.62, '52-5', '(5Q1)', '']] as const) { ln([[x, 0.62], [x, 0.38]], OR, 0.014); brk(x, 0.5, 0.065); lab(t1, x, 0.42, 0.02); lab(t2, x, 0.395, 0.017); if (cub) { arrow(x, 0.3); tagp(cub, x, 0.24); } }
  ln([[0.62, 0.38], [0.62, 0.31], [0.94, 0.31], [0.94, 0.62], [1.0, 0.62], [1.0, 0.5]], OR, 0.014); // interligação 52-5 → barra 2
  { const x = 0.47; ln([[x, 0.62], [x, 0.3]], OR, 0.014); sec(x - 0.02, 0.54); lab('89-5', x + 0.06, 0.55, 0.02); lab('(4Q1)', x + 0.06, 0.525, 0.017); fuse(x, 0.4); arrow(x, 0.27); tagp('CUBÍCULO 4', x, 0.21); }
  for (const [x, t1, t2, cub] of [[1.33, '528', '(7Q1)', 'CUBÍCULO 7'], [1.52, '529', '(8Q1)', 'CUBÍCULO 8']] as const) { ln([[x, 0.5], [x, 0.24]], OR, 0.018); brk(x, 0.38, 0.1); lab(t1, x - 0.05, 0.29, 0.026); lab(t2, x - 0.05, 0.265, 0.024); arrow(x, 0.2); tagp(cub, x, 0.13); }
  { const x = 1.73; ln([[x, 0.5], [x, 0.18]], OR, 0.018); sec(x - 0.02, 0.43); lab('89-6', x + 0.08, 0.43, 0.026); lab('(10Q1)', x + 0.08, 0.4, 0.024); fuse(x, 0.29); arrow(x, 0.14); tagp('CUBÍCULO 10', x, 0.07); }
  // anunciador / seletor (porta direita)
  pr.rect(1.08, 1.29, 0.1, 0.12, '#f4f3ee', '#555', 0.002); pr.text('ALARME DO', 1.25, 1.3, 0.012, { weight: 700 }); pr.text('ANUNCIADOR', 1.25, 1.285, 0.012, { weight: 700 });
  const fm = pr.mesh(0.45); fm.rotation.y = Math.PI; fm.position.set(xc, 1.2, zf - 0.006); root.add(fm);
  // relés FT1..FT4 (relevo) com LCD
  const rele = (nm: string, px: number, py: number, w: number, h: number, verde: boolean, T: string | null) => {
    const x = P(px), y = Y(py); if (verde) B.box(w + 0.03, h + 0.03, 0.02, M.green, x, y, zf - 0.01); B.box(w, h, 0.06, M.black, x, y, zf - 0.03);
    const lcd = canvasTex(256, 96), lm = new Mesh(new PlaneGeometry(w * 0.62, h * 0.24), new MeshStandardMaterial({ map: lcd.t, emissiveMap: lcd.t, emissive: 0xffffff, emissiveIntensity: 0.9 })); lm.rotation.y = Math.PI; lm.position.set(x, y + h * 0.2, zf - 0.061); root.add(lm);
    const leds: Lamp[] = []; for (let i = 0; i < 8; i++) leds.push(lamp(i < 2 ? 0xff3b30 : 0xffb02e, 0.005, x + w * 0.32 - (i % 4) * 0.025, y - h * 0.12 - Math.floor(i / 4) * 0.025, zf - 0.061, root));
    const lp = new Print(w, h, 700); lp.text(nm, w / 2, h - 0.02, 0.016, { color: '#c9d3db', weight: 700 }); lp.rect(w * 0.55, h * 0.12, w * 0.35, h * 0.12, '#2a2d30'); const lpm = lp.mesh(0.3); lpm.rotation.y = Math.PI; lpm.position.set(x, y, zf - 0.0605); root.add(lpm);
    R.panels[T ? nm + ' ' + T : nm === 'FT1' ? 'PROT-LT' : nm] = { id: nm, leds, lcd: nm === 'FT2' ? null : lcd };
    if (T) { const rb = dbox(0.035, 0.022, 0.012, glow(0xff3b30, false), x - w * 0.3, y - h * 0.5 - 0.06, zf - 0.006, root); part(c, 'ppc:PSPC', 'reset' + T, `RESET do bloqueio 86T-${T} (rearme local, relé ${nm})`, 'ppc:reset', [rb], [0.06, 0.05, 0.05], new Vector3(x - w * 0.3, y - h * 0.5 - 0.06, zf - 0.01), { data: { T } }); }
  };
  rele('FT1', 0.43, 1.6, 0.22, 0.26, false, null); rele('FT2', 1.42, 1.62, 0.26, 0.3, false, null); rele('FT3', 0.42, 0.9, 0.2, 0.28, true, 'T1'); rele('FT4', 1.32, 0.78, 0.24, 0.3, true, 'T2');
  B.box(0.1, 0.17, 0.03, M.blue, P(0.45), Y(1.3), zf - 0.015); // multimedidor
  // lâmpadas (verde = aberto, vermelha = fechado) ligadas à simulação; LINHA 2 não modelada (apagada)
  const pair = (eq: string | null, px: number, py: number, r = 0.016) => { const g = lamp(0x2fd36b, r, P(px - 0.032), Y(py), zf - 0.014, root), rd = lamp(0xff3b30, r, P(px + 0.032), Y(py), zf - 0.014, root); B.box(0.11, 0.05, 0.02, M.black, P(px), Y(py), zf - 0.004); R.pspc.push([eq, g, rd]); };
  pair('89-LT1-1', 0.17, 1.88); pair('89T-LT1', 0.17, 1.69); pair('52-LT1', 0.17, 1.55);
  pair(null, 1.85, 1.9, 0.02); pair(null, 1.75, 1.7, 0.02); pair(null, 1.85, 1.55, 0.02);
  pair('89-T1-1', 0.18, 1.13); pair('52-T1M', 0.18, 0.84); pair('89-T2-1', 1.72, 1.09, 0.02); pair('52-T2M', 1.86, 0.75, 0.02);
  pair('52-AL1', 0.17, 0.58, 0.013); pair('52-AL2', 0.33, 0.58, 0.013); pair('FU-TSA1', 0.47, 0.58, 0.013); pair('52-P', 0.62, 0.58, 0.013);
  pair('52-AL3', 1.33, 0.47, 0.018); pair('52-AL4', 1.52, 0.47, 0.018); pair('FU-TSA2', 1.73, 0.47, 0.018);
  // seletor, lâmpadas âmbar/amarela, botão de alarme
  { const s = dcyl(0.035, 0.03, M.black, P(1.13), Y(1.36), zf - 0.015, root, 16); s.rotation.x = Math.PI / 2; dbox(0.015, 0.06, 0.03, M.black, P(1.13), Y(1.36), zf - 0.035, root);
    for (const [px2, col] of [[1.24, 0xffb02e], [1.31, 0xf2c230]] as const) lamp(col, 0.018, P(px2), Y(1.42), zf - 0.014, root); const ab = dcyl(0.02, 0.02, M.black, P(1.25), Y(1.33), zf - 0.012, root, 14); ab.rotation.x = Math.PI / 2; }
  colBox(c, xc, zc, W / 2, Dd / 2);
  inter(c, { id: 'ppc:PSPC', kind: 'prot', label: 'PSPC — painel de supervisão, proteção e controle', verb: 'Inspecionar', box: [W, 2.2, 0.12], at: [xc, 1.2, zf - 0.06], eq: 'PSPC', view: { pos: new Vector3(xc, 1.45, zf - 1.75), look: new Vector3(xc, 1.25, zf) } });
}

function armVidro(c: MCtx, xL: number, xR: number, zBack: number) {
  const M = c.M, B = c.b, root = c.root.casa, W = xL - xR, Dd = 0.6, zc = zBack - Dd / 2, zf = zBack - Dd, xc = (xL + xR) / 2;
  B.box(W, 0.1, Dd, M.black, xc, 0.05, zc); B.box(W, 2.2, Dd - 0.02, M.ral7035, xc, 1.2, zc + 0.01); B.box(0.6 * W, 0.02, Dd, M.ral7035, xc, 2.31, zc);
  for (let k = 0; k < 6; k++) B.box(0.22, 0.012, 0.01, M.ral7016, xc, 2.15 - k * 0.025, zf - 0.005);
  for (let k = 0; k < 6; k++) B.box(0.2, 0.012, 0.01, M.ral7016, xc, 0.32 - k * 0.025, zf - 0.005);
  const pr = new Print(W - 0.16, 1.6, 400); pr.rect(0, 0, W - 0.16, 1.6, '#c7cbc8'); for (let k = 0; k < 6; k++) { pr.rect(0.06, 1.42 - k * 0.24, W - 0.28, 0.16, '#2a2d30'); pr.text(['MEDIDOR LT-01', 'MEDIDOR T1', 'MEDIDOR T2', 'UTR / GATEWAY', 'SWITCH ETHERNET', 'FONTE 125 Vcc'][k], (W - 0.16) / 2, 1.5 - k * 0.24, 0.026, { color: '#c9d3db' }); }
  const pm = pr.mesh(); pm.rotation.y = Math.PI; pm.position.set(xc, 1.25, zf + 0.06); root.add(pm);
  const gl = new Mesh(new PlaneGeometry(W - 0.16, 1.7), M.glassDark); gl.rotation.y = Math.PI; gl.position.set(xc, 1.25, zf - 0.008); root.add(gl);
  for (const [w, h, x, y] of [[W - 0.08, 0.05, xc, 2.11], [W - 0.08, 0.05, xc, 0.39], [0.05, 1.75, xL - 0.06, 1.25], [0.05, 1.75, xR + 0.06, 1.25]] as const) B.box(w, h, 0.02, M.ral7016, x, y, zf - 0.008);
  B.box(0.03, 0.18, 0.04, M.black, xR + 0.12, 1.25, zf - 0.025);
  colBox(c, xc, zc, W / 2, Dd / 2);
  inter(c, { id: 'info:MED', kind: 'info', label: 'Armário de medição e comunicação (porta de vidro)', verb: 'Inspecionar', box: [W, 2.2, 0.12], at: [xc, 1.2, zf - 0.06], eq: 'MED', view: { pos: new Vector3(xc, 1.5, zf - 1.3), look: new Vector3(xc, 1.3, zf) } });
}

// ======================= retificador 125 Vcc (piso, 3 instrumentos analógicos) =======================
function retificador(c: MCtx, R: Indoor, nm: string, xL: number, xR: number, zBack: number) {
  const M = c.M, B = c.b, root = c.root.casa, W = xL - xR, Dd = 0.62, Hh = 1.35, zc = zBack - Dd / 2, zf = zBack - Dd, xc = (xL + xR) / 2, num = nm.slice(2);
  B.box(W, Hh, Dd, M.ral7035, xc, Hh / 2 + 0.02, zc); B.box(W + 0.02, 0.04, Dd + 0.02, M.ral7016, xc, 0.02, zc);
  for (const s of [-1, 1]) for (const zz of [zf + 0.08, zBack - 0.08]) B.box(0.05, 0.1, 0.05, M.ral7035, xc + s * (W / 2 - 0.08), Hh + 0.07, zz);
  B.box(W + 0.12, 0.03, Dd + 0.12, M.ral7035, xc, Hh + 0.135, zc); for (const s of [-1, 1]) { const ey = new Mesh(new TorusGeometry(0.045, 0.01, 8, 18), M.aluDull); ey.position.set(xc + s * (W / 2 - 0.12), Hh + 0.2, zc); root.add(ey); }
  // painel superior
  const pr = new Print(W, 0.55, 520); pr.rect(0.03, 0.03, W - 0.06, 0.49, '#d3d6d3', '#7a8086', 0.006); pr.line([[0.035, 0.035], [0.035, 0.51]], '#d5682a', 0.004);
  pr.text('RETIFICADOR 125 Vcc / 50 A', W / 2, 0.47, 0.03, { weight: 700 }); pr.rect(0.07, 0.37, 0.15, 0.05, '#ffffff', '#333', 0.002); pr.text('RET. - ' + num, 0.145, 0.395, 0.026, { weight: 700 });
  pr.rect(W * 0.52, 0.06, W * 0.42, 0.15, '#c3c7c4', '#7a8086', 0.003); pr.text('TESTE', W * 0.79, 0.075, 0.014, { weight: 700 }); pr.text('RESET', W * 0.89, 0.075, 0.014, { weight: 700 });
  const pm = pr.mesh(); pm.rotation.y = Math.PI; pm.position.set(xc, 1.06, zf - 0.004); root.add(pm);
  const ct = canvasTex(288, 96); R.rt[nm] = ct; const scr = new Mesh(new PlaneGeometry(0.44, 0.147), new MeshStandardMaterial({ map: ct.t, roughness: 0.3 })); scr.rotation.y = Math.PI; scr.position.set(xc - 0.02, 1.2, zf - 0.022); root.add(scr);
  for (let k = 0; k < 3; k++) B.box(0.14, 0.14, 0.02, M.black, xc + 0.15 - k * 0.15 - 0.02, 1.2, zf - 0.005);
  (R.rt as any)[nm + ':leds'] = ['CA', 'CC', 'FL', 'AL'].map((_, i) => lamp([0x2fd36b, 0x2fd36b, 0xffb02e, 0xff3b30][i], 0.006, xc - 0.02 - (i % 2) * 0.07 + 0.03, 0.97 + Math.floor(i / 2) * 0.03, zf - 0.006, root));
  for (const s of [0, 1]) { const b = dbox(0.05, 0.025, 0.012, M.plastic, xc - W * 0.29 - s * 0.085, 0.92, zf - 0.008, root); void b; }
  // porta inferior com venezianas
  B.box(W - 0.06, 0.74, 0.02, M.ral7035, xc, 0.45, zf - 0.01); for (let col = 0; col < 4; col++) for (let k = 0; k < 7; k++) B.box(0.14, 0.012, 0.02, M.ral7016, xc + 0.27 - col * 0.18, 0.18 + k * 0.035, zf - 0.02);
  B.box(0.03, 0.08, 0.04, M.black, xc + W / 2 - 0.1, 0.6, zf - 0.03); B.box(0.12, 0.05, 0.004, M.aluDull, xc - 0.2, 0.72, zf - 0.022);
  colBox(c, xc, zc, W / 2, Dd / 2);
  inter(c, { id: 'sa:' + nm, kind: 'cc', label: `Retificador RET-${num} 125 Vcc / 50 A`, verb: 'Inspecionar', box: [W, Hh, 0.12], at: [xc, 0.7, zf - 0.06], eq: nm, view: { pos: new Vector3(xc, 1.4, zf - 1.15), look: new Vector3(xc, 1.0, zf) } });
}

// ======================= QDCC / QDCA (parede) e QSA (poste) =======================
function servAux(c: MCtx, R: Indoor, xWall: number, pw: any, Z: (v: number) => number, H: number) {
  const M = c.M, B = c.b, root = c.root.casa, Dd = 0.22, xf = xWall + Dd; // frente para +x (salão)
  const caixa = (nm: string, sub: string, v0: number, v1: number, y0: number, y1: number) => {
    const z = (Z(v0) + Z(v1)) / 2, w = Math.abs(Z(v1) - Z(v0)); B.box(Dd, y1 - y0, w, M.ral7035, xWall + Dd / 2, (y0 + y1) / 2, z);
    const pr = new Print(w, y1 - y0, 500); pr.rect(w / 2 - 0.16, y1 - y0 - 0.14, 0.32, 0.08, '#ffffff', '#333', 0.002); pr.text(nm + ' - ' + sub, w / 2, y1 - y0 - 0.1, 0.032, { weight: 700 }); pr.warn(w - 0.08, 0.08, 0.06);
    const m = pr.mesh(); m.rotation.y = Math.PI / 2; m.position.set(xf + 0.023, (y0 + y1) / 2, z); return { z, w, m };
  };
  for (const [v0, v1] of [pw.QDCC, pw.QDCA] as number[][]) { const z = (Z(v0) + Z(v1)) / 2; for (const s of [-0.12, 0.12]) { B.cyl(0.03, 1.15, M.galv, xWall + 0.06, 0.58, z + s, 0, 0, 10); B.cyl(0.025, H - 1.95, M.galv, xWall + 0.06, (H + 1.95) / 2, z + s * 0.6, 0, 0, 10); } }
  // QDCC: porta articulada (display e LEDs por dentro)
  { const [v0, v1] = pw.QDCC, b = caixa('QDCC', '125Vcc', v0, v1, 1.15, 1.95); const g = new Group(); g.position.set(xf + 0.01, 0, b.z - b.w / 2); root.add(g); R.qdccDoor = g;
    dbox(0.02, 0.78, b.w - 0.02, M.ral7035, 0, 1.55, b.w / 2, g).castShadow = true; b.m.position.set(0.013, 1.55, b.w / 2); g.add(b.m); dbox(0.03, 0.03, 0.03, M.black, 0.02, 1.62, b.w - 0.05, g);
    const ct = canvasTex(192, 96); R.qdcc = ct; const scr = new Mesh(new PlaneGeometry(0.22, 0.11), new MeshStandardMaterial({ map: ct.t, emissiveMap: ct.t, emissive: 0xffffff, emissiveIntensity: 0.9 })); scr.rotation.y = Math.PI / 2; scr.position.set(xf - 0.02, 1.75, b.z); root.add(scr);
    (R as any).qdccLeds = ['T+', 'T-', 'SUB'].map((_, i) => lamp(0xff3b30, 0.008, xf - 0.02, 1.62, b.z - 0.08 + i * 0.08, root)).map((l) => { l.m.rotation.set(0, 0, Math.PI / 2); return l; });
    for (let k = 0; k < 8; k++) B.box(0.05, 0.1, 0.04, M.white, xf - 0.05, 1.35, b.z - 0.2 + k * 0.055);
    inter(c, { id: 'sa:QDCC', kind: 'cc', label: 'QDCC — distribuição 125 Vcc', verb: 'Inspecionar', box: [0.14, 0.8, b.w], at: [xf + 0.05, 1.55, b.z], eq: 'QDCC', view: { pos: new Vector3(xf + 1.25, 1.55, b.z), look: new Vector3(xf, 1.5, b.z) } });
    part(c, 'sa:QDCC', 'portaqdcc', 'Porta do QDCC', 'qdcc:porta', [g], [0.06, 0.2, 0.1], new Vector3(xf + 0.03, 1.62, b.z + b.w / 2 - 0.05)); }
  // QDCA 380 Vca (fechado) + minidisjuntor geral abaixo
  { const [v0, v1] = pw.QDCA, b = caixa('QDCA', '380 Vca', v0, v1, 1.15, 1.95); root.add(b.m); dbox(0.03, 0.03, 0.03, M.black, xf + 0.02, 1.62, b.z + b.w / 2 - 0.05, root);
    B.box(0.1, 0.22, 0.16, M.ral7035, xWall + 0.05, 0.6, b.z + 0.12); const gl = dbox(0.01, 0.08, 0.1, new MeshStandardMaterial({ color: 0x5f8f6a, roughness: 0.2 }), xWall + 0.105, 0.62, b.z + 0.12, root); void gl;
    const btnG = dcyl(0.018, 0.02, M.black, xWall + 0.11, 0.53, b.z + 0.12, root, 12); btnG.rotation.z = Math.PI / 2;
    inter(c, { id: 'sa:QDCA', kind: 'cc', label: 'QDCA — distribuição 380 Vca (serviços auxiliares)', verb: 'Inspecionar', box: [0.14, 0.8, b.w], at: [xf + 0.05, 1.55, b.z], eq: 'QGCA', view: { pos: new Vector3(xf + 1.3, 1.4, b.z), look: new Vector3(xf, 1.2, b.z) } });
    part(c, 'sa:QDCA', 'geral', 'Rearmar disjuntor geral CA', 'ca:rearme', [btnG], [0.08, 0.08, 0.08], new Vector3(xWall + 0.12, 0.53, b.z + 0.12)); }
  // QSA — quadro de transferência no poste galvanizado
  { const [v0, v1] = pw.QSA, z = (Z(v0) + Z(v1)) / 2, w = Math.abs(Z(v1) - Z(v0)); B.box(0.14, 1.05, 0.14, M.galv, xWall + 0.18, 0.55, z); B.box(0.2, 0.7, w, M.ral7035, xWall + 0.14, 1.45, z);
    const pr = new Print(w, 0.7, 500); pr.rect(w / 2 - 0.22, 0.6, 0.44, 0.05, '#ffffff', '#333', 0.002); pr.text('QSA - QUADRO DE TRANSFERÊNCIA', w / 2, 0.625, 0.022, { weight: 700 });
    for (const [k, a, b2] of [[0, 'A-1', 'A-2'], [1, 'R-1', 'R-2']] as const) { const cx = w * (0.3 + k * 0.4); pr.rect(cx - 0.05, 0.46, 0.1, 0.04, '#e9e6dc', '#555', 0.001); pr.text(a, cx, 0.48, 0.02, { weight: 700 }); pr.text(b2, cx, 0.2, 0.02, { weight: 700 }); pr.text(k ? 'RETIFICADORES' : 'TSA', cx, 0.15, 0.016); }
    const m = pr.mesh(); m.rotation.y = Math.PI / 2; m.position.set(xWall + 0.243, 1.45, z); root.add(m);
    const swt = (k: number) => { const g = new Group(); g.position.set(xWall + 0.25, 1.45, z + w / 2 - w * (0.3 + k * 0.4)); root.add(g); dbox(0.02, 0.12, 0.08, new MeshStandardMaterial({ color: 0x55706a, roughness: 0.5 }), 0, 0, 0, g); const h = dbox(0.03, 0.2, 0.035, M.cream, 0.03, 0, 0, g); h.rotation.x = 0; return g; };
    const sel = swt(0); swt(1); sel.rotation.order = 'YXZ';
    const lamps = ['TSA1', 'TSA2', 'CA', 'AUTO'].map((_, i) => { const l = lamp([0xff3b30, 0xff3b30, 0xf6f6f0, 0xffb02e][i], 0.009, xWall + 0.25, 1.24, z + w / 2 - 0.15 - i * 0.13, root); l.m.rotation.set(0, 0, Math.PI / 2); return l; });
    R.qgca = { lamps, needle: [new Group(), new Group()] }; (R.qgca as any).sel = { rotation: { set z(a: number) { sel.rotation.x = a; } } };
    inter(c, { id: 'sa:QGCA', kind: 'cc', label: 'QSA — quadro de transferência (TSA-1 / TSA-2)', verb: 'Inspecionar', box: [0.2, 0.75, w], at: [xWall + 0.2, 1.45, z], eq: 'QGCA', view: { pos: new Vector3(xWall + 1.3, 1.5, z), look: new Vector3(xWall + 0.2, 1.4, z) } });
    part(c, 'sa:QGCA', 'ats', 'Chave de transferência A-1 / A-2 (TSA-1 · AUTO · TSA-2)', 'ats', [sel], [0.1, 0.26, 0.12], new Vector3(xWall + 0.27, 1.45, z + w / 2 - w * 0.3));
    c.col.push([xWall, z - w / 2, xWall + 0.26, z + w / 2]); }
  // prateleira redonda em mãos-francesas
  { const [v0, v1] = pw.prat, z = (Z(v0) + Z(v1)) / 2; B.cyl(0.3, 0.012, M.aluDull, xWall + 0.32, 1.25, z, 0, 0, 24); for (const s of [-0.12, 0.12]) B.rod(new Vector3(xWall + 0.01, 0.95, z + s), new Vector3(xWall + 0.3, 1.24, z + s), 0.012, M.steelDark, 6); }
  void R; void FONT;
}

// ======================= mesa do supervisório + TV =======================
function mesa(c: MCtx, R: Indoor, x0: number, x1: number, zWall: number) {
  const M = c.M, B = c.b, root = c.root.casa, xc = (x0 + x1) / 2, Wd = x1 - x0, Dp = 0.75, zc = zWall + Dp / 2 + 0.02;
  B.box(Wd, 0.035, Dp, M.woodTop, xc, 0.745, zc);
  for (const s of [-1, 1]) { const x = xc + s * (Wd / 2 - 0.08); B.box(0.06, 0.72, 0.06, M.black, x, 0.37, zc); B.box(0.06, 0.04, Dp - 0.05, M.black, x, 0.03, zc); B.box(0.05, 0.04, Dp - 0.1, M.black, x, 0.71, zc); }
  B.box(Wd - 0.2, 0.05, 0.03, M.black, xc, 0.6, zc - 0.25);
  // monitor + PC + periféricos
  const mon = (w: number, h: number, x: number, y: number, z: number) => { const ct = canvasTex(640, 384); R.monitors.push(ct); B.rbox(w + 0.03, h + 0.03, 0.03, 0.006, M.black, x, y, z);
    const scr = new Mesh(new PlaneGeometry(w, h), new MeshStandardMaterial({ map: ct.t, emissiveMap: ct.t, emissive: 0xffffff, emissiveIntensity: 1.0, roughness: 0.25 })); scr.position.set(x, y, z + 0.016); root.add(scr); };
  B.box(0.24, 0.015, 0.18, M.plastic, xc + 0.1, 0.77, zWall + 0.25); B.box(0.04, 0.22, 0.04, M.plastic, xc + 0.1, 0.88, zWall + 0.25);
  mon(0.56, 0.32, xc + 0.1, 1.04, zWall + 0.27);
  mon(1.0, 0.56, xc + 0.05, 1.95, zWall + 0.05); // TV na parede
  B.box(0.21, 0.44, 0.45, M.black, x1 - 0.2, 0.985, zWall + 0.3); B.box(0.12, 0.2, 0.12, M.black, x1 - 0.42, 0.865, zWall + 0.3);
  B.box(0.45, 0.02, 0.15, M.plastic, xc + 0.1, 0.77, zWall + 0.55); B.box(0.07, 0.02, 0.1, M.plastic, xc + 0.42, 0.77, zWall + 0.55);
  B.box(0.32, 0.03, 0.24, M.ral7016, x0 + 0.25, 0.775, zWall + 0.4, 0.2); B.box(0.24, 0.015, 0.3, M.white, x0 + 0.3, 0.77, zWall + 0.62, -0.1);
  // cadeira
  const cz = zWall + 1.15; B.cyl(0.03, 0.4, M.aluDull, xc, 0.25, cz, 0, 0, 10); for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; B.box(0.3, 0.03, 0.04, M.plastic, xc + Math.cos(a) * 0.15, 0.06, cz + Math.sin(a) * 0.15, -a); }
  B.rbox(0.5, 0.08, 0.48, 0.03, M.chair, xc, 0.48, cz); B.rbox(0.48, 0.6, 0.07, 0.03, M.chair, xc, 0.85, cz + 0.25);
  c.col.push([x0, zWall, x1, zWall + Dp + 0.05]);
  R.deskSeat = { pos: new Vector3(xc + 0.1, 1.22, zWall + 1.0), look: new Vector3(xc + 0.1, 1.06, zWall + 0.27) };
  inter(c, { id: 'scada', kind: 'scada', label: 'Estação de operação — supervisório (comando remoto)', verb: 'Sentar', box: [Wd, 1.2, Dp + 0.3], at: [xc, 0.9, zc], range: 2.2 });
}

// ======================= armário de EPI e ferramentas (azul, portas de vidro) =======================
function armarioEPI(c: MCtx, R: Indoor, x0: number, x1: number, zWall: number) {
  const M = c.M, B = c.b, root = c.root.casa, xc = (x0 + x1) / 2, Wd = x1 - x0, Dp = 0.5, Hh = 1.95, zc = zWall + Dp / 2 + 0.02, zf = zc + Dp / 2;
  B.box(Wd, Hh, 0.02, M.blueCab, xc, Hh / 2 + 0.06, zWall + 0.03); for (const s of [-1, 1]) B.box(0.03, Hh, Dp, M.blueCab, xc + s * (Wd / 2 - 0.015), Hh / 2 + 0.06, zc);
  B.box(Wd, 0.03, Dp, M.blueCab, xc, Hh + 0.06, zc); B.box(Wd, 0.06, Dp, M.blueCab, xc, 0.03, zc); for (const s of [-1, 1]) for (const zz of [zc - 0.15, zc + 0.15]) B.cyl(0.025, 0.03, M.black, xc + s * (Wd / 2 - 0.1), 0.015, zz, 0, 0, 8);
  const lv = [0.1, 0.52, 0.94, 1.36, 1.72]; for (const y of lv) B.box(Wd - 0.06, 0.02, Dp - 0.04, M.ral7035, xc, y, zc);
  B.box(0.3, 0.06, 0.005, M.white, xc - Wd * 0.3, Hh, zf + 0.003);
  const items: Record<string, Group> = {}, doors: Group[] = [];
  for (const s of [-1, 1]) { // porta: hinge na borda, folha em direção ao centro
    const g = new Group(); g.position.set(xc + s * (Wd / 2 - 0.01), 0, zf + 0.012); root.add(g); g.userData.s = s; g.userData.dir = 1; const lw = Wd / 2 - 0.015, ox = -s * lw / 2;
    for (const [w, h, x, y] of [[lw, 0.05, ox, Hh + 0.02], [lw, 0.05, ox, 0.11], [0.05, Hh - 0.1, ox - s * (lw / 2 - 0.025), 1.06], [0.05, Hh - 0.1, ox + s * (lw / 2 - 0.025), 1.06], [lw, 0.08, ox, 1.03]] as const) dbox(w, h, 0.025, M.aluDull, x, y, 0, g);
    for (const yc of [1.5, 0.58]) { const gl = new Mesh(new PlaneGeometry(lw - 0.12, 0.78), M.glass); gl.position.set(ox, yc, 0.002); g.add(gl); }
    dbox(0.02, 0.1, 0.03, M.black, -s * (lw - 0.04), 1.05, 0.02, g); doors.push(g); }
  const put = (uid: string, g: Group) => { items[uid] = g; root.add(g); g.traverse((o: any) => { if (o.isMesh) o.castShadow = true; }); };
  const at = (row: number, k: number, n: number) => new Vector3(x0 + 0.08 + ((Wd - 0.16) * (k + 0.5)) / n, lv[row] + 0.012, zc + 0.02);
  const mk = (row: number, k: number, n: number, f: (g: Group) => void) => { const g = new Group(); g.position.copy(at(row, k, n)); f(g); return g; };
  const bx = (w: number, h: number, dd: number, m: any) => (g: Group) => { dbox(w, h, dd, m, 0, h / 2, 0, g); };
  const helmet = (g: Group) => { const h = new Mesh(new SphereGeometry(0.11, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.helmet); h.position.y = 0.02; g.add(h); dmesh(new CylinderGeometry(0.14, 0.14, 0.01, 20), M.helmet, 0, 0.025, 0.02, g); };
  const hood = (g: Group) => { const m = new MeshStandardMaterial({ color: 0x4b3aa8, roughness: 0.85 }); const b = dmesh(new SphereGeometry(0.13, 14, 10), m, 0, 0.11, 0, g); b.scale.set(1, 0.85, 1.1); const v = dbox(0.16, 0.1, 0.01, M.glassDark, 0, 0.12, 0.13, g); void v; };
  const gloves = (col: number, longo = false) => (g: Group) => { const m = new MeshStandardMaterial({ color: col, roughness: 0.7 }); for (const s of [-1, 1]) { const gl = dmesh(new CapsuleGeometry(0.035, longo ? 0.22 : 0.14, 4, 10), m, s * 0.05, 0.04, 0, g); gl.rotation.x = Math.PI / 2; } };
  const binder = (g: Group) => { for (let k = 0; k < 3; k++) { dbox(0.06, 0.3, 0.26, M.green, -0.07 + k * 0.07, 0.15, 0, g); dbox(0.04, 0.08, 0.004, M.white, -0.07 + k * 0.07, 0.2, 0.132, g); } };
  // prateleira de cima: pastas, maleta laranja (detector), capacetes, rádio
  { const g = new Group(); g.position.copy(at(4, 0, 6)); binder(g); root.add(g); }
  ['detector_mt#1', 'detector_mt#2'].forEach((u, k) => put(u, mk(4, 1 + k, 6, bx(0.2, 0.1, 0.16, new MeshStandardMaterial({ color: 0xe86a1c, roughness: 0.45 })))));
  put('detector_at#1', mk(4, 3, 6, bx(0.26, 0.11, 0.14, M.blue))); ['capacete#1', 'capacete#2'].forEach((u, k) => put(u, mk(4, 4 + k, 6, helmet)));
  // 2ª: roupa FR dobrada, capuzes roxos de arco (protetor facial), balaclavas
  ['vestimenta#1', 'vestimenta#2'].forEach((u, k) => put(u, mk(3, k, 5, (g) => { dbox(0.24, 0.07, 0.3, M.concreteLight, 0, 0.035, 0, g); dbox(0.24, 0.06, 0.3, M.concreteLight, 0, 0.1, 0, g); })));
  ['protetor_facial#1', 'protetor_facial#2'].forEach((u, k) => put(u, mk(3, 2 + k, 5, hood)));
  put('balaclava#1', mk(3, 4, 5, (g) => { dbox(0.16, 0.05, 0.14, M.fr, 0, 0.025, 0, g); dbox(0.16, 0.05, 0.14, M.fr, 0, 0.075, 0, g); })); put('balaclava#2', mk(3, 4, 5, (g) => { g.position.y += 0.1; dbox(0.16, 0.05, 0.14, M.fr, 0, 0.025, 0, g); }));
  // 3ª: luvas de cobertura e isolantes, óculos, protetor auricular, EPI químico, lâmpadas, rádio
  ['luva_cobertura#1', 'luva_cobertura#2'].forEach((u, k) => put(u, mk(2, k, 7, gloves(0xd9cdb5))));
  ['luva_isolante#1', 'luva_isolante#2'].forEach((u, k) => put(u, mk(2, 2 + k, 7, gloves(0x1a1a1a, true))));
  put('oculos#1', mk(2, 4, 7, bx(0.14, 0.05, 0.07, M.plastic))); put('oculos#2', mk(2, 4, 7, (g) => { g.position.y += 0.05; dbox(0.14, 0.05, 0.07, M.plastic, 0, 0.025, 0, g); }));
  put('protetor_auricular#1', mk(2, 5, 7, bx(0.09, 0.07, 0.09, M.yellow))); put('protetor_auricular#2', mk(2, 5, 7, (g) => { g.position.y += 0.07; dbox(0.09, 0.07, 0.09, M.yellow, 0, 0.035, 0, g); }));
  put('radio#1', mk(2, 6, 7, (g) => { dbox(0.06, 0.14, 0.04, M.black, 0, 0.07, 0, g); dcyl(0.006, 0.08, M.black, 0.015, 0.18, 0, g, 6); }));
  put('oculos_ampla#1', mk(1, 0, 6, bx(0.16, 0.07, 0.1, M.glass as any))); put('luva_pvc#1', mk(1, 1, 6, gloves(0x2f7a3c)));
  put('lampada#1', mk(1, 3, 6, bx(0.06, 0.07, 0.06, M.white))); put('lampada#2', mk(1, 4, 6, bx(0.06, 0.07, 0.06, M.white)));
  put('botina#1', mk(1, 5, 6, (g) => { for (const s of [-1, 1]) dbox(0.1, 0.12, 0.26, M.black, s * 0.055, 0.06, 0, g); })); put('botina#2', mk(1, 5, 6, (g) => { g.position.y += 0.13; for (const s of [-1, 1]) dbox(0.1, 0.12, 0.26, M.black, s * 0.055, 0.06, 0, g); }));
  // embaixo: bolsa verde (aterramento temporário), ferramentas de cabo vermelho, tapete enrolado
  put('aterr_mt#1', mk(0, 0, 4, (g) => { const b = dmesh(new CapsuleGeometry(0.14, 0.22, 4, 10), new MeshStandardMaterial({ color: 0x2f5a3a, roughness: 0.85 }), 0, 0.14, 0, g); b.rotation.z = Math.PI / 2; b.scale.set(1, 1, 0.8); }));
  put('manivela_extracao#1', mk(0, 1, 4, (g) => { dbox(0.3, 0.03, 0.05, M.aluDull, 0, 0.02, -0.06, g); dbox(0.08, 0.04, 0.05, M.red, 0.13, 0.03, -0.06, g); }));
  put('alavanca_terra#1', mk(0, 1, 4, (g) => { dbox(0.32, 0.03, 0.05, M.steelDark, 0, 0.05, 0.05, g); dbox(0.1, 0.04, 0.05, M.red, -0.14, 0.06, 0.05, g); }));
  put('manivela_secc#1', mk(0, 2, 4, (g) => { dbox(0.32, 0.04, 0.06, M.galv, 0, 0.02, 0, g); dbox(0.08, 0.05, 0.06, M.red, 0.15, 0.04, 0, g); }));
  put('tapete#1', mk(0, 3, 4, (g) => { const r2 = dcyl(0.08, 0.24, M.rubber, 0, 0.08, 0, g, 16); r2.rotation.z = Math.PI / 2; }));
  R.cabinets.EPI = { doors, open: 0, tgt: 0, items }; R.cabinets.FERR = R.cabinets.EPI; R.cabinets.EPIQ = R.cabinets.EPI;
  c.col.push([x0, zWall, x1, zf + 0.03]);
  inter(c, { id: 'arm:EPI', kind: 'arm', label: 'Armário de EPI e ferramentas', verb: 'Abrir', box: [Wd, Hh, 0.3], at: [xc, Hh / 2, zf + 0.1], eq: 'EPI', view: { pos: new Vector3(xc, 1.4, zf + 1.35), look: new Vector3(xc, 1.0, zf) } });
}

// ======================= quadro LOTO (parede do portão, frente para -x) =======================
function loto(c: MCtx, R: Indoor, xWall: number, z: number) {
  const M = c.M, B = c.b, root = c.root.casa, items: Record<string, Group> = {}, x = xWall - 0.02;
  B.box(0.03, 1.1, 1.3, M.white, x, 1.55, z); B.box(0.035, 0.08, 1.3, M.red, x, 2.14, z);
  const pr = new Print(1.3, 1.1, 360); pr.rect(0, 0.98, 1.3, 0.12, '#c8102e'); pr.text('QUADRO DE BLOQUEIO — LOTO', 0.65, 1.04, 0.05, { color: '#fff', weight: 800 }); pr.text('1 cadeado pessoal por executante · etiqueta preenchida', 0.65, 0.06, 0.035, { color: '#333' });
  const pm = pr.mesh(); pm.position.set(x - 0.017, 1.55, z); pm.rotation.y = -Math.PI / 2; root.add(pm);
  for (let k = 0; k < 6; k++) { const g = new Group(); g.position.set(x - 0.04, 1.62 - Math.floor(k / 3) * 0.32, z + 0.35 - (k % 3) * 0.35); dbox(0.04, 0.04, 0.02, M.aluDull, 0, 0.06, 0, g); const p2 = padlock(M, 0, 0, 0, g); p2.visible = true; p2.rotation.y = -Math.PI / 2; root.add(g); if (k === 0) items['kit_bloqueio#1'] = g; }
  { const g = new Group(); g.position.set(x - 0.3, 0, z + 0.85); for (let k = 0; k < 2; k++) dmesh(new CylinderGeometry(0.02, 0.16, 0.5, 14), M.yellow, 0, 0.27 + k * 0.06, 0, g); dbox(0.36, 0.04, 0.36, M.black, 0, 0.02, 0, g); root.add(g); items['sinalizacao#1'] = g; g.traverse((o: any) => { if (o.isMesh) o.castShadow = true; }); }
  R.cabinets.LOTO = { doors: [], open: 1, tgt: 1, items };
  inter(c, { id: 'arm:LOTO', kind: 'arm', label: 'Quadro de bloqueio (cadeados e etiquetas)', verb: 'Usar', box: [0.4, 1.2, 1.4], at: [x - 0.15, 1.5, z], eq: 'LOTO', view: { pos: new Vector3(x - 0.95, 1.55, z), look: new Vector3(x, 1.45, z) } });
}

// ======================= objetos =======================
function carrinhoDJ(c: MCtx, x: number, z: number) {
  const M = c.M, B = c.b; B.box(0.72, 0.04, 0.78, M.white, x, 0.2, z); B.box(0.72, 0.5, 0.06, M.white, x, 0.47, z + 0.36); for (const s of [-1, 1]) B.box(0.04, 0.55, 0.78, M.white, x + s * 0.34, 0.5, z);
  for (const sx of [-0.3, 0.3]) for (const sz of [-0.33, 0.33]) B.cyl(0.05, 0.04, M.black, x + sx, 0.06, z + sz, Math.PI / 2, 0, 12);
  B.box(0.62, 0.55, 0.45, M.ral7035, x, 1.03, z + 0.1); B.box(0.62, 0.1, 0.5, M.ral7016, x, 1.36, z + 0.08);
  for (let i = 0; i < 3; i++) { B.cyl(0.05, 0.38, M.plastic, x - 0.2 + i * 0.2, 1.05, z - 0.22, 0, 0, 14); for (const yy of [1.17, 0.95]) B.cylZ(0.016, 0.22, M.copper, x - 0.2 + i * 0.2, yy, z - 0.38, 8); }
  B.box(0.3, 0.2, 0.01, M.copperOld, x, 1.05, z + 0.33); c.col.push([x - 0.4, z - 0.45, x + 0.4, z + 0.42]);
}
function extintorCarreta(c: MCtx, x: number, z: number) {
  const M = c.M, B = c.b; B.cyl(0.15, 0.82, M.red, x, 0.62, z + 0.06, 0.1, 0, 18); B.sphere(0.15, M.red, x, 1.04, z + 0.1, 14); B.cyl(0.03, 0.1, M.black, x, 1.18, z + 0.12, 0, 0, 8);
  for (const s of [-1, 1]) { B.cyl(0.2, 0.05, M.black, x + s * 0.22, 0.2, z + 0.1, 0, Math.PI / 2, 18); B.rod(new Vector3(x + s * 0.17, 0.2, z + 0.1), new Vector3(x + s * 0.17, 1.35, z + 0.25), 0.014, M.red, 8); }
  B.rod(new Vector3(x - 0.17, 1.35, z + 0.25), new Vector3(x + 0.17, 1.35, z + 0.25), 0.014, M.red, 8); B.cylX(0.012, 0.44, M.steelDark, x, 0.2, z + 0.1, 8);
  for (let k = 0; k < 3; k++) { const tr = new Mesh(new TorusGeometry(0.12 + k * 0.012, 0.014, 6, 18), M.black); tr.position.set(x + 0.18, 0.7, z - 0.05); tr.rotation.y = Math.PI / 2; c.root.casa.add(tr); }
  c.col.push([x - 0.3, z - 0.25, x + 0.3, z + 0.35]);
}
function salaTSA(c: MCtx, xA: number, xB: number, zN: number, zS: number) {
  // grade de proteção (tubo amarelo + tela soldada) e dois transformadores a seco (resina) com cabos
  const M = c.M, B = c.b, root = c.root.casa, xc = (xA + xB) / 2, Wd = xB - xA, zg = zN + 1.0, Hg = 1.6;
  for (const xx of [xA + 0.12, xc - 0.45, xc + 0.45, xB - 0.12]) B.box(0.05, Hg, 0.05, M.yellow, xx, Hg / 2, zg);
  for (const yy of [0.12, Hg]) B.box(Wd - 0.2, 0.05, 0.05, M.yellow, xc, yy, zg);
  for (const [a, b] of [[xA + 0.12, xc - 0.45], [xc + 0.45, xB - 0.12]] as const) { const m = new Mesh(new PlaneGeometry(b - a - 0.05, Hg - 0.15), M.weldMesh); m.position.set((a + b) / 2, Hg / 2 + 0.05, zg); root.add(m); (M.weldMesh.map as any).repeat.set(4, 3); }
  const gate = new Group(); gate.position.set(xc - 0.45, 0, zg); root.add(gate); for (const yy of [0.12, Hg - 0.02]) dbox(0.9, 0.04, 0.04, M.yellow, 0.45, yy, 0, gate); dbox(0.04, Hg - 0.1, 0.04, M.yellow, 0.88, Hg / 2, 0, gate);
  const gm = new Mesh(new PlaneGeometry(0.84, Hg - 0.16), M.weldMesh); gm.position.set(0.45, Hg / 2 + 0.05, 0); gate.add(gm);
  for (const s of [-1, 1]) { const xs = xc + s * (Wd / 2 - 0.12), Ls = zS - zg - 0.1; for (const yy of [0.12, Hg]) B.box(0.05, 0.05, Ls, M.yellow, xs, yy, zg + Ls / 2); B.box(0.05, Hg, 0.05, M.yellow, xs, Hg / 2, zg + Ls);
    const sm = new Mesh(new PlaneGeometry(Ls - 0.05, Hg - 0.15), M.weldMesh); sm.rotation.y = Math.PI / 2; sm.position.set(xs, Hg / 2 + 0.05, zg + Ls / 2); root.add(sm); }
  c.col.push([xA, zg - 0.05, xB, zg + 0.05]);
  const unid = (x: number, z: number, tag: string) => {
    B.box(1.0, 0.08, 0.55, M.black, x, 0.04, z); B.box(0.95, 0.12, 0.2, M.black, x, 0.16, z);
    for (let i = 0; i < 3; i++) { const cx = x - 0.32 + i * 0.32; B.cyl(0.13, 0.46, M.resin, cx, 0.45, z, 0, 0, 22); B.cyl(0.075, 0.48, M.black, cx, 0.45, z, 0, 0, 14); }
    B.box(0.95, 0.12, 0.2, M.black, x, 0.74, z); for (const s of [-1, 1]) { B.box(1.0, 0.08, 0.03, M.black, x, 0.76, z + s * 0.12); const ey = new Mesh(new TorusGeometry(0.035, 0.01, 6, 14), M.aluDull); ey.position.set(x + s * 0.4, 0.86, z); root.add(ey); }
    for (let i = 0; i < 3; i++) { const cx = x - 0.32 + i * 0.32; B.box(0.03, 0.12, 0.03, M.aluDull, cx, 0.86, z - 0.08); B.path([new Vector3(cx, 0.9, z - 0.08), new Vector3(cx + 0.05, 1.15, z - 0.2), new Vector3(cx + 0.2, 1.25, z - 0.5)], 0.016, M.cable, 10, 6); B.cyl(0.022, 0.08, M.red, cx, 0.95, z - 0.08, 0, 0, 10);
      B.path([new Vector3(cx, 0.65, z + 0.13), new Vector3(cx + 0.1, 0.5, z + 0.25), new Vector3(cx + 0.2, 0.08, z + 0.3)], 0.012, M.blue, 8, 6); }
    plate(c, 'placa', [tag, '13,8 kV / 380-220 V · a seco'], 0.36, 0.12, x + 0.35, 0.16, z - 0.105, Math.PI);
  };
  unid(xc, zN + 1.55, 'TSA-1'); unid(xc + 0.15, zN + 2.4, 'TSA-2');
  inter(c, { id: 'info:TSA', kind: 'info', label: 'Transformadores de serviço auxiliar TSA-1 / TSA-2 (a seco, em grade)', verb: 'Inspecionar', box: [Wd - 0.3, Hg, 0.2], at: [xc, 1.0, zg], eq: 'TSA1', view: { pos: new Vector3(xc, 1.6, zN + 0.3), look: new Vector3(xc, 0.6, zN + 1.9) }, range: 2.4 });
}

// ======================= sala de baterias (2 racks abertos de baterias seladas) =======================
function baterias(c: MCtx, R: Indoor, xW: number, xP: number, zA: number, zS: number, H: number, lumi: (x: number, z: number, zone: 'casa' | 'bateria') => void) {
  const M = c.M, B = c.b, root = c.root.bateria;
  const rack = (x: number, z: number, alongX: boolean, n: number) => { const L = n * 0.34 + 0.1, Dd = 0.42;
    const bx = (w: number, h: number, dd: number, m: any, ox: number, y: number, oz: number) => alongX ? B.box(w, h, dd, m, x + ox, y, z + oz) : B.box(dd, h, w, m, x + oz, y, z + ox);
    for (const sa of [-1, 1]) for (const sd of [-1, 1]) bx(0.04, 1.15, 0.04, M.aluDull, sa * (L / 2 - 0.02), 0.6, sd * (Dd / 2 - 0.02));
    for (const y of [0.18, 0.66, 1.14]) { for (const sd of [-1, 1]) bx(L, 0.04, 0.04, M.aluDull, 0, y, sd * (Dd / 2 - 0.02)); bx(L - 0.05, 0.012, Dd - 0.04, M.aluDull, 0, y + 0.02, 0); }
    for (const y of [0.2, 0.68]) for (let i = 0; i < n; i++) { const o = -L / 2 + 0.22 + i * 0.34; bx(0.32, 0.22, 0.17 + 0.0, M.black, o, y + 0.13, 0); bx(0.33, 0.02, 0.18, M.plastic, o, y + 0.245, 0);
      bx(0.012, 0.03, 0.12, M.white, o - 0.06, y + 0.27, 0); bx(0.012, 0.03, 0.12, M.white, o + 0.06, y + 0.27, 0); bx(0.025, 0.02, 0.025, M.red, o - 0.13, y + 0.265, 0.05); bx(0.025, 0.02, 0.025, M.black, o + 0.13, y + 0.265, 0.05); }
    c.col.push(alongX ? [x - L / 2, z - Dd / 2, x + L / 2, z + Dd / 2] : [x - Dd / 2, z - L / 2, x + Dd / 2, z + L / 2]); return L; };
  const L1 = rack((xW + xP) / 2 - 0.25, zS - 0.25, true, 5); void L1; rack(xW + 0.26, zS - 2.0, false, 5);
  B.path([new Vector3(xW + 0.4, 1.2, zS - 0.25), new Vector3(xW + 0.5, 2.6, zS - 0.15), new Vector3(xP - 0.3, 3.2, zS - 0.15), new Vector3(xP - 0.1, 3.6, zS - 0.15)], 0.02, M.cable, 16, 6);
  // caixas de baterias novas, vassoura, ar-condicionado
  const caixa = new MeshStandardMaterial({ color: 0xa88a5c, roughness: 0.9 });
  for (const [x, z, n] of [[xP - 0.3, zS - 1.6, 4], [xP - 0.3, zS - 2.25, 3], [xW + 0.35, zA + 0.6, 3]] as const) for (let k = 0; k < n; k++) B.box(0.4, 0.28, 0.45, caixa, x, 0.14 + k * 0.29, z + (k % 2) * 0.03);
  B.rod(new Vector3(xW + 0.12, 0.05, zA + 1.3), new Vector3(xW + 0.06, 1.35, zA + 1.15), 0.012, M.green, 6); B.box(0.25, 0.06, 0.08, M.red, xW + 0.14, 0.05, zA + 1.32);
  B.rbox(0.25, 0.3, 0.85, 0.04, M.white, xW + 0.14, 3.55, zS - 0.75); B.box(0.01, 0.03, 0.75, M.plastic, xW + 0.265, 3.44, zS - 0.75);
  // perfilado + luminária
  B.box(0.04, 0.04, zS - zA - 0.4, M.galv, (xW + xP) / 2, H - 0.03, (zA + zS) / 2); lumi((xW + xP) / 2, (zA + zS) / 2, 'bateria');
  const bv = canvasTex(128, 48); R.bat = { v: bv }; B.box(0.16, 0.08, 0.04, M.plastic, (xW + xP) / 2 + 0.5, 1.25, zS - 0.47); const bvm = new Mesh(new PlaneGeometry(0.12, 0.045), new MeshStandardMaterial({ map: bv.t, emissiveMap: bv.t, emissive: 0xffffff, emissiveIntensity: 0.8 })); bvm.position.set((xW + xP) / 2 + 0.5, 1.25, zS - 0.448); root.add(bvm);
  inter(c, { id: 'bat', kind: 'cc', label: 'Banco de baterias 125 Vcc (2 racks, baterias seladas)', verb: 'Inspecionar', box: [1.9, 1.3, 0.5], at: [(xW + xP) / 2 - 0.25, 0.7, zS - 0.3], eq: 'BAT', view: { pos: new Vector3((xW + xP) / 2, 1.5, zS - 2.0), look: new Vector3((xW + xP) / 2 - 0.2, 0.8, zS - 0.3) } });
}
export { FONT, MONO, BoxGeometry, padlock };
