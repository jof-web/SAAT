// E2E: tensão de passo (S2) e arco elétrico sem EPI (prática livre).
const { chromium } = require('playwright-core');
const OUT = __dirname + '/../.shots/';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', (e) => errs.push('PE ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push('CE ' + m.text()); });
  await p.addInitScript(() => { try { localStorage.setItem('saat:qual', '"baixo"'); localStorage.setItem('saat:qualAuto', 'false'); localStorage.setItem('saat:logado', '"visitante"'); } catch {} });
  await p.goto('file://' + require('path').resolve(__dirname, '../jogar/index.html'));
  await p.waitForFunction(() => window.__saat, null, { timeout: 120000 }); await p.waitForTimeout(800);
  const ev = (f, a) => p.evaluate(f, a); const log = (...a) => console.log(...a);
  const shot = async (n) => { await p.waitForTimeout(600); await p.screenshot({ path: OUT + 'h-' + n + '.png' }); log('shot', n); };
  // S2 — condutor caído
  await ev(() => { const S = window.__saat; S.start({ missao: 'S2', perfil: 'nr10_vigente', modo: 'autonomo', semente: 1, treinando: 'Teste', sandbox: false, exigirEpi: true }); document.querySelector('.modal .hw.primary').click(); });
  await p.waitForTimeout(600);
  const c = await ev(() => { const S = window.__saat, cd = S.safety.caido; return { a: [cd.a.x, cd.a.z], b: [cd.b.x, cd.b.z], energ: !!S.sess.sim.der.energ.LINE }; }); log('condutor', JSON.stringify(c));
  await ev((c) => { const S = window.__saat; S.P.place(c.b[0] + 4, c.b[1] + 12, Math.atan2(-(-12), -(-4)) ); S.P.yaw = Math.atan2(4, 12); S.P.pitch = -0.15; }, c); await shot('01-s2');
  await ev((c) => { const S = window.__saat; S.P.place(c.b[0] + 2, c.b[1] + 7, Math.atan2(2, 7)); }, c); await p.waitForTimeout(1500);
  log('10 m:', JSON.stringify(await ev(() => ({ erros: window.__saat.sess.sc.st.erros.map((e) => e.sev + ':' + e.msg), dead: window.__saat.safety.dead }))));
  await shot('02-s2-passo');
  await ev((c) => { const S = window.__saat; S.P.keys.KeyW = true; S.P.place(c.b[0] + 1.5, c.b[1] + 3.5, Math.atan2(1.5, 3.5)); }, c); await p.waitForTimeout(1500); await ev(() => { window.__saat.P.keys.KeyW = false; });
  await p.waitForFunction(() => document.querySelector('.acc:not(.hidden)'), null, { timeout: 30000 }).catch(() => {});
  log('passo:', JSON.stringify(await ev(() => ({ dead: window.__saat.safety.dead, tipo: window.__saat.safety.acc?.tipo }))));
  await shot('03-s2-acidente');
  // Arco: aterramento temporário em ponto energizado sem EPI (prática livre)
  await ev(() => { document.querySelector('.acc .hw.ghost')?.click(); }); await p.waitForTimeout(500);
  await ev(() => { const S = window.__saat; S.start({ missao: null, perfil: 'nr10_vigente', modo: 'autonomo', semente: 1, treinando: 'Teste', sandbox: true }); const cu = S.W.indoor.cub.T1M; S.P.place(cu.x, cu.zc - 0.8 - 1.0, Math.PI); });
  await p.waitForTimeout(500);
  const arc = await ev(() => { const S = window.__saat; const r = S.sess.cmd({ t: 'aterr', node: 'T1m', op: 'install' }, 'treinando'); return r.msg; }); log('aterr:', arc);
  await p.waitForFunction(() => document.querySelector('.acc:not(.hidden)'), null, { timeout: 30000 }).catch(() => {});
  log('arco:', JSON.stringify(await ev(() => ({ dead: window.__saat.safety.dead, acc: window.__saat.safety.acc && { tipo: window.__saat.safety.acc.tipo, lesao: window.__saat.safety.acc.lesao } }))));
  await shot('04-arco');
  log('ERRS', JSON.stringify(errs.slice(0, 8))); await b.close();
})();
