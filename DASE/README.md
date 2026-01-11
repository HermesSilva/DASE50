# DASE — Design-Aided Software Engineering

[![DASE CI](https://github.com/Tootega/DASE50/actions/workflows/dase-ci.yml/badge.svg)](https://github.com/Tootega/DASE50/actions/workflows/dase-ci.yml)
![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)
![Tests](https://img.shields.io/badge/tests-341%20passed-brightgreen)
![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2020-blue.svg)
![Jest](https://img.shields.io/badge/tested%20with-jest-C21325?logo=jest)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-3178C6?logo=typescript&logoColor=white)
![AI Written](https://img.shields.io/badge/written%20by-AI-blueviolet)

> Visual design environment for modeling and generating multi-tier, multi-platform, multi-database, and multi-paradigm web applications.

## Overview

DASE is a VS Code extension that provides visual designers for software modeling. The current phase implements the **ORM Designer** for creating Entity-Relationship models using `.daseorm.json` files.

**Key Characteristics:**
- 🎨 **Visual-First Design:** Context menu-driven interactions
- 🔗 **TFX Integration:** Built on the TFX framework for robust model management
- ✅ **100% Test Coverage:** Every line covered by automated tests
- 🔒 **Secure by Design:** Input validation and safe message handling
- ⚡ **Performance-Focused:** Zero-allocation patterns where possible

---

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Development](#-development)
- [Testing](#-testing)
- [CI/CD](#-cicd)
- [Project Structure](#-project-structure)
- [License](#-license)

---

## ✨ Features

---

## 🏗️ Architecture

### Overview

DASE follows a clean architecture pattern with clear separation of concerns:

```
Extension Host (Node.js)
    ↓
Commands → Services → TFXBridge → TFX Models
    ↓           ↓
  Views    DesignerProvider
              ↓
        Webview (HTML/CSS/JS)
```

### TFX Integration

DASE consumes the `@tootega/tfx` package as a local dependency. TFX is responsible for:

- **Models**: All design elements, ORM structures, and state management
- **Validation**: Model validation rules and error reporting
- **Serialization**: Load/save operations for design documents
- **Operations/Commands**: Design operations and change tracking

The DASE extension acts as:

- **UI Host**: Webviews for visual designers
- **Integration Bridge**: Adapters between VSCode and TFX
- **Event Wiring**: Message routing between VSCode, Webview, and TFX

### TFX Package Structure

The TFX package (`@tootega/tfx`) exports:

- **Core**: Base element classes, property system, validation, change tracking
- **Design**: Visual design elements (rectangles, lines, fields)
- **Data**: Serialization engine, XML reader/writer, element registry
- **Designers/ORM**: ORM-specific elements (XORMDocument, XORMDesign, XORMTable, XORMReference, XORMField)

### Message Protocol

Communication between the extension and webviews uses a **typed message protocol** with validation:

| Message Type | Direction | Purpose | Validation |
|-------------|-----------|---------|------------|
| `DesignerReady` | Webview → Extension | Webview initialization complete | Type checked |
| `LoadModel` | Extension → Webview | Send model data to render | Schema validated |
| `ModelLoaded` | Webview → Extension | Confirm model loaded | Type checked |
| `SaveModel` | Webview → Extension | Request model save | Content validated |
| `SelectElement` | Webview → Extension | Element selection changed | ID validated |
| `SelectionChanged` | Extension → Webview | Notify selection update | Type checked |
| `UpdateProperty` | Extension → Webview | Property value changed | Value validated |
| `PropertiesChanged` | Webview → Extension | Properties need refresh | Type checked |
| `ValidateModel` | Either | Trigger validation | N/A |
| `IssuesChanged` | Extension → Webview | Validation results updated | Schema validated |
| `DragDropAddTable` | Webview → Extension | Create new table via drag-drop | Position validated |
| `DragDropAddRelation` | Webview → Extension | Create new relation via drag-drop | References validated |
| `DeleteSelected` | Extension → Webview | Delete selected elements | Selection validated |
| `RenameSelected` | Extension → Webview | Rename selected element | Name validated |

**Security:**
- All messages are treated as untrusted input
- Payload size limits enforced
- Unknown message types rejected
- No dynamic code evaluation

---

## 🧪 Testing

### Test Framework

- **Jest** for unit and integration tests
- **100% coverage** requirement (non-negotiable)
- **341 passing tests** covering all scenarios

### Running Tests

```powershell
# Run all tests
npm run test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Coverage Reports

Coverage reports are generated in `coverage/`:
- HTML report: `coverage/index.html`
- LCOV format: `coverage/lcov.info`

### Test Organization

```
src/__tests__/
├── Commands/
│   ├── DeleteSelectedCommand.test.ts
│   └── RenameSelectedCommand.test.ts
├── Designer/
│   ├── ORMDesignerEditorProvider.test.ts
│   └── ORMDesignerState.test.ts
├── Models/
│   ├── DesignerSelection.test.ts
│   ├── IssueItem.test.ts
│   └── PropertyItem.test.ts
└── Services/
    ├── IssueService.test.ts
    ├── SelectionService.test.ts
    └── TFXBridge.test.ts
```

---

## 🚀 CI/CD

### Workflow

**Pipeline:** [.github/workflows/dase-ci.yml](../../.github/workflows/dase-ci.yml)

**Triggers:**
- Push to `master` branch
- Pull requests to `master`
- Changes in `DASE/**` or `TFX/**`

**Stages:**
1. **Build TFX** — Ensure framework dependency is stable
2. **Test TFX** — Validate framework integrity (978 tests)
3. **Build DASE** — Compile extension TypeScript
4. **Lint** — Run ESLint checks
5. **Test DASE** — Execute test suite (341 tests)
6. **Coverage** — Validate 100% coverage requirement
7. **Package** (master only) — Create VSIX extension package

**Quality Gates:**
- ✅ All tests pass (TFX + DASE)
- ✅ 100% code coverage maintained
- ✅ No TypeScript compilation errors
- ✅ No ESLint violations
- ✅ VSIX package builds successfully

**Artifacts:**
- Coverage reports (HTML + LCOV)
- VSIX extension package (`dase-<sha>.vsix`)

---

## 🛠️ Development

### Prerequisites

- **Node.js 20+** (LTS recommended)
- **VS Code 1.85+** (latest stable)
- **TypeScript 5.3+** (installed via npm)

### Setup

```bash
# Clone the repository
git clone https://github.com/Tootega/DASE50.git
cd DASE50

# Build TFX first (dependency)
cd TFX
npm ci
npm run build

# Build DASE extension
cd ../DASE
npm ci
npm run compile
```

### Development Workflow

1. **Make changes** in `src/`
2. **Run tests** to validate: `npm run test:coverage`
3. **Launch debugger** (F5) to test in Extension Development Host
4. **Verify behavior** in the debug VS Code instance
5. **Check coverage** to ensure 100% maintained

### Debugging

**Launch Configuration:**
- Press `F5` in VS Code
- Opens Extension Development Host
- Set breakpoints in TypeScript source
- Inspect state and behavior

**Webview Debugging:**
1. Open Command Palette (`Ctrl+Shift+P`)
2. Run "Developer: Open Webview Developer Tools"
3. Debug webview HTML/CSS/JS

### Build Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Compile | `npm run compile` | Build TypeScript → JavaScript |
| Watch | `npm run watch` | Continuous compilation |
| Test | `npm run test` | Run Jest test suite |
| Coverage | `npm run test:coverage` | Generate coverage report |
| Lint | `npm run lint` | Run ESLint |
| Package | `npm run package` | Create VSIX (requires vsce) |

---

## 📁 Project Structure

```
DASE/
├── .github/
│   └── workflows/
│       └── ci.yml                # Legacy workflow (use dase-ci.yml)
├── package.json                  # Extension manifest and dependencies
├── tsconfig.json                 # TypeScript compiler configuration
├── tsconfig.test.json            # TypeScript config for tests
├── jest.config.js                # Jest test configuration
├── src/
│   ├── ExtensionMain.ts          # Extension entry point (activate/deactivate)
│   ├── Commands/
│   │   ├── DeleteSelectedCommand.ts    # Delete elements command
│   │   ├── RenameSelectedCommand.ts    # Rename element command
│   │   └── ...                         # Other commands
│   ├── Views/
│   │   ├── IssuesViewProvider.ts       # Issues panel provider
│   │   └── PropertiesViewProvider.ts   # Properties panel provider
│   ├── Designer/
│   │   ├── ORMDesignerEditorProvider.ts  # Custom editor provider
│   │   ├── ORMDesignerMessages.ts        # Typed message protocol
│   │   └── ORMDesignerState.ts           # In-memory state management
│   ├── Services/
│   │   ├── IssueService.ts         # Issue aggregation and sorting
│   │   ├── SelectionService.ts     # Selection state management
│   │   ├── TFXBridge.ts            # TFX integration layer
│   │   └── LogService.ts           # Logging abstraction
│   ├── Models/
│   │   ├── DesignerSelection.ts    # Selection data structures
│   │   ├── IssueItem.ts            # Issue representation
│   │   └── PropertyItem.ts         # Property representation
│   └── __tests__/                  # Test files (mirrors src/)
├── media/
│   ├── OrmDesigner.html            # Webview HTML template
│   ├── OrmDesigner.css             # Webview styles
│   └── OrmDesigner.js              # Webview client script
├── samples/
│   └── sample.daseorm.json         # Example ORM model
├── coverage/                       # Generated coverage reports
└── out/                            # Compiled JavaScript output
```

---

## 📜 Code Standards

This extension follows strict coding standards defined in [.github/copilot-instructions.md](../../.github/copilot-instructions.md).

**Key Principles:**
- Security first (validate all inputs)
- 100% test coverage (non-negotiable)
- Performance-focused (zero-allocation mindset)
- Self-documenting code (no comments)
- SOLID principles
- Early returns and guard clauses

**Naming Conventions:**
- Classes: `PascalCase` with `X` prefix (e.g., `XUserService`)
- Interfaces: `XI` prefix (e.g., `XIRepository`)
- Methods: `PascalCase` (e.g., `GetById`)
- Private fields: `_PascalCase` (e.g., `_Cache`)
- Parameters: `pPascalCase` (e.g., `pUserID`)
- Local variables: lowercase mnemonics (e.g., `lstua`)

---

## 🔗 Related Projects

- **[TFX](../TFX/)** — Core framework library (978 tests, 100% coverage)
- **[DASE50](../)** — Parent repository containing both TFX and DASE

---

## 📄 License

MIT License — See [LICENSE](../LICENSE) for details.

---

<p align="center">
  <i>Built entirely through AI-driven development with GitHub Copilot</i><br>
  <b>🤖 No human wrote this code directly — only prompts 🤖</b>
</p>
