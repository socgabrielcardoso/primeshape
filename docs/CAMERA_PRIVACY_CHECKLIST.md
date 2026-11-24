# Checklist de privacidade da câmera

Aplicável ao modo leve do PrimeShape. Este checklist descreve verificações manuais; não representa aprovação automática.

## Antes de iniciar
- Abrir o aplicativo em `localhost` ou origem HTTPS confiável.
- Verificar que a câmera permanece desligada até uma ação explícita do usuário.
- Negar a permissão e confirmar que a interface informa o bloqueio sem travar.
- Confirmar que nenhum frame, imagem ou identificador é enviado a endpoints inesperados usando a aba Network do navegador.

## Durante a sessão
- Conferir o indicador de uso da câmera no navegador/sistema.
- Verificar que o usuário consegue parar a captura sem fechar a aba.
- Testar alternância de câmera ou desconexão do dispositivo sem expor stack traces.

## Encerramento
- Acionar Parar e confirmar que o indicador da câmera desaparece.
- Recarregar a página e verificar que não há início automático de captura.
- Registrar navegador, versão, sistema, SHA do commit e resultado de cada verificação.

**Atenção:** a ausência de requisições visíveis no DevTools não prova ausência de todos os fluxos de dados. Inspecionar também scripts e integrações externas antes de publicação.
