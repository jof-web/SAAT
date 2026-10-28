// main.js — cena, renderer, galpão, carregamento das estações (com isolamento de erro) e loop.
import * as THREE from 'three';
import { Physics, GROUPS } from './physics.js';
import { Interaction, PokeButton } from './xr/interaction.js';
import { Locomotion } from './xr/locomotion.js';
import { Debug } from './debug.js';
import { Checklist, Menu, buildReport, BUILD_PHASE } from './validation.js';
import * as kit from './kit.js';

const VERSION = window.APP_VERSION || '0.0.0';
const $ = (id) => document.getElementById(id);
const status = (t, bad = false) => { const e = $('status'); if (e) { e.textContent = t; e.className = bad ? 'bad' : ''; } };

// Estações: posição (x,z) do centro da bancada no chão, rotação (0 = usuário olha para −Z)
const STATIONS = [
  { id: 'E0', name: 'Pegada e arremesso', file: 'e0_pegada.js', phase: 1, pos: [-4, -6], rot: 0, bench: [2.4, 0.8], sub: 'I1–I6' },
  { id: 'E4', name: 'Controles', file: 'e4_controles.js', phase: 1, pos: [4, -6], rot: 0, bench: [3.0, 0.8], sub: 'I7–I13 · I17' },
  { id: 'E1', name: 'Mecânica', file: 'e1_mecanica.js', phase: 2, pos: [-12, -6], rot: 0, bench: [3.0, 0.8] },
  { id: 'E2', name: 'Elétrica', file: 'e2_eletrica.js', phase: 3, pos: [12, -6], rot: 0, bench: [3.0, 0.8] },
  { id: 'E5', name: 'Mecanismos 3D', file: 'e5_mecanismos.js', phase: 2, pos: [-12, 6], rot: Math.PI, bench: [3.0, 0.8] },
  { id: 'E3', name: 'Vidro', file: 'e3_vidro.js', phase: 5, pos: [-4, 6], rot: Math.PI, bench: [2.4, 0.8] },
  { id: 'E6', name: 'Movimentação de cargas', file: 'e6_cargas.js', phase: 4, pos: [5, 7], rot: Math.PI, bench: null },
  { id: 'E7', name: 'Logística', file: 'e7_logistica.js', phase: 4, pos: [14, 7], rot: Math.PI, bench: [3.0, 0.8] },
];
const BOUNDS = { minX: -18, maxX: 18, minZ: -13, maxZ: 13 };

