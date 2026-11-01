// E2E do VR com o emulador IWER (Meta Quest 3): entrar em VR pela tela inicial, andar, colidir, correr (falta),
// girar, abrir o menu (Y), abrir uma porta pelo raio + gatilho, medir draw calls e sair. Capturas em .shots/xr-*.png
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const OUT = __dirname + '/../.shots/';
const IWER = fs.readFileSync(require.resolve('iwer/build/iwer.min.js'), 'utf8');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', (e) => errs.push('PE ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push('CE ' + m.text()); });
  await p.addInitScript(() => { try { localStorage.setItem('saat:logado', '"visitante"'); localStorage.setItem('saat:qualAuto', 'false'); localStorage.removeItem('saat:vrloco'); } catch {} });
  await p.addInitScript({ content: IWER });
  await p.addInitScript(() => { const dev = new IWER.XRDevice(IWER.metaQuest3); dev.installRuntime({ forceInstall: true }); dev.stereoEnabled = true; window.__dev = dev; });
  await p.goto('file://' + path.resolve(__dirname, '../jogar/index.html'));
  await p.waitForFunction(() => window.__saat && window.__saat.xr.supported, null, { timeout: 120000 }); await p.waitForTimeout(800);
  const ev = (f, a) => p.evaluate(f, a), wait = (ms) => p.waitForTimeout(ms), shot = async (n) => { await wait(400); await p.screenshot({ path: OUT + 'xr-' + n + '.png' }); console.log('shot', n); };
  const R = {}; R.lite = await ev(() => navigator.userAgent.includes('Quest'));
  await shot('01-home');
  await p.click('.hm-vr .hw.vr'); await p.waitForFunction(() => window.__saat.xr.active, null, { timeout: 60000 }); await wait(1500);
  const st = () => ev(() => { const S = window.__saat, X = S.xr, h = X.loco.head(new (S.P.pos.constructor)()); return { x: +h.x.toFixed(2), z: +h.z.toFixed(2), yaw: +X.loco.headYaw().toFixed(3), area: S.W.areaAt(h.x, h.z), faltas: S.faltas, menu: X.menu.mode, calls: S.E.renderer.info.render.calls, tris: S.E.renderer.info.render.triangles }; });
  await shot('02-vr-casa'); R.casa = await st();
  await ev(() => { const S = window.__saat, s = S.W.spawns.patio; S.xr.loco.placeHead(s.x, s.z, 0); }); await wait(800); R.inicio = await st();
  // L1 andar 1,5 s para frente (polegar esquerdo)
  await ev(() => window.__dev.controllers.left.updateAxes('thumbstick', 0, -1)); await wait(6000); await ev(() => window.__dev.controllers.left.updateAxes('thumbstick', 0, 0)); await wait(300);
  R.andou = await st(); R.distAndar = +Math.hypot(R.andou.x - R.inicio.x, R.andou.z - R.inicio.z).toFixed(2);
  // L2 correr: clique no polegar e anda (gera falta)
  await ev(() => { const c = window.__dev.controllers.left; c.updateAxes('thumbstick', 0, -1); }); await wait(1200); await ev(() => window.__dev.controllers.left.updateButtonValue('thumbstick', 1)); await wait(1200); await ev(() => window.__dev.controllers.left.updateButtonValue('thumbstick', 0)); await wait(6000); R.correndo = await ev(() => window.__saat.xr.loco.running);
  await ev(() => window.__dev.controllers.left.updateAxes('thumbstick', 0, 0)); await wait(300); R.correu = await st();
  // L5 colisão: perto da cerca oeste, olhando para ela, anda 8 s; a cabeça não pode atravessar
  await ev(() => { const S = window.__saat; S.xr.loco.placeHead(S.W.fenceRect[0] + 1.6, 40, Math.PI / 2); }); await wait(600);
  await ev(() => window.__dev.controllers.left.updateAxes('thumbstick', 0, -1)); await wait(8000); await ev(() => window.__dev.controllers.left.updateAxes('thumbstick', 0, 0)); await wait(300);
  R.parede = await st(); await shot('03-parede');
  // L3 giro snap (polegar direito)
  const y0 = (await st()).yaw; await ev(() => window.__dev.controllers.right.updateAxes('thumbstick', 1, 0)); await wait(300); await ev(() => window.__dev.controllers.right.updateAxes('thumbstick', 0, 0)); await wait(300);
  R.giroGraus = Math.round(((await st()).yaw - y0) * 180 / Math.PI);
  // S1 menu Y
  await ev(() => window.__dev.controllers.left.updateButtonValue('y-button', 1)); await wait(200); await ev(() => window.__dev.controllers.left.updateButtonValue('y-button', 0)); await wait(500);
  R.menu = (await st()).menu; await shot('04-menu');
  await ev(() => window.__dev.controllers.left.updateButtonValue('y-button', 1)); await wait(200); await ev(() => window.__dev.controllers.left.updateButtonValue('y-button', 0)); await wait(300);
  // X2 porta pelo raio: leva a cabeça até perto da porta norte (N1) e aponta o controle direito para ela
  const door = await ev(() => { const S = window.__saat, X = S.xr, it = S.W.inter.find((i) => i.kind === 'door'); const p0 = it.hit.getWorldPosition(new (S.P.pos.constructor)()); X.loco.placeHead(p0.x + 1.6, p0.z + 1.6, null); return { id: it.id, x: p0.x, y: p0.y, z: p0.z }; });
  await wait(600);
  R.portaAntes = await ev((id) => window.__saat.W.indoor.doors.find((x) => 'door:' + x.id === id)?.tgt, door.id);
  await ev((d) => { const S = window.__saat, X = S.xr, rig = X.rig, cam = S.E.cam; rig.updateMatrixWorld(true);
    const inv = rig.matrixWorld.clone().invert(); const t = new (S.P.pos.constructor)(d.x, d.y, d.z).applyMatrix4(inv); const o = cam.position.clone().add(new (S.P.pos.constructor)(0.15, -0.25, -0.1));
    const dir = t.clone().sub(o).normalize(); const a = new (S.P.pos.constructor)(0, 0, -1); const c = a.clone().cross(dir), w = 1 + a.dot(dir), n = Math.hypot(c.x, c.y, c.z, w);
    const r = window.__dev.controllers.right; r.position.set(o.x, o.y, o.z); r.quaternion.set(c.x / n, c.y / n, c.z / n, w / n); }, door);
  await wait(500); R.alvo = await ev(() => { const X = window.__saat.xr; return X['hover'].map((h) => h?.id || null); }); await shot('05-raio-porta');
  await ev(() => window.__dev.controllers.right.updateButtonValue('trigger', 1)); await wait(200); await ev(() => window.__dev.controllers.right.updateButtonValue('trigger', 0)); await wait(800);
  R.portaDepois = await ev((id) => window.__saat.W.indoor.doors.find((x) => 'door:' + x.id === id)?.tgt, door.id);
  // pátio: draw calls no VR
  await ev(() => { const S = window.__saat, s = S.W.spawns.trafos; S.xr.loco.placeHead(s.x, s.z, s.yaw); }); await wait(1500); R.patio = await st(); await shot('06-patio');
  await ev(() => { const S = window.__saat, s = S.W.spawns.lt01; S.xr.loco.placeHead(s.x, s.z, s.yaw); }); await wait(1200); R.lt01 = await st(); await shot('07-lt01');
  // sair do VR
  await ev(() => window.__saat.xr.exit()); await p.waitForFunction(() => !window.__saat.xr.active, null, { timeout: 30000 }); await wait(800);
  R.saiu = await ev(() => { const S = window.__saat; return { cam: S.E.cam.parent === null, x: +S.P.pos.x.toFixed(2), z: +S.P.pos.z.toFixed(2), relatorio: S.xr.report().split('\n').length }; }); await shot('08-desktop');
  console.log(JSON.stringify(R, null, 1));
  const ok = R.distAndar > 1.0 && R.correu.faltas >= 1 && R.parede.area !== 'externo' && R.parede.x > 0.2 && Math.abs(Math.abs(R.giroGraus) - 30) <= 2 && R.menu === 'float' && R.portaDepois !== R.portaAntes && R.saiu.cam;
  console.log(ok ? 'XR OK' : 'XR FALHOU'); console.log('ERRS', JSON.stringify(errs.slice(0, 6))); await b.close(); process.exit(ok && !errs.length ? 0 : 1);
})();
