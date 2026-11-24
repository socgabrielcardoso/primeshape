# Smoke test manual do modo leve

Objetivo: validar rapidamente a experiência principal antes de publicar uma versão. Não substitui testes automatizados nem análise de segurança.

## Preparação
1. Servir a raiz do repositório via Live Server ou outro servidor HTTP local.
2. Abrir em Chrome ou Edge atualizado, com DevTools Console e Network disponíveis.
3. Usar webcam de teste e ambiente sem dados pessoais desnecessários.

## Casos
| Caso | Ação | Resultado esperado |
| --- | --- | --- |
| Permissão negada | Bloquear câmera | Mensagem clara e interface responsiva |
| Permissão concedida | Iniciar câmera | Prévia ativa e sem erro não tratado |
| Parada | Parar captura | Captura encerrada e indicador do dispositivo apagado |
| Sem dispositivo | Desconectar webcam antes de iniciar | Falha tratada sem travar a página |
| Repetição | Iniciar, parar e iniciar novamente | Nova sessão funcional sem múltiplos streams ativos |
| Preferências | Alterar opção persistida e recarregar | Preferência mantida conforme documentação |

## Registro de evidências
Anotar data UTC, commit SHA, navegador/versão, sistema operacional, caso, PASS/FAIL e link do CI. Em falha, registrar passos de reprodução e logs sanitizados. Não capturar rostos reais em screenshots públicos.
