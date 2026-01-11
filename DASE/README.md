# DASE - Design-Aided Software Engineering

[![CI](https://github.com/tootega/DASE50/actions/workflows/ci.yml/badge.svg)](https://github.com/tootega/DASE50/actions/workflows/ci.yml)

Visual design environment for modeling and generating multi-tier, multi-platform, multi-database, and multi-paradigm web applications.

## Overview

DASE is a VSCode extension that provides visual designers for software modeling. The current phase implements the **ORM Designer** for creating Entity-Relationship models.

## Architecture

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

Communication between the extension and webviews uses a typed message protocol:

| Message Type | Direction | Purpose |
|-------------|-----------|---------|
| DesignerReady | Webview → Extension | Webview initialization complete |
| LoadModel | Extension → Webview | Send model data to render |
| ModelLoaded | Webview → Extension | Confirm model loaded |
| SaveModel | Webview → Extension | Request model save |
| SelectElement | Webview → Extension | Element selection changed |
| SelectionChanged | Extension → Webview | Notify selection update |
| DragDropAddTable | Webview → Extension | Create new table via drag-drop |
| DragDropAddRelation | Webview → Extension | Create new relation via drag-drop |
| DeleteSelected | Extension → Webview | Delete selected elements |
| RenameSelected | Extension → Webview | Rename selected element |
| UpdateProperty | Webview → Extension | Property value changed |
| PropertiesChanged | Extension → Webview | Send property updates |
| ValidateModel | Extension → Webview | Trigger validation |
| IssuesChanged | Extension → Webview | Send validation issues |

## Features

### ORM Designer

- Visual canvas for modeling database entities
- Tables represented as rectangles with fields
- Relations represented as lines connecting tables
- Drag-drop for creating tables and relations
- Property inspector for editing element attributes
- Validation with issues panel

### Interactions

- **Context Menu (Explorer)**: Open ORM Designer, Validate Model
- **Context Menu (Designer)**: Delete Selected, Rename Selected, Validate Model
- **Drag-Drop**: Add Table (from palette), Add Relation (table to table)

## Panel Views

- **DASE Issues**: Displays validation errors, warnings, and information
- **DASE Properties**: Inspector for editing selected element properties

## File Format

ORM models are stored in `.daseorm.json` files using TFX serialization format.

## Development

### Prerequisites

- Node.js 18+
- VSCode 1.85+

### Build

```bash
cd DASE
npm install
npm run compile
```

### Debug

Press F5 in VSCode to launch the Extension Development Host.

## Project Structure

```
DASE/
├── package.json              # Extension manifest
├── tsconfig.json             # TypeScript configuration
├── src/
│   ├── ExtensionMain.ts      # Entry point (activate/deactivate)
│   ├── Commands/             # Command implementations
│   ├── Views/                # Panel view providers
│   ├── Designer/             # ORM designer editor
│   ├── Services/             # Bridge and services
│   └── Models/               # DTOs and selection models
├── media/
│   ├── OrmDesigner.html      # Webview HTML
│   ├── OrmDesigner.css       # Webview styles
│   └── OrmDesigner.js        # Webview script
└── .vscode/
    ├── launch.json           # Debug configuration
    └── tasks.json            # Build tasks
```

## License

MIT
