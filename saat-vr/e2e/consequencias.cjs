// E2E de consequências: forçar o intertravamento em campo (repetir a ação bloqueada em até 7 s) leva à consequência
// física do simulador: arco/explosão e morte (tela preta) ou lesão grave, conforme distância, tensão e EPI.
// A) abrir seccionadora 138 kV sob carga (I-01) a ~3,5 m → arco AT → morte
// B) extrair disjuntor 13,8 kV fechado (I-04) sem EPI → arco no cubículo → morte
// C) fechar a terra do cubículo com o circuito vivo (I-02) só com a vestimenta → arco → lesão grave
const { chromium } = require('playwright-core');
const path = require('path'); const OUT = __dirname + '/../.shots/';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', (e) => errs.push('PE ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push('CE ' + m.text()); });
  await p.addInitScript(() => { localStorage.setItem('saat:logado', '"visitante"'); localStorage.setItem('saat:qual', '"baixo"'); localStorage.setItem('saat:qualAuto', 'false'); });
  await p.goto('file://' + path.resolve(__dirname, '../jogar/index.html')); await p.waitForFunction(() => window.__saat, null, { timeout: 120000 });
  const ev = (f, a) => p.evaluate(f, a), wait = (ms) => p.waitForTimeout(ms);
  const R = {};
  const cen = async (nome, prep, c, fatal) => {
    await ev((prep) => { const S = window.__saat; S.start({ missao: null, sandbox: true, perfil: 'operador', modo: 'treino', semente: 1 }); document.querySelectorAll('.modal').forEach((m) => m.remove()); S.togglePause?.(false); window.__morte = false; const el = document.querySelector('.morte'); if (el && !el.__obs) { el.__obs = new MutationObserver(() => { if (!el.classList.contains('hidden')) window.__morte = true; }); el.__obs.observe(el, { attributes: true }); } (0, eval)(prep); }, prep); await wait(800);
    const r1 = await ev((c) => window.__saat.cmd(c)?.result, c); const r2 = await ev((c) => window.__saat.cmd(c)?.result, c);
    await ev(() => { window.__saat.sess.speed = 10; }); let t = 0; while (t < 40000 && !(await ev(() => window.__saat.safety.dead))) { await wait(500); t += 500; }
    await ev(() => { window.__saat.sess.speed = 1; }); await wait(2600); await p.screenshot({ path: OUT + `c-${nome}-1.png` });
    const st = await ev(() => { const S = window.__saat, a = S.safety.acc; return { morto: S.safety.dead, fatal: a ? a.fatal !== false : null, causa: a?.causa?.slice(0, 70), tela: window.__morte ? 'VOCÊ MORREU' : document.querySelector('.h-fade.injury') ? 'lesão' : '—', forcado: S.sess.sim.log.some((e) => e.forcado && e.result === 'ok') }; });
    await wait(fatal ? 4200 : 600); if (fatal) { let k = 0; while (k++ < 20 && !(await ev(() => window.__morte))) await wait(500); st.tela = (await ev(() => window.__morte)) ? 'VOCÊ MORREU' : '—'; } await p.screenshot({ path: OUT + `c-${nome}-2.png` }); st.cartao = await ev(() => !!document.querySelector('.acc:not(.hidden)'));
    R[nome] = { r1, r2, ...st }; console.log(nome, JSON.stringify(R[nome]));
    return r1 === 'bloqueado' && r2 === 'ok' && st.forcado && st.morto && st.fatal === fatal && st.tela === (fatal ? 'VOCÊ MORREU' : 'lesão') && st.cartao;
  };
  const a = await cen('seccionadora', "const S = window.__saat; S.cmd({ t: 'lr', id: '43-LT1', to: 'local' }); const r = S.W.yard.dis['89-LT1-1']; S.P.place(r.cx + 1.5, r.cz + 1.5, 0.8);", { t: 'switch', id: '89-LT1-1', op: 'open', via: 'local' }, true);
  const bb = await cen('extracao', "const S = window.__saat, cu = S.W.indoor.cub.AL1; S.P.place(cu.x, cu.zf + 0.8, 0);", { t: 'rack', id: '52-AL1', to: 'teste' }, true);
  const c = await cen('terra', "const S = window.__saat, cu = S.W.indoor.cub.AL1, inv = S.sess.inv; const u = inv.units.find((x) => x.item === 'vestimenta'); S.sess.epi('pegar', u.uid); S.P.place(cu.x, cu.zf + 0.7, 0);", { t: 'switch', id: '89T-AL1', op: 'close', via: 'local' }, false);
  const ok = a && bb && c; console.log(ok ? 'CONSEQUENCIAS OK' : 'CONSEQUENCIAS FALHOU'); console.log('ERRS', JSON.stringify(errs.slice(0, 6))); await b.close(); process.exit(ok && !errs.length ? 0 : 1);
})();
