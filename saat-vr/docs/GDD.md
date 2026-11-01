# SAAT — Game Design Document (v3)

**Simulador de Atividades de Alta Tensão.** SE 138/13,8 kV "Vale Verde". Roda no navegador, em um arquivo único e offline.
Público: operadores, eletricistas e técnicos (NR-10 básico/SEP). Instrutor opcional.

## 1. Pilares
1. **Fazer com as mãos, não clicar em menus.** Você anda até o equipamento, segura a ferramenta certa e atua na peça certa.
2. **Consequência real.** Um erro de segurança vira acidente visível (choque, arco, queimadura) e não só um "−15 pontos".
3. **Clareza para o técnico.** Na tela só aparece o essencial. O resto fica no tablet, que o personagem segura no 3D.
4. **Rastreável.** Toda ação fica registrada, gera nota por competência e pode ser revista (replay) pelo instrutor.

Realismo seletivo: o projeto detalha equipamento, procedimento, EPI e consequência. Burocracia, deslocamentos longos e tempos mortos são comprimidos.

## 2. Modos (tela inicial)
| Modo | Para quê | Regras |
|---|---|---|
| **Treinamento** | Aprender a missão | Níveis Básico → Intermediário → Avançado. O Básico mostra o roteiro e bloqueia ações sem EPI. |
| **Avaliação** | Prova oficial | Missão do nível liberado, sem dicas, sem roteiro. A nota fica registrada como "avaliação". |
| **Emergência e resgate** | NR-10 10.12 | Choque em cubículo, condutor caído (tensão de passo) e incêndio no trafo. Inclui RCP e DEA. |
| **Prática livre** | Explorar e testar | Sem nota. Zonas NR-10 visíveis, teleporte pelo mapa, injeção de falhas no tablet. |
| **Resultados** | Acompanhar evolução | Histórico, competências, erros recorrentes e relatório para impressão. |
| **Instrutor** | Conduzir a turma | Console em segunda janela: ao vivo, eventos, avaliação e replay. |

Configurações (ícone de engrenagem): gráficos, áudio, controles, dados (JSON), diagnóstico e teste de funções.

## 3. Controles
| Tecla | Ação |
|---|---|
| WASD / setas | andar |
| Shift | apressar o passo |
| Mouse | olhar (mouse preso; clique na tela para prender) |
| **E** | interagir com o que está na mira (até 1,8 m) |
| Clique (modo inspeção) | atuar na peça (botão, chave, porta, manivela) |
| 1–6 / roda do mouse | escolher a ferramenta na mão |
| Q | guardar a ferramenta |
| **Tab** | tablet (OS, tarefas, assistente, rádio, mapa, fichas) |
| M | minimapa no canto (liga/desliga) |
| R | rádio: repetir a ordem do COS (read-back) |
| Esc | sair da inspeção / pausa |

Sem teleporte no treino e na avaliação. Portas, portão e armários abrem com E.

## 4. Ciclo da missão
**OS → briefing → APR → EPI e ferramentas → deslocamento → execução → registro → debriefing.**
1. **OS** chega no tablet. No briefing, o personagem está na casa de comando.
2. **APR** é preenchida no tablet. Missões de manutenção exigem APR; atendimento de ocorrência é dispensado.
3. **Armários.** O treinando abre o armário, pega cada item, inspeciona (luva: teste de ar; detector: autoteste) e veste. O que ele veste aparece no corpo: mãos com luva, viseira do protetor facial na tela.
4. **Execução.** Comandos remotos são dados na mesa do supervisório (sentar → monitor em tela cheia). Comandos locais são dados no equipamento, em modo inspeção. Comunicação com o COS é pelo rádio (tablet ou R).
5. **Registro.** PT, folha de leitura e relato de anomalias, tudo no tablet.
6. **Debriefing.** Nota por competência, linha do tempo, erros com a regra NR-10 citada e replay.

## 5. Interação
- **Mira + E.** Ao mirar algo interativo, aparece `[E] Abrir porta — Porta da casa de comando`. Fora do alcance, nada aparece.
- **Modo inspeção.** Com E num equipamento com painel (cubículo, caixa de comando, painel local do trafo, QGCA, PPC, armário):
  - a câmera se aproxima e o mouse fica livre;
  - as peças reais ficam clicáveis: botões, chave 43, porta, ranhura da manivela, ranhura da chave de terra e porta-cadeado;
  - um cartão lateral mostra estado, leituras e as ações procedimentais do local.
