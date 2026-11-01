# SAAT — Bíblia de estilo (v1)

Direção: **realismo industrial limpo.** É uma subestação real em dia claro, bem conservada, fotografada com luz natural.
A referência é treinamento técnico sério, não jogo de ação.

## 1. Regras de ouro
1. **Legibilidade antes de efeito.** Chão calmo, equipamentos com silhueta clara, contraste entre peça interativa e cenário.
2. **Uma receita para tudo.** Todo modelo usa a mesma biblioteca de materiais (§3) e a mesma luz (§4). Nada de cor "solta" no código.
3. **Cor só com função.**
   - No 3D, as cores são as do mundo real: RAL dos painéis, cinza dos trafos, porcelana marrom, sinalização NR-26.
   - Na UI, cor só para estado e alerta.
4. **Sem cara de IA:**
   - sem emoji, sem gradiente decorativo, sem vidro fosco, sem cantos muito arredondados;
   - sem botões demais e sem texto explicando o óbvio.
5. **Ciclo de captura.** Cada item passa por captura fixa → comparação com a referência → corrigir as 2 maiores lacunas. **Máximo de 2 rodadas.** Se ainda estiver errado, pede-se uma referência ao usuário.

## 2. Unidades e escala
1 unidade = 1 m. Olho a 1,65 m, alcance de interação 1,8 m.
Dimensões típicas 138 kV (plant.json › dimensoes). Tudo [VALIDAR] até a calibração com uma medida real.

## 3. Materiais (PBR, `MeshStandardMaterial` ou `MeshPhysicalMaterial`)
| Família | Cor | Metal | Rugos. | Nota |
|---|---|---|---|---|
| Aço galvanizado | #A2A9AC | 0,55 | 0,45 | ruído de "spangle" |
| Alumínio (tubos, conectores) | #C8CDD0 | 0,85 | 0,32 | |
| Cobre (aterramento) | #B06A3B | 0,9 | 0,42 | oxidação leve |
| Porcelana marrom vidrada | #5B3022 | 0 | 0,22 | clearcoat 0,8 |
| Isolador polimérico (silicone) | #7F878B | 0 | 0,62 | |
| Pintura trafo (Munsell N6.5) | #9EA3A1 | 0,1 | 0,55 | |
| Painel RAL 7035 | #C9CDC8 | 0,05 | 0,5 | textura de pintura epóxi |
| Painel RAL 7032 (fundo) | #B5B3A4 | 0,05 | 0,55 | |
| Concreto | #ADA89D | 0 | 0,92 | manchas e normal de poros |
| Brita | #8C877E | 0 | 0,95 | normal + variação em 2 escalas |
| Piso epóxi interno | #8E9396 | 0 | 0,38 | faixas NR-26 amarelas #E0B21E |
| Parede de bloco pintado | #E4E1DA | 0 | 0,85 | juntas leves |
| Borracha (tapete isolante, luvas) | #1E1F21 | 0 | 0,8 | |
| Vidro de visor | #24323C, opac. 0,35 | 0 | 0,05 | |

Sinalização segue NR-26 / ISO 7010: amarelo #F2C230 + preto (perigo), vermelho #C8102E (proibição, incêndio), azul #1F5AA6 (obrigação), verde #00843D (saída, segurança).
Plaquetas operacionais: fundo amarelo, texto preto, fonte condensada.

## 4. Luz e pós-processamento
- **Externo:** céu físico (Sky) com o sol às ~10h, sombra suave 2048 que segue o jogador, céu/chão hemisférico, névoa leve #C9D6E0.
- **Interno:** ambiente de estúdio (RoomEnvironment) para reflexos, luminárias LED emissivas, poucas luzes pontuais, exposição 0,95.
- **Tom e cor:** ACES Filmic, exposição 1,0. Bloom só em LEDs e lâmpadas (limiar 0,85, força 0,25). Vinheta 0,15. SMAA.
- **Predefinições:**

| Preset | Configuração |
|---|---|
| Baixo | sem sombra, sem pós, pixel ratio 1 |
| Médio | sombra 1024, FXAA, bloom |
| Alto | sombra 2048, SMAA, bloom, AO, pixel ratio até 1,5 |

O preset é ajustado sozinho nos 5 s iniciais se ficar abaixo de 30 FPS.

## 5. Interface
- **Tipos:**
  - Barlow (texto, 400/500/600);
  - Barlow Condensed 600 (títulos, rótulos, plaquetas);
  - IBM Plex Mono 500 (números e medições).
- **Base:**

| Elemento | Cor |
|---|---|
| Fundo | #121518 |
| Painel | #1A1E22 |
| Borda | #2A3036 (1 px) |
| Texto | #E8EBED |
| Texto secundário | #9AA3AA |
| Desabilitado | #5E666D |

- **Acento único:** amarelo de segurança #F2C230 (foco, tecla, seleção). Raio 3 px.
- **Estado:**

| Estado | Cor |
|---|---|
| OK | #3DA56A |
| Alerta | #E39B2D |
| Crítico | #E5484D |
| Informação viva | #6FB3E0 |

- **Teclas** aparecem como teclas físicas: `[E]`, `[Tab]`.
- **Ícones:** traço de 1,75 px (estilo Lucide), nunca emoji.
- **Movimento:** 140–220 ms com saída suave. O tablet sobe em 320 ms. Nada pisca, exceto alarme.
- **Supervisório:**
  - padrão de alto desempenho (ISA-101): fundo cinza #2B2F33, equipamento em cinza, cor só para estado e alarme;
  - convenção do cliente: vermelho = fechado/energizado, verde = aberto;
  - valores vivos em #6FB3E0 e sempre com unidade.

## 6. Modelagem procedural
- Proporções de catálogo, de fabricantes típicos 145 kV / 15 kV.
- Chanfros nas caixas: `RoundedBox` em painéis.
- Parafusos e porcas visíveis só onde a câmera chega perto: cubículos, caixas de comando.
- Isoladores com perfil de saia alternado (grande/pequena), torneado via `LatheGeometry`.
- Cabos com flecha (catenária), conectores com chapa e 4 furos.
- Sujeira e desgaste discretos: base dos equipamentos mais escura, escorrido sob o radiador.
- Peças interativas têm geometria própria e destaque (contorno fino amarelo) ao mirar.

## 7. Áudio
| Fonte | Som |
|---|---|
| Trafo | zumbido 120/240 Hz espacializado, mais alto a 3 m |
| Pátio | vento |
| Casa | ar-condicionado |
| Passos | brita ≠ piso |
| Manobras | disjuntor (estalo seco), seccionadora (motor), extração (catraca) |
| Rádio | ruído (squelch) + voz pt-BR do sistema |
| Acidente | estrondo, zumbido no ouvido, batimento |
