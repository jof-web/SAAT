// Biblioteca única de materiais PBR (docs/ESTILO.md §3). Texturas procedurais geradas em canvas (sem arquivos).
// Regra: nenhum modelo cria material próprio para superfícies estáticas; usa M.*.
import {
  MeshStandardMaterial, MeshPhysicalMaterial, MeshBasicMaterial, CanvasTexture, RepeatWrapping, SRGBColorSpace, NoColorSpace,
  Color, Vector2, DoubleSide, type Texture, type Material,
} from 'three';

// ---------- ruído determinístico ----------
let S = 1337;
const rnd = () => ((S = (S * 16807) % 2147483647) / 2147483647);
export const seedTx = (s: number) => { S = s; };
function grid(n: number) { const g = new Float32Array(n * n); for (let i = 0; i < g.length; i++) g[i] = rnd(); return g; }
/** Ruído de valor periódico (tileable) em [0,1]. */
function vnoise(size: number, cells: number, oct = 4, gain = 0.5) {
  const out = new Float32Array(size * size); let amp = 1, tot = 0;
  for (let o = 0; o < oct; o++) {
    const c = cells << o, g = grid(c);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const fx = (x / size) * c, fy = (y / size) * c, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = g[(y0 % c) * c + (x0 % c)], b = g[(y0 % c) * c + ((x0 + 1) % c)], cc = g[((y0 + 1) % c) * c + (x0 % c)], d = g[((y0 + 1) % c) * c + ((x0 + 1) % c)];
      out[y * size + x] += amp * (a + (b - a) * sx + (cc - a) * sy + (a - b - cc + d) * sx * sy);
    }
    tot += amp; amp *= gain;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot; return out;
}
function canvas(size: number) { const c = document.createElement('canvas'); c.width = c.height = size; return c; }
function fromField(size: number, f: (i: number, x: number, y: number) => [number, number, number]) {
  const c = canvas(size), g = c.getContext('2d')!, im = g.createImageData(size, size), d = im.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const i = y * size + x, [r, gg, b] = f(i, x, y); d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0); return c;
}
/** Mapa de normais (tileable) a partir de um campo de altura. */
function normalFrom(size: number, hgt: Float32Array, strength: number) {
  return fromField(size, (i, x, y) => {
    const xl = (x - 1 + size) % size, xr = (x + 1) % size, yu = (y - 1 + size) % size, yd = (y + 1) % size;
    const dx = (hgt[y * size + xr] - hgt[y * size + xl]) * strength, dy = (hgt[yd * size + x] - hgt[yu * size + x]) * strength;
    const l = Math.hypot(dx, dy, 1); return [(-dx / l * 0.5 + 0.5) * 255, (dy / l * 0.5 + 0.5) * 255, (1 / l * 0.5 + 0.5) * 255];
  });
}
function tex(c: HTMLCanvasElement, srgb = true): CanvasTexture {
  const t = new CanvasTexture(c); t.wrapS = t.wrapT = RepeatWrapping; t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace; t.anisotropy = 8; return t;
}
const hex = (h: string): [number, number, number] => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t) as [number, number, number];
const cl = (v: number) => Math.max(0, Math.min(255, v));

