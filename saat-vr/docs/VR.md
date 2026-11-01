# SAAT VR — estado da camada VR

Documento de passagem completo: projeto claude.ai › `claude/SAAT-VR-handoff.md` (decisões, orçamento, mapeamento desktop → VR, fases V0–V5, IDs do checklist).

## V0 (SAAT VR 0.1.0)
- `src/xr/session.ts` — `XRLayer`: botão, sessão `immersive-vr` (`local-floor`, `bounded-floor`), rig com a câmera, preset Lambert, portas/portões pelo raio + gatilho, boneco de EPI preso à câmera, ligação com o jogo (`window.saatVR`).
- `src/xr/input.ts` — gamepad xr-standard com histerese, poses de palma e raio, vibração, luva procedural (pele, isolante amarela, vaqueta, PVC; punho FR).
- `src/xr/locomotion.ts` — andar na direção da cabeça, correr (clique no polegar, conta falta), giro snap 30°/45°/suave em volta da cabeça, teleporte com arco só na prática livre, vinheta, room-scale escurece na parede, altura/calibrar chão/modo sentado, colisão AABB de `Player.hit` na cabeça (r 0,25 m).
- `src/xr/validation.ts` — menu (Y/B e pulso): Missão · Locomoção · Config · Checklist · Debug; checklist S/L/X/M com fase; relatório em texto.
- `src/xr/debug.ts`, `src/xr/panel.ts` — FPS/draw calls presos à câmera, últimos 10 erros, FPS médio por área; painel canvas do sandbox.
- `src/game/gfx.ts` — perfil leve (Quest ou `#vrlite`): Lambert espelhando o material PBR, lote único por cor de vértice (blocos de 24 m), `AutoBatch` (peças soltas da zona em `BatchedMesh`, espelhadas a cada quadro), recorte por distância de peças pequenas (layer 5).

## V0.2 (SAAT VR 0.2.0) — interação completa, consequências e PiP
- **Raio + gatilho em tudo**: peça a até 2,5 m tem prioridade (caixa amarela de destaque; legenda abaixo da visão diz a ação e a ferramenta que sai do cinto); equipamento abre o cartão `src/xr/card.ts` (estado, peças como botões, procedimentos/decisões da missão, leitura com registro, armário com inspecionar/vestir/devolver, resgate com RCP pelas mãos e DEA). Mesa de operação abre o supervisório `src/xr/scada.ts` (manobra com SELECIONAR → EXECUTAR, alarmes/ACK, TAP/AUTO-MANUAL, procedimentos do IHM).
- **Grip = mão na porta**: portas, portões, armários e a porta da caixa de comando do vão giram pela posição da mão em volta da dobradiça (para em qualquer ângulo; vibra no batente). Botão da caixa de comando só funciona com a porta aberta.
- **Consequências NR-10 com o corpo real**: cabeça e mãos (controles) contam para Rr/Rc. Rc = tinta vermelha + vibração proporcional + falta; Rr = choque: clarão, vibração forte, escurece e mostra o cartão do acidente (resgate, tentar de novo, relatório, menu). Arco também vibra. X/A segurado = pés juntos (tensão de passo).
- **PiP em toda manobra** (local ou remota, PC e VR): câmera fixa no equipamento (seccionadora, disjuntor 138 kV com câmara em corte, chave de terra, disjuntor 13,8 kV). PC: canto superior direito (ou CFTV na mesa). VR: painel ao lado, renderizado 1 a cada 3 quadros numa textura 640×360.
- **Legenda de avisos no VR** (toasts + rádio do COS) que segue o olhar com atraso. Menu › Missão › Rádio/COS: read-back, comunicações e decisões.
- **Altura manual**: cm no perfil do treinando (cadastro) ou no menu › Config (−5/−1/+1/+5, Aplicar). Olhos = 93,6 % da estatura; aplicada 1,5 s após entrar. Calibrar pelo chão e zerar ficam como alternativa. No PC a altura do perfil define a câmera.
- **Qualidade**: MSAA 4× no Quest (antialias do contexto), foveação 0,5 e escala 1,0 (Config: Leve 0,85/1,0 · Normal 1,0/0,5 · Alta 1,25/0,25).
- **Luva nova** (punho fechado: palma arredondada, dedos em 2 falanges, polegar, manguito da luva e manga FR) e **boneco de EPI no pulso** da mão de andar.

## V0.3 (SAAT VR 0.3.0) — mão real
- **Mão articulada** (`src/xr/input.ts`): aberta em repouso, fechada no grip, indicador esticado quando o dedo sai do gatilho (sensor de toque do controle) ou a ~12 cm de algo apertável; polegar pelo sensor do apoio. Luva com a cor do EPI.
- **Interação física** (`src/xr/physical.ts`), mesma lógica de peças do PC (`Interaction.actVR`):
  - dedo aperta botão (afunda 4 mm, vibra) — botões dos cubículos, caixa do vão, relés, trafo, QGCA, emergência; instrumento tocado = leitura registrada;
  - grip + giro do pulso: chave 43 e seletoras (ATS, OLTC); grip + puxar: porta e tampa do cubículo; grip + baixar/levantar: alavanca de terra 138 kV;
  - ferramenta na mão: detector, cadeado, aterramento encostam no ponto; manivela encaixa no furo e gira (anti-horário extrai, horário insere, 3 voltas por posição); alavanca de terra 13,8 kV encaixa e puxa;
  - portas, portões, armários e caixa do vão giram pela mão na dobradiça.
- **EPI e ferramentas físicos**: pega no armário; segurar perto dos olhos ~1 s = inspeção (o defeito aparece); levar à cabeça (capacete, óculos, protetor, balaclava), à outra mão (luvas) ou ao tronco (vestimenta, botina) = vestido. Ferramenta: soltar perto da cintura = cinto (4 coldres); perto do lugar no armário = devolvida; no ar = cai no chão.
- **Supervisório de toque** no monitor da mesa (aparece ao chegar perto). Menu de pulso ganhou a aba **Tarefas** (procedimentos do local mais próximo e rádio/COS) e todos os painéis aceitam o dedo.
- **Resgate pelas mãos**: tocar o ombro (consciência), aproximar o rosto 2,5 s (respiração), mãos no peito comprimindo (RCP com bipe), DEA perto do tórax (análise → gatilho = choque).
- **Cartão de ajuda** (mirar + gatilho) desligado por padrão; liga em Config. O PiP da manobra continua sempre.

## Orçamento medido (headless, IWER, dois olhos)
| Ponto | Draw calls | Triângulos |
|---|---|---|
| Casa (salão) | 188–196 | ~290 mil |
| Pátio (trafos / LT-01) | 136–138 | 355–415 mil |
O FPS do headless não vale: medir no Quest (aba Debug e relatório).

## Testes
- `npm test` (A1–A13 + goldens + RCP) e `e2e/*.cjs` sem erro de console.
- `node e2e/xr.cjs` (IWER): entra em VR, anda, porta pela mão, capacete inspecionado e vestido pela mão, manivela encaixada e girada no AL1, chave 43 girando o pulso, ABRIR com o dedo, corre (falta), colide na cerca, gira 30°, menu Y, porta pelo raio, cartão do armário, porta da caixa pelo grip, chave 43 e ABRIR 52-LT1 pelo raio (PiP aparece), supervisório, zona controlada e choque pela mão (cartão do acidente, reinício), luvas, draw calls, sai.
