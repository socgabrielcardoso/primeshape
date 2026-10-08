# Executando e validando o PrimeShape

## 1. Validação local do modo navegador

Use Node.js 22, Python 3.11 e, para testes visuais, Chromium disponibilizado pelo Playwright.

```bash
# Na raiz do projeto: testes de lógica sem câmera
node --test tests/browser/logic.test.mjs tests/browser/tracker-regression.test.mjs

# Sintaxe JavaScript
node --check frontend/js/browser/hand-tracking.js
node --check frontend/js/hand-shapes.js

# Testes de navegação (dependências de desenvolvimento)
cd tests/browser
npm ci
npx playwright install chromium
npm test
```

Os testes de navegação podem exigir acesso à internet na primeira execução para baixar modelos e recursos de teste. O navegador precisa permitir uso de câmera simulada nos casos definidos em Playwright.

## 2. Validação dos algoritmos Python

Crie um ambiente virtual e instale as dependências do projeto. Para executar apenas rastreamento e gestos, `numpy`, `opencv-contrib-python` e `pytest` são suficientes. **Linux/macOS:**

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r backend/python/requirements.txt
python -m pip install -r backend/python/requirements-dev.txt
PYTHONPATH=backend/python python -m pytest -q tests/test_hand_tracking.py tests/test_hands.py tests/test_tracker_scenarios.py
```

**Windows PowerShell** (com o ambiente virtual ativado):

```powershell
$env:PYTHONPATH = "backend/python"
python -m pytest -q tests/test_hand_tracking.py tests/test_hands.py tests/test_tracker_scenarios.py
```

O corpus `tests/tracking_scenarios.json` exercita os mesmos cenários sintéticos de rastreamento em JS e Python. Os testes não medem taxa de acerto do modelo MediaPipe: verificam apenas comportamento determinístico do código.

## 3. Serviços opcionais e testes de integração

A validação completa com serviços depende de Python, JDK 17, modelos locais e ativos de teste:

```bash
python scripts/download_models.py
python scripts/download_test_assets.py
PYTHONPATH=backend/python python -m pytest -q tests/test_integration.py
```

Consulte `backend/python/requirements.txt` antes de instalar dependências; o download dos modelos verifica hashes definidos em `models/manifest.json`.

## 4. Teste manual com webcam

Faça verificações comparáveis com fundo neutro, boa iluminação, duas mãos separadas e depois parcialmente ocultas.

| Cenário | Comportamento esperado |
| --- | --- |
| Mãos abertas e imóveis | Landmarks não oscilam excessivamente |
| Uma mão cruza à frente da outra | Não surgem múltiplas mãos da mesma detecção |
| Uma mão desaparece por instante | Rastro curto pode permanecer, sem gerar novo gesto |
| Mão volta após expiração | Novo rastro substitui o antigo |
| Dedo atravessa borda do vídeo | Não deve produzir geometria remota |
| Câmera desconectada | Captura interrompida e UI em estado seguro |
| Pouca luz | Sinalização de baixa qualidade, sem prometer exatidão |

Registre navegador, SO, taxa de quadros, resolução, velocidade aproximada, iluminação e passos de reprodução nas issues.

## 5. Pull requests e CI

O workflow `.github/workflows/validate.yml` cobre sintaxe, lógica, regressões de mão e navegação. **Testes passando não constituem certificação clínica ou de segurança.** Para mudanças de detectores, anexar evidências de execução manual e informar limitações observadas.


## 6. Compilação e testes do gateway Java

O gateway usa JDK 17 sem dependências externas de compilação:

```bash
python scripts/build_java.py
javac -encoding UTF-8 --release 17 -cp backend/java/build -d backend/java/build tests/java/br/com/primeshape/GatewayRegressionTest.java
java -cp backend/java/build br.com.primeshape.GatewayRegressionTest
```

O teste verifica limites de sessão, expiração de sessões ociosas, proteção de sessões ocupadas e aceitação estrita de URLs locais. O CI executa o mesmo procedimento em um job independente; isso não substitui o teste integrado com Java + Python.
