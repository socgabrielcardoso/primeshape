# Privacidade, segurança e uso responsável

## Processamento de câmera

No modo **Navegador local**, o vídeo é obtido após autorização do browser. As imagens são analisadas por um Web Worker e os resultados geométricos são exibidos na página. Não há upload contínuo para um backend próprio nesse modo.

O primeiro carregamento dos modelos e de bibliotecas pode efetuar **requisições aos fornecedores de CDN e modelos** (MediaPipe/Google, jsDelivr). Isso não é equivalente a transmitir imagens da câmera; são downloads de código e arquivos de modelo. Confira as requisições no DevTools > Network quando avaliar a implantação.

No modo **Serviços Python + Java**, cada quadro JPEG trafega pela interface de loopback (127.0.0.1) até o serviço local. Não utilize esse modo expondo suas portas a outras redes: ele foi projetado para uso no próprio computador.

## Retenção e registros

- A implementação padrão não tem função de gravação contínua da webcam.
- Preferências de espelhamento, pontos, taxa de análise e objetos são persistidas no armazenamento local do navegador.
- Identificadores de rastreio representam **sequências de quadros**, não identidades pessoais.
- Sessões nos serviços locais são temporárias e armazenadas em memória; não são contas de usuários.
- O comportamento de dados de terceiros e provedores de CDN deve ser consultado nas políticas correspondentes.

## Limites científicos e éticos

**Não é dispositivo médico.** Indicadores de olhos, expressões e sinais aparentes não são diagnóstico de sono, dor, tristeza, ansiedade, raiva, alteração neurológica ou nível de consciência. O software não foi validado em estudos clínicos e não deve apoiar triagens médicas, monitoramento de pacientes, vigilância ou decisões automatizadas sobre indivíduos.

## Regras para quem contribuir

1. Não adicionar gravação, telemetria ou transmissão de imagem sem documentação explícita, consentimento e testes de privacidade.
2. Não coletar rostos reais ou fotos de pessoas para testes públicos sem direitos de uso apropriados; preferir dados sintéticos ou permissões documentadas.
3. Nunca inserir credenciais e tokens no Git.
4. Conservar escopo local do gateway e a verificação de hashes em downloads.
5. Descrever erros e limitações de detecção sem prometer acurácia de produção.

Vulnerabilidades devem seguir `SECURITY.md`. Problemas técnicos e erros de detecção podem ser relatados em issues com passos reproduzíveis.
