// Clima e horário: céu, sol, luz do céu, neblina, exposição, chuva (traços em volta da câmera), relâmpago e trovão,
// iluminação do pátio à noite (luminárias acesas + manchas de luz no chão) e a lanterna (holofote único, criado uma vez
// só quando escurece: não recompila shaders a cada uso). Só altera a cena; regras de jogo ficam no app.
import { BufferAttribute, BufferGeometry, Color, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, AdditiveBlending, CircleGeometry, SpotLight, Object3D, Vector3, type FogExp2, type MeshStandardMaterial } from 'three';
import type { Engine } from './engine';
import { GFX } from './gfx';

export type Clima = 'sol' | 'nublado' | 'chuva' | 'tempestade';
export type Hora = 'dia' | 'entardecer' | 'noite';
export const CLIMAS: [Clima, string][] = [['sol', 'Sol'], ['nublado', 'Nublado'], ['chuva', 'Chuva'], ['tempestade', 'Tempestade']];
export const HORAS: [Hora, string][] = [['dia', 'Dia'], ['entardecer', 'Entardecer'], ['noite', 'Noite']];
type P = { top: number; mid: number; bot: number; sunAmt: number; sunCol: number; sunI: number; hSky: number; hGnd: number; hI: number; fog: number; fogD: number; expo: number; env: number; lamps: number };
const BASE: Record<Hora, P> = {
  dia: { top: 0x5d8fc4, mid: 0xa9c4dc, bot: 0xd4dbe0, sunAmt: 1, sunCol: 0xfff1dc, sunI: 2.5, hSky: 0xdfe9f2, hGnd: 0x6b6253, hI: 0.75, fog: 0xc6d3dc, fogD: 0.0028, expo: 0.92, env: 1, lamps: 0 },
  entardecer: { top: 0x34507e, mid: 0xe09a66, bot: 0xb98a6e, sunAmt: 0.9, sunCol: 0xffae6b, sunI: 1.4, hSky: 0xf1c49b, hGnd: 0x4a3f35, hI: 0.5, fog: 0xd39a76, fogD: 0.0042, expo: 1.0, env: 0.55, lamps: 1 },
  noite: { top: 0x03050b, mid: 0x0b1222, bot: 0x080b12, sunAmt: 0, sunCol: 0x8fa6d6, sunI: 0.06, hSky: 0x34425f, hGnd: 0x0a0a0a, hI: 0.075, fog: 0x06080e, fogD: 0.012, expo: 0.98, env: 0.04, lamps: 1 },
};
const GREY: Record<Hora, [number, number, number]> = { dia: [0x8f979f, 0xaeb4ba, 0xbfc4c8], entardecer: [0x5f5d63, 0x857d79, 0x8a8682], noite: [0x07090e, 0x0c0f15, 0x0a0c10] };
const NUV: Record<Clima, number> = { sol: 0, nublado: 0.65, chuva: 0.85, tempestade: 0.95 };
const _c = new Color(), _d = new Color(), _v = new Vector3();
const mix = (a: number, b: number, k: number) => _c.setHex(a).lerp(_d.setHex(b), k).getHex();

