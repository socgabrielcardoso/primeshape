# PrimeShape

> **Computer Vision Lab com foco em simplicidade, eficiência e processamento local.**

O **PrimeShape** transforma a webcam em uma interface direta para estudar mãos, formas, rosto e sinais visuais aparentes. A prioridade é clara: câmera no centro, resultados objetivos, controles avançados só quando necessários e nenhuma camada visual sem função.

Este projeto **não é uma ferramenta médica, psicológica, biométrica ou de vigilância** e não deve ser usado para tomada automatizada de decisão sobre pessoas.

## Visão geral

A aplicação combina uma interface web com rotinas de análise visual para interpretar informações capturadas pela câmera. O fluxo principal roda diretamente no navegador e a estrutura também suporta componentes auxiliares em Python e Java.

## Principais recursos

- Detecção de formas construídas com as mãos.
- Contagem e acompanhamento de até duas mãos.
- Marcação visual concentrada nas pontas dos dedos.
- Análise de rosto, olhos e boca.
- Classificação experimental de estados e expressões aparentes a partir de sinais visuais.
- Detecção opcional de formas presentes em objetos e contornos da imagem.
- Controle da taxa de análise para equilibrar responsividade e consumo de recursos.
- Processamento padrão no navegador.
- Estrutura opcional com serviços auxiliares em Python e Java.

## Como funciona

No modo padrão, o navegador solicita acesso à webcam e executa a experiência visual localmente. A interface recebe os resultados da análise e atualiza as marcações em tempo real.

O PrimeShape prioriza execução simples e feedback rápido, evitando depender de backend para o uso básico.

## Modos de execução

### Modo leve — recomendado

1. Abra a pasta do repositório no **Visual Studio Code**.
2. Tenha a extensão **Live Server** instalada.
3. Abra `index.html` com o Live Server.
4. Acesse a página no **Chrome** ou **Edge**.
5. Clique em **INICIAR CÂMERA**.
6. Autorize o acesso à webcam.

### Modo com serviços auxiliares

```bat
iniciar.bat
```

O script tenta localizar Python 3.12, depois Python 3.11 e, como alternativa, o comando `python`, iniciando `scripts/bootstrap.py`.

## Requisitos

### Modo leve

- Windows
- Visual Studio Code
- Extensão Live Server
- Google Chrome ou Microsoft Edge atualizado
- Webcam disponível e autorizada

### Serviços auxiliares

- Python 3.11 ou 3.12 recomendado
- Dependências exigidas pelos componentes auxiliares
- JDK 17 quando os recursos Java forem utilizados

## Estrutura

```text
primeshape/
├── .github/workflows/   # Validações automatizadas
├── backend/             # Serviços auxiliares
├── config/              # Configurações do projeto
├── frontend/            # Interface, estilos e JavaScript
├── models/              # Recursos relacionados aos modelos
├── scripts/             # Scripts de inicialização e suporte
├── tests/               # Testes automatizados e de navegador
├── index.html           # Entrada principal da aplicação
├── iniciar.bat          # Inicialização do modo com serviços
└── README.md            # Documentação principal
```

## Validação automática

O repositório possui workflow do GitHub Actions executado em alterações no branch `main`, incluindo:

- verificação de sintaxe dos arquivos JavaScript;
- testes de lógica relacionados à geometria e expressões aparentes;
- preparação do ambiente de testes de navegador;
- execução de testes com Chromium via Playwright;
- validação do modo leve por servidor estático.

Em caso de falha nos testes de navegador, o workflow pode publicar artefatos de diagnóstico.

## Privacidade

No fluxo padrão, a imagem da webcam é processada localmente no navegador. O projeto não foi desenhado para gravar continuamente imagens da câmera em servidor próprio.

Qualquer evolução futura que adicione APIs, armazenamento, telemetria ou serviços externos deve ser revisada separadamente para preservar esse comportamento.

## Limitações

- Resultados dependem de iluminação, enquadramento, qualidade da câmera e visibilidade das mãos ou do rosto.
- Inferências de expressão ou estado aparente são experimentais e podem apresentar falsos positivos.
- O comportamento pode variar entre navegadores e dispositivos.

## Solução rápida de problemas

### A câmera não abre

- Confirme se o navegador recebeu permissão para usar a webcam.
- Feche outros aplicativos que possam estar usando a câmera.
- Recarregue a página depois de liberar a permissão.

### O Live Server não inicia

- Confirme se a extensão está instalada e habilitada no VS Code.
- Abra a pasta completa do projeto antes de iniciar `index.html`.

### O modo com serviços não inicia

- Valide se Python está disponível com `python --version` ou `py -3.12 --version`.
- Execute `iniciar.bat` a partir da raiz do projeto.
- Revise a saída do terminal para identificar dependências ausentes.

---

**Categoria:** Computer Vision • Browser • Python • Java • Technical Lab

**Status:** projeto experimental em evolução para estudo e prática técnica.
