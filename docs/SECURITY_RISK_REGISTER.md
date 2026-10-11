# Registro de riscos — primeshape

## Escopo e limites
**Sistema:** análise local de câmera com componentes Python/Java e JS. **Superfícies:** webcam, modelos externos e possível serviço local.
Este registro descreve riscos a avaliar, não certifica ausência de vulnerabilidades. Nenhum projeto deve ser usado como garantia de segurança empresarial sem testes, revisão e configuração do ambiente.

## Avaliação inicial

| Risco | Impacto possível | Tratamento proposto | Critério de aceite |
| --- | --- | --- | --- |
| Entrada não confiável | Alteração do fluxo ou exposição de dados | consentimento para câmera, host loopback e integridade de modelos | Teste negativo reproduzível e revisão de código |
| Exposição de segredos | Abuso de APIs e acesso não autorizado | Scanner automatizado, segredos fora do repositório e rotação | Nenhuma credencial real no repositório ou artefatos |
| Dependência comprometida | Código malicioso na build ou runtime | Atualizações revisadas via Dependabot, versões rastreáveis | Mudanças de dependências com teste e revisão |
| Dados sensíveis em demonstrações | Vazamento de dados operacionais e pessoais | Apenas fixtures sintéticas e sanitização de evidências | Nenhum dado corporativo/pessoal em capturas públicas |
| Falha em configuração/deploy | Maior exposição da superfície de ataque | HTTPS, menor privilégio, controles de origem adequados | Checklist de implantação concluído |

**Hipóteses específicas de abuso:** exposição de frames, download de modelos não verificados e acesso indevido a portas locais.

## Processo de revisão
1. Classifique severidade por **impacto × probabilidade** no contexto real.
2. Abra issue com reprodução anonimizada, componente afetado e mitigação.
3. Crie teste de regressão que falhe antes da correção.
4. Valide a correção no CI e revise o diff; não feche apenas por atualizar documentação.
5. Registre risco residual e data da próxima revisão.

**Status inicial:** riscos catalogados; não afirmar mitigação técnica como comprovada até os respectivos testes passarem.
