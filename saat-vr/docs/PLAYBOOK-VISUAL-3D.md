# Playbook visual 3D — padrão SAAT ("realismo industrial limpo")

> **O que é este documento.** É a receita do visual, do 3D, da UI e da UX do SAAT (simulador de subestação 138/13,8 kV em Three.js, num único HTML offline), escrita para ser reaproveitada.
>
> Os valores vêm do **código que foi entregue** (`src/game/*.ts`, `src/ui/style.css`), não da bíblia v1. Onde a `docs/ESTILO.md` diverge do código, vale o código (ver §15).
>
> **Como usar num projeto novo:**
> 1. Cole o prompt da §16 no chat.
> 2. Anexe este arquivo.
> 3. Troque só a paleta do mundo (§4.1) e a sinalização (§4.2) pelo tema novo. O resto (luz, pipeline, UI, processo) vale para qualquer simulador ou cena industrial.

---

## 1. Por que ficou bonito: as 10 decisões que mais pesaram (em ordem)

1. **Luz e tom primeiro, modelo depois.**
   - ACES Filmic com exposição abaixo de 1.
   - Céu em gradiente com sol desenhado.
   - Ambiente PMREM **diferente por dentro e por fora**.
   - Sombra suave que segue o jogador.

   Um cubo cinza já parece "foto" com essa luz. Sem ela, nenhum modelo salva.
2. **Uma biblioteca única de materiais com valores do mundo real**: RAL dos painéis, porcelana marrom vidrada com clearcoat, aço galvanizado com "spangle". Nenhum modelo inventa cor.
3. **Textura com escala física.** A UV é recalculada em coordenadas de mundo (metros por repetição), então a brita tem o mesmo tamanho de pedra em toda parte e nunca estica.
4. **Silhueta certa e detalhe só onde a câmera chega.**
   - Isoladores torneados com saias alternadas e cabos com flecha.
   - Parafusos só em cubículos e caixas de comando.
5. **Texto nítido e sinalização real.**
   - Todas as legendas de uma face de painel ficam numa textura de canvas só.
   - As placas seguem NR-26 / ISO 7010.

   É isso que faz o painel parecer "fabricado", e não "gerado".
