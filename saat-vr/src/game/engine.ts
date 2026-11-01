// Renderização: tom ACES, céu em gradiente com sol, ambiente PMREM (externo/interno), sombra que segue o jogador,
// pós-processamento por predefinição (Baixo/Médio/Alto) e ajuste automático pelo FPS.
import { GFX } from './gfx';
import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, FogExp2, HemisphereLight, DirectionalLight, Vector3, Mesh, SphereGeometry, ShaderMaterial, BackSide,
  ACESFilmicToneMapping, SRGBColorSpace, PCFSoftShadowMap, PMREMGenerator, Vector2, type Texture,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';

export type Quality = 'baixo' | 'medio' | 'alto';
export const SUN_DIR = new Vector3(-0.45, 0.78, 0.43).normalize();

const VignetteShader = {
  uniforms: { tDiffuse: { value: null }, amount: { value: 0.18 }, tint: { value: new Color(0, 0, 0) }, tintAmt: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float amount; uniform vec3 tint; uniform float tintAmt; varying vec2 vUv;
    void main(){ vec4 c=texture2D(tDiffuse,vUv); vec2 d=vUv-0.5; float v=smoothstep(0.35,0.85,length(d*vec2(1.15,1.0)));
      c.rgb*=1.0-v*amount; c.rgb=mix(c.rgb,tint,v*tintAmt); gl_FragColor=c; }`,
};

export class Engine {
  renderer: WebGLRenderer; scene = new Scene(); cam = new PerspectiveCamera(70, 1, 0.05, 900);
  sun: DirectionalLight; hemi: HemisphereLight; quality: Quality = 'medio'; auto = true;
  composer: EffectComposer | null = null; private bloom: UnrealBloomPass | null = null; private gtao: GTAOPass | null = null; vignette: ShaderPass | null = null;
  envOut: Texture; envIn: Texture; indoor = false; fps = 60; private fc = 0; private ft = 0; private autoT = 0; private lowStreak = 0;
  extraPasses: ((r: WebGLRenderer) => void)[] = [];
  sky: Mesh;

  constructor(public canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: GFX.lite, // Quest: MSAA 4× no framebuffer do XR (barato em GPU de blocos); PC usa SMAA no composer
       powerPreference: 'high-performance', stencil: false });
    const R = this.renderer; R.outputColorSpace = SRGBColorSpace; R.toneMapping = ACESFilmicToneMapping; R.toneMappingExposure = 0.92;
    R.shadowMap.enabled = true; R.shadowMap.type = PCFSoftShadowMap;
    this.scene.fog = new FogExp2(0xc6d3dc, 0.0028);
    this.hemi = new HemisphereLight(0xdfe9f2, 0x6b6253, 0.75); this.scene.add(this.hemi);
    this.sun = new DirectionalLight(0xfff1dc, 2.5); this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera; sc.left = -28; sc.right = 28; sc.top = 28; sc.bottom = -28; sc.near = 1; sc.far = 160; this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);
    this.sky = this.makeSky(); this.scene.add(this.sky);
    const pm = new PMREMGenerator(R);
    const skyScene = new Scene(); skyScene.add(this.makeSky(true)); this.envOut = pm.fromScene(skyScene, 0.02).texture;
    this.envIn = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
    this.scene.environment = this.envOut;
    addEventListener('resize', () => this.resize());
  }
  private makeSky(forEnv = false) {
    const m = new ShaderMaterial({ side: BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new Color(0x5d8fc4) }, mid: { value: new Color(0xa9c4dc) }, bot: { value: new Color(forEnv ? 0x6f6a60 : 0xd4dbe0) }, sun: { value: SUN_DIR.clone() } },
      vertexShader: 'varying vec3 vD; void main(){ vD=normalize(position); vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position=p.xyww; }',
      fragmentShader: `uniform vec3 top,mid,bot,sun; varying vec3 vD;
        void main(){ float h=vD.y; vec3 c = h>0.0 ? mix(mid,top,pow(h,0.55)) : mix(mid,bot,pow(-h,0.35));
          float s=max(dot(normalize(vD),sun),0.0); c+=vec3(1.0,0.93,0.8)*(pow(s,900.0)*8.0+pow(s,12.0)*0.18);
          c=mix(c,vec3(0.86,0.89,0.9),smoothstep(0.12,0.0,abs(h))*0.55); gl_FragColor=vec4(c,1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }` });
    const s = new Mesh(new SphereGeometry(forEnv ? 50 : 800, 32, 16), m); s.frustumCulled = false; s.renderOrder = -1; return s;
  }
  setQuality(q: Quality) {
    this.quality = q; const R = this.renderer;
    R.setPixelRatio(q === 'alto' ? Math.min(devicePixelRatio, 1.5) : q === 'medio' ? Math.min(devicePixelRatio, 1.15) : 1);
    R.shadowMap.enabled = q !== 'baixo'; this.sun.castShadow = q !== 'baixo'; const ms = q === 'alto' ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== ms) { this.sun.shadow.mapSize.set(ms, ms); this.sun.shadow.map?.dispose(); (this.sun.shadow as any).map = null; }
    this.scene.traverse((o: any) => { if (o.material) { const ms2 = Array.isArray(o.material) ? o.material : [o.material]; ms2.forEach((m: any) => (m.needsUpdate = true)); } });
    this.buildComposer(); this.resize();
  }
  private buildComposer() {
    this.composer?.dispose(); this.composer = null; this.bloom = null; this.gtao = null; this.vignette = null;
    if (this.quality === 'baixo') return;
    const c = new EffectComposer(this.renderer); c.addPass(new RenderPass(this.scene, this.cam));
    if (this.quality === 'alto') { this.gtao = new GTAOPass(this.scene, this.cam, 2, 2); (this.gtao as any).blendIntensity = 0.85; c.addPass(this.gtao); }
    this.bloom = new UnrealBloomPass(new Vector2(256, 256), 0.18, 0.35, 1.8); // r185: limiar 1,8 (só emissivo de LED/lâmpada); 0,92 lavava o interior c.addPass(this.bloom);
    for (const f of this.extraPasses) void f;
    c.addPass(new OutputPass());
    this.vignette = new ShaderPass(VignetteShader); c.addPass(this.vignette);
    if (this.quality === 'alto') c.addPass(new SMAAPass());
    else { /* FXAA leve via SMAA também: barato o suficiente */ c.addPass(new SMAAPass()); }
    this.composer = c;
  }
  resize() {
    if (this.renderer.xr.isPresenting) return;
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
    const pr = this.renderer.getPixelRatio(); this.composer?.setSize(w, h); this.composer?.setPixelRatio(pr);
  }
  /** Ajusta sombra para seguir o ponto (snap em texel evita tremulação). */
  follow(p: Vector3) {
    const step = 56 / this.sun.shadow.mapSize.x; const x = Math.round(p.x / step) * step, z = Math.round(p.z / step) * step;
    this.sun.target.position.set(x, 0, z); this.sun.position.set(x + SUN_DIR.x * 80, SUN_DIR.y * 80, z + SUN_DIR.z * 80); this.cam.getWorldPosition(this.sky.position);
  }
  setIndoor(v: boolean) {
    if (v === this.indoor) return; this.indoor = v; this.scene.environment = v ? this.envIn : this.envOut;
    this.scene.traverse((o: any) => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) if (m.isMeshStandardMaterial) { m.userData.env0 ??= m.envMapIntensity ?? 1; m.envMapIntensity = m.userData.env0 * (v ? 0.26 : 1); } });
    this.hemi.intensity = v ? 0.24 : 0.75; this.renderer.toneMappingExposure = v ? 0.74 : 0.92;
  }
  setVignette(amount: number, tint = 0x000000, tintAmt = 0) { if (!this.vignette) return; const u = this.vignette.uniforms as any; u.amount.value = amount; u.tint.value.setHex(tint); u.tintAmt.value = tintAmt; }
  /** VR: sem sombra e sem pós-processamento (não renderiza nos dois olhos). */
  xrMode(on: boolean) { if (on) { this.renderer.shadowMap.enabled = false; this.sun.castShadow = false; this.scene.traverse((o: any) => { if (o.material) for (const m of [].concat(o.material)) (m as any).needsUpdate = true; }); } else this.setQuality(this.quality); }
  render(dt: number, after?: () => void) {
    if (this.renderer.xr.isPresenting) { this.fc++; this.ft += dt; if (this.ft >= 1) { this.fps = this.fc / this.ft; this.fc = 0; this.ft = 0; } this.renderer.render(this.scene, this.cam); return; }
    this.fc++; this.ft += dt; if (this.ft >= 1) { this.fps = this.fc / this.ft; this.fc = 0; this.ft = 0; }
    if (this.auto) { this.autoT += dt; if (this.autoT > 2 && this.autoT < 14) { if (this.fps < 26) this.lowStreak++; else this.lowStreak = 0;
      if (this.lowStreak > 90 && this.quality !== 'baixo') { this.lowStreak = 0; this.setQuality(this.quality === 'alto' ? 'medio' : 'baixo'); } } }
    if (this.composer) this.composer.render(dt); else this.renderer.render(this.scene, this.cam);
    after?.();
  }
}