export class Ambiente {
  clima: Clima = 'sol'; hora: Hora = 'dia'; rain: LineSegments; private pos: Float32Array; private N: number; private flash = 0; private nextBolt = 20; private p: P = { ...BASE.dia };
  lanterna: SpotLight | null = null; private alvo = new Object3D(); private pools: Mesh[] = []; onBolt: ((dist: number) => void) | null = null;
  constructor(private E: Engine, private lamps: Mesh[], scene: Object3D) {
    this.N = GFX.lite ? 900 : 1600; this.pos = new Float32Array(this.N * 6);
    const g = new BufferGeometry(); g.setAttribute('position', new BufferAttribute(this.pos, 3));
    this.rain = new LineSegments(g, new LineBasicMaterial({ color: 0xb8c2cc, transparent: true, opacity: 0.32, depthWrite: false, fog: true })); this.rain.frustumCulled = false; this.rain.visible = false; this.rain.userData.noPreset = true; scene.add(this.rain);
    for (let i = 0; i < this.N; i++) this.seed(i, new Vector3(), true);
    const pm = new MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.16, blending: AdditiveBlending, depthWrite: false, fog: true }), pg = new CircleGeometry(6.5, 28); pg.rotateX(-Math.PI / 2);
    for (const l of lamps) { l.updateWorldMatrix(true, false); l.getWorldPosition(_v); const m = new Mesh(pg, pm); m.position.set(_v.x, 0.03, _v.z); m.visible = false; m.userData.noPreset = true; m.renderOrder = 2; scene.add(m); this.pools.push(m); }
    scene.add(this.alvo);
  }
  private seed(i: number, c: Vector3, any = false) { const o = i * 6, x = c.x + (Math.random() - 0.5) * 28, z = c.z + (Math.random() - 0.5) * 28, y = any ? c.y + (Math.random() - 0.3) * 16 : c.y + 9 + Math.random() * 3; this.pos[o] = x; this.pos[o + 1] = y; this.pos[o + 2] = z; this.pos[o + 3] = x - 0.08; this.pos[o + 4] = y - 0.45; this.pos[o + 5] = z; }
  get escuro() { return this.hora === 'noite' || (this.hora === 'entardecer' && this.clima !== 'sol'); }
  get chovendo() { return this.clima === 'chuva' || this.clima === 'tempestade'; }
  set(clima: Clima, hora: Hora) {
    this.clima = clima; this.hora = hora; const b = BASE[hora], k = NUV[clima], g = GREY[hora], E = this.E;
    const p: P = { ...b, top: mix(b.top, g[0], k), mid: mix(b.mid, g[1], k), bot: mix(b.bot, g[2], k), sunAmt: b.sunAmt * (1 - k), sunI: b.sunI * (1 - 0.85 * k), hI: b.hI * [1, 1.1, 0.85, 0.6][['sol', 'nublado', 'chuva', 'tempestade'].indexOf(clima)],
      fog: mix(b.fog, g[1], k * 0.8), fogD: b.fogD + [0, 0.003, 0.009, 0.014][['sol', 'nublado', 'chuva', 'tempestade'].indexOf(clima)], expo: b.expo * [1, 1.02, 0.97, 0.93][['sol', 'nublado', 'chuva', 'tempestade'].indexOf(clima)], env: b.env * (1 - 0.6 * k), lamps: b.lamps || (k > 0.8 && hora !== 'dia' ? 1 : 0) };
    this.p = p; const u = (E.sky.material as any).uniforms; u.top.value.setHex(p.top); u.mid.value.setHex(p.mid); u.bot.value.setHex(p.bot); u.sunAmt.value = p.sunAmt;
    E.sun.color.setHex(p.sunCol); E.sun.intensity = p.sunI; E.hemi.color.setHex(p.hSky); E.hemi.groundColor.setHex(p.hGnd);
    const f = E.scene.fog as FogExp2; f.color.setHex(p.fog); f.density = p.fogD; E.setOutdoor({ env: p.env, hemi: p.hI, expo: p.expo });
    for (const l of this.lamps) { const m = l.material as MeshStandardMaterial; if (m.emissive) { m.emissive.setHex(p.lamps ? 0xffe2b0 : 0x000000); m.emissiveIntensity = p.lamps ? 3 : 0; } }
    for (const m of this.pools) m.visible = !!p.lamps; (this.rain.material as LineBasicMaterial).opacity = clima === 'tempestade' ? 0.45 : 0.32;
    if (this.escuro && !this.lanterna) { this.lanterna = new SpotLight(0xfff4e0, 0, 28, 0.42, 0.55, 1.2); this.lanterna.target = this.alvo; this.E.scene.add(this.lanterna); }
    this.nextBolt = 8 + Math.random() * 12;
  }
  /** Lanterna: posição e direção (mundo); null = apagada. */
  luz(o: Vector3 | null, dir?: Vector3) { const L = this.lanterna; if (!L) return; if (!o || !dir) { L.intensity = 0; return; } L.position.copy(o); this.alvo.position.copy(o).addScaledVector(dir, 6); L.intensity = 38; }
  update(dt: number, cam: Vector3, fora: boolean, audio: any) {
    const chuva = this.chovendo && fora; this.rain.visible = chuva; audio?.chuva?.(this.chovendo ? (fora ? (this.clima === 'tempestade' ? 1 : 0.6) : 0.18) : 0);
    if (chuva) { const sp = (this.clima === 'tempestade' ? 11 : 8.5) * dt, wx = (this.clima === 'tempestade' ? 2.2 : 0.8) * dt, P = this.pos;
      for (let i = 0; i < this.N; i++) { const o = i * 6; P[o + 1] -= sp; P[o + 4] -= sp; P[o] += wx; P[o + 3] += wx; if (P[o + 4] < 0 || Math.abs(P[o] - cam.x) > 15 || Math.abs(P[o + 2] - cam.z) > 15) this.seed(i, cam); }
      this.rain.geometry.attributes.position.needsUpdate = true; }
    // relâmpago: clarão no céu e no ambiente; trovão com atraso pela distância
    if (this.clima === 'tempestade') { this.nextBolt -= dt; if (this.nextBolt <= 0) { this.nextBolt = 14 + Math.random() * 22; this.flash = 0.22; const dist = 0.4 + Math.random() * 3; setTimeout(() => audio?.trovao?.(1 / (1 + dist * 0.4)), dist * 1000); this.onBolt?.(dist); } }
    if (this.flash > 0 || (this as any)._fl) { this.flash = Math.max(0, this.flash - dt); const k = this.flash > 0.12 || (this.flash > 0 && this.flash < 0.06) ? 1 : 0; (this as any)._fl = this.flash > 0;
      const u = (this.E.sky.material as any).uniforms; u.top.value.setHex(k ? 0xc9d3ff : this.p.top); u.mid.value.setHex(k ? 0xe6ebff : this.p.mid); if (!this.E.indoor) this.E.hemi.intensity = k ? 2.6 : this.p.hI; }
  }
}
