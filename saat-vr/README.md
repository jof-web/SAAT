# SAAT — Simulador de Atividades de Alta Tensão (SE 138/13,8 kV)

Uso: abrir `saat-simulador.html` com duplo clique (Chrome/Edge). Um arquivo só, sem servidor, offline.
Cadastro e histórico ficam no navegador (localStorage): faça **Exportar JSON** periodicamente.

Controles: `W A S D` andar · mouse olhar · `E` interagir · `Tab` tablet · `M` minimapa · `H` assistente · `1–9` ferramenta · `F` usar · `Q` guardar · `C` pés juntos · `Shift` correr · `Esc` pausa.
Comece pelo tutorial **T0** (Treinamento › Básico). Qualidade gráfica em Configurações (Auto / Baixo / Médio / Alto).

Desenvolvimento:
```
npm install
npm test          # critérios de aceite A1–A13 + goldens (Vitest)
npm run build     # gera dist/index.html autocontido (vite-plugin-singlefile)
npm run dev       # servidor de desenvolvimento
node e2e/game.cjs # E2E (também missions/hazards/tutorial/shots); capturas em .shots/
```
Dados editáveis sem mexer no código: `src/data/*.json` (plant, epi, os, fmea, kb, levels, missions, params…) e `src/data/profiles/*.json`.
Decisões, valores provisórios [VALIDAR] e pendências: `DECISIONS.md`. O que o jogo é: `docs/GDD.md`. Como deve parecer: `docs/ESTILO.md`.

## SAAT VR (Meta Quest)
- Jogar: https://jof-web.github.io/SAAT/saat-vr/jogar/ (no navegador do Quest, botão amarelo **Entrar em VR**).
- Build: `npm run build` → `jogar/index.html`. Teste VR sem óculos: `node e2e/xr.cjs` (emulador IWER).
- Estado e orçamento: `docs/VR.md`. Decisões: `DECISIONS.md` (seção VR).
