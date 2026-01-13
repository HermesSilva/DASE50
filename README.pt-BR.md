<p align="center">
  <a href="README.md"><img src="https://img.shields.io/badge/lang-English-blue?style=for-the-badge" alt="English"><img src="https://flagcdn.com/48x36/gb.png" alt="English" title="English"></a>
  &nbsp;&nbsp;
  <a href="README.pt-BR.md"><img src="https://img.shields.io/badge/lang-Portugu%C3%AAs%20(Brasil)-green?style=for-the-badge" alt="Português (Brasil)">  <img src="https://flagcdn.com/48x36/br.png" alt="Brasil" title="Português (Brasil)">
</a>
</p>
[English](https://github.com/HermesSilva/DASE50#readme)
---

## TFX — Framework Base

[![CI](https://github.com/Tootega/DASE50/actions/workflows/ci.yml/badge.svg)](https://github.com/HermesSilva/DASE50/actions/workflows/ci.yml)
![Tests](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/HermesSilva/4a8de64c5760e89b94863a7f0d9ecc46/raw/tfx-tests.json)
![Lines](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/HermesSilva/4a8de64c5760e89b94863a7f0d9ecc46/raw/tfx-lines.json)
![Coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/HermesSilva/4a8de64c5760e89b94863a7f0d9ecc46/raw/tfx-coverage.json)

![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2020-blue.svg)
![Vitest](https://img.shields.io/badge/tested%20with-vitest-663399?logo=vitest)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-3178C6?logo=typescript&logoColor=white)
![AI Written](https://img.shields.io/badge/written%20by-AI-blueviolet)

## DASE — Extensão VS Code

[![CI](https://github.com/Tootega/DASE50/actions/workflows/ci.yml/badge.svg)](https://github.com/HermesSilva/DASE50/actions/workflows/ci.yml)
![Tests](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/HermesSilva/4a8de64c5760e89b94863a7f0d9ecc46/raw/dase-tests.json)
![Lines](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/HermesSilva/4a8de64c5760e89b94863a7f0d9ecc46/raw/dase-lines.json)
![Coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/HermesSilva/4a8de64c5760e89b94863a7f0d9ecc46/raw/dase-coverage.json)

![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2020-blue.svg)
![Jest](https://img.shields.io/badge/tested%20with-jest-C21325?logo=jest)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-3178C6?logo=typescript&logoColor=white)
![AI Written](https://img.shields.io/badge/written%20by-AI-blueviolet)

---

# DASE50 — Engenharia de Software Assistida por Design

## 🧪 Um Experimento em Desenvolvimento de Software Orientado por IA

**Este projeto é um experimento deliberado** de escrever um projeto de software de médio porte **inteiramente através de prompts de IA**, sem nenhuma codificação humana direta. Cada linha de código, teste, configuração e documentação foi gerada por IA (GitHub Copilot) com base em prompts cuidadosamente elaborados e instruções arquiteturais.

O objetivo é explorar:
- **Viabilidade:** A IA consegue escrever código de qualidade de produção a partir de descrições de alto nível?
- **Qualidade:** O código gerado por IA atende aos padrões profissionais de segurança, desempenho e manutenibilidade?
- **Cobertura:** A IA consegue atingir 100% de cobertura de testes mantendo a elegância do código?
- **Iteração:** Com que eficácia a IA consegue refatorar, depurar e estender bases de código existentes?

> *"O melhor código é aquele que se escreve sozinho — guiado por uma intenção clara."*

---

## 📋 Índice

- [Visão Geral do Projeto](#-visão-geral-do-projeto)
- [Princípios Filosóficos](#-princípios-filosóficos)  
- [Estrutura do Repositório](#-estrutura-do-repositório)
- [DASE — Extensão VS Code](#-dase--extensão-vs-code-1)
- [TFX — Tootega Framework X](#-tfx--tootega-framework-x)
- [Padrões de Qualidade de Código](#-padrões-de-qualidade-de-código)
- [Guia de Desenvolvimento](#-guia-de-desenvolvimento)
- [Pipeline CI/CD](#-pipeline-cicd)

---

## 🎯 Visão Geral do Projeto

**DASE** (Design-Aided Software Engineering — Engenharia de Software Assistida por Design) é um ambiente de design visual para modelagem e geração de aplicações web multicamadas, multiplataforma, multi-banco de dados e multiparadigma.

O projeto consiste em dois componentes principais:

| Componente | Descrição | Status |
|------------|-----------|--------|
| **[TFX/](TFX/)** | Biblioteca do framework base que fornece a fundação para extensões VS Code | ✅ Completo |
| **[DASE/](DASE/)** | Extensão VS Code que implementa designers visuais | 🚧 Em Desenvolvimento |

### Tecnologias Principais

- **TypeScript 5.3+** com convenções inspiradas em .NET
- **Node.js 20+** como runtime
- **Vitest** para testes unitários com cobertura
- **GitHub Actions** para automação CI/CD

---

## 🧭 Princípios Filosóficos

Estes princípios são a fundação por trás de cada diretriz neste documento.  
Eles existem para manter decisões consistentes quando surgem trade-offs.

1. O melhor código é aquele que se escreve sozinho — guiado por uma intenção clara.
2. Qualquer linha de código que não pode ser exercitada por testes automatizados não deveria existir.
3. Verdade acima de aparências: recusamos "teatro de métricas" (inflação de cobertura, branches artificiais, testes cosméticos).
4. Cobertura é evidência, não um objetivo: o objetivo é confiança no comportamento sob condições realistas.
5. Se um branch é verdadeiramente inalcançável, a ação correta é remoção ou um invariante explícito — não um teste fabricado.
6. Código inalcançável é um cheiro de design: ou o modelo está errado, ou o branch está morto, ou o contrato não está claro.
7. Prefira exclusão a decoração: remover caminhos mortos é maior qualidade do que "cobri-los".
8. Testes devem representar mundos plausíveis: um teste que não pode ocorrer em produção é documentação de ficção.
9. Todo teste deve responder uma pergunta: "Qual falha isso detectaria, e por que importaria?"
10. Asserções são contratos: valide invariantes onde eles pertencem, e teste através do comportamento público.
11. Contratos fortes reduzem ruído defensivo: menos "por via das dúvidas", mais "não pode acontecer por construção".
12. Escreva código que seja fácil de provar: clareza vence esperteza; determinismo vence surpresas.
13. Prefira verdade do domínio à conveniência do framework: o modelo dita o código, não o contrário.
14. Código é um passivo: cada linha adicionada DEVE pagar aluguel (valor claro, comportamento verificado).
15. Torne o estado explícito; estado implícito se torna bugs ocultos.
16. Otimize para o próximo leitor: o futuro mantenedor geralmente é você.
17. Complexidade deve ser conquistada por benefício mensurável; mecanismos simples escalam melhor.
18. Falhe rápido, falhe alto: rejeite entrada inválida cedo com erros precisos e acionáveis.
19. Meça antes de otimizar; otimize apenas o que o profiling prova ser crítico.
20. Segurança é um invariante, não uma funcionalidade.
21. Integridade é inegociável: não trocamos verdade por aparência, mesmo quando parece "melhor" no papel.
22. Um pipeline verde não é um certificado: é um sinal que deve permanecer honesto para manter significado.
23. Assim como 10 segundos de silêncio encerram uma vida de $3 \times 10^9$ batimentos, erros sequenciais são a ruína do software: continuidade é vida, estatísticas são uma ilusão.

---

## 📁 Estrutura do Repositório

```
DASE50/
├── .github/
│   ├── copilot-instructions.md    # Padrões de codificação IA
│   └── workflows/
│       └── ci.yml                 # Pipeline CI/CD
├── TFX/                           # Framework Base
│   ├── src/
│   │   ├── Core/                  # Classes fundamentais
│   │   ├── Data/                  # Motor de serialização
│   │   ├── Design/                # Elementos de design visual
│   │   └── Designers/             # Designers específicos de domínio
│   └── tests/                     # Testes unitários
├── DASE/                          # Extensão VS Code
│   ├── src/
│   │   ├── Commands/              # Comandos da extensão
│   │   ├── Designers/ORM/         # Designer ORM
│   │   ├── Models/                # Modelos de dados
│   │   ├── Services/              # Serviços de negócio
│   │   └── Views/                 # Visualizações de painéis
│   ├── media/                     # Assets do webview
│   └── src/__tests__/             # Testes unitários
└── README.md                      # Este arquivo
```

---

# 🎨 DASE — Extensão VS Code

**DASE** (Design-Aided Software Engineering — Engenharia de Software Assistida por Design) é uma extensão VS Code que fornece designers visuais para modelagem de software. O foco inicial é um **Designer ORM** para modelagem de esquemas de banco de dados.

## Visão

O DASE visa ser um ambiente de design visual abrangente suportando:
- 📊 **Designer ORM** — Modelagem de esquema de banco de dados (fase atual)
- 📐 **Designer de UI** — Layouts de interface de usuário (planejado)
- 🔄 **Designer de Fluxo** — Fluxos de processos de negócio (planejado)
- 📡 **Designer de API** — Modelagem de endpoints REST/GraphQL (planejado)

## Fase Atual: Designer ORM

### Funcionalidades

| Funcionalidade | Descrição | Status |
|----------------|-----------|--------|
| Editor Customizado | Abre arquivos `.dsorm` no designer visual | ✅ Implementado |
| Tabelas | Representação visual de tabelas com colunas | ✅ Implementado |
| Relacionamentos | Linhas visuais de relacionamento entre tabelas | ✅ Implementado |
| Painel de Propriedades | Editar propriedades do elemento selecionado | ✅ Implementado |
| Painel de Problemas | Erros e avisos de validação | ✅ Implementado |
| Menus de Contexto | Todas as ações via menus de clique direito | ✅ Implementado |
| Integração TFX | Ponte para o framework TFX para gerenciamento de modelo | ✅ Implementado |

### Arquitetura

```
DASE/src/
├── ExtensionMain.ts                  # Ponto de entrada da extensão
├── Commands/
│   ├── DeleteSelectedCommand.ts      # Comando para deletar elementos
│   ├── ReloadDataTypesCommand.ts     # Comando para recarregar tipos de dados
│   └── RenameSelectedCommand.ts      # Comando para renomear elemento
├── Designers/ORM/
│   ├── ORMDesignerEditorProvider.ts  # Provider do editor customizado
│   ├── ORMDesignerMessages.ts        # Tipos do protocolo de mensagens
│   ├── ORMDesignerState.ts           # Gerenciamento de estado em memória
│   └── Commands/                     # Comandos específicos do ORM
├── Models/
│   ├── DesignerSelection.ts          # Estruturas de dados de seleção
│   ├── IssueItem.ts                  # Representação de problema
│   └── PropertyItem.ts               # Representação de propriedade
├── Services/
│   ├── IssueService.ts               # Gerenciamento de problemas
│   ├── SelectionService.ts           # Estado de seleção
│   └── TFXBridge.ts                  # Integração com framework TFX
└── Views/
    ├── IssuesViewProvider.ts         # Painel de problemas
    └── PropertiesViewProvider.ts     # Painel de propriedades
```

### Protocolo de Mensagens

O designer usa um protocolo de mensagens tipado para comunicação com o webview:

| Tipo de Mensagem | Direção | Propósito |
|------------------|---------|-----------|
| `DesignerReady` | Webview → Extensão | Inicialização do webview completa |
| `LoadModel` | Extensão → Webview | Enviar dados do modelo para renderizar |
| `ModelLoaded` | Webview → Extensão | Confirmar que o modelo foi carregado |
| `SaveModel` | Webview → Extensão | Solicitar persistência do modelo |
| `SelectElement` | Webview → Extensão | Usuário selecionou um elemento |
| `SelectionChanged` | Extensão → Webview | Estado de seleção atualizado |
| `UpdateProperty` | Extensão → Webview | Valor de propriedade alterado |
| `PropertiesChanged` | Webview → Extensão | Propriedades precisam de atualização |
| `ValidateModel` | Ambos | Disparar validação |
| `IssuesChanged` | Extensão → Webview | Resultados de validação atualizados |

### Comandos de Menu de Contexto

**Canvas do Designer:**
- `Dase.AddTable` — Adicionar uma nova tabela ao modelo
- `Dase.AddRelation` — Adicionar um relacionamento entre tabelas
- `Dase.DeleteSelected` — Deletar elementos selecionados
- `Dase.RenameSelected` — Renomear elemento selecionado

**Explorer (arquivos .dsorm):**
- `Dase.OpenORMDesigner` — Abrir arquivo no designer visual
- `Dase.ValidateORMModel` — Validar modelo e popular Problemas

### Regras de Validação

O validador ORM (usando `XValidator<XORMDocument, XORMDesign>`) aplica:
- ❌ **Erro:** Nome da tabela não pode estar vazio
- ❌ **Erro:** Nomes de tabela duplicados não são permitidos
- ❌ **Erro:** Relacionamento referencia tabela inexistente
- ⚠️ **Aviso:** Tabela não tem colunas definidas

---

# 📦 TFX — Tootega Framework X

**TFX** é a biblioteca base que alimenta a extensão DASE. Ela fornece uma fundação robusta e type-safe para construir extensões VS Code com designers visuais complexos.

## Visão Geral da Arquitetura

O TFX é organizado em quatro módulos principais:

### 🔹 Módulo Core (`@tootega/tfx/Core`)

A camada de fundação que fornece blocos de construção essenciais:

| Classe | Propósito |
|--------|-----------|
| `XElement` | Classe base para todos os elementos hierárquicos com relacionamentos pai-filho |
| `XPersistableElement` | Elemento estendido com serialização, seleção e rastreamento de mudanças |
| `XProperty` | Sistema de propriedades reativas com metadados, validação e suporte a binding |
| `XEvent` | Sistema de dispatch de eventos type-safe |
| `XDispatcher` | Executor de ações com capacidade de enfileiramento |
| `XChangeTracker` | Rastreamento de undo/redo para modificações de elementos |
| `XValidation` | Framework de validação com níveis de severidade de erro |
| `XGuid` | Utilitários de geração e manipulação de GUID |
| `XConvert` | Utilitários de conversão de tipos |

**Tipos Geométricos:**
- `XPoint`, `XSize`, `XRect`, `XThickness` — Primitivas espaciais
- `XColor`, `XHSLColor`, `XBorderColor` — Gerenciamento de cores
- `XFont`, `XFontStyle` — Suporte tipográfico

### 🔹 Módulo Data (`@tootega/tfx/Data`)

Motor de serialização XML abrangente:

| Classe | Propósito |
|--------|-----------|
| `XSerializationEngine` | Orquestrador central para operações de serialização/deserialização |
| `XSerializationContext` | Gerencia estado de serialização, referências e erros |
| `XElementRegistry` | Registro de tipos para serialização polimórfica |
| `XmlWriter` | Geração de saída XML com opções de formatação |
| `XmlReader` | Parsing de XML com tratamento de namespace e atributos |
| `XTypeConverter` | Conversão de tipos customizada para serialização |

### 🔹 Módulo Design (`@tootega/tfx/Design`)

Primitivas de elementos de design visual:

| Classe | Propósito |
|--------|-----------|
| `XDocument<T>` | Container genérico de documento para designs |
| `XDesign` | Classe base para superfícies de design |
| `XDesignElement` | Elemento visual base com propriedades de layout |
| `XRectangle` | Forma retangular com bordas e estilização |
| `XLine` | Elemento de linha com estilos de terminação e junção |
| `XField` | Elemento de campo de texto |

### 🔹 Módulo Designers (`@tootega/tfx/Designers`)

Implementações de designers específicos de domínio:

| Classe | Propósito |
|--------|-----------|
| `XORMDocument` | Container de documento do modelo ORM |
| `XORMDesign` | Superfície de design ORM |
| `XORMTable` | Representação de tabela de banco de dados |
| `XORMField` | Definição de coluna/campo de tabela |
| `XORMPKField` | Definição de campo de chave primária |
| `XORMReference` | Relacionamento de tabela/chave estrangeira |
| `XORMController` | Controlador de operações ORM |
| `XORMValidator` | Validação de modelo ORM |

## Padrões de Design Principais

### Sistema de Propriedades Reativas

O TFX usa um sistema de propriedades sofisticado inspirado em WPF/XAML:

```typescript
// Registro de propriedade com metadados
public static readonly NameProp = XProperty.Register<XORMTable, string>(
    (p: XORMTable) => p.Name,
    "guid-here",
    "Name",
    "Table Name",
    ""
);

// Acesso à propriedade via GetValue/SetValue
public get Name(): string {
    return this.GetValue(XORMTable.NameProp) as string;
}

public set Name(pValue: string) {
    this.SetValue(XORMTable.NameProp, pValue);
}
```

### Modelo de Elementos Hierárquicos

Todos os elementos herdam de `XElement`, fornecendo:
- Navegação pai-filho (`ParentNode`, `ChildNodes`)
- Consultas de filhos type-safe (`GetChild<T>`, `GetChildDeep<T>`)
- Travessia de árvore (`GetTree()`)
- Gerenciamento de identidade (`ID`, `Name`)

### Rastreamento de Mudanças

Suporte embutido a undo/redo através de `XChangeTracker`:
- Gravação automática de mudanças de propriedades
- Agrupamento de transações
- Restauração de estado

### Framework de Validação

Validação declarativa com `XDataValidateError`:
- Níveis de severidade: `Warning`, `Error`
- Binding de erro específico por propriedade
- Coleta agregada de erros via `XConcurrentBag`

## Uso

```typescript
import { XORMDocument, XORMTable, XORMField } from "@tootega/tfx/Designers";
import { XSerializationEngine } from "@tootega/tfx/Data";

// Criar um novo documento ORM
const doc = new XORMDocument();
const table = new XORMTable();
table.Name = "Customers";
doc.Design?.AppendChild(table);

// Serializar para XML
const engine = XSerializationEngine.Instance;
const result = engine.Serialize(doc);
```

---

## 📜 Padrões de Qualidade de Código

Este projeto segue padrões de codificação estritos definidos em [.github/copilot-instructions.md](.github/copilot-instructions.md).

### Pilares de Qualidade (Ordem de Prioridade)

1. **🔒 Seguro** — Proteção contra ataques comuns
2. **✅ Correto** — Livre de bugs, lógica sólida
3. **⚡ Performático** — Alocação mínima de memória (mentalidade zero-allocation)
4. **📖 Claro** — Código autodocumentado (sem necessidade de comentários)
5. **🎯 Consistente** — Estilo uniforme em toda a base de código
6. **✨ Elegante** — Esteticamente agradável, fácil de navegar
7. **🔧 Manutenível** — Fácil de modificar e estender
8. **🧪 Testável** — Projetado para testes automatizados

### Convenções de Nomenclatura

| Elemento | Convenção | Exemplo |
|----------|-----------|---------|
| Classes/Tipos | `PascalCase` com prefixo `X` | `XUserService`, `XORMTable` |
| Interfaces | Prefixo `XI` + `PascalCase` | `XIRepository`, `XISerializable` |
| Métodos/Propriedades | `PascalCase` | `GetById`, `SaveChanges` |
| Campos Privados | Prefixo `_` + `PascalCase` | `_Cache`, `_Repository` |
| Parâmetros | Prefixo `p` + `PascalCase` | `pUserID`, `pOptions` |
| Variáveis Locais | Mnemônicos em minúsculas | `lstua`, `frsrt` |

### Regras de Estilo de Código

- ✅ Um tipo por arquivo
- ✅ Sem chaves para blocos de linha única
- ✅ Retornos antecipados (guard clauses)
- ✅ Sem comentários (código autodocumentado)
- ✅ Evitar lambdas em caminhos críticos
- ✅ Preferir loops explícitos a LINQ
- ✅ Usar classes `sealed` quando herança não é necessária

---

## 🏗️ Guia de Desenvolvimento

### Pré-requisitos

- Node.js 20+
- VS Code (versão mais recente)
- TypeScript 5.3+

### Desenvolvimento TFX

```powershell
# Navegar para o diretório TFX
cd TFX

# Instalar dependências
npm install

# Compilar o framework
npm run build

# Executar testes
npm run test

# Executar testes com cobertura
npm run test:coverage

# Modo watch para desenvolvimento
npm run test:watch
```

**Scripts TFX:**

| Script | Descrição |
|--------|-----------|
| `npm run build` | Compilar TypeScript para JavaScript (dist/) |
| `npm run watch` | Compilação em modo watch |
| `npm run test` | Executar todos os testes unitários com Vitest |
| `npm run test:coverage` | Gerar relatório de cobertura (100% obrigatório) |
| `npm run test:watch` | Modo watch interativo para testes |
| `npm run clean` | Remover artefatos de build (dist/) |
| `npm run lint` | Executar verificações ESLint |

### Desenvolvimento da Extensão DASE

```powershell
# Navegar para o diretório DASE
cd DASE

# Instalar dependências (inclui TFX local)
npm install

# Compilar a extensão
npm run compile

# Executar testes
npm run test

# Executar testes com cobertura
npm run test:coverage

# Iniciar extensão no VS Code
# Pressione F5 no VS Code, ou:
code --extensionDevelopmentPath=./DASE
```

**Scripts DASE:**

| Script | Descrição |
|--------|-----------|
| `npm run compile` | Compilar TypeScript para JavaScript (out/) |
| `npm run watch` | Compilação em modo watch |
| `npm run test` | Executar todos os testes unitários com Jest |
| `npm run test:coverage` | Gerar relatório de cobertura (100% obrigatório) |
| `npm run lint` | Executar verificações ESLint |
| `npm run package` | Criar pacote VSIX da extensão |

### Executando Ambos os Projetos

```powershell
# A partir da raiz do repositório, compilar tudo
cd TFX
npm ci
npm run build

cd ../DASE
npm ci
npm run compile

# Executar todos os testes
cd ../TFX && npm run test:coverage
cd ../DASE && npm run test:coverage
```

---

## 🚀 Pipeline CI/CD

O repositório usa um único workflow CI/CD unificado que compila e testa ambos os componentes:

### Framework TFX

**Workflow:** [.github/workflows/ci.yml](.github/workflows/ci.yml)

**Gatilhos:**
- Push para branch `master` (alterações em TFX/**)
- Pull requests para branch `master`

**Estágios do Pipeline:**
1. **Checkout** — Clonar repositório
2. **Setup Node.js 20** — Configurar ambiente Node.js
3. **Instalar Dependências** — Executar `npm ci` em TFX/
4. **Build** — Compilar TypeScript (`npm run build`)
5. **Teste** — Executar suíte de testes com Vitest
6. **Cobertura** — Gerar e validar 100% de cobertura
7. **Upload de Relatórios** — Publicar artefatos de cobertura

**Portões de Qualidade:**
- ✅ Todos os testes automatizados devem passar
- ✅ 100% de cobertura de código obrigatória
- ✅ Sem erros de compilação TypeScript
- ✅ Padrões zero-allocation aplicados

### Extensão DASE

**Workflow:** [.github/workflows/ci.yml](.github/workflows/ci.yml)

**Gatilhos:**
- Push para branch `master` (alterações em DASE/** ou TFX/**)
- Pull requests para branch `master`

**Estágios do Pipeline:**
1. **Checkout** — Clonar repositório
2. **Setup Node.js 20** — Configurar ambiente Node.js
3. **Build TFX** — Compilar dependência do framework
4. **Teste TFX** — Validar integridade do framework
5. **Instalar Dependências DASE** — Executar `npm ci` em DASE/
6. **Build DASE** — Compilar extensão (`npm run compile`)
7. **Lint** — Executar verificações ESLint
8. **Teste** — Executar suíte de testes com Jest
9. **Cobertura** — Gerar e validar 100% de cobertura
10. **Upload de Relatórios** — Publicar artefatos de cobertura
11. **Empacotamento** (apenas master) — Criar pacote VSIX da extensão

**Portões de Qualidade:**
- ✅ Todos os testes automatizados devem passar
- ✅ 100% de cobertura de código obrigatória
- ✅ Sem violações TypeScript/ESLint
- ✅ Integridade da dependência TFX validada
- ✅ Pacote VSIX compila com sucesso

**Artefatos:**
- Relatórios de cobertura (tanto TFX quanto DASE)
- Pacote VSIX da extensão (apenas branch master)

---

## 📄 Licença

Licença MIT — Veja [LICENSE](LICENSE) para detalhes.

---

<p align="center">
  <i>Construído inteiramente através de desenvolvimento orientado por IA com GitHub Copilot</i><br>
  <b>🤖 Nenhum humano escreveu este código diretamente — apenas prompts 🤖</b>
</p>
