// Pré-visualização do mundo (ciclo de captura): #preview — câmera controlada por window.__pv.
import './fonts.css';
import { Engine } from './engine';
import { GameWorld } from './world';
import { Player } from './player';
import { defaultDomain } from '../data';
import { Sim } from '../core/sim';
import { GFX, detectLite, presetLambert, SmallCull, AutoBatch } from './gfx';
export async function bootPreview() {
  await Promise.all(['600 12px "Barlow Condensed"', '700 12px "Barlow Condensed"', '800 12px "Barlow Condensed"', '500 12px "IBM Plex Mono"', '600 12px "IBM Plex Mono"', '400 12px Barlow', '600 12px Barlow'].map((f) => document.fonts.load(f)));
  const cv = document.createElement('canvas'); cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh'; document.body.style.margin = '0'; document.body.append(cv);
  GFX.lite = detectLite(); const d = defaultDomain(); const E = new Engine(cv); const t0 = performance.now(); const W = new GameWorld(E, d); const sim = new Sim(d, 1); (W as any).sim = sim; W.update(sim.view(), {});
  const P = new Player(E.cam, cv, () => W.colliders()); E.setQuality(GFX.lite ? 'baixo' : ((location.hash.split(':')[1] as any) || 'medio')); E.auto = false; if (GFX.lite) presetLambert(E.scene, true); const ab = GFX.lite ? new AutoBatch().build(W.zones) : null; const cull = new SmallCull(E.scene);
  const s = W.spawns.casa; P.place(s.x, s.z, s.yaw);
  let last = performance.now(); let frames = 0;
  const loop = (now: number) => { const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now; P.update(dt); const area = W.areaAt(P.pos.x, P.pos.z); E.setIndoor(area === 'casa' || area === 'bateria'); W.frame(dt, P.pos, area); cull.update(dt, E.cam.position, GFX.lite); ab?.sync(); E.follow(P.pos); E.render(dt); frames++; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  (window as any).__pv = { E, W, P, sim, buildMs: performance.now() - t0, frames: () => frames,
    cam(x: number, y: number, z: number, lx: number, ly: number, lz: number) { P.view = { pos: { clone: () => 0 } as any, look: 0 as any, t: 1, dur: 1, from: 0 as any, back: false } as any; P.view = null; P.pos.set(x, 0, z); E.cam.position.set(x, y, z); E.cam.lookAt(lx, ly, lz); P.enabled = false; (P as any).update = () => {}; W.frame(0.016, E.cam.position, W.areaAt(x, z)); E.setIndoor(['casa', 'bateria'].includes(W.areaAt(x, z))); },
    spawn(k: string) { const sp = W.spawns[k]; P.place(sp.x, sp.z, sp.yaw); } };
}
