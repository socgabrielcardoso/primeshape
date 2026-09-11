# PrimeShape

Sistema experimental de visão computacional para análise visual em tempo real pela webcam, com foco em formas, mãos, rosto e sinais aparentes de expressão.

O PrimeShape foi construído para executar a experiência diretamente no navegador, mantendo o processamento visual local e oferecendo uma interface simples para explorar reconhecimento geométrico e sinais faciais sem depender de upload contínuo de imagens para um servidor próprio.

## Principais recursos

- Detecção de formas construídas com as mãos.
- Contagem e acompanhamento de até duas mãos.
- Marcação visual concentrada nas pontas dos dedos.
- Análise de rosto, olhos e boca.
- Classificação de estados aparentes e expressões a partir de sinais visuais.
- Detecção opcional de formas presentes em objetos e contornos da imagem.
- Controle de taxa de análise para equilibrar responsividade e consumo de recursos.
- Processamento padrão no navegador, com modo opcional utilizando serviços Python + Java.

O projeto prioriza feedback visual imediato e deixa claro que inferências de expressão ou estado aparente são experimentais e não possuem finalidade clínica.

## Arquitetura e execução

A estrutura separa frontend, backend, configuração, modelos, scripts e testes. No modo mais leve, a aplicação pode ser iniciada diretamente com Live Server em Windows usando Chrome ou Edge. O modo de serviços expande a arquitetura com componentes em Python e Java.

### Execução rápida

1. Abra a pasta do projeto no Visual Studio Code.
2. Inicie `index.html` com **Live Server**.
3. Clique em **INICIAR CÂMERA**.
4. Autorize o acesso à webcam.

Para o modo de serviços, utilize `iniciar.bat` com Python 3.12 e JDK 17 disponíveis.

## Privacidade e propósito

A aplicação foi desenhada como laboratório de visão computacional e interação humano-computador. No fluxo padrão, a imagem da câmera é processada localmente no navegador e o projeto não grava imagens em servidor próprio.

PrimeShape demonstra integração entre interface web, modelos de visão e serviços auxiliares em uma experiência voltada a desempenho, experimentação e evolução incremental.
