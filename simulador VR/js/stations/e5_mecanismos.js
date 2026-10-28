// E5 — Mecanismos 3D: biela-manivela movendo pistão, came e seguidor, macaco de rosca,
// porta em tamanho real com maçaneta e trinco, arquivo com gavetas (objeto dentro).
import { Crank, JointControl, Rail, LatchedHinge } from '../xr/interaction.js';

let S = null;

export function create(ctx) {
  const { THREE, kit, ix, scope, board } = ctx; S = scope;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const Q = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
  const T = 0.9, HP = Math.PI / 2, TAU = Math.PI * 2, G = 9.81;
  const DARK = '#30363b', MID = '#59626a', STEEL = '#8f979e', RAL = '#c9cdc8', R32 = '#b5b3a4', RED = '#c8202e', BLK = '#1e1f21', BRASS = '#b8913a', WOOD = '#9a7650';
  const part = (build) => { const P = new kit.Parts(); build(P); const mat = kit.vcMaterial(); const obj = new THREE.Group(); obj.add(new THREE.Mesh(P.build(), mat)); return { obj, mat }; };
  const lab = (text, x, y, z, w = 0.32, style = {}) => board.add({ pos: V(x, y, z), w, h: w / 4, text, style: { size: 30, bg: '#14181c', ...style } });
  const val = (x, y, z, w = 0.32) => lab('—', x, y, z, w, { mono: true, color: '#6fb3e0', bg: '#0f1215', size: 32 });
  const fmt = (v, d = 1) => v.toFixed(d).replace('.', ',');
  const wrapDeg = (r) => ((r * 180 / Math.PI) % 360 + 360) % 360;

  // ================= estáticos =================
  const P = new kit.Parts();
  P.box(2.6, 0.38, 0.02, DARK, -0.1, 1.62, -0.38);                                                                     // placa de leitura
  P.box(0.1, 0.16, 0.08, MID, -1.15, 0.98, -0.1).cyl(0.02, 0.02, 0.1, STEEL, -1.15, 1.08, -0.06, HP, 0, 0, 12);         // mancal da biela
  P.box(0.42, 0.012, 0.07, STEEL, -0.74, 1.135, 0.04).box(0.42, 0.012, 0.07, STEEL, -0.74, 1.025, 0.04).box(0.03, 0.12, 0.07, DARK, -0.52, 1.08, 0.04) // cilindro em corte
    .box(0.42, 0.12, 0.01, '#3a4046', -0.74, 1.08, 0.0).box(0.5, 0.12, 0.02, MID, -0.74, 0.96, 0.04);
  P.box(0.1, 0.16, 0.08, MID, 0.3, 0.98, -0.1).cyl(0.02, 0.02, 0.1, STEEL, 0.3, 1.08, -0.06, HP, 0, 0, 12);             // mancal do came
  P.box(0.06, 0.02, 0.06, DARK, 0.3, 1.31, -0.0).box(0.02, 0.36, 0.02, DARK, 0.36, 1.13, -0.0);                       // guia do seguidor
  // macaco de rosca (chão)
  P.box(0.5, 0.04, 0.5, DARK, 2.1, 0.02, 0.1).cyl(0.07, 0.09, 0.68, MID, 2.1, 0.38, 0.1, 0, 0, 0, 18);                // pedestal (porca gira no topo)
  P.box(0.36, 0.46, 0.02, DARK, 2.55, 1.35, -0.15).box(0.04, 1.15, 0.04, DARK, 2.55, 0.575, -0.17);
  // porta: batentes e verga
  P.box(0.06, 2.15, 0.12, WOOD, -3.22, 1.075, 0).box(0.06, 2.15, 0.12, WOOD, -2.18, 1.075, 0).box(1.1, 0.06, 0.12, WOOD, -2.7, 2.15, 0)
    .box(0.3, 2.2, 0.12, RAL, -3.4, 1.1, 0).box(0.3, 2.2, 0.12, RAL, -2.0, 1.1, 0);
  // arquivo: carcaça (frente aberta em z = 0,25)
  P.box(0.02, 1.32, 0.6, R32, 2.91, 0.66, -0.05).box(0.02, 1.32, 0.6, R32, 3.39, 0.66, -0.05).box(0.5, 0.02, 0.6, R32, 3.15, 1.31, -0.05)
    .box(0.5, 1.32, 0.02, R32, 3.15, 0.66, -0.34).box(0.5, 0.02, 0.6, R32, 3.15, 0.01, -0.05).box(0.46, 0.02, 0.6, R32, 3.15, 0.665, -0.05);
  scope.add(P.mesh());
  scope.collider({ type: 'box', hx: 0.03, hy: 1.075, hz: 0.06 }, { pos: V(-3.22, 1.075, 0) });
  scope.collider({ type: 'box', hx: 0.03, hy: 1.075, hz: 0.06 }, { pos: V(-2.18, 1.075, 0) });
  scope.collider({ type: 'box', hx: 0.25, hy: 0.01, hz: 0.3 }, { pos: V(3.15, 1.31, -0.05) });
  scope.collider({ type: 'box', hx: 0.25, hy: 0.02, hz: 0.25 }, { pos: V(2.1, 0.02, 0.1) });
  scope.block(-3.6, -1.8, -0.15, 0.15); scope.block(1.75, 2.75, -0.25, 0.45); scope.block(2.88, 3.42, -0.36, 0.26);

  // ================= E5.1 biela-manivela =================
  const O = V(-1.15, 1.08, 0), r = 0.08, L = 0.30;
  let p = part(Pp => Pp.cyl(0.12, 0.12, 0.025, '#4a5157', 0, 0, 0, HP, 0, 0, 28).box(0.2, 0.03, 0.012, STEEL, 0.03, 0, 0.018)
    .cyl(0.012, 0.012, 0.05, STEEL, r, 0, 0.03, HP, 0, 0, 10).cyl(0.016, 0.016, 0.08, BLK, -0.09, 0, 0.05, HP, 0, 0, 12));
  const biela = scope.control(new Crank(ix, {
    scope, name: 'E5.1 volante', obj: p.obj, hitObj: p.obj, mats: [p.mat], shape: { type: 'sphere', r: 0.05, center: V(-0.09, 0, 0.06) },
    anchor: O, axis: V(0, 0, 1), mass: 4,
    colliders: [{ shape: { type: 'cyl', hh: 0.0125, r: 0.12 }, quat: Q(HP, 0, 0) }, { shape: { type: 'cyl', hh: 0.04, r: 0.016 }, pos: V(-0.09, 0, 0.05), quat: Q(HP, 0, 0) }],
    drive: { maxForce: 300, maxVel: 25, fFree: 0.4 },
  }));
  const rod = new THREE.Group(), piston = new THREE.Group();
  rod.add(new kit.Parts().box(L, 0.022, 0.014, STEEL, L / 2, 0, 0).cyl(0.016, 0.016, 0.018, MID, 0, 0, 0, HP, 0, 0, 10).cyl(0.014, 0.014, 0.018, MID, L, 0, 0, HP, 0, 0, 10).mesh());
  piston.add(new kit.Parts().cyl(0.045, 0.045, 0.1, '#c0c5c8', 0.05, 0, 0, 0, 0, HP, 18).torus(0.045, 0.003, DARK, 0.08, 0, 0, 0, HP, 0, 4, 18).mesh());
  rod.position.z = piston.position.z = 0.04; scope.add(rod); scope.add(piston);
  lab('E5.1 BIELA-MANIVELA', -0.95, 1.76, -0.368, 0.4, { bg: '#30363b' });
  const vB1 = val(-1.12, 1.67, -0.368), vB2 = val(-0.78, 1.67, -0.368), vB3 = val(-0.95, 1.575, -0.368, 0.4);
  lab('gire pelo pino preto', -0.95, 1.48, -0.368, 0.3, { size: 28, color: '#98a2aa' });

  // ================= E5.2 came e seguidor =================
  const C0 = V(0.3, 1.08, 0), r0 = 0.055, h = 0.04, D = Math.PI / 180;
  const lift = (f) => {                       // subida 0–120°, permanência 120–180°, descida 180–300°, repouso 300–360°
    f = ((f % TAU) + TAU) % TAU;
    if (f < 120 * D) return h / 2 * (1 - Math.cos(Math.PI * f / (120 * D)));
    if (f < 180 * D) return h;
    if (f < 300 * D) return h / 2 * (1 + Math.cos(Math.PI * (f - 180 * D) / (120 * D)));
    return 0;
  };
  const phase = (f) => { f = ((f % TAU) + TAU) % TAU; return f < 120 * D ? 'subida' : f < 180 * D ? 'permanência' : f < 300 * D ? 'descida' : 'repouso'; };
  p = part(Pp => Pp.extrude(kit.polarShape(f => r0 + lift(f), 120, 0.012), 0.025, BRASS, 0, 0, 0, 0, 0, 0, 4)
    .cyl(0.02, 0.02, 0.04, MID, 0, 0, 0.02, HP, 0, 0, 12).box(0.12, 0.02, 0.012, STEEL, 0.06, 0, 0.03).cyl(0.014, 0.014, 0.07, BLK, 0.115, 0, 0.065, HP, 0, 0, 12));
  const cam = scope.control(new Crank(ix, {
    scope, name: 'E5.2 came', obj: p.obj, hitObj: p.obj, mats: [p.mat], shape: { type: 'sphere', r: 0.05, center: V(0.115, 0, 0.065) },
    anchor: C0, axis: V(0, 0, 1), mass: 1.5,
    colliders: [{ shape: { type: 'cyl', hh: 0.0125, r: r0 }, quat: Q(HP, 0, 0) }, { shape: { type: 'cyl', hh: 0.035, r: 0.014 }, pos: V(0.115, 0, 0.065), quat: Q(HP, 0, 0) }],
    drive: { maxForce: 200, maxVel: 25, fFree: 0.8 },
  }));
  const follower = new THREE.Group();
  follower.add(new kit.Parts().cyl(0.0, 0.01, 0.02, STEEL, 0, 0.01, 0, 0, 0, 0, 10).cyl(0.008, 0.008, 0.26, STEEL, 0, 0.15, 0, 0, 0, 0, 10).cyl(0.03, 0.03, 0.012, RED, 0, 0.285, 0, 0, 0, 0, 16).mesh());
  follower.position.set(C0.x, C0.y + r0, 0); scope.add(follower);
  lab('E5.2 CAME E SEGUIDOR', 0.3, 1.76, -0.368, 0.4, { bg: '#30363b' });
  const vC1 = val(0.13, 1.67, -0.368), vC2 = val(0.47, 1.67, -0.368), vC3 = val(0.3, 1.575, -0.368, 0.4);

  // ================= E5.3 macaco de rosca =================
  // porca giratória no topo do pedestal (barra a 0,75 m); o fuso não gira e sobe com a mesa
  const PITCH = 0.025, ARM = 0.30, LOAD = 25, MAXT = 16;
  p = part(Pp => Pp.cyl(0.06, 0.06, 0.06, MID, 0, 0, 0, 0, 0, 0, 16).box(ARM + 0.02, 0.025, 0.025, STEEL, ARM / 2, 0, 0).cyl(0.02, 0.02, 0.1, BLK, ARM, 0.05, 0, 0, 0, 0, 12));
  const jackCrank = scope.control(new JointControl(ix, {
    scope, name: 'E5.3 barra', obj: p.obj, hitObj: p.obj, mats: [p.mat], shape: { type: 'sphere', r: 0.06, center: V(ARM, 0.05, 0) },
    kind: 'revolute', grabMode: 'angle', rest: 'brake', jointLimits: false, anchor: V(2.1, 0.75, 0.1), axis: V(0, 1, 0), min: 0, max: MAXT * TAU, mass: 1,
    colliders: [{ shape: { type: 'box', hx: ARM / 2, hy: 0.0125, hz: 0.0125 }, pos: V(ARM / 2, 0, 0) }, { shape: { type: 'cyl', hh: 0.05, r: 0.02 }, pos: V(ARM, 0.05, 0) }],
    drive: { maxForce: 200, maxVel: 12 },
  }));
  p = part(Pp => {
    Pp.box(0.45, 0.03, 0.45, '#4a5157', 0, 0, 0).box(0.46, 0.006, 0.46, '#e0b21e', 0, 0.016, 0).cyl(0.022, 0.022, 0.5, STEEL, 0, -0.26, 0, 0, 0, 0, 12);
    for (let i = 1; i < 11; i++) Pp.torus(0.022, 0.004, '#a6adb2', 0, -i * PITCH * 2, 0, HP, 0, 0, 4, 14);
  });
  const table = new JointControl(ix, {   // mesa + fuso: acionados pela porca (não pegável)
    scope, name: 'mesa', obj: p.obj, hitObj: p.obj, shape: { type: 'sphere', r: 0.01 }, kind: 'prismatic', anchor: V(2.1, 0.85, 0.1), axis: V(0, 1, 0),
    min: 0, max: PITCH * MAXT, rest: 'drive', mass: 5,
    colliders: [{ shape: { type: 'box', hx: 0.225, hy: 0.015, hz: 0.225 }, friction: 0.9 }], drive: { maxForce: 3000, maxVel: 0.5 },
  });
  const boxMat = kit.vcMaterial(), boxObj = new THREE.Group();
  boxObj.add(new THREE.Mesh(new kit.Parts().box(0.3, 0.3, 0.3, '#6b4f2a').box(0.31, 0.04, 0.31, '#4a3720', 0, 0.1, 0).build(), boxMat));
  ix.grabbable(scope, { name: 'Caixa 25 kg', obj: boxObj, shapes: [{ shape: { type: 'box', hx: 0.15, hy: 0.15, hz: 0.15 } }], mass: LOAD, hit: { type: 'box', half: V(0.16, 0.16, 0.16) }, mats: [boxMat], distance: false, ...scope.pose(2.1, 0.85 + 0.015 + 0.151, 0.1) });
  lab('E5.3 MACACO DE ROSCA', 2.55, 1.53, -0.138, 0.34, { bg: '#30363b' });
  const vJ1 = val(2.55, 1.445, -0.138, 0.34), vJ2 = val(2.55, 1.36, -0.138, 0.34), vJ3 = val(2.55, 1.275, -0.138, 0.34);
  lab(`passo ${PITCH * 1000} mm/volta (didático)`, 2.55, 1.19, -0.138, 0.34, { size: 28 });

  // ================= E5.4 porta com maçaneta e trinco =================
  const knob = new THREE.Group(); knob.position.set(0.80, 0, 0.03);
  knob.add(new kit.Parts().cyl(0.03, 0.03, 0.01, BRASS, 0, 0, 0, HP, 0, 0, 16).box(0.13, 0.022, 0.022, BRASS, -0.05, 0, 0.03).cyl(0.012, 0.012, 0.03, BRASS, 0, 0, 0.015, HP, 0, 0, 10).mesh());
  p = part(Pp => Pp.box(0.88, 2.05, 0.04, '#e8e3d6', 0.44, 0, 0).box(0.7, 0.8, 0.005, '#d8d2c2', 0.44, 0.45, 0.022).box(0.7, 0.8, 0.005, '#d8d2c2', 0.44, -0.5, 0.022)
    .cyl(0.008, 0.008, 0.1, STEEL, 0, 0.8, 0, 0, 0, 0, 8).cyl(0.008, 0.008, 0.1, STEEL, 0, -0.8, 0, 0, 0, 0, 8));
  p.obj.add(knob);
  const door = scope.control(new LatchedHinge(ix, {
    scope, name: 'E5.4 porta', obj: p.obj, hitObj: p.obj, mats: [p.mat], shape: { type: 'sphere', r: 0.09, center: V(0.80, 0, 0.05) }, knob,
    anchor: V(-3.17, 1.045, 0), axis: V(0, -1, 0), min: 0, max: 1.75, mass: 15,
    colliders: [{ shape: { type: 'box', hx: 0.44, hy: 1.025, hz: 0.02 }, pos: V(0.44, 0, 0) }], drive: { maxForce: 400, fFree: 3, maxVel: 3 },
  }));
  lab('E5.4 PORTA + MAÇANETA', -2.7, 2.34, 0.065, 0.6, { bg: '#30363b' });
  const vDoor = val(-2.7, 2.215, 0.065, 0.4);

  // ================= E5.5 arquivo com gavetas =================
  const drawers = [0.98, 0.36].map((yc, i) => {
    const q = part(Pp => Pp.box(0.46, 0.58, 0.02, R32, 0, 0, 0.01).box(0.2, 0.025, 0.03, DARK, 0, 0.2, 0.035).box(0.12, 0.05, 0.004, '#f2f2f2', 0, 0.1, 0.022)
      .box(0.42, 0.01, 0.52, STEEL, 0, -0.22, -0.26).box(0.01, 0.36, 0.52, STEEL, -0.21, -0.05, -0.26).box(0.01, 0.36, 0.52, STEEL, 0.21, -0.05, -0.26).box(0.42, 0.36, 0.01, STEEL, 0, -0.05, -0.52));
    return scope.control(new Rail(ix, {
      scope, name: `E5.5 gaveta ${i + 1}`, obj: q.obj, hitObj: q.obj, mats: [q.mat], shape: { type: 'box', half: V(0.24, 0.3, 0.045), center: V(0, 0, 0.02) },
      anchor: V(3.15, yc, 0.25), axis: V(0, 0, 1), min: 0, max: 0.48, mass: 6,
      colliders: [{ shape: { type: 'box', hx: 0.21, hy: 0.005, hz: 0.26 }, pos: V(0, -0.22, -0.26), friction: 0.9 }, { shape: { type: 'box', hx: 0.005, hy: 0.18, hz: 0.26 }, pos: V(-0.21, -0.05, -0.26) },
        { shape: { type: 'box', hx: 0.005, hy: 0.18, hz: 0.26 }, pos: V(0.21, -0.05, -0.26) }, { shape: { type: 'box', hx: 0.21, hy: 0.18, hz: 0.005 }, pos: V(0, -0.05, -0.52) },
        { shape: { type: 'box', hx: 0.23, hy: 0.29, hz: 0.01 }, pos: V(0, 0, 0.01) }],
      drive: { maxForce: 300, fFree: 6, maxVel: 1.5 },
    }));
  });
  const bindMat = kit.vcMaterial(), bindObj = new THREE.Group();
  bindObj.add(new THREE.Mesh(new kit.Parts().box(0.3, 0.05, 0.24, '#1f5aa6').box(0.302, 0.03, 0.2, '#f2f2f2', 0, 0, 0).build(), bindMat));
  ix.grabbable(scope, { name: 'Pasta', obj: bindObj, shapes: [{ shape: { type: 'box', hx: 0.15, hy: 0.025, hz: 0.12 } }], mass: 0.8, friction: 0.9, hit: { type: 'box', half: V(0.16, 0.035, 0.13) }, mats: [bindMat], ...scope.pose(3.15, 0.98 - 0.215 + 0.026, -0.02) });
  lab('E5.5 ARQUIVO', 3.15, 1.40, 0.2, 0.3, { bg: '#30363b' });

  scope.resetButton(1.3, T, 0.3, board);
  scope.add(board.build());

  // ================= atualização =================
  let acc = 1;
  function update(dt) {
    // biela-manivela: x = r cos θ + √(L² − r² sen² θ)
    const th = biela.value, px = O.x + r * Math.cos(th), py = O.y + r * Math.sin(th);
    const xp = r * Math.cos(th) + Math.sqrt(L * L - r * r * Math.sin(th) ** 2), qx = O.x + xp;
    rod.position.x = px; rod.position.y = py; rod.rotation.z = Math.atan2(O.y - py, qx - px);
    piston.position.x = qx; piston.position.y = O.y;
    // came: seguidor de ponta radial no topo (contato a 90° no mundo)
    const fc = Math.PI / 2 - cam.value, s = lift(fc);
    follower.position.y = C0.y + r0 + s;
    // macaco: altura = passo × voltas
    const turns = jackCrank.value / TAU; table.drive.target = PITCH * turns;
    acc += dt; if (acc < 0.1) return; acc = 0;
    const fromPMS = (L + r) - xp;
    board.set(vB1, `θ ${wrapDeg(th).toFixed(0)}°`); board.set(vB2, `${biela.rpm.toFixed(0)} rpm`);
    board.set(vB3, `x ${fmt(fromPMS * 1000, 0)} mm do PMS${fromPMS < 0.002 ? ' · PMS' : fromPMS > 2 * r - 0.002 ? ' · PMI' : ''}`);
    board.set(vC1, `φ ${wrapDeg(fc).toFixed(0)}°`); board.set(vC2, `s ${fmt(s * 1000, 1)} mm`); board.set(vC3, phase(fc));
    const hmm = table.drive.value * 1000, F = LOAD * G * PITCH / (TAU * ARM);
    board.set(vJ1, `${fmt(turns)} voltas · +${fmt(Math.max(0, hmm), 0)} mm`);
    board.set(vJ2, `carga ${LOAD} kg = ${fmt(LOAD * G, 0)} N`); board.set(vJ3, `F ideal = ${fmt(F)} N`);
    board.set(vDoor, `${door.latched ? 'TRANCADA' : 'DESTRANCADA'} · ${Math.max(0, door.value * 180 / Math.PI).toFixed(0)}°`, { color: door.latched ? '#e39b2d' : '#3da56a' });
    board.flush();
  }
  return { update };
}

export function dispose() { S?.dispose(); S = null; }
