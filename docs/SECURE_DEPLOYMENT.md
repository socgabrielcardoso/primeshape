# Guia de implantação segura — primeshape

## Plataforma
Java/Python/JS local. A configuração de deploy é parte da segurança; código isolado não garante a proteção do ambiente publicado.

## Requisitos de publicação
- **HTTPS** com TLS atualizado e sem conteúdo misto; não expor consoles administrativos.
- **CSP via cabeçalhos HTTP** e `frame-ancestors 'none'` quando viável. GitHub Pages não aplica automaticamente arquivos `_headers`; configurar no host compatível.
- **Permissions-Policy** mínima, sobretudo câmera/microfone; revisar impacto no funcionamento legítimo.
- **Secrets** apenas em variáveis de ambiente/secret manager. Não inserir chaves em HTML, JS servido ao cliente ou README.
- **Logs** sem tokens, cookies, áudio, transcrições, dados pessoais ou conteúdo confidencial desnecessário.
- **Dependências** atualizadas após validação; alteração automática não dispensa revisão.
- **Configuração específica:** Backend restrito a 127.0.0.1 por padrão, CORS limitado ao frontend local e verificação de integridade de modelo.

## Validação pré-deploy
1. Executar scanner e testes da versão exata a publicar.
2. Revisar alterações de permissões, cookies, CORS, CSP, origin checks e caminho de dados.
3. Testar cenário de falha de serviço externo e abuso de requisições.
4. Confirmar que o rollback volta a commit assinado/revisado sem perder dados.
5. Inspecionar os cabeçalhos *na URL real publicada*; meta tags não substituem cabeçalhos de segurança.

**Bloqueador:** Nunca subir webcam sem gesto do usuário e liberar streams ao encerrar.

## Evidências exigidas
Registrar SHA, URL/ambiente (sem tokens), resposta HTTP de cabeçalhos, log sanitizado do CI, matriz de risco residual e aprovador. Status deste guia: **procedimento recomendado, não execução certificada**.
