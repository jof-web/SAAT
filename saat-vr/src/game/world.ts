// Mundo 3D do SAAT: monta pátio + casa a partir de plant.json, reflete o estado do sim (só leitura),
// anima manobras, controla portas/portão e a renderização por zona.
import { Group, Mesh, Vector3, SphereGeometry, MeshBasicMaterial, ConeGeometry, AdditiveBlending, PointLight, MeshStandardMaterial, type Object3D } from 'three';
import type { Engine } from './engine';
import { buildMaterials, type Mats } from './materials';
import { vrMat } from './gfx';
import { Batch } from './batch';
import { type MCtx, type Zone, type AABB, type Inter, type Part, human, plate, inter } from './common';
import { insulatorProfile } from './batch';
import { buildIndoor, setLamp, type Indoor } from './models/indoor';
import { seccionadora, disjuntor, pararaios, tpc, tp, transformador, glassString, cerca, poste, entorno, colunaConcreto, vigaConcreto, caboGuarda, torre, muroCortaFogo, trafoReserva, PH, chamberMat, xrayMat, type Yard } from './models/yard';
import { fmt } from '../ui/dom';

export interface HazardPt { p: Vector3; node: string; nivel: 'AT' | 'MT'; kind: 'cond' | 'cabo' | 'barra' }

export class GameWorld {
  M: Mats; zones = {} as Record<Zone, Group>; col: AABB[] = []; inter: Inter[] = []; parts: Part[] = [];
  indoor!: Indoor; yard!: Yard; P: (px: number, py: number) => [number, number];
  fenceRect: [number, number, number, number]; casaRect: [number, number, number, number]; batRect: [number, number, number, number] = [0, 0, 0, 0]; divX: number;
  spawns: Record<string, { x: number; z: number; yaw: number }> = {};
  hazards: HazardPt[] = []; zoneVis: { m: Mesh; nodes: string[] }[] = []; zonesOn = false;
  fire: Group; private fireLight: PointLight; private t = 0; private lastV: any = null; private canT = 0;
  private prev: Record<string, string> = {}; emerg = false;
  onOp: (o: { kind: string; caption: string; cam: Vector3; look: Vector3; xray?: boolean; zone?: string }) => void = () => {};
  doorCol = new Map<string, AABB>();
  victim: Group | null = null; fallen: Group | null = null;
  bayBus: Record<string, string> = {};

  constructor(public E: Engine, public d: any) {
    this.M = buildMaterials();
    const pl = d.plant, k = pl.escala.mPorPx, [ox, oy] = pl.escala.origem; this.P = (px, py) => [(px - ox) * k, (py - oy) * k];
    const [fx1, fz1] = this.P(pl.cerca.rect[0], pl.cerca.rect[1]), [fx2, fz2] = this.P(pl.cerca.rect[2], pl.cerca.rect[3]); this.fenceRect = [fx1, fz1, fx2, fz2];
    const [cx1, cz1] = this.P(pl.casa.rect[0], pl.casa.rect[1]), [cx2, cz2] = this.P(pl.casa.rect[2], pl.casa.rect[3]); this.casaRect = [cx1, cz1, cx2, cz2]; this.divX = this.P(pl.casa.divisoriaX, 0)[0];
    for (const z of ['patio', 'casa', 'bateria', 'externo', 'shell'] as Zone[]) { const g = new Group(); g.name = 'Z:' + z; this.zones[z] = g; E.scene.add(g); }
    this.build();
    this.fire = this.makeFire(); this.fireLight = new PointLight(0xff7a1a, 0, 35, 1.5); this.fire.add(this.fireLight); this.zones.patio.add(this.fire);
    { const I = this.indoor; this.casaRect = I.rect; this.batRect = I.batRect; this.divX = I.batRect[2]; }
    for (const [kk, s] of Object.entries<any>(pl.spawns)) { const [x, z] = this.P(s.px[0], s.px[1]); this.spawns[kk] = { x, z, yaw: ({ N: 0, NE: -Math.PI / 4, E: -Math.PI / 2, SE: (-3 * Math.PI) / 4, S: Math.PI, SW: (3 * Math.PI) / 4, W: Math.PI / 2, NW: Math.PI / 4 } as any)[s.olhar] ?? 0 }; }
    Object.assign(this.spawns, this.indoor.spawns);
    this.bayBus = Object.fromEntries(d.topology.substation.voltageLevels.flatMap((vl: any) => vl.bays).filter((b: any) => b.barra).map((b: any) => [b.id, d.topology.barras.find((x: any) => x.id === b.barra).node])); this.bayBus.P = 'MT1';
  }

