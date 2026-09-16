# PrimeShape

> Laboratório experimental de visão computacional em tempo real, executado principalmente no navegador e orientado à análise de formas, mãos, rosto e sinais visuais aparentes.

O **PrimeShape** foi criado para explorar visão computacional e interação humano-computador de forma prática, com feedback visual imediato pela webcam e processamento local no fluxo padrão. O objetivo é manter uma base simples de executar, fácil de validar e aberta à evolução incremental.

## Visão geral

A aplicação combina uma interface web com rotinas de análise visual para interpretar informações capturadas pela câmera. O projeto pode funcionar em um modo leve, diretamente pelo navegador, e também possui uma estrutura preparada para componentes auxiliares em Python e Java.

O foco é experimentação técnica, aprendizado e demonstração de conceitos de visão computacional — não diagnóstico, identificação biométrica ou avaliação clínica.

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

No modo padrão, o navegador solicita acesso à webcam e executa a experiência visual localmente. A interface recebe os resultados da análise e atualiza as marcações em tempo real, permitindo acompanhar mãos, pontos de referência e outros sinais visuais suportados pelo projeto.

O PrimeShape prioriza execução simples e feedback rápido, evitando depender de um backend para o uso básico.

## Modos de execução

### Modo leve — recomendado para começar

Use este modo para abrir o projeto rapidamente no Windows:

1. Abra a pasta do repositório no **Visual Studio Code**.
2. Tenha a extensão **Live Server** instalada.
3. Abra `index.html` com o Live Server.
4. Acesse a página no **Chrome** ou **Edge**.
5. Clique em **INICIAR CÂMERA**.
6. Autorize o acesso à webcam quando o navegador solicitar.

### Modo com serviços auxiliares

Para utilizar a estrutura adicional do projeto, execute:

```bat
iniciar.bat
```

O script tenta localizar Python 3.12, depois Python 3.11 e, como alternativa, o comando `python`, iniciando `scripts/bootstrap.py`.

## Requisitos

### Para o modo leve

- Windows.
- Visual Studio Code.
- Extensão Live Server.
- Google Chrome ou Microsoft Edge atualizado.
- Webcam disponível e autorizada no navegador.

### Para o modo com serviços

- Python 3.11 ou 3.12 recomendado.
- Dependências exigidas pelos componentes auxiliares do projeto.
- JDK 17 quando os recursos Java forem utilizados.

## Estrutura do repositório

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

O repositório possui um workflow do GitHub Actions executado em alterações no branch `main`. A validação inclui:

- verificação de sintaxe dos arquivos JavaScript;
- testes de lógica relacionados à geometria e expressões aparentes;
- preparação do ambiente de testes de navegador;
- execução de testes com Chromium via Playwright;
- validação do modo leve por servidor estático.

Em caso de falha nos testes de navegador, o workflow pode publicar artefatos de diagnóstico para facilitar a análise.

## Privacidade

No fluxo padrão, a imagem da webcam é processada localmente no navegador. O projeto não foi desenhado para gravar continuamente imagens da câmera em um servidor próprio.

Mesmo assim, qualquer uso futuro que adicione APIs, armazenamento, telemetria ou serviços externos deve ser revisado separadamente para preservar esse comportamento.

## Limitações

- Resultados dependem de iluminação, enquadramento, qualidade da câmera e visibilidade das mãos ou do rosto.
- Inferências de expressão ou estado aparente são experimentais e podem apresentar falsos positivos ou interpretações incorretas.
- O projeto não deve ser utilizado como ferramenta médica, psicológica, biométrica, de vigilância ou de tomada automática de decisão sobre pessoas.
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

## Propósito do projeto

PrimeShape é um laboratório técnico para estudo, experimentação e evolução de soluções de visão computacional. A prioridade é manter o projeto executável, compreensível e testável enquanto novas capacidades são adicionadas de forma incremental.

---

**Status:** projeto experimental em evolução. Recursos, classificações e comportamento podem mudar conforme novos testes e melhorias forem incorporados.
