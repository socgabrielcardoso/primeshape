# Arquitetura do PrimeShape

O PrimeShape é um laboratório de visão computacional com duas rotas de execução: **navegador (padrão)** e **serviços locais opcionais**. Os dois motores são implementações independentes; resultados semelhantes não significam equivalência métrica ou validação clínica.

## Fluxo padrão (sem backend)

```text
Webcam -> Camera (ImageData) -> Web Worker -> MediaPipe Hand/Face
                                         |-> controle de iluminação das mãos
                                         |-> HandTracker: associação, suavização e expiração
                                         |-> análise geométrica de dedos e sinais faciais
                                         |-> detector opcional de contornos (OpenCV.js)
       -> HandShapeTracker -> Presentation + Overlay -> tela
```

- `frontend/js/camera.js`: autorização da câmera, captura e dimensionamento.
- `frontend/js/browser-api.js`: transporte de quadros e cancelamento do Web Worker.
- `frontend/js/browser/worker.js`: inicialização, análise, fallback GPU/CPU e cronograma.
- `frontend/js/browser/hand-tracking.js`: identidade temporária dos dois rastros, amortecimento de jitter e limpeza de perdas.
- `frontend/js/browser/hands.js`: geometria, dedos, lateralidade e gestos.
- `frontend/js/hand-shapes.js`: geometria bimanual, histerese de rótulos e exclusão de mãos recuperadas.
- `frontend/js/browser/face.js`: análise de sinais faciais observáveis.
- `frontend/js/overlay.js` e `presentation.js`: camadas visuais e acessibilidade dos resultados.

Não há reconhecimento de identidade pessoal, comparação biométrica entre usuários ou inferência confiável de emoções ou condições de saúde.

## Fluxo com serviços auxiliares

```text
Webcam -> JPEG -> Java Gateway (127.0.0.1:8080)
                        -> token de sessão + validações HTTP
                        -> VisionClient -> FastAPI (127.0.0.1:8765)
                                              -> MediaPipe + OpenCV
                                              -> rastreamento + sinais
                        <- JSON normalizado <-+
           -> interface
```

- O Java controla sessões temporárias, ordenação de quadros e limites de concorrência.
- O Python mantém o estado temporal por sessão e executa os modelos.
- `scripts/run.py` inicializa processos locais e gera um token de serviço em memória por execução.
- Nenhum serviço é projetado para exposição pública, nem para uso como API multiusuário em produção.

## Ciclo de vida de rastreamento

1. Validar 21 landmarks de imagem e de mundo antes de associá-los.
2. Associar detecções a rastros existentes usando proximidade, escala e lateralidade.
3. Limitar saltos excessivos de centro e de pontos isolados; suavizar posições.
4. Durante perda curta, exibir rastro temporário como recuperado, **sem produzir gestos novos**.
5. Após expiração, descartar o rastro; novas detecções recebem identidade nova.
6. No encerramento da câmera, limpar estado de análise e efeitos da interface.

## Limites e decisões

- Identidades de rastros **não são identidades de pessoas** e podem mudar após oclusões.
- Contraste, ruído da câmera, sombras e distância afetam a detecção.
- Classificação por geometria é aproximação visual, não medição física.
- A interface não deve converter sinais aparentes em diagnóstico ou alerta clínico.
- Evitar dependências obrigatórias dos serviços auxiliares no caminho crítico do navegador.

## Onde adicionar recursos

- Novos gestos: manter regras coerentes em `frontend/js/browser/hands.js` e `backend/python/primeshape/hands.py`.
- Rastreamento: alterar JS e Python de forma pareada; adicionar cenário em `tests/tracking_scenarios.json`.
- Mudanças de UI: `index.html`, `frontend/css/style.css`, `frontend/js/presentation.js`.
- Testes: `tests/browser/` e `tests/`; instruções em `docs/TESTING.md`.
