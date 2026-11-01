// Ciclo de captura do pátio v5 (pórticos, barra em cabo, cabos para-raios, torre, trafos, cerca). Uso: node e2e/patio.cjs [qualidade] [filtro]
const { chromium } = require('playwright-core');
const OUT = process.env.OUT || __dirname + '/../.shots/';
const Q = process.argv[2] || 'medio', F = process.argv[3] || '';
const cams = [
  ['p01-aerea', [78, 46, 102, 26, 0, 32]],
  ['p02-portico-linha', [24, 1.7, 17, 26, 9, -6]],
  ['p03-barra-lateral', [27, 1.7, 37.5, 6, 6.5, 26]],
  ['p04-trafos', [19, 1.7, 61, 18, 5.5, 47]],
  ['p05-portoes', [66, 1.7, 44, 55.6, 2, 30]],
  ['p06-casa-sul', [25, 1.7, 88, 25, 3, 70]],
  ['p07-torre', [44, 1.7, -36, 26.8, 16, -30]],
  ['p08-tr03', [47, 1.7, 63, 42, 3, 49]],
];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + require('path').resolve(__dirname, '../jogar/index.html') + '#preview:' + Q + (process.env.LITE ? ':vrlite' : ''));
  await p.waitForFunction(() => window.__pv && window.__pv.frames() > 2, null, { timeout: 120000 });
  require('fs').mkdirSync(OUT, { recursive: true });
  for (const [name, c] of cams) { if (F && !name.includes(F)) continue;
    await p.evaluate((c) => window.__pv.cam(...c), c); const f0 = await p.evaluate(() => window.__pv.frames()); await p.waitForFunction((f0) => window.__pv.frames() > f0 + 2, f0, { timeout: 90000 });
    await p.screenshot({ path: OUT + name + '.png' }); const i = await p.evaluate(() => window.__pv.E.renderer.info.render); console.log('shot', name, i.calls, i.triangles); }
  console.log('ERRS', JSON.stringify(errs.slice(0, 5))); await b.close();
})();
