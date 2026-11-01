// Cubículo metal-clad 13,8 kV do PDMT (fotos 31/10/2026): porta inferior em dois tons, plaquetas pretas,
// etiquetas de arco elétrico, relé + botoeiras no compartimento BT, carrinho extraível, traseira aparafusada.
import { Group, Mesh, Vector3, MeshStandardMaterial, PlaneGeometry, TorusGeometry } from 'three';
import { type MCtx, inter, part, dbox, dcyl, sign, canvasTex } from '../common';
import { glow } from '../materials';
import { Print } from '../print';
import type { CubD, Lamp } from './indoor';

export const lamp = (c: number, r: number, x: number, y: number, z: number, p: Group): Lamp => { const m = dcyl(r, 0.012, glow(c, false), x, y, z, p, 14); m.rotation.x = Math.PI / 2; return { m, col: c }; };
/** Etiquetas reais do cubículo: [nº, tag operacional, "CUBÍCULO n", função, destino]. */
export type CubTag = [string, string, string, string, string];

export function cubiculo(c: MCtx, bay: string, x: number, zc: number, W: number, D: number, H: number, tg: CubTag): CubD {
  const M = c.M, B = c.b, root = c.root.casa, zf = zc + D / 2, zb = zc - D / 2;
  const kind = bay.startsWith('AL') ? 'al' : bay === 'P' ? 'p' : bay === 'RISER' ? 'riser' : bay.startsWith('TP') ? 'tp' : bay.startsWith('TSA') ? 'tsa' : 'in';
  const brk = kind === 'al' || kind === 'in' || kind === 'p';
  const r: CubD = { bay, kind, x, zf, zc, W, lamps: [], leds: [], lcd: null, meter: null, sel: null, lock43: null, lockDoor: null, door: null, doorAng: 0, truck: null, tPos: 0, flagI: null, flagO: null, mola: null, earthInd: null, earthHex: null, vpis: [], sign: null, barrier: null, tempGround: null, therm: null, rear: null, rearOpen: 0, shutter: null, burnt: null };
  const nome = tg[1];
  const busNome = ['TSA1', 'TP1', 'AL1', 'AL2', 'T1M'].includes(bay) ? 'MT-1' : bay === 'P' || bay === 'RISER' ? 'MT-1 / MT-2' : 'MT-2';
  // ---- carcaça ----
  B.box(W - 0.004, 0.1, D - 0.04, M.ral7016, x, 0.05, zc); // base
  B.box(W - 0.004, H - 0.1, 0.02, M.ral7035, x, 0.05 + (H - 0.1) / 2, zb + 0.01); // traseira fixa (atrás da tampa)
  B.box(0.012, H - 0.1, D, M.ral7035, x - W / 2 + 0.006, 0.05 + (H - 0.1) / 2, zc); // lateral (divisória)
  B.box(W, 0.02, D, M.ral7035, x, H, zc); // teto
  for (let i = 0; i < 2; i++) B.box(W * 0.42, 0.02, D * 0.4, M.ral7035, x - W * 0.22 + i * W * 0.44, H + 0.03, zc - D * 0.1, 0, i ? -0.06 : 0.06); // flapes de alívio
  // frente: 3 compartimentos (cabos 0,10–0,95 · disjuntor 0,95–1,62 · BT 1,62–2,28)
  const fz = zf - 0.01;
  B.box(W - 0.01, 0.84, 0.02, M.ral7035, x, 0.1 + 0.42, fz); // tampa frontal do compartimento de cabos
  B.box(W - 0.01, 0.65, 0.02, M.ral7035, x, 1.62 + 0.33, fz); // porta BT
  B.box(W - 0.01, 0.012, 0.03, M.ral7016, x, 0.955, fz + 0.005); B.box(W - 0.01, 0.012, 0.03, M.ral7016, x, 1.615, fz + 0.005);
  for (const yy of [0.14, 0.9]) for (const xx of [-W / 2 + 0.04, W / 2 - 0.04]) B.cyl(0.007, 0.012, M.aluDull, x + xx, yy, fz + 0.012, Math.PI / 2, 0, 6);
  // dobradiças da porta BT
  for (const yy of [1.7, 2.2]) B.cyl(0.012, 0.06, M.aluDull, x - W / 2 + 0.02, yy, fz + 0.015, 0, 0, 8);
  B.box(0.02, 0.1, 0.03, M.black, x + W / 2 - 0.05, 1.95, fz + 0.02); // fecho da porta BT
  // ---- impressão da face (legendas, mímico, avisos) ----
  const pr = new Print(W, H, 480);
  pr.rect(W / 2 - 0.15, 2.17, 0.3, 0.075, '#16181a'); pr.text(tg[2], W / 2, 2.222, 0.022, { color: '#f1f1ee', weight: 700 }); pr.text(tg[3], W / 2, 2.19, 0.015, { color: '#d6d9db', weight: 600 });
  pr.rect(W / 2 - 0.16, 1.625, 0.32, 0.034, '#f3f3ef', '#555', 0.0012); pr.text(tg[4], W / 2, 1.642, 0.016, { weight: 700, maxW: 0.3 });
  pr.rect(0, 0.7, W, 0.22, '#8a929b'); pr.rect(0, 0.4, W, 0.05, '#8a929b'); pr.text(busNome, W - 0.06, 0.43, 0.014, { color: '#eef0f1', align: 'right' });
  if (brk) {
    // mímico sobre a porta do disjuntor
    const mx = W * 0.82; pr.line([[mx, 1.6], [mx, 1.5]], '#c8102e', 0.008); pr.rect(mx - 0.018, 1.43, 0.036, 0.05, 'transparent', '#c8102e', 0.006); pr.line([[mx, 1.43], [mx, 1.3]], '#c8102e', 0.008);
    pr.text('LÂMP.', W * 0.69, 1.69 + 0.06, 0.016); ['FECH.', 'ABERTO', 'MOLA', 'ALARME'].forEach((s, i) => pr.text(s, 0.43 + i * 0.09, 1.83, 0.014));
    pr.text('FECHAR', 0.47, 1.68, 0.015); pr.text('ABRIR', 0.58, 1.68, 0.015); pr.text('TESTE', 0.69, 1.68, 0.015);
    pr.text('43  LOC  REM', 0.69, 2.05, 0.015); pr.text('I (A)', 0.5, 2.09, 0.015);
    pr.text('EXTRAÇÃO', W / 2, 1.0, 0.016); pr.text('◄ inserir   extrair ►', W / 2, 0.985 - 0.02, 0.012, { color: '#3a3d40' });
    pr.arc(0.2, 0.2, 0.13); pr.rect(0.62, 1.73, 0.16, 0.03, '#f3f3ef', '#555', 0.001); pr.text('DJ' + nome, 0.7, 1.745, 0.016, { weight: 700 });
    pr.rect(x0rel(W), 2.11, 0.22, 0.032, '#16181a'); pr.text('RELÉ DE PROTEÇÃO', x0rel(W) + 0.11, 2.126, 0.012, { color: '#f1f1ee', weight: 700 });
    if (kind === 'al') { pr.text('CHAVE DE TERRA 89T', 0.62, 0.79, 0.015); pr.text('LIGADA  /  DESLIGADA', 0.62, 0.765, 0.011, { color: '#3a3d40' }); }
    pr.text('PRESENÇA DE TENSÃO', 0.19, 0.86, 0.013); ['L1', 'L2', 'L3'].forEach((s, i) => pr.text(s, 0.13 + i * 0.06, 0.74, 0.013));
  } else {
    pr.arc(W * 0.42, 1.25, 0.13); if (kind === 'tsa') pr.arc(W * 0.42, 0.22, 0.12);
    pr.rect(W * 0.62, 1.32, 0.3, 0.1, '#111'); // visor
    pr.text(kind === 'tsa' ? 'SECC. FUSÍVEL ' + nome : 'TRANSIÇÃO DE BARRA', W / 2, 1.05, 0.018, { maxW: W * 0.85, weight: 700 });
    if (kind === 'tsa') pr.text('FUSÍVEIS HH 13,8 kV · TSA', W / 2, 1.01, 0.014);
    pr.rect(W - 0.17, 0.95, 0.12, 0.66, '#8a929b');
  }
  const face = pr.mesh(); face.position.set(x, H / 2, zf + 0.0035); root.add(face);
  // ---- traseira (tampa aparafusada, removível no cenário) ----
  const rear = new Group(); rear.position.set(x, 0, zb - 0.012); root.add(rear); r.rear = rear;
  const rb = dbox(W - 0.02, H - 0.2, 0.02, M.ral7035, 0, 0.1 + (H - 0.2) / 2, 0, rear); rb.castShadow = true; rb.receiveShadow = true;
  const rp = new Print(W, H, 360); rp.line([[0.02, 1.33], [W - 0.02, 1.33]], '#6b7076', 0.004); rp.warn(W / 2, 1.85, 0.16); rp.warn(W / 2, 0.38, 0.13);
  rp.rect(W / 2 - 0.08, 1.12, 0.16, 0.1, '#111'); rp.rect(W / 2 - 0.12, 1.02, 0.24, 0.04, '#f3f3ef', '#555', 0.001); rp.text((kind === 'in' ? 'ENTRADA' : 'SAÍDA') + ' 13,8 kV', W / 2, 1.04, 0.016, { weight: 700 });
  rp.rect(W / 2 - 0.012, 0.66, 0.024, 0.3, '#c8102e'); rp.text('▼', W / 2, 0.64, 0.05, { color: '#c8102e' }); rp.text(tg[0], W / 2, 2.1, 0.03, { weight: 700, color: '#30363b' });
  const rpm = rp.mesh(); rpm.rotation.y = Math.PI; rpm.position.set(0, H / 2, -0.012); rear.add(rpm);
  for (const yy of [0.2, 1.2, 2.1]) for (const xx of [-W / 2 + 0.05, W / 2 - 0.05]) dcyl(0.008, 0.01, M.aluDull, xx, yy, -0.012, rear, 6).rotation.x = Math.PI / 2;
  // terminais de cabo (visíveis com a tampa removida)
  for (let i = 0; i < 3; i++) { const xx = x - 0.22 + i * 0.22; B.cyl(0.03, 0.55, M.cable, xx, 0.35, zb + 0.25, 0, 0, 10); B.cyl(0.045, 0.22, M.polymer, xx, 0.75, zb + 0.25, 0, 0, 12); B.box(0.04, 0.05, 0.02, M.copper, xx, 0.89, zb + 0.25); B.box(0.035, 0.32, 0.012, M.copper, xx, 1.05, zb + 0.22); }
  B.box(W - 0.06, 0.02, 0.04, M.copper, x, 0.22, zb + 0.08); // barra de terra
  if (!brk) {
    B.box(W - 0.01, 0.66, 0.02, M.ral7035, x, 1.285, fz); for (const yy of [1.0, 1.57]) for (const xx of [-W / 2 + 0.04, W / 2 - 0.04]) B.cyl(0.007, 0.012, M.aluDull, x + xx, yy, fz + 0.012, Math.PI / 2, 0, 6);
    inter(c, { id: 'cub:' + bay, kind: 'cubinfo', label: `Cubículo ${nome}`, verb: 'Inspecionar', box: [W, H, 0.12], at: [x, H / 2, zf + 0.06], eq: bay, view: { pos: new Vector3(x, 1.5, zf + 1.25), look: new Vector3(x, 1.2, zf) } });
    if (kind === 'tp' || kind === 'tsa') { const L = lamp(0xf2f2f2, 0.014, x - W / 2 + 0.55, 1.95, zf + 0.012, root); r.lamps.push(L);
      for (const [cc2, bx] of [[0x1f8a4c, 0.66], [0xc8102e, 0.74]] as const) { B.cyl(0.02, 0.012, M.aluDull, x - W / 2 + bx, 1.95, zf + 0.007, Math.PI / 2, 0, 14); const m = dcyl(0.014, 0.018, new MeshStandardMaterial({ color: cc2, roughness: 0.35 }), x - W / 2 + bx, 1.95, zf + 0.018, root, 14); m.rotation.x = Math.PI / 2; } }
    if (kind === 'tsa') { B.cyl(0.035, 0.03, M.copperOld, x - W / 2 + 0.2, 1.08, zf + 0.02, Math.PI / 2, 0, 16); B.cyl(0.018, 0.12, M.yellow, x - W / 2 + 0.2, 1.08, zf + 0.08, Math.PI / 2, 0, 10); B.box(0.16, 0.03, 0.03, M.yellow, x - W / 2 + 0.2, 1.08, zf + 0.14); B.box(0.18, 0.12, 0.004, M.yellow, x - W / 2 + 0.2, 1.24, zf + 0.004); }
    if (kind === 'riser') { B.rbox(0.36, 0.3, 0.05, 0.01, M.aluDull, x, 1.92, zf + 0.02); const hm = new Print(0.3, 0.23, 600); hm.rect(0, 0, 0.3, 0.23, '#20262b'); hm.rect(0, 0.2, 0.3, 0.03, '#30363b'); hm.text('PDMT 13,8 kV — VISÃO GERAL', 0.15, 0.215, 0.012, { color: '#d8dde1' }); hm.line([[0.03, 0.12], [0.27, 0.12]], '#e0b21e', 0.004); for (let k = 0; k < 6; k++) hm.rect(0.04 + k * 0.04, 0.06, 0.02, 0.03, k % 2 ? '#2f9e5b' : '#d9423a');
      const hmm = hm.mesh(0.2); hmm.position.set(x, 1.92, zf + 0.046); root.add(hmm); B.box(0.03, 0.03, 0.01, M.green, x + 0.12, 1.72, zf + 0.008); }
    return r;
  }
  // ---- compartimento BT: relé ----
  const ry = 1.92, rx = x - W / 2 + 0.2;
  B.box(0.22, 0.27, 0.04, M.ral7016, rx, ry, zf + 0.02); B.box(0.2, 0.25, 0.005, M.plastic, rx, ry, zf + 0.041);
  const lcd = canvasTex(256, 112); r.lcd = lcd; const lm = new Mesh(new PlaneGeometry(0.15, 0.065), new MeshStandardMaterial({ map: lcd.t, emissiveMap: lcd.t, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.2 })); lm.position.set(rx, ry + 0.065, zf + 0.0445); root.add(lm);
  const lpr = new Print(0.2, 0.25, 900); lpr.text(kind === 'p' ? 'SINC. 25' : 'PROTEÇÃO ' + (kind === 'al' ? 'ALIMENTADOR' : 'ENTRADA'), 0.1, 0.235, 0.011, { color: '#c9d3db' });
  const ledNames = kind === 'al' ? ['TRIP', '50', '51', '50N', '51N', '79', '86', 'BF'] : kind === 'p' ? ['25 OK', 'BLQ', 'ΔV', 'ΔTAP', '', '', '', ''] : ['TRIP', '51', '51G', 'BF', '86', '', '', ''];
  ledNames.forEach((n2, i) => { if (!n2) return; const col = i < 4 ? 0 : 1, row = i % 4; lpr.text(n2, 0.035 + col * 0.09 + 0.022, 0.105 - row * 0.024, 0.0105, { color: '#c9d3db', align: 'left' });
    const L = lamp(n2 === 'TRIP' || n2 === '86' || n2 === 'BF' || n2 === 'BLQ' ? 0xff3b30 : n2 === '25 OK' ? 0x2fd36b : 0xffb02e, 0.0045, rx - 0.065 + col * 0.09, ry - 0.02 - row * 0.024, zf + 0.0435, root); r.leds.push(L); });
  const lp = lpr.mesh(0.3); lp.position.set(rx, ry, zf + 0.0432); root.add(lp);
  // teclas do relé
  const keyMat = M.plastic; const kRst = dbox(0.022, 0.014, 0.008, glow(0xff3b30, false), rx + 0.07, ry - 0.105, zf + 0.046, root); const kPg = dbox(0.022, 0.014, 0.008, keyMat, rx + 0.04, ry - 0.105, zf + 0.046, root);
  const k79 = kind === 'al' ? dbox(0.022, 0.014, 0.008, keyMat, rx + 0.01, ry - 0.105, zf + 0.046, root) : null;
  // ---- lâmpadas, botões, 43, multimedidor ----
  ['red', 'green', 'white', 'amber'].forEach((_, i) => { r.lamps.push(lamp([0xff3b30, 0x2fd36b, 0xf6f6f0, 0xffb02e][i], 0.012, x - W / 2 + 0.43 + i * 0.09, 1.865, zf + 0.012, root)); B.cyl(0.016, 0.01, M.aluDull, x - W / 2 + 0.43 + i * 0.09, 1.865, zf + 0.006, Math.PI / 2, 0, 14); });
  const btn = (col: number, bx: number, name: string) => { B.cyl(0.02, 0.012, M.aluDull, bx, 1.715, zf + 0.007, Math.PI / 2, 0, 16); const m = dcyl(0.014, 0.018, new MeshStandardMaterial({ color: col, roughness: 0.35 }), bx, 1.715, zf + 0.018, root, 16); m.rotation.x = Math.PI / 2; m.name = name; return m; };
  const bF = btn(0xc8102e, x - W / 2 + 0.47, 'fechar'), bA = btn(0x1f8a4c, x - W / 2 + 0.58, 'abrir'), bT = btn(0x2a2d30, x - W / 2 + 0.69, 'teste');
  const sel = new Group(); sel.position.set(x - W / 2 + 0.69, 2.0, zf + 0.012); root.add(sel); dcyl(0.022, 0.02, M.black, 0, 0, 0.01, sel, 18).rotation.x = Math.PI / 2; dbox(0.008, 0.036, 0.022, M.black, 0, 0, 0.02, sel); dbox(0.003, 0.026, 0.004, M.white, 0, 0.004, 0.032, sel); r.sel = sel;
  const lk43 = padlock(M, x - W / 2 + 0.74, 1.965, zf + 0.022, root); r.lock43 = lk43;
  const mt = canvasTex(160, 64); r.meter = mt; B.box(0.11, 0.06, 0.03, M.plastic, x - W / 2 + 0.5, 2.05, zf + 0.014); const mtm = new Mesh(new PlaneGeometry(0.085, 0.034), new MeshStandardMaterial({ map: mt.t, emissiveMap: mt.t, emissive: 0xffffff, emissiveIntensity: 0.8 })); mtm.position.set(x - W / 2 + 0.5, 2.05, zf + 0.0295); root.add(mtm);
  const therm = dbox(0.04, 0.03, 0.002, new MeshStandardMaterial({ color: 0x2e9b52, roughness: 0.6 }), x + W / 2 - 0.07, 2.25, zf + 0.004, root); r.therm = therm;
  // ---- porta do compartimento do disjuntor (dobradiça à esquerda) ----
  const door = new Group(); door.position.set(x - W / 2 + 0.008, 0, zf - 0.005); root.add(door); r.door = door;
  const dw = W - 0.02; const db = dbox(dw, 0.64, 0.025, M.ral7035, dw / 2, 1.285, 0, door); db.castShadow = true; db.receiveShadow = true;
  const win = dbox(0.3, 0.09, 0.004, M.glassDark, dw / 2, 1.45, 0.016, door); void win; for (const [w2, h2, xx, yy] of [[0.33, 0.015, dw / 2, 1.5], [0.33, 0.015, dw / 2, 1.4], [0.015, 0.1, dw / 2 - 0.16, 1.45], [0.015, 0.1, dw / 2 + 0.16, 1.45]] as const) dbox(w2, h2, 0.008, M.ral7016, xx, yy, 0.016, door);
  dbox(0.13, 0.62, 0.004, M.pdmtBand, dw - 0.085, 1.285, 0.0135, door);
  { const st = new Print(0.13, 0.18, 700); st.arc(0.065, 0.09, 0.13); const sm = st.mesh(0.5); sm.position.set(0.12, 1.3, 0.0145); door.add(sm); }
  const handle = new Group(); handle.position.set(dw - 0.06, 1.24, 0.02); door.add(handle); dcyl(0.02, 0.02, M.aluDull, 0, 0, 0, handle, 14).rotation.x = Math.PI / 2; dbox(0.022, 0.11, 0.018, M.aluDull, 0, -0.045, 0.012, handle);
  const rk = dcyl(0.028, 0.006, M.ral7016, dw / 2, 1.02, 0.014, door, 18); rk.rotation.x = Math.PI / 2; const rkh = dcyl(0.011, 0.008, M.black, dw / 2, 1.02, 0.017, door, 6); rkh.rotation.x = Math.PI / 2;
  const lockD = padlock(M, dw - 0.06, 1.12, 0.03, door); r.lockDoor = lockD;
  // ---- carrinho (disjuntor a vácuo extraível) ----
  const tr = new Group(); tr.position.set(x, 0, zf - 0.55); root.add(tr); r.truck = tr;
  dbox(0.62, 0.08, 0.6, M.ral7016, 0, 1.0, -0.05, tr); dbox(0.6, 0.5, 0.06, M.ral7035, 0, 1.3, 0.24, tr); // chassi + frente do disjuntor
  for (const sx of [-0.27, 0.27]) for (const sz of [-0.3, 0.2]) { const wh = dcyl(0.035, 0.03, M.black, sx, 0.98, sz, tr, 12); wh.rotation.z = Math.PI / 2; }
  for (let i = 0; i < 3; i++) { const px = -0.2 + i * 0.2; const pole = dcyl(0.055, 0.42, M.plastic, px, 1.35, -0.12, tr, 18); pole.castShadow = true; dcyl(0.06, 0.04, M.ral7016, px, 1.14, -0.12, tr, 18);
    for (const yy of [1.48, 1.22]) { const arm = dcyl(0.018, 0.28, M.copper, px, yy, -0.32, tr, 10); arm.rotation.x = Math.PI / 2; const tul = dcyl(0.032, 0.07, M.copperOld, px, yy, -0.48, tr, 12); tul.rotation.x = Math.PI / 2; } }
  const fI = dbox(0.05, 0.035, 0.004, glow(0xc8102e), -0.08, 1.38, 0.272, tr), fO = dbox(0.05, 0.035, 0.004, glow(0x1f8a4c), -0.08, 1.38, 0.272, tr); r.flagI = fI; r.flagO = fO;
  const mola = dbox(0.05, 0.035, 0.004, glow(0xe0b21e), 0.04, 1.38, 0.272, tr); r.mola = mola;
  dbox(0.03, 0.03, 0.01, M.red, 0.13, 1.42, 0.275, tr); dbox(0.03, 0.03, 0.01, M.green, 0.13, 1.37, 0.275, tr);
  const tpp = new Print(0.6, 0.5, 700); tpp.text('VD 17,5 kV · 1250 A · 25 kA', 0.3, 0.47, 0.022, { weight: 600 }); tpp.text('I  ON', 0.3 - 0.08, 0.22 + 0.06, 0.016); tpp.text('MOLA', 0.34, 0.28, 0.016); const tppm = tpp.mesh(0.4); tppm.position.set(0, 1.3, 0.2715); tr.add(tppm);
  // venezianas (shutters) dos contatos fixos
  const sh = new Group(); sh.position.set(x, 0, zb + 0.42); root.add(sh); r.shutter = sh;
  dbox(W - 0.06, 0.16, 0.012, M.yellow, 0, 1.48, 0, sh); dbox(W - 0.06, 0.16, 0.012, M.yellow, 0, 1.22, 0, sh);
  const sp = new Print(W - 0.06, 0.42, 500); sp.text('BARRAMENTO', (W - 0.06) / 2, 0.38, 0.03, { weight: 800 }); sp.text('LINHA / CABOS', (W - 0.06) / 2, 0.12, 0.03, { weight: 800 }); const spm = sp.mesh(); spm.position.set(0, 1.35, 0.008); sh.add(spm);
  B.box(W - 0.02, 0.62, 0.012, M.ral7032, x, 1.29, zb + 0.4); // parede de fundo do compartimento
  // ---- compartimento de cabos: chave de terra, VPIS ----
  if (kind === 'al') {
    const ex = x + W / 2 - 0.18, ey = 0.68; B.cyl(0.03, 0.01, M.ral7016, ex, ey, zf + 0.006, Math.PI / 2, 0, 18);
    const hex = dcyl(0.012, 0.012, M.black, ex, ey, zf + 0.01, root, 6); hex.rotation.x = Math.PI / 2; r.earthHex = hex;
    const ind = new Group(); ind.position.set(ex, 0.8, zf + 0.012); root.add(ind); dcyl(0.026, 0.004, M.white, 0, 0, 0, ind, 20).rotation.x = Math.PI / 2; const bar = dbox(0.042, 0.008, 0.003, M.black, 0, 0, 0.003, ind); void bar; r.earthInd = ind;
    const et = dbox(0.08, 0.025, 0.002, new MeshStandardMaterial({ color: 0x1f8a4c, roughness: 0.6 }), ex, 0.6, zf + 0.012, root); r.earthInd.userData.tag = et;
    padlock(M, ex + 0.06, 0.68, zf + 0.018, root).visible = false;
  }
  B.box(0.16, 0.09, 0.02, M.plastic, x - W / 2 + 0.19, 0.8, zf + 0.008);
  for (let i = 0; i < 3; i++) { const L = lamp(0xff3b30, 0.008, x - W / 2 + 0.13 + i * 0.06, 0.8, zf + 0.019, root); r.vpis.push(L); }
  // ---- sinalização da missão (NÃO OPERAR, barreira) e aterramento temporário ----
  if (kind === 'al') {
    const sg = sign('proib', ['NÃO OPERAR', 'HOMENS TRABALHANDO'], 0.2, 0.26, { picto: 'raio' }); sg.position.set(x, 1.48, zf + 0.03); root.add(sg); r.sign = sg;
    const bar = new Group(); root.add(bar); r.barrier = bar; for (const sx of [-0.55, 0.55]) { const p = dcyl(0.02, 0.9, M.black, x + sx, 0.45, zf + 1.1, bar, 10); p.castShadow = true; dcyl(0.12, 0.04, M.black, x + sx, 0.02, zf + 1.1, bar, 14); }
    const fita = new Print(1.1, 0.06, 300); for (let k = 0; k < 22; k++) fita.rect(k * 0.05, 0, 0.05, 0.06, k % 2 ? '#111' : '#e0b21e'); const fm = fita.mesh(0.6); fm.position.set(x, 0.85, zf + 1.1); bar.add(fm); const fm2 = fm.clone(); fm2.position.y = 0.55; bar.add(fm2);
  }
  if (kind === 'in') { const g = new Group(); root.add(g); g.position.set(x, 0, zb - 0.35); for (let i = 0; i < 3; i++) { dcyl(0.012, 0.9, M.cable, -0.2 + i * 0.2, 0.55, 0, g, 8); dbox(0.06, 0.08, 0.06, M.yellow, -0.2 + i * 0.2, 1.02, 0.02, g); } dbox(0.5, 0.03, 0.03, M.copper, 0, 0.12, 0, g); g.visible = false; r.tempGround = g; }
  // ---- interação ----
  const id = 'cub:' + bay; const lbl = bay === 'P' ? 'Cubículo do paralelo 52-P' : kind === 'al' ? `Cubículo ${bay} — alimentador` : `Cubículo de entrada ${bay}`;
  inter(c, { id, kind: 'cub', label: lbl, verb: 'Inspecionar', box: [W, H, 0.14], at: [x, H / 2, zf + 0.07], eq: bay, view: { pos: new Vector3(x + 0.05, 1.5, zf + 1.05), look: new Vector3(x, 1.38, zf) } });
  inter(c, { id: 'cubR:' + bay, kind: 'cubR', label: `Traseira do cubículo ${nome} (compartimento de cabos)`, verb: 'Inspecionar', box: [W, H, 0.14], at: [x, H / 2, zb - 0.08], eq: bay, view: { pos: new Vector3(x, 1.4, zb - 1.15), look: new Vector3(x, 1.0, zb) } });
  const P3 = (xx: number, yy: number, zz: number) => new Vector3(xx, yy, zz);
  part(c, id, '43', 'Chave local/remoto 43', 'sel43', [sel], [0.07, 0.07, 0.05], P3(sel.position.x, 2.0, zf + 0.02));
  part(c, id, 'fechar', `FECHAR ${nome} (comando local)`, 'fechar', [bF], [0.05, 0.05, 0.05], P3(bF.position.x, 1.715, zf + 0.02));
  part(c, id, 'abrir', `ABRIR ${nome} (comando local)`, 'abrir', [bA], [0.05, 0.05, 0.05], P3(bA.position.x, 1.715, zf + 0.02));
  part(c, id, 'teste', 'Teste de lâmpadas', 'lamptest', [bT], [0.05, 0.05, 0.05], P3(bT.position.x, 1.715, zf + 0.02));
  part(c, id, 'lamps', 'Lâmpadas de sinalização (trocar a queimada)', 'lampada', r.lamps.map((l) => l.m), [0.4, 0.04, 0.04], P3(x - W / 2 + 0.565, 1.865, zf + 0.02), { tool: 'lampada' });
  part(c, id, 'relay', 'Relé de proteção — trocar página', 'relay:page', [kPg, lm], [0.2, 0.2, 0.05], P3(rx, ry + 0.02, zf + 0.05));
  part(c, id, 'reset', 'RESET do relé (rearme do 86/BF local)', 'relay:reset', [kRst], [0.03, 0.03, 0.04], P3(rx + 0.07, ry - 0.105, zf + 0.05));
  if (k79) part(c, id, 'r79', 'Liga/desliga religamento (79)', 'relay:79', [k79], [0.03, 0.03, 0.04], P3(rx + 0.01, ry - 0.105, zf + 0.05));
  part(c, id, 'porta', 'Porta do compartimento do disjuntor', 'porta', [handle], [0.08, 0.16, 0.06], P3(x + W / 2 - 0.07, 1.24, zf + 0.03));
  part(c, id, 'rack', 'Extração do disjuntor (manivela)', 'rack', [rk], [0.08, 0.08, 0.06], P3(x, 1.02, zf + 0.02), { tool: 'manivela_extracao' });
  part(c, id, 'loto52', `Bloqueio (cadeado) do ${nome}`, 'loto:52', [lockD], [0.07, 0.08, 0.06], P3(x + W / 2 - 0.07, 1.12, zf + 0.04), { tool: 'kit_bloqueio' });
  part(c, id, 'loto43', 'Bloqueio (cadeado) da chave 43', 'loto:43', [lk43], [0.05, 0.06, 0.06], P3(x - W / 2 + 0.74, 1.965, zf + 0.03), { tool: 'kit_bloqueio' });
  part(c, id, 'vpis', 'Indicador de presença de tensão (VPIS)', 'vpis', r.vpis.map((l) => l.m), [0.18, 0.1, 0.05], P3(x - W / 2 + 0.19, 0.8, zf + 0.02));
  part(c, id, 'detector', 'Ponto de teste — constatar ausência de tensão', 'vtest', [], [0.18, 0.12, 0.05], P3(x - W / 2 + 0.19, 0.66, zf + 0.02), { tool: 'detector_mt' });
  part(c, id, 'termo', 'Etiqueta térmica do compartimento de barras', 'termo', [therm], [0.06, 0.05, 0.04], P3(x + W / 2 - 0.07, 2.25, zf + 0.02));
  if (kind === 'al') part(c, id, 'terra', 'Chave de terra 89T (alavanca)', 'terra', [r.earthHex!], [0.08, 0.08, 0.06], P3(x + W / 2 - 0.18, 0.68, zf + 0.02), { tool: 'alavanca_terra' });
  if (kind === 'in') part(c, 'cubR:' + bay, 'aterr', 'Aterramento temporário (lado do trafo)', 'aterr', [], [0.6, 0.6, 0.1], P3(x, 0.8, zb - 0.05), { tool: 'aterr_mt' });
  part(c, 'cubR:' + bay, 'tampa', 'Tampa traseira aparafusada (cabos)', 'tampa', [rb], [W, 1.6, 0.06], P3(x, 1.1, zb - 0.03));
  void kind; return r;
}
const x0rel = (W: number) => 0.09 + W * 0.0;
export function padlock(M: any, x: number, y: number, z: number, p: Group) {
  const g = new Group(); g.position.set(x, y, z); p.add(g); dbox(0.032, 0.03, 0.014, M.red, 0, -0.012, 0, g); const sh = new Mesh(new TorusGeometry(0.011, 0.0025, 6, 12, Math.PI), M.alu); sh.position.y = 0.003; g.add(sh);
  const tag = dbox(0.04, 0.06, 0.001, new MeshStandardMaterial({ color: 0xc8102e, roughness: 0.7 }), 0.006, -0.06, 0.004, g); tag.rotation.z = 0.08; g.visible = false; return g;
}

