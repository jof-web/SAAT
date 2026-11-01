# SAAT VR — estado da camada VR

Documento de passagem completo: projeto claude.ai › `claude/SAAT-VR-handoff.md` (decisões, orçamento, mapeamento desktop → VR, fases V0–V5, IDs do checklist).

## V0 (SAAT VR 0.1.0)
- `src/xr/session.ts` — `XRLayer`: botão, sessão `immersive-vr` (`local-floor`, `bounded-floor`), rig com a câmera, preset Lambert, portas/portões pelo raio + gatilho, boneco de EPI preso à câmera, ligação com o jogo (`window.saatVR`).
- `src/xr/input.ts` — gamepad xr-standard com histerese, poses de palma e raio, vibração, luva procedural (pele, isolante amarela, vaqueta, PVC; punho FR).
- `src/xr/locomotion.ts` — andar na direção da cabeça, correr (clique no polegar, conta falta), giro snap 30°/45°/suave em volta da cabeça, teleporte com arco só na prática livre, vinheta, room-scale escurece na parede, altura/calibrar chão/modo sentado, colisão AABB de `Player.hit` na cabeça (r 0,25 m).
- `src/xr/validation.ts` — menu (Y/B e pulso): Missão · Locomoção · Config · Checklist · Debug; checklist S/L/X/M com fase; relatório em texto.
- `src/xr/debug.ts`, `src/xr/panel.ts` — FPS/draw calls presos à câmera, últimos 10 erros, FPS médio por área; painel canvas do sandbox.
- `src/game/gfx.ts` — perfil leve (Quest ou `#vrlite`): Lambert espelhando o material PBR, lote único por cor de vértice (blocos de 24 m), `AutoBatch` (peças soltas da zona em `BatchedMesh`, espelhadas a cada quadro), recorte por distância de peças pequenas (layer 5).

## Orçamento medido (headless, IWER, dois olhos)
| Ponto | Draw calls | Triângulos |
|---|---|---|
| Casa (salão) | 188–196 | ~290 mil |
| Pátio (trafos / LT-01) | 136–138 | 355–415 mil |
O FPS do headless não vale: medir no Quest (aba Debug e relatório).

## Testes
- `npm test` (A1–A13 + goldens + RCP) e `e2e/*.cjs` sem erro de console.
- `node e2e/xr.cjs` (IWER): entra em VR pela tela inicial, anda, corre (falta), colide na cerca, gira 30°, abre o menu Y, abre porta pelo raio, mede draw calls, sai.
