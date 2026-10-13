# Mapeamento do ManyChat (observação só leitura, 2026-10-13)

Fonte: navegação manual na conta Free, sem criar/salvar/publicar nada. Registro de estrutura e comportamento, sem código, textos ou imagens de terceiros.

## Telas
| Tela | Rota | Conteúdo |
|---|---|---|
| Início | dashboard | modelos, próximas ações |
| Contatos | subscribers | lista, criar, importar, ações em lote, filtro (segmentos são PRO) |
| Automação | cms | pastas, busca, lixeira, lista de automações com status (LIVE/STOPPED) |
| IA | ai | respostas, comentários, metas (beta) |
| Caixa de entrada | chat | abas: todas, lembretes, abertas, não lidas |
| Configurações | settings | geral, notificações, membros, registros, canais, campos, tags, API, integrações, modelos |

## Automação
- Construtor simples (easy-builder): 3 blocos — gatilho (comentário em post/Reel), palavra-chave, resposta (mensagem + botão de link). Métricas: envios, cliques.
- Canvas completo: gatilho "usuário envia DM" ligado a nós de ação. Alterna entre modos.
- Status: LIVE / STOPPED; versão publicada separada do rascunho.

## Lacunas (a mapear)
Paleta completa de blocos do canvas, Sequências, Transmissão, Campos do Bot, formato das respostas de rede.

## Rotas de rede observadas (nomes genéricos)
Campos disponíveis, lista de campos, dados de configuração, contadores da caixa de entrada, lista de pastas, post do gatilho. Listagens de contatos/automações não apareceram como XHR (possível WebSocket).

## Decisões de design deste projeto
- Fluxo = grafo (nós + arestas) em JSON; tipos: gatilho, mensagem, condição, ação, espera, fim.
- Motor puro e testável (api/src/engine) com efeitos injetados.
- Canais: Instagram (Graph API, Instagram Login) e WhatsApp (Evolution API).
- Lições do DirectFlow aplicadas: ID da conta Instagram = user_id da troca de token; CORS com allowlist de headers; envio WhatsApp sem o nono dígito; webhooks deduplicados; toda tabela declarada no Prisma.
