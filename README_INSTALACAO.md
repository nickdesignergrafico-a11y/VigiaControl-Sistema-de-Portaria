# Guia de Instalação - VigiaControl

Este documento descreve como instalar e rodar o sistema **VigiaControl** em um servidor local ou computador próprio.

## 1. Pré-requisitos

Antes de começar, certifique-se de ter instalado no computador:

*   **Node.js** (Versão 18 ou superior): [https://nodejs.org/](https://nodejs.org/)
*   **Gerenciador de pacotes NPM** (Vem instalado junto com o Node.js).

## 2. Preparação do Projeto

1.  Crie uma pasta para o projeto no seu computador.
2.  Copie todos os arquivos do projeto para esta pasta (incluindo `package.json`, `server.ts`, `vite.config.ts` e a pasta `src`).
3.  Abra o terminal (ou Prompt de Comando) dentro desta pasta.

## 3. Instalação das Dependências

No terminal, execute o comando abaixo para baixar as bibliotecas necessárias:

```bash
npm install
```

## 4. Compilação (Build)

Para preparar o sistema para uso em produção (mais rápido e estável), execute:

```bash
npm run build
```

## 5. Iniciando o Sistema

Para ligar o servidor, execute:

```bash
npm start
```

O sistema estará disponível em: `http://localhost:3000`

## 6. Acesso em Outros Dispositivos (Rede Local)

Se você quiser acessar o sistema de outros computadores ou celulares que estão no mesmo Wi-Fi/Rede:

1.  Descubra o IP do computador onde o sistema está rodando (No Windows, use o comando `ipconfig` no terminal).
2.  Exemplo de IP: `192.168.1.50`.
3.  Nos outros aparelhos, digite no navegador: `http://192.168.1.50:3000`.

## 7. Banco de Dados

*   O sistema utiliza **SQLite**, um banco de dados que não precisa de instalação externa.
*   Os dados ficam salvos em um arquivo chamado `vigia_control.db` na pasta raiz do projeto.
*   **Importante:** Faça cópias de segurança (backup) deste arquivo regularmente para não perder seus dados.

---
*Gerado automaticamente pelo VigiaControl Assistant.*
