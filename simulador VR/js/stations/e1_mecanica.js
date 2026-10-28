// E1 — Mecânica: trem de engrenagens (manivela + relação em tempo real), polias simples e talha (força exibida),
// plano inclinado com bloco e mola com massa oscilando. Valores mostrados são os ideais (sem atrito), exceto o plano.
import { Crank, Slider, Rail, SpringRail, JointControl, PokeButton } from '../xr/interaction.js';

let S = null;

export function create(ctx) {
  const { THREE, kit, ix, scope, board } = ctx; S = scope;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const Q = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
  const T = 0.9, HP = Math.PI / 2, TAU = Math.PI * 2, G = 9.81;
  const DARK = '#30363b', MID = '#59626a', STEEL = '#8f979e', RAL = '#c9cdc8', RED = '#c8202e', BLK = '#1e1f21', WOOD = '#a0784a', BRASS = '#b8913a';
  const part = (build, mat = kit.vcMaterial()) => { const P = new kit.Parts(); build(P); const obj = new THREE.Group(); obj.add(new THREE.Mesh(P.build(), mat)); return { obj, mat }; };
  const lab = (text, x, y, z, w = 0.32, style = {}, up = V(0, 1, 0)) => board.add({ pos: V(x, y, z), up, w, h: w / 4, text, style: { size: 30, bg: '#14181c', ...style } });
  const val = (x, y, z, w = 0.32) => lab('—', x, y, z, w, { mono: true, color: '#6fb3e0', bg: '#0f1215', size: 32 });
  const fmt = (v, d = 1) => v.toFixed(d).replace('.', ',');
  const frac = (x) => x - Math.floor(x);

  // ================= estáticos =================
  const P = new kit.Parts();
  P.box(1.4, 0.88, 0.04, '#3a4046', -0.75, 1.36, -0.36).box(0.05, 0.05, 0.3, DARK, -1.35, 0.925, -0.22).box(0.05, 0.05, 0.3, DARK, -0.15, 0.925, -0.22); // painel das engrenagens
  P.box(1.86, 0.1, 0.1, DARK, -2.6, 2.5, -0.1).box(0.08, 2.5, 0.08, DARK, -3.49, 1.25, -0.1).box(0.08, 2.5, 0.08, DARK, -1.71, 1.25, -0.1)        // pórtico das polias
    .box(0.4, 0.02, 0.4, MID, -3.49, 0.01, -0.1).box(0.4, 0.02, 0.4, MID, -1.71, 0.01, -0.1);
  P.box(0.62, 0.44, 0.02, DARK, -3.9, 1.10, 0.1).box(0.04, 0.9, 0.04, DARK, -3.9, 0.45, 0.08);                                                   // placa das polias
  P.box(0.06, 2.15, 0.06, DARK, 2.05, 1.075, -0.25).box(0.06, 0.06, 0.5, DARK, 2.05, 2.12, 0).box(0.35, 0.02, 0.35, MID, 2.05, 0.01, -0.25)       // poste da mola
    .torus(0.012, 0.003, STEEL, 2.05, 2.075, 0.2, 0, HP, 0, 6, 12).box(0.36, 0.56, 0.02, DARK, 2.05, 1.75, -0.21);
  P.box(0.05, 0.03, 0.3, DARK, 0.2, 0.915, 0).box(0.5, 0.01, 0.03, DARK, 0.62, 0.905, 0.3);                                                            // apoio da rampa, trilho do slider
  for (let a = 0; a <= 40; a += 10) { const r = a * Math.PI / 180; P.box(0.004, 0.03, 0.004, '#e8ebed', 0.2 + Math.cos(r) * 0.32, 0.93 + Math.sin(r) * 0.32, -0.16); } // transferidor
  scope.add(P.mesh());
  scope.collider({ type: 'box', hx: 0.7, hy: 0.44, hz: 0.02 }, { pos: V(-0.75, 1.36, -0.36) });
  for (const x of [-3.49, -1.71]) scope.collider({ type: 'box', hx: 0.04, hy: 1.25, hz: 0.04 }, { pos: V(x, 1.25, -0.1) });
  scope.collider({ type: 'box', hx: 0.03, hy: 1.075, hz: 0.03 }, { pos: V(2.05, 1.075, -0.25) });
  scope.block(-4.25, -1.6, -0.3, 0.25); scope.block(1.9, 2.2, -0.35, 0.3);

  // ================= E1.1 trem de engrenagens =================
  const m = 0.01, zA = 12, zB = 36, zC = 12, zD = 24, ratio = (zB / zA) * (zD / zC);
  const zBack = -0.332, zFront = -0.306, cA = V(-1.18, 1.30, 0), cB = V(-0.94, 1.30, 0), phiCD = 35 * Math.PI / 180;
  const cD = V(cB.x + (m * (zC + zD) / 2) * Math.cos(phiCD), cB.y + (m * (zC + zD) / 2) * Math.sin(phiCD), 0);
  const gear = (z, color, extra) => part(Pp => { Pp.extrude(kit.gearShape(z, m, 0.008), 0.016, color, 0, 0, 0); extra?.(Pp); });
  // A + manivela = corpo físico (junta revolute); B, C, D seguem pela relação (cinemático)
  let p = gear(zA, BRASS, Pp => Pp.cyl(0.015, 0.015, 0.04, MID, 0, 0, 0.02, HP, 0, 0, 12).box(0.13, 0.02, 0.012, STEEL, 0.06, 0, 0.03).cyl(0.014, 0.014, 0.07, BLK, 0.12, 0, 0.07, HP, 0, 0, 12));
  const crank = scope.control(new Crank(ix, {
    scope, name: 'E1.1 manivela', obj: p.obj, hitObj: p.obj, mats: [p.mat], shape: { type: 'sphere', r: 0.05, center: V(0.12, 0, 0.07) },
    anchor: V(cA.x, cA.y, zBack), axis: V(0, 0, 1), mass: 1,
    colliders: [{ shape: { type: 'cyl', hh: 0.008, r: 0.07 }, quat: Q(HP, 0, 0) }, { shape: { type: 'box', hx: 0.065, hy: 0.01, hz: 0.006 }, pos: V(0.06, 0, 0.03) }, { shape: { type: 'cyl', hh: 0.035, r: 0.014 }, pos: V(0.12, 0, 0.07), quat: Q(HP, 0, 0) }],
    drive: { maxForce: 200, maxVel: 25, fFree: 0.8 },
  }));
  const gB = gear(zB, STEEL), gC = gear(zC, BRASS), gD = gear(zD, STEEL, Pp => Pp.box(0.1, 0.012, 0.006, RED, 0.05, 0, 0.012));
  gB.obj.position.set(cB.x, cB.y, zBack); gC.obj.position.set(cB.x, cB.y, zFront); gD.obj.position.set(cD.x, cD.y, zFront);
  for (const g of [gB, gC, gD]) scope.add(g.obj);
  scope.add(new kit.Parts().cyl(0.008, 0.008, 0.06, MID, cB.x, cB.y, -0.32, HP, 0, 0, 10).cyl(0.008, 0.008, 0.06, MID, cD.x, cD.y, -0.31, HP, 0, 0, 10).mesh());
  // fases para os dentes engrenarem (dente encontra vão na linha de centros)
  const thB0 = Math.PI - Math.PI / zB;                                   // A→B na direção 0
  const thD0 = phiCD + Math.PI - (TAU / zD) * (0.5 - frac((phiCD - thB0) * zC / TAU));
  lab('E1.1 TREM DE ENGRENAGENS', -1.10, 1.74, -0.338, 0.4, { size: 30, bg: '#30363b' });
  const vIn = val(-1.22, 1.64, -0.338, 0.3), vOut = val(-0.90, 1.64, -0.338, 0.3), vRat = val(-0.42, 1.64, -0.338, 0.6);
  lab('A z12 manivela', -1.24, 1.15, -0.338, 0.24, { size: 30 }); lab('B z36', -0.94, 1.06, -0.338, 0.2, { size: 30 });
  lab('C z12 eixo de B', -0.50, 1.20, -0.338, 0.26, { size: 30 }); lab('D z24 saída', -0.48, 1.47, -0.338, 0.24, { size: 30 });

  // ================= E1.3 plano inclinado =================
  const MU = 0.4, MB = 2;
  p = part(Pp => Pp.box(1.0, 0.02, 0.26, WOOD, 0.5, 0.01, 0).box(1.0, 0.03, 0.01, DARK, 0.5, 0.025, 0.13).box(1.0, 0.03, 0.01, DARK, 0.5, 0.025, -0.13).box(0.02, 0.07, 0.26, DARK, 0.01, 0.045, 0));
  const ramp = new JointControl(ix, {   // corpo acionado (não pegável): ângulo vem do slider
    scope, name: 'rampa', obj: p.obj, hitObj: p.obj, shape: { type: 'sphere', r: 0.01 }, kind: 'revolute', anchor: V(0.2, 0.93, 0), axis: V(0, 0, 1),
    min: 0, max: 0.70, rest: 'drive', mass: 4,
    colliders: [{ shape: { type: 'box', hx: 0.5, hy: 0.01, hz: 0.13 }, pos: V(0.5, 0.01, 0), friction: MU }, { shape: { type: 'box', hx: 0.01, hy: 0.035, hz: 0.13 }, pos: V(0.01, 0.045, 0) },
      { shape: { type: 'box', hx: 0.5, hy: 0.02, hz: 0.005 }, pos: V(0.5, 0.025, 0.135) }, { shape: { type: 'box', hx: 0.5, hy: 0.02, hz: 0.005 }, pos: V(0.5, 0.025, -0.135) }],
    drive: { maxForce: 800, maxVel: 0.6 },
  });
  const blkMat = kit.vcMaterial(), blkObj = new THREE.Group(); blkObj.add(new THREE.Mesh(new kit.Parts().box(0.12, 0.08, 0.12, '#2e6fb5').box(0.122, 0.01, 0.122, '#e8ebed', 0, 0.03, 0).build(), blkMat));
  const bp = scope.pose(0.95, 0.99, 0);
  const block = ix.grabbable(scope, { name: 'Bloco 2 kg', obj: blkObj, shapes: [{ shape: { type: 'box', hx: 0.06, hy: 0.04, hz: 0.06 } }], mass: MB, friction: MU, restitution: 0, hit: { type: 'box', half: V(0.07, 0.05, 0.07) }, mats: [blkMat], ...bp });
  p = part(Pp => Pp.box(0.05, 0.04, 0.05, '#2e6fb5', 0, 0.02, 0).box(0.052, 0.006, 0.052, '#e8ebed', 0, 0.035, 0));
  const angSl = scope.control(new Slider(ix, {
    scope, name: 'E1.3 ângulo', obj: p.obj, hitObj: p.obj, mats: [p.mat], shape: { type: 'box', half: V(0.035, 0.035, 0.035), center: V(0, 0.02, 0) },
    anchor: V(0.40, 0.905, 0.3), axis: V(1, 0, 0), min: 0, max: 0.40, mass: 0.2,
    colliders: [{ shape: { type: 'box', hx: 0.025, hy: 0.02, hz: 0.025 }, pos: V(0, 0.02, 0) }], drive: { maxForce: 60, maxVel: 2 },
  }));
  lab('ÂNGULO', 0.62, 0.906, 0.365, 0.16, { size: 34 }, V(0, 0, -1));
  lab('E1.3 PLANO INCLINADO', 0.72, 2.0, -0.3, 0.5, { bg: '#30363b' });
  const vTh = val(0.52, 1.88, -0.3), vSt = val(0.92, 1.88, -0.3), vPp = val(0.52, 1.78, -0.3), vFa = val(0.92, 1.78, -0.3);
  lab(`μ ${fmt(MU, 2)} · limite ${fmt(Math.atan(MU) * 180 / Math.PI)}° · ${MB} kg`, 0.72, 1.66, -0.3, 0.64, { size: 30 });

  // ================= E1.2 polias: simples (n=1) e talha (n=4) =================
  const W = 20, rigs = [
    { n: 1, name: 'SIMPLES n=1', x: -3.1, hx: -3.02, max: 1.0, vHeld: 0.6, vDrop: 0.3 },
    { n: 4, name: 'TALHA n=4', x: -2.21, hx: -2.01, max: 1.2, vHeld: 2.4, vDrop: 1.2 },
  ];
  const ropePos = new Float32Array(7 * 2 * 3), ropeGeo = new THREE.BufferGeometry();
  ropeGeo.setAttribute('position', new THREE.BufferAttribute(ropePos, 3));
  const rope = new THREE.LineSegments(ropeGeo, new THREE.LineBasicMaterial({ color: 0xd8c39a })); rope.frustumCulled = false; scope.add(rope);
  const sheave = (r) => new kit.Parts().cyl(r, r, 0.03, STEEL, 0, 0, 0, HP, 0, 0, 18).box(r * 1.6, 0.008, 0.032, DARK, 0, 0, 0).mesh();
  const SP = new kit.Parts();
  rigs.forEach((r, i) => {
    r.wt = new THREE.Group(); scope.add(r.wt);
    const w = r.n === 1 ? 0.2 : 0.3, wx = r.n === 1 ? -3.18 : -2.21; r.wx = wx;
    r.wt.add(new kit.Parts().box(w, 0.25, 0.2, '#4a5157', 0, 0.125, 0).box(w + 0.01, 0.03, 0.21, '#e0b21e', 0, 0.2, 0).mesh());
    r.wt.position.set(wx, 0.02, -0.1);
    r.top = []; r.bot = [];
    if (r.n === 1) {
      const s = sheave(0.08); s.position.set(-3.1, 2.30, -0.1); scope.add(s); r.top.push(s); r.rTop = 0.08;
      SP.box(0.02, 0.15, 0.06, DARK, -3.1, 2.40, -0.1);
    } else {
      for (const x of [-2.21, -2.05]) { const s = sheave(0.04); s.position.set(x, 2.30, -0.1); scope.add(s); r.top.push(s); }
      for (const x of [-2.29, -2.13]) { const s = sheave(0.04); s.position.set(x, 0, 0); r.wt.add(s); s.position.x = x - wx; s.position.y = 0.33; r.bot.push(s); }
      r.wt.add(new kit.Parts().box(0.24, 0.02, 0.04, DARK, -0.0, 0.27, 0).box(0.02, 0.08, 0.04, DARK, 0, 0.31, 0).mesh());
      SP.box(0.24, 0.02, 0.04, DARK, -2.13, 2.36, -0.1).box(0.02, 0.12, 0.04, DARK, -2.13, 2.42, -0.1);
      r.rTop = 0.04;
    }
    p = part(Pp => Pp.box(0.18, 0.035, 0.035, BLK, 0, 0, 0).cyl(0.006, 0.006, 0.06, '#d8c39a', 0, 0.03, 0));
    r.h = scope.control(new Rail(ix, {
      scope, name: `E1.2 ${r.name}`, obj: p.obj, hitObj: p.obj, mats: [p.mat], shape: { type: 'box', half: V(0.1, 0.035, 0.035) },
      anchor: V(r.hx, 1.45, -0.1), axis: V(0, -1, 0), min: 0, max: r.max, mass: 0.5, rest: 'brake',
      colliders: [{ shape: { type: 'box', hx: 0.09, hy: 0.0175, hz: 0.0175 } }], drive: { maxForce: 400, maxVel: r.vHeld },
    }));
    r.relT = 9; r.pulseT = 0; r.prev = 0;
    const lx = -4.055 + i * 0.31, lz = 0.112;
    lab(r.name, lx, 1.27, lz, 0.28, { bg: '#30363b' });
    r.vF = val(lx, 1.19, lz, 0.28); r.vH = val(lx, 1.11, lz, 0.28); r.vP = val(lx, 1.03, lz, 0.28);
    lab(`Peso ${W} kg`, lx, 0.95, lz, 0.28, { size: 30 });
  });
  scope.add(SP.mesh());
  lab('E1.2 POLIAS (ideal)', -3.9, 1.40, 0.112, 0.5, { size: 30 });

  // ================= E1.4 mola com massa =================
  const K = 40, L0 = 0.30, masses = [0.5, 1, 2]; let mi = 1;
  const helixCurve = new (class extends THREE.Curve { getPoint(t, o = new THREE.Vector3()) { const a = t * TAU * 14; return o.set(Math.cos(a) * 0.025, -t, Math.sin(a) * 0.025); } })();
  const spring = new THREE.Mesh(new THREE.TubeGeometry(helixCurve, 280, 0.0035, 5, false), new THREE.MeshLambertMaterial({ color: 0xb0b6ba }));
  spring.position.set(2.05, 2.075, 0.2); scope.add(spring);
  const massMesh = new THREE.Mesh(new kit.Parts().cyl(0.045, 0.045, 0.1, '#3a3f44', 0, 0, 0, 0, 0, 0, 20).torus(0.012, 0.003, STEEL, 0, 0.06, 0, 0, HP, 0, 6, 12).build(), kit.vcMaterial());
  const massObj = new THREE.Group(); massObj.add(massMesh);
  const spr = scope.control(new SpringRail(ix, {
    scope, name: 'E1.4 massa', obj: massObj, hitObj: massObj, mats: [massMesh.material], shape: { type: 'sphere', r: 0.07 },
    anchor: V(2.05, 2.075 - L0 - 0.05, 0.2), axis: V(0, -1, 0), min: -0.25, max: 0.8, mass: 1, k: K, c: 0.25,
    colliders: [{ shape: { type: 'cyl', hh: 0.05, r: 0.045 } }],
  }));
  const mRoot = new THREE.Group(); mRoot.position.set(2.05, 1.12, -0.22); mRoot.rotation.x = HP; scope.add(mRoot);
  mRoot.add(new kit.Parts().cyl(0.04, 0.04, 0.012, DARK, 0, 0.006, 0, 0, 0, 0, 18).mesh());
  const mCap = new THREE.Group(); mRoot.add(mCap); const mMat = kit.vcMaterial();
  mCap.add(new THREE.Mesh(new kit.Parts().cyl(0.028, 0.028, 0.02, '#2e6fb5', 0, 0.022, 0, 0, 0, 0, 18).build(), mMat));
  const setMass = (i) => { mi = i; const mm = masses[mi]; spr.setMass(mm); massMesh.scale.setScalar(Math.cbrt(mm)); per.reset(); };
  scope.control(new PokeButton(ix, { name: 'E1.4 massa', root: mRoot, cap: mCap, radius: 0.028, top: 0.032, travel: 0.01, mats: [mMat], onPress: () => setMass((mi + 1) % masses.length) }));
  lab('MASSA ▸ troca', 2.05, 1.21, -0.198, 0.2, { size: 30 });
  lab(`E1.4 MOLA k = ${K} N/m`, 2.05, 1.98, -0.198, 0.32, { bg: '#30363b' });
  const vM = val(2.05, 1.90, -0.198), vX = val(2.05, 1.82, -0.198), vT1 = val(2.05, 1.74, -0.198), vT2 = val(2.05, 1.66, -0.198);
  // período medido: tempo entre dois máximos (velocidade passa de + para −)
  const per = { t: 0, last: -1, T: 0, pv: 0, reset() { this.last = -1; this.T = 0; } };
  scope.onReset(() => { setMass(1); spr.drive.mode = 'spring'; });

  scope.resetButton(1.3, T, 0.3, board);
  scope.add(board.build());

  // ================= atualização =================
  let acc = 1; const TX = [-2.33, -2.25, -2.17, -2.09];
  function update(dt) {
    // engrenagens
    const th = crank.value, thB = thB0 - th * zA / zB, thD = thD0 - (thB - thB0) * zC / zD;
    gB.obj.rotation.z = thB; gC.obj.rotation.z = thB; gD.obj.rotation.z = thD;
    // plano: ângulo pelo slider
    ramp.drive.target = angSl.value / 0.40 * 0.70;
    // polias
    let k = 0;
    const seg = (x0, y0, x1, y1) => { const R = ropePos; R[k] = x0; R[k + 1] = y0; R[k + 2] = -0.1; R[k + 3] = x1; R[k + 4] = y1; R[k + 5] = -0.1; k += 6; };
    for (const r of rigs) {
      const v = Math.max(0, r.h.value), lift = v / r.n, d = r.h.drive;
      r.wt.position.y = 0.02 + lift;
      for (const s of r.top) s.rotation.z = -v / r.rTop;
      for (const s of r.bot) s.rotation.z = v / r.rTop / 2;
      const hy = 1.45 - v + 0.035;                       // topo do puxador
      if (r.n === 1) { seg(-3.18, 0.29 + lift, -3.18, 2.30); seg(-3.02, 2.30, -3.02, hy); }
      else { const by = 0.02 + lift + 0.33; for (const x of TX) seg(x, by, x, 2.30); seg(-2.01, 2.30, -2.01, hy); }
      // segurando: velocidade limitada pelo peso (n=1 pesado, n=4 leve) e vibração proporcional à força
      if (r.h.held) {
        r.relT = 0; d.maxVel = r.vHeld; r.pulseT -= dt;
        if (v > r.prev + 0.002 && r.pulseT <= 0) { r.h.held.pulse(Math.min(1, W * G / r.n / 200), 30); r.pulseT = 0.12; }
      } else {
        r.relT += dt;
        if (r.relT > 0.7 && v > 0.001) { d.mode = 'drive'; d.target = 0; d.maxVel = r.vDrop; } // sem trava: o peso desce devagar
      }
      r.prev = v;
    }
    ropeGeo.attributes.position.needsUpdate = true;
    // mola
    spring.scale.y = L0 + spr.value;
    per.t = ctx.physics.stepCount * ctx.physics.dt; const pv = spr.drive.vel;   // tempo da física (não do quadro)
    if (per.pv > 0.02 && pv <= 0 && !spr.held) { if (per.last >= 0) per.T = per.t - per.last; per.last = per.t; }
    if (spr.held) per.reset();
    per.pv = pv;
    acc += dt; if (acc < 0.1) return; acc = 0;
    const rpm = crank.rpm;
    board.set(vIn, `entrada ${rpm.toFixed(0)} rpm`); board.set(vOut, `saída ${(rpm / ratio).toFixed(1)} rpm`);
    board.set(vRat, `i=${fmt(ratio, 2)} · mesmo sentido`);
    const a = ramp.drive.value, deg = a * 180 / Math.PI, sl = block.body.linvel();
    const slide = Math.hypot(sl.x, sl.y, sl.z) > 0.05 && !block.holders.length;
    board.set(vTh, `θ = ${fmt(deg)}°`); board.set(vSt, slide ? 'DESLIZANDO' : 'PARADO', { color: slide ? '#e39b2d' : '#3da56a' });
    board.set(vPp, `P∥ ${fmt(MB * G * Math.sin(a))} N`); board.set(vFa, `Fat máx ${fmt(MU * MB * G * Math.cos(a))} N`);
    for (const r of rigs) {
      const v = Math.max(0, r.h.value);
      board.set(r.vF, `F = ${fmt(W * G / r.n, 0)} N`); board.set(r.vH, `puxou ${fmt(v, 2)} m`); board.set(r.vP, `subiu ${fmt(v / r.n, 2)} m`);
    }
    const mm = masses[mi];
    board.set(vM, `m = ${fmt(mm)} kg · eq. ${fmt(mm * G / K, 3)} m`); board.set(vX, `x ${fmt(spr.value, 3)} m · F ${fmt(K * spr.value)} N`);
    board.set(vT1, `T teórico ${fmt(TAU * Math.sqrt(mm / K), 2)} s`); board.set(vT2, per.T > 0 ? `T medido ${fmt(per.T, 2)} s` : 'T medido — puxe e solte');
    board.flush();
  }
  return { update, state: () => ({ period: per.T, mass: masses[mi], ratio }) };   // state: diagnóstico pelo console
}

export function dispose() { S?.dispose(); S = null; }
