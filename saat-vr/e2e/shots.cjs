// Ciclo de captura: câmeras fixas → PNGs (docs/ESTILO.md §1.5). Uso: node e2e/shots.cjs [qualidade] [filtro]
const { chromium } = require('playwright-core');
const OUT = process.env.OUT || __dirname + '/../.shots/';
const Q = process.argv[2] || 'medio', F = process.argv[3] || '';
const shots = [
  ['01-eq1', [27.0, 1.7, 73.0, 26.0, 1.2, 69.5]],
  ['02-cub-al1', [24.6, 1.55, 71.2, 24.3, 1.35, 69.9]],
  ['03-mesa', [21.5, 1.7, 70.5, 23.8, 1.3, 73.5]],
  ['04-bateria', [14.5, 1.7, 66.0, 8.0, 0.9, 71.5]],
  ['05-portao', [15.7, 1.7, 84.0, 22.0, 3.0, 50.0]],
  ['06-bays', [24.0, 1.7, 36.0, 18.0, 3.5, 17.0]],
  ['07-trafo', [21.0, 1.7, 58.0, 27.3, 2.5, 50.3]],
  ['08-aerea', [70.0, 45.0, 95.0, 27.0, 0.0, 38.0]],
  ['09-casa-ext', [30.0, 1.7, 56.0, 22.0, 2.0, 64.0]],
  ['10-armarios', [19.5, 1.65, 66.0, 16.8, 1.1, 65.6]],
];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + require('path').resolve(__dirname, '../jogar/index.html') + '#preview:' + Q);
  await p.waitForFunction(() => window.__pv && window.__pv.frames() > 2, null, { timeout: 120000 });
  console.log('build ms', await p.evaluate(() => Math.round(window.__pv.buildMs)));
  require('fs').mkdirSync(OUT, { recursive: true });
  for (const [name, c] of shots) { if (F && !name.includes(F)) continue;
    await p.evaluate((c) => window.__pv.cam(...c), c); const f0 = await p.evaluate(() => window.__pv.frames()); await p.waitForFunction((f0) => window.__pv.frames() > f0 + 2, f0, { timeout: 60000 });
    await p.screenshot({ path: OUT + name + '.png' }); console.log('shot', name, await p.evaluate(() => window.__pv.E.renderer.info.render.calls)); }
  console.log('ERRS', JSON.stringify(errs.slice(0, 5))); await b.close();
})();
