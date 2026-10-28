// E0 — Pegada e arremesso (bancada de apoio da Fase 1 para testar I1–I6).
// Não está na lista original de estações: foi criada porque I1–I6 precisam de objetos soltos já na Fase 1.
let S = null;

export function create(ctx) {
  const { THREE, kit, ix, scope, board } = ctx; S = scope;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const T = 0.9; // altura do tampo

  // ---- estáticos: parede de teste (I5), prateleira alta (I2), alvo (I3) ----
  const P = new kit.Parts();
  P.box(0.5, 0.35, 0.03, '#7d868c', -0.75, T + 0.175, -0.2);                       // parede baixa sobre a bancada
  P.box(1.6, 0.04, 0.3, '#8a6a45', 0.3, 1.58, -1.05);                               // prateleira
  P.box(0.05, 1.6, 0.05, '#4a5157', -0.45, 0.8, -1.05).box(0.05, 1.6, 0.05, '#4a5157', 1.05, 0.8, -1.05);
  P.box(0.08, 1.4, 0.08, '#4a5157', 0, 0.7, -3.3);                                   // poste do alvo
  P.cyl(0.6, 0.6, 0.04, '#e8e8e8', 0, 1.4, -3.25, Math.PI / 2, 0, 0, 32)
    .cyl(0.45, 0.45, 0.042, '#c8202e', 0, 1.4, -3.25, Math.PI / 2, 0, 0, 32)
    .cyl(0.3, 0.3, 0.044, '#e8e8e8', 0, 1.4, -3.25, Math.PI / 2, 0, 0, 32)
    .cyl(0.14, 0.14, 0.046, '#c8202e', 0, 1.4, -3.25, Math.PI / 2, 0, 0, 24);
  scope.add(P.mesh());
  scope.collider({ type: 'box', hx: 0.25, hy: 0.175, hz: 0.015 }, { pos: V(-0.75, T + 0.175, -0.2) });
  scope.collider({ type: 'box', hx: 0.8, hy: 0.02, hz: 0.15 }, { pos: V(0.3, 1.58, -1.05) });
  scope.collider({ type: 'box', hx: 0.6, hy: 0.6, hz: 0.03 }, { pos: V(0, 1.4, -3.25) });
  scope.collider({ type: 'box', hx: 0.04, hy: 0.7, hz: 0.04 }, { pos: V(0, 0.7, -3.3) });
  scope.block(-0.6, 1.2, -1.25, -0.85); scope.block(-0.7, 0.7, -3.45, -3.05);

  // ---- objetos pegáveis ----
  // shape: forma de colisão; hit: forma usada pelo raio/pegada (um pouco maior)
  const make = (name, build, shapes, mass, hit, x, y, z, o = {}) => {
    const mat = kit.vcMaterial(), obj = new THREE.Group(), Pp = new kit.Parts(); build(Pp);
    obj.add(new THREE.Mesh(Pp.build(), mat));
    const { pos, quat } = scope.pose(x, y, z, o.ry || 0);
    return ix.grabbable(scope, { name, obj, shapes, mass, hit, mats: [mat], pos, quat, ...o });
  };
  const box = (w, h, d) => ({ type: 'box', hx: w / 2, hy: h / 2, hz: d / 2 });
  const hb = (w, h, d, m = 0.01) => ({ type: 'box', half: V(w / 2 + m, h / 2 + m, d / 2 + m) });

  make('Cubo 8 cm', p => p.box(0.08, 0.08, 0.08, '#d0392b'), [{ shape: box(0.08, 0.08, 0.08) }], 0.3, hb(0.08, 0.08, 0.08), -1.0, T + 0.041, 0.15);
  make('Bola', p => p.sphere(0.045, '#f2c230', 0, 0, 0, 16), [{ shape: { type: 'ball', r: 0.045 } }], 0.15, { type: 'sphere', r: 0.055 }, -0.72, T + 0.046, 0.2, { restitution: 0.5 });
  make('Lata', p => p.cyl(0.035, 0.035, 0.12, '#2e6fb5', 0, 0, 0, 0, 0, 0, 18), [{ shape: { type: 'cyl', hh: 0.06, r: 0.035 } }], 0.35, hb(0.07, 0.12, 0.07), -0.45, T + 0.061, 0.15);
  make('Chave', p => p.box(0.22, 0.025, 0.03, '#59626a', 0, 0, 0).box(0.05, 0.03, 0.07, '#59626a', 0.12, 0, 0),
    [{ shape: box(0.22, 0.025, 0.03) }, { shape: box(0.05, 0.03, 0.07), pos: V(0.12, 0, 0) }], 0.4, { type: 'box', half: V(0.15, 0.025, 0.045), center: V(0.02, 0, 0) }, -0.12, T + 0.016, 0.3);
  // I4: prancha longa — com duas mãos gira pela linha entre as mãos
  make('Prancha (2 mãos)', p => p.box(1.2, 0.05, 0.16, '#a0784a'), [{ shape: box(1.2, 0.05, 0.16) }], 4, hb(1.2, 0.05, 0.16), 0.55, T + 0.026, 0.12, { twoHanded: true });
  // I6: caixa pesada no chão — atrasa e oscila; sem pegada à distância
  make('Caixa 15 kg', p => p.box(0.34, 0.34, 0.34, '#6b4f2a').box(0.36, 0.04, 0.36, '#4a3720', 0, 0.12, 0), [{ shape: box(0.34, 0.34, 0.34) }], 15, hb(0.34, 0.34, 0.34), 1.65, 0.171, 0.5, { distance: false });
  // I2: cubos na prateleira alta (fora do alcance a partir do ponto de pé)
  ['#3da56a', '#e39b2d', '#8e5cc4'].forEach((c, i) => make('Cubo prateleira', p => p.box(0.06, 0.06, 0.06, c), [{ shape: box(0.06, 0.06, 0.06) }], 0.2, hb(0.06, 0.06, 0.06, 0.02), -0.1 + i * 0.4, 1.631, -1.05));

  // ---- etiquetas (1 draw call) ----
  const lab = (text, x, y, z, w = 0.3, up = V(0, 1, 0), right = V(1, 0, 0)) => board.add({ pos: V(x, y, z), right, up, w, h: w / 4, text, style: { size: 34 } });
  lab('I5 · parede', -0.75, T + 0.39, -0.2, 0.26);
  lab('I2 · gatilho à distância', 0.3, 1.7, -0.9, 0.5);
  lab('I3 · alvo', 0, 2.1, -3.25, 0.4);
  lab('I4 · 2 mãos', 0.55, T + 0.002, 0.3, 0.22, V(0, 0, -1));
  lab('I6 · 15 kg', 1.65, 0.36, 0.69, 0.22);
  scope.resetButton(1.05, T, 0.26, board);
  scope.add(board.build());
  return {};
}

export function dispose() { S?.dispose(); S = null; }
