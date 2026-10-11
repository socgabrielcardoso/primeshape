# Plano de validação — primeshape

**Stack:** Python/Java/JS webcam. Este documento é um roteiro de testes, não um certificado de aprovação.

## Gates reproduzíveis
```sh
python3 scripts/security_guard.py --self-test
python3 -m unittest discover -s tests -p test_security_guard.py
python3 scripts/security_guard.py
```

**Testes funcionais do projeto:** `python -m pytest`. Verifique ambiente, dependências e variáveis necessárias antes de executar. Não commit credenciais usadas nos testes.

## Cenários mínimos
1. **Caminho feliz:** python -m pytest
2. **Entrada adversarial:** Verificar consentimento e interrupção da câmera, falha de download de modelos e porta local.
3. **Sem segredo:** fixture sintética no lugar de token, e inspeção do diff antes de publicar.
4. **Falha segura:** serviço externo fora do ar, entrada inválida e negação de permissões retornam mensagem sem stack trace nem segredo.
5. **Dependências:** abra e revise PRs do Dependabot; execute testes antes de atualizar main.
6. **Privacidade:** verifique que dados sensíveis não foram enviados para telemetria externa ou capturas públicas.

## Evidência
Para cada teste registrar **commit SHA**, **sistema operacional**, **versão de runtime**, **comando**, **exit code**, **data UTC**, resultado PASS/FAIL e link do CI. Não preencher PASS antes da execução. Prints devem omitir IPs internos, nomes de usuário e tokens.

## Critérios de bloqueio
Vazamento de segredo, falha de autorização, execução não autorizada, upload de dados sem consentimento ou teste de regressão vermelho **bloqueiam a publicação**. Os demais achados recebem issue, severidade e prazo justificado.
