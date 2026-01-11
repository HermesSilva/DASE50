# DASE50 Project

![Build Status](https://github.com/<OWNER>/<REPO>/actions/workflows/tfx-ci.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2020-blue.svg)
![Vitest](https://img.shields.io/badge/tested%20with-vitest-663399?logo=vitest)

Configurações para CI/CD e padrões de projeto para o ecossistema DASE50.

## 🚀 Estrutura do Repositório

O repositório está organizado nos seguintes subprojetos:

- **[TFX/](TFX/):** Tootega Framework X - Biblioteca Core para extensões do VS Code. Focada em performance extrema (zero-allocation mindset), segurança e corretude.
- **[DASE/](DASE/):** (Em desenvolvimento) Componentes específicos do projeto DASE.

## 🛠️ Tecnologias Principais

- **TypeScript** (.NET-like standards)
- **Node.js 20+**
- **Vitest** (Unit Testing)
- **GitHub Actions** (CI/CD)

## 🏗️ Desenvolvimento (TFX)

### Instalação

```powershell
cd TFX
npm install
```

### Build

```powershell
npm run build
```

### Testes e Cobertura

```powershell
# Rodar todos os testes
npm run test

# Rodar testes com cobertura
npm run test:coverage
```

## 📜 Padrões de Código

Este projeto segue padrões rigorosos de codificação definidos em [.github/copilot-instructions.md](.github/copilot-instructions.md).

Os principais pilares são:
1. **Seguro:** Proteção contra ataques comuns.
2. **Correto:** Lógica sólida e livre de bugs.
3. **Performático:** Alocação de memória mínima.
4. **Claro:** Código autoexplicativo (sem comentários desnecessários).

## 🚀 CI/CD

O workflow de integração contínua ([tfx-ci.yml](.github/workflows/tfx-ci.yml)) é executado automaticamente em cada `push` ou `pull_request` para a branch `master`, garantindo que o build e os testes estejam sempre passando.
