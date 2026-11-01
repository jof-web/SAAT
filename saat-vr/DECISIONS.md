# DECISIONS — SAAT (Simulador de Atividades de Alta Tensão), ex-SE-TREINO "Vale Verde"

## v4. Interior da casa de comando conforme fotos + planta do usuário (31/10/2026)
| Tema | Decisão |
|---|---|
| Fonte | 17 fotos do local + planta 2D do usuário (escala aproximada). Onde divergem: **planta para posições, fotos para medidas e aparência** |
| Escala | Todas as cotas da planta vieram escritas "29,5". Adotado: **29,5 m = comprimento interno total** (do portão até a parede da sala de baterias); largura 9,4 m pela proporção; pé-direito 4,5 m (resposta do usuário). Um número em `plant.json › casa.layout` muda tudo [VALIDAR com trena] |
| Coordenadas | `casa.layout` em metros: u a partir da parede do portão, v a partir da parede do pátio. Mundo: x = xE − u, z = zN + v (planta girada 180°, sem espelhar). O prédio ficou no mesmo lugar do pátio, centrado no retângulo antigo, com a parede do pátio na mesma linha |
| PDMT | 10 cubículos com as etiquetas reais (1Q1 52-6 … 10Q1 89-6), **10Q1 junto ao portão** (fotos 1 e 2; a planta do usuário trazia o bloco girado, com 1Q1 no portão). Mapeamento para a simulação: 1Q1→AL1, 2Q1→AL2, 3Q1→T1M, 4Q1→TSA1, 5Q1→P, 6→RISER, 7Q1→AL3, 8Q1→AL4, 9Q1→T2M, 10Q1→TSA2. Os cubículos TP1/TP2 saíram do 3D (os TPs de barra continuam na simulação) |
| PSPC | Mímico igual ao da foto, **com LINHA 2**. A LINHA 2 não existe na simulação: as lâmpadas dela ficam apagadas. FT3/FT4 têm o RESET do 86T; FT1 mostra a LT-01 |
| Saiu do 3D | QGCA de piso, 6 painéis PPC, console de 3 monitores, sinótico, relógio, armários de ferramentas e de EPI químico (os itens foram para o armário de EPI), lava-olhos, pia, kit de contenção, exaustor, tapete isolante, ar-condicionado do salão |
| Ficou (exigido pelas missões) | DEA, botoeira de emergência e quadro LOTO, na parede do portão |
| Anexos | Anexo 1: dois transformadores a seco de serviço auxiliar (TSA-1/TSA-2) em grade amarela; anexo 2: almoxarifado vazio. Os dois abrem para o pátio |
| Interpretação | A porta na parede das janelas é a abertura com luz da foto 3 (externa). Saídas para o pátio: portão duplo e porta alta |
| Ciclo de captura | `e2e/casa.cjs` com 12 câmeras nas posições das fotos; 2 rodadas (tom de parede/laje, pilares, contraste do mímico; grade do TSA) |

## v3. Reconstrução como jogo de simulação (27/10/2026)
Origem: avaliação do usuário ("jogabilidade ruim, botões demais, cara de IA, portas sozinhas, sem consequência física"). Respostas: **refazer tudo a partir de GDD + bíblia de estilo**, realismo industrial limpo, todos os modelos procedurais e detalhados, roda no navegador (presets Baixo/Médio/Alto com detecção automática; a escolha foi minha porque a pergunta sobre hardware ficou sem resposta).