// ---------- geradores ----------
function gravel(size = 512) {
  // pedras de brita (Voronoi aproximado por discos sobrepostos) + variação de tom
  const H = new Float32Array(size * size), A = new Float32Array(size * size * 3), N = 1900;
  const tones = ['#7f7c76', '#73716c', '#86837d', '#6a6864', '#8c8882', '#77736d', '#62605c'].map(hex);
  for (let i = 0; i < A.length; i += 3) { A[i] = 62; A[i + 1] = 60; A[i + 2] = 57; }
  for (let k = 0; k < N; k++) {
    const cx = rnd() * size, cy = rnd() * size, r = 4 + rnd() * 8.5, el = 0.6 + rnd() * 0.5, rot = rnd() * Math.PI, t = tones[Math.floor(rnd() * tones.length)], sh = 0.85 + rnd() * 0.3;
    const cs = Math.cos(rot), sn = Math.sin(rot);
    for (let dy = -r - 1; dy <= r + 1; dy++) for (let dx = -r - 1; dx <= r + 1; dx++) {
      const ux = (dx * cs + dy * sn) / r, uy = (-dx * sn + dy * cs) / (r * el), q = ux * ux + uy * uy; if (q > 1) continue;
      const x = ((Math.floor(cx + dx) % size) + size) % size, y = ((Math.floor(cy + dy) % size) + size) % size, i = y * size + x;
      const hh = Math.sqrt(1 - q) * (0.7 + 0.3 * sh); if (hh < H[i]) continue; H[i] = hh;
      const lit = 0.86 + 0.18 * hh; A[i * 3] = t[0] * lit * sh; A[i * 3 + 1] = t[1] * lit * sh; A[i * 3 + 2] = t[2] * lit * sh;
    }
  }
  const big = vnoise(size, 3, 3);
  const alb = fromField(size, (i) => { const v = 0.9 + big[i] * 0.16; return [cl(A[i * 3] * v), cl(A[i * 3 + 1] * v), cl(A[i * 3 + 2] * v)]; });
  return { map: tex(alb), normal: tex(normalFrom(size, H, 2.0), false) };
}
function concrete(size = 512, base = '#9c988e') {
  const n1 = vnoise(size, 6, 5), n2 = vnoise(size, 48, 2), b = hex(base), H = new Float32Array(size * size);
  const pores: number[] = []; for (let k = 0; k < 2600; k++) pores.push(Math.floor(rnd() * size * size));
  for (const p of pores) H[p] = -1;
  const alb = fromField(size, (i) => { const st = (n1[i] - 0.5) * 34 + (n2[i] - 0.5) * 14 + (H[i] < 0 ? -40 : 0); return [cl(b[0] + st), cl(b[1] + st), cl(b[2] + st * 0.95)]; });
  for (let i = 0; i < H.length; i++) H[i] = H[i] < 0 ? -0.6 : n2[i] * 0.25;
  return { map: tex(alb), normal: tex(normalFrom(size, H, 2.2), false) };
}
function grass(size = 512) {
  const n1 = vnoise(size, 3, 5), n2 = vnoise(size, 96, 1), n3 = vnoise(size, 24, 2), dry = hex('#8a8659'), green = hex('#5a6e3c'), dark = hex('#3f5230');
  return { map: tex(fromField(size, (i) => { const a = mix(green, dry, Math.max(0, n1[i] - 0.42) * 1.6), b = mix(a, dark, n3[i] * 0.35), c = mix(b, dark, n2[i] * 0.4); return c; })) };
}
function asphalt(size = 256) {
  const n1 = vnoise(size, 8, 3), n2 = vnoise(size, 96, 1);
  return { map: tex(fromField(size, (i) => { const v = 62 + (n1[i] - 0.5) * 16 + (n2[i] - 0.5) * 30; return [v, v, v + 2]; })) };
}
function epoxy(size = 512) {
  const n1 = vnoise(size, 5, 4), n2 = vnoise(size, 80, 1), b = hex('#737a7e');
  const alb = fromField(size, (i) => { const v = (n1[i] - 0.5) * 12 + (n2[i] - 0.5) * 6; return [cl(b[0] + v), cl(b[1] + v), cl(b[2] + v)]; });
  const rough = fromField(size, (i) => { const r = 90 + n1[i] * 70; return [r, r, r]; });
  return { map: tex(alb), roughnessMap: tex(rough, false) };
}
function blocks(size = 512, base = '#e3e0d8') {
  // bloco 39×19 cm com junta de 1 cm; textura cobre 0,8 × 0,8 m (2 × 4 fiadas)
  const b = hex(base), n = vnoise(size, 16, 3), H = new Float32Array(size * size), rowH = size / 4, colW = size / 2;
  const alb = fromField(size, (i, x, y) => {
    const row = Math.floor(y / rowH), off = row % 2 ? colW / 2 : 0, xx = (x + off) % colW, yy = y % rowH;
    const j = xx < 6 || yy < 6; H[i] = j ? -0.5 : n[i] * 0.2; const v = (n[i] - 0.5) * 10 - (j ? 14 : 0); return [cl(b[0] + v), cl(b[1] + v), cl(b[2] + v)];
  });
  return { map: tex(alb), normal: tex(normalFrom(size, H, 2.5), false) };
}
function galv(size = 256) {
  // "spangle" do zinco: placas cristalinas de tons ligeiramente diferentes
  const pts: [number, number, number][] = []; for (let k = 0; k < 90; k++) pts.push([rnd() * size, rnd() * size, rnd()]);
  const n = vnoise(size, 24, 2), b = hex('#9fa6a9');
  const alb = fromField(size, (i, x, y) => { let best = 1e9, v = 0; for (const [px, py, pv] of pts) { let dx = Math.abs(px - x), dy = Math.abs(py - y); dx = Math.min(dx, size - dx); dy = Math.min(dy, size - dy); const d = dx * dx + dy * dy; if (d < best) { best = d; v = pv; } }
    const s = (v - 0.5) * 8 + (n[i] - 0.5) * 5; return [cl(b[0] + s), cl(b[1] + s), cl(b[2] + s)]; });
  return { map: tex(alb) };
}
function paint(size = 256) { const n = vnoise(size, 32, 3); return { normal: tex(normalFrom(size, n, 0.9), false) }; }
function checker(size = 256) {
  const H = new Float32Array(size * size), cell = size / 8;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const cx = Math.floor(x / cell), cy = Math.floor(y / cell), ux = (x % cell) / cell - 0.5, uy = (y % cell) / cell - 0.5;
    const a = (cx + cy) % 2 ? Math.PI / 4 : -Math.PI / 4, u = ux * Math.cos(a) + uy * Math.sin(a), v = -ux * Math.sin(a) + uy * Math.cos(a);
    H[y * size + x] = Math.abs(v) < 0.08 && Math.abs(u) < 0.32 ? 1 : 0; }
  return { normal: tex(normalFrom(size, H, 2), false) };
}
function ribbed(size = 128) { const H = new Float32Array(size * size); for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) H[y * size + x] = Math.sin((y / size) * Math.PI * 2 * 8) * 0.5; return { normal: tex(normalFrom(size, H, 1.6), false) }; }
function chainlink(size = 128) {
  const c = canvas(size), g = c.getContext('2d')!; g.clearRect(0, 0, size, size); g.strokeStyle = '#b8bec1'; g.lineWidth = size * 0.035; g.lineCap = 'round';
  const s = size / 2; for (let i = -2; i <= 4; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s + s, s); g.lineTo(i * s, size); g.stroke(); }
  const t = new CanvasTexture(c); t.wrapS = t.wrapT = RepeatWrapping; t.colorSpace = SRGBColorSpace; t.anisotropy = 8; return t;
}


