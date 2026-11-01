// SAAT — aplicação de jogo: tela inicial (modos), sessão, mundo 3D em 1ª pessoa, mãos/ferramentas/tablet,
// interação por E, supervisório na mesa (com CFTV), consequências, resgate, instrutor e relatórios.
import './fonts.css';
import { Vector3, PerspectiveCamera } from 'three';
import { defaultDomain, validateDomain, upgradeDomain, type Domain } from '../data';
import { Session, type SessionCfg } from '../scenario/session';
import { Engine, type Quality } from './engine';
import { GameWorld } from './world';
import { Player } from './player';
import { Hands, quadTransform, TOOL_NAMES } from './hands';
import { Hud } from './hud';
import { Audio } from './audio';
import { Interaction } from './interact';
import { Safety, rcpQualidade } from './safety';
import { Tablet } from './tablet';
import { plantMap } from './map';
import { ic } from './icons';
import { mountHome } from './home';
import { scada, type Trend } from '../ui/scada';
import { createAssistant } from '../assist/assistant';
import { preverManobra } from '../assist/preview';
import { h, fmt, mmss, download, LS } from '../ui/dom';
import { WebAudioAlarm } from '../io/alarm';
import { PostMessageTransport, LoopbackTransport, type Transport } from '../instructor/link';
import { mountConsole } from '../instructor/console';
import { runAcceptance } from '../qa/acceptance';
import { reportHTML } from '../ui/report';
import { osDoc } from '../ui/os';
import * as TR from '../train/trainees';
import type { Cmd } from '../core/sim';
import type { Ctx } from '../ui/panels';
import { GFX, detectLite, presetLambert, SmallCull, AutoBatch } from './gfx';
import { XRLayer } from '../xr/session';
import { estadoBoneco, desenharBoneco, type Boneco } from '../ui/boneco';
import { VERSION } from '../version';

const $ = (s: string) => document.querySelector(s) as HTMLElement;