| Tema | Decisão |
|---|---|
| Documentos-base | `docs/GDD.md` (o que o jogo é) e `docs/ESTILO.md` (como deve parecer); `CLAUDE.md` com as regras para novas sessões |
| Controles | WASD/setas + mouse com Pointer Lock (fallback: arrastar com o botão direito), Shift corre, C agacha ("pés juntos"), **E interage com o que está na mira**, Tab tablet, M minimapa, H assistente, 1–9/roda ferramenta, F usa, Q guarda, R read-back, Esc pausa |
| Teletransporte | Só na Prática livre (mapa do tablet e tecla Z). Nos demais modos o treinando anda |
| HUD | Mínimo: objetivo, mira com prompt `[E] verbo + nome`, EPI vestido em ícones e barra de ferramentas. O resto fica no tablet |
| Tablet diegético | Tablet robusto 3D nas mãos (o DOM é projetado na tela por homografia): Tarefa, APR/PT, Rádio, Assistente, Mapa, Fichas, Meu EPI, Leituras |
| Inspeção | E abre a vista aproximada do equipamento; o cursor fica livre para clicar nas peças (realce + dica); cartão lateral com estado, missão e ficha |
| Portas | Todas interativas (E); fechadas também bloqueiam a passagem |
| Supervisório | Sentar na mesa (E). Monitor em padrão HP-HMI (cinza, cor só para estado/alarme) + CFTV (raio X dos polos) + "Seus comandos" |
| Consequências | Zonas NR-10 (Rr/Rc pelo `kb.nr10Zonas`), tensão de passo perto de condutor caído (formigamento → acidente se andar sem pés juntos), arco elétrico com lesão calculada pelo EPI ausente, contato com vítima energizada. Acidente = clarão, queda, tela de acidente e relatório |
| Resgate | S1 (vítima no AL3) e S2 (condutor caído): isolar → constatar → consciência → respiração → RCP (ritmo 100–120/min com Espaço) → DEA |
| Modos | Treinamento (níveis + T0), Avaliação (sem roteiro, dica ×2), Emergência e resgate (S1, S2, E1), Prática livre, Resultados (KPIs e gráficos), Instrutor (turma + console ao vivo) |
| Console do instrutor | Mantido e reestruturado: coluna "Treinando ao vivo" (planta com posição, local, alvo, ferramenta, situação, EPI) + unifilar espelhado; abas Linha do tempo / Falhas / Avaliação / COS / Dicas / Relatório |
| Renderização | Lotes estáticos por zona e bloco de 12 m; a casa de comando só é desenhada quando o treinando está dentro ou perto de uma porta aberta; sombras seguem o jogador |
| Visual | Texturas PBR procedurais em canvas, céu em gradiente, ACES, bloom leve, SMAA, GTAO só no Alto. Sem emoji: ícones lucide e fontes Barlow / IBM Plex Mono embutidas |
| Áudio | Sintetizado: zumbido 3D dos trafos, vento, passos por piso, portas, cliques, arco, voz do COS (speechSynthesis pt-BR) |

### v3.1 Verificação (27/10/2026)
- `npm test`: 4/4 (aceite A1–A13 + goldens + 3 casos de `rcpQualidade`). `tsc --noEmit` limpo.
- E2E (Chromium headless, SwiftShader): `e2e/game.cjs`, `missions.cjs`, `hazards.cjs`, `tutorial.cjs`, sem erros de console. Confirmado: ferramenta exigida por peça, acidente por contato com vítima, resgate S1 completo, aviso a 10 m e acidente por passo em S2, arco em aterramento energizado com lesão listando o EPI ausente, T0 completo, console do instrutor recebendo a posição ao vivo.
- Draw calls por quadro (medidos): Baixo 613 pátio / 299 casa; Médio 887 / 686; Alto 1757 / 1354. **FPS em hardware real não medido** (o headless usa CPU).

### v3.2 Limitações conhecidas
- O ritmo da RCP não é testável em headless (eventos de tecla chegam a cada ~4 s): a função pura `rcpQualidade` tem teste unitário e o E2E marca a etapa.
- Alto passa de 1700 draw calls: indicado só para GPU dedicada. Se o Médio ficar abaixo de 40 FPS no notebook de treino, o próximo passo é instanciar isoladores/parafusos e cortar sombras de peças pequenas.
- Modelos procedurais: a fidelidade depende das rodadas de direção de arte (máx. 2 por item, conforme `docs/ESTILO.md`).
- Valores de segurança (raios de passo 10/6/1,5 m, distâncias de arco, energia incidente) são didáticos [VALIDAR com o engenheiro].
- Pointer Lock: o Esc do navegador libera o mouse e o jogo pausa; clicar na tela retoma.