  // ======================= construção =======================
  private build() {
    const d = this.d, pl = d.plant, P = this.P, B = new Batch({ chunk: 12 }), M = this.M;
    const c: MCtx = { b: B, M, root: this.zones, col: this.col, inter: this.inter, parts: this.parts, zone: 'patio' };
    const [fx1, fz1, fx2, fz2] = this.fenceRect, fw = fx2 - fx1, fd = fz2 - fz1, mx = (fx1 + fx2) / 2, mz = (fz1 + fz2) / 2;
    // piso do pátio (brita) em placas para recorte por bloco
    B.zone = 'patio'; B.cast = false;
    for (let x = fx1; x < fx2 - 0.01; x += 12) for (let z = fz1; z < fz2 - 0.01; z += 12) { const w = Math.min(12, fx2 - x), dd = Math.min(12, fz2 - z); B.box(w, 0.1, dd, M.gravel, x + w / 2, -0.04, z + dd / 2); }
    B.cast = true; void fw; void fd; void mx; void mz;
    const [ca, , cb, cz] = this.casaRect; const casaDiv: [number, number, number] = [ca, cb, cz + 0.02];
    entorno(c, this.fenceRect, casaDiv, pl.cerca.portoes);
    const gates = cerca(c, this.fenceRect, casaDiv, pl.cerca.portoes, pl.cerca.alturaM, pl.cerca.passoM);
    // ---- pórtico de linha (concreto, hastes para-raios) ----
    const [, gz] = P(0, pl.portico.y), hb = pl.portico.alturaVigaM, hc = pl.portico.alturaColunaM;
    const colX = pl.portico.colunas.map((x: number) => P(x, 0)[0]) as number[];
    const topL = colX.map((x) => colunaConcreto(c, x, gz, hc));
    for (let i = 0; i < colX.length - 1; i++) vigaConcreto(c, colX[i] + 0.3, gz, colX[i + 1] - 0.3, gz, hb, 1.0, 0.45);
    const ltX = pl.lt.ancoragemX.map((x: number) => P(x, 0)[0]) as number[], lt2X = pl.lt2.ancoragemX.map((x: number) => P(x, 0)[0]) as number[];
    const mast = (x: number) => { B.box(0.3, 0.06, 0.3, M.galv, x, hb + 1.03, gz); B.cyl(0.05, 2.6, M.galv, x, hb + 1.03 + 1.3, gz, 0, 0, 8); return new Vector3(x, hb + 3.5, gz); };
    const mL1 = mast(ltX[1]), mL2 = mast(lt2X[1]);
    // ---- torre treliçada e as duas linhas ----
    const tx = pl.torre.xM, tz = pl.torre.zM; B.zone = 'externo'; c.zone = 'externo'; const tw = torre(c, tx, tz, pl.torre.alturaM); B.zone = 'patio'; c.zone = 'patio';
    const ancora = (xs: number[]) => xs.map((x) => { const a = new Vector3(x, hb - 0.02, gz - 0.25), e = new Vector3(x, hb - 0.35, gz - 2.2); glassString(c, a, e, 11); return e; });
    const lineEnd = ancora(ltX), lineEnd2 = ancora(lt2X);
    B.zone = 'externo';
    tw.oeste.forEach((t, i) => B.wire(t, lineEnd[i], 0.016, M.conductor, 2.2, 30, 6)); tw.leste.forEach((t, i) => B.wire(t, lineEnd2[i], 0.016, M.conductor, 2.2, 30, 6));
    caboGuarda(c, tw.peaks[0], mL1, 1.6); caboGuarda(c, tw.peaks[1], mL2, 1.6); B.zone = 'patio';
    plate(c, 'placa', ['LT-01  138 kV'], 2.2, 0.42, ltX[1], hb - 0.55, gz + 0.26, 0, { bg: '#1d252c', fg: '#f4f2ec' });
    plate(c, 'placa', ['LT-02  138 kV · DESLIGADA'], 2.8, 0.42, lt2X[1], hb - 0.55, gz + 0.26, 0, { bg: '#5e666d', fg: '#f4f2ec' });
    const [, zPR] = P(0, pl.lt.pararaios.y), [, zTP] = P(0, pl.lt.tpc.y);
    const prTops = pararaios(c, ltX, zPR, ['PR-LT1-A', 'PR-LT1-B', 'PR-LT1-C']); const tpTops = tpc(c, ltX, zTP, 1);
    const prTops2 = pararaios(c, lt2X, zPR, ['PR-LT2-A', 'PR-LT2-B', 'PR-LT2-C'], false); const tpTops2 = tpc(c, lt2X, zTP, 1);
    plate(c, 'plaqueta', ['PR LT-01'], 0.5, 0.13, ltX[0] - 0.62, 1.95, zPR, -Math.PI / 2); plate(c, 'plaqueta', ['TPC LT-01'], 0.5, 0.13, ltX[0] - 0.62, 1.95, zTP, -Math.PI / 2);
    plate(c, 'plaqueta', ['PR LT-02'], 0.5, 0.13, lt2X[0] - 0.62, 1.95, zPR, -Math.PI / 2); plate(c, 'plaqueta', ['TPC LT-02'], 0.5, 0.13, lt2X[0] - 0.62, 1.95, zTP, -Math.PI / 2);
    ltX.forEach((_x: number, i: number) => { B.wire(lineEnd[i], prTops[i], 0.016, M.conductor, 0.5, 16); B.wire(prTops[i], tpTops[i], 0.016, M.conductor, 0.15, 10); this.hz(lineEnd[i], 'LINE', 'AT'); this.hz(prTops[i], 'LINE', 'AT'); this.hz(tpTops[i], 'LINE', 'AT'); });
    lt2X.forEach((_x: number, i: number) => { B.wire(lineEnd2[i], prTops2[i], 0.016, M.conductor, 0.5, 16); B.wire(prTops2[i], tpTops2[i], 0.016, M.conductor, 0.15, 10); });
    // ---- bays ----
    const pos: Record<string, any> = {}; const dis: Record<string, any> = {}, cbr: Record<string, any> = {}, cabs: Record<string, any> = {};
    for (const b of pl.bays) {
      const [x, z] = P(b.px[0], b.px[1]), id = b.eq || b.rotulo;
      if (b.tipo === 'seccionadora') { const r = seccionadora(c, x, z, id, { terra: b.terra, terraLado: b.terraLado, reserva: b.reserva }); pos[b.id] = r; if (b.eq) dis[b.eq] = r; else r.blades.forEach((g) => (g.rotation.x = -1.45)); }
      else { const r = disjuntor(c, x, z, id, { tc: b.tc, bay: b.bay, cabine: b.cabine, reserva: b.reserva }, cabs); pos[b.id] = r; if (b.eq) cbr[b.eq] = r; else { r.flagI.visible = false; r.mola.visible = false; } }
      plate(c, 'plaqueta', [b.id], 0.32, 0.14, x + PH[2] + 0.62, 0.9, z, -Math.PI / 2, { bg: b.adaptacao ? '#b9a6f0' : '#f2c230' });
    }
    const chain = (a: string, b: string) => { const A = pos[a], Bb = pos[b]; for (let i = 0; i < 3; i++) B.wire(A.termS[i], Bb.termN[i], 0.016, M.conductor, 0.35, 14); };
    ltX.forEach((_: number, i: number) => B.wire(tpTops[i], pos.B1.termN[i], 0.016, M.conductor, 0.3, 12));
    lt2X.forEach((_: number, i: number) => B.wire(tpTops2[i], pos.B2.termN[i], 0.016, M.conductor, 0.3, 12));
    chain('B1', 'B3'); chain('B3', 'B5'); chain('B2', 'B4'); chain('B4', 'B6'); chain('A1', 'B8'); chain('B8', 'A3'); chain('B7', 'B9'); chain('B9', 'A2');
    // ---- pórticos laterais + barra 138 kV em cabo (com flecha) ----
    const PLt = pl.porticosLaterais, PW = PLt.xM[0], PE = PLt.xM[1], hl = PLt.alturaM, vl = PLt.vigaM;
    const tops: Record<string, Vector3> = {};
    for (const x of [PW, PE]) { PLt.zM.forEach((z: number, i: number) => { tops[`${x}|${z}`] = colunaConcreto(c, x, z, hl, { alongZ: true }); if (i) vigaConcreto(c, x, PLt.zM[i - 1] + 0.3, x, z - 0.3, vl, 0.7, 0.45); }); }
    const bb = pl.barramento, [, bz] = P(0, bb.y), by = bb.alturaM, bzs = [bz - bb.faseDzM, bz, bz + bb.faseDzM], fl = bb.flechaM;
    const bx1 = PW + 2.4, bx2 = PE - 2.4, busY = (x: number) => { const t = (x - bx1) / (bx2 - bx1); return by - 0.25 - fl * 4 * t * (1 - t); };
    for (const z of bzs) { glassString(c, new Vector3(PW + 0.25, by + 0.2, z), new Vector3(bx1, by - 0.25, z), 9); glassString(c, new Vector3(PE - 0.25, by + 0.2, z), new Vector3(bx2, by - 0.25, z), 9);
      B.wire(new Vector3(bx1, by - 0.25, z), new Vector3(bx2, by - 0.25, z), 0.02, M.conductor, fl, 40, 6); }
    plate(c, 'placa', ['BARRAMENTO 138 kV'], 1.6, 0.32, PW + 0.26, 3.2, bzs[1], Math.PI / 2, { bg: '#1d252c', fg: '#f4f2ec' });
    const toBus = (r: any, side: 'termN' | 'termS') => r[side].forEach((t: Vector3, i: number) => B.wire(t, new Vector3(t.x, busY(t.x), bzs[i]), 0.016, M.conductor, 0.3, 14));
    toBus(pos.B5, 'termS'); toBus(pos.B6, 'termS'); toBus(pos.B7, 'termN'); toBus(pos.A1, 'termN');
    const tpx = PW + 3.0; bzs.forEach((z) => { const t = tp(c, [tpx], z); B.wire(t[0], new Vector3(tpx, busY(tpx), z), 0.016, M.conductor, 0.2, 10); });
    plate(c, 'plaqueta', ['TP BARRA'], 0.5, 0.13, tpx - 0.62, 1.95, bzs[1], -Math.PI / 2);
    for (let x = bx1; x <= bx2; x += 2.6) for (const z of bzs) this.hz(new Vector3(x, busY(x), z), 'BAT', 'AT');
    // ---- transformadores, pórticos retos sobre cada um, muros corta-fogo, TR-03 reservado ----
    const trf: Record<string, any> = {};
    for (const t of pl.trafos) { const [x, z] = P(t.px[0], t.px[1]); trf[t.id] = transformador(c, x, z, t.id, t.tag); }
    const PT = pl.porticosTrafo, zp = PT.zM, TY = trf.T1.center.z;
    for (const [xa, xb] of PT.colunasM as [number, number][]) { for (const x of [xa, xb]) { const k = `${x}|${zp}`; if (!tops[k]) tops[k] = colunaConcreto(c, x, zp, PT.alturaM); } vigaConcreto(c, xa + 0.3, zp, xb - 0.3, zp, PT.vigaM, 0.6, 0.4); }
    const conT = (b: string, T: string) => pos[b].termS.forEach((s: Vector3, i: number) => { const h = trf[T].hv[i], a = new Vector3(h.x, PT.vigaM, zp), e = new Vector3(h.x, PT.vigaM - 0.9, zp); glassString(c, a, e, 6); B.wire(s, e, 0.016, M.conductor, 0.5, 14); B.wire(e, h, 0.016, M.conductor, 0.2, 10); });
    conT('A2', 'T1'); conT('A3', 'T2');
    for (const T of Object.keys(trf)) for (const h of trf[T].hv) this.hz(h, T + 'c', 'AT');
    for (const m of pl.murosCortaFogo) muroCortaFogo(c, m.xM, TY, m.compM, m.alturaM);
    trafoReserva(c, pl.trafoReserva.xM, TY, pl.trafoReserva.tag);
    for (const zz of [P(0, 497)[1], P(0, 597)[1], P(0, 643)[1]]) for (const dx of PH) B.box(0.7, 0.3, 0.7, M.concrete, pl.trafoReserva.xM + dx, 0.1, zz);
    // ---- cabos para-raios: todas as hastes interligadas ----
    const T = (x: number, z: number) => tops[`${x}|${z}`];
    for (let i = 0; i < topL.length - 1; i++) caboGuarda(c, topL[i], topL[i + 1], 0.7);
    caboGuarda(c, topL[0], T(PW, PLt.zM[0]), 0.7); caboGuarda(c, topL[topL.length - 1], T(PE, PLt.zM[0]), 0.7);
    for (const x of [PW, PE]) for (let i = 1; i < PLt.zM.length; i++) caboGuarda(c, T(x, PLt.zM[i - 1]), T(x, PLt.zM[i]), 0.5);
    for (const z of PLt.zM.slice(0, -1)) caboGuarda(c, T(PW, z), T(PE, z), 1.0);
    const row = Object.keys(tops).filter((k) => +k.split('|')[1] === zp).map((k) => tops[k]).sort((a, b2) => a.x - b2.x);
    for (let i = 0; i < row.length - 1; i++) caboGuarda(c, row[i], row[i + 1], 0.45);
    // ---- canaletas ----
    for (const tr of pl.trincheiras) { const [x, z1] = P(tr.x, tr.y[0]), [, z2] = P(tr.x, tr.y[1]);
      B.box(0.9, 0.12, z2 - z1, M.concrete, x, 0.03, (z1 + z2) / 2); for (let z = z1 + 0.25; z < z2 - 0.2; z += 0.52) { B.box(0.82, 0.05, 0.5, M.concreteLight, x, 0.11, z); B.box(0.08, 0.01, 0.03, M.steelDark, x, 0.14, z); }
      for (const cy of tr.caixas || []) { const [, zc] = P(tr.x, cy); B.box(1.3, 0.16, 1.3, M.concrete, x, 0.05, zc); B.box(1.0, 0.03, 1.0, M.checker, x, 0.14, zc); } }
    // ---- iluminação ----
    const lights: Mesh[] = [];
    for (const [ix, iy] of pl.iluminacao) { const [x, z] = P(ix, iy); const xx = Math.min(Math.max(x, fx1 + 0.8), fx2 - 0.8), zz = Math.min(Math.max(z, fz1 + 0.8), fz2 - 0.8); lights.push(...poste(c, xx, zz)); }
    // ---- casa de comando ----
    this.indoor = buildIndoor(c, d, P);
    // ---- ponto de encontro ----
    c.zone = 'externo'; B.zone = 'externo';
    const [ex, ez] = P(pl.pontoEncontro.px[0], pl.pontoEncontro.px[1]); B.cyl(0.05, 2.5, M.galv, ex, 1.25, ez, 0, 0, 10); B.box(2.4, 0.06, 2.4, M.white, ex, 0.0, ez);
    plate(c, 'verde', ['PONTO DE', 'ENCONTRO'], 1.2, 0.7, ex, 2.35, ez + 0.03, 0); plate(c, 'verde', ['PONTO DE', 'ENCONTRO'], 1.2, 0.7, ex, 2.35, ez - 0.03, Math.PI);
    inter(c, { id: 'encontro', kind: 'encontro', label: 'Ponto de encontro', verb: 'Usar', box: [1.6, 3, 1.6], at: [ex, 1.5, ez] });
    c.zone = 'patio'; B.zone = 'patio';
    // ---- zonas NR-10 visíveis ----
    this.buildZoneVis();
    B.flush(this.E.scene); for (const z of Object.keys(this.zones) as Zone[]) for (const g of this.E.scene.children.filter((o) => o.name === 'zona:' + z)) { this.E.scene.remove(g); this.zones[z].add(g); }
    this.yard = { dis, cbr, cabs, trf, gates, zones: [], lights, bus: { x1: bx1, x2: bx2, y: by, zs: bzs } };
    for (const [id, r] of Object.entries<any>(dis)) { const eq = this.findEq(id); if (!eq) continue; for (let i = 0; i < 3; i++) { this.hz(r.termN[i], eq.nodes[0], 'AT'); this.hz(r.termS[i], eq.nodes[1], 'AT'); } }
    for (const [id, r] of Object.entries<any>(cbr)) { const eq = this.findEq(id); if (!eq) continue; for (let i = 0; i < 3; i++) { this.hz(r.termN[i], eq.nodes[0], 'AT'); this.hz(r.termS[i], eq.nodes[1], 'AT'); } }
    // pontos de risco MT: terminais de cabo nos cubículos (expostos só com a tampa traseira removida)
    for (const [bay, cu] of Object.entries(this.indoor.cub)) { if (!['al', 'in'].includes(cu.kind)) continue; const node = cu.kind === 'al' ? bay + 'c' : (bay === 'T1M' ? 'T1m' : 'T2m');
      for (let i = 0; i < 3; i++) this.hazards.push({ p: new Vector3(cu.x - 0.22 + i * 0.22, 1.0, cu.zc - 0.8 + 0.25), node, nivel: 'MT', kind: 'cabo' }); }
    this.finishZones();
  }
  private hz(p: Vector3, node: string, nivel: 'AT' | 'MT') { this.hazards.push({ p: p.clone(), node, nivel, kind: 'cond' }); }
  private buildZoneVis() {
    const fx = this.d.kb.nr10Zonas.faixas.find((f: any) => 138 >= f.de && 138 < f.ate); const rr = fx.rr, rc = fx.rc;
    const mR = new MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.16, depthWrite: false }), mC = new MeshBasicMaterial({ color: 0xffd60a, transparent: true, opacity: 0.05, depthWrite: false });
    const sR = new SphereGeometry(rr, 14, 10), sC = new SphereGeometry(rc, 16, 12);
    (this as any)._zoneMk = (p: Vector3, nodes: string[]) => { for (const [g, m] of [[sC, mC], [sR, mR]] as const) { const z = new Mesh(g, m); z.position.copy(p); z.visible = false; z.renderOrder = 2; this.zones.patio.add(z); this.zoneVis.push({ m: z, nodes }); } };
  }
  /** Chamado após construir: cria esferas de zona para os pontos AT (amostrados). */
  finishZones() { const mk = (this as any)._zoneMk; const seen = new Set<string>(); for (const h of this.hazards) { if (h.nivel !== 'AT') continue; const k = `${h.node}|${Math.round(h.p.x)}|${Math.round(h.p.z)}|${Math.round(h.p.y)}`; if (seen.has(k)) continue; seen.add(k); mk(h.p, [h.node]); } }
  findEq(id: string) { for (const vl of this.d.topology.substation.voltageLevels) for (const b of vl.bays) for (const e of b.equipment) if (e.id === id) return e; return null; }
  private makeFire() {
    const g = new Group(); g.visible = false; const fm = (c: number) => new MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 14; i++) { const m = new Mesh(new ConeGeometry(0.4 + Math.random() * 0.4, 1.8 + Math.random() * 1.4, 8), fm(i % 3 ? 0xff7a1a : 0xffd04a)); m.position.set((Math.random() - 0.5) * 3, 4.3, (Math.random() - 0.5) * 2); m.userData.ph = Math.random() * 6; g.add(m); }
    const sm = new MeshStandardMaterial({ color: 0x2b2b2b, transparent: true, opacity: 0.5, depthWrite: false, roughness: 1 }); const sg = new SphereGeometry(0.6, 10, 8);
    for (let i = 0; i < 12; i++) { const m = new Mesh(sg, sm); m.scale.setScalar(1.8); m.position.set((Math.random() - 0.5) * 1.5, 5.5 + i * 1.2, (Math.random() - 0.5)); m.userData.smoke = i; g.add(m); }
    return g;
  }

  // ======================= estado → cena =======================
  update(v: any, flags: Record<string, any>) {
    const s = v.s, der = v.der, cc = v.ccOk, an = s.anomalias || []; this.lastV = v; const Y = this.yard, I = this.indoor;
    for (const [id, r] of Object.entries(Y.dis)) { const b = s.eq[id]; r.tgt = b.moving === 'opening' || (b.state === 'open' && b.moving !== 'closing') ? 1 : 0; r.lock.visible = b.loto?.length > 0;
      if (r.terraId) { const e = s.eq[r.terraId]; r.eTgt = e.moving === 'closing' || (e.state === 'closed' && e.moving !== 'opening') ? 1 : 0; if (r.earthLock) r.earthLock.visible = e.loto?.length > 0;
        this.watch(r.terraId, `${e.state}|${e.moving}`, () => this.onOp({ kind: 'earth', caption: `${r.terraId} · ${e.moving === 'closing' || e.state === 'closed' ? 'FECHANDO a lâmina de terra' : 'ABRINDO a lâmina de terra'}`, cam: new Vector3(r.cx + PH[2] + 3.4, 4.0, r.cz + 4.2), look: new Vector3(r.cx, 3.4, r.cz) })); }
      this.watch(id, `${b.state}|${b.moving}`, () => this.onOp({ kind: 'dis', caption: `${id} · ${b.moving === 'opening' ? 'ABRINDO' : b.moving === 'closing' ? 'FECHANDO' : b.state === 'open' ? 'ABERTA' : 'FECHADA'} · motor ≈ 4 s · abertura visível`, cam: new Vector3(r.cx + PH[2] + 2.8, 5.4, r.cz + 3.6), look: new Vector3(r.cx + PH[2], 4.5, r.cz) })); }
    for (const [id, r] of Object.entries(Y.cbr)) { const b = s.eq[id], fech = b.state === 'closed'; r.flagI.visible = fech; r.flagO.visible = !fech; r.mola.visible = !!b.mola; r.tgt = fech ? 0 : 1;
      this.watch(id, b.state, () => { if (!this.prev['ini:' + id]) return; r.arcT = fech ? 0 : 0.5; this.onOp({ kind: 'cbr', caption: `${id} · ${fech ? 'FECHOU' : 'ABRIU'} em ${this.d.params.disjuntor.at.aberturaMs} ms · câmara SF6 em corte (câmera lenta)`, cam: new Vector3(r.cx + 1.8, 5.5, r.cz + 2.3), look: new Vector3(r.cx, 5.2, r.cz), xray: true }); });
      this.prev['ini:' + id] = '1'; }
    for (const [bay, cab] of Object.entries(Y.cabs)) { for (const [k, l] of Object.entries(cab.lamps)) { if (k === 'mola') { const brk = Object.keys(Y.cbr).find((x) => s.eq[x] && this.d.plant.bays.find((bb: any) => bb.eq === x)?.bay === bay); setLamp(l, cc && !!brk && s.eq[brk].mola); continue; } const [eq, t] = k.split(':'); const st = s.eq[eq]?.state; setLamp(l, cc && (t === 'c' ? st === 'closed' : st === 'open')); }
      const sel = this.findSel(bay); cab.sel.rotation.z = s.eq[sel]?.lr === 'local' ? 0.75 : -0.75; cab.lock.visible = s.eq[sel]?.loto.length > 0; }
    for (const [bay, cu] of Object.entries(I.cub)) {
      if (cu.kind === 'tp' || cu.kind === 'tsa') { cu.lamps.forEach((l) => setLamp(l, cc && !!der.energ[this.bayBus[bay] || (['TSA1', 'TP1'].includes(bay) ? 'MT1' : 'MT2')])); continue; }
      const brk = '52-' + bay, b = s.eq[brk]; if (!b) continue;
      this.watch('cub:' + brk, `${b.state}|${b.pos}`, () => this.onOp({ kind: 'cub', zone: 'casa', caption: `${brk} · ${b.state === 'closed' ? 'FECHADO' : 'ABERTO'} · carrinho em ${String(b.pos).toUpperCase()}`, cam: new Vector3(cu.x + 1.1, 1.75, cu.zf + 2.3), look: new Vector3(cu.x, 1.15, cu.zf) }));
      const burnt = an.includes('lampada_' + bay), al = s.alarmes.some((a: any) => a.ativo && a.key.includes(brk));
      const on = [b.state === 'closed' && !burnt, b.state === 'open', !!b.mola, al];
      if (!(cu as any).testeAte || performance.now() > (cu as any).testeAte) cu.lamps.forEach((l, i) => setLamp(l, cc && on[i])); else cu.lamps.forEach((l, i) => setLamp(l, cc && !(burnt && i === 0)));
      (cu as any).tPosT = ({ servico: 0, teste: 0.17, extraido: 0.34 } as any)[b.pos] ?? 0; (cu as any).doorT = b.porta ? 1 : 0;
      cu.flagI!.visible = b.state === 'closed'; cu.flagO!.visible = b.state !== 'closed'; cu.mola!.visible = !!b.mola;
      cu.lockDoor!.visible = b.loto.length > 0; cu.lock43!.visible = s.eq['43-' + bay]?.loto.length > 0; cu.sel!.rotation.z = s.eq['43-' + bay]?.lr === 'local' ? 0.8 : -0.8;
      (cu.therm!.material as MeshStandardMaterial).color.setHex(an.includes('temp_' + bay) ? 0xc8102e : 0x2e9b52);
      const cable = cu.kind === 'al' ? bay + 'c' : this.findEq(brk)?.nodes?.[0];
      cu.vpis.forEach((l) => setLamp(l, !!der.energ[cable || '']));
      if (cu.earthInd) { const ea = s.eq['89T-' + bay]?.state === 'closed'; cu.earthInd.rotation.z = ea ? Math.PI / 2 : 0; (cu.earthInd.userData.tag as Mesh).visible = ea;
        if (cu.sign) cu.sign.visible = !!flags.sinalizacao && !flags.sinalizacao_remover && bay === 'AL1'; if (cu.barrier) cu.barrier.visible = !!flags.barreira && !flags.barreira_remover && bay === 'AL1'; }
      else { if (cu.sign) cu.sign.visible = false; }
      if (cu.tempGround) cu.tempGround.visible = !!s.terraTemp?.[bay === 'T1M' ? 'T1m' : 'T2m'];
    }
    for (const [T, t] of Object.entries(Y.trf)) { const st = s.tr[T]; t.vent = st.vent;
      const ang = (val: number, lo: number, hi: number) => Math.PI * (0.75 - Math.min(1, Math.max(0, (val - lo) / (hi - lo))) * 1.5);
      t.panel.oil.rotation.z = ang(st.oleo, 0, 120) - Math.PI / 2; t.panel.wnd.rotation.z = ang(st.enrol, 0, 140) - Math.PI / 2; t.panel.lvl.rotation.z = (st.nivel === 'baixo' ? 0.9 : -0.4);
      setLamp(t.panel.lamps.G1, cc && st.vent >= 1); setLamp(t.panel.lamps.G2, cc && st.vent >= 2); setLamp(t.panel.lamps['63'], cc && st.buch > 0); setLamp(t.panel.lamps['26'], cc && st.alvos?.includes('26'));
      t.panel.lock.visible = s.eq['90-' + T]?.loto?.length > 0; (t.buch.material as MeshStandardMaterial).color.setHex(st.buch ? 0xd8d8d8 : 0xfff2b0); }
    if (I.qdccDoor) I.qdccDoor.rotation.y = an.includes('porta_QDCC') ? -1.3 : 0;
    const fT = Object.keys(Y.trf).find((T) => s.tr[T].fogo); this.fire.visible = !!fT; if (fT) { const c0 = Y.trf[fT].center; this.fire.position.set(c0.x, 0, c0.z); }
    const semCA = !s.ca.ok; (this.M.emissiveWhite as MeshStandardMaterial).emissiveIntensity = semCA ? 0.05 : 2.2; for (const L of I.lights) L.intensity = semCA ? 0.6 : 6;
    this.emerg = !!s.emergencia;
    for (const [eq, g, r] of I.pspc) { const st = eq ? s.eq[eq]?.state : undefined, ok = cc && !!eq && st != null, fe = st === 'closed' || st === 'ok'; setLamp(g, ok && !fe); setLamp(r, ok && fe); }
    if (I.qgca) { setLamp(I.qgca.lamps[0], s.ca.ok && s.ca.ats === 'TSA1'); setLamp(I.qgca.lamps[1], s.ca.ok && s.ca.ats === 'TSA2'); setLamp(I.qgca.lamps[2], s.ca.ok); setLamp(I.qgca.lamps[3], s.ca.auto); I.qgca.needle[0].rotation.z = s.ca.ok ? -0.3 : 0.9; I.qgca.needle[1].rotation.z = s.ca.ok ? 0.1 : 0.9; (I.qgca as any).sel.rotation.z = s.ca.auto ? 0 : s.ca.ats === 'TSA1' ? 0.8 : -0.8; }
    for (const z of this.zoneVis) z.m.visible = this.zonesOn && z.nodes.some((n) => der.energ[n]);
  }
  private findSel(bay: string) { const b = this.d.topology.substation.voltageLevels[0].bays.find((x: any) => x.id === bay); return b?.equipment.find((e: any) => e.type === 'SEL')?.id || ''; }
  private watch(key: string, sig: string, fn: () => void) { if (this.prev[key] !== undefined && this.prev[key] !== sig) fn(); this.prev[key] = sig; }

  /** Desenha visores (2–4 Hz) só da zona onde o jogador está. */
  private canvases(area: string) {
    const v = this.lastV; if (!v) return; const s = v.s, der = v.der, cc = v.ccOk, I = this.indoor, sim = (this as any).sim;
    if (area === 'casa' || area === 'bateria') {
      for (const [bay, cu] of Object.entries(I.cub)) { if (!cu.lcd) continue; const brk = '52-' + bay, b = s.eq[brk]; const g = cu.lcd.g; g.fillStyle = cc ? '#0e2a3a' : '#050607'; g.fillRect(0, 0, 256, 112);
        if (cc) { g.fillStyle = '#bfe8ff'; g.font = '600 21px "IBM Plex Mono",monospace'; const rel0 = sim?.relayByBrk?.[brk], rt0 = rel0 ? s.rel[rel0.id] : null, pg = (cu as any).page || 0;
          const L = pg === 1 && rt0 ? [`${brk}  79`, `79 ${rt0.r79 ? 'EM SERVIÇO' : 'BLOQUEADO'}`, `ciclo ${rt0.ciclo}`] : pg === 2 && rel0 ? [`${brk} AJUSTES`, ...Object.entries<any>(rel0.el).slice(0, 2).map(([k, e]) => `${k} ${e.pickupA} A`)] : pg === 2 ? [`${brk}`, '25: sincronismo', `ΔTAP ${Math.abs(s.tr.T1.tap - s.tr.T2.tap)}`] : [`${brk}`, `IA ${fmt(der.I[brk] || 0)} A`, `${b.state === 'closed' ? 'FECHADO' : 'ABERTO'} ${String(b.pos || '').toUpperCase()}`];
          if (rt0?.alvos?.length && pg === 0) L[0] = `TRIP ${rt0.alvos.join(' ')}`; L.forEach((t, i) => g.fillText(t, 10, 28 + i * 30)); }
        cu.lcd.t.needsUpdate = true;
        if (cu.meter) { const m = cu.meter.g; m.fillStyle = '#071007'; m.fillRect(0, 0, 160, 64); if (cc) { m.fillStyle = '#ff5a3c'; m.font = '700 40px "IBM Plex Mono",monospace'; m.textAlign = 'right'; m.fillText(String(Math.round(der.I[brk] || 0)).padStart(4, ' '), 150, 48); m.textAlign = 'left'; } cu.meter.t.needsUpdate = true; }
        const rel = sim?.relayByBrk?.[brk]; if (rel && cu.leds.length) { const rt = s.rel[rel.id]; const names = cu.kind === 'al' ? ['TRIP', '50', '51', '50N', '51N', '79', '86', 'BF'] : ['TRIP', '51', '51G', 'BF', '86'];
          names.forEach((n, i) => { if (!cu.leds[i]) return; let on = false; if (n === 'TRIP') on = rt.alvos.length > 0; else if (n === '79') on = !rt.r79 || rt.ciclo === 'bloqueado'; else if (n === '86') on = !!s.locks[rel['86']]; else if (n === 'BF') on = !!s.locks[rel.bf?.['86']]; else on = rt.alvos.includes(n); setLamp(cu.leds[i], cc && on); }); } }
      // monitores da mesa
      I.monitors.forEach((m, idx) => drawMonitor(m, idx, v));
      for (const [nm, rt] of Object.entries(I.rt)) { if (nm.includes(':')) continue; const g = rt.g;
        if (rt.c.width === 288) { // retificador: 3 instrumentos analógicos (A saída, A bateria, V)
          const on = s.ca.ok && s.cc.rt[nm], vals = [on ? (18 + (s.cc.v < 128 ? 25 : 0)) / 60 : 0, on ? (s.cc.v < 128 ? 0.55 : 0.12) : 0, (s.cc.v || 0) / 150];
          g.fillStyle = '#16181a'; g.fillRect(0, 0, 288, 96); ['A', 'A', 'V'].forEach((u, k) => { const x0 = 6 + k * 96; g.fillStyle = '#f2f1ec'; g.fillRect(x0, 6, 84, 84); g.strokeStyle = '#222'; g.lineWidth = 1.5; g.beginPath(); g.arc(x0 + 42, 74, 52, -Math.PI * 0.86, -Math.PI * 0.14); g.stroke();
            if (k === 1) { g.strokeStyle = '#c8102e'; g.lineWidth = 4; g.beginPath(); g.arc(x0 + 42, 74, 50, -Math.PI * 0.86, -Math.PI * 0.68); g.stroke(); }
            g.fillStyle = '#111'; g.font = '600 15px "Barlow Condensed",sans-serif'; g.fillText(u, x0 + 8, 84); const a = -Math.PI * 0.86 + Math.max(0, Math.min(1, vals[k])) * Math.PI * 0.72; g.strokeStyle = '#111'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0 + 42, 74); g.lineTo(x0 + 42 + Math.cos(a) * 46, 74 + Math.sin(a) * 46); g.stroke(); g.beginPath(); g.arc(x0 + 42, 74, 6, 0, 7); g.fill(); });
          rt.t.needsUpdate = true; const leds = (I.rt as any)[nm + ':leds']; if (leds) { setLamp(leds[0], s.ca.ok); setLamp(leds[1], s.ca.ok && s.cc.rt[nm]); setLamp(leds[2], s.ca.ok && s.cc.rt[nm]); setLamp(leds[3], !s.cc.rt[nm] || !s.ca.ok); } continue; }
        g.fillStyle = '#071007'; g.fillRect(0, 0, 192, 96); if (s.ca.ok && s.cc.rt[nm]) { g.fillStyle = '#7dff8a'; g.font = '600 26px "IBM Plex Mono",monospace'; g.fillText(`${fmt(s.cc.v, 1)} V`, 12, 40); g.fillText(`${fmt(18 + (s.cc.v < 128 ? 25 : 0), 1)} A`, 12, 78); } rt.t.needsUpdate = true;
        const leds = (I.rt as any)[nm + ':leds']; if (leds) { setLamp(leds[0], s.ca.ok); setLamp(leds[1], s.ca.ok && s.cc.rt[nm]); setLamp(leds[2], s.ca.ok && s.cc.rt[nm]); setLamp(leds[3], !s.cc.rt[nm] || !s.ca.ok); } }
      if (I.qdcc) { const g = I.qdcc.g; g.fillStyle = '#071007'; g.fillRect(0, 0, 192, 96); g.fillStyle = s.cc.v < this.d.params.cc.alarmeV ? '#ff5a3c' : '#7dff8a'; g.font = '600 30px "IBM Plex Mono",monospace'; g.fillText(`${fmt(s.cc.v, 1)} V`, 14, 58); I.qdcc.t.needsUpdate = true; const ql = (I as any).qdccLeds; if (ql) { setLamp(ql[0], s.cc.terra); setLamp(ql[1], false); setLamp(ql[2], s.cc.v < this.d.params.cc.alarmeV); } }
      if (I.bat) { const g = I.bat.v.g; g.fillStyle = '#071007'; g.fillRect(0, 0, 128, 48); g.fillStyle = '#7dff8a'; g.font = '600 26px "IBM Plex Mono",monospace'; g.fillText(`${fmt(s.cc.v, 1)}V`, 6, 34); I.bat.v.t.needsUpdate = true; }
      if (I.clock) { const g = I.clock.g, d = new Date(sim ? sim.wallBase + s.t : Date.now()); g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#111'; g.lineWidth = 3; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.stroke();
        for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; g.beginPath(); g.moveTo(64 + Math.sin(a) * 50, 64 - Math.cos(a) * 50); g.lineTo(64 + Math.sin(a) * 56, 64 - Math.cos(a) * 56); g.stroke(); }
        const hh = ((d.getHours() % 12) + d.getMinutes() / 60) / 12, mm = d.getMinutes() / 60; for (const [f, L, w] of [[hh, 30, 5], [mm, 46, 3]] as const) { g.lineWidth = w; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.sin(f * Math.PI * 2) * L, 64 - Math.cos(f * Math.PI * 2) * L); g.stroke(); } I.clock.t.needsUpdate = true; }
      for (const [nm, p] of Object.entries(I.panels)) { if (!p.lcd) continue; const T = nm.includes('T1') ? 'T1' : nm.includes('T2') ? 'T2' : null; const g = p.lcd.g; g.fillStyle = cc ? '#0e2a3a' : '#050607'; g.fillRect(0, 0, 256, 96);
        if (cc) { g.fillStyle = '#bfe8ff'; g.font = '600 20px "IBM Plex Mono",monospace'; if (T) { g.fillText(`IAT ${fmt(der.I['52-' + T] || 0, 1)} A`, 8, 30); g.fillText(`Óleo ${fmt(s.tr[T].oleo)}°C`, 8, 62); } else if (nm.includes('LT')) { g.fillText(`LT-01 ${der.energ.LINE ? '138 kV' : 'SEM TENSÃO'}`, 8, 30); g.fillText(`52-LT1 ${s.eq['52-LT1'].state === 'closed' ? 'FECH' : 'ABER'}`, 8, 62); } else { g.fillText(`MT-1 ${fmt(der.barras['MT-1'].kV, 2)} kV`, 8, 30); g.fillText(`MT-2 ${fmt(der.barras['MT-2'].kV, 2)} kV`, 8, 62); } }
        p.lcd.t.needsUpdate = true;
        if (T) { const st = s.tr[T]; const lk = !!s.locks['86T-' + T]; [lk, st.alvos?.includes('87T'), st.buch > 0, st.rps, st.alvos?.includes('26'), st.alvos?.includes('49'), false, false].forEach((on, i) => p.leds[i] && setLamp(p.leds[i], cc && !!on)); }
        p.leds.slice(8).forEach((l, i) => setLamp(l, cc && i < s.alarmes.filter((a: any) => a.ativo).length)); }
      for (const [nm, p] of Object.entries(I.panels)) if (nm.startsWith('UTR')) p.leds.forEach((l, i) => setLamp(l, cc && (i % 3 !== 0 || Math.sin(this.t * 7 + i) > 0)));
    }
    if (area === 'patio' || area === 'externo') {
      for (const [id, r] of Object.entries(this.yard.cbr)) { const ref = sim?.leitura?.('sf6:' + id); r.sf6.forEach((g) => { const nd = g.userData.needle as Mesh; const val = ref?.valor ?? 6; const a = Math.PI * (0.75 - ((Math.min(7, Math.max(4.5, val)) - 4.5) / 2.5) * 1.5); nd.rotation.z = a - Math.PI / 2; nd.position.set(Math.cos(a) * 0.012, Math.sin(a) * 0.012, 0.022); });
        const ops = sim?.leitura?.('ops:' + id); const g = r.counter.g; g.fillStyle = '#111'; g.fillRect(0, 0, 160, 48); g.fillStyle = '#f4f2ec'; g.font = '700 34px "IBM Plex Mono",monospace'; g.fillText(String(Math.round(ops?.valor ?? 0)).padStart(5, '0'), 14, 36); r.counter.t.needsUpdate = true; }
      for (const [T, t] of Object.entries(this.yard.trf)) { const g = t.panel.lcd.g, st = s.tr[T]; g.fillStyle = '#071007'; g.fillRect(0, 0, 160, 64); if (cc) { g.fillStyle = '#ff5a3c'; g.font = '700 36px "IBM Plex Mono",monospace'; g.fillText(`${st.tap > 0 ? '+' : ''}${st.tap}`, 10, 46); g.font = '600 18px "IBM Plex Mono",monospace'; g.fillText(st.modo === 'auto' ? 'AUTO' : 'MAN', 96, 44); } t.panel.lcd.t.needsUpdate = true; }
    }
  }

  // ======================= laço =======================
  frame(dt: number, p: Vector3, area: string, xray = false) {
    this.t += dt; const pr = this.d.params.manobra, Y = this.yard, I = this.indoor;
    for (const b of I.beacons) { const m = b.material as MeshStandardMaterial; const on = this.emerg && Math.sin(this.t * 10) > 0; m.emissive.setHex(on ? 0xff2020 : 0); m.emissiveIntensity = on ? 3 : 0; m.color.setHex(on ? 0xff3020 : 0x5a1a14); }
    if (I.emerg) { const m = I.emerg.material as MeshStandardMaterial; m.emissive.setHex(this.emerg ? 0xc8102e : 0); m.emissiveIntensity = this.emerg ? 1.5 : 0; m.color.setHex(0xc8102e); const ax = I.emerg.userData.axis === 'x' ? 'x' : 'z'; I.emerg.position[ax] = (I.emerg.userData.z0 ??= I.emerg.position[ax]) - (ax === 'x' ? -1 : 1) * (this.emerg ? 0.02 : 0); }
    const sd = dt / (pr.seccionadoraMs / 1000), se = dt / (pr.terraMs / 1000);
    for (const r of Object.values(Y.dis)) { r.ang += Math.max(-sd, Math.min(sd, r.tgt - r.ang)); r.blades.forEach((g) => (g.rotation.x = -r.ang * 1.45));
      if (r.earth) { r.earthAng += Math.max(-se, Math.min(se, r.eTgt - r.earthAng)); r.earth.forEach((g) => (g.rotation.x = g.userData.sgn * (1 - r.earthAng) * 1.45)); } }
    for (const r of Object.values(Y.cbr)) { const st = dt / 0.6; r.pos += Math.max(-st, Math.min(st, r.tgt - r.pos)); r.arcT = Math.max(0, r.arcT - dt);
      r.moving.forEach((m, i) => { m.position.y = m.userData.y0 - r.pos * 0.26; const a = r.arcs[i]; a.visible = r.arcT > 0 && r.pos > 0.05 && r.pos < 0.9; if (a.visible) { a.scale.y = 0.2 + r.pos * 2.4; a.position.y = m.userData.y0 + 0.3 - (r.pos * 0.26) / 2; } }); }
    for (const cu of Object.values(I.cub)) { if (!cu.truck) continue; const tt = (cu as any).tPosT ?? 0, st = (dt / (pr.extracaoMs / 1000)) * 0.17; cu.tPos += Math.max(-st, Math.min(st, tt - cu.tPos)); cu.truck.position.z = cu.zf - 0.55 + cu.tPos;
      const dtg = (cu as any).doorT ?? 0; cu.doorAng += Math.max(-dt * 2.2, Math.min(dt * 2.2, dtg - cu.doorAng)); cu.door!.rotation.y = -cu.doorAng * 1.7;
      if (cu.shutter) cu.shutter.visible = cu.tPos > 0.1; if (cu.rear) { const tgt = (cu as any).rearT ?? 0; cu.rearOpen += Math.max(-dt * 1.5, Math.min(dt * 1.5, tgt - cu.rearOpen)); cu.rear.position.x = cu.x - cu.rearOpen * 0.0; cu.rear.position.z = cu.zc - 0.8 - 0.012 - cu.rearOpen * 0.5; cu.rear.rotation.y = cu.rearOpen * 0.25; cu.rear.position.y = 0; } }
    for (const t of Object.values(Y.trf)) t.fans.forEach((f) => { if (t.vent >= f.userData.grupo) f.rotation.y += dt * 16; });
    // portas e portão
    for (const dd of I.doors) { dd.open += Math.max(-dt * 1.8, Math.min(dt * 1.8, dd.tgt - dd.open)); dd.g.rotation.y = dd.open * dd.max; if (dd.open < 0.15) this.doorCol.set(dd.id, dd.col); else this.doorCol.delete(dd.id); }
    for (const cb of Object.values(Y.cabs)) { cb.open += Math.max(-dt * 2.2, Math.min(dt * 2.2, cb.tgt - cb.open)); cb.door.rotation.y = -cb.open * 1.85; }
    for (const g of Y.gates) { g.open += Math.max(-dt * 0.8, Math.min(dt * 0.8, g.tgt - g.open)); g.leaves.forEach((l) => (l.children[0].rotation.y = (l.userData.s > 0 ? -Math.PI / 2 : Math.PI / 2) + l.userData.s * g.open * 1.5)); if (g.open < 0.15) this.doorCol.set('gate:' + g.id, g.col); else this.doorCol.delete('gate:' + g.id); }
    for (const cb of new Set(Object.values(I.cabinets))) { cb.open += Math.max(-dt * 2.5, Math.min(dt * 2.5, cb.tgt - cb.open)); cb.doors.forEach((g) => (g.rotation.y = g.userData.s * cb.open * 1.9 * (g.userData.dir ?? (g.position.x > this.divX ? 1 : -1)))); }
    if (this.fire.visible) { for (const m of this.fire.children as Mesh[]) { if (m.userData.ph != null) { m.scale.y = 0.8 + 0.35 * Math.sin(this.t * 9 + m.userData.ph); m.rotation.y += dt * 2; } else if (m.userData.smoke != null) { m.position.y += dt * 0.9; if (m.position.y > 18) m.position.y = 5.5; } } this.fireLight.intensity = 60 + Math.sin(this.t * 13) * 15; } else this.fireLight.intensity = 0;
    // raio-X (mini-operação): troca o material das câmaras
    for (const r of Object.values(Y.cbr)) for (const ch of r.chambers) ch.material = vrMat(xray ? xrayMat : chamberMat);
    // renderização por zona
    const Z = this.zones, inside = area === 'casa' || area === 'bateria', [cx1, cz1, cx2, cz2] = this.casaRect;
    const nearCasa = p.x > cx1 - 14 && p.x < cx2 + 14 && p.z > cz1 - 14 && p.z < cz2 + 14, anyOpen = I.doors.some((dd) => dd.open > 0.05);
    Z.casa.visible = inside || (nearCasa && anyOpen); const [bx1, bz1, bx2, bz2] = this.batRect, nearBat = Math.hypot(p.x - (bx1 + bx2) / 2, p.z - (bz1 + bz2) / 2) < 9;
    Z.bateria.visible = area === 'bateria' || (inside && I.doors.some((dd) => dd.id.startsWith('I') && dd.open > 0.05)) || (Z.casa.visible && nearBat);
    this.canT += dt; if (this.canT > 0.33) { this.canT = 0; this.canvases(area); }
  }
  areaAt(x: number, z: number) { const [fx1, fz1, fx2, fz2] = this.fenceRect, [cx1, cz1, cx2, cz2] = this.casaRect;
    if (x > cx1 && x < cx2 && z > cz1 && z < cz2) { const [bx1, bz1, bx2, bz2] = this.batRect; return x > bx1 && x < bx2 && z > bz1 && z < bz2 ? 'bateria' : 'casa'; } if (x > fx1 && x < fx2 && z > fz1 && z < fz2 && !(z > cz2 && x > cx1 && x < cx2)) return 'patio'; return 'externo'; }
  colliders(): AABB[] { return [...this.col, ...this.doorCol.values()]; }
  plantPos(p: Vector3, yaw: number) { const k = this.d.plant.escala.mPorPx, [ox, oy] = this.d.plant.escala.origem; return { px: p.x / k + ox, py: p.z / k + oy, yaw }; }
  /** Coloca vítima (cenário de resgate). */
  placeVictim(x: number, z: number, rotY = 0) { this.removeVictim(); const v = human(this.M, { pose: 'deitado' }); v.position.x = x; v.position.z = z; v.rotation.y = rotY; this.zones[this.areaAt(x, z) === 'patio' ? 'patio' : 'casa'].add(v); this.victim = v; return v; }
  removeVictim() { this.victim?.parent?.remove(this.victim); this.victim = null; }
  allObjects(): Object3D[] { return Object.values(this.zones); }
}


