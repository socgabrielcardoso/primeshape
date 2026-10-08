# Diagnóstico e desempenho

O desempenho depende de CPU/GPU, câmera, resolução, iluminação, concorrência e custo da inferência. **Não há meta universal de FPS**; priorizar rastreamento legível e uma interface responsiva.

## Perfil recomendado

1. Inicie no modo Navegador local, sem detector de objetos.
2. Escolha até 10 análises/s para uma experiência equilibrada.
3. Use iluminação frontal difusa e mantenha ambas as mãos visíveis.
4. Diminua movimentos rápidos durante a calibração visual.
5. Ative detecção opcional de objetos apenas quando necessária; OpenCV.js adiciona custo de processamento.
6. Utilize o painel **DETALHES** para conferir latência, presença de mãos e mensagens de baixa qualidade.

## Causas frequentes de instabilidade

| Sintoma | Causa possível | Verificação |
| --- | --- | --- |
| Mãos somem por instantes | Oclusão, pouco contraste, velocidade | Teste mãos separadas e iluminação frontal |
| Pontas tremem | Sensibilidade do sensor e quantização de landmarks | Use imagem mais nítida e taxa de análise moderada |
| Gesto oscila entre rótulos | Geometria próxima aos limiares | Sustente a posição por mais quadros |
| Forma desaparece brevemente | Uma mão foi marcada como recuperada | Confirme ambas as mãos detectadas no quadro atual |
| FPS cai ao ativar objetos | Carregamento/inferência adicional | Desative o detector de objetos |
| Alto tempo de inferência inicial | Inicialização dos modelos/GPU | Diferencie carga inicial de comportamento contínuo |
| Não aparece câmera | Permissão, aba insegura, webcam ocupada | Abra via localhost e confira permissões |
| Modelo não carrega | Restrição de acesso à CDN ou rede | Confira DevTools > Network/Console |

## Como medir regressões

Registre, no mínimo, hardware, navegador, resolução, FPS configurado, iluminação, latência observada e evento que falhou. Faça comparação A/B com **os mesmos movimentos e condições**. Evite concluir que um algoritmo ficou mais preciso apenas por tornar a interface visualmente mais suave.

Use `tests/tracking_scenarios.json` para preservar contratos de rastreamento durante alterações, e `tests/browser/live-server.spec.js` para verificar a renderização. Ambos são testes funcionais: a aferição de precisão do MediaPipe exige um conjunto de vídeos com marcações de referência, distribuição de cenários e métricas separadas de falsos positivos e perdas de rastreamento.

## Alertas de qualidade

O aplicativo pode aplicar compensação adaptativa de luminosidade quando necessário; compensação não restaura detalhe que a câmera deixou de captar. Tratamento de outliers e smoothing também não devem mascarar ausência de detecção real. Quando rastros expirarem, é preferível remover a forma a exibir uma inferência inventada.