export async function bootGame() {
  await Promise.all(['600 12px "Barlow Condensed"', '700 12px "Barlow Condensed"', '800 12px "Barlow Condensed"', '500 12px "IBM Plex Mono"', '600 12px "IBM Plex Mono"', '400 12px Barlow', '500 12px Barlow', '600 12px Barlow'].map((f) => document.fonts.load(f).catch(() => null)));
  let d: Domain = loadDomain();
  const canvas = h('canvas', { id: 'gl' }) as HTMLCanvasElement; document.body.append(canvas);
  const loading = h('div', { class: 'boot' }, h('b', {}, 'SAAT'), h('span', {}, 'Montando a subestação…')); document.body.append(loading);
  await new Promise((r) => setTimeout(r, 30));
  GFX.lite = detectLite(); const E = new Engine(canvas); const W = new GameWorld(E, d); if (GFX.lite) presetLambert(E.scene, true); const autoBatch = GFX.lite ? new AutoBatch().build(W.zones) : null; const cull = new SmallCull(E.scene); const P = new Player(E.cam, canvas, () => W.colliders());
  const hands = new Hands(); hands.setEnv(E.envOut); const hud = new Hud(); const audio = new Audio(); const alarm = new WebAudioAlarm(null);
  const visor = h('div', { id: 'visor', class: 'hidden' }); const pipFrame = h('div', { class: 'pip hidden' }, h('span', {})); document.body.append(visor, pipFrame);
  (alarm as any).flashEl = hud.flashEl;
  const q0 = GFX.lite ? 'baixo' : (LS.get('qual', 'medio') as Quality); E.setQuality(q0); E.auto = GFX.lite ? false : LS.get('qualAuto', true);
  loading.remove();

  let sess: Session | null = null, tool: string | null = null, deaTaken = false, seated = false, paused = false, onHome = true, minimap = false;
  let trend: Trend[] = [], lastTrendT = -1, agendados: any[] = [], tr: Transport | null = null, conWin: Window | null = null, lastLogSent = 0, diag: any = { postMessage: 'não testado' };
  const rearOpen: Record<string, boolean> = {};
  const pip = { on: false, until: 0, cam: new PerspectiveCamera(40, 1.6, 0.05, 300), xray: false, caption: '', zone: 'patio' }; let pipMute = false;

  // ---------- comandos do treinando ----------
  function cmd(c: Cmd, quiet = false) {
    if (!sess) return null; alarm.unlock(); audio.unlock(); const r = sess.cmd(c, 'treinando'); avisos();
    if (r.result === 'ok') { if (!quiet) hud.toast(r.msg, r.noop ? 'muted' : 'ok', 2800); audio.play(c.t === 'rack' ? 'rack' : c.t === 'switch' && sess.sim.defs[c.id]?.type === 'CBR' && c.via !== 'remote' ? 'cbr' : c.t === 'switch' && sess.sim.defs[c.id]?.kind === 'earthing' ? 'earth' : ''); return r; }
    hud.toast(r.msg, r.result === 'falha' ? 'warn' : 'bad', 6000); return r;
  }
  const avisos = () => { if (!sess) return; while (sess.avisos.length) hud.toast(sess.avisos.shift()!, 'warn', 6000); };
  const ctx = (): Ctx => ({ view: () => sess!.sim.view(), sim: sess!.sim, d, sc: sess!.sc, cmd: (c) => { cmd(c); }, acao: (id) => { sess!.acao(id); avisos(); }, decidir: (i, o) => sess!.decidir(i, o), relatar: (i) => sess!.relatar(i),
    tem: (f) => !!sess?.sc && sess.sc.st.flags[f] != null, mesa: () => seated || livre(), ficha: (id) => openFicha(id), goTo: livre() ? (id) => { goToEq(id); return true; } : undefined, previa: (c) => preverManobra(d, sess!.sim, c), trend: () => trend, sess });
  const livre = () => !!sess?.cfg.sandbox;
  // ---------- faltas de conduta (correr dentro da SE) ----------
  let faltas = 0, runT = 0, runFlag = false;
  function registrarFalta(msg: string) { if (!sess) return; faltas++; hud.toast(`FALTA: ${msg}. Na subestação, ande sempre.`, 'bad', 5000); audio.click(); sess.erroJogo('menor', 'seguranca', `Falta de conduta: ${msg}`, 'falta:correr'); }
  function correndo(on: boolean, dt: number) { if (!sess || onHome || W.areaAt(P.pos.x, P.pos.z) === 'externo') on = false; if (on) { runT += dt; if (runT > 0.8 && !runFlag) { runFlag = true; registrarFalta('correu dentro da subestação'); } } else { runT = 0; runFlag = false; } }
  // ---------- boneco de EPI ----------
  const bonecoCv = h('canvas', { class: 'h-boneco', width: 200, height: 380 }) as HTMLCanvasElement; hud.root.append(bonecoCv);
  function exigidosAgora(): string[] { if (!sess) return []; const ep = d.epi, mid = sess.cfg.missao; const tasks: string[] = (mid ? ep.missao?.[mid] || [] : ['manobra_local_mt']).filter((t: string) => t !== 'patio' && t !== 'bateria');
    const ids = tasks.flatMap((t) => ep.tarefas?.[t]?.epi || []); const area = W.areaAt(P.pos.x, P.pos.z); if (area === 'patio') ids.push(...(ep.tarefas?.patio?.epi || [])); if (area === 'bateria') ids.push(...(ep.tarefas?.bateria?.epi || [])); return ids; }
  function boneco(): Boneco | null { if (!sess) return null; const inv = sess.inv; return estadoBoneco(exigidosAgora(), (id) => inv.tem(id), (id) => inv.nome(id)); }

  // ---------- assistente, mapa e tablet ----------
  const assist = createAssistant({ d, sim: () => sess?.sim || null, goTo: (id) => { if (!livre()) { hud.toast('Ir até: só na prática livre. Use o mapa.', 'muted'); return false; } return goToEq(id); }, ficha: (id) => openFicha(id), scada: () => { hud.toast('O supervisório fica na mesa de operação da casa de comando.', 'muted'); }, sessaoAtiva: () => !!sess });
  const map = plantMap(d.plant, (px, py) => { if (!livre()) return; const [x, z] = W.P(px, py); P.place(x, z, P.yaw); tablet.hide(); hands.setMode(tool ? 'tool' : 'none'); P.lock(); });
  const mini = plantMap(d.plant); const miniEl = h('div', { class: 'minimap hidden' }, mini.svg as any); document.body.append(miniEl);
  const tablet = new Tablet({ d, sess: () => sess, ctx, toast: (m, k) => hud.toast(m, k), assistEl: assist.el, assistAsk: assist.ask, map, mapPos: () => W.plantPos(P.pos, P.yaw), livre, finish: () => { sess?.finish('encerrada pelo treinando'); }, refreshEpi, readback: (id) => { sess?.readback(id); hud.toast(`Read-back da ordem ${id} registrado.`, 'ok'); } });
  function toggleTablet(app?: string) {
    if (!sess || safety.dead) return; if (tablet.open && !app) { tablet.hide(); hands.setMode(tool ? 'tool' : 'none'); if (!inter.insp && !seated) P.lock(); return; }
    if (inter.insp) inter.exit(); tablet.show(app); hands.setMode('tablet'); P.unlock(); P.lookEnabled = false; P.speedMul = 0.45;
  }
  function openFicha(id: string) { if (!sess) return; if (inter.insp) inter.exit(); toggleTablet('fichas'); setTimeout(() => { const inp = tablet.el.querySelector('.tb-fichas input') as HTMLInputElement; if (inp) { inp.value = id; inp.dispatchEvent(new Event('input')); (tablet.el.querySelector('.tb-li') as HTMLElement)?.click(); } }, 30); }

  // ---------- ferramentas e EPI ----------
  function carried() { if (!sess) return []; const out: { item: string; n: number }[] = []; const seen = new Set<string>(); for (const u of sess.inv.comigo()) { const cat = sess.inv.def(u.item).cat || ''; if (cat.startsWith('EPI') || seen.has(u.item)) continue; seen.add(u.item); out.push({ item: u.item, n: u.n }); } if (deaTaken) out.push({ item: 'dea', n: 1 }); return out; }
  function setTool(id: string | null) { tool = id; hands.setTool(id); hands.setMode(tablet.open ? 'tablet' : id ? 'tool' : 'none'); refreshEpi(); }
  function refreshEpi() {
    if (!sess) return; const inv = sess.inv, items = inv.comigo().filter((u) => (inv.def(u.item).cat || '').startsWith('EPI')).map((u) => ({ id: u.item, nome: inv.nome(u.item), ok: !u.defeito || !u.inspecionado }));
    const area = W.areaAt(P.pos.x, P.pos.z), tar = area === 'patio' ? 'patio' : area === 'bateria' ? 'bateria' : null; const falt = tar && sess.exigeEpi() ? inv.faltando(tar).epi.map((i) => inv.nome(i)) : [];
    for (const cb of Object.values<any>(W.indoor.cabinets)) for (const [uid, g] of Object.entries<any>(cb.items)) { const u = inv.unit(uid); if (u) g.visible = !(u.comigo || u.descartado); }
    hud.setEpi(items, falt); { const b = boneco(); if (b) desenharBoneco(bonecoCv.getContext('2d')!, 200, 380, b, sess.cfg.missao || 'Prática livre'); } const sl = carried(); if (tool && !sl.some((s) => s.item === tool)) { tool = null; hands.setTool(null); } hud.setHotbar(sl, tool);
    hands.setGear({ isolante: inv.tem('luva_isolante'), cobertura: inv.tem('luva_cobertura'), pvc: inv.tem('luva_pvc'), fr: inv.tem('vestimenta') }); visor.classList.toggle('hidden', !inv.tem('protetor_facial'));
  }
  function takeDea() { if (!sess) return; deaTaken = !deaTaken; if (W.indoor.dea) W.indoor.dea.visible = !deaTaken; if (deaTaken) { setTool('dea'); hud.toast('DEA na mão. Leve até a vítima.', 'ok'); sess.marcar('dea_pego', 'Pegou o DEA'); } else { if (tool === 'dea') setTool(null); hud.toast('DEA devolvido.', 'muted'); } refreshEpi(); }

  // ---------- supervisório na mesa (com CFTV) ----------
  const mon = h('div', { class: 'mon hidden' }); document.body.append(mon); let monPanel: any = null; const cftv = h('div', { class: 'cftv' }, h('span', {}, 'CFTV · sem evento')); const opsLog = h('div', { class: 'mon-ops' });
  function sit() {
    if (!sess) return; seated = true; P.unlock(); P.goView(W.indoor.deskSeat.pos, W.indoor.deskSeat.look, 0.6); hud.setPrompt(null); hud.show(false);
    setTimeout(() => { if (!seated || !sess) return; monPanel = scada(ctx()); mon.innerHTML = ''; mon.append(h('div', { class: 'mon-bezel' }, h('div', { class: 'mon-top' }, h('b', {}, 'Estação de operação · SE Vale Verde'), h('span', { class: 'muted' }, 'Esc ou botão para levantar'), h('button', { class: 'hw sm', onclick: stand }, ic('LogOut', 15), ' Levantar')), h('div', { class: 'mon-row' }, monPanel.el, h('aside', { class: 'mon-side' }, h('h5', {}, 'CFTV do pátio'), cftv, h('h5', {}, 'Seus comandos'), opsLog)))); mon.classList.remove('hidden'); monPanel.update(sess.sim.view()); }, 620);
  }
  function stand() { if (!seated) return; seated = false; mon.classList.add('hidden'); monPanel = null; pip.on = false; hud.show(true); P.leaveView(0.4); setTimeout(() => P.lock(), 50); }
  // PiP: toda manobra (local ou remota) aparece numa câmera fixa sobre o equipamento — no canto (PC), no CFTV da mesa ou num painel no VR
  W.onOp = (o) => { if (pipMute || !sess) return; pip.on = true; pip.until = performance.now() + (o.kind === 'dis' ? 6500 : 4500); pip.xray = !!o.xray; pip.zone = (o as any).zone || 'patio'; pip.cam.position.copy(o.cam); pip.cam.lookAt(o.look); pip.caption = o.caption;
    (cftv.firstElementChild as HTMLElement).textContent = 'CFTV · ' + o.caption; (pipFrame.firstElementChild as HTMLElement).textContent = 'CFTV · ' + o.caption;
    if (xr.active) { pip.cam.aspect = 16 / 9; pip.cam.updateProjectionMatrix(); xr.showPip(o.caption, pip.until); } audio.play(o.kind); };

  // ---------- interação, segurança ----------
  const app: any = { W, P, E, hands, hud, tablet, d, get sess() { return sess; }, get tool() { return tool; }, cmd, ctx, setTool, sit, sfx: audio, audio, livre, openFicha, refreshEpi, rearOpen, get deaTaken() { return deaTaken; }, takeDea,
    restart: () => sess && start(sess.cfg), home: () => showHome(false), startRescue: (k: string) => startRescue(k), finalizar: () => finalizar() };
  const inter = new Interaction(app); const safety = new Safety(app); app.safety = safety;
  // ---------- VR ----------
  const xr = new XRLayer({ E, W, P, inter, hud, safety, audio, livre, area: () => W.areaAt(P.pos.x, P.pos.z), faltas: () => faltas, boneco, correndo,
    acc: { restart: () => { if (sess) start(sess.cfg); }, rescue: (a: any) => startRescue(a?.tipo === 'passo' ? 'S2' : 'S1'), report: () => { xr.exit(); setTimeout(() => finalizar(), 400); }, home: () => showHome(false) },
    sess: () => sess, cmd: (c: any) => cmd(c), tool: () => tool, toolName: () => (tool ? (TOOL_NAMES as any)[tool] || tool : 'mãos livres'), setTool, usarFerramenta: () => useTool(), refreshEpi, toast: (m: string, k?: string) => hud.toast(m, k as any),
    dead: () => safety.dead, ctx: () => (sess ? ctx() : null), readback: () => { const o = sess?.sc?.st.cos.find((x: any) => x.readbackReq && !x.readback); if (!o || !sess) return null; sess.readback(o.id); return `Read-back ${o.id}: "${o.texto.replace(/^COS[^:]*:\s*/, '').slice(0, 90)}"`; },
    conferirEpi: () => { if (!sess) return '—'; const x = sess.conferirEpi(); refreshEpi(); return x.txt; }, rcpQualidade,
    alturaPerfil: () => { const id = sess?.cfg.treinandoId; return (id && TR.obter(id)?.alturaCm) || null; }, salvarAltura: (cm: number) => { const id = sess?.cfg.treinandoId, t = id ? TR.obter(id) : null; if (t) TR.salvar({ ...t, alturaCm: cm }); },
    gear: () => { const inv = sess?.inv; return { isolante: !!inv?.tem('luva_isolante'), cobertura: !!inv?.tem('luva_cobertura'), pvc: !!inv?.tem('luva_pvc'), fr: !!inv?.tem('vestimenta') }; },
    missao: () => { const sc = sess?.sc; if (!sc) return { codigo: 'PRÁTICA LIVRE', titulo: 'Explore e opere à vontade', passo: '' }; const nx = sess!.nivel?.roteiro ? sc.m.checks.find((c: any) => sc.st.checks[c.id] == null) : null; return { codigo: `${sc.m.id} · ${sess!.nivel?.nome || ''}`, titulo: sc.m.nome, passo: nx ? nx.label : '' }; },
    pausar: () => { if (!sess) return false; sess.paused = !sess.paused; return sess.paused; },
    onStart: () => { closeModal(); if (seated) stand(); if (inter.insp) inter.exit(); tablet.hide(); paused = false; pauseEl.classList.add('hidden'); if (sess) sess.paused = false; hud.show(false); vrFloat.classList.add('hidden'); audio.unlock(); alarm.unlock(); },
    onEnd: () => { if (sess && !onHome) { hud.show(true); hud.toast('Você saiu do VR. Relatório do VR em Configurações › Relatório do VR.', 'muted', 6000); } refreshVrUi(); } }, VERSION);
  app.xr = xr;
  const vrFloat = h('button', { class: 'vr-float hidden', onclick: () => { audio.unlock(); alarm.unlock(); void xr.enter(); } }, ic('Headset', 20), ' Entrar em VR'); document.body.append(vrFloat);
  function refreshVrUi() { vrFloat.classList.toggle('hidden', !xr.supported || xr.active || onHome || !sess); }
  xr.listeners.add(refreshVrUi);
  function vrReport() { const ta = h('textarea', { class: 'json', readonly: true, spellcheck: 'false' }) as HTMLTextAreaElement; const upd = () => { ta.value = xr.report(); }; upd(); const msg = h('span', { class: 'muted' });
    modal('Relatório do VR — ' + VERSION, h('div', {}, h('p', { class: 'muted' }, 'Marque os itens no menu do VR (aba Checklist). Aqui você copia ou baixa o texto para enviar.'), ta,
      h('div', { class: 'row' }, h('button', { class: 'hw primary', onclick: async () => { upd(); try { await navigator.clipboard.writeText(ta.value); msg.textContent = 'Copiado'; } catch { ta.select(); document.execCommand('copy'); msg.textContent = 'Copiado'; } setTimeout(() => (msg.textContent = ''), 1500); } }, ic('ClipboardCheck', 15), ' Copiar'),
        h('button', { class: 'hw', onclick: () => { upd(); const dd = new Date(), pd = (n: number) => String(n).padStart(2, '0'); download(`relatorio-vr-${dd.getFullYear()}${pd(dd.getMonth() + 1)}${pd(dd.getDate())}-${pd(dd.getHours())}${pd(dd.getMinutes())}.txt`, ta.value, 'text/plain'); } }, ic('Download', 15), ' Baixar .txt'),
        h('button', { class: 'hw ghost', onclick: upd }, ic('RotateCcw', 15), ' Atualizar'), h('button', { class: 'hw ghost', onclick: () => { if (confirm('Apagar o checklist do VR salvo neste aparelho?')) { xr.check.clear(); upd(); } } }, ic('Trash2', 15), ' Limpar'), msg)), true); }

  // ---------- teclado ----------
  addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement; if (t?.closest?.('input,textarea,select')) { if (e.key === 'Escape') (t as HTMLInputElement).blur(); return; }
    if (onHome || !sess || xr.active) return; const k = e.code;
    if (k === 'Escape') { if (document.querySelector('.modal')) { closeModal(); return; } if (seated) { stand(); return; } if (inter.insp) { inter.exit(); return; } if (tablet.open) { toggleTablet(); return; } togglePause(); return; }
    if (paused || safety.dead) return;
    if (k === 'Tab') { e.preventDefault(); toggleTablet(); return; }
    if (seated) return;
    if (k === 'KeyE') { inter.use(); return; }
    if (k === 'KeyM') { minimap = !minimap; miniEl.classList.toggle('hidden', !minimap); return; }
    if (k === 'KeyH') { toggleTablet('assist'); return; }
    if (k === 'KeyR') { const p = sess.sc?.st.cos.find((o: any) => o.readbackReq && !o.readback); if (p) { sess.readback(p.id); hud.toast(`Read-back da ordem ${p.id}: "${p.texto.replace(/^COS[^:]*:\s*/, '').slice(0, 80)}…"`, 'ok', 5000); } else hud.toast('Nenhuma ordem aguardando read-back.', 'muted'); return; }
    if (k === 'KeyQ') { setTool(null); return; }
    if (k === 'KeyF') { useTool(); return; }
    if (k === 'KeyZ' && livre()) { W.zonesOn = !W.zonesOn; W.update(sess.sim.view(), sess.sc?.st.flags || {}); hud.toast(W.zonesOn ? 'Zonas NR-10 visíveis (vermelho = risco, amarelo = controlada).' : 'Zonas ocultas.', 'muted'); return; }
    const n = /^Digit([1-9])$/.exec(k); if (n) { const sl = carried()[+n[1] - 1]; if (sl) setTool(tool === sl.item ? null : sl.item); return; }
  });
  addEventListener('wheel', (e) => { if (onHome || !sess || tablet.open || inter.insp || seated) return; const sl = carried(); if (!sl.length) return; const i = sl.findIndex((s) => s.item === tool); const j = (i + (e.deltaY > 0 ? 1 : -1) + sl.length + 1) % (sl.length + 1); setTool(j === sl.length ? null : sl[j].item); }, { passive: true });
  canvas.addEventListener('click', () => { if (!onHome && sess && !paused && !inter.insp && !tablet.open && !seated && !safety.dead) { P.lock(); audio.unlock(); alarm.unlock(); } });
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && sess && !onHome && !xr.active && !inter.insp && !tablet.open && !seated && !safety.dead && !paused && !P.view) setTimeout(() => { if (!document.pointerLockElement && !inter.insp && !tablet.open && !seated) togglePause(true); }, 120); });
  function useTool() {
    if (!sess || !tool) { hud.toast('Mãos livres. Escolha uma ferramenta (1–9).', 'muted'); return; } hands.use();
    if (tool.startsWith('detector')) { const r = cmd({ t: 'vtest', passo: 'provar' }); hands.ledOn(r?.result === 'ok'); setTimeout(() => hands.ledOn(false), 1200); return; }
    if (tool === 'radio') { if (xr.active) hud.toast('Rádio: ordens do COS aparecem na legenda; read-back no menu (aba Missão).', 'muted'); else toggleTablet('radio'); return; }
    hud.toast('Use a ferramenta na peça certa: mire o equipamento, E para inspecionar e clique na peça.', 'muted');
  }
  // ---------- pausa ----------
  const pauseEl = h('div', { class: 'pausem hidden' }); document.body.append(pauseEl);
  function togglePause(force?: boolean) {
    paused = force ?? !paused; pauseEl.classList.toggle('hidden', !paused); if (sess && !sess.cfg.sandbox) sess.paused = paused; if (!paused) { P.lock(); return; }
    pauseEl.innerHTML = ''; pauseEl.append(h('div', { class: 'pbox' }, h('small', {}, sess?.sc ? `${sess.sc.m.id} · pausado` : 'Prática livre · pausado'), h('h2', {}, 'Pausa'),
      h('button', { class: 'hw primary', onclick: () => togglePause(false) }, ic('Play', 16), ' Continuar'),
      h('button', { class: 'hw', onclick: () => { togglePause(false); toggleTablet('tarefa'); } }, ic('ClipboardList', 16), ' Tablet (tarefa)'),
      h('button', { class: 'hw', onclick: () => { paused = false; pauseEl.classList.add('hidden'); if (sess) start(sess.cfg); } }, ic('RotateCcw', 16), ' Reiniciar'),
      sess?.sc ? h('button', { class: 'hw', onclick: () => { if (confirm('Encerrar e gerar o relatório?')) { paused = false; pauseEl.classList.add('hidden'); sess!.finish('encerrada pelo treinando'); } } }, ic('FileText', 16), ' Encerrar e ver relatório') : null,
      h('button', { class: 'hw', onclick: openInstructor }, ic('Users', 16), ' Console do instrutor'),
      h('button', { class: 'hw ghost', onclick: () => { paused = false; pauseEl.classList.add('hidden'); showHome(true); } }, ic('LogOut', 16), ' Menu inicial'),
      h('p', { class: 'muted keys' }, 'WASD/setas andar · mouse olhar · E interagir · Tab tablet · 1–9 ferramenta · F usar · Q guardar · R read-back · M minimapa · C pés juntos')));
  }

  // ---------- modal genérico ----------
  function modal(title: string, body: HTMLElement, wide = false) { closeModal(); const ov = h('div', { class: 'modal' }, h('div', { class: 'mwin' + (wide ? ' wide' : '') }, h('header', {}, h('b', {}, title), h('button', { class: 'icard-x', onclick: closeModal }, ic('X', 18))), h('div', { class: 'mbody' }, body))); document.body.append(ov); return ov; }
  function closeModal() { document.querySelectorAll('.modal').forEach((m) => m.remove()); }

  // ---------- sessão ----------
  function resetWorld() {
    for (const dd of W.indoor.doors) { dd.tgt = 0; } W.yard.gates.forEach((g) => (g.tgt = 0)); for (const cb of Object.values(W.yard.cabs)) cb.tgt = 0; xr.reset(); for (const k of Object.keys(rearOpen)) delete rearOpen[k]; for (const cu of Object.values<any>(W.indoor.cub)) cu.rearT = 0;
    for (const cb of Object.values(W.indoor.cabinets)) { cb.tgt = cb === W.indoor.cabinets.LOTO ? 1 : 0; for (const g of Object.values(cb.items)) g.visible = true; } deaTaken = false; if (W.indoor.dea) W.indoor.dea.visible = true;
    safety.reset(); W.zonesOn = false; P.fall = 0; P.roll = 0; P.shake = 0; P.enabled = true; P.lookEnabled = true; P.speedMul = 1; hud.fade(false, 200); pip.on = false;
  }
  function start(cfg: SessionCfg) {
    closeModal(); if (seated) stand(); if (inter.insp) inter.exit(); tablet.hide(); resetWorld(); agendados = []; trend = []; lastTrendT = -1; alarm.deactivate(); LS.set('cfg', cfg);
    sess = new Session(d, cfg); (W as any).sim = sess.sim; onHome = false; faltas = 0; runT = 0; runFlag = false; $('#home')?.classList.add('hidden'); hud.show(true);
    sess.sim.onEvent = (n, x) => { if (n === 'ALARM' && x.sev >= 2) alarm.activate('alarme'); if (n === 'ACK') alarm.deactivate('alarme'); if (n === 'ALARM_EMERGENCY') x.on ? alarm.activate('emergencia') : alarm.deactivate('emergencia');
      if (n === 'FOGO') hud.toast('Fumaça e chamas no pátio!', 'bad', 6000); if (n === 'ARCO') safety.onArc(x.id); };
    const prevLog = sess.sim.onLog; sess.sim.onLog = (e) => { prevLog?.(e); if (e.kind === 'com' && e.actor !== 'treinando') { const rb = sess?.sc?.st.cos.find((o: any) => o.texto === e.msg && o.readbackReq); hud.say(e.actor, e.msg, rb ? rb.id : undefined); audio.radio(e.msg); } };
    if (sess.sc) sess.sc.onFinish = () => setTimeout(() => finalizar(), 300);
    sess.start(); setTool(null);
    const m = sess.sc?.m; const sp = W.spawns[['C1', 'C2', 'E1'].includes(cfg.missao || '') ? 'scada' : m?.cena?.caido ? 'portao' : 'casa'] || W.spawns.casa; P.place(sp.x, sp.z, sp.yaw); if (xr.active) xr.loco.placeHead(sp.x, sp.z, sp.yaw);
    { const tt = cfg.treinandoId ? TR.obter(cfg.treinandoId) : null; P.eye = tt?.alturaCm ? Math.round(tt.alturaCm * 0.936) / 100 : 1.65; }
    safety.setupScene(m); pipMute = true; W.update(sess.sim.view(), sess.sc?.st.flags || {}); pipMute = false; pip.on = false; refreshEpi();
    audio.start(Object.values(W.yard.trf).map((t: any) => t.center)); audio.unlock();
    if (tr) { lastLogSent = 0; tr.send({ type: 'hello', domain: d, cfg: sess.cfg, mission: sess.sc?.m || null }); }
    // briefing (OS em papel) — clique inicia e prende o mouse
    if (m && xr.active) { const o = d.os.ordens[m.id]; hud.toast(`${m.id}: ${m.nome}. ${o?.semAPR ? 'Atendimento de ocorrência: aja com segurança.' : 'EPI nos armários; APR/PT no PC.'}`, 'muted', 7000); }
    else if (m) { sess.paused = true; const o = d.os.ordens[m.id];
      const b = h('div', { class: 'brief' }, osDoc(d, sess), h('div', { class: 'brief-keys' }, h('b', {}, 'Controles'), h('p', {}, h('kbd', {}, 'W A S D'), ' andar  ', h('kbd', {}, 'Mouse'), ' olhar  ', h('kbd', {}, 'E'), ' interagir  ', h('kbd', {}, 'Tab'), ' tablet  ', h('kbd', {}, '1–9'), ' ferramenta  ', h('kbd', {}, 'F'), ' usar  ', h('kbd', {}, 'Esc'), ' pausa')),
        h('div', { class: 'row' }, h('button', { class: 'hw primary', onclick: () => { closeModal(); sess!.paused = false; P.lock(); audio.unlock(); alarm.unlock(); hud.toast(o?.semAPR ? 'Atendimento de ocorrência: aja com segurança.' : 'Você está na casa de comando. APR no tablet (Tab) e EPI nos armários.', 'muted', 6000); } }, ic('Play', 16), ' Iniciar'), xr.supported ? h('button', { class: 'hw vr', onclick: () => { audio.unlock(); alarm.unlock(); void xr.enter(); } }, ic('Headset', 16), ' Iniciar em VR') : null));
      modal(`${o?.tipo || 'Ordem de serviço'} — ${m.id}`, b, true); }
    else { if (!xr.active) refreshVrUi(); hud.toast('Prática livre: tudo liberado. Z mostra as zonas NR-10; no tablet, o mapa leva você a qualquer ponto.', 'muted', 7000); P.lock(); }
  }
  function startRescue(kind: string) { if (!sess) return; const cur = sess.cfg; start({ ...cur, missao: kind, sandbox: false, nivel: undefined }); }
  function finalizar() {
    if (!sess?.sc) return; if (sess.sc.st.fim == null) { sess.finish('encerrada pelo treinando'); if (sess.sc.st.fim != null) return; } if (seated) stand(); if (inter.insp) inter.exit(); tablet.hide(); P.unlock(); const rep = sess.report(); const n = rep.nota;
    if (sess.cfg.treinandoId) TR.addResultado(sess.cfg.treinandoId, { id: 'R' + Date.now().toString(36), data: new Date().toISOString(), missao: rep.missao.id, missaoNome: rep.missao.nome, nivel: sess.nivel?.nome || (sess.cfg as any).modoTreino || '—', perfil: rep.perfil, modo: rep.modo,
      nota: n.final, status: n.status, aprovado: n.status === 'APROVADO', comps: n.comps, criticos: n.criticos, erros: rep.erros.map((e: any) => ({ sev: e.sev, msg: e.msg, comp: e.comp })), duracaoS: n.elapsed, dicas: rep.dicas.length, semente: rep.semente, faltas, vr: xr.active });
    const html = reportHTML(rep); LS.set('ultimoRelatorio', { missao: rep.missao, nota: rep.nota }); tr?.send({ type: 'report', rep });
    modal(`Relatório — ${rep.missao.id}: ${n.status} (${fmt(n.final, 1)} %)`, h('div', {}, h('div', { class: 'row' }, h('button', { class: 'hw', onclick: () => download(`relatorio-${rep.missao.id}.html`, html, 'text/html') }, ic('Download', 15), ' HTML'), h('button', { class: 'hw', onclick: () => download(`sessao-${rep.missao.id}.json`, JSON.stringify(sess!.exportJSON())) }, ic('Download', 15), ' Sessão (replay)'),
      h('button', { class: 'hw', onclick: () => sess && start(sess.cfg) }, ic('RotateCcw', 15), ' Repetir'), h('button', { class: 'hw primary', onclick: () => { closeModal(); showHome(false); } }, 'Menu inicial')),
      sess.cfg.treinandoId ? h('p', { class: 'muted' }, 'Resultado salvo no histórico do treinando.') : h('p', { class: 'muted' }, 'Sessão de visitante: não salva.'), h('iframe', { class: 'repframe', srcdoc: html })), true);
  }
  function goToEq(id: string) { const r = W.yard.dis[id] || W.yard.cbr[id]; if (r) { P.place(r.cx + 2, r.cz + 5, 0.3); return true; } const bay = id.replace(/^(52|43|89T)-/, ''); const cu = W.indoor.cub[bay]; if (cu) { P.place(cu.x, cu.zf + 1.8, 0); return true; } const t = W.yard.trf[id]; if (t) { P.place(t.center.x - 1, t.center.z + 7.5, 0); return true; } return false; }

  // ---------- tela inicial (com a SE ao fundo) ----------
  const homeEl = h('div', { id: 'home' }); document.body.append(homeEl);
  function showHome(inGame: boolean) {
    onHome = true; vrFloat.classList.add('hidden'); if (xr.active) xr.exit(); if (sess && !sess.cfg.sandbox) sess.paused = true; P.unlock(); hud.show(false); tablet.hide(); if (seated) stand(); if (inter.insp) inter.exit(); closeModal();
    homeEl.classList.remove('hidden');
    mountHome(homeEl, { d: () => d, start: (c) => { audio.unlock(); alarm.unlock(); homeEl.classList.add('hidden'); start(c); }, resume: inGame && sess ? () => { homeEl.classList.add('hidden'); onHome = false; hud.show(true); if (sess && !sess.cfg.sandbox) sess.paused = false; P.lock(); } : undefined,
      teste: testeFuncoes, dados: dadosJSON, diag: diagnostico, modal, toast: (m, k) => hud.toast(m, k as any), quality: (q, auto) => { E.setQuality(q); E.auto = auto; LS.set('qual', q); LS.set('qualAuto', auto); }, instrutor: openInstructor, audio: (v, voz) => { audio.vol = v; audio.voz = voz; }, vr: { status: () => ({ ok: xr.supported, motivo: xr.reason }), entrar: (c) => { audio.unlock(); alarm.unlock(); const p = xr.enter(); homeEl.classList.add('hidden'); start(c); return p; }, relatorio: vrReport, versao: VERSION, listen: (f: () => void) => xr.listeners.add(f) } });
    refreshVrUi();
  }

  // ---------- instrutor ----------
  function openInstructor() {
    if (!sess) { hud.toast('Inicie uma sessão para abrir o console.', 'muted'); return; } if (conWin && !conWin.closed) { conWin.focus(); return; }
    try { conWin = window.open(location.href.split('#')[0] + '#instrutor', 'saat-instrutor', 'width=1400,height=900'); } catch { conWin = null; }
    if (conWin) { tr?.close(); tr = new PostMessageTransport(() => conWin); wire(tr); diag.postMessage = 'janela aberta, aguardando'; return; }
    const [a, b] = LoopbackTransport.pair(); tr?.close(); tr = a; wire(tr); diag.postMessage = 'pop-up bloqueado: console acoplado';
    const dock = h('div', { class: 'docked' }); const bar = h('div', { class: 'dbar' }, h('b', {}, 'Console do instrutor (acoplado)'), h('button', { class: 'icard-x', onclick: () => dock.classList.toggle('min') }, '▁'), h('button', { class: 'icard-x', onclick: () => dock.remove() }, ic('X', 16)));
    const root = h('div'); dock.append(bar, root); document.body.append(dock); mountConsole(root, b);
  }
  function wire(t: Transport) {
    t.onMessage((m) => { if (!sess) return;
      if (m.type === 'ready') { diag.postMessage = `OK (${t.kind})`; lastLogSent = 0; t.send({ type: 'hello', domain: d, cfg: sess.cfg, mission: sess.sc?.m || null }); hud.toast('Console do instrutor conectado.', 'ok'); }
      if (m.type === 'input') { if (m.k === 'dica') { const txt = (sess as any).dica(m.a[0]); hud.toast(`Instrutor (dica N${m.a[0]}): ${txt}`, 'warn', 9000); return; } (sess as any)[m.k](...m.a); }
      if (m.type === 'ctl') { if (m.op === 'pause') sess.paused = true; if (m.op === 'resume') sess.paused = false; if (m.op === 'speed') sess.speed = m.v; if (m.op === 'restart') start(sess.cfg); if (m.op === 'agendar') agendados.push({ ...m, feito: false });
        if (m.op === 'report') t.send({ type: 'report', rep: sess.report() }); if (m.op === 'inputs') t.send({ type: 'inputs', cfg: sess.cfg, inputs: sess.inputs, checkpoints: sess.checkpoints }); } });
  }
  function broadcast() {
    if (!tr || !sess) return; const log = sess.sim.log.filter((e) => e.seq > lastLogSent); if (log.length) lastLogSent = log[log.length - 1].seq; const sc = sess.sc;
    const area = W.areaAt(P.pos.x, P.pos.z); const pl = W.plantPos(P.pos, P.yaw);
    tr.send({ type: 'state', v: sess.sim.view(), sc: sc ? { st: sc.st, score: sc.score() } : null, log, paused: sess.paused, speed: sess.speed, checkpoints: sess.checkpoints.map((c) => ({ id: c.id, t: c.t })), agendados,
      player: { px: pl.px, py: pl.py, yaw: P.yaw, area, tool, alvo: inter.insp?.label || inter.target?.label || '', sentado: seated, tablet: tablet.open, acidente: safety.acc ? safety.acc.causa : null, epi: sess.inv.comigo().filter((u) => (sess!.inv.def(u.item).cat || '').startsWith('EPI')).map((u) => sess!.inv.nome(u.item)) } });
  }

  // ---------- teste de funções, dados, diagnóstico ----------
  function testeFuncoes() { const out = h('div'); const run = () => { const t0 = performance.now(); const res = runAcceptance(() => JSON.parse(JSON.stringify(d))); const ok = res.filter((x) => x.pass).length; out.innerHTML = '';
      out.append(h('p', {}, h('b', {}, `${ok}/${res.length} aprovados`), ` em ${fmt(performance.now() - t0)} ms`), h('table', { class: 'mtab' }, h('tr', {}, h('th', {}, ''), h('th', {}, 'Teste'), h('th', {}, 'Esperado'), h('th', {}, 'Obtido')), ...res.map((x) => h('tr', { class: x.pass ? 'pass' : 'fail' }, h('td', {}, x.pass ? '✓' : '✗'), h('td', {}, `${x.id} ${x.nome}`), h('td', {}, x.esperado), h('td', {}, x.obtido))))); };
    modal('Teste de funções', h('div', {}, h('p', { class: 'muted' }, 'Critérios de aceite do anexo e sequências corretas das missões, rodados contra uma cópia nova do simulador.'), h('div', { class: 'row' }, h('button', { class: 'hw primary', onclick: run }, 'Executar'), h('button', { class: 'hw ghost', onclick: () => { alarm.unlock(); alarm.activate('emergencia'); setTimeout(() => alarm.deactivate('emergencia'), 2500); } }, 'Testar sirene')), out), true); }
  function dadosJSON() {
    const ta = h('textarea', { class: 'json', spellcheck: 'false' }) as HTMLTextAreaElement; ta.value = JSON.stringify(d, null, 1); const msg = h('p');
    modal('Dados do domínio (JSON)', h('div', {}, h('p', { class: 'muted' }, 'Topologia, planta, intertravamentos, proteções, perfis NR-10, missões, níveis, EPI, OS/APR, FMEA, base de conhecimento e parâmetros [VALIDAR].'), ta, msg,
      h('div', { class: 'row' }, h('button', { class: 'hw primary', onclick: () => { try { const nd = upgradeDomain(JSON.parse(ta.value)); const e = validateDomain(nd); if (e.length) { msg.textContent = 'Erros: ' + e.join('; '); return; } d = nd; LS.set('domain', d); msg.textContent = 'Salvo. Recarregue a página para aplicar no 3D.'; } catch (er: any) { msg.textContent = 'JSON inválido: ' + er.message; } } }, 'Validar e salvar'),
        h('button', { class: 'hw ghost', onclick: () => download('saat-dominio.json', ta.value) }, 'Exportar'), h('button', { class: 'hw ghost', onclick: () => { d = defaultDomain(); try { localStorage.removeItem('saat:domain'); } catch { /* */ } ta.value = JSON.stringify(d, null, 1); msg.textContent = 'Padrão restaurado.'; } }, 'Restaurar padrão'))), true); }
  function diagnostico() {
    const gl = E.renderer.getContext(); const dbg = gl.getExtension('WEBGL_debug_renderer_info'); let ls = 'falhou'; try { localStorage.setItem('saat:probe', '1'); ls = 'OK'; localStorage.removeItem('saat:probe'); } catch (e: any) { ls = 'bloqueado: ' + e.name; }
    const rows: [string, string][] = [['Placa de vídeo (WebGL)', String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'disponível')], ['FPS atual', fmt(E.fps, 0)], ['Qualidade', E.quality + (E.auto ? ' (automática)' : '')], ['Draw calls', String(E.renderer.info.render.calls)], ['Protocolo', location.protocol], ['localStorage', ls], ['Console do instrutor', diag.postMessage], ['Treinandos', String(TR.listar().length)], ['Navegador', navigator.userAgent]];
    modal('Diagnóstico', h('div', {}, h('table', { class: 'mtab' }, ...rows.map(([a, b]) => h('tr', {}, h('td', {}, a), h('td', {}, b)))), h('p', { class: 'muted' }, 'Abaixo de 30 FPS no pátio, use qualidade Baixa.'))); }

  // ---------- laço ----------
  let acc = 0, lastT = performance.now(), slow = 0, bc = 0, autosave = 0, hudT = 0, orbit = 0;
  const camW = new Vector3();
  function loop(now: number) {
    const dt = Math.max(0, Math.min(0.1, (now - lastT) / 1000)); lastT = now;
    if (sess && !onHome) {
      if (!sess.paused) { acc += dt * 1000 * sess.speed; let n = 0; while (acc >= 100 && n++ < 100) { sess.tick(); acc -= 100;
        for (const a of agendados) if (!a.feito && sess.sim.s.t >= a.at) { a.feito = true; (sess as any)[a.input.k](...a.input.a); }
        const ts = Math.floor(sess.sim.s.t / 1000); if (ts !== lastTrendT) { lastTrendT = ts; const v = sess.sim; trend.push({ t: ts, v1: v.der.barras['MT-1'].kV, v2: v.der.barras['MT-2'].kV, m1: v.der.tr.T1.mva, m2: v.der.tr.T2.mva, o1: v.s.tr.T1.oleo, o2: v.s.tr.T2.oleo, vcc: v.s.cc.v }); if (trend.length > 600) trend.shift(); } } }
      slow += dt; bc += dt; autosave += dt; hudT += dt;
      if (slow >= 0.1) { slow = 0; const v = sess.sim.view(); W.update(v, sess.sc?.st.flags || {}); if (monPanel) { monPanel.update(v); const L = sess.sim.log.filter((e: any) => e.kind === 'cmd' && e.actor === 'treinando').slice(-7).reverse(); const sg = L.map((e: any) => e.seq).join(','); if ((opsLog as any)._s !== sg) { (opsLog as any)._s = sg; opsLog.innerHTML = ''; for (const e of L) opsLog.append(h('div', { class: e.result && e.result !== 'ok' ? 'bad' : '' }, h('small', {}, mmss(e.t)), ' ', e.msg)); } } }
      if (xr.active) xr.update(dt); else { P.update(dt); correndo(!!(P.keys.ShiftLeft || P.keys.ShiftRight) && P.moving > 0.5, dt); } if (!xr.active) inter.update(); safety.update(dt); if (sess.cfg.missao === 'T0') tutorial();
      if (hudT >= 0.2) { hudT = 0; updateHUD(); tablet.tick(); inter.tick(); if (minimap) mini.update(W.plantPos(P.pos, P.yaw)); }
      if (bc >= 0.25) { bc = 0; broadcast(); }
      if (autosave >= 10) { autosave = 0; LS.set('autosave', { cfg: sess.cfg, inputs: sess.inputs.slice(-2000) }); }
    } else { orbit += dt * 0.04; const [fx1, fz1, fx2, fz2] = W.fenceRect; const cx = (fx1 + fx2) / 2, cz = (fz1 + fz2) / 2; E.cam.position.set(cx + Math.sin(orbit) * 62, 24, cz + Math.cos(orbit) * 62); E.cam.lookAt(cx, 2, cz + 6); }
    E.cam.getWorldPosition(camW); const area = W.areaAt(camW.x, camW.z); E.setIndoor(!onHome && (area === 'casa' || area === 'bateria')); hands.setEnv(E.indoor ? E.envIn : E.envOut); cull.update(dt, camW, GFX.lite || xr.active); autoBatch?.sync();
    W.frame(dt, onHome ? E.cam.position : P.pos, onHome ? 'externo' : area, false);
    E.follow(onHome ? new Vector3(27, 0, 38) : P.pos);
    const w = canvas.clientWidth || innerWidth, hgt = canvas.clientHeight || innerHeight;
    if (!xr.active) hands.update(dt, P.moving, P.bob, w / hgt);
    if (xr.active && pip.on && performance.now() < pip.until) { pip.cam.layers.mask = E.cam.layers.mask; xr.pip.render(E.renderer, E.scene, pip.cam, () => { W.frame(0, P.pos, area, pip.xray); if (pip.zone === 'casa') W.zones.casa.visible = true; }, () => W.frame(0, P.pos, area, false)); }
    const pipOn = pip.on && performance.now() < pip.until && !xr.active && !onHome; if (pip.on && performance.now() >= pip.until) pip.on = false; pipFrame.classList.toggle('hidden', !pipOn || seated);
    E.render(dt, () => {
      if (pipOn) { const r = (seated ? cftv : pipFrame).getBoundingClientRect(), R = E.renderer; if (r.width > 10) {
          W.frame(0, P.pos, area, pip.xray); if (pip.zone === 'casa') W.zones.casa.visible = true; pip.cam.layers.mask = E.cam.layers.mask; pip.cam.aspect = r.width / r.height; pip.cam.updateProjectionMatrix();
          R.setScissorTest(true); const y = hgt - r.bottom; R.setScissor(r.left, y, r.width, r.height); R.setViewport(r.left, y, r.width, r.height); R.render(E.scene, pip.cam); R.setScissorTest(false); R.setViewport(0, 0, w, hgt); W.frame(0, P.pos, area, false); } }
      if (!onHome) hands.render(E.renderer);
    });
    if (tablet.open && !xr.active) tablet.setTransform(quadTransform(tablet.W, tablet.H, hands.screenCorners(w, hgt)));
    if (!onHome && sess) audio.listen(camW, P.yaw, E.indoor, Object.keys(W.yard.trf).map((T) => !!sess!.sim.der.tr[T]?.energ));
  }
  function tutorial() {
    if (!sess?.sc) return; const f = sess.sc.st.flags, mk = (k: string, msg: string) => { if (f[k] == null) { sess!.marcar(k, msg); audio.click(); hud.toast('Feito: ' + msg, 'ok', 2500); } };
    const arm = W.inter.find((i) => i.id === 'arm:EPI'); if (arm && arm.hit.position.distanceTo(new Vector3(P.pos.x, arm.hit.position.y, P.pos.z)) < 2.4) mk('tut:perto', 'chegou ao armário');
    if (inter.insp?.kind === 'arm' || xr.card.t?.kind === 'arm') mk('tut:armario', 'armário aberto'); if (sess.inv.units.some((u) => u.inspecionado)) mk('tut:inspecao', 'item inspecionado'); if (sess.inv.tem('capacete')) mk('tut:capacete', 'capacete vestido');
    if (tablet.open || (xr.active && xr.menu.mode)) mk('tut:tablet', 'tablet aberto'); if (tool) mk('tut:ferramenta', 'ferramenta na mão'); if (inter.lastPart) mk('tut:peca', 'peça acionada'); if (seated || xr.scada.open) mk('tut:scada', 'sentou na mesa');
  }
  function updateHUD() {
    if (!sess) return; const v = sess.sim.view(), s = v.s, sc = sess.sc; const al = v.ccOk ? s.alarmes.filter((a: any) => a.ativo) : [];
    hud.setStatus(mmss(s.t) + (sess.paused ? ' ‖' : sess.speed !== 1 ? ` ×${sess.speed}` : ''), al.length, al.filter((a: any) => !a.ack).length);
    if (sc) { let step = ''; if (sess.nivel?.roteiro) { const nx = sc.m.checks.find((c: any) => sc.st.checks[c.id] == null); step = nx ? nx.label : 'Todos os critérios cumpridos — encerre no tablet.'; } hud.setObjective(`${sc.m.id} · ${sess.nivel?.nome || (sc.m.nivel === 'E' ? 'Emergência' : '')}`, sc.m.nome, step); }
    else hud.setObjective('PRÁTICA LIVRE', 'Explore e opere à vontade', '');
    const a = W.areaAt(P.pos.x, P.pos.z); if (a !== (updateHUD as any).area) { (updateHUD as any).area = a; sess.area(a); avisos(); refreshEpi(); }
  }
  P.onStep = () => audio.step(W.areaAt(P.pos.x, P.pos.z));
  showHome(false); E.renderer.setAnimationLoop(loop);
  (window as any).saatVR = xr; (window as any).__saat = { xr, get faltas() { return faltas; }, boneco, get sess() { return sess; }, rearOpen, W, P, E, hands, hud, tablet, inter, safety, start, cmd, setTool, sit, stand, finalizar, showHome, togglePause, toggleTablet, openFicha, refreshEpi, takeDea, d: () => d, get seated() { return seated; }, get tool() { return tool; } };
}

export function bootConsoleWindow() {
  document.title = 'Console do instrutor — SAAT';
  if (!window.opener) { document.body.append(h('div', { class: 'center' }, h('h2', {}, 'Console do instrutor'), h('p', {}, 'Abra o console pela pausa (Esc) do simulador.'))); return; }
  mountConsole(document.body, new PostMessageTransport(() => window.opener));
}
function loadDomain(): Domain { const saved = LS.get('domain'); if (saved) { const u = upgradeDomain(saved); if (!validateDomain(u).length) return u; } return defaultDomain(); }
