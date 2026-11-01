// Ciclo de captura do interior da casa de comando: câmeras nas posições das fotos do local (planta u/v).
// Uso: node e2e/casa.cjs [qualidade] [filtro]   → .shots/c-*.png
const { chromium } = require('playwright-core');
const OUT = process.env.OUT || __dirname + '/../.shots/';
const Q = process.argv[2] || 'medio', F = process.argv[3] || '';
const L = require('../src/data/plant.json').casa.layout;
const w = (u, y, v) => [L.xE - u, y, L.zN + v];
const cams = [ // [nome, olho (u,y,v), alvo (u,y,v)]
  ['c01-salao-portao', [11.0, 1.6, 6.6], [2.0, 1.5, 4.5]],
  ['c02-frente-pdmt', [5.2, 1.6, 4.9], [26.0, 1.3, 6.2]],
  ['c03-pdmt', [14.6, 1.55, 8.6], [14.6, 1.3, 3.7]],
  ['c04-pspc', [19.6, 1.55, 6.9], [19.85, 1.25, 8.8]],
  ['c05-ret', [22.9, 1.55, 6.9], [22.9, 0.9, 9.4]],
  ['c06-qdcc', [23.3, 1.55, 7.4], [26.4, 1.3, 6.8]],
  ['c07-mesa-epi', [2.2, 1.6, 3.7], [2.0, 1.1, 0.0]],
  ['c08-bateria', [26.9, 1.65, 3.7], [28.2, 0.9, 9.4]],
  ['c09-traseira', [20.8, 1.6, 0.9], [8.0, 1.3, 1.0]],
  ['c10-tsa', [25.0, 1.6, 0.35], [25.0, 0.6, 2.2]],
  ['c11-portao', [4.0, 1.6, 7.4], [0.0, 2.0, 7.4]],
  ['c12-corredor-bat', [17.5, 1.6, 4.9], [26.4, 1.3, 3.2]],
];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + require('path').resolve(__dirname, '../jogar/index.html') + '#preview:' + Q + (process.env.LITE ? ':vrlite' : ''));
  await p.waitForFunction(() => window.__pv && window.__pv.frames() > 2, null, { timeout: 120000 });
  require('fs').mkdirSync(OUT, { recursive: true });
  for (const [name, e, t] of cams) { if (F && !name.includes(F)) continue;
    const c = [...w(...e), ...w(...t)];
    await p.evaluate((c) => window.__pv.cam(...c), c); const f0 = await p.evaluate(() => window.__pv.frames()); await p.waitForFunction((f0) => window.__pv.frames() > f0 + 2, f0, { timeout: 90000 });
    await p.screenshot({ path: OUT + name + '.png' }); console.log('shot', name, await p.evaluate(() => { const i = window.__pv.E.renderer.info.render; return i.calls + ' ' + i.triangles; })); }
  console.log('ERRS', JSON.stringify(errs.slice(0, 5))); await b.close();
})();