// ---------------- Escopo de estação: rastreia tudo para reset/dispose/sono ----------------
class StationScope {
  constructor(app, def) {
    this.app = app; this.def = def; this.physics = app.physics; this.ix = app.ix;
    this.group = new THREE.Group(); this.group.position.set(def.pos[0], 0, def.pos[1]); this.group.rotation.y = def.rot;
    app.scene.add(this.group); this.group.updateMatrixWorld(true);
    this.quat = this.group.quaternion.clone(); this.pos = this.group.position.clone();
    this.base = this.physics.fixedBody(this.pos, this.quat);
    this.bodies = []; this.joints = []; this.drives = []; this.items = []; this.objs = []; this.resets = []; this.init = new Map();
    this.active = true;
  }
  toWorld(v) { return v.applyMatrix4(this.group.matrixWorld); }
  // pose no mundo a partir de coordenadas locais da estação
  pose(x, y, z, ry = 0, rx = 0, rz = 0) {
    const pos = this.toWorld(new THREE.Vector3(x, y, z));
    const quat = this.quat.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)));
    return { pos, quat };
  }
  add(obj) { this.group.add(obj); return obj; }
  collider(shape, o = {}) { return this.physics.collider(this.base, shape, { group: GROUPS.STATIC, ...o }); }
  dynamic(obj, opts) {
    this.app.scene.add(obj); this.objs.push(obj);
    const b = this.physics.dynamicBody(obj, opts); this.bodies.push(b);
    this.init.set(b, { p: obj.position.clone(), q: obj.quaternion.clone() }); return b;
  }
  joint(data, body) { const j = this.physics.world.createImpulseJoint(data, this.base, body, true); j.setContactsEnabled(false); this.joints.push(j); return j; }
  drive(d) { this.physics.drives.add(d); this.drives.push(d); return d; }
  track(it) { this.items.push(it); return it; }
  control(c) { this.ix.add(c); this.items.push(c); return c; }
  onReset(fn) { this.resets.push(fn); }
  // área bloqueada para o teleporte (retângulo local → AABB no mundo)
  block(x0, x1, z0, z1) {
    const xs = [], zs = [];
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) { const v = this.toWorld(new THREE.Vector3(x, 0, z)); xs.push(v.x); zs.push(v.z); }
    this.app.blocked.push({ minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) });
  }
  // bancada padrão (0,9 m)
  bench(w, d) {
    const P = new kit.Parts(), h = 0.9;
    P.box(w, 0.04, d, '#8f979e', 0, h - 0.02, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(0.05, h - 0.04, 0.05, '#4a5157', sx * (w / 2 - 0.06), (h - 0.04) / 2, sz * (d / 2 - 0.06));
    P.box(w - 0.12, 0.03, 0.03, '#4a5157', 0, 0.15, -(d / 2 - 0.06));
    this.add(P.mesh());
    this.collider({ type: 'box', hx: w / 2, hy: 0.02, hz: d / 2 }, { pos: new THREE.Vector3(0, h - 0.02, 0) });
    this.block(-w / 2, w / 2, -d / 2, d / 2);
  }
  // botão RESET padrão (poke ou raio/mouse)
  resetButton(x, y, z, board) {
    const root = new THREE.Group(); root.position.set(x, y, z); this.add(root);
    root.add(new kit.Parts().cyl(0.05, 0.05, 0.012, '#30363b', 0, 0.006, 0, 0, 0, 0, 20).cyl(0.02, 0.02, 0.012, '#30363b', 0, 0.016, 0).mesh());
    const cap = new THREE.Group(); root.add(cap);
    const mat = kit.vcMaterial(); cap.add(new THREE.Mesh(new kit.Parts().cyl(0.038, 0.038, 0.018, '#c8202e', 0, 0.031, 0, 0, 0, 0, 20).build(), mat));
    const b = this.control(new PokeButton(this.ix, { name: 'RESET', root, cap, radius: 0.038, top: 0.04, travel: 0.01, mats: [mat], onPress: () => this.reset() }));
    if (board) board.add({ pos: new THREE.Vector3(x, y + 0.002, z + 0.075), right: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 0, -1), w: 0.14, h: 0.035, text: 'RESET', style: { bg: '#2a1a1c', color: '#ff6b6b', size: 40 } });
    return b;
  }
  reset() {
    for (const b of this.bodies) { const i = this.init.get(b); this.physics.setPose(b, i.p, i.q); }
    for (const d of this.drives) d.reset();
    for (const it of this.items) it.reset?.();
    for (const fn of this.resets) fn();
  }
  setActive(on) {
    if (on === this.active) return; this.active = on;
    for (const d of this.drives) d.active = on;
    for (const b of this.bodies) on ? b.wakeUp() : b.sleep();
  }
  dispose() {
    for (const it of this.items) this.ix.remove(it);
    const w = this.physics.world;
    for (const j of this.joints) if (j.isValid?.() !== false) w.removeImpulseJoint(j, true);
    for (const d of this.drives) this.physics.drives.delete(d);
    for (const b of this.bodies) this.physics.removeBody(b);
    w.removeRigidBody(this.base);
    for (const o of [...this.objs, this.group]) { o.removeFromParent(); o.traverse(c => { c.geometry?.dispose(); }); }
  }
}

// ---------------- App ----------------
const app = { version: VERSION, xrActive: false, blocked: [], bounds: BOUNDS, stations: [] };
window.vrlab = app; // acesso pelo console do navegador (diagnóstico)