- **Ferramenta na mão.**
  - Atuar em uma peça exige a ferramenta certa: manivela para extrair, alavanca para a terra, detector para constatar, kit LOTO para bloquear.
  - Sem a ferramenta, a peça explica o que falta.
- **Supervisório.** E na mesa → sentar → o monitor ocupa a tela. Esc para levantar.

## 6. Consequências
| Situação | O que acontece | Resultado |
|---|---|---|
| Entrar na zona de risco de parte energizada (veneziana forçada, tampa traseira aberta com cabo vivo, condutor caído) | Choque: clarão, zumbido, queda da câmera, tela escurece | Falha crítica. Pode virar cenário de resgate |
| Tensão de passo perto de condutor caído (raio de 10 m) | Formigamento e aviso; perto demais, choque | Erro maior ou crítico |
| Arco elétrico (extrair sob carga, aterrar ponto vivo) | Clarão + estrondo + calor | A lesão depende do EPI (vestimenta ATPV, protetor facial, balaclava, luvas) |
| Sem EPI na área (capacete, óculos, botina) | Aviso; no Básico, bloqueio | Erro menor |
| Ferramenta não isolada nos bornes da bateria | Faísca, arco CC | Erro maior + queimadura leve |
| Ácido sem EPI químico | Respingo nos olhos | Lesão leve + lava-olhos |

**Tela de acidente:** o que aconteceu, por quê, qual regra (NR-10 / NR-6), o que teria evitado. Opções: **Iniciar resgate**, **Rever**, **Tentar de novo**.

## 7. Resgate (NR-10 10.12.2)
Sequência avaliada:
1. Não tocar.
2. Isolar a fonte: abrir o disjuntor que alimenta ou pedir ao COS.
3. Constatar a ausência de tensão.
4. Se não for possível desligar: afastar com vara isolada, luvas e tapete.
5. Acionar emergência (rádio, 193/192, botoeira).
6. Avaliar a vítima: consciência e respiração em 10 s.
7. RCP: 30 compressões a 100–120/min, ritmo marcado com Espaço.
8. DEA: buscar, ligar, aplicar as pás, choque se indicado, retomar RCP.
9. Chegada do socorro.

Nota por tempo até isolar, contato indevido, qualidade do ritmo e tempo até o DEA.

## 8. HUD (o mínimo)
- **Superior esquerdo:** objetivo atual, em 1 linha. No Básico, o próximo passo do roteiro.
- **Superior direito:** relógio da simulação e sino de alarmes (número + piscar). Mais nada.
- **Centro:** ponto de mira (só com o mouse preso) e prompt de interação.
- **Inferior esquerdo:** EPI vestido, em ícones.
- **Inferior direito:** ferramenta na mão.
- **Legendas do rádio** na parte de baixo, como diálogo de jogo.
- **Avisos curtos:** máx. 2 simultâneos, 4 s.

## 9. Tablet (diegético)
Robusto, nas mãos do personagem (com a luva que ele estiver usando). Apps:

| App | Conteúdo |
|---|---|
| **Tarefa** | OS, objetivo, roteiro (Básico), checklist |
| **APR/PT** | Formulários |
| **Rádio** | Mensagens do COS, read-back e ações de comunicação |
| **Assistente** | Busca e comparação, prévia de manobra, FMEA |
| **Mapa** | Planta com a posição. Na prática livre, toque para ir |
| **Fichas** | Biblioteca técnica |
| **EPI** | O que está comigo |
| **Leituras** | Folha de leitura |

Abrir o tablet não pausa a simulação. Dá para andar devagar com ele aberto.

## 10. Mundo
- **Pátio:** planta Rev 1 (cerca, portão, pórtico de 1 linha, bays B1–B9, barramento, TR-01/TR-02 com bacia e parede corta-fogo, canaletas, iluminação, ponto de encontro).
- **Casa de comando:** EQ-1 (cubículos), EQ-2 (PPC + mesa), EQ-3 (QGCA, retificadores, QDCC), sala de baterias, armários, DEA e extintores.
- **Renderização por zona:** dentro da casa não se desenha o pátio, salvo por porta aberta. O pátio é dividido em blocos com recorte por visão.
- **Som espacial:** zumbido dos trafos, vento externo, ar-condicionado interno, passos (brita/piso), portas, manobras, rádio.

## 11. Avaliação
Competências: segurança, sequência, diagnóstico, comunicação, tempo. Nota ≥ 70 % sem erro crítico = aprovado.
Acidente = crítico. O nível seguinte é liberado com todas as missões do nível aprovadas.

## 12. Fora de escopo (por ora)
Multijogador, VR, voz do treinando, física de corpo rígido, escalada de estruturas.
