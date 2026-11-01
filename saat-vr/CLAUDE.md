# SAAT — regras para novas sessões
- Leia `docs/GDD.md` (o que o jogo é) e `docs/ESTILO.md` (como deve parecer) antes de mexer no visual ou na interface.
- Saída: **um único .html offline** (`npm run build` → `jogar/index.html`). Nada de rede em tempo de execução.
- `src/core`, `src/scenario`, `src/data`: fonte da verdade elétrica e de avaliação. A camada de jogo (`src/game`) só lê o estado e envia comandos.
- Materiais apenas de `src/game/materials.ts`. Cores da UI apenas pelos tokens de `src/ui/style.css`. Sem emoji na interface.
- Toda mudança visual passa pelo ciclo de captura (`e2e/shots.cjs`): captura fixa → comparar → corrigir as 2 maiores lacunas → no máx. 2 rodadas.
- `npm test` precisa continuar 100 % (critérios A1–A13 + goldens + RCP). E2E em `e2e/*.cjs` sem erros de console.

## Regras do VR (saat-vr)
- Entrega: `npm run build` → `jogar/index.html` (versionado). Link: https://jof-web.github.io/SAAT/saat-vr/jogar/
- `src/xr` só lê o estado e envia comandos, como `src/game`. Câmera nunca se move sem o usuário; mova o rig.
- No VR: sem composer, sem sombra; materiais via `src/game/gfx.ts` (Lambert espelhado). Orçamento: ≤ 300 draw calls e ~300 mil triângulos (dois olhos), 72 FPS no Quest.
- Peça que muda de material em tempo de execução: `vrMat(m)` ou `userData.solo = true` (fica fora do AutoBatch).
- Versão em `src/version.ts` (sobe a cada publicação; aparece no 2D, no menu do VR e no relatório).
- `node e2e/xr.cjs` (IWER) precisa passar antes de publicar.