async function start() {
  status('Carregando…');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  renderer.xr.setFoveation(1);
  $('stage').appendChild(renderer.domElement);

  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xb4bec7);
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.03, 80);
  const rig = new THREE.Group(); rig.add(camera); scene.add(rig); camera.position.set(0, 1.65, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x4d5358, 1.7));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(6, 12, 8); scene.add(sun);
  Object.assign(app, { renderer, scene, camera, rig });

  const debug = new Debug(VERSION); app.debug = debug; debug.attach(camera);
  status('Carregando física (Rapier)…');
  const physics = await Physics.create(); app.physics = physics;
  app.ix = new Interaction(app);
  app.loco = new Locomotion(app); app.loco.onTeleport = (d) => app.ix.onTeleport(d);
  app.check = new Checklist(); app.menu = new Menu(app);
  buildHall(app);

  // estações: placas num único atlas (1 draw call)
  const plates = new kit.LabelBoard({ cols: 2, rows: 8, slotW: 512, slotH: 96 });
  for (const def of STATIONS) {
    const scope = new StationScope(app, def);
    const st = { ...def, scope, loaded: false, error: null, inst: null, mod: null };
    st.stand = scope.pose(0, 0, def.bench ? 1.3 : 4.5).pos; st.yaw = def.rot;
    if (def.bench) scope.bench(def.bench[0], def.bench[1]);
    const hy = def.bench ? 2.42 : 2.6, hz = def.bench ? -0.45 : 0;
    const pp = scope.toWorld(new THREE.Vector3(0, hy, hz)), right = new THREE.Vector3(1, 0, 0).applyQuaternion(scope.quat);
    st.plateT = plates.add({ pos: pp, right, w: 1.5, h: 0.28, text: `${def.id} · ${def.name}`, style: { size: 52, bg: '#1c2228' } });
    st.plateS = plates.add({ pos: scope.toWorld(new THREE.Vector3(0, hy - 0.2, hz)), right, w: 1.5, h: 0.12, text: def.phase <= BUILD_PHASE ? (def.sub || '') : `Fase ${def.phase} · em breve`, style: { size: 44, bg: '#14181c', color: '#98a2aa', weight: 600 } });
    if (!def.bench) { const P = new kit.Parts(); P.box(0.08, hy, 0.08, '#4a5157', 0, hy / 2 - 0.2, hz - 0.05); scope.add(P.mesh()); }
    app.stations.push(st);
  }
  scene.add(plates.build()); app.plates = plates;
  app.loco.setHome(0, 2, 0); app.loco.teleportTo(0, 2, 0); app.loco.fade = 0;

  // carrega cada estação isolada: erro numa não derruba as outras
  for (const st of app.stations) {
    if (st.phase > BUILD_PHASE) continue;
    try {
      status(`Carregando ${st.id}…`);
      st.mod = await import(`./stations/${st.file}`);
      const board = new kit.LabelBoard({ cols: 4, rows: 6, slotW: 256, slotH: 64 });
      st.inst = st.mod.create({ THREE, kit, app, ix: app.ix, physics, scope: st.scope, board }) || {};
      st.loaded = true;
    } catch (e) {
      st.error = e; debug.error(`${st.id} não carregou: ${e.message}`);
      plates.set(st.plateS, 'ERRO ao carregar · ver Debug', { color: '#e5484d' });
    }
  }
  plates.flush();

  app.goStation = (id) => { const s = app.stations.find(x => x.id === id); if (!s) return; app.loco.setHome(s.stand.x, s.stand.z, s.yaw); app.loco.goHome(); app.menu.mode === 'float' && app.menu.hide(); };
  app.goHome = () => { app.loco.setHome(0, 2, 0); app.loco.goHome(); };
  app.resetNearest = () => { const s = nearest(); if (s?.loaded) s.scope.reset(); };

  // VR
  renderer.xr.addEventListener('sessionstart', () => { app.xrActive = true; app.ix.setXR(true); app.menu.hide(); app.loco.applyHeight(); debug.layout(true); });
  renderer.xr.addEventListener('sessionend', () => { app.xrActive = false; app.ix.setXR(false); app.loco.resetDesktopCamera(); app.menu.hide(); debug.layout(false); refreshReport(); });
  setupOverlay();
  window.addEventListener('resize', () => { if (app.xrActive) return; camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); debug.layout(false); });

  // ---------- loop ----------
  let last = 0, checkT = 0, errT = 0; const _h = new THREE.Vector3();
  function nearest(maxD = 4.5) {
    app.loco.head(_h); let best = null, bd = maxD;
    for (const s of app.stations) { const d = Math.hypot(s.stand.x - _h.x, s.stand.z - _h.z); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  renderer.setAnimationLoop((t) => {
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 1 / 72; last = t;
    try {
      app.ix.readInputs();
      app.loco.update(dt, app.xrActive, app.ix.hands);
      rig.updateMatrixWorld(true);
      app.ix.readPoses(t / 1000);
      app.ix.update(dt);
      physics.step(dt);
      checkT += dt;
      if (checkT > 0.5) { // estações longe dormem (corpos parados, sem update)
        checkT = 0; app.loco.head(_h);
        for (const s of app.stations) if (s.loaded) s.scope.setActive(Math.hypot(s.pos[0] - _h.x, s.pos[1] - _h.z) < 9);
      }
      for (const s of app.stations) {
        if (!s.loaded || !s.scope.active || !s.inst.update) continue;
        try { s.inst.update(dt); } catch (e) { if (!s.updErr) { s.updErr = true; debug.error(`${s.id} update: ${e.message}`); } }
      }
      app.menu.update(dt);
      debug.frame(t, nearest()?.id || 'galpão', renderer.info);
    } catch (e) { errT -= dt; if (errT <= 0) { errT = 2; debug.error('loop: ' + e.message); } }
    renderer.render(scene, camera);
  });
  status('Pronto');
}

function buildHall(app) {
  const { scene, physics } = app, b = BOUNDS, W = b.maxX - b.minX, D = b.maxZ - b.minZ, H = 6;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x8b9195 }));
  scene.add(floor);
  // grid de 1 m (uma única LineSegments)
  const pts = [];
  for (let x = b.minX; x <= b.maxX; x++) pts.push(x, 0.002, b.minZ, x, 0.002, b.maxZ);
  for (let z = b.minZ; z <= b.maxZ; z++) pts.push(b.minX, 0.002, z, b.maxX, 0.002, z);
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0x6d7378 })));
  // paredes, pilares e teto numa única malha
  const P = new kit.Parts(), wc = '#c9cdc8', pc = '#5f676d';
  P.box(W, H, 0.2, wc, 0, H / 2, b.minZ - 0.1).box(W, H, 0.2, wc, 0, H / 2, b.maxZ + 0.1)
    .box(0.2, H, D, wc, b.minX - 0.1, H / 2, 0).box(0.2, H, D, wc, b.maxX + 0.1, H / 2, 0)
    .box(W, 0.1, D, '#f0f2f4', 0, H, 0).box(W, 0.4, 0.15, '#e0b21e', 0, 0.2, b.minZ + 0.02);
  for (let x = b.minX + 6; x < b.maxX; x += 6) { P.box(0.3, H, 0.3, pc, x, H / 2, b.minZ + 0.15); P.box(0.3, H, 0.3, pc, x, H / 2, b.maxZ - 0.15); }
  const walls = P.mesh(); walls.material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }); scene.add(walls);
  // colisores: piso e paredes
  const ground = physics.fixedBody(new THREE.Vector3(0, 0, 0));
  physics.collider(ground, { type: 'box', hx: W / 2 + 1, hy: 0.5, hz: D / 2 + 1 }, { pos: new THREE.Vector3(0, -0.5, 0) });
  physics.collider(ground, { type: 'box', hx: W / 2, hy: H / 2, hz: 0.1 }, { pos: new THREE.Vector3(0, H / 2, b.minZ - 0.1) });
  physics.collider(ground, { type: 'box', hx: W / 2, hy: H / 2, hz: 0.1 }, { pos: new THREE.Vector3(0, H / 2, b.maxZ + 0.1) });
  physics.collider(ground, { type: 'box', hx: 0.1, hy: H / 2, hz: D / 2 }, { pos: new THREE.Vector3(b.minX - 0.1, H / 2, 0) });
  physics.collider(ground, { type: 'box', hx: 0.1, hy: H / 2, hz: D / 2 }, { pos: new THREE.Vector3(b.maxX + 0.1, H / 2, 0) });
  physics.collider(ground, { type: 'box', hx: W / 2, hy: 0.05, hz: D / 2 }, { pos: new THREE.Vector3(0, H, 0) });
}

