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
    // o controle do IWER é a pose do raio; o grip fica deslocado: calibra o deslocamento (no espaço do rig) para posicionar o GRIP exato
    window.__off = { left: new V(), right: new V() }; window.__calib = () => { for (const [k, i] of [['left', 0], ['right', 1]]) { const h = S.xr.input.hands[i], c = window.__dev.controllers[k].position; if (h.grip) window.__off[k].set(c.x - h.grip.position.x, c.y - h.grip.position.y, c.z - h.grip.position.z); } };
    window.__put = (side, w) => { const rig = S.xr.rig; rig.updateMatrixWorld(true); const t = new V(w.x, w.y, w.z).applyMatrix4(rig.matrixWorld.clone().invert()).add(window.__off[side]); window.__dev.controllers[side].position.set(t.x, t.y, t.z); };
    window.__press = (side, btn, v) => window.__dev.controllers[side].updateButtonValue(btn, v); window.__B3 = S.xr.phys.constructor.B3; });
  await wait(800); await ev(() => window.__calib());
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
  // X2 porta pela mão: grip na folha e gira em volta da dobradiça (sem raio: cartão de ajuda desligado por padrão)
  const dd = await ev(() => { const S = window.__saat, V = S.P.pos.constructor, dd = S.W.indoor.doors.find((d) => d.id.startsWith('N')) || S.W.indoor.doors[0]; dd.g.updateMatrixWorld(true);
    const piv = dd.g.getWorldPosition(new V()); const leaf = dd.g.children.find((o) => o.isMesh) || dd.g.children[0]; const lc = leaf.getWorldPosition(new V()); const r = Math.hypot(lc.x - piv.x, lc.z - piv.z) || dd.w / 2;
    const a0 = Math.atan2(-(lc.z - piv.z), lc.x - piv.x); S.xr.loco.placeHead(piv.x + Math.cos(a0) * r + 0.9 * Math.sin(a0), piv.z - Math.sin(a0) * r + 0.9 * Math.cos(a0), null); return { id: dd.id, px: piv.x, pz: piv.z, y: 1.1, r: Math.min(r, 0.6), a0, sg: Math.sign(dd.max) || 1 }; });
  await wait(700); R.portaAntes = await ev((id) => window.__saat.W.indoor.doors.find((x) => x.id === id).open, dd.id);
  await ev((d) => window.__put('left', { x: d.px + Math.cos(d.a0) * d.r, y: d.y, z: d.pz - Math.sin(d.a0) * d.r }), dd); await wait(400); await ev(() => window.__press('left', 'squeeze', 1)); await wait(700);
  for (let i = 1; i <= 5; i++) { await ev(([d, k]) => { const a = d.a0 + d.sg * k * 0.2; window.__put('left', { x: d.px + Math.cos(a) * d.r, y: d.y, z: d.pz - Math.sin(a) * d.r }); }, [dd, i]); await wait(450); }
  R.portaDepois = await ev((id) => +window.__saat.W.indoor.doors.find((x) => x.id === id).open.toFixed(2), dd.id); await ev(() => window.__press('left', 'squeeze', 0)); await wait(400); await shot('05-porta-mao');
  // cartão de ajuda (opcional): liga no menu, gatilho no armário abre o cartão
  const arm = await ev(() => { const S = window.__saat, it = S.W.inter.find((i) => i.id === 'arm:EPI'); const p0 = it.hit.getWorldPosition(new (S.P.pos.constructor)()); S.xr.loco.s.ajuda = true; S.xr.loco.placeHead(p0.x, p0.z + 1.5, 0); return { x: p0.x, y: p0.y + 0.3, z: p0.z }; });
  await wait(700); await ev((d) => window.__aim('right', d), arm); await wait(400); await click(); R.cartaoArmario = await ev(() => { const X = window.__saat.xr, k = X.card.open && X.card.t?.kind; X.card.close(); X.loco.s.ajuda = false; return k; });
  // EPI físico: pega o capacete, olha de perto (inspeção) e leva à cabeça (veste)
  await ev(() => { const S = window.__saat; S.W.indoor.cabinets.EPI.tgt = 1; }); await wait(1500);
  const cap = await ev(() => { const S = window.__saat, g = S.W.indoor.cabinets.EPI.items['capacete#1'], V = S.P.pos.constructor; const c = new V(); new (window.__B3)().setFromObject(g).getCenter(c); return { x: c.x, y: c.y, z: c.z }; });
  await ev((c) => window.__put('right', c), cap); await wait(500); await ev(() => window.__press('right', 'squeeze', 1)); await wait(700);
  R.segurando = await ev(() => window.__saat.xr.phys.hold[1]?.k || null);
  await ev(() => { const S = window.__saat, X = S.xr, h = X.head(new (S.P.pos.constructor)()), f = X.fwd(new (S.P.pos.constructor)()); window.__put('right', { x: h.x + f.x * 0.2, y: h.y - 0.02, z: h.z + f.z * 0.2 }); }); await wait(16000); R.inspT = await ev(() => +(window.__saat.xr.phys.hold[1]?.insp || 0).toFixed(2)); await shot('06-inspeciona-capacete');
  await ev(() => window.__press('right', 'squeeze', 0)); await wait(800);
  R.capacete = await ev(() => { const inv = window.__saat.sess.inv; return { veste: inv.tem('capacete'), inspecionado: inv.units.some((u) => u.item === 'capacete' && u.inspecionado) }; });
  // ferramenta física: manivela do armário, encaixa no cubículo AL1 e gira 3 voltas (anti-horário = extrair)
  const man = await ev(() => { const S = window.__saat, g = S.W.indoor.cabinets.EPI.items['manivela_extracao#1'], V = S.P.pos.constructor, c = new V(); new (window.__B3)().setFromObject(g).getCenter(c); return { x: c.x, y: c.y, z: c.z }; });
  await ev((c) => window.__put('right', c), man); await wait(500); await ev(() => window.__press('right', 'squeeze', 1)); await wait(700);
  R.manivela = await ev(() => ({ hold: window.__saat.xr.phys.hold[1]?.item || null, tool: window.__saat.tool }));
  await ev(() => { const S = window.__saat, cu = S.W.indoor.cub.AL1; S.xr.loco.placeHead(cu.x + 0.1, cu.zf + 0.9, 0); }); await wait(3000);
  const tipTo = async (pid) => ev((pid) => { const S = window.__saat, X = S.xr, V = S.P.pos.constructor, pc = X.phys.pcs.find((x) => x.p.id === pid && x.t.eq === 'AL1'), hd = X.phys.hold[1], g = X.input.hands[1].grip; if (!pc || !hd) return 'sem alvo';
    const tip = g.localToWorld(hd.tipL.clone()), d = pc.c.clone().sub(tip), hp = X.input.hands[1].pos.clone().add(d); window.__put('right', hp); return 'ok'; }, pid);
  R.alvoManivela = await ev(() => window.__saat.xr.phys.pcs.filter((x) => x.t.eq === 'AL1').map((x) => x.p.id + ':' + x.cat).join(','));
  const rackId = await ev(() => window.__saat.xr.phys.pcs.find((x) => x.t.eq === 'AL1' && x.cat === 'crank')?.p.id || null);
  await tipTo(rackId); await wait(600); await tipTo(rackId); await wait(900); R.encaixou = await ev(() => !!window.__saat.xr.phys.hold[1]?.eng);
  const nlog0 = await ev(() => window.__saat.sess.sim.log.length);
  for (let i = 1; i <= 40 && R.encaixou; i++) { await ev((k) => { const X = window.__saat.xr, e = X.phys.hold[1]?.eng; if (!e) return; const a = k * Math.PI / 4.5, c = e.pc.c, p = c.clone().addScaledVector(e.u, Math.cos(a) * 0.14).addScaledVector(e.w, Math.sin(a) * 0.14).addScaledVector(e.pc.n, 0.25); window.__put('right', p); }, i); await wait(550); }
  await shot('07-manivela'); R.manivelaCmd = await ev((n) => window.__saat.sess.sim.log.slice(n).filter((e) => e.kind === 'cmd').map((e) => e.msg).join(' | ') || 'sem comando', nlog0);
  await ev(() => window.__press('right', 'squeeze', 0)); await wait(800); R.manivelaSolta = await ev(() => ({ hold: !!window.__saat.xr.phys.hold[1], tool: window.__saat.tool }));
  // caixa de comando do vão LT1: porta pela mão, chave 43 girando o pulso, ABRIR com o dedo
  const cab = await ev(() => { const S = window.__saat, cb = S.W.yard.cabs.LT1; S.xr.loco.placeHead(cb.x + 0.1, cb.z + 1.0, 0); return { x: cb.x, z: cb.z }; }); await wait(3000);
  await ev((c) => window.__put('left', { x: c.x + 0.38, y: 1.15, z: c.z + 0.36 }), cab); await wait(300); await ev(() => window.__press('left', 'squeeze', 1)); await wait(400);
  for (let i = 1; i <= 6; i++) { await ev(([c, k]) => { const a = -k * 0.25, r = 0.87; window.__put('left', { x: c.x - 0.49 + Math.cos(a) * r, y: 1.15, z: c.z + 0.34 - Math.sin(a) * r }); }, [cab, i]); await wait(250); }
  R.caixaAberta = await ev(() => +window.__saat.W.yard.cabs.LT1.open.toFixed(2)); await ev(() => window.__press('left', 'squeeze', 0)); await wait(300);
  await ev(() => { window.__dev.controllers.left.position.set(-0.25, 0.9, -0.2); }); await wait(300);
  const sel = await ev(() => { const S = window.__saat, pc = S.xr.phys.pcs.find((x) => x.t.id === 'cab:LT1' && x.p.id === '43'); return pc ? { x: pc.c.x, y: pc.c.y, z: pc.c.z, n: pc.n.toArray() } : null; });
  await ev((d) => window.__put('right', { x: d.x + d.n[0] * 0.03, y: d.y, z: d.z + d.n[2] * 0.03 }), sel); await wait(400); await ev(() => window.__press('right', 'squeeze', 1)); await wait(500);
  for (let i = 1; i <= 3; i++) { await ev(([d, k]) => { const S = window.__saat, X = S.xr, Q = X.rig.quaternion.constructor, V = S.P.pos.constructor, n = new V(...d.n); const qw = new Q().setFromAxisAngle(n, -k * 0.3), rq = X.rig.getWorldQuaternion(new Q()); const lq = rq.clone().invert().multiply(qw).multiply(rq); window.__dev.controllers.right.quaternion.set(lq.x, lq.y, lq.z, lq.w); }, [sel, i]); await wait(400); }
  await ev(() => window.__press('right', 'squeeze', 0)); await ev(() => window.__dev.controllers.right.quaternion.set(0, 0, 0, 1)); await wait(1200); await ev(() => window.__calib());
  R.chave43 = await ev(() => window.__saat.sess.sim.s.eq['43-LT1']?.lr);
  const pokeTo = async (pid) => { for (let j = 0; j < 3; j++) { await ev(([pid, j]) => { const S = window.__saat, X = S.xr, pc = X.phys.pcs.find((x) => x.t.id === 'cab:LT1' && x.p.id === pid), h = X.input.hands[1]; const tgt = pc.c.clone().addScaledVector(pc.n, j === 0 ? 0.06 : -0.003); window.__put('right', h.pos.clone().add(tgt.sub(h.finger))); }, [pid, j]); await wait(700); } };
  const nlog = await ev(() => window.__saat.sess.sim.log.length);
  await ev(() => { const S = window.__saat, X = S.xr, pc = X.phys.pcs.find((x) => x.t.id === 'cab:LT1' && x.p.id === '52-LT1:open'); window.__put('right', pc.c.clone().addScaledVector(pc.n, 0.09)); }); await wait(900);
  R.aponta = await ev(() => window.__saat.xr.input.hands[1].pointing);
  await pokeTo('52-LT1:open'); await shot('08-dedo-botao');
  R.botaoCaixa = await ev((n) => window.__saat.sess.sim.log.slice(n).filter((e) => e.kind === 'cmd').map((e) => e.msg).join(' | ') || 'sem comando', nlog);
  R.pip = await ev(() => window.__saat.xr.pip.until > 0); await shot('09-pip');
  await ev(() => { window.__dev.controllers.right.position.set(0.2, 1.0, -0.3); });
  // supervisório: chegou perto da mesa, a tela de toque aparece no monitor
  await ev(() => { const S = window.__saat, ds = S.W.indoor.deskSeat; S.xr.loco.placeHead(ds.pos.x, ds.pos.z + 0.2, 0); }); await wait(1500);
  R.scada = await ev(() => window.__saat.xr.scada.open && window.__saat.xr.scada.atDesk); await shot('10-scada-mesa');
  await ev(() => { const S = window.__saat; S.xr.scada.close(); S.xr.loco.placeHead(S.W.spawns.patio.x, S.W.spawns.patio.z, 0); }); await wait(600);
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
  const ok = R.distAndar > 1.0 && R.correu.faltas >= 1 && R.parede.area !== 'externo' && R.parede.x > 0.2 && Math.abs(Math.abs(R.giroGraus) - 30) <= 2 && R.menu === 'float' && R.portaDepois > R.portaAntes + 0.3 && R.cartaoArmario === 'arm' && R.capacete.veste && R.capacete.inspecionado && R.encaixou && /extra|teste|rack|carrinho/i.test(R.manivelaCmd) && R.caixaAberta > 0.4 && R.chave43 === 'local' && R.botaoCaixa !== 'sem comando' && R.pip && R.scada && R.zona > 0 && R.morto && R.cartaoAcidente && !R.reinicio.morto && R.saiu.cam;
  console.log(ok ? 'XR OK' : 'XR FALHOU'); console.log('ERRS', JSON.stringify(errs.slice(0, 6))); await b.close(); process.exit(ok && !errs.length ? 0 : 1);
})();
