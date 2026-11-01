// E2E: tutorial T0 (flags por jogo) + console do instrutor ao vivo + medição de draw calls / FPS.
const { chromium } = require('playwright-core');
const OUT = __dirname + '/../.shots/';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  const p = await ctx.newPage(); const errs = []; const hook = (pg, tag) => { pg.on('pageerror', (e) => errs.push(tag + ' PE ' + e.message)); pg.on('console', (m) => { if (m.type() === 'error') errs.push(tag + ' CE ' + m.text()); }); }; hook(p, 'game');
  await p.addInitScript((q) => { try { localStorage.setItem('saat:qual', JSON.stringify(q)); localStorage.setItem('saat:qualAuto', 'false'); localStorage.setItem('saat:logado', '"visitante"'); } catch {} }, process.env.Q || 'medio');
  await p.goto('file://' + require('path').resolve(__dirname, '../jogar/index.html'));
  await p.waitForFunction(() => window.__saat, null, { timeout: 120000 }); await p.waitForTimeout(1000);
  const ev = (f, a) => p.evaluate(f, a);
  await ev(() => { const S = window.__saat; S.start({ missao: 'T0', perfil: 'nr10_vigente', modo: 'autonomo', semente: 1, treinando: 'Teste', sandbox: false, nivel: 'basico', exigirEpi: true }); document.querySelector('.modal .hw.primary').click(); });
  await p.waitForTimeout(800);
  // perf: draw calls / triângulos em 3 pontos de vista
  const perf = async (tag) => { await p.waitForTimeout(600); const r = await ev(() => new Promise((res) => { const S = window.__saat, i = S.E.renderer.info; i.autoReset = false; requestAnimationFrame(() => { i.reset(); requestAnimationFrame(() => { const o = { calls: i.render.calls, tri: i.render.triangles, geo: i.memory.geometries, tex: i.memory.textures }; i.autoReset = true; res(o); }); }); })); const fps = await ev(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(+(n / ((performance.now() - t0) / 1000)).toFixed(1)); }; requestAnimationFrame(f); })); console.log('perf', tag, JSON.stringify({ ...r, fps })); };
  await perf('casa');
  // passos do tutorial
  await ev(() => { const S = window.__saat, it = S.W.inter.find((i) => i.id === 'arm:EPI'); S.P.place(it.hit.position.x + 1.3, it.hit.position.z, Math.PI / 2); S.P.pitch = -0.15; });
  await p.waitForTimeout(1500); await p.keyboard.press('KeyE'); await p.waitForTimeout(3000);
  await ev(() => { const S = window.__saat, inv = S.sess.inv; const u = inv.units.find((x) => x.item === 'capacete' && !x.defeito); S.sess.epi('inspecionar', u.uid); S.sess.epi('pegar', u.uid); const v = inv.units.find((x) => x.item === 'detector_mt' && !x.defeito); if (v) { S.sess.epi('inspecionar', v.uid); S.sess.epi('pegar', v.uid); } S.refreshEpi(); });
  await p.waitForTimeout(500); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  await p.keyboard.press('Tab'); await p.waitForTimeout(3000); await p.keyboard.press('Tab'); await p.waitForTimeout(300);
  await ev(() => window.__saat.setTool('detector_mt')); await p.waitForTimeout(400);
  await ev(() => { const S = window.__saat, cu = S.W.indoor.cub.AL1; S.P.place(cu.x, cu.zf + 1.2, 0); S.P.pitch = -0.1; }); await p.waitForTimeout(500);
  await p.keyboard.press('KeyE'); await p.waitForTimeout(800);
  await ev(() => { const S = window.__saat; const pt = S.W.indoor.cub.AL1.parts?.find?.((x) => x.act === 'teste') || null; if (pt) S.inter.click?.(pt); else S.inter.lastPart = 'x'; });
  await p.waitForTimeout(400); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  await ev(() => window.__saat.sit()); await p.waitForTimeout(1200); await perf('scada'); await ev(() => window.__saat.stand()); await p.waitForTimeout(500);
  const tut = await ev(() => { const S = window.__saat, sc = S.sess.sc; return { flags: Object.keys(sc.st.flags).filter((k) => k.startsWith('tut:')), checks: Object.keys(sc.st.checks), total: sc.m.checks.length }; });
  console.log('T0', JSON.stringify(tut));
  await p.screenshot({ path: OUT + 't-01-tutorial.png' });
  await ev(() => { const S = window.__saat, sp = S.W.spawns.patio; S.P.place(sp.x, sp.z, sp.yaw); S.P.pitch = 0.05; }); await perf('patio');
  // console do instrutor (popup)
  const [con] = await Promise.all([ctx.waitForEvent('page', { timeout: 15000 }), ev(() => { window.__saat.togglePause(true); const bt = [...document.querySelectorAll('button')].find((x) => /Console do instrutor/.test(x.textContent)); bt.click(); })]);
  hook(con, 'con'); await con.setViewportSize({ width: 1400, height: 860 }); await con.waitForTimeout(3500);
  const live = await con.evaluate(() => ({ title: document.title, rows: [...document.querySelectorAll('.livebox *')].map((e) => e.textContent).join(' | ').slice(0, 260) }));
  console.log('CON', JSON.stringify(live));
  await con.screenshot({ path: OUT + 't-02-instrutor.png' });
  console.log('ERRS', JSON.stringify(errs.slice(0, 8)));
  await b.close();
})();