## 0. Revisão SAAT — respostas do usuário (26/10/2026)
| Item | Decisão |
|---|---|
| Nome | SAAT — Simulador de Atividades de Alta Tensão |
| Abertura | **Só arquivo offline** (um .html). O chat é busca por palavras-chave/sinônimos, sem IA. O cadastro e os relatórios ficam em localStorage, com backup por export/import JSON |
| Layout | A **planta de referência (Rev 1, 26/10/2026)** é a base do pátio e da casa de comando: reorganizar e corrigir posições |
| B1–B9 | 9 equipamentos tripolares 138 kV (seccionadora–disjuntor–seccionadora × LT1, T1, T2); a atribuição exata fica [VALIDAR] |
| Pórtico (5 descidas) | **1 linha 138 kV** + para-raios/TPs/cabos-guarda; a elétrica se mantém |
| Casa de comando | EQ-1 = cubículos 13,8 kV; EQ-2 = painéis de proteção/controle + mesa do supervisório; EQ-3 = serviços auxiliares CA/CC **incluindo os retificadores RT1/RT2** (correção: retificador fora da sala de baterias — atmosfera com H₂); BAT = só bancos de baterias + lava-olhos/EPI químico |
| Escala/normas | Dimensões típicas de SE 138 kV + NR-10 (zonas de risco/controlada visíveis) + ABNT. Tudo [VALIDAR] (a planta está sem escala e não aprovada) |
| FÊMEA | **FMEA** por equipamento, ligada a F01–F25, pesquisável no chat |
| Níveis | 3 progressivos: Básico (guiado), Intermediário (dica custa ponto), Avançado (sem dica, falha surpresa, tempo). Libera o próximo nível com ≥ 70 % |
| Cores do supervisório | **Vermelho = fechado/energizado, verde = aberto** (ANSI) |
| OS/APR/PT/EPI | Modelos genéricos NR-10/NR-6 em JSON editável |
| Entrega | **Tudo de uma vez** (usuário escolheu, contra a recomendação de fases) |
| Fotos | **Só referência para modelagem 3D**: não entram no arquivo. O usuário coleta a partir da lista enviada |

## 0.1 Planta → 3D (o que foi feito e o que foi adaptado)
- Conversão planta→metros: `plant.json › escala.mPorPx = 0,0789`, origem [85,75] px. **Calibrar com 1 medida real** (ex.: comprimento da cerca ou da casa) e ajustar só esse número.
- Pátio: cerca, portão, pórtico de 1 linha (3 colunas), para-raios e TPC de linha, barramento 138 kV (h 6,2 m, fases a 2,4 m), bays B1–B9 conforme planta, trafos TR-01/TR-02 nas bacias, trincheiras, iluminação, ponto de encontro.
- **B2/B4/B6 = bay reserva** (equipamento presente, desligado, marcado "VR-"): a planta mostra 2 colunas de 3, a elétrica tem 1 linha.
- **A1/A2/A3 = posições adaptadas** (sem marca na planta): seccionadoras 89-T2-1, 89-T1-2/89T-T1, 89-T2-2/89T-T2, necessárias à topologia. Aparecem na ficha como "posição adaptada". [VALIDAR]
- Casa de comando: divisória, portas, EQ-1 (12 cubículos na ordem TSA1…TSA2, frente sul), EQ-2 (PPC LT-01/T1/T2/MT, UTR, medição) + mesa do supervisório, EQ-3 (QGCA, RT1, RT2, QDCC), sala de baterias, armários EPI/ferramentas/LOTO/EPI químico, extintores, botão de emergência, rota de saída.
- Dimensões típicas 138 kV (alturas de barramento, distâncias fase-fase/fase-terra, cubículo 0,8×1,6×2,3 m) com fonte/[VALIDAR] na tabela `plant.json › dimensoes`.
- Zonas NR-10 (Anexo II) desenhadas nos nós energizados: 138 kV Rr 1,20 m / Rc 3,20 m; 13,8 kV Rr 0,38 m / Rc 1,38 m.

## 0.2 Valores novos provisórios (editáveis em JSON)
| Parâmetro | Valor | Onde |
|---|---|---|
| SF6 (densímetro) | nominal 6,0 · estágio 1 < 5,4 · estágio 2 < 5,1 bar | params.json › instrumentos [VALIDAR na placa] |
| Contadores (ops/para-raios/OLTC) | faixas iniciais sorteadas por semente | params.json › instrumentos |
| FMEA S/O/D | notas didáticas 1–10 | fmea.json [VALIDAR com histórico da manutenção] |
| Defeitos de EPI/ferramenta | luva (furo/ensaio vencido), detector (bateria) sorteados por semente | epi.json |
| Ventilação manual | força 2 estágios | params.json › ventilacao |