6. **Bloom só no que emite luz.** O limiar é alto (0,92) e o emissivo dos LEDs passa de 1, então só lâmpadas e LEDs brilham.
7. **UI escura e neutra com UM acento** (amarelo de segurança #F2C230), tipografia condensada industrial, sem emoji, sem vidro fosco, raio de 3 px.
8. **Diegese.** O tablet está nas mãos, o supervisório no monitor da mesa e o EPI aparece nas luvas. A UI "existe no mundo".
9. **Variação controlada.** Pedras com 7 tons, árvores em aglomerados irregulares com 5 verdes, base dos equipamentos mais escura. O olho lê "real" quando nada é idêntico.
10. **Ciclo de captura com câmeras fixas.** Captura → compara com a referência → corrige as 2 maiores lacunas, no máximo 2 rodadas por item. Sem isso, o visual regride a cada mudança.

---

## 2. Processo (ordem obrigatória)

```
GDD (o que é)  →  Bíblia de estilo (como parece)  →  1 exemplo-guia  →  ciclo de captura  →  pipeline (escala para o resto)
```

| Etapa | Entregável | Regra |
|---|---|---|
| GDD | `docs/GDD.md` | Pilares, modos, controles, o que NÃO entra |
| Bíblia | `docs/ESTILO.md` | Tabela de materiais, luz, presets, tokens de UI, regras de modelagem, áudio |
| Regras de sessão | `CLAUDE.md` | "Materiais só de `materials.ts`", "cores só pelos tokens", "sem emoji", "ciclo de captura" |
| Exemplo-guia | 1 equipamento completo (no SAAT, o cubículo AL1) | Serve de régua para todos os outros |
| Ciclo de captura | `e2e/shots.cjs` + rota `#preview` | Câmeras fixas, mesma resolução, folha de contato |
| Pipeline | `Batch` + `materials.ts` + `Print` | Todo modelo novo usa as mesmas peças |

### 2.1 Ciclo de captura (como foi feito)
- **Rota de pré-visualização** `index.html#preview:<qualidade>`:
  - sobe só o mundo, sem UI, e expõe `window.__pv.cam(x,y,z, lx,ly,lz)`;
  - o Playwright posiciona a câmera e tira o print.
- **10 câmeras fixas:** EQ-1, cubículo, mesa, sala de baterias, portão, bays, trafo, aérea, casa por fora, armários. O jogo inteiro é capturado em 13 passos (home → briefing → … → pausa).
- Headless: Chromium com `--use-gl=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`. **O FPS do headless não vale** (é CPU); serve só para a imagem.
- Junte os prints numa **folha de contato** (grade de miniaturas) e compare lado a lado com a foto de referência.
- Em cada rodada corrija **só as 2 maiores lacunas**. No máximo 2 rodadas por item; se ainda estiver ruim, peça outra referência ao usuário.
- Fixe `dt = Math.max(0, …)` no loop: um RAF com dt negativo fez portas "andarem sozinhas" nas capturas.

---

## 3. Direção de arte: princípios

1. **Legibilidade antes de efeito.** Chão calmo (baixo contraste), equipamento com silhueta clara, peça interativa destacada só quando mirada.
2. **Cor só com função.**
   - No 3D, a cor é a do mundo real.
   - Na UI, cor = estado ou alerta. O resto é cinza.
3. **Uma receita para tudo.** Mesma luz, mesmos materiais, mesma tipografia em todos os assets.
4. **Sem "cara de IA":**
   - sem emoji (ícones de traço Lucide);
   - sem gradiente decorativo nem vidro fosco (glassmorphism);
   - sem cantos de 12–16 px (use 3 px; cartões grandes até 6 px);
   - sem neon, sem roxo/azul "tech", sem sombra colorida;
   - sem texto explicando o óbvio, sem botão demais na tela;
   - sem títulos com "✨", sem cards todos iguais em grade só para encher.
5. **Dia claro, equipamento bem conservado, luz natural.** A referência é foto técnica de catálogo e de manutenção, não arte de jogo de ação.
6. **Sujeira discreta.** Bases mais escuras, oxidação leve no cobre, escorrido sob o radiador. Nunca grunge.

---

## 4. Cores

### 4.1 Mundo 3D: biblioteca de materiais (valores do código)
Todos são `MeshStandardMaterial`, exceto os marcados com (P) = `MeshPhysicalMaterial`. "Tile" = metros por repetição da textura (UV em mundo, §6.3).

| Material | Cor | Rugos. | Metal | Textura / extra | Tile |
|---|---|---|---|---|---|
| Brita | mapa (7 tons ~#62605C…#8C8882) | 0,97 | 0 | normal 1,1 | 1,6 m |
| Concreto | mapa base #9C988E | 0,92 | 0 | normal 0,7 (poros) | 2,0 m |
| Concreto claro (meio-fio) | mapa base #AAA69C | 0,90 | 0 | normal 0,5 | 1,5 m |
| Grama | mapa (#5A6E3C / seco #8A8659 / escuro #3F5230) | 1,0 | 0 | ruído em 3 escalas | 5–14 m |
| Asfalto | mapa ~#3E3E40 | 0,95 | 0 | — | 3 m |
| Piso epóxi | mapa #737A7E | mapa 0,35–0,63 | 0 | roughnessMap | 3,2 m |
| Parede de bloco (interna) | mapa #E3E0D8 | 0,88 | 0 | normal 0,6 (juntas) | 0,8 m |
| Parede externa | mapa #CFC6B4 | 0,90 | 0 | — | 0,8 m |
| Faixa de base da parede | #6D7175 | 0,85 | 0 | — | — |
| Forro | #E9E8E3 | 0,95 | 0 | — | — |
| Aço galvanizado | mapa #9FA6A9 (spangle) | 0,42 | 0,60 | envMapIntensity 0,9 | 0,6 m |
| Aço escuro | #4A4F53 | 0,55 | 0,50 | — | — |
| Alumínio | #C9CED1 | 0,30 | 0,88 | — | — |
| Alumínio fosco | #AEB3B5 | 0,50 | 0,70 | — | — |
| Cobre | #B06A3B | 0,42 | 0,90 | — | — |
| Cobre oxidado | #7E5A3A | 0,60 | 0,60 | — | — |
| **Porcelana marrom** (P) | #5B3022 | 0,24 | 0 | clearcoat 0,8 / ccRough 0,18 | — |
| Polimérico (silicone) | #7F878B | 0,62 | 0 | — | — |
| Trafo (Munsell N6.5) | #9EA3A1 | 0,55 | 0,15 | normal de pintura 0,25 | 0,5 m |
| Trafo escuro (flanges) | #80868A | 0,55 | 0,15 | — | — |
| Painel RAL 7035 | #C9CDC8 | 0,50 | 0,05 | normal de pintura 0,2 | 0,4 m |
| Painel RAL 7032 | #B5B3A4 | 0,55 | 0,05 | — | — |
| RAL 7016 (antracito) | #3B4146 | 0,50 | 0,10 | — | — |
| RAL 5010 (azul) | #1F4F8A | 0,45 | 0,05 | — | — |
| Preto | #18191B | 0,60 | 0 | — | — |
| Plástico | #2A2D30 | 0,45 | 0 | — | — |
| Borracha (tapete) | #1E1F21 | 0,82 | 0 | normal canelado | 0,25 m |
| Chapa xadrez | #8F9396 | 0,40 | 0,80 | normal de losangos | 0,5 m |
| Vidro claro (P) | #9FB4C0, opac. 0,25 | 0,05 | 0 | depthWrite false | — |
| Vidro escuro / visor (P) | #24323C, opac. 0,55 | 0,08 | 0 | depthWrite false | — |
| Vidro verde (P) | #3F6B5A, opac. 0,85 | 0,10 | 0 | clearcoat 1 | — |
| Amarelo (pintura) | #E0B21E | 0,50 | 0,05 | — | — |
| Vermelho | #B3262B | 0,45 | 0,05 | — | — |
| Verde | #1F7A45 | 0,45 | 0,05 | — | — |
| Azul | #1F5AA6 | 0,45 | 0,05 | — | — |
| Branco | #ECEAE4 | 0,50 | 0 | — | — |
| Creme | #DCD6C4 | 0,60 | 0 | — | — |
| Cabo (capa) | #1C1D1F | 0,55 | 0 | — | — |
| Condutor (CAA) | #B9BEC0 | 0,42 | 0,85 | — | — |
| Madeira | #8A6A48 | 0,75 | 0 | — | — |
| Cadeira / mesa | #24282C / #6F6A62 | 0,70 / 0,55 | 0 | — | — |
| Caixa de bateria (P) | #D9E2E4, opac. 0,55 | 0,15 | 0 | translúcida | — |
| Sílica gel | #D8862E | 0,80 | 0 | — | — |
| Alambrado | textura alpha (#B8BEC1) | 0,45 | 0,60 | alphaTest 0,35, DoubleSide | — |
| Painel LED (emissivo) | #FFFFFF / emissive #FFF6E6 × 2,2 | 0,50 | 0 | — | — |
| Tela desligada | #0B0D0F | 0,15 | 0,20 | — | — |
| Pele / roupa FR / capacete | #B98466 / #2A3A52 / #F2F2EE | 0,65 / 0,85 / 0,35 | 0 | — | — |

**Regras que fazem esses números funcionarem:**
- **Nada é preto puro nem branco puro.** O mais escuro é #18191B e o mais claro #ECEAE4.
- **Metais têm cor clara e rugosidade média** (0,3–0,45). Metal com rugosidade < 0,2 vira espelho e denuncia o CG.
- **Pintado industrial = metalness 0,05–0,15**, nunca 0. Um toque de metal dá o brilho certo da tinta epóxi.
- A **normal de pintura** (ruído fino, normalScale 0,2–0,25) acaba com o aspecto "plástico liso" nas chapas.

### 4.2 Sinalização (NR-26 / ISO 7010)
| Uso | Cor |
|---|---|
| Perigo (faixa do topo) | vermelho #C8102E + texto branco "PERIGO" |
| Atenção / triângulo | amarelo #F2C230 + preto #111 |
| Obrigação | círculo azul #1F5AA6, pictograma branco |
| Proibição | anel e barra vermelho #C8102E |
| Saída / segurança | verde #00843D |
| Extintor | vermelho #C8102E |
| Plaqueta operacional | fundo #F2C230, texto preto, Barlow Condensed 700, borda #111 |
| Placa de identificação | fundo #E9E6DC, texto #1B1F24, borda #8F8B80 |
| Placa escura (vão / linha) | fundo #1D252C, texto #F4F2EC |
| Fundo de placa | **#F7F5EF** (branco quebrado, nunca #FFF) |
| Faixa de piso | amarelo #E0B21E |

### 4.3 Luzes e LEDs (sinaleiros)
| Estado | Cor emissiva | Intensidade |
|---|---|---|
| Vermelho (fechado / energizado) | #FF3B30 | 2,2 |
| Âmbar (alarme / mola) | #FFB02E | 2,2 |
| Verde (aberto / ok) | #2FD36B | 2,2 |
| Apagado | #34373A (cor) / #2F3236, emissive 0 | 0 |

O emissivo > 1 junto com o bloom de limiar 0,92 faz o sinaleiro "acender" de verdade e mais nada brilhar.

### 4.4 UI: tokens (tema escuro)
```css
:root{
  --bg:#121518; --panel:#1a1e22; --panel2:#20252a; --panel3:#272d33;
  --line:#2a3036; --line2:#3a424a;
  --tx:#e8ebed; --tx2:#9aa3aa; --mut:#6c757c;
  --acc:#f2c230; --acc2:#c99d14;              /* acento único: amarelo de segurança */
  --ok:#3da56a; --warn:#e39b2d; --bad:#e5484d; --live:#6fb3e0;   /* estado */
  --red:#d9423a; --green:#2f9e5b;            /* convenção elétrica: fechado / aberto */
  --s-bg:#2b2f33; --s-panel:#33383d; --s-line:#454c53;  /* supervisório */
  --r:3px;
  --f:"Barlow",system-ui,"Segoe UI",Arial,sans-serif;
  --fc:"Barlow Condensed","Barlow","Arial Narrow",sans-serif;
  --mono:"IBM Plex Mono",Consolas,monospace;
}
```
- **Fundos de HUD sobre o 3D:** #0D1012 com alfa entre `bb` e `e6` (75–90 %), sem blur.
- **Botão primário:** fundo `--acc`, texto #151515, hover #FFD34A. Os demais botões: `--panel3` com borda `--line2`.
- **Foco:** `outline: 2px solid var(--acc); outline-offset: 2px`.

### 4.5 Supervisório (padrão HP-HMI / ISA-101)
| Elemento | Cor |
|---|---|
| Fundo | #2B2F33 |
| Barra de título | #1F2326, texto #D8DDE1 |
| Equipamento em repouso | cinza |
| Linha energizada AT | #F2F4F5 (no unifilar SVG: #EEF1F3) |
| Linha energizada MT | #E0B21E (SVG: #D9B44A) |
| Linha morta | #5E666D |
| Disjuntor fechado / aberto | #D9423A / #2F9E5B (convenção do cliente) |
| Terra | #3DA56A |
| Falta | #E5484D |
| Valor vivo | #6FB3E0, sempre com unidade |

A regra que vale ouro: **a tela é cinza; cor só aparece quando há estado ou alarme.** O operador acha o problema em um segundo.

### 4.6 Tablet (tema claro, para contrastar com o mundo)
| Elemento | Cor / medida |
|---|---|
| Tela | #E9ECEE, texto #16191C |
| Barra superior | #1A1E22, altura 44 px, logo em `--acc` |
| Ícone de app | #FFF, borda #CDD2D5, raio 6 px, 96 px de altura, grade de 4 colunas |
| Texto secundário | #5E666D / #6C757C |
| Distintivo de pendência | `--bad`, mono 12 px |

---

## 5. Luz, céu e pós-processamento (valores exatos)

### 5.1 Renderer e câmera
```ts
const R = new WebGLRenderer({ canvas, antialias:false, powerPreference:'high-performance', stencil:false });
R.outputColorSpace = SRGBColorSpace;
R.toneMapping = ACESFilmicToneMapping;
R.toneMappingExposure = 0.92;            // 0,72 dentro da casa
R.shadowMap.enabled = true; R.shadowMap.type = PCFSoftShadowMap;
const cam = new PerspectiveCamera(70, aspect, 0.05, 900);   // olho a 1,65 m
```

### 5.2 Luz externa
| Item | Valor |
|---|---|
| Sol (`DirectionalLight`) | #FFF1DC, intensidade 2,5, direção normalizada (−0,45; 0,78; 0,43) ≈ 10h |
| Céu/chão (`HemisphereLight`) | céu #DFE9F2, chão #6B6253, 0,75 (0,22 dentro) |
| Névoa | `FogExp2(#C6D3DC, 0.0028)`: aérea leve, separa planos |
| Sombra | 2048 (Alto) / 1024 (Médio), câmera ortográfica ±28 m, far 160, bias −0,0004, normalBias 0,03 |

**Sombra que segue o jogador sem tremer (snap em texel):**
```ts
follow(p) {
  const step = 56 / sun.shadow.mapSize.x;               // 56 m = largura da câmera de sombra
  const x = Math.round(p.x/step)*step, z = Math.round(p.z/step)*step;
  sun.target.position.set(x, 0, z);
  sun.position.set(x + SUN_DIR.x*80, SUN_DIR.y*80, z + SUN_DIR.z*80);
}
```

### 5.3 Céu em gradiente (melhor que o `Sky` físico para este estilo)
```glsl
// esfera BackSide r=800, depthWrite false, fog false, renderOrder -1, posição = câmera
uniform vec3 top, mid, bot, sun; varying vec3 vD;
void main(){
  float h = vD.y;
  vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.55)) : mix(mid, bot, pow(-h, 0.35));
  float s = max(dot(normalize(vD), sun), 0.0);
  c += vec3(1.0,0.93,0.8) * (pow(s,900.0)*8.0 + pow(s,12.0)*0.18);   // disco + halo do sol
  c = mix(c, vec3(0.86,0.89,0.9), smoothstep(0.12,0.0,abs(h))*0.55); // névoa no horizonte
  gl_FragColor = vec4(c, 1.0);
}
// top #5D8FC4 · mid #A9C4DC · bot #D4DBE0
```
**Truque:** para o mapa de ambiente (reflexos), gere o **mesmo céu com o chão escuro** (bot = #6F6A60) num PMREM. Os metais refletem céu em cima e terra embaixo, e o galvanizado deixa de parecer cromado.
```ts
const pm = new PMREMGenerator(R);
envOut = pm.fromScene(cenaComCeuDeChaoEscuro, 0.02).texture;
envIn  = pm.fromScene(new RoomEnvironment(R), 0.04).texture;
```

### 5.4 Interior (o que resolveu a superexposição)
Ao entrar, troque `scene.environment = envIn` e ajuste:
- `envMapIntensity × 0,35` em todos os materiais Standard (guarde o original em `userData.env0`);
- hemisférica 0,22;
- exposição 0,72.

**Fontes de luz:**
- 6 painéis LED de teto **emissivos** (emissive #FFF6E6 × 2,2), que dão o "brilho" via bloom;
- 6 luzes pontuais no máximo (eram 9; com 9 a sala estourava).

### 5.5 Pós-processamento (EffectComposer)
```
RenderPass → [GTAO (só Alto, blend 0,85)] → UnrealBloom(res 256, força 0,22, raio 0,35, limiar 0,92)
           → OutputPass → Vinheta (0,18) → SMAA
```
Shader da vinheta, que também serve de **feedback de perigo** (tinta vermelha):
```glsl
uniform sampler2D tDiffuse; uniform float amount; uniform vec3 tint; uniform float tintAmt; varying vec2 vUv;
void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - 0.5;
  float v = smoothstep(0.35, 0.85, length(d*vec2(1.15,1.0)));
  c.rgb *= 1.0 - v*amount; c.rgb = mix(c.rgb, tint, v*tintAmt); gl_FragColor = c; }
```

### 5.6 Presets e ajuste automático
| Preset | Pixel ratio | Sombra | Pós |
|---|---|---|---|
| Baixo | 1 | desligada | nenhum (`renderer.render` direto) |
| Médio | min(dpr, 1,15) | 1024 | Bloom + vinheta + SMAA |
| Alto | min(dpr, 1,5) | 2048 | GTAO + Bloom + vinheta + SMAA |

**Auto:** entre 2 s e 14 s de jogo, se o FPS ficar < 26 por 90 quadros seguidos, desce um nível. Ao trocar de preset: `material.needsUpdate = true` em tudo e reconstrói o composer.

**VR / celular:** não há pós (o composer não renderiza nos dois olhos) nem sombra em tempo real. Use um preset que troca Standard → Lambert mantendo `map`, `color` e `emissive`, e a sombra vira um quadrado escuro com degradê sob o equipamento.

---

## 6. Texturas procedurais (canvas, sem arquivos)

### 6.1 Base: ruído periódico + normal a partir de altura
```ts
let S = 1337; const rnd = () => ((S = (S*16807) % 2147483647) / 2147483647);   // determinístico
function vnoise(size, cells, oct=4, gain=0.5) {          // ruído de valor TILEABLE em [0,1]
  const out = new Float32Array(size*size); let amp=1, tot=0;
  for (let o=0; o<oct; o++) { const c = cells<<o, g = Float32Array.from({length:c*c}, rnd);
    for (let y=0;y<size;y++) for (let x=0;x<size;x++) {
      const fx=x/size*c, fy=y/size*c, x0=Math.floor(fx), y0=Math.floor(fy), tx=fx-x0, ty=fy-y0;
      const sx=tx*tx*(3-2*tx), sy=ty*ty*(3-2*ty);
      const a=g[(y0%c)*c+x0%c], b=g[(y0%c)*c+(x0+1)%c], cc=g[((y0+1)%c)*c+x0%c], d=g[((y0+1)%c)*c+(x0+1)%c];
      out[y*size+x] += amp*(a+(b-a)*sx+(cc-a)*sy+(a-b-cc+d)*sx*sy); }
    tot+=amp; amp*=gain; }
  for (let i=0;i<out.length;i++) out[i]/=tot; return out;
}
// normal: diferença central com wrap (tileable), força 0,9–2,5
// tex(): RepeatWrapping, anisotropy 8, SRGBColorSpace no albedo, NoColorSpace em normal/roughness
```
**Regra de cor:** albedo em sRGB; normal e roughness em **NoColorSpace**. Errar isso deixa o relevo "lavado".

### 6.2 Receitas (512 px salvo indicação)
| Textura | Receita |
|---|---|
| **Brita** | Fundo #3E3C39. 1.900 pedras elípticas (raio 4–12,5 px ≈ 2,5–8 cm no tile de 1,6 m, alongamento 0,6–1,1, rotação aleatória), 7 tons de cinza quente, cúpula de altura por pedra (`sqrt(1−q)`) que gera o albedo iluminado e a normal (força 2,0). Variação grande de tom com `vnoise(3 células)` × 0,9–1,06 |
| **Concreto** | Base + ruído de 6 células (5 oitavas) × 34 + ruído de 48 células × 14 + 2.600 poros escuros (−40). Normal 2,2 com poros fundos |
| **Grama** | Mistura verde #5A6E3C → seco #8A8659 pelo ruído grande (limiar 0,42) → escuro #3F5230 por 2 escalas finas. Sem normal |
| **Epóxi** | Base #737A7E ± ruído leve + **roughnessMap** 90–160 (marcas de uso brilham diferente) |
| **Bloco de concreto** | 39 × 19 cm, junta de 1 cm, fiadas em amarração (meia peça), textura = 0,8 m. Junta escurece −14 e afunda na normal (2,5) |
| **Galvanizado (spangle)** | Voronoi de 90 células com tons ±8 + ruído de 24 células ±5. Sem normal (o reflexo faz o resto) |
| **Pintura** | Só normal: `vnoise(32 células)`, força 0,9; usar com normalScale 0,2–0,25 |
| **Chapa xadrez** | Normal de losangos alternando ±45° por célula (8 × 8) |
| **Borracha canelada** | Normal de senoide (8 ciclos) |
| **Alambrado** | Canvas transparente com losangos traçados (#B8BEC1, traço 3,5 % do tamanho); `alphaTest 0,35`, `DoubleSide` |

### 6.3 UV em mundo (o maior ganho de realismo por linha de código)
Cada material repetido registra "metros por repetição" num `WeakMap`. Depois de juntar a geometria, a UV é refeita por projeção no eixo dominante da normal:
```ts
export const UVSCALE = new WeakMap<Material, number>();
const w = (m, metersPerTile) => (UVSCALE.set(m, metersPerTile), m);

function worldUV(g, s) {             // triplanar por eixo dominante
  const p=g.getAttribute('position'), n=g.getAttribute('normal'), uv=g.getAttribute('uv');
  for (let i=0;i<p.count;i++){ const ax=Math.abs(n.getX(i)), ay=Math.abs(n.getY(i)), az=Math.abs(n.getZ(i));
    const x=p.getX(i), y=p.getY(i), z=p.getZ(i);
    if (ay>=ax && ay>=az) uv.setXY(i, x/s, z/s); else if (ax>=az) uv.setXY(i, z/s, y/s); else uv.setXY(i, x/s, y/s); }
  uv.needsUpdate = true;
}
```
**Resultado:** bloco, brita e epóxi têm o tamanho certo em qualquer caixa, de qualquer dimensão, sem ajustar UV à mão.

### 6.4 Quebrar a repetição
- **Tile grande + ruído em 2–3 escalas** (grama: 1 escala grande para manchas, 2 finas). Tile pequeno com ruído só fino mostra a grade de longe.
- **Contraste baixo no chão.** A brita e o galvanizado estavam contrastados demais na 1ª rodada e "vibravam"; reduzir o desvio de tom resolveu.

---

## 7. Modelagem procedural

### 7.1 Kit de primitivas (`Batch`): toda peça estática passa por aqui
| Método | Para quê |
|---|---|
| `box(w,h,d, mat, x,y,z, ry,rx,rz)` | chapas, bases, perfis |
| `rbox(w,h,d, r, mat, …)` | painéis, gabinetes, tanques (`RoundedBoxGeometry`, chanfro 2 seg.) |
| `cyl / cylX / cylZ` | colunas, tubos, botões, flanges (geometria cacheada por segmentos) |
| `sphere` | tampos do conservador, cabeças |
| `lathe(pts, mat, …)` | isoladores, buchas, câmaras (perfil 2D torneado) |
| `bar(a, b, w)` | barra prismática entre 2 pontos |
| `rod(a, b, r)` | tubo redondo entre 2 pontos (hastes, cabos retos) |
| `angle(a, b, s)` | **cantoneira em L** entre 2 pontos (treliças com perfil real) |
| `wire(a, b, r, sag)` | cabo com **flecha** (Catmull-Rom de 5 pontos) |
| `path(pts, r)` | cabo/cordoalha por pontos (descida de terra em cobre) |
| `geo(g, mat, …)` | qualquer geometria pronta |

### 7.2 Regras de detalhe
1. **Proporção de catálogo** (fabricantes típicos 145 kV / 15 kV). Escala 1 unidade = 1 m.
2. **Chanfro em tudo que é caixa.** Aresta viva de 90° é a assinatura do "low poly de protótipo". Use `RoundedBox` com raio 0,02–0,06.
3. **Toda peça tem fundação, fixação e aterramento.** Base de concreto, 4 chumbadores galvanizados, chapa de base e cordoalha de cobre descendo até o chão. É o que "assenta" o objeto no mundo.
4. **Parafusos e porcas só onde a câmera chega perto:** cubículos, caixas de comando, flanges de trafo (22 parafusos por lado).
5. **Isoladores com saias alternadas** (grande/pequena), torneados (§7.4).
6. **Cabos nunca retos:** flecha de 0,12–0,4 m conforme o vão.
7. **Conectores com chapa e 4 furos**, terminais de alumínio.
8. **Desgaste discreto:** faixa escura na base das paredes, cobre envelhecido nas descidas, base do trafo mais escura.
9. **Peça interativa tem geometria própria** (não faz parte do lote) para poder animar e destacar.

### 7.3 Receita: transformador (exemplo de ordem de montagem)
1. **Bacia de contenção**: brita 10,2 × 7,8 m + mureta de concreto de 0,3 m.
2. **Base** de concreto, trilhos de aço escuro e 4 rodas.
3. **Tanque**:
   - `rbox(4,4 × 3,1 × 2,6, raio 0,06)` em material trafo;
   - 5 reforços verticais por face;
   - flange de tampa mais escura com 22 parafusos por lado.
4. **Buchas AT**:
   - torreta;
   - isolador torneado de 2 m (núcleo 0,12, saias 0,20/0,17);
   - terminal de alumínio;
   - chifres de arco (2 hastes).
5. **Para-raios no tanque**: suporte galvanizado, isolador polimérico, cabo com flecha até a bucha e descida de cobre até o chão.
6. **Caixa de cabos MT** (`rbox`), 3 cabos descendo, neutro com isolador e barra de cobre até o chão, placa "CABOS 13,8 kV ENERGIZADOS".
7. **Conservador**:
   - cilindro com 2 meias-esferas e suportes;
   - indicador de nível (mostrador);
   - tubo para o Buchholz (com visor);
   - secador de sílica laranja #D8862E;
   - válvula de alívio de pressão.
8. **Radiadores** com aletas e **ventiladores** (grupos animáveis); comutador (OLTC) com caixa de acionamento.
9. **Painel local** com face impressa (`Print`), ponteiros dinâmicos (óleo, enrolamento, nível), LCD do OLTC em canvas e cadeado; placa de identificação.

### 7.4 Isolador torneado (perfil para `LatheGeometry`)
```ts
function insulatorProfile(h, rCore, rBig, rSmall, pitch=0.075, flange=0.06) {
  const pts = [v(0,0), v(rCore*1.25,0), v(rCore*1.25,flange), v(rCore,flange+0.005)];
  const n = Math.max(2, Math.floor((h - 2*flange - 0.04) / pitch));
  for (let i=0;i<n;i++){ const y0 = flange+0.02+i*pitch, r = i%2 ? rSmall : rBig, t = pitch*0.2;
    pts.push(v(rCore,y0), v(r,y0+pitch*0.18), v(r,y0+pitch*0.18+t*0.4), v(rCore,y0+pitch*0.62)); }
  pts.push(v(rCore,h-flange-0.005), v(rCore*1.25,h-flange), v(rCore*1.25,h), v(0,h));
  return pts;   // + flanges galvanizadas (cilindros 1,5 × rCore) em cima e embaixo
}
// pedestal 145 kV: core 0,07 · big 0,13 · small 0,105 · pitch 0,07 · 16 segmentos
```
A saia tem a borda **inclinada para baixo** (`y0+pitch*0.18`), como a de verdade. Com a porcelana clearcoat, isso pega o reflexo do céu: é o detalhe que mais vende o realismo do pátio.

### 7.5 Textos, placas e mostradores
- **`Print` (uma textura por face):**
  - todas as legendas, plaquetas, mímicos, réguas e avisos de uma face de painel vão para **um canvas transparente** com 520 px/m;
  - entra num plano com `alphaTest 0.02` e `polygonOffset -2`, colado na face;
  - resultado: 1 draw call por face, texto nítido e sem z-fighting.
  - API: `rect`, `text(maxW encolhe a fonte)`, `tag` (plaqueta amarela), `line`, `circle`, `danger` (aviso NR-10 completo).
- **Placas soltas `sign(kind, linhas, w, h)`:** 420 px/m, **cache de textura por conteúdo**, fonte condensada com `fitText` (encolhe até caber em 90 % da largura).
- **Pictogramas desenhados em canvas** (capacete, luva, óculos, botina, protetor facial, raio, extintor, DEA). Nunca emoji.
- **Mostradores dinâmicos** (LCD de relé, multimedidor, monitores, relógio, contador): `canvasTex(w,h)` redesenhado a **3 Hz** só na área visível, com `needsUpdate` apenas quando muda.
- **Monitores:** 640 × 384 px, paleta HP-HMI (§4.5), título em Barlow Condensed 600 18 px.

### 7.6 Vegetação e entorno (barato e convincente)
- **Copas:**
  - `IcosahedronGeometry(1, 1)` com vértices sacudidos (escala 0,82–1,18 e Y achatado × 0,8) e normais recalculadas;
  - 4–5 aglomerados por árvore, com escala e rotação aleatórias;
  - **1 `InstancedMesh` para todas as copas**, com `setColorAt` em 5 verdes (#4B5D36, #56693C, #41522F, #5F6F45, #4F6440) sobre material branco.
- **Troncos:** 1 `InstancedMesh` (cilindro de 7 lados, #7D6A55).
- **Distribuição:**
  - 95 árvores de copa larga num anel de 62–177 m, fora do eixo da estrada;
  - 22 eucaliptos em fila como quebra-vento.
- **Erro corrigido:** copa = 1 esfera = "pirulito". Aglomerado irregular resolveu.
- **Chão externo:** plano de grama de 420 m, estrada de asfalto com meio-fio de concreto claro, estacionamento com faixas brancas.

### 7.7 Figura humana (vítima / colega)
Cápsulas e esferas articuladas por grupos (braço, perna), roupa FR #2A3A52, capacete branco com aba, botina em caixa. Pose deitada com `rotation.order = 'YXZ'`: sem isso a vítima "rola de lado" ao girar.

### 7.8 Raio X (ver por dentro)
Material translúcido #9FB4C0, opacidade 0,18, `depthWrite false`. Troca o material das câmaras do disjuntor e mostra os contatos de cobre e o arco por dentro. Bom para manutenção e didática.

---

## 8. Desempenho (bonito E rodando)

| Técnica | Como |
|---|---|
| **Lote estático** | Chave `zona \| bloco de 12 m (x) \| bloco (z) \| material \| projeta sombra`. Geometrias viram não-indexadas, ficam só `position/normal/uv` e são mescladas com `mergeGeometries`. Malha com `matrixAutoUpdate = false` |
| **Recorte por bloco** | Blocos de 12 m deixam o frustum culling funcionar (um lote gigante nunca sai da tela) |
| **Renderização parcial** | Grupos por zona (pátio, casa, bateria, externo, casca). A casa só é desenhada com o jogador dentro ou perto de uma porta aberta |
| **Instâncias** | Árvores (troncos e copas). Próximo passo: isoladores, parafusos e lâmpadas |
| **Cache de geometria** | Cilindros por nº de segmentos, `RoundedBox` por dimensão, texturas de placa por conteúdo |
| **Atualização espaçada** | Mundo a 10 Hz, canvas a 3 Hz, HUD a 5 Hz, simulação em passos fixos de 100 ms |
| **Sombra seletiva** | `b.cast = false` para chão, estrada e entorno; placas e prints não projetam sombra |

**Medido no SAAT (chamadas de desenho por quadro):**

| Preset | Pátio | Casa |
|---|---|---|
| Baixo | 613 | 299 |
| Médio | 887 | 686 |
| Alto | 1.757 | 1.354 |

**Orçamento recomendado para o próximo projeto:**
- desktop Médio ≤ 600 chamadas de desenho e ≤ 600 mil triângulos;
- VR ≤ 300 chamadas de desenho (medidas nos dois olhos) e ≤ 300 mil triângulos.

O SAAT **estourou** no Alto: comece instanciando o que se repete.

---

## 9. UI

### 9.1 Tipografia (embutida como woff2 base64 no HTML)
| Uso | Fonte |
|---|---|
| Texto corrido | Barlow 400/500/600, 14 px, altura de linha 1,45 |
| Títulos, rótulos, plaquetas, nomes de equipamento | **Barlow Condensed** 600–800, caixa alta com espaçamento 0,06–0,14 em nos rótulos pequenos |
| Números, medições, teclas, relógio | IBM Plex Mono 500/600 |

Carregue com `@fontsource` (subconjunto latin), aguarde com `document.fonts.load(...)` **antes de desenhar canvas** (senão as placas saem com fonte do sistema) e embuta tudo via `vite-plugin-singlefile` (`assetsInlineLimit` alto).

### 9.2 HUD mínimo (só o essencial na tela)
| Posição | Conteúdo |
|---|---|
| Topo esquerdo (20/16 px) | Rótulo da missão (11 px, `--acc`, caixa alta) + objetivo (Barlow Condensed 19 px) + passo atual com barra amarela à esquerda |
| Topo direito | Relógio da missão e sino de alarme (pisca só em alarme) |
| Centro | Mira: ponto de 4 px → **anel de 16 px amarelo** quando há alvo |
| 34 px abaixo da mira | Prompt `[E] Abrir  Armário de EPI` (tecla amarela, verbo em Condensed 15 px, nome em cinza) |
| Inferior esquerdo | EPI vestido em ícones de 30 px; item faltando com borda vermelha |
| Inferior direito | Barra de ferramentas (casas de 38 px, número no canto, ativa com borda `--acc`) |
| Centro inferior (96 px) | Legendas do rádio (quem fala em amarelo, caixa alta) |
| Topo central (70 px) | Avisos rápidos com borda esquerda de 3 px na cor do estado |

**Sem barras de botões.** Tudo que não é essencial foi para o tablet.

### 9.3 Tablet diegético (DOM projetado no 3D)
- Tablet robusto modelado (`RoundedBox` 0,27 × 0,185 m, cantoneiras de borracha amarelas) segurado pelas duas mãos, numa **cena separada** renderizada depois do composer com `clearDepth()`. Assim não atravessa paredes.
- O DOM do app (860 × 538 px) recebe `transform: matrix3d(...)` calculado por **homografia** dos 4 cantos da tela 3D projetados na tela (`quadTransform` resolve um sistema 8 × 8). O texto é HTML de verdade (nítido, selecionável, acessível) e acompanha o balanço das mãos.
- Entrada: sobe em ~320 ms (interpolação `k += (alvo−k)·min(1, dt·9)`). O jogador anda a 45 % da velocidade com o tablet aberto.

### 9.4 Inspeção (aproximar e operar)
1. **E** sobre o equipamento → tween da câmera até um enquadramento definido por equipamento.
2. Cursor livre. Ao passar sobre uma peça clicável:
   - o material é **clonado** (`userData.ownMat`) e recebe emissive #5A4400 × 1 (âmbar discreto);
   - aparece uma dica com o nome.
3. Cartão lateral direito (até 380 px, fundo #121518F2, raio 6): estado, o que a missão pede ali, ficha técnica.
4. Esc volta.

Proxy de mira e de clique = caixa invisível um pouco **maior** que a peça (`MeshBasicMaterial({visible:false})`): acertar é fácil, mesmo com peça fina.

### 9.5 Tela inicial
- Grade de 300 px (navegação) + conteúdo, **com a subestação 3D girando atrás**.
- O fundo da UI é um degradê horizontal de #0D1012 opaco (esquerda) para 40 % (direita): a cena aparece sem competir com o texto.
- Marca: "SAAT" em Barlow Condensed 800, 40 px, espaçamento 0,14 em, cor `--acc`.
- Modos em lista vertical (ícone + nome + 1 linha de descrição); o ativo ganha **borda esquerda amarela de 2 px**. Nada de cards coloridos.

### 9.6 Movimento
| Elemento | Duração |
|---|---|
| Hover, foco | 140 ms |
| Mira | 120 ms |
| Avisos | 400 ms (fade) |
| Legendas | 500 ms |
| Tablet | ~320 ms |
| Escurecer | 1 s |
| Vinheta de zona | 250 ms |

Só alarme pisca (`steps(2)`, 1 s).

### 9.7 Ícones e teclas
- **Lucide**, importação nomeada só dos usados (não infla o arquivo), traço 1,75.
- Teclas como teclas físicas: `kbd` com borda inferior de 2 px, mono 12 px. No prompt, a tecla é amarela.

---

## 10. UX (o que transformou "app com 3D" em "simulador")

1. **Uma tecla de interação (E) sobre o que está na mira.** Clique solto no mundo foi abolido. Alcance de 1,9 m (6 m para equipamento grande de pátio).
2. **Andar de verdade:** WASD/setas + mouse com Pointer Lock (arrastar com o botão direito como alternativa), Shift corre (3,6 m/s; anda a 1,7), C = pés juntos/agachar, balanço de cabeça. **Teletransporte só na prática livre.**
3. **Portas interativas** (E), com colisão quando fechadas e som.
4. **O que você veste aparece no corpo:** luva isolante preta com punho amarelo, luva de cobertura de couro, manga FR azul-marinho.
5. **Ferramenta na mão** (1–9, roda do mouse; Q guarda, F usa). A peça exige a ferramenta certa: sem a manivela, a ranhura de extração não responde.
6. **Consequência física e visível** (nada de "você errou" em texto):
   - **zona proibida:** vinheta vermelha pulsando + chiado agudo;
   - **tensão de passo:** formigamento (aviso + vinheta) e depois acidente;
   - **arco:** clarão, estrondo, tremor, queda da câmera, zumbido no ouvido, batimento, escurecer; a lesão é calculada pelo EPI que faltava;
   - **tela de acidente** com: Treinar resgate / Ver relatório / Tentar de novo / Menu.
7. **Modos separados e nomeados pela função:** Treinamento, Avaliação, Emergência e resgate, Prática livre, Resultados, Instrutor. O técnico sabe onde está.
8. **Linguagem do técnico:** "Abrir armário", "Extrair disjuntor", "Constatar ausência de tensão". Sem jargão de software.
9. **Tutorial por ação** (T0): cada passo se marca sozinho quando a pessoa faz a coisa no jogo, nunca por "próximo".
10. **Supervisório diegético:** E na mesa → senta → o monitor ocupa a tela, com CFTV ao lado mostrando a manobra no pátio.

---

## 11. Áudio (sintetizado, sem arquivos)

| Som | Receita (Web Audio) |
|---|---|
| Zumbido do trafo | Osciladores de 120/240/360 Hz (1 / 0,45 / 0,18) → `PannerNode` HRTF (refDistance 3, rolloff 1,4). Some quando desenergiza |
| Vento | Ruído marrom (filtro de 1 polo) → passa-baixa de 500 Hz |
| Ar-condicionado | Ruído → passa-faixa de 180 Hz (Q 0,6), só dentro |
| Passos | Rajada de 70 ms: brita = 2,2 kHz Q 0,5 (alto); piso = 900 Hz Q 2 (baixo) |
| Clique | Rajada de 30 ms, 3 kHz, Q 4 |
| Porta | Rajada de 600 Hz + tom triangular; batida de 300 Hz ao fechar |
| Arco | Rajada de 300 Hz (0,5 s) + 2,5 kHz (1,2 s) + dente de serra caindo de 60→30 Hz |
| Acidente | + zumbido no ouvido (4,2 kHz, 4 s) + 6 batimentos de 55 Hz |
| Zona proibida | Ruído com passa-alta de 2,5 kHz, volume proporcional à invasão |
| Rádio | Squelch (2,5 kHz) + `speechSynthesis` pt-BR com velocidade 1,08, sempre com legenda |

Destrave o `AudioContext` no primeiro clique (o mesmo que trava o mouse).

---

## 12. Erros que cometi e como corrigi (não repita)

| Sintoma | Causa | Correção |
|---|---|---|
| Interior estourado, branco | Ambiente externo refletindo dentro + 9 luzes + emissivo Basic | `envIn` RoomEnvironment, `envMapIntensity × 0,35`, hemi 0,22, exposição 0,72, 6 luzes, emissivo Standard |
| Brita e galvanizado "vibrando" | Contraste de tom alto demais | Reduzir o desvio de tom; ruído grande suave |
| Grama com grade visível | Tile pequeno | Tile de 5–14 m + ruído em 3 escalas |
| Árvore "pirulito" | 1 esfera por copa | Aglomerados de icosaedros sacudidos, instanciados, 5 verdes |
| Suporte de barramento "de caixa" | Seção quadrada | Suporte tubular (cilindro) |
| Cubículo com buraco no meio | Peça faltando nos cubículos sem disjuntor | Tampa intermediária |
| Moldura do visor saltada | `scale.z` sobrescreveu a profundidade | Montar a moldura com 4 barras |
| Relógio sobre o sinótico | Posição fixa sem checar a planta | Mover e conferir na captura |
| Portas e gavetas abrindo sozinhas | dt negativo no RAF | `dt = Math.max(0, …)` |
| Vítima rolando de lado | Ordem de rotação XYZ | `rotation.order = 'YXZ'` |
| "Cara de IA" na UI | Emoji, botões demais, texto óbvio | Lucide, HUD mínimo, tablet, linguagem do técnico |
| Tablet cortado ou gigante | DOM grande demais para a tela 3D | DOM 860 × 538 e reposicionar o modelo |
| CFTV cobrindo o supervisório | Sobreposição livre | Coluna lateral própria com o registro de comandos |
| Placas com fonte errada | Canvas desenhado antes da fonte carregar | `await document.fonts.load(...)` antes de construir o mundo |

---

## 13. Checklists

### 13.1 Antes de começar um projeto
- [ ] GDD com pilares e o que **não** entra.
- [ ] Bíblia de estilo com:
  - [ ] tabela de materiais (cor, rugosidade, metal, tile);
  - [ ] luz e presets;
  - [ ] tokens de UI;
  - [ ] regras de modelagem;
  - [ ] áudio.
- [ ] `CLAUDE.md` com as regras: materiais só da biblioteca, cores só por token, sem emoji, ciclo de captura.
- [ ] Fotos de referência por equipamento (só referência, não entram no build).
- [ ] Rota `#preview` e script de captura com câmeras fixas **antes** do primeiro modelo.
- [ ] Orçamento de chamadas de desenho e triângulos por preset.

### 13.2 Por asset
- [ ] Proporções de catálogo (medidas reais anotadas).
- [ ] Só materiais da biblioteca; nenhuma cor solta.
- [ ] Chanfro nas caixas; fundação, fixação e aterramento.
- [ ] Silhueta lida a 10 m? Detalhe fino só onde a câmera chega a < 1,5 m?
- [ ] Textos via `Print` (1 textura por face), com fonte carregada.
- [ ] Peças interativas fora do lote, com proxy maior e realce.
- [ ] Captura → 2 maiores lacunas → máximo 2 rodadas.
- [ ] Chamadas de desenho medidas (`renderer.info` com `autoReset = false` por um quadro).

### 13.3 Antes de entregar
- [ ] Capturas nos 3 presets, de dia, por dentro e por fora.
- [ ] Nenhum erro de console nos testes de ponta a ponta.
- [ ] HUD: só objetivo, mira/prompt, EPI e ferramenta.
- [ ] Nenhum emoji; todos os ícones Lucide; contraste do texto ≥ 4,5:1.
- [ ] Teste num computador real (o FPS do headless não vale).

---

## 14. Stack e build (offline, um arquivo)
| Item | Escolha |
|---|---|
| 3D | Three.js r160 (exemplos: EffectComposer, UnrealBloom, GTAO, SMAA, OutputPass, RoomEnvironment, RoundedBoxGeometry, BufferGeometryUtils) |
| Linguagem / build | TypeScript + Vite 5 + `vite-plugin-singlefile` (`assetsInlineLimit: 1e8`, `cssCodeSplit: false`) → **um `index.html` de ~1,4 MB** |
| Fontes | `@fontsource/barlow`, `barlow-condensed`, `ibm-plex-mono` (subconjunto latin, woff2 embutido) |
| Ícones | `lucide` 0.460, importação nomeada |
| Testes | Vitest (lógica) + Playwright com Chromium/SwiftShader (capturas e E2E) |
| Texturas, modelos, sons | **100 % procedurais**: zero arquivos externos |

---

## 15. Limites honestos (o que ainda NÃO está no nível)
1. **Desempenho em máquina real não medido.**
   - Médio = 887 chamadas de desenho no pátio. Num notebook de vídeo integrado, pode cair abaixo de 40 FPS.
   - Alto (1.757) só com placa dedicada.
   - O próximo passo é instanciar isoladores, parafusos e lâmpadas e cortar a sombra de peças pequenas.
2. **Procedural tem teto.** Para fotorrealismo de perto (pintura descascando, etiquetas de fabricante, cabos com torção), só com modelos/texturas escaneados ou feitos à mão. O procedural vence em peso de arquivo, consistência e velocidade de iteração.
3. **A bíblia v1 (`docs/ESTILO.md`) ficou desatualizada em relação ao código:**

   | Item | `ESTILO.md` | Código |
   |---|---|---|
   | Piso epóxi | #8E9396 | #737A7E |
   | Exposição | 1,0 | 0,92 / 0,72 |
   | Bloom | 0,25 / limiar 0,85 | 0,22 / 0,92 |
   | Céu | físico (`Sky`) | gradiente |
   | Antisserrilhamento no Médio | FXAA | SMAA |
   | Ajuste automático | < 30 FPS em 5 s | < 26 FPS entre 2 e 14 s |
   | Alcance de interação | 1,8 m | 1,9 m |

   **Use este playbook como fonte**, e atualize a ESTILO.md do SAAT.
4. **As rodadas de direção de arte com você** (máx. 2 por item) não foram feitas item a item. Parte do que está "bonito" ainda pode ter lacunas que só a sua referência revela.

---

## 16. Prompt pronto para o próximo projeto
> Vou construir **[tema: ex. simulador de usina / galpão industrial / sala elétrica]** em Three.js, entregue como **um único HTML offline**. Siga o `PLAYBOOK-VISUAL-3D.md` anexado como fonte da verdade visual.
> 1. Escreva primeiro `docs/GDD.md`, `docs/ESTILO.md` (adaptando a §4.1 e a §4.2 ao tema; mantendo luz, pós, presets, UI e UX do playbook) e `CLAUDE.md` com as regras da §13.1.
> 2. Monte a infraestrutura antes de qualquer modelo: `Engine` (§5), `materials.ts` com texturas procedurais (§6) e UV em mundo, `Batch` (§7.1), `Print` (§7.5), rota `#preview` + script de captura (§2.1).
> 3. Faça **um equipamento-guia completo** e me mande a folha de contato. Eu sou o diretor de arte: no máximo 2 rodadas por item, corrigindo só as 2 maiores lacunas.
> 4. Só então escale para o resto com o mesmo pipeline. Meça as chamadas de desenho por preset e respeite o orçamento da §8.
> 5. UI: tokens da §4.4, HUD mínimo da §9.2, sem emoji, ícones Lucide, tipografia Barlow / Barlow Condensed / IBM Plex Mono.
> 6. Respostas curtas, críticas. Pergunte quando a resposta mudar o resultado; se eu não responder, siga a opção mais durável e registre em `DECISIONS.md`.
