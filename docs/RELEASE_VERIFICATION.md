# Verificação de release

Use este roteiro antes de integrar ou publicar alterações no PrimeShape. Não considere um item aprovado sem evidência.

## Integridade do código
- Confirmar branch, SHA exato e arquivos alterados.
- Revisar o diff para detectar segredos, URLs internas e alterações inesperadas de permissões.
- Conferir se a alteração preserva o modo leve sem backend.
- Executar testes de sintaxe, unidade e navegador disponíveis no CI.

## Privacidade e segurança
- Revisar a [lista de privacidade da câmera](CAMERA_PRIVACY_CHECKLIST.md).
- Executar o [smoke test de navegador](BROWSER_SMOKE_TEST.md).
- Conferir cabeçalhos HTTP no ambiente real conforme [implantação segura](SECURE_DEPLOYMENT.md).
- Verificar que falhas de permissão e de serviço não expõem dados sensíveis.

## Publicação e retorno
1. Registrar SHA, resultado de testes e aprovador.
2. Publicar somente após os gates obrigatórios passarem.
3. Verificar fluxo principal no endereço publicado.
4. Se houver regressão, reverter para uma versão previamente validada, preservando evidências do incidente.

**Critério de bloqueio:** testes obrigatórios falhando, vazamento de segredo, captura sem consentimento ou transmissão não autorizada de imagens impedem o release.