// ---------------- Tela 2D: botão VR e relatório ----------------
function refreshReport() { const ta = $('report'); if (ta && app.check) ta.value = buildReport(VERSION, app.check, app.debug); }
function setupOverlay() {
  const btn = $('btnVR');
  const enter = async () => {
    try {
      const s = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
      await app.renderer.xr.setSession(s);
    } catch (e) { app.debug.error('Entrar em VR: ' + e.message); }
  };
  if (navigator.xr?.isSessionSupported) {
    navigator.xr.isSessionSupported('immersive-vr').then(ok => {
      btn.disabled = !ok; btn.textContent = ok ? 'Entrar em VR' : 'VR indisponível (modo desktop)';
    }).catch(() => { btn.disabled = true; btn.textContent = 'VR indisponível (modo desktop)'; });
  } else { btn.disabled = true; btn.textContent = window.isSecureContext ? 'WebXR ausente (modo desktop)' : 'Precisa de HTTPS para VR'; }
  btn.addEventListener('click', enter);
  $('btnRefresh').addEventListener('click', refreshReport);
  $('btnCopy').addEventListener('click', async () => {
    refreshReport(); const ta = $('report');
    try { await navigator.clipboard.writeText(ta.value); flash('Copiado'); }
    catch (e) { ta.select(); document.execCommand('copy'); flash('Copiado (modo antigo)'); }
  });
  $('btnDownload').addEventListener('click', () => {
    refreshReport();
    const d = new Date(), pad = n => String(n).padStart(2, '0');
    const name = `relatorio-vr-v${VERSION}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.txt`;
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([$('report').value], { type: 'text/plain;charset=utf-8' }));
    a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  });
  $('btnClear').addEventListener('click', () => { if (confirm('Apagar todo o checklist salvo?')) { app.check.clear(); app.menu.panel.dirty = true; refreshReport(); } });
  app.debug.listeners.add((k) => { if (k !== 'fps') refreshReport(); });
  refreshReport();
}
function flash(t) { const e = $('flash'); if (!e) return; e.textContent = t; setTimeout(() => { e.textContent = ''; }, 1500); }

start().catch((e) => { status('Falhou: ' + e.message, true); app.debug?.error('início: ' + e.message); console.error(e); });