// --- casa de comando (fotos 31/10/2026) ---
function formwork(size = 512) {
  // laje de concreto aparente com marca de forma de tábua (tábuas ao longo de X), manchas de umidade
  const big = vnoise(size, 4, 4), fine = vnoise(size, 64, 2), H = new Float32Array(size * size), b = hex('#aaa59c');
  const rows: [number, number, number][] = []; let y = 0; while (y < size) { const h = 44 + Math.floor(rnd() * 34); rows.push([y, Math.min(size, y + h), (rnd() - 0.5) * 16]); y += h; }
  const rowOf = new Int16Array(size); rows.forEach(([a, z2], i) => { for (let k = a; k < z2; k++) rowOf[k] = i; });
  const alb = fromField(size, (i, x, yy) => { const r = rows[rowOf[yy]], seam = yy - r[0] < 2 || r[1] - yy < 2, st = fine[yy * size + ((Math.floor(x / 9) + r[0]) % size)];
    H[i] = seam ? -0.6 : st * 0.25; const v = r[2] * 0.7 + (st - 0.5) * 12 + (big[i] - 0.5) * 20 - (seam ? 12 : 0); return [cl(b[0] + v), cl(b[1] + v), cl(b[2] + v * 0.95)]; });
  return { map: tex(alb), normal: tex(normalFrom(size, H, 2.2), false) };
}
function floorPaint(size = 512) {
  // piso de concreto pintado de cinza, gasto: manchas, áreas sem tinta, riscos e marcas de pneu
  const n1 = vnoise(size, 5, 4), n2 = vnoise(size, 9, 3), n3 = vnoise(size, 96, 1), b = hex('#8b8e90'), worn = hex('#a9a7a0');
  const c = canvas(size), g = c.getContext('2d')!, im = g.createImageData(size, size), d = im.data;
  for (let i = 0; i < size * size; i++) { const w = Math.max(0, Math.min(1, (n2[i] - 0.6) * 3.2)), v = (n1[i] - 0.5) * 22 + (n3[i] - 0.5) * 8; const col = mix(b, worn, w);
    d[i * 4] = cl(col[0] + v); d[i * 4 + 1] = cl(col[1] + v); d[i * 4 + 2] = cl(col[2] + v); d[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0);
  for (let k = 0; k < 160; k++) { const x = rnd() * size, y = rnd() * size, a = rnd() * Math.PI, L = 8 + rnd() * 40; g.strokeStyle = k % 4 ? 'rgba(200,200,194,0.35)' : 'rgba(70,72,74,0.28)'; g.lineWidth = 0.7 + rnd() * 1.4; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * L * 0.5 + (rnd() - 0.5) * 6, y + Math.sin(a) * L * 0.5, x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
  const rough = fromField(size, (i) => { const r = 150 + n2[i] * 60; return [r, r, r]; });
  return { map: tex(c), roughnessMap: tex(rough, false) };
}
function weldMesh(size = 128) {
  const c = canvas(size), g = c.getContext('2d')!; g.clearRect(0, 0, size, size); g.strokeStyle = '#c3c8cb'; g.lineWidth = size * 0.016;
  for (let k = 0; k <= 8; k++) { const p = (k * size) / 8; g.beginPath(); g.moveTo(p, 0); g.lineTo(p, size); g.stroke(); g.beginPath(); g.moveTo(0, p); g.lineTo(size, p); g.stroke(); }
  const t = new CanvasTexture(c); t.wrapS = t.wrapT = RepeatWrapping; t.colorSpace = SRGBColorSpace; t.anisotropy = 8; return t;
}

// ---------- materiais ----------
const std = (o: any) => new MeshStandardMaterial(o);
export type Mats = ReturnType<typeof buildMaterials>;
/** Escala de UV em mundo (m por repetição) usada pelo Batch nas superfícies com textura repetida. */
export const UVSCALE = new WeakMap<Material, number>();
function w<T extends Material>(m: T, metersPerTile: number) { UVSCALE.set(m, metersPerTile); return m; }

export function buildMaterials() {
  seedTx(1337);
  const FW = formwork(), FP = floorPaint(), GR = gravel(), CO = concrete(), CO2 = concrete(256, '#aaa69c'), GS = grass(), AS = asphalt(), EP = epoxy(), BL = blocks(), GV = galv(), PT = paint(), CK = checker(), RB = ribbed();
  const nScale = new Vector2(1, 1);
  const M = {
    gravel: w(std({ map: GR.map, normalMap: GR.normal, normalScale: new Vector2(1.1, 1.1), roughness: 0.97, metalness: 0 }), 1.6),
    concrete: w(std({ map: CO.map, normalMap: CO.normal, normalScale: new Vector2(0.7, 0.7), roughness: 0.92, metalness: 0 }), 2.0),
    concreteLight: w(std({ map: CO2.map, normalMap: CO2.normal, normalScale: new Vector2(0.5, 0.5), roughness: 0.9, metalness: 0 }), 1.5),
    grass: w(std({ map: GS.map, roughness: 1, metalness: 0 }), 14),
    asphalt: w(std({ map: AS.map, roughness: 0.95, metalness: 0 }), 3),
    epoxy: w(std({ map: EP.map, roughnessMap: EP.roughnessMap, roughness: 1, metalness: 0 }), 3.2),
    wall: w(std({ map: BL.map, normalMap: BL.normal, normalScale: new Vector2(0.6, 0.6), roughness: 0.88, metalness: 0 }), 0.8),
    wallOut: w(std({ map: blocks(512, '#cfc6b4').map, roughness: 0.9, metalness: 0 }), 0.8),
    wallBase: std({ color: 0x6d7175, roughness: 0.85, metalness: 0 }),
    ceiling: std({ color: 0xe9e8e3, roughness: 0.95, metalness: 0 }),
    galv: w(std({ map: GV.map, roughness: 0.42, metalness: 0.6, envMapIntensity: 0.9 }), 0.6),
    steelDark: std({ color: 0x4a4f53, roughness: 0.55, metalness: 0.5 }),
    alu: std({ color: 0xc9ced1, roughness: 0.3, metalness: 0.88 }),
    aluDull: std({ color: 0xaeb3b5, roughness: 0.5, metalness: 0.7 }),
    copper: std({ color: 0xb06a3b, roughness: 0.42, metalness: 0.9 }),
    copperOld: std({ color: 0x7e5a3a, roughness: 0.6, metalness: 0.6 }),
    porcelain: new MeshPhysicalMaterial({ color: 0x5b3022, roughness: 0.24, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.18 }),
    polymer: std({ color: 0x7f878b, roughness: 0.62, metalness: 0 }),
    trafo: w(std({ color: 0x9ea3a1, roughness: 0.55, metalness: 0.15, normalMap: PT.normal, normalScale: new Vector2(0.25, 0.25) }), 0.5),
    trafoDark: std({ color: 0x80868a, roughness: 0.55, metalness: 0.15 }),
    ral7035: w(std({ color: 0xc9cdc8, roughness: 0.5, metalness: 0.05, normalMap: PT.normal, normalScale: new Vector2(0.2, 0.2) }), 0.4),
    ral7032: std({ color: 0xb5b3a4, roughness: 0.55, metalness: 0.05 }),
    ral7016: std({ color: 0x3b4146, roughness: 0.5, metalness: 0.1 }),
    ral5010: std({ color: 0x1f4f8a, roughness: 0.45, metalness: 0.05 }),
    black: std({ color: 0x18191b, roughness: 0.6, metalness: 0.0 }),
    plastic: std({ color: 0x2a2d30, roughness: 0.45, metalness: 0 }),
    rubber: w(std({ color: 0x1e1f21, roughness: 0.82, metalness: 0, normalMap: RB.normal }), 0.25),
    checker: w(std({ color: 0x8f9396, roughness: 0.4, metalness: 0.8, normalMap: CK.normal }), 0.5),
    glass: new MeshPhysicalMaterial({ color: 0x9fb4c0, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.25, depthWrite: false }),
    glassDark: new MeshPhysicalMaterial({ color: 0x24323c, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.55, depthWrite: false }),
    glassGreen: new MeshPhysicalMaterial({ color: 0x3f6b5a, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.85, clearcoat: 1 }),
    yellow: std({ color: 0xe0b21e, roughness: 0.5, metalness: 0.05 }),
    red: std({ color: 0xb3262b, roughness: 0.45, metalness: 0.05 }),
    green: std({ color: 0x1f7a45, roughness: 0.45, metalness: 0.05 }),
    blue: std({ color: 0x1f5aa6, roughness: 0.45, metalness: 0.05 }),
    white: std({ color: 0xeceae4, roughness: 0.5, metalness: 0 }),
    cream: std({ color: 0xdcd6c4, roughness: 0.6, metalness: 0 }),
    cable: std({ color: 0x1c1d1f, roughness: 0.55, metalness: 0 }),
    conductor: std({ color: 0xb9bec0, roughness: 0.42, metalness: 0.85 }),
    wood: std({ color: 0x8a6a48, roughness: 0.75, metalness: 0 }),
    chair: std({ color: 0x24282c, roughness: 0.7, metalness: 0 }),
    desk: std({ color: 0x6f6a62, roughness: 0.55, metalness: 0 }),
    battCase: new MeshPhysicalMaterial({ color: 0xd9e2e4, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.55, depthWrite: false }),
    battPlate: std({ color: 0x4a4440, roughness: 0.7, metalness: 0.2 }),
    electrolyte: new MeshPhysicalMaterial({ color: 0xbfd2d6, roughness: 0.1, transparent: true, opacity: 0.35, depthWrite: false }),
    silica: std({ color: 0xd8862e, roughness: 0.8 }),
    fence: new MeshStandardMaterial({ map: chainlink(), transparent: true, alphaTest: 0.35, side: DoubleSide, roughness: 0.45, metalness: 0.6 }),
    lampOff: std({ color: 0x3a3d40, roughness: 0.3, metalness: 0 }),
    emissiveWhite: new MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e6, emissiveIntensity: 2.2, roughness: 0.5 }),
    screenOff: std({ color: 0x0b0d0f, roughness: 0.15, metalness: 0.2 }),
    skin: std({ color: 0xb98466, roughness: 0.65, metalness: 0 }),
    fr: std({ color: 0x2a3a52, roughness: 0.85, metalness: 0 }),
    helmet: std({ color: 0xf2f2ee, roughness: 0.35, metalness: 0 }),
    // casa de comando (fotos)
    formwork: w(std({ map: FW.map, normalMap: FW.normal, normalScale: new Vector2(0.5, 0.5), roughness: 0.92, metalness: 0 }), 1.0),
    wallPaint: w(std({ color: 0xd6c7a6, roughness: 0.88, metalness: 0, normalMap: PT.normal, normalScale: new Vector2(0.15, 0.15) }), 0.6),
    floorPaint: w(std({ map: FP.map, roughnessMap: FP.roughnessMap, roughness: 1, metalness: 0 }), 4.0),
    baseboard: std({ color: 0x50555c, roughness: 0.6, metalness: 0.05 }),
    steelDoor: w(std({ color: 0x3d4044, roughness: 0.5, metalness: 0.35, normalMap: PT.normal, normalScale: new Vector2(0.3, 0.3) }), 0.5),
    doorGray: std({ color: 0x585d64, roughness: 0.5, metalness: 0.25 }),
    pdmtBand: std({ color: 0x8a929b, roughness: 0.5, metalness: 0.05 }),
    blueCab: std({ color: 0x3467a5, roughness: 0.45, metalness: 0.15 }),
    woodTop: std({ color: 0xc9a46b, roughness: 0.6, metalness: 0 }),
    creamPaint: std({ color: 0xd6bf8c, roughness: 0.85, metalness: 0 }),
    lineYellow: std({ color: 0xe2b72a, roughness: 0.75, metalness: 0 }),
    lineRed: std({ color: 0xb8282c, roughness: 0.75, metalness: 0 }),
    resin: std({ color: 0xe3b21c, roughness: 0.3, metalness: 0 }),
    weldMesh: new MeshStandardMaterial({ map: weldMesh(), transparent: true, alphaTest: 0.4, side: DoubleSide, roughness: 0.5, metalness: 0.3 }),
  };
  void nScale; void Color; void ({} as Texture);
  for (const k of ['gravel', 'grass', 'asphalt', 'epoxy', 'wall', 'wallOut', 'floorPaint', 'formwork'] as const) (M as any)[k].userData.keepTex = true; // perfil leve: só pisos e paredes mantêm textura
  return M;
}
/** Material com cor própria (luzes, LEDs) — não entra no batch. */
export const glow = (c: number, on = true) => { const m = new MeshStandardMaterial({ color: on ? c : 0x2f3236, emissive: on ? c : 0x000000, emissiveIntensity: on ? 2.2 : 0, roughness: 0.3 }); m.userData.glow = true; return m; };
