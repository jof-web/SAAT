// E2E do jogo: home → missão → casa (HUD) → armário (inspeção) → tablet → mesa (SCADA) → pátio. Capturas em .shots/g-*.png
const { chromium } = require('playwright-core');
const OUT = __dirname + '/../.shots/';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } }); const errs = []; p.on('pageerror', (e) => errs.push('PE ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push('CE ' + m.text()); });
  await p.addInitScript((q) => { try { localStorage.setItem('saat:qual', JSON.stringify(q)); localStorage.setItem('saat:qualAuto', 'false'); localStorage.setItem('saat:logado', '"visitante"'); } catch {} }, process.env.Q || 'baixo');
  await p.goto('file://' + require('path').resolve(__dirname, '../jogar/index.html'));
  await p.waitForFunction(() => window.__saat, null, { timeout: 120000 }); await p.waitForTimeout(1500);
  const shot = async (n) => { await p.waitForTimeout(700); await p.screenshot({ path: OUT + 'g-' + n + '.png' }); console.log('shot', n); };
  const ev = (f, a) => p.evaluate(f, a);
  await shot('01-home');
  await p.click('text=Iniciar >> nth=0', { noWaitAfter: true }); await p.waitForTimeout(800); await shot('02-briefing');
  await p.click('.modal .hw.primary', { noWaitAfter: true }); await p.waitForTimeout(600);
  await ev(() => { const S = window.__saat; S.P.yaw = Math.PI / 2 + 0.2; S.P.pitch = -0.1; }); await shot('03-casa');
  // ir até o armário de EPI e inspecionar
  await ev(() => { const S = window.__saat, it = S.W.inter.find((i) => i.id === 'arm:EPI'); S.P.place(it.hit.position.x + 1.3, it.hit.position.z, Math.PI / 2); S.P.pitch = -0.15; });
  await p.waitForTimeout(500); await shot('04-mira-armario');
  await p.keyboard.press('KeyE'); await p.waitForTimeout(900); await shot('05-armario');
  // vestir tudo de EPI via sessão (atalho de teste) e sair
  await ev(() => { const S = window.__saat, inv = S.sess.inv; for (const it of ['capacete', 'oculos', 'vestimenta', 'botina', 'protetor_facial', 'balaclava', 'luva_isolante', 'luva_cobertura', 'manivela_extracao', 'alavanca_terra', 'detector_mt', 'kit_bloqueio', 'radio']) { const u = inv.units.find((x) => x.item === it && !x.defeito); if (u) { S.sess.epi('inspecionar', u.uid); S.sess.epi('pegar', u.uid); } } S.refreshEpi(); });
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  await ev(() => window.__saat.setTool('manivela_extracao')); await shot('06-epi-ferramenta');
  // tablet
  await p.keyboard.press('Tab'); await p.waitForTimeout(900); await shot('07-tablet');
  await ev(() => window.__saat.tablet.go('apr')); await shot('08-tablet-apr');
  await p.keyboard.press('Tab'); await p.waitForTimeout(400);
  // cubículo AL1 inspeção
  await ev(() => { const S = window.__saat, cu = S.W.indoor.cub.AL1; S.P.place(cu.x, cu.zf + 1.2, 0); S.P.pitch = -0.1; }); await p.waitForTimeout(400);
  await p.keyboard.press('KeyE'); await p.waitForTimeout(900); await shot('09-cubiculo');
  await p.mouse.move(683, 330); await p.waitForTimeout(300); await shot('10-cub-hover');
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  // mesa
  await ev(() => window.__saat.sit()); await p.waitForTimeout(1500); await shot('11-scada');
  await ev(() => window.__saat.stand()); await p.waitForTimeout(500);
  // pátio
  await ev(() => { const S = window.__saat, sp = S.W.spawns.patio; S.P.place(sp.x, sp.z, sp.yaw); S.P.pitch = 0.05; }); await shot('12-patio');
  await ev(() => window.__saat.togglePause(true)); await shot('13-pausa');
  console.log('ERRS', JSON.stringify(errs.slice(0, 8)));
  await b.close();
})();
