# Sandbox VR — validação de interações (Meta Quest 3S)

Laboratório WebXR para testar locomoção e interações, marcar o resultado num checklist e exportar o relatório.
Sem build: HTML + ES modules, Three.js 0.185.1 e Rapier 0.21.0 via CDN (jsDelivr).

## Publicar no GitHub Pages
Este projeto fica na pasta `simulador VR/` do repositório `SAAT` (público).
1. No GitHub: **Settings > Pages > Build and deployment > Source: Deploy from a branch**, branch `main`, pasta `/ (root)`. Salve.
2. Aguarde 1–2 min. O link fica `https://jof-web.github.io/SAAT/simulador%20VR/`.

## Abrir no Quest
1. No headset, abra o **Meta Quest Browser** e digite o link (ou envie pelo app Meta Horizon no celular).
2. Confira a versão no painel lateral (ex.: `v0.1.0`). Se não mudou após um push, espere ~10 min ou recarregue.
3. Toque **Entrar em VR**. Polegar esquerdo anda (clique nele para correr), direito gira. Botão **Y** abre o menu; palma esquerda para cima abre o menu de pulso. Canhoto: Menu › Config › Canhoto (inverte tudo).
4. Marque cada item na aba **Checklist**. Ao sair do VR, o painel 2D mostra o relatório: **Copiar** ou **Baixar .txt**.

## Testar no PC (modo desktop)
Abra o mesmo link no Chrome/Edge. `WASD` anda, `Shift` corre, `Q/E` gira, botão direito arrastando olha, clique esquerdo pega/aciona
(arraste para mover; roda do mouse muda a distância), `M` abre o menu, `F` liga o FPS.
Para rodar localmente, sirva a pasta por HTTP (ex.: `npx serve .`); abrir o arquivo direto (`file://`) não carrega módulos.

## Versão
Mude só `window.APP_VERSION` no `index.html`. O import map acrescenta `?v=VERSAO` a todos os módulos locais.
