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
  // aponta o controle (rig local) de um ponto perto da cabeça para um alvo no mundo; ou põe o controle num ponto do mundo
  await ev(() => { const S = window.__saat, V = S.P.pos.constructor;
    window.__aim = (side, tgt, off = [0.15, -0.25, -0.1]) => { const X = S.xr, rig = X.rig, cam = S.E.cam; rig.updateMatrixWorld(true); const inv = rig.matrixWorld.clone().invert(); const t = new V(tgt.x, tgt.y, tgt.z).applyMatrix4(inv); const o = cam.position.clone().add(new V(off[0], off[1], off[2]));
      const dir = t.clone().sub(o).normalize(), a = new V(0, 0, -1), c = a.clone().cross(dir), w = 1 + a.dot(dir), n = Math.hypot(c.x, c.y, c.z, w); const r = window.__dev.controllers[side]; r.position.set(o.x, o.y, o.z); r.quaternion.set(c.x / n, c.y / n, c.z / n, w / n); };
    window.__put = (side, w) => { const rig = S.xr.rig; rig.updateMatrixWorld(true); const t = new V(w.x, w.y, w.z).applyMatrix4(rig.matrixWorld.clone().invert()); window.__dev.controllers[side].position.set(t.x, t.y, t.z); };
    window.__press = (side, btn, v) => window.__dev.controllers[side].updateButtonValue(btn, v); });
  const click = async (side = 'right', btn = 'trigger') => { await ev(([s, b]) => window.__press(s, b, 1), [side, btn]); await wait(900); await ev(([s, b]) => window.__press(s, b, 0), [side, btn]); await wait(500); };
  const st = () => ev(() => { const S = window.__saat, X = S.xr, h = X.loco.head(new (S.P.pos.constructor)()); return { x: +h.x.toFixed(2), z: +h.z.toFixed(2), yaw: +X.loco.headYaw().toFixed(3), area: S.W.areaAt(h.x, h.z), faltas: S.faltas, menu: X.menu.mode, calls: S.E.renderer.info.render.calls, tris: S.E.renderer.info.render.triangles }; });
  await shot('02-vr-casa'); R.casa = await st();
  await ev(() => { const S = window.__saat, s = S.W.spawns.patio; S.xr.loco.placeHead(s.x, s.z, 0); }); await wait(800); R.inicio = await st();
  // L1 andar 1,5 s para frente (polegar esquerdo)
  await ev(() => window.__dev.controllers.left.updateAxes('thumbstick', 0, -1)); await wait(9000); await ev(() => window.__dev.controllers.left.updateAxes('thumbstick', 0, 0)); await wait(300);
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
  await ev((d) => window.__aim('right', d), door);
  await wait(500); await shot('05-raio-porta');
  await click();
  R.portaDepois = await ev((id) => window.__saat.W.indoor.doors.find((x) => 'door:' + x.id === id)?.tgt, door.id);
  // X3/X10 armário de EPI: gatilho abre o cartão; vestir capacete pelo cartão
  const arm = await ev(() => { const S = window.__saat, it = S.W.inter.find((i) => i.id === 'arm:EPI'); const p0 = it.hit.getWorldPosition(new (S.P.pos.constructor)()); S.xr.loco.placeHead(p0.x, p0.z + 1.5, 0); return { x: p0.x, y: p0.y + 0.3, z: p0.z }; });
  await wait(700); await ev((d) => window.__aim('right', d), arm); await wait(400); await click(); R.cartaoArmario = await ev(() => window.__saat.xr.card.open && window.__saat.xr.card.t?.kind); await shot('05b-cartao-armario');
  R.capacete = await ev(() => { const S = window.__saat, s = S.sess, u = s.inv.units.find((x) => x.item === 'capacete' && !x.comigo); s.epi('pegar', u.uid); S.refreshEpi(); S.xr.card.close(); return s.inv.tem('capacete'); });
  // caixa de comando do vão LT1: porta pela mão (grip) e botão pelo raio
  const cab = await ev(() => { const S = window.__saat, cb = S.W.yard.cabs.LT1; S.xr.loco.placeHead(cb.x + 0.1, cb.z + 1.25, 0); return { x: cb.x, z: cb.z }; }); await wait(800);
  await ev((c) => window.__put('left', { x: c.x + 0.38, y: 1.15, z: c.z + 0.36 }), cab); await wait(300);
  await ev(() => window.__press('left', 'squeeze', 1)); await wait(300);
  for (let i = 1; i <= 6; i++) { await ev(([c, k]) => { const a = -k * 0.25, r = 0.87; window.__put('left', { x: c.x - 0.49 + Math.cos(a) * r, y: 1.15, z: c.z + 0.34 - Math.sin(a) * r }); }, [cab, i]); await wait(250); }
  R.caixaAberta = await ev(() => +window.__saat.W.yard.cabs.LT1.open.toFixed(2)); await ev(() => window.__press('left', 'squeeze', 0)); await wait(300);
  await ev(() => { window.__dev.controllers.left.position.set(-0.2, 1.0, -0.3); }); await shot('06-caixa-aberta');
  const pt = await ev(() => { const S = window.__saat, p0 = S.W.parts.find((x) => x.inter === 'cab:LT1' && x.id === '52-LT1:open').hit.getWorldPosition(new (S.P.pos.constructor)()); return { x: p0.x, y: p0.y, z: p0.z }; });
  const sel = await ev(() => { const S = window.__saat, p0 = S.W.parts.find((x) => x.inter === 'cab:LT1' && x.id === '43').hit.getWorldPosition(new (S.P.pos.constructor)()); return { x: p0.x, y: p0.y, z: p0.z }; });
  await ev((d) => window.__aim('right', d, [0.1, -0.3, -0.2]), sel); await wait(500); await click(); R.chave43 = await ev(() => { const s = window.__saat.sess.sim.s; return s.eq['43-LT1']?.lr || Object.entries(s.eq).find(([k]) => k.startsWith('43') && k.includes('LT1'))?.[1]?.lr; });
  const nlog = await ev(() => window.__saat.sess.sim.log.length); await ev((d) => window.__aim('right', d, [0.1, -0.3, -0.2]), pt); await wait(500); await shot('06b-raio-botao'); await click();
  R.botaoCaixa = await ev((n) => window.__saat.sess.sim.log.slice(n).filter((e) => e.kind === 'cmd').map((e) => e.msg).join(' | ') || 'sem comando', nlog);
  await wait(800); R.pip = await ev(() => window.__saat.xr.pip.active); await shot('06c-pip');
  // X15 supervisório: gatilho na mesa
  const sc = await ev(() => { const S = window.__saat, it = S.W.inter.find((i) => i.kind === 'scada'); const p0 = it.hit.getWorldPosition(new (S.P.pos.constructor)()); const s = S.W.spawns.scada; S.xr.loco.placeHead(s.x, s.z, s.yaw); return { x: p0.x, y: p0.y, z: p0.z }; });
  await wait(900); await ev((d) => window.__aim('right', d), sc); await wait(400); await click(); R.scada = await ev(() => window.__saat.xr.scada.open); await shot('07-scada');
  await ev(() => window.__saat.xr.scada.close());
  // X17/X22 zona controlada e acidente pela mão real perto de parte energizada (138 kV)
  const hz = await ev(() => { const S = window.__saat, der = S.sess.sim.der, h = S.W.hazards.filter((x) => x.nivel === 'AT' && der.energ[x.node]).sort((a, b) => a.p.y - b.p.y)[0]; S.xr.loco.placeHead(h.p.x + 0.6, h.p.z + 0.6, null); return { x: h.p.x, y: h.p.y, z: h.p.z, node: h.node }; });
  await wait(600); await ev((h) => window.__put('right', { x: h.x + 2.2, y: h.y, z: h.z }), hz); await wait(900); R.zona = await ev(() => +window.__saat.xr['zone'].toFixed(2));
  await ev((h) => window.__put('right', { x: h.x + 0.3, y: h.y, z: h.z }), hz); await wait(1200); R.morto = await ev(() => window.__saat.safety.dead);
  await wait(2600); R.cartaoAcidente = await ev(() => window.__saat.xr.acc.open); await shot('08-acidente');
  await ev(() => { window.__dev.controllers.right.position.set(0.2, 1.0, -0.3); }); await ev(() => window.__saat.xr.acc.H.restart()); await wait(1500);
  R.reinicio = await ev(() => ({ morto: window.__saat.safety.dead, fade: +window.__saat.xr.fx.fade.toFixed(2), acc: window.__saat.xr.acc.open }));
  // luvas: controles na frente dos olhos
  await ev(() => { const S = window.__saat; S.sess.inv.units.filter((u) => u.item === 'luva_isolante').slice(0, 1).forEach((u) => S.sess.epi('pegar', u.uid)); S.refreshEpi(); const c = window.__dev.controllers; c.left.position.set(-0.12, 1.45, -0.35); c.right.position.set(0.12, 1.45, -0.35); c.left.quaternion.set(0, 0, 0, 1); c.right.quaternion.set(0, 0, 0, 1); });
  await wait(900); await shot('09-luvas');
  // pátio: draw calls no VR
  await ev(() => { const S = window.__saat, s = S.W.spawns.trafos; S.xr.loco.placeHead(s.x, s.z, s.yaw); }); await wait(1500); R.patio = await st(); await shot('10-patio');
  await ev(() => { const S = window.__saat, s = S.W.spawns.lt01; S.xr.loco.placeHead(s.x, s.z, s.yaw); }); await wait(1200); R.lt01 = await st(); await shot('11-lt01');
  // sair do VR
  await ev(() => window.__saat.xr.exit()); await p.waitForFunction(() => !window.__saat.xr.active, null, { timeout: 30000 }); await wait(800);
  R.saiu = await ev(() => { const S = window.__saat; return { cam: S.E.cam.parent === null, x: +S.P.pos.x.toFixed(2), z: +S.P.pos.z.toFixed(2), relatorio: S.xr.report().split('\n').length }; }); await shot('12-desktop');
  console.log(JSON.stringify(R, null, 1));
  const ok = R.distAndar > 1.0 && R.correu.faltas >= 1 && R.parede.area !== 'externo' && R.parede.x > 0.2 && Math.abs(Math.abs(R.giroGraus) - 30) <= 2 && R.menu === 'float' && R.portaDepois !== R.portaAntes && R.cartaoArmario === 'arm' && R.caixaAberta > 0.4 && R.botaoCaixa !== 'sem comando' && R.pip && R.scada && R.zona > 0 && R.morto && R.cartaoAcidente && !R.reinicio.morto && R.saiu.cam;
  console.log(ok ? 'XR OK' : 'XR FALHOU'); console.log('ERRS', JSON.stringify(errs.slice(0, 6))); await b.close(); process.exit(ok && !errs.length ? 0 : 1);
})();
