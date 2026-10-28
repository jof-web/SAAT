// E4 — Controles: painel industrial com I7–I13 e I17. Cada controle tem LED e valor numérico
// lidos do estado FÍSICO da junta (não da intenção da mão), para confirmar que o input é lido certo.
import { Lever, Toggle, Valve, Crank, Slider, Hinge, Rail, TiltControl, PokeButton } from '../xr/interaction.js';

let S = null;

export function create(ctx) {
  const { THREE, kit, ix, scope, board } = ctx; S = scope;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const Q = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
  const T = 0.9, zf = -0.34, Y = 1.30, HP = Math.PI / 2, TAU = Math.PI * 2;
  const RAL = '#c9cdc8', R32 = '#b5b3a4', DARK = '#30363b', MID = '#59626a', STEEL = '#8f979e', RED = '#c8202e', BLK = '#1e1f21';

  // peça móvel: grupo + malha com material próprio (destaque)
  const part = (build) => { const P = new kit.Parts(); build(P); const mat = kit.vcMaterial(); const obj = new THREE.Group(); obj.add(new THREE.Mesh(P.build(), mat)); return { obj, mat }; };

  // ---------------- estáticos ----------------
  const P = new kit.Parts();
  P.box(3.0, 1.15, 0.06, RAL, 0, T + 0.575, -0.37).box(3.0, 0.03, 0.08, '#9aa0a3', 0, T + 1.165, -0.37);
  P.box(0.45, 0.12, 0.02, MID, -1.275, 0.80, 0.39).box(1.95, 0.12, 0.02, MID, 0.525, 0.80, 0.39);                 // saia frontal
  P.box(0.01, 0.16, 0.74, DARK, -1.055, 0.78, 0.03).box(0.01, 0.16, 0.74, DARK, -0.445, 0.78, 0.03).box(0.62, 0.01, 0.74, DARK, -0.75, 0.695, 0.03); // caixa da gaveta
  P.cyl(0.05, 0.05, 0.016, DARK, -1.25, Y, zf + 0.008, HP, 0, 0, 24);                                            // aro do botão
  P.box(0.07, 0.11, 0.015, DARK, -0.88, Y, zf + 0.0075);                                                          // base do interruptor
  P.box(0.09, 0.2, 0.05, DARK, -0.48, 1.25, zf + 0.025);                                                          // caixa da alavanca
  P.cyl(0.04, 0.04, 0.012, DARK, -0.02, Y, zf + 0.006, HP, 0, 0, 20).cyl(0.012, 0.012, 0.08, MID, -0.02, Y, zf + 0.04, HP, 0, 0, 12); // flange/haste da válvula
  P.cyl(0.03, 0.03, 0.05, DARK, 0.45, Y, zf + 0.025, HP, 0, 0, 16);                                              // mancal da manivela
  P.box(0.42, 0.024, 0.012, DARK, 0.88, Y, zf + 0.006);                                                           // trilho do slider
  for (let i = 0; i < 5; i++) P.box(0.004, 0.02, 0.004, '#e8ebed', 0.70 + i * 0.09, Y + 0.035, zf + 0.004);
  P.box(0.012, 0.44, 0.12, R32, 1.176, Y, zf + 0.06).box(0.012, 0.44, 0.12, R32, 1.464, Y, zf + 0.06)            // armário da porta
    .box(0.30, 0.012, 0.12, R32, 1.32, Y + 0.214, zf + 0.06).box(0.30, 0.012, 0.12, R32, 1.32, Y - 0.214, zf + 0.06);
  P.box(0.16, 0.05, 0.16, DARK, 0.75, T + 0.025, 0.15).cyl(0.04, 0.05, 0.03, BLK, 0.75, T + 0.065, 0.15, 0, 0, 0, 16); // base do joystick
  scope.add(P.mesh());
  scope.collider({ type: 'box', hx: 1.5, hy: 0.575, hz: 0.03 }, { pos: V(0, T + 0.575, -0.37) });
  scope.block(-1.5, 1.5, -0.45, 0.4);

  // ---------------- I7 botão (poke) ----------------
  const bRoot = new THREE.Group(); bRoot.position.set(-1.25, Y, zf); bRoot.rotation.x = HP; scope.add(bRoot); // +Y local = saindo do painel
  const bCap = new THREE.Group(); bRoot.add(bCap); const bMat = kit.vcMaterial();
  bCap.add(new THREE.Mesh(new kit.Parts().cyl(0.034, 0.034, 0.022, '#2f9e55', 0, 0.027, 0, 0, 0, 0, 24).build(), bMat));
  const btn = scope.control(new PokeButton(ix, { name: 'I7 botão', root: bRoot, cap: bCap, radius: 0.034, top: 0.038, travel: 0.012, mats: [bMat] }));

  // ---------------- I8 interruptor ----------------
  let p = part(P => P.cyl(0.007, 0.007, 0.07, '#d9dde0', 0, 0, 0.035, HP, 0, 0, 10).sphere(0.013, '#d9dde0', 0, 0, 0.072));
  const tog = scope.control(new Toggle(ix, {
    scope, name: 'I8 interruptor', obj: p.obj, hitObj: p.obj, mats: [p.mat], shape: { type: 'sphere', r: 0.03, center: V(0, 0, 0.065) },
    anchor: V(-0.88, Y, zf + 0.015), axis: V(-1, 0, 0), angle: 0.4, mass: 0.1,
    colliders: [{ shape: { type: 'box', hx: 0.01, hy: 0.01, hz: 0.04 }, pos: V(0, 0, 0.04) }], drive: { maxForce: 60 },
  }));

  // ---------------- I9 alavanca (5 travas) ----------------
  p = part(P => P.cyl(0.025, 0.025, 0.07, MID, 0, 0, 0, 0, 0, HP, 16).box(0.028, 0.028, 0.24, STEEL, 0, 0, 0.13).sphere(0.035, RED, 0, 0, 0.27, 16));
  const lev = scope.control(new Lever(ix, {
    scope, name: 'I9 alavanca', obj: p.obj, hitObj: p.obj, mats: [p.mat], shape: { type: 'box', half: V(0.045, 0.045, 0.16), center: V(0, 0, 0.16) },
    anchor: V(-0.48, 1.25, zf + 0.05), axis: V(-1, 0, 0), min: -0.72, max: 0.72, detents: [-0.7, -0.35, 0, 0.35, 0.7], mass: 0.8,
    colliders: [{ shape: { type: 'box', hx: 0.014, hy: 0.014, hz: 0.12 }, pos: V(0, 0, 0.13) }, { shape: { type: 'ball', r: 0.035 }, pos: V(0, 0, 0.27) }],
    drive: { maxForce: 200 },
  }));

  // ---------------- I10 válvula (pulso; 3 voltas) ----------------
  p = part(P => {
    P.torus(0.11, 0.012, RED, 0, 0, 0, 0, 0, 0, 8, 36).cyl(0.022, 0.022, 0.03, MID, 0, 0, 0, HP, 0, 0, 14).sphere(0.014, '#f2c230', 0.11, 0, 0.012, 10);
    for (let k = 0; k < 3; k++) { const a = k * TAU / 3; P.box(0.1, 0.012, 0.012, RED, Math.cos(a) * 0.06, Math.sin(a) * 0.06, 0, 0, 0, a); }
  });
  const valve = scope.control(new Valve(ix, {
    scope, name: 'I10 válvula', obj: p.obj, hitObj: p.obj, mats: [p.mat], shape: { type: 'sphere', r: 0.125 },
    anchor: V(-0.02, Y, zf + 0.08), axis: V(0, 0, 1), min: 0, max: 3 * TAU, mass: 1,
    colliders: [{ shape: { type: 'cyl', hh: 0.012, r: 0.12 }, quat: Q(HP, 0, 0) }], drive: { maxForce: 150, maxVel: 10 },
  }));

  // ---------------- I11 manivela ----------------
  p = part(P => P.cyl(0.06, 0.06, 0.02, MID, 0, 0, 0.01, HP, 0, 0, 20).box(0.15, 0.03, 0.015, STEEL, 0.07, 0, 0.025).cyl(0.016, 0.016, 0.09, BLK, 0.135, 0, 0.07, HP, 0, 0, 12));
  const crank = scope.control(new Crank(ix, {
    scope, name: 'I11 manivela', obj: p.obj, hitObj: p.obj, mats: [p.mat], shape: { type: 'sphere', r: 0.05, center: V(0.135, 0, 0.07) },
    anchor: V(0.45, Y, zf + 0.05), axis: V(0, 0, 1), mass: 1.5,
    colliders: [{ shape: { type: 'cyl', hh: 0.01, r: 0.06 }, pos: V(0, 0, 0.01), quat: Q(HP, 0, 0) }, { shape: { type: 'box', hx: 0.075, hy: 0.015, hz: 0.008 }, pos: V(0.07, 0, 0.025) },
      { shape: { type: 'cyl', hh: 0.045, r: 0.016 }, pos: V(0.135, 0, 0.07), quat: Q(HP, 0, 0) }],
    drive: { maxForce: 200, maxVel: 25, fFree: 0.5 },
  }));

  // ---------------- I12 slider ----------------
  p = part(P => P.box(0.04, 0.06, 0.035, '#2e6fb5', 0, 0, 0.0175).box(0.044, 0.008, 0.04, '#e8ebed', 0, 0, 0.02));
  const slider = scope.control(new Slider(ix, {
    scope, name: 'I12 slider', obj: p.obj, hitObj: p.obj, mats: [p.mat], shape: { type: 'box', half: V(0.03, 0.04, 0.03), center: V(0, 0, 0.02) },
    anchor: V(0.70, Y, zf + 0.012), axis: V(1, 0, 0), min: 0, max: 0.36, mass: 0.2,
    colliders: [{ shape: { type: 'box', hx: 0.02, hy: 0.03, hz: 0.0175 }, pos: V(0, 0, 0.0175) }], drive: { maxForce: 80, maxVel: 3 },
  }));

  // ---------------- I13 porta (dobradiça) ----------------
  p = part(P => P.box(0.30, 0.44, 0.015, R32, 0.15, 0, 0.0075).box(0.015, 0.10, 0.02, DARK, 0.26, 0, 0.025).cyl(0.008, 0.008, 0.06, DARK, 0, 0.15, 0.0075, 0, 0, 0, 8).cyl(0.008, 0.008, 0.06, DARK, 0, -0.15, 0.0075, 0, 0, 0, 8));
  const door = scope.control(new Hinge(ix, {
    scope, name: 'I13 porta', obj: p.obj, hitObj: p.obj, mats: [p.mat], shape: { type: 'box', half: V(0.155, 0.225, 0.03), center: V(0.15, 0, 0.012) },
    anchor: V(1.17, Y, zf + 0.12), axis: V(0, -1, 0), min: 0, max: 1.9, mass: 1.2,
    colliders: [{ shape: { type: 'box', hx: 0.15, hy: 0.22, hz: 0.0075 }, pos: V(0.15, 0, 0.0075) }], drive: { maxForce: 100, fFree: 2, maxVel: 6 },
  }));

  // ---------------- I13 gaveta (trilho) ----------------
  p = part(P => P.box(0.58, 0.14, 0.02, R32, 0, 0, 0.01).box(0.2, 0.022, 0.025, DARK, 0, 0, 0.035)
    .box(0.54, 0.01, 0.5, STEEL, 0, -0.06, -0.25).box(0.01, 0.1, 0.5, STEEL, -0.27, -0.015, -0.25).box(0.01, 0.1, 0.5, STEEL, 0.27, -0.015, -0.25).box(0.54, 0.1, 0.01, STEEL, 0, -0.015, -0.5));
  const drawer = scope.control(new Rail(ix, {
    scope, name: 'I13 gaveta', obj: p.obj, hitObj: p.obj, mats: [p.mat], shape: { type: 'box', half: V(0.3, 0.08, 0.035), center: V(0, 0, 0.02) },
    anchor: V(-0.75, 0.78, 0.40), axis: V(0, 0, 1), min: 0, max: 0.42, mass: 2,
    colliders: [{ shape: { type: 'box', hx: 0.27, hy: 0.005, hz: 0.25 }, pos: V(0, -0.06, -0.25) }, { shape: { type: 'box', hx: 0.005, hy: 0.05, hz: 0.25 }, pos: V(-0.27, -0.015, -0.25) },
      { shape: { type: 'box', hx: 0.005, hy: 0.05, hz: 0.25 }, pos: V(0.27, -0.015, -0.25) }, { shape: { type: 'box', hx: 0.27, hy: 0.05, hz: 0.005 }, pos: V(0, -0.015, -0.5) },
      { shape: { type: 'box', hx: 0.29, hy: 0.07, hz: 0.01 }, pos: V(0, 0, 0.01) }],
    drive: { maxForce: 150, fFree: 4, maxVel: 3 },
  }));

  // ---------------- I17 joystick (junta esférica) ----------------
  p = part(P => P.cyl(0.011, 0.011, 0.16, STEEL, 0, 0.08, 0, 0, 0, 0, 10).sphere(0.032, RED, 0, 0.17, 0, 14));
  const joy = scope.control(new TiltControl(ix, {
    scope, name: 'I17 joystick', obj: p.obj, hitObj: p.obj, mats: [p.mat], shape: { type: 'sphere', r: 0.05, center: V(0, 0.17, 0) },
    anchor: V(0.75, T + 0.07, 0.15), maxTilt: 0.35, mass: 0.3,
    colliders: [{ shape: { type: 'box', hx: 0.012, hy: 0.08, hz: 0.012 }, pos: V(0, 0.08, 0) }, { shape: { type: 'ball', r: 0.032 }, pos: V(0, 0.17, 0) }],
  }));

  scope.resetButton(1.30, T, 0.25, board);

  // ---------------- LEDs e etiquetas ----------------
  const cols = [['I7 BOTÃO', -1.25], ['I8 INTERRUPTOR', -0.88], ['I9 ALAVANCA', -0.48], ['I10 VÁLVULA', -0.02], ['I11 MANIVELA', 0.45], ['I12 SLIDER', 0.88], ['I13 PORTA', 1.32]];
  const leds = new kit.LedArray(10, 0.013), vals = [];
  for (const [name, x] of cols) {
    leds.add(V(x, 1.62, zf + 0.008));
    board.add({ pos: V(x, 1.86, zf + 0.002), w: 0.32, h: 0.08, text: name, style: { size: 30, bg: '#30363b', color: '#e8ebed' } });
    vals.push(board.add({ pos: V(x, 1.75, zf + 0.002), w: 0.32, h: 0.08, text: '—', style: { size: 36, mono: true, bg: '#0f1215', color: '#6fb3e0' } }));
  }
  leds.add(V(-0.38, 0.80, 0.406)); const vDrawer = board.add({ pos: V(-0.18, 0.80, 0.402), w: 0.32, h: 0.08, text: '', style: { size: 30, mono: true, bg: '#0f1215', color: '#6fb3e0' } });
  leds.add(V(0.52, 0.80, 0.406)); const vJoy = board.add({ pos: V(0.75, 0.80, 0.402), w: 0.36, h: 0.08, text: '', style: { size: 30, mono: true, bg: '#0f1215', color: '#6fb3e0' } });
  leds.add(V(1.32, Y, zf + 0.012)); // LED interno do armário (acende com a porta aberta)
  leds.finalize(); scope.add(leds.mesh); scope.add(board.build());

  const sgn = (v, d = 2) => (v >= 0 ? '+' : '') + v.toFixed(d);
  const deg = (r) => r * 180 / Math.PI;
  const st = (held, active) => (held ? 2 : active ? 1 : 0);
  let acc = 1;

  function update(dt) {
    const vTog = tog.drive.value > 0, P = lev.idx - 2, vPct = valve.value / (3 * TAU) * 100, sPct = slider.value / 0.36 * 100;
    const dDeg = deg(door.value), cm = drawer.value * 100, jx = joy.x, jy = joy.y, rpm = crank.rpm;
    leds.set(0, btn.pressed ? 1 : 0);
    leds.set(1, st(tog.held, vTog));
    leds.set(2, st(lev.held, lev.locked && P !== 0));
    leds.set(3, st(valve.held, vPct > 2));
    leds.set(4, st(crank.held, Math.abs(rpm) > 5));
    leds.set(5, st(slider.held, sPct > 2));
    leds.set(6, st(door.held, dDeg > 5));
    leds.set(7, st(drawer.held, cm > 2));
    leds.set(8, st(joy.held, Math.abs(jx) > 0.08 || Math.abs(jy) > 0.08));
    leds.set(9, dDeg > 5 ? 1 : 0);
    acc += dt; if (acc < 0.1) return; acc = 0;     // texto a 10 Hz
    board.set(vals[0], `${btn.pressed ? 'PRESS' : 'SOLTO'} · ${btn.count}`);
    board.set(vals[1], vTog ? 'ON' : 'OFF', { color: vTog ? '#3da56a' : '#98a2aa' });
    board.set(vals[2], `P${P > 0 ? '+' : ''}${P} ${sgn(deg(lev.value), 0)}°${lev.locked ? ' T' : ''}`);
    board.set(vals[3], `${(valve.value / TAU).toFixed(2)}v ${Math.max(0, vPct).toFixed(0)}%`);
    board.set(vals[4], `${rpm.toFixed(0)}rpm ${(crank.value / TAU).toFixed(1)}v`);
    board.set(vals[5], `${Math.max(0, sPct).toFixed(0)} %`);
    board.set(vals[6], `${Math.max(0, dDeg).toFixed(0)}°${!door.held && door.value < 0.02 ? ' FECH' : ''}`);
    board.set(vDrawer, `GAVETA ${Math.max(0, cm).toFixed(0)} cm`);
    board.set(vJoy, `X${sgn(jx)} Y${sgn(jy)}`);
    board.flush();
  }
  return { update };
}

export function dispose() { S?.dispose(); S = null; }