/** Telas da mesa: 0 = unifilar, 1 = alarmes, 2 = tendências/medições. */
function drawMonitor(m: { g: CanvasRenderingContext2D; t: any; c: HTMLCanvasElement }, idx: number, v: any) {
  const g = m.g, s = v.s, der = v.der, cc = v.ccOk, W = 640, H = 384; g.fillStyle = '#2b2f33'; g.fillRect(0, 0, W, H);
  if (!cc) { g.fillStyle = '#0b0d0f'; g.fillRect(0, 0, W, H); m.t.needsUpdate = true; return; }
  g.fillStyle = '#1f2326'; g.fillRect(0, 0, W, 34); g.fillStyle = '#d8dde1'; g.font = '600 18px "Barlow Condensed",sans-serif'; g.fillText(['SE VALE VERDE — UNIFILAR', 'ALARMES ATIVOS', 'MEDIÇÕES'][idx], 12, 23);
  if (idx === 0) {
    const line = (x1: number, y1: number, x2: number, y2: number, on: boolean, mt = false) => { g.strokeStyle = on ? (mt ? '#e0b21e' : '#f2f4f5') : '#5e666d'; g.lineWidth = 5; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
    const brk = (x: number, y: number, id: string) => { const b = s.eq[id]; g.fillStyle = b.state === 'closed' ? '#d9423a' : '#2f9e5b'; g.fillRect(x - 11, y - 11, 22, 22); };
    line(320, 50, 320, 110, der.energ.LINE); brk(320, 84, '52-LT1'); line(150, 116, 490, 116, der.energ.BAT);
    for (const [T, x] of [['T1', 210], ['T2', 430]] as const) { line(x, 116, x, 182, der.energ[T + 'c']); brk(x, 150, '52-' + T); g.strokeStyle = der.tr[T].energ ? '#f2f4f5' : '#5e666d'; g.lineWidth = 3; g.beginPath(); g.arc(x, 196, 12, 0, 7); g.stroke(); g.beginPath(); g.arc(x, 214, 12, 0, 7); g.stroke(); line(x, 226, x, 280, der.energ[T + 'm'], true); brk(x, 254, '52-' + T + 'M'); }
    line(70, 290, 300, 290, der.energ.MT1, true); line(340, 290, 570, 290, der.energ.MT2, true); brk(320, 290, '52-P');
    ['AL1', 'AL2', 'AL3', 'AL4'].forEach((a, i) => { const x = [110, 220, 420, 530][i]; line(x, 290, x, 350, der.supplied[a], true); brk(x, 322, '52-' + a); g.fillStyle = '#6fb3e0'; g.font = '600 14px "IBM Plex Mono",monospace'; g.fillText(`${Math.round(der.I['52-' + a] || 0)} A`, x - 20, 374); });
  } else if (idx === 1) { const al = s.alarmes.filter((a: any) => a.ativo).slice(-11).reverse(); g.font = '500 16px "IBM Plex Mono",monospace'; al.forEach((a: any, i: number) => { g.fillStyle = a.sev >= 3 ? '#ff6b63' : '#e39b2d'; g.fillRect(10, 46 + i * 30, 6, 22); g.fillStyle = '#e8ebed'; g.fillText(`${a.ack ? ' ' : '!'} ${a.text}`.slice(0, 62), 24, 63 + i * 30); }); if (!al.length) { g.fillStyle = '#9aa3aa'; g.fillText('Sem alarmes ativos', 14, 64); } }
  else { g.font = '500 17px "IBM Plex Mono",monospace'; const rows = [['MT-1', `${fmt(der.barras['MT-1'].kV, 2)} kV`], ['MT-2', `${fmt(der.barras['MT-2'].kV, 2)} kV`], ['T1', `${fmt(der.tr.T1.mva, 1)} MVA  TAP ${s.tr.T1.tap}`], ['T2', `${fmt(der.tr.T2.mva, 1)} MVA  TAP ${s.tr.T2.tap}`], ['Óleo T1/T2', `${fmt(s.tr.T1.oleo)} / ${fmt(s.tr.T2.oleo)} °C`], ['CC', `${fmt(s.cc.v, 1)} V`]];
    rows.forEach(([a, b], i) => { g.fillStyle = '#9aa3aa'; g.fillText(a, 16, 70 + i * 44); g.fillStyle = '#6fb3e0'; g.fillText(b, 260, 70 + i * 44); }); }
  m.t.needsUpdate = true;
}
