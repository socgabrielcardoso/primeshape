# Evidências de portfólio — primeshape

**Trilha:** Privacy Engineering / Computer Vision. Este repositório demonstra engenharia prática, mas não representa certificação de segurança ou case de produção.

## Problema e hipótese
**Cenário reproduzível:** webcam local com concessão e revogação de permissão. A hipótese só se confirma com execução e dados de teste documentados.

## Método
1. Definir entrada sintética e resultado esperado antes da execução.
2. Fixar commit SHA, versão do ambiente e dependências.
3. Executar caminho normal e cenários negativos; isolar serviços externos.
4. Capturar evidência sem dados privados nem tokens reais.
5. Comparar resultados com comportamento esperado e registrar limitações.

## Evidências técnicas sugeridas
- **Automação:** `python3 scripts/security_guard.py`, `python3 -m unittest discover -s tests -p test_security_guard.py`.
- **Testes específicos:** trace de rede e fluxo de consentimento.
- **Indicadores:** frames enviados externamente (esperado zero) e encerramento de stream. Publicar apenas valores **medidos** com fonte e janela temporal; nunca inventar 100% de eficácia.
- **Rastreabilidade:** link do código, teste, issue de risco, resultado da pipeline e changelog quando houver.

## Narrativa profissional para apresentação
> Escopo: laboratório controlado. Problema: webcam local com concessão e revogação de permissão. Método: entrada sintética, cenários positivos e negativos, revisão do código e registro de evidências. Resultado: a preencher com execução reproduzível. Limitações: dependências, segurança da configuração e ausência de auditoria externa.

## Checklist de publicação
Não publicar URLs internas, IPs corporativos, evidências reais de incidente, segredos, áudio, imagens privadas ou dados pessoais. Revisar licença de assets. Anotar falhas sem esconder métricas negativas.

**Estado atual:** plano de evidência preparado. Resultados de teste e métricas não presumidos.
