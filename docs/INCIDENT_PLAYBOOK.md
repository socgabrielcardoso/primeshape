# Playbook de resposta a incidentes — primeshape

## Ativação
Acionar este procedimento se **frame de câmera sai do host local, backend fica acessível na rede ou modelo remoto é adulterado**. Trate como hipótese até preservar evidências; não tire conclusões sem logs e reprodução.

## P0 — Contenção imediata
1. Suspender publicação/deploy ou desativar a funcionalidade atingida quando houver risco ativo.
2. Revogar e rotacionar tokens potencialmente expostos, inclusive em integrações externas. Atualizar também ambientes de produção e CI.
3. Preservar logs sanitizados, horário UTC, SHA do release e evidências de integridade. **Nunca copie segredo em issue pública.**
4. Identificar impacto: usuários, dados tratados, APIs terceirizadas, custo e janela temporal. Se houver dados pessoais ou corporativos, envolver responsável legal/privacidade.

## P1 — Investigação
| Pergunta | Evidência preferencial |
| --- | --- |
| O que disparou o evento? | Alertas, requisições anonimizadas e commit associado |
| Qual foi a superfície comprometida? | Entrada, rota, dependência ou ambiente |
| Houve acesso ou saída não autorizada? | Logs de rede e permissões, respeitando privacidade |
| Qual o raio de impacto? | Chaves, sessões, dispositivos, usuários e tempo |
| Como reproduzir sem dano? | Fixture sintética em ambiente isolado |

## P2 — Erradicação e recuperação
Corrigir causa raiz; adicionar teste que falha na versão vulnerável e passa na corrigida; executar CI, dependências e checagens manuais. Publicar apenas após revisão e verificação de rollback. Quando o problema envolver fornecedor, validar também resposta externa.

## P3 — Pós-incidente
Registrar linha do tempo, decisões, impacto confirmado, severidade, controles que falharam e ações de prevenção. Caso haja vazamento de dados, cumprir processo de notificação e requisitos aplicáveis ao ambiente real.

**Escalonamento:** criar issue **privada** ou utilizar o procedimento do `SECURITY.md`; jamais publicar PoC com credenciais reais. Este playbook não equivale a monitoramento 24×7.