## 0.3 Camada de treinamento
- **Níveis** (`levels.json`): Básico = R1, R2, C1 (roteiro na tela, EPI faltando **bloqueia** a ação, tempo ×2); Intermediário = M1 (dica custa ponto, EPI faltando = erro maior, tempo ×1,5); Avançado = M2, C2, E1 (sem dica, falha surpresa sorteada F22/F10/F15/F07/F11 entre 60 e 180 s, tempo ×1,2). Libera o próximo com nota ≥ 70 em todas as missões do nível.
- **Missões novas**: R2 (ronda + leitura OLTC/trafos), C1 (falta no AL2 + religamento), M2 (manutenção do 52-T1M com PT, LOTO no OLTC e retorno com TAP).
- **EPI/ferramentas**: inventário por armário, inspeção antes do uso, matriz tarefa→EPI (`epi.json › tarefas`). Visor/estado do EPI no HUD.
- **OS/APR/PT** (`os.json`): OS por missão; APR com 14 riscos e medidas misturadas com distratores (nota em %); PT com checklist ao vivo. Modelos genéricos — **trocar pelos da empresa**.
- **Cadastro**: treinandos + histórico em localStorage do navegador (prefixo `saat:`). **Limpar dados do navegador apaga tudo** → usar Exportar JSON (backup) e CSV (planilha). Relatório de desempenho por treinando.

## 0.4 Assistente e supervisório
- Assistente **sem IA** (offline): índice de palavras-chave + sinônimos sobre fichas, FMEA, glossário, NR-10, EPI e equipamentos; comparar dois itens; **prévia de manobra** numa cópia do simulador (mostra o que desliga/alarma antes de agir).
- Supervisório: telas Geral, Trafos, MT, SA, Alarmes, SOE, Tendências, Intertravamentos, Comunicação; faceplate SELECIONAR → ABRIR/FECHAR (30 s) + confirmação; comando só da mesa. Diagrama funcional de comando ao vivo (plugue, 43, 86, 63G, mola, 52a/b).
- Mini-operações 3D (PiP): câmera de detalhe em disjuntor AT (câmara SF6 em corte), MT (ampola), seccionadora, terra, extração; fila de até 3.

