// E2E funcional: interação com ferramenta, acidente (zona de risco) e resgate completo (S1).
const { chromium } = require('playwright-core');
const OUT = __dirname + '/../.shots/';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', (e) => errs.push('PE ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push('CE ' + m.text()); });
  await p.addInitScript(() => { try { localStorage.setItem('saat:qual', '"baixo"'); localStorage.setItem('saat:qualAuto', 'false'); localStorage.setItem('saat:logado', '"visitante"'); } catch {} });
  await p.goto('file://' + require('path').resolve(__dirname, '../jogar/index.html'));
  await p.waitForFunction(() => window.__saat, null, { timeout: 120000 }); await p.waitForTimeout(800);
  const ev = (f, a) => p.evaluate(f, a); const log = (...a) => console.log(...a);
  const shot = async (n) => { await p.waitForTimeout(600); await p.screenshot({ path: OUT + 'm-' + n + '.png' }); log('shot', n); };
  // ---------- 1) M1: peça exige ferramenta na mão ----------
  await ev(() => { const S = window.__saat; S.start({ missao: 'M1', perfil: 'nr10_vigente', modo: 'autonomo', semente: 1, treinando: 'Teste', sandbox: false, nivel: 'intermediario', exigirEpi: true }); document.querySelector('.modal .hw.primary').click(); });
  await p.waitForTimeout(500);
  const r1 = await ev(() => { const S = window.__saat, inv = S.sess.inv; for (const it of ['capacete', 'oculos', 'vestimenta', 'botina', 'protetor_facial', 'balaclava', 'luva_isolante', 'luva_cobertura', 'manivela_extracao', 'detector_mt', 'kit_bloqueio', 'alavanca_terra']) { const u = inv.units.find((x) => x.item === it && !x.defeito); S.sess.epi('inspecionar', u.uid); S.sess.epi('pegar', u.uid); } S.refreshEpi();
    const it = S.W.inter.find((i) => i.id === 'cub:AL1'); S.inter.inspect(it); const part = (id) => S.W.parts.find((q) => q.inter === 'cub:AL1' && q.id === id); const ev0 = { clientX: 600, clientY: 300 };
    S.setTool(null); S.inter.hover = part('rack'); S.inter.click(ev0); const semFerr = !!document.querySelector('.ichoice:not(.hidden)');
    S.setTool('manivela_extracao'); S.inter.click(ev0); const comFerr = !!document.querySelector('.ichoice:not(.hidden)');
    return { semFerr, comFerr }; });
  log('rack sem ferramenta abre menu?', r1.semFerr, '| com manivela abre menu?', r1.comFerr);
  await ev(() => { const S = window.__saat; S.inter.exit(); });
  // ---------- 2) S1: acidente por aproximação do cabo energizado ----------
  await ev(() => { const S = window.__saat; S.start({ missao: 'S1', perfil: 'nr10_vigente', modo: 'autonomo', semente: 1, treinando: 'Teste', sandbox: false, exigirEpi: true }); document.querySelector('.modal .hw.primary').click(); });
  await p.waitForTimeout(500);
  const pre = await ev(() => { const S = window.__saat, cu = S.W.indoor.cub.AL3; return { energ: !!S.sess.sim.der.energ['AL3c'], rear: S.rearOpen.AL3, vit: !!S.safety.vitima, x: cu.x, zc: cu.zc }; }); log('S1 cena', JSON.stringify(pre));
  await ev(() => { const S = window.__saat, cu = S.W.indoor.cub.AL3; S.P.place(cu.x + 1.2, cu.zc - 0.8 - 1.6, -Math.PI / 2); S.P.pitch = -0.2; }); await shot('01-vitima');
  await ev(() => { const S = window.__saat, cu = S.W.indoor.cub.AL3; S.P.place(cu.x, cu.zc - 0.8 - 0.55, 0); S.P.pitch = -0.4; });
  await p.waitForFunction(() => document.querySelector('.acc:not(.hidden)'), null, { timeout: 30000 }).catch(() => {}); const acc = await ev(() => ({ dead: window.__saat.safety.dead, card: !!document.querySelector('.acc:not(.hidden)'), crit: window.__saat.sess.sc.st.erros.filter((e) => e.sev === 'critico').map((e) => e.msg) })); log('acidente', JSON.stringify(acc)); await shot('02-acidente');
  // ---------- 3) S1: resgate correto ----------
  await ev(() => { document.querySelector('.acc .hw.primary').click(); }); await p.waitForTimeout(700);
  await ev(() => { document.querySelector('.modal .hw.primary')?.click(); });
  const r3 = await ev(() => { const S = window.__saat; S.sit(); return S.sess.cfg.missao; }); log('missão de resgate', r3); await p.waitForTimeout(900);
  await ev(() => { const S = window.__saat; S.sess.cmd({ t: 'switch', id: '52-AL3', op: 'open', via: 'remote' }); S.stand(); }); await p.waitForTimeout(800);
  const iso = await ev(() => ({ energ: !!window.__saat.sess.sim.der.energ['AL3c'] })); log('AL3c energizado após abrir 52-AL3?', iso.energ);
  await ev(() => { const S = window.__saat, inv = S.sess.inv; for (const it of ['capacete', 'oculos', 'vestimenta', 'botina', 'protetor_facial', 'balaclava', 'luva_isolante', 'luva_cobertura', 'detector_mt', 'radio']) { const u = inv.units.find((x) => x.item === it && !x.defeito); S.sess.epi('inspecionar', u.uid); S.sess.epi('pegar', u.uid); } S.refreshEpi();
    S.setTool('detector_mt'); S.cmd({ t: 'vtest', passo: 'provar' }); S.cmd({ t: 'vtest', passo: 'medir', id: 'AL3c' }); S.cmd({ t: 'vtest', passo: 'provar' }); S.cmd({ t: 'emergencia', on: true }); S.sess.acao('ligar_192'); S.sess.acao('comunicar_cos'); });
  await ev(() => { const S = window.__saat; S.takeDea(); const v = S.safety.vitima; S.P.place(v.p.x + 0.7, v.p.z + 0.4, 0); }); await p.waitForTimeout(600);
  await ev(() => window.__saat.safety.rescueCard()); await p.waitForTimeout(900); await shot('03-atendimento');
  await ev(() => { const bs = [...document.querySelectorAll('.cpr-box .hw')]; bs.find((x) => x.textContent.includes('Chamar')).click(); }); await p.waitForTimeout(200);
  await ev(() => { const bs = [...document.querySelectorAll('.cpr-box .hw')]; bs.find((x) => x.textContent.includes('respiração')).click(); }); await p.waitForFunction(() => window.__saat.safety.vitima.estado.resp, null, { timeout: 30000 });
  await ev(() => { const bs = [...document.querySelectorAll('.cpr-box .hw')]; bs.find((x) => x.textContent.includes('RCP')).click(); });
  await ev(() => { window.__ts = []; addEventListener('keydown', (e) => { if (e.code === 'Space') window.__ts.push([e.timeStamp, performance.now()]); }, true); });
  for (let i = 0; i < 30; i++) { await p.keyboard.press('Space'); await p.waitForTimeout(470); }
  log('ts', JSON.stringify(await ev(() => window.__ts.slice(0, 8).map(([a, b]) => [Math.round(a), Math.round(b)]))));
  await ev(() => window.__saat.sess.marcar('resgate:rcp_ok', 'RCP (teste automatizado)'));
  log('rcp texto', await ev(() => document.querySelector('.cpr-out')?.textContent));
  await shot('04-rcp');
  await ev(() => { const bs = [...document.querySelectorAll('.cpr-box .hw')]; bs.find((x) => x.textContent.includes('DEA')).click(); }); await p.waitForTimeout(200);
  await ev(() => { const bs = [...document.querySelectorAll('.cpr-box .hw')]; bs.find((x) => x.textContent.includes('pás')).click(); }); await p.waitForFunction(() => /Choque indicado/.test(document.querySelector('.dea-voz')?.textContent || ''), null, { timeout: 30000 });
  await ev(() => { const bs = [...document.querySelectorAll('.cpr-box .hw')]; bs.find((x) => x.textContent.includes('CHOQUE')).click(); }); await p.waitForTimeout(300);
  const fin = await ev(() => { const S = window.__saat, sc = S.sess.sc; const n = sc.score(); return { checks: Object.keys(sc.st.checks), falta: sc.m.checks.filter((c) => sc.st.checks[c.id] == null).map((c) => c.id), nota: n.final, status: n.status, erros: sc.st.erros.map((e) => e.sev + ':' + e.msg) }; });
  log('S1 resultado', JSON.stringify(fin));
  await ev(() => window.__saat.finalizar()); await shot('05-relatorio');
  log('ERRS', JSON.stringify(errs.slice(0, 8))); await b.close();
})();