## 0.5 Verificação SAAT
- `npm test`: **20/20** (A1–A13 + goldens R1, R2, C1, C2, E1, M2 e M2 no perfil 2026; M1 validada só no E2E). Corrige a contagem "21/21" informada antes: são 20.
- E2E (Chromium headless, file://, 0 erros de console): cadastro → OS → APR → EPI (luva com defeito detectada e trocada) → missões R2, C1, M1, M2 aprovadas e gravadas no histórico; surpresa do Avançado dispara; supervisório, faceplate, ficha, assistente, PiP raio-X, minimapa, zonas, console do instrutor, relatório.
- Arquivo: `saat-simulador.html` ≈ 913 KB; ~291 draw calls. FPS em software não representa o notebook real: **medir em Menu → Diagnóstico**.

Versão 2.0.0 (SAAT) · 26/10/2026 · Registro de decisões, desvios e medições. Fonte de verdade do domínio: `anexo-tecnico-se-treino.md` + JSONs em `src/data/`.

## 1. Escopo desta entrega
- Decisão do usuário: **MVP completo num único `.html`** em vez de um marco por vez. Cobre M0–M4 inteiros; M5 (console, relatório, replay) e M6 (Teste de Funções, sandbox, perfis) em versão simplificada.
- Missões: R1, M1, C2, E1. Perfis: `nr10_vigente`, `nr10_2026` (provisório).
- Catálogo F01–F25 completo em dados; **F18, F19 e F24 fora** (`mvp:false`). F17 só "travado" (sem "caçando").

## 2. Respostas do usuário (07/10/2026)
| Item | Valor adotado |
|---|---|
| Unifilar `unifilar-se-treino.svg` | **Ausente.** Topologia derivada do anexo §1–2; layout em `layout.json` |
| Capacidade do disjuntor MT | **25 kA** → paralelo permitido (18,0 kA ≤ 25) |
| Tempo de abertura MT (A9) | **50 ms** → 52-T1M abre em 200 ms |

## 3. Inconsistências encontradas no anexo (o engenheiro deve decidir)
1. **I-05 × C2/C4/E1.** I-05 exige as duas barras energizadas, mas C2, C4 e E1 mandam fechar 52-P sobre a MT-1 morta. Implementado o 25 em modo barra-morta (`params.paralelismo.permiteBarraMorta = true`). Sem isso, essas missões ficam impossíveis.
2. **50BF só abre 52-TnM.** Com 52-P fechado, a falta continua alimentada pelo outro trafo. **Incluído 52-P** na lista de trip do 50BF (`protections.json`). A9 continua válido.
3. **Boa prática × erro crítico.** "Constatação extra logo após o seccionamento = bônus", mas "trocar impedimento e constatação = crítico". Regra adotada: a constatação feita antes do impedimento vale só como bônus. A etapa só conta se for refeita depois do impedimento. Senão: "aterramento antes da constatação" = crítico (A8 passa).
4. **I-07 "mola descarregada bloqueia comando".** Aplicado só ao **fechamento**: a abertura usa a mola de abertura já carregada. Bloquear a abertura seria inseguro.
5. **Tentativa de aterrar bloqueada pelo I-02** = erro **maior**. O crítico do anexo ("fechar a terra sem constatar") só ocorre com bypass.

## 4. Valores que NÃO constam no anexo (provisórios, todos editáveis em JSON)
| Parâmetro | Valor | Onde |
|---|---|---|
| TMS 51 MT | 0,13 (derivado: Δt 0,3 s acima do 51 de AL1 em 4 kA) | protections.json |
| TMS 51 AT | 0,22 (Δt 0,3 s acima do 51 MT na falta refletida) | protections.json |
| 51G | VI, TMS 1,2 (Δt ≥ 0,3 s acima do 50N); 2º estágio +0,3 s | protections.json |
| 87T: joelho slope 1→2 | 2,0 pu | protections.json |
| 50BF: In de referência | In do trafo (1046 A MT / 104,6 A AT) | protections.json |
| Térmico | amb. 30 °C, elevação do óleo 55 K, gradiente 23 K, n = 1,6, τ = 180 min, 22,5 MVA com 1 grupo | params.json |
| I 2φ | 0,866 × I 3φ; falta no terminal do alimentador (sem Z de linha) | params.json |
| Proteção remota da LT | 1,5 s (anexo diz "com atraso") | params.json |
| Inrush | 6–8 × In, 2ª harmônica 20–40 % (sorteio por semente) | params.json |
| Tempos de manobra | seccionadora 4 s, terra 1,5 s, extração 3 s/posição, mola 5 s, ATS 2 s | params.json |
| TAP inicial | +1 (com TAP 0 a MT-1 fica em 0,985 pu, na borda da banda; o OLTC atuaria em 30 s) | params.json |
| Pontuação | maior −15, menor −5 p.p. na competência; dicas N1/N2/N3 −2/−5/−10 p.p.; bônus +2 | scoring.json |
| Curva CC | linear 125→105 V em 4 h ÷ 12; colapso até 0 V | sim.ts (parâmetros em params.json) |

## 5. Simplificações do solver F1
- Análise nodal em pu (base 25 MVA). Chaves = 1e-6 pu; trafos = Zt; fonte = barra infinita atrás de Zs.
- Cargas como corrente constante na tensão nominal (reproduz o anexo §1.2).
- Tensão MT ≈ 1 + TAP·1,25 % − Zt·I·senφ. Circulante entre trafos com TAPs diferentes não é modelada.
- Falta 1φ: Z0 = Z0t dos trafos ligados à ilha; o delta bloqueia a sequência zero da fonte. Falta no AT só 3φ (sem Z0 da fonte).
- Arco = evento binário. Bypass de I-01 sob carga → arco + falta 3φ. Bypass de I-02/I-03/I-10 → nó energizado e aterrado = curto franco automático.
- Zona de risco: manobra **local** de disjuntor com remoto disponível = erro menor; manobra remota = bônus. A posição do avatar não é usada (o popup local implica presença no cubículo).

## 6. Arquitetura (contexto v2 §3)
`src/data` (domain-data) · `src/core` (sim-core: `net.ts` solver, `sim.ts` estado/intertravamentos/proteções) · `src/scenario` (scenario-engine + norm-profile + session/replay) · `src/ui` (panel-ui, unifilar, relatório) · `src/world` (world-3d) · `src/instructor` (instructor-link + console) · `src/io` (AlarmOutput Web Audio) · `src/qa` (critérios de aceite compartilhados).
UI, 3D e console só leem estado e enviam comandos.

## 7. Spike M0 — medições
Ambiente de medição: **Chromium 141 headless, Linux, renderização por software (SwiftShader)**, abrindo o arquivo por `file://`.

| Item | Resultado |
|---|---|
| Arquivo único | `se-treino-simulador.html`, **651 KB** (meta < 3 MB) |
| `window.open` + `postMessage` em file:// | **OK** (origem "null"; validação pela referência da janela) |
| `localStorage` em file:// | **OK** |
| `window.isSecureContext` | true |
| `'serial' in navigator` / `'hid' in navigator` | true / true |
| Draw calls na cena | 155 |
| FPS | 12 em software: **não representativo**. Medir no notebook-alvo (Menu → Diagnóstico do ambiente) |

Pendente: repetir no Chrome/Edge do Windows do usuário. Se `isSecureContext` = false, a sirene USB exigirá servir o mesmo .html por localhost/HTTPS (plano B do contexto §10).

## 8. Testes
MVP: A1–A13 + golden de R1, C2, E1 (16/16). SAAT: ver §0.5 (20/20). O mesmo módulo roda no app (Menu → Teste de Funções).

## 9. Fora desta entrega
52-P 50/51 (sem ajuste no anexo), 74TC, 81, F18/F19/F24, missões M3, C3–C6, E2–E4, modelos 3D a partir das fotos reais, solver F2/F3, sirene USB, Nível B, console remoto (instrutor na mesma máquina — pendência 4 assumida).

## v5 — Pátio: planta geral final (aguardando OK do usuário)
Referências: `docs/ref/planta-geral-v2-final.png`, `docs/ref/fichas-patio-v2.png`.
- LT-02 montada nas baias reserva (B2/B4/B6 → 89-LT2-2 + 89T, 52-LT2, 89-LT2-1), desligada; só visual, fora do modelo elétrico.
- Pórtico inclinado descartado (era ângulo da foto). Pórtico reto de 12 m sobre cada trafo, com hastes para-raios.
- Pórticos laterais (oeste x≈3,8 m, leste x≈49,8 m; colunas em y 19,3/33,3/48,1 m; 14 m): seguram a barra 138 kV em cabo (presa a 9 m, flecha 1,5 m) e os cabos para-raios.
- Barra 138 kV: fases em y 23,5/26,5/29,5 m (espaçamento 3,0 m). Os pórticos baixos antigos da barra saem.
- Cabos para-raios ligam todas as hastes: pórtico de linha, pórticos laterais (3 cabos transversais em y 35,6/39,4/43,1 m) e pórticos dos trafos. Interpretação da foto 1 (cabos finos com flecha cruzando o pátio).
- Todas as colunas de pórtico ganham haste para-raios no topo.
- Muros corta-fogo: entre TR-02 e TR-01, e entre TR-01 e TR-03. TR-03 fica como espaço reservado (x≈44,2 m) com o vão futuro tracejado.
- Divisa: a parede sul da casa faz parte da cerca. Entrada a pé pela porta sul da casa; ponto de encontro do lado de fora.
- Dois portões de 6 m na cerca leste (y 22–28 e 54,5–60,5 m), ligados a uma via externa. Área de manobra entre os trafos e a casa.
- Cerca com postes a cada 3 m (antes 5,7 m), braço de 45° e 3 fios farpados.
- Torre treliçada de circuito duplo 30 m ao norte, entre LT-01 e LT-02.

### Backlog de missões sugerido pelo usuário
- Limpeza (lavagem) de isoladores e para-raios, com equipamento desligado e aterrado.
- Após descarga atmosférica: inspeção, leitura do contador de descargas do para-raios, rearme da proteção (86) e religamento.

## VR — V0 (SAAT VR 0.1.0)
- **Respostas do usuário:** correr continua permitido, mas cada corrida dentro da SE vira falta registrada (resultado, ranking); ranking e cadastro ficam no aparelho com exportar/importar (mescla sem duplicar); nesta entrega entram V0 + pátio + itens rápidos da equipe.
- **Three.js 0.185.1** (subiu da 0.160): só 3 ajustes (RoomEnvironment e SMAAPass sem argumentos). Testes e E2E passaram.
- **Perfil leve automático no Quest** (`OculusBrowser|Quest|Pico` ou `#vrlite`): Lambert espelhado, lote por cor de vértice, AutoBatch de peças soltas, recorte de placas por distância, menos segmentos e metade das saias dos isoladores. Sem isso o pátio passava de 700 draw calls por olho.
- **Portas e portões pelo raio + gatilho** entraram na V0 (X2), senão não dá para sair da casa no VR.
- **Céu**: shader ganhou `tonemapping_fragment`/`colorspace_fragment` (ficava saturado sem o composer).
- **Pátio v5** (planta geral v2 aprovada): pórtico de linha de concreto com hastes; pórticos laterais (x 3,8 e 49,8 m) seguram a barra 138 kV em cabo (9 m, flecha 1,2 m); cabos para-raios ligam todas as hastes (os 3 transversais ficaram nas fileiras de colunas, z 19,3/33,3/48,1, porque cabo precisa de apoio); pórtico reto de 12 m sobre cada trafo; 2 muros corta-fogo; TR-03 reservado; LT-02 montada e desligada; torre treliçada quadrada simples; cerca com postes a cada 3 m; casa na divisa; 2 portões de 6 m a leste.
- **Equipe (lista de pedidos):** login mantido (tela de entrada, usuário lembrado); administração com PIN (padrão 1234) com pessoas, ranking (pontos, missões, tempo, faltas, nota) e recorde por missão; níveis 0 Como jogar, 1 Operador, 2 Eletromecânico, 3 Técnico (ids antigos mantidos); prática livre com erros/EPI valendo (opção, ligada por padrão); boneco 2D de EPI no canto (verde = pronto); árvores removidas, entorno reduzido; avental de PVC removido; lava-olhos não existe nesta versão.
- **Fica para as próximas fases:** APR/início de processo, editor de missões/APR/NRs, falha oculta (componente queimado sem estar na OS), botão de tarefa aleatória, mais tipos de teste. (PiP e interação no VR entraram na 0.2.0.)

## VR — V0.2 (SAAT VR 0.2.0)
- **Imagem lavada no PC (erro meu na 0.1.0):** a r185 mudou o bloom; limiar 0,92 fazia o interior inteiro brilhar. Limiar 1,8, força 0,18, e interior com ambiente/exposição menores. Faltou capturar o interior em médio/alto depois da troca de versão.
- **Interação no VR = mesma lógica do PC** (`Interaction.actVR`): a peça do mundo é o botão; o cartão flutuante repete as peças em lista para quem não alcança. A ferramenta exigida sai do cinto sozinha se a pessoa tiver; senão, aviso.
- **Portas pela mão**: grip perto da folha e gira em volta da dobradiça; abrir pelo gatilho continua valendo. Caixa de comando do vão: corpo raso, mímico atrás da porta (antes ficava escondido dentro da caixa — era o "painel vazio").
- **Acidente com o corpo real**: no VR a mão (controle) entra no cálculo de Rr/Rc. Sem mover a câmera: clarão, escurecimento e cartão. Andar através de equipamento continua bloqueado; enfiar a cabeça (room-scale) escurece.
- **Vibração**: formigamento proporcional na zona controlada e na tensão de passo; pulso forte no choque e no arco; toque leve em cada peça acionada e no batente da porta.
- **PiP**: toda manobra dispara (antes só sentado na mesa). No VR custa uma renderização a mais a cada 3 quadros; se faltar FPS no Quest, é o primeiro corte.
- **Altura**: manual (cm) por perfil, como pedido; a automática virou alternativa. Olhos = 0,936 × estatura (antropometria média).
- **Resgate no VR**: RCP contando compressões pelo movimento das mãos (5 cm para baixo e volta) ou pelo gatilho; DEA com análise e CHOQUE.
- **APR/PT no VR**: preenche no PC antes de entrar (aviso no menu). Tablet completo no VR fica para a V5.
