# DSORM AI Authoring Manual

**Audience:** an autonomous AI agent that must produce, mutate or repair `.dsorm` files for the DASE VS Code extension *without* running the extension itself.

**Scope:** complete on-disk specification — every element, every property, every serialised attribute, every default applied by the runtime, every validation rule, every legacy variant encountered in production samples, plus the procedural recipes (algorithms) needed to emit a model that loads, validates, routes and renders identically to a model produced by the visual designer.

**Status:** distilled from the TFX framework (`TFX/src/...`), the DASE extension (`DASE/src/...`), and all real-world samples in `DASE/samples/` and `Engine Model.dsorm`.

---

## 0. Mental Model in One Page

A `.dsorm` file is the **XML serialisation of a single `XORMDocument`** rooted in an `XSerializationEngine` pass. The document contains exactly one `XORMDesign` (the design surface), which contains tables (`XORMTable`), references (`XORMReference`, `XORMStateReference`) and — nested inside tables — fields (`XORMField`, `XORMPKField`, `XORMFKField`, `XORMStateField`), seed datasets (`XORMDataSet` → `XORMDataTuple` → `XFieldValue`) and optional indexes (`XORMIndex` → `XORMIndexField`).

Every persistable element follows the **same serialisation envelope**:

```xml
<TagName ID="<guid>" Name="<name>">
  <XValues>
    <XData     Name="<prop>" ID="<prop-guid>" Type="<type-name>">value</XData>
    <XLinkData Name="<prop>" ID="<prop-guid>" Type="String"
               ElementID="<target-guid>" Text="" DocumentID="" DocumentName=""
               ModuleID="" ModuleName="" DataEx="">target-guid</XLinkData>
  </XValues>
  <ChildElement ...> ... </ChildElement>
</TagName>
```

Key invariants:

1. **`ID` and `Name` appear twice**: as XML attributes on the element AND as `<XData>` entries inside `<XValues>`. Both must agree.
2. **Only non-default property values are serialised** inside `<XValues>` (with the exception of `ID`/`Name`, which are always present).
3. The **`Type` attribute** uses the canonical TFX type names (`String`, `Int32`, `Double`, `Boolean`, `Rect`, `Point`, `Point[]`, `Color`, `Thickness`, `Size`, `Guid`, `Guid[]`, `DateTime`, `Decimal`, `Int64`, `Unknown`).
4. **GUIDs for property IDs are fixed constants** — copy them verbatim from §3. Reusing the wrong GUID silently breaks the deserialiser.
5. **Element GUIDs** (the `ID` attribute on a table, field, reference, etc.) are *generated* (call them `<NEW-GUID>`); they must be unique within the file and never collide with the fixed property GUIDs.
6. **References point by element GUID**. The source of an FK reference is a *field* GUID. The target is a *table* GUID. The state reference target is a table whose name equals `Design.StateControlTable`.
7. **Inheritance matters**: `XORMTable` inherits `XRectangle` so it accepts every visual property (Bounds, Fill, Opacity, Visible, …); `XORMReference` inherits `XLine` so it carries Source, Target, Points, Stroke, StrokeThickness; everything inherits `XPersistableElement` so ID, Name, Description, IsLocked, IsVisible, etc. apply universally.

---

## 1. Document Skeleton (minimum valid file)

The smallest file that loads, validates and round-trips through DASE:

```xml
<?xml version="1.0" encoding="utf-8"?>
<XORMDocument ID="<NEW-GUID>" Name="ORM Model">
  <XValues>
    <XData Name="ID"   ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String"><NEW-GUID></XData>
    <XData Name="Name" ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">ORM Model</XData>
  </XValues>
  <XORMDesign Name="MyDesign">
    <XValues>
      <XData Name="Name" ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">MyDesign</XData>
    </XValues>
  </XORMDesign>
</XORMDocument>
```

Notes:

- `<?xml version="1.0" encoding="utf-8"?>` declaration is mandatory (the file is saved as UTF-8 by `vscode.workspace.fs.writeFile`).
- The `XORMDesign` may omit its own XML-attribute `ID` (it is auto-assigned at load time). Most samples include it; `samples/Exemplo.dsorm:7` and `samples/SYSx.dsorm:7` omit it. Either form is accepted by the deserialiser.
- The validator emits a *Warning* (not an Error) when the design has no tables. The file is still loadable and savable.

---

## 2. Canonical Element Hierarchy & Allowed Containment

Strictly enforced by `XORMRegistry.AllowedChildren` ([TFX/src/Designers/ORM/XORMRegistry.ts:133-149](TFX/src/Designers/ORM/XORMRegistry.ts#L133-L149)):

```
XORMDocument
└── XORMDesign                  (exactly one; XORMDesigner alias accepted on read, never written)
    ├── XORMTable               (any number)
    │   ├── XORMPKField         (0 or 1; auto-created by validator if missing)
    │   ├── XORMField           (any number)
    │   ├── XORMFKField         (any number; subclass of XORMField with IsFK locked to true)
    │   ├── XORMStateField      (0 or 1; subclass of XORMFKField; IsVisible always false)
    │   ├── XORMIndex           (any number)
    │   │   └── XORMIndexField  (any number)
    │   └── XORMDataSet         (0 or 1; "seed data")
    │       └── XORMDataTuple   (any number; rows)
    │           └── XFieldValue (any number; cells, one per non-PK field)
    ├── XORMReference           (any number; visible FK line)
    └── XORMStateReference      (any number; invisible state-control FK line)
```

**Forbidden / rejected:**
- Any element type not in the registry (silently ignored on read; never produced on write).
- A second `XORMDesign` (TFX merges duplicate designs via `XORMDocument.Initialize` — never emit more than one).
- An `XORMField` outside an `XORMTable`.
- An `XORMReference` inside an `XORMTable`.
- Cycles (a table cannot contain itself; references must connect existing elements).

---

## 3. Master Property Reference Table

Every `<XData Name="X" ID="…" Type="…">` payload an authoring agent will ever need to write. **Use exact GUIDs.** The "Default" column lists the value that should *not* be serialised (omit `<XData>` if the runtime value equals the default).

### 3.1 `XPersistableElement` (inherited by every element)

| Name | ID | Type | Default | Notes |
|---|---|---|---|---|
| `ID` | `608239C5-A43C-47FF-91A0-661470EC4918` | String | `00000000-…` | **Always serialise**; mirror to element's `ID` XML attribute. |
| `Name` | `18043B8B-C189-4FE3-A3C6-552B5C87C7CE` | String | `""` | **Always serialise**; mirror to element's `Name` XML attribute. |
| `Description` | `B073026B-F262-4345-887E-BDE6AF586240` | String | `""` | Optional. |
| `IsSelected` | `4C8D82CC-73D7-49D1-96BA-DE78144C72D8` | Boolean | `false` | UI-only. Never persist `true`. |
| `IsLocked` | `F206EE68-5488-4180-ACBF-EE5442909895` | Boolean | `false` | |
| `IsVisible` | `00000001-0001-0001-0001-000000000004` | Boolean | `true` | |
| `CanDelete` | `00000001-0001-0001-0001-000000000005` | Boolean | `true` | |
| `ParentID` | `78424203-E6A4-433F-9110-7FEEE1580D68` | String | `00000000-…` | Rarely needed — parent is implicit by XML containment. |
| `Sequence` | `00000001-0001-0001-0001-000000000008` | Int32 | `0` | |
| `Order` | `00000001-0001-0001-0001-000000000009` | Int32 | `0` | |
| `ElementType` | `00000001-0001-0001-0001-000000000001` | Int32 | `0` | Computed; do not persist. |
| `TreeDisplayText` | `47ED77F3-6E11-48FE-B48A-F59AB8ACD357` | Unknown | `null` | Computed; do not persist. |
| `CID` | `00000001-0001-0001-0001-00000000000A` | String | `00000000-…` | |
| `AliasClass` | `00000001-0001-0001-0001-00000000000B` | String | `""` | |

### 3.2 `XRectangle` (inherited by `XORMTable`, `XORMField`, `XORMDesign`)

Only the entries an ORM author will realistically touch are listed; the full 36-property table is in [TFX/src/Design/XRectangle.ts](TFX/src/Design/XRectangle.ts). Anything not in the runtime model will not be emitted.

| Name | ID | Type | Default |
|---|---|---|---|
| `Bounds` | `F731FAEC-F42C-499C-AADB-71823B4600F3` | Rect | `{X=0;Y=0;Width=0;Height=0}` |
| `Padding` | `BFB1355A-A656-43B1-B214-68ABA4F4F9E4` | Thickness | `{Left=0;Top=0;Right=0;Bottom=0}` |
| `Fill` | `7152B5B8-EE22-4D84-9EA1-50AA254DA63D` | Color | `{A=0;R=0;G=0;B=0}` (Transparent) |
| `Stroke` | `B80349A7-FD18-45BE-B0C8-DE8C6D8A349A` | Color | `{A=255;R=0;G=0;B=0}` (Black) |
| `StrokeThickness` | `00000001-0001-0001-0003-000000000009` | Double | `1` |
| `Opacity` | `00000001-0001-0001-0003-00000000000C` | Double | `1` |
| `RadiusX` | `00000001-0001-0001-0003-000000000005` | Double | `0` |
| `RadiusY` | `00000001-0001-0001-0003-000000000006` | Double | `0` |
| `MinWidth` / `MinHeight` / `MaxWidth` / `MaxHeight` | see TFX | Double | layout-only; rarely persisted |

### 3.3 `XLine` (inherited by `XORMReference`, `XORMStateReference`)

| Name | ID | Type | Default | Notes |
|---|---|---|---|---|
| `Source` | `8A8851EB-B6CA-414F-B55A-C22A6A0F3753` | String (Guid) | empty | **`XLinkData`** envelope. Points to the **source field** GUID. |
| `Target` | `6461BED3-F1A0-4910-985D-9F0B0058D8BF` | String (Guid) | empty | **`XLinkData`** envelope. Points to the **target table** GUID. |
| `Points` | `E2378CBF-8185-465D-8215-142922E96006` | Point[] | `[]` | Polyline waypoints, source first, target last. |
| `Stroke` | `00000001-0001-0001-0004-000000000005` | Color | Black | |
| `StrokeThickness` | `00000001-0001-0001-0004-000000000006` | Double | `1` | |

> ⚠️ `Source`/`Target` are link properties — they are serialised as `<XLinkData …>` (not `<XData>`). The `ElementID` XML attribute must equal the inner text. The other attributes (`Text`, `DocumentID`, `DocumentName`, `ModuleID`, `ModuleName`, `DataEx`) are written as empty strings unless cross-document linking is in use.

### 3.4 `XORMDesign` own properties

| Name | ID | Type | Default | Notes |
|---|---|---|---|---|
| `Schema` | `95511660-A5D9-4339-9DE2-62ABD7AB4535` | String | `"dbo"` | DB schema name. |
| `ParentModel` | `C2F5A832-7D4B-4E1F-AC3A-6B7E8D1A4F20` | String | `""` | Pipe-separated list of sibling `.dsorm` filenames (e.g. `"COR.dsorm"`, `"A.dsorm\|FolderX/B.dsorm"`). |
| `StateControlTable` | `3A8B7C2D-1E4F-4D6A-89C5-2D7E1F8A3B4C` | String | `""` | Name of the table containing valid states (e.g. `"CORxStatus"`, `"SYSxState"`). |
| `TenantControlTable` | `F6E1D9B4-3C2A-4A7E-B8D8-1B4C7E9F2A6D` | String | `""` | Same shape as State; tenant isolation table. |

### 3.5 `XORMTable` own properties

| Name | ID | Type | Default | Notes |
|---|---|---|---|---|
| `PKType` | `8F3E9777-A802-4A9F-B5B5-0D5D568E0365` | String | `"Int32"` | One of: `Int32`, `Int64`, `Guid` (other types rejected by validator). |
| `UseStateControl` | `04C4A96C-B8C1-4EB3-8F56-72766FCE1823` | Boolean | `false` | When `true`, table must contain an `XORMStateField` + an outbound `XORMStateReference`. |
| `IsShadow` | `7E3F9A2C-D1B8-4E6F-A3C5-2D9F7B1E4A6C` | Boolean | `false` | Read-only placeholder for a table that lives in another `.dsorm`. |
| `ShadowDocumentID` | `B4A7D3F1-8C2E-4A9B-D6F4-3E1C8B5D2A7F` | String (Guid) | `""` | |
| `ShadowDocumentName` | `C9E2B6A4-F3D7-4C1E-B8A3-5D2F9C7E1B4A` | String | `""` | E.g. `"COR"`, `"ORM Model"`. |
| `ShadowTableID` | `D6F4C1B8-A2E9-4F3B-C7D1-8E5B4A9F6C2D` | String (Guid) | `""` | |
| `ShadowTableName` | `E1A8F5C3-B7D4-4A2C-E9B6-4F1D8A3C7E5B` | String | `""` | |
| `ShadowModuleID` | `F3D2A7E6-C8B1-4D5A-F2C9-7B4E1A6D3F8C` | String (Guid) | `""` | |
| `ShadowModuleName` | `A7C5E1F4-D9B2-4B8A-E5D3-1C6F9A4E7B2D` | String | `""` | |
| `IsModel` | `5C1D8A34-9F62-4E7B-B03A-6D2F91C4E87A` | Boolean | `false` | Model table: generates nothing of its own; exists only to be inherited. |
| `Inheritance` | `2B9F4E17-6A3C-4D58-9E12-7C4A0B8D5F3E` | String | `""` | NAME of the base table whose fields this table also generates. May live in this model or in one listed in `ParentModel`/`ImportModels`. Its PK is never inherited, and a field name that collides with an inherited one is a validation error. |

### 3.6 `XField` (inherited by all field types)

| Name | ID | Type | Default | Notes |
|---|---|---|---|---|
| `Index` | `5469955E-340A-40D3-A1AE-9C6122EE0BF9` | Double | `0` | Field ordinal within the table (start at 1; PK keeps its own implicit slot). Persist as `Type="Double"`. |
| `DataType` | `244BD6B3-4873-4957-A34D-FD97F7DBD90D` | String | `"String"` | See §4 for full list. |
| `Length` | `D1AEAA0E-9FC0-478D-9464-DF991F5CE009` | Double | `0` | Required for `String`/`Numeric`; optional for `Decimal`. |
| `Scale` | `C093D02A-AF28-4E79-BD27-1CF1FAF20204` | Double | `0` | Only meaningful for `Numeric`/`Decimal`. |
| `IsRequired` | `6DF729B6-538E-4622-AB5C-8FE1E62618A3` | Boolean | `true` | Most samples explicitly persist `false`. |
| `DefaultValue` | `2152CB85-A8E7-4C05-85E0-02A6EAFB7C74` | String | `""` | |

### 3.7 `XORMField` own additions

| Name | ID | Type | Default | Notes |
|---|---|---|---|---|
| `IsAutoIncrement` | `00000001-0002-0003-0001-000000000006` | Boolean | `false` | Only legal on `Int32`/`Int64`. Mutually exclusive with `AllowedValues`. |
| `IsFK` | `7CBD471F-E1F2-4A36-B0FC-A962000DF07F` | Boolean | `false` | Locked to `true` on `XORMFKField`/`XORMStateField`. |
| `AllowedValues` | `E7B3A1C5-D2F4-4E68-9A0B-1C2D3E4F5A6B` | String | `""` | Pipe-separated enumeration values, e.g. `"A\|B\|C"`. |

### 3.8 `XORMPKField` constraints (no new properties, but locked semantics)

- `Name` defaults to `"ID"`.
- `DataType` defaults to `"Int32"`; locked once attached to a table.
- `IsRequired` is forced to `true` (never persisted).
- `IsAutoIncrement` defaults to `true`, but is auto-flipped to `false` when `DataType == "Guid"`.

### 3.9 `XORMIndex` / `XORMIndexField`

| Class | Name | ID | Type | Default |
|---|---|---|---|---|
| `XORMIndex` | `IsUnique` | `93ADA328-E1D2-4B42-A86B-A3C442070D3E` | Boolean | `false` |
| `XORMIndexField` | `IsDescending` | `2FDDA839-31AD-4EC6-B2D7-F3D0EB94BC81` | Boolean | `false` |
| `XORMIndexField` | `AllowDuplicate` | `B2A239B4-6DEC-4AC9-98E5-4E60152CCD6A` | Boolean | `false` |

`XORMIndexField` must also carry a `FieldID` (string GUID of the indexed `XORMField`); see §3.10 for the GUID convention used by `XFieldValue` — the same column-by-name pattern applies.

### 3.10 `XFieldValue` (cells in a seed-data row)

| Name | ID | Type | Default |
|---|---|---|---|
| `FieldID` | `3DA1B8E4-FA2C-4B7A-9E63-0D57C84A1F92` | String (Guid) | empty |
| `Value` | `7A6E3F81-2B9C-4D5E-8F07-1C4D8E9A2B03` | String | `""` |

`XFieldValue` may legitimately omit its element `ID` XML attribute (see `samples/SYSx.dsorm:47`); the deserialiser tolerates this. Prefer writing one for newly-authored files (matches `samples/FolderX21/ERPx.dsorm:67`).

---

## 4. DataType String Catalogue

### 4.1 Canonical TFX serialisation type names (the `Type=` attribute on `<XData>`)

```
String  Guid  Guid[]  Boolean  Int32  Int64  Double  Decimal  DateTime
Size    Rect  Point   Point[]  Color  Thickness     Unknown
```

### 4.2 ORM field `DataType` values (allowed inside `<XData Name="DataType">`)

```
String     Int32      Int64      Decimal    Numeric    Boolean
DateTime   Date       Time       Guid       Binary     Text
Int8       Int16      (Int8/Int16 appear in legacy samples; treat as valid)
```

Capability matrix ([TFXBridge.ts:205-219](DASE/src/Services/TFXBridge.ts#L205-L219), [XORMFieldMetadataProvider.ts:39-72](TFX/src/Designers/ORM/XORMFieldMetadataProvider.ts#L39-L72)):

| Group | Types | HasLength | HasScale | CanAutoIncrement | CanUseInPK |
|---|---|---|---|---|---|
| Integer | `Int8 Int16 Int32 Int64` | no | no | yes (PK uses `Int32`/`Int64`) | `Int32`, `Int64` |
| String-like | `String` | **required** | no | no | no |
| `Text` | text-only | no | no | no | no |
| `Binary` | blob | yes | no | no | no |
| Decimals | `Decimal` | yes (required if used as a column) | yes | no | no |
| Numeric | `Numeric` | **required** | yes | no | no |
| Boolean | `Boolean` | no | no | no | no |
| Date/Time | `Date`, `Time`, `DateTime` | no | no | no | no |
| Identity | `Guid` | no | no | no | yes |

### 4.3 Legacy C# GUID → canonical name map ([TFXBridge.ts:564-596](DASE/src/Services/TFXBridge.ts#L564-L596))

When migrating a DASE4VS file, rewrite `DataType` values that look like GUIDs using:

| Legacy GUID | Canonical |
|---|---|
| `D0DA2A24-…-Text` | `Text` |
| `…-Date` | `Date` |
| `…-DateTime` | `DateTime` |
| `…-Binary` | `Binary` |
| `…-Boolean` | `Boolean` |
| `…-Guid` | `Guid` |
| `…-Int8/16/32/64` | `Int8`/`Int16`/`Int32`/`Int64` |
| `…-Numeric` | `Numeric` |
| `…-String` | `String` |

(The full GUID list lives in the code; use it as the single source of truth.)

---

## 5. Geometry & Composite Value Encodings

Strings stored in `<XData>` payloads — parsers expect the exact bracketed format with `;` separators.

| Type | Format |
|---|---|
| `Size` | `{Width=200;Height=72}` |
| `Rect` | `{X=292;Y=191;Width=200;Height=72}` |
| `Point` | `{X=292;Y=191}` |
| `Point[]` | `{X=292;Y=191}\|{X=400;Y=191}\|{X=400;Y=80}` (pipe-separated points) |
| `Color` | `{A=255;R=0;G=0;B=255}` |
| `Thickness` | `{Left=0;Top=0;Right=0;Bottom=0}` |
| `Guid[]` | `guid1\|guid2\|guid3` |
| `Boolean` | `true` / `false` (lowercase) |
| `Int32` / `Int64` | integer literal, no separators |
| `Double` / `Decimal` | culture-invariant decimal (e.g. `1.5`, never `1,5`) |
| `DateTime` | ISO-8601 (`2026-05-19T00:00:00Z`) |

> ⚠️ Some legacy `Thickness` rows look like `{Left=undefined;Top=undefined;…}` (e.g. `samples/FolderX21/ERPx.dsorm:18`). The deserialiser tolerates this and clamps to `0`. **Do not emit `undefined`** in new files — write `{Left=0;Top=0;Right=0;Bottom=0}` or omit the property entirely.

---

## 6. Per-Element Authoring Recipes

For each recipe, the **minimum** properties to persist are listed first; the **optional** ones follow. Anything not listed should be omitted from `<XValues>` (default applies).

### 6.1 `XORMDocument`

```xml
<XORMDocument ID="<NEW-GUID>" Name="ORM Model">
  <XValues>
    <XData Name="ID"   ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String"><NEW-GUID></XData>
    <XData Name="Name" ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">ORM Model</XData>
  </XValues>
  <XORMDesign ...>...</XORMDesign>
</XORMDocument>
```

- Document `Name` is conventionally `"ORM Model"` — used everywhere except DBML import which writes `"ImportedModel"` on the design (not the document).

### 6.2 `XORMDesign`

```xml
<XORMDesign Name="<DesignName>">
  <XValues>
    <XData Name="Name"              ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String"><DesignName></XData>
    <!-- Optional: -->
    <XData Name="Schema"            ID="95511660-A5D9-4339-9DE2-62ABD7AB4535" Type="String">dbo</XData>
    <XData Name="ParentModel"       ID="C2F5A832-7D4B-4E1F-AC3A-6B7E8D1A4F20" Type="String">COR.dsorm|FolderX/B.dsorm</XData>
    <XData Name="StateControlTable" ID="3A8B7C2D-1E4F-4D6A-89C5-2D7E1F8A3B4C" Type="String">SYSxState</XData>
    <XData Name="TenantControlTable" ID="F6E1D9B4-3C2A-4A7E-B8D8-1B4C7E9F2A6D" Type="String"></XData>
    <XData Name="Bounds"            ID="F731FAEC-F42C-499C-AADB-71823B4600F3" Type="Rect">{X=0;Y=0;Width=1400;Height=1000}</XData>
  </XValues>
  <!-- tables and references here -->
</XORMDesign>
```

- The element-level `ID` attribute is optional but recommended for cross-document referencing.
- `Schema` should be `"dbo"` for SQL Server, `"public"` for PostgreSQL — emit only if non-default.

### 6.3 `XORMTable` (regular)

```xml
<XORMTable ID="<NEW-GUID>" Name="Customer">
  <XValues>
    <XData Name="ID"     ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String"><NEW-GUID></XData>
    <XData Name="Name"   ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">Customer</XData>
    <XData Name="Bounds" ID="F731FAEC-F42C-499C-AADB-71823B4600F3" Type="Rect">{X=120;Y=160;Width=200;Height=72}</XData>
    <!-- Optional: -->
    <XData Name="Description"      ID="B073026B-F262-4345-887E-BDE6AF586240" Type="String">Customer master record.</XData>
    <XData Name="Fill"             ID="7152B5B8-EE22-4D84-9EA1-50AA254DA63D" Type="Color">{A=255;R=74;G=144;B=217}</XData>
    <XData Name="PKType"           ID="8F3E9777-A802-4A9F-B5B5-0D5D568E0365" Type="String">Guid</XData>
    <XData Name="UseStateControl"  ID="04C4A96C-B8C1-4EB3-8F56-72766FCE1823" Type="Boolean">true</XData>
  </XValues>
  <XORMPKField ...>...</XORMPKField>
  <XORMField   ...>...</XORMField>
</XORMTable>
```

**Bounds geometry rules** (`XORMMetrics`, `TFX/src/Designers/ORM/XORMMetrics.ts`):

```
DefaultTableWidth = 200
HeaderHeight      = 28
FieldRowHeight    = 16
FieldsPadding     = 12
Height            = HeaderHeight + FieldsPadding + (FieldCount × FieldRowHeight)
                  = 28 + 12 + 16·N   when N fields exist
                  = 28               for empty/header-only tables
```

So a table with 3 fields ⇒ `Height = 28 + 12 + 48 = 88`. Always compute height before persisting `Bounds`; otherwise the visual canvas will look wrong even though the model loads.

**Fill defaults** the designer applies are *transparent*; samples show that imported/AI-organised models assign colours from this palette (12 grouping colours used by `OrganizeTablesCommand`):

```
#4A90D9 #1ABC9C #F39C12 #E74C3C #9B59B6 #16A085
#F08080 #2ECC71 #DDA0DD #87CEEB #F0E68C #CD853F
```

Color GUID is `7152B5B8-…`; the `Type="Color"` payload is `{A=255;R=<r>;G=<g>;B=<b>}`.

### 6.4 `XORMTable` (Shadow placeholder)

```xml
<XORMTable ID="<NEW-GUID>" Name="CORxStatus">
  <XValues>
    <XData Name="ID"                   ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String"><NEW-GUID></XData>
    <XData Name="Name"                 ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">CORxStatus</XData>
    <XData Name="Bounds"               ID="F731FAEC-F42C-499C-AADB-71823B4600F3" Type="Rect">{X=1072;Y=40;Width=200;Height=28}</XData>
    <XData Name="Fill"                 ID="7152B5B8-EE22-4D84-9EA1-50AA254DA63D" Type="Color">{A=255;R=165;G=42;B=42}</XData>
    <XData Name="IsShadow"             ID="7E3F9A2C-D1B8-4E6F-A3C5-2D9F7B1E4A6C" Type="Boolean">true</XData>
    <XData Name="ShadowDocumentName"   ID="C9E2B6A4-F3D7-4C1E-B8A3-5D2F9C7E1B4A" Type="String">COR</XData>
    <XData Name="ShadowTableName"      ID="E1A8F5C3-B7D4-4A2C-E9B6-4F1D8A3C7E5B" Type="String">CORxStatus</XData>
    <!-- Optional pointer set: -->
    <XData Name="ShadowDocumentID"     ID="B4A7D3F1-8C2E-4A9B-D6F4-3E1C8B5D2A7F" Type="String"><doc-guid></XData>
    <XData Name="ShadowTableID"        ID="D6F4C1B8-A2E9-4F3B-C7D1-8E5B4A9F6C2D" Type="String"><table-guid></XData>
    <XData Name="ShadowModuleID"       ID="F3D2A7E6-C8B1-4D5A-F2C9-7B4E1A6D3F8C" Type="String"><module-guid></XData>
    <XData Name="ShadowModuleName"     ID="A7C5E1F4-D9B2-4B8A-E5D3-1C6F9A4E7B2D" Type="String">CORE</XData>
  </XValues>
  <!-- NO child fields; shadow tables are header-only (Height=28). -->
</XORMTable>
```

- Shadow tables **must not** contain `XORMPKField`/`XORMField` children. Their height is always `28`.
- The validator requires either (a) `ShadowDocumentName` matches a name in `Design.ParentModel`, or (b) the design itself contains a real table with the same `ShadowTableName`.

### 6.5 `XORMPKField`

```xml
<XORMPKField ID="<NEW-GUID>" Name="ID">
  <XValues>
    <XData Name="ID"              ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String"><NEW-GUID></XData>
    <XData Name="Name"            ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">ID</XData>
    <XData Name="DataType"        ID="244BD6B3-4873-4957-A34D-FD97F7DBD90D" Type="String">Int32</XData>
    <XData Name="IsAutoIncrement" ID="00000001-0002-0003-0001-000000000006" Type="Boolean">true</XData>
  </XValues>
</XORMPKField>
```

Rules:
- `DataType` ∈ {`Int32`, `Int64`, `Guid`} — must equal the parent table's `PKType`.
- `IsAutoIncrement` is `true` by default for `Int32`/`Int64`; **omit or set `false` for `Guid`**.
- `Name` is conventionally `"ID"` or `"<TableName>ID"` (e.g. `ERPxPessoaFisicaID`); both styles appear in production samples.
- Never persist `IsRequired` on a PK (always-true; not serialised).

### 6.6 `XORMField` (regular column)

```xml
<XORMField ID="<NEW-GUID>" Name="Email">
  <XValues>
    <XData Name="ID"          ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String"><NEW-GUID></XData>
    <XData Name="Name"        ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">Email</XData>
    <XData Name="Index"       ID="5469955E-340A-40D3-A1AE-9C6122EE0BF9" Type="Double">1</XData>
    <XData Name="DataType"    ID="244BD6B3-4873-4957-A34D-FD97F7DBD90D" Type="String">String</XData>
    <XData Name="Length"      ID="D1AEAA0E-9FC0-478D-9464-DF991F5CE009" Type="Double">120</XData>
    <XData Name="IsRequired"  ID="6DF729B6-538E-4622-AB5C-8FE1E62618A3" Type="Boolean">true</XData>
    <!-- Optional: -->
    <XData Name="DefaultValue"  ID="2152CB85-A8E7-4C05-85E0-02A6EAFB7C74" Type="String"></XData>
    <XData Name="AllowedValues" ID="E7B3A1C5-D2F4-4E68-9A0B-1C2D3E4F5A6B" Type="String">free|premium|enterprise</XData>
    <XData Name="Scale"         ID="C093D02A-AF28-4E79-BD27-1CF1FAF20204" Type="Double">2</XData>
  </XValues>
</XORMField>
```

Validator constraints:
- `Index` must be unique within the table and start at `1`.
- `String` ⇒ persist `Length` (validator does not require it, but DDL generators do).
- `Decimal` ⇒ persist `Length > 0` (validator emits Error otherwise).
- `Numeric` ⇒ persist `Length` and may persist `Scale`.
- `Scale > 0` on a non-Decimal field ⇒ Warning.
- `AllowedValues` + `IsAutoIncrement=true` is mutually exclusive ⇒ Warning.
- `DefaultValue` must be in `AllowedValues` if both present.

### 6.7 `XORMFKField`

Identical envelope to `XORMField`. Persist `IsFK=true` and ensure `DataType` matches the target table's `PKType`. The validator will repair `DataType` mismatch automatically.

```xml
<XORMFKField ID="<NEW-GUID>" Name="CustomerID">
  <XValues>
    <XData Name="ID"       ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String"><NEW-GUID></XData>
    <XData Name="Name"     ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">CustomerID</XData>
    <XData Name="Index"    ID="5469955E-340A-40D3-A1AE-9C6122EE0BF9" Type="Double">2</XData>
    <XData Name="DataType" ID="244BD6B3-4873-4957-A34D-FD97F7DBD90D" Type="String">Int32</XData>
    <XData Name="IsFK"     ID="7CBD471F-E1F2-4A36-B0FC-A962000DF07F" Type="Boolean">true</XData>
  </XValues>
</XORMFKField>
```

### 6.8 `XORMStateField` (always invisible)

```xml
<XORMStateField ID="<NEW-GUID>" Name="CORxStatusID">
  <XValues>
    <XData Name="ID"           ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String"><NEW-GUID></XData>
    <XData Name="Name"         ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">CORxStatusID</XData>
    <XData Name="Index"        ID="5469955E-340A-40D3-A1AE-9C6122EE0BF9" Type="Double">1</XData>
    <XData Name="DataType"     ID="244BD6B3-4873-4957-A34D-FD97F7DBD90D" Type="String">Int32</XData>
    <!-- Optional: -->
    <XData Name="DefaultValue" ID="2152CB85-A8E7-4C05-85E0-02A6EAFB7C74" Type="String">DCF22A38-9DF3-44A4-9C23-EC006771BF0B</XData>
  </XValues>
</XORMStateField>
```

- The field name must end with `ID` and conventionally equals `"<StateControlTableName>ID"` (e.g. `CORxStatusID`).
- `DataType` is inferred from the state table's `PKType` (`Int32` in samples).
- The state field is **not visible** on the canvas; its `IsVisible` is hard-coded `false` and never serialised.
- A `DefaultValue` containing the GUID of a tuple in the state table's seed dataset hard-pins the default state.

### 6.9 `XORMReference` (visible FK line)

```xml
<XORMReference ID="<NEW-GUID>" Name="FK_Order_Customer">
  <XValues>
    <XData     Name="ID"     ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String"><NEW-GUID></XData>
    <XData     Name="Name"   ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">FK_Order_Customer</XData>
    <XLinkData Name="Source" ID="8A8851EB-B6CA-414F-B55A-C22A6A0F3753" Type="String"
               ElementID="<source-field-guid>" Text="" DocumentID="" DocumentName=""
               ModuleID=""   ModuleName=""     DataEx=""><source-field-guid></XLinkData>
    <XLinkData Name="Target" ID="6461BED3-F1A0-4910-985D-9F0B0058D8BF" Type="String"
               ElementID="<target-table-guid>" Text="" DocumentID="" DocumentName=""
               ModuleID=""   ModuleName=""     DataEx=""><target-table-guid></XLinkData>
    <XData     Name="Points" ID="E2378CBF-8185-465D-8215-142922E96006" Type="Point[]">{X=420;Y=200}|{X=500;Y=200}|{X=500;Y=80}|{X=580;Y=80}</XData>
  </XValues>
</XORMReference>
```

Rules:
- `Source.ElementID` is the **field GUID** (typically an FK field on the source table).
- `Target.ElementID` is the **table GUID**.
- `Name` convention: `FK_<TargetTable>` or `FK_<SourceTable>_<TargetTable>`.
- `Points`: minimum two endpoints; 4-point orthogonal polylines are the norm (see §10 routing recipe).
- Source field's parent table ID **must not** equal target table ID (validator: "Self-referencing relation." Warning).

### 6.10 `XORMStateReference` (invisible state-control FK line)

Same XML shape as `XORMReference`. The runtime overrides `Stroke`/`StrokeThickness` to invisible and forces `IsVisible=false`. Do not persist Stroke* properties.

```xml
<XORMStateReference ID="<NEW-GUID>" Name="FK_Customer_CORxStatus">
  <XValues>
    <XData     Name="ID"     ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String"><NEW-GUID></XData>
    <XData     Name="Name"   ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">FK_Customer_CORxStatus</XData>
    <XLinkData Name="Source" ID="8A8851EB-B6CA-414F-B55A-C22A6A0F3753" Type="String"
               ElementID="<state-field-guid>" Text="" DocumentID="" DocumentName=""
               ModuleID=""   ModuleName=""    DataEx=""><state-field-guid></XLinkData>
    <XLinkData Name="Target" ID="6461BED3-F1A0-4910-985D-9F0B0058D8BF" Type="String"
               ElementID="<state-table-guid>" Text="" DocumentID="" DocumentName=""
               ModuleID=""   ModuleName=""    DataEx=""><state-table-guid></XLinkData>
    <XData     Name="Points" ID="E2378CBF-8185-465D-8215-142922E96006" Type="Point[]">{X=320;Y=192}|{X=360;Y=192}|{X=360;Y=80}|{X=400;Y=80}</XData>
  </XValues>
</XORMStateReference>
```

### 6.11 `XORMDataSet` (seed data block — optional, one per table)

```xml
<XORMDataSet ID="<NEW-GUID>" Name="CustomerSeed">
  <XValues>
    <XData Name="ID"   ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String"><NEW-GUID></XData>
    <XData Name="Name" ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">CustomerSeed</XData>
  </XValues>
  <XORMDataTuple ID="<ROW-GUID>">
    <XValues>
      <XData Name="ID" ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String"><ROW-GUID></XData>
    </XValues>
    <XFieldValue ID="<CELL-GUID-optional>">
      <XValues>
        <XData Name="FieldID" ID="3DA1B8E4-FA2C-4B7A-9E63-0D57C84A1F92" Type="String"><field-guid></XData>
        <XData Name="Value"   ID="7A6E3F81-2B9C-4D5E-8F07-1C4D8E9A2B03" Type="String">Acme Corp</XData>
      </XValues>
    </XFieldValue>
    <!-- one XFieldValue per non-default field column -->
  </XORMDataTuple>
  <!-- more XORMDataTuple rows -->
</XORMDataSet>
```

- The seed dataset belongs to the **table**, not the design. It must be nested directly inside `XORMTable`.
- For the PK field, include the PK cell only when the table has explicit IDs (state lookup tables typically do — see `SYSx.dsorm:43-110` where state IDs are 1..N).
- `Value` is always written as `String` regardless of the column's `DataType`; conversion happens at code-generation time.
- The DBML import accidentally produces `Value` strings with embedded `<XValues />` markers (`samples/FolderX21/ERPx.dsorm:71`). **Do not replicate** — write the raw value only.

### 6.12 `XORMIndex` / `XORMIndexField`

```xml
<XORMIndex ID="<NEW-GUID>" Name="IX_Customer_Email">
  <XValues>
    <XData Name="ID"       ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String"><NEW-GUID></XData>
    <XData Name="Name"     ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">IX_Customer_Email</XData>
    <XData Name="IsUnique" ID="93ADA328-E1D2-4B42-A86B-A3C442070D3E" Type="Boolean">true</XData>
  </XValues>
  <XORMIndexField ID="<NEW-GUID>">
    <XValues>
      <XData Name="ID"           ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String"><NEW-GUID></XData>
      <XData Name="FieldID"      ID="3DA1B8E4-FA2C-4B7A-9E63-0D57C84A1F92" Type="String"><field-guid></XData>
      <XData Name="IsDescending" ID="2FDDA839-31AD-4EC6-B2D7-F3D0EB94BC81" Type="Boolean">false</XData>
    </XValues>
  </XORMIndexField>
</XORMIndex>
```

- The `FieldID` `XData` GUID is intentionally re-used from `XFieldValue` (same conceptual link).
- Indexes are not validated by `XORMValidator`; the DDL generator consumes them when emitting `CREATE INDEX`.

---

## 7. Validation Contract (must-satisfy before saving)

Implementation: [TFX `XORMValidator`](TFX/src/Designers/ORM/XORMValidator.ts) (the runtime JS lives in `DASE/node_modules/@tootega/tfx/dist/Designers/ORM/XORMValidator.js`).

### 7.1 Severity definitions

- **Error** (`XIssueSeverity.Error = 2`): blocks `Save As` *with* warning silenced; code generators refuse.
- **Warning** (`XIssueSeverity.Warning = 1`): allowed; surfaced in the Issues panel.

### 7.2 Rule table (exhaustive)

| # | Severity | Scope | Trigger | Message |
|---|---|---|---|---|
| 1 | Warning | Design | Name empty or GUID-shaped | `Design name is not defined.` |
| 2 | Warning | Design | Zero tables | `Design has no tables.` |
| 3 | Error | Table | Name blank | `Table name is required.` |
| 4 | Error | Table | Duplicate name (case-insensitive) | `Duplicate table name: {Name}` |
| 5 | Auto-fix | Table | No PK field | Inserts `XORMPKField` Name="ID" DataType="Int32" IsAutoIncrement=true |
| 6 | Auto-fix | Table | `PKType` mismatches PK field DataType | `table.PKType = pkField.DataType` |
| 7 | Error | Field | Name blank | `Field name is required.` |
| 8 | Error | Field | Duplicate name within table (case-insensitive) | `Duplicate field name in table {T}: {F}` |
| 9 | Warning | Field | Leading/trailing spaces in name | `Field name has leading or trailing spaces.` |
| 10 | Error | PKField | DataType ∉ `ValidPKTypes` | `Invalid DataType "{x}" for Primary Key. Valid types are: {csv}` |
| 11 | Auto-fix | FKField | DataType ≠ target's PKType | DataType repaired |
| 12 | Error | Field | `DataType=Decimal` and `Length=0` | `Decimal field must have a Length (precision) greater than 0.` |
| 13 | Warning | Field | `Scale > 0` and DataType ≠ Decimal | `Scale is only applicable for Decimal fields.` |
| 14 | Warning | Field | `AllowedValues` set + `DefaultValue` not in list | `Default value "{x}" is not in the AllowedValues list for field {name}.` |
| 15 | Warning | Field | `AllowedValues` + `IsAutoIncrement` both set | `Field {name} has both AllowedValues and IsAutoIncrement set. These are mutually exclusive.` |
| 16 | Error | Reference | Source field GUID missing | `Reference source field is not defined.` |
| 17 | Auto-fix | Reference | Source points to a table ID | Promoted to that table's PK field GUID |
| 18 | Error | Reference | Source field GUID not found | `Reference source field not found.` |
| 19 | Error | Reference | Target GUID missing | `Reference target table is not defined.` |
| 20 | Error | Reference | Target GUID not a table | `Reference target table not found.` |
| 21 | Warning | Reference | Source's table == target table | `Self-referencing relation.` |
| 22 | Error | Shadow | Cross-model reference, parent model not in `ParentModel` list | `Shadow table "{N}" references model "{D}" which is not available in the parent model list.` |
| 23 | Error | Shadow | Parent model loaded, table name missing | `Shadow table "{N}" references table "{T}" which no longer exists in model "{D}".` |
| 24 | Error | Shadow | No resolvable source reference | `Shadow table "{N}" has no valid source reference.` |

### 7.3 Author-side checklist

Before persisting, an AI must verify:

- [ ] All GUIDs are unique within the file.
- [ ] All XML-attribute `ID`/`Name` match the corresponding `<XData>` payload.
- [ ] Every reference `Source.ElementID` resolves to an existing field GUID inside an existing table.
- [ ] Every reference `Target.ElementID` resolves to an existing table GUID.
- [ ] Every FK field has a sibling `<XORMReference>` whose `Source.ElementID` equals its GUID; otherwise it dangles silently.
- [ ] Every state-control table referenced by `Design.StateControlTable` exists either as a real `XORMTable` in the design or as a shadow `XORMTable` whose name matches.
- [ ] Every table marked `UseStateControl=true` contains exactly one `XORMStateField` plus exactly one outbound `XORMStateReference`.
- [ ] Every `XORMField.Index` is unique within its parent table and ≥ 1.
- [ ] No two `XORMTable.Name` strings collide (case-insensitive).
- [ ] If `ParentModel` is non-empty, each `|`-separated entry resolves to a real sibling `.dsorm` filename on disk relative to the file being authored.

---

## 8. Default-Value Cheat Sheet (apply to runtime model before deciding what to serialise)

| Element | Property | Default applied at runtime |
|---|---|---|
| `XORMTable` | `Bounds` | `{X=auto;Y=auto;Width=200;Height=28+12+16·N}` |
| `XORMTable` | `Fill` | Transparent (`{A=0;R=0;G=0;B=0}`) — omit unless coloured |
| `XORMTable` | `PKType` | `"Int32"` |
| `XORMTable` | `IsShadow` | `false` |
| `XORMTable` | `UseStateControl` | `false` |
| `XORMPKField` | `Name` | `"ID"` |
| `XORMPKField` | `DataType` | `"Int32"` (locked once attached) |
| `XORMPKField` | `IsAutoIncrement` | `true` for Int32/Int64, forced `false` for Guid |
| `XORMPKField` | `IsRequired` | `true` (never persisted) |
| `XORMField` | `DataType` | `"String"` |
| `XORMField` | `IsRequired` | `true` |
| `XORMField` | `IsAutoIncrement` | `false` |
| `XORMField` | `Length`, `Scale` | `0` |
| `XORMField` | `DefaultValue`, `AllowedValues` | `""` |
| `XORMField` | `Index` | `0` (must override to ≥1) |
| `XORMReference` | `Stroke` | Black |
| `XORMReference` | `StrokeThickness` | `1` |
| `XORMStateReference` | `Stroke` | Transparent (hardcoded) |
| `XORMStateReference` | `StrokeThickness` | `0` (hardcoded) |
| `XORMDesign` | `Schema` | `"dbo"` |
| Every element | `Description` | `""` |

---

## 9. Sample-by-Sample Feature Map (production patterns the AI should mirror)

| File | Notable features |
|---|---|
| `DASE/samples/Exemplo.dsorm` | Mixed PK types, custom Fill colours, `ParentModel="COR.dsorm"`, `StateControlTable="CORxStatus"`, `UseStateControl` on one table, `XORMStateField` + `XORMStateReference`, many shadow tables (`IsShadow=true`) pointing to `COR`. |
| `DASE/samples/SYSx.dsorm` | DBML-import output; design name `ImportedModel`; rich seed data in `XORMDataSet` (Active/Inactive/Deleted/Archived state records); deep state-control web. |
| `DASE/samples/COR.dsorm` | Three-way parent model (`Exemplo.dsorm\|FolderX21/CEPx.dsorm\|FolderX21/ERPx.dsorm`); brown state tables (`R=165;G=42;B=42`). |
| `DASE/samples/FolderX21/ERPx.dsorm` | TS-native format; `XORMFKField` usage; seed data with PK GUIDs as `DefaultValue` referencing parent rows (`DCF22A38-…`). |
| `DASE/samples/FolderX21/CEPx.dsorm` | **Legacy C# `<XORMDesigner>` root** — never emit this shape for new files; the bridge normalises it on read. |
| `Engine Model.dsorm` | The top-level engine reference model — large, fully populated. |

---

## 10. Procedural Recipes

### 10.1 Generating a brand-new model

```
1. doc.ID  = NEW_GUID
   doc.Name = "ORM Model"
2. design.Name = <user-supplied>
   design.Schema = "dbo"  (optional)
3. for each table T:
       T.ID = NEW_GUID
       T.Bounds.X, T.Bounds.Y = layout from §10.3
       T.Bounds.Width = 200
       T.Bounds.Height = 28 + 12 + 16 * field_count
       T.PKType = decide(Int32 | Guid)
       T.Fill = optional palette colour
       create XORMPKField:
           pk.ID = NEW_GUID
           pk.Name = "ID" or "<TableName>ID"
           pk.DataType = T.PKType
           pk.IsAutoIncrement = (T.PKType != "Guid")
       for each field F (index starting at 1):
           F.ID = NEW_GUID
           F.Name, F.DataType, F.Length, F.IsRequired, F.Index = ...
4. for each FK relationship (src_table.fk_field -> target_table):
       create XORMFKField on src_table:
           fk.Name = "<TargetTableName>ID"
           fk.DataType = target_table.PKType
           fk.IsFK = true
       create XORMReference:
           ref.Source.ElementID = fk.ID
           ref.Target.ElementID = target_table.ID
           ref.Points = route(src_table, fk index, target_table)
5. if any table uses state control:
       design.StateControlTable = "<StateTableName>"
       for each table T with UseStateControl=true:
           create XORMStateField on T:
               sf.Name = "<StateTableName>ID"
               sf.DataType = state_table.PKType
           create XORMStateReference connecting sf → state_table
6. if seed data needed:
       for each seeded table T:
           create XORMDataSet -> XORMDataTuple* -> XFieldValue*
7. serialise (§11).
```

### 10.2 Adding a column to an existing table

1. Choose `Index = max(existing field indexes) + 1`.
2. Append `<XORMField>` as the last child of `<XORMTable>` (ordering inside the file does not affect correctness, but keeping fields together before references is conventional).
3. Increment the parent table's `Bounds.Height` by `16` (one row).
4. If any reference's `Points` polyline crosses the new field's row, re-route (see §10.4).

### 10.3 Initial table-layout algorithm (Sugiyama-lite, used by `OrganizeTablesCommand`)

```
Constants: TABLE_H_GAP=120, TABLE_V_GAP=80, GROUP_H_GAP=240, GROUP_V_GAP=200,
           CANVAS_PAD=80, DEFAULT_W=200, HEADER_HEIGHT=28, ROW_HEIGHT=16,
           ROWS_PADDING=12.

1. Topological-rank tables by FK depth (sources lower-ranked than dependents).
2. Cluster tables by prefix or by AI-supplied groupings (default 12-colour palette).
3. Within each cluster: order columns by barycenter for 8 iterations to minimise crossings.
4. Pack clusters into a grid using inter-cluster FK count as weight.
5. Resolve any rectangle overlaps by greedily pushing the later table down by
   (overlap.height + TABLE_V_GAP).
```

When invoking the AI from scratch, a deterministic fallback is acceptable:

- Sort tables alphabetically.
- 4 columns per row, `TABLE_H_GAP=120` horizontal, dynamic vertical based on table height + `TABLE_V_GAP=80`.
- Origin at `(CANVAS_PAD=80, CANVAS_PAD=80)`.

### 10.4 Reference routing (default orthogonal 4-point polyline)

For an FK reference from field row `(srcX, srcY)` on source table to centre of target table edge `(tgtX, tgtY)`:

1. Determine which side of the source table the FK field exits — pick the side facing the target (right side if `tgtX > srcCentreX`, else left).
2. Determine which side of the target table the line enters — typically the side facing the source.
3. Build 4 waypoints: `(srcEdgeX, srcRowY) → (midX, srcRowY) → (midX, tgtEdgeY) → (tgtEdgeX, tgtEdgeY)`, where `midX = (srcEdgeX + tgtEdgeX) / 2`.

Concrete example from `samples/Exemplo.dsorm:119`:

```
{X=1185;Y=204}|{X=1098.5;Y=204}|{X=1098.5;Y=76}|{X=1012;Y=76}
```

Source row at `(1185, 204)` exiting left, target table at `(1012, 76)`, midpoint `X=1098.5`.

If the AI cannot route accurately, write a degenerate 2-point line `{X=srcX;Y=srcY}|{X=tgtX;Y=tgtY}` — the runtime calls `Design.RouteAllLines()` on load when it detects malformed point arrays.

### 10.5 Encoding a Color from RGB

```
A=255 always for visible fills.
Format: {A=255;R=<0-255>;G=<0-255>;B=<0-255>}
For "transparent" use {A=0;R=0;G=0;B=0} — but prefer to omit the XData entirely.
```

The 12 grouping palette as decimal RGB tuples:

| Hex | RGB | Use |
|---|---|---|
| `#4A90D9` | `R=74;G=144;B=217` | Blue |
| `#1ABC9C` | `R=26;G=188;B=156` | Emerald |
| `#F39C12` | `R=243;G=156;B=18` | Amber |
| `#E74C3C` | `R=231;G=76;B=60` | Rose |
| `#9B59B6` | `R=155;G=89;B=182` | Purple |
| `#16A085` | `R=22;G=160;B=133` | Teal |
| `#F08080` | `R=240;G=128;B=128` | Coral |
| `#2ECC71` | `R=46;G=204;B=113` | Lime |
| `#DDA0DD` | `R=221;G=160;B=221` | Plum |
| `#87CEEB` | `R=135;G=206;B=235` | Sky |
| `#F0E68C` | `R=240;G=230;B=140` | Khaki |
| `#CD853F` | `R=205;G=133;B=63` | Peru |

### 10.6 GUID generation

- Use RFC-4122 v4 (random) GUIDs.
- Acceptable case: either lowercase (most TS-native samples) or UPPERCASE (DBML import, legacy C#). The deserialiser normalises both via `XGuid`. **Prefer lowercase** for new files.
- Always 36 chars: `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.

---

## 11. Serialisation Specification

### 11.1 Element ordering inside `<XORMDesign>`

The serialiser writes children in their **parent-child append order**; runtime tooling adds new tables/references to the end. There is no required ordering, but production samples follow a useful convention:

1. `XORMTable` blocks (one after another),
2. `XORMReference` blocks at the end,
3. `XORMStateReference` blocks last (after regular references).

DASE itself, however, interleaves new references next to the table they were created from (`samples/Exemplo.dsorm:113-139` shows references between tables). Either form parses identically.

### 11.2 `<XValues>` content ordering

Inside `<XValues>`, the writer emits entries in **declaration order of properties on the class hierarchy** (parent class first). The canonical sequence for a typical `XORMTable` is:

```
ID, Name, Description, Bounds, Padding, Fill, PKType, UseStateControl,
IsShadow, ShadowDocumentID, ShadowDocumentName, ShadowTableID,
ShadowTableName, ShadowModuleID, ShadowModuleName
```

Out-of-order entries are accepted on read; emit in the order shown to round-trip cleanly with diff-friendly output.

### 11.3 Whitespace / indentation

- 2-space indentation.
- No tabs.
- Open/close tags on their own lines for nested elements.
- Self-closing tags allowed for empty `<XValues />` blocks (legacy C# files do this — TS canonical output does not).
- UTF-8 BOM **not** emitted.

### 11.4 Escaping

Standard XML entities only: `&amp; &lt; &gt; &quot; &apos;`. Values containing those characters in `<XData>` payload text must be escaped.

### 11.5 Character set

Identifiers (table names, field names, design name) **should** match `^[A-Za-z_][A-Za-z0-9_]*$`. The validator does not enforce this strictly, but downstream DDL/code generators may fail on names containing whitespace or punctuation. Existing samples use `PascalCase` (e.g. `CORxStatus`, `ERPxPessoaFisica`).

### 11.6 Legacy import handling

If asked to *read and rewrite* a C# DASE4VS file (`<XORMDesigner>` root):

1. Wrap in `<XORMDocument>` and rename root → `<XORMDesign>` (matches `NormalizeCSharpXml`).
2. Apply the legacy-DataType-GUID → canonical-name map (§4.3).
3. Drop legacy-only attributes (`TablePrefix`, `ServerID`, `RelativeFolder`, `ComponentsID`, `ModuleID`, `iID`, `AditionalID`, `Background`, `BackgroundColor`, `HasLegacyIntegration`, `IndexID`, `IsCached`, `IsDisplayField`, `IsFace`, `LowRelevance`, `NavigateManyName`, `OrderIndex`, `PKID`, `TupleID`, `UseState`, `ViewSize`, `Mask`, `Title`, `IsUnique` on tables (not on indexes), `TypeID` — already mapped).
4. Output as TS-native.

---

## 12. Worked Examples

### 12.1 Tiny model: 2 tables, 1 reference

```xml
<?xml version="1.0" encoding="utf-8"?>
<XORMDocument ID="11111111-1111-4111-8111-111111111111" Name="ORM Model">
  <XValues>
    <XData Name="ID"   ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String">11111111-1111-4111-8111-111111111111</XData>
    <XData Name="Name" ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">ORM Model</XData>
  </XValues>
  <XORMDesign Name="Sales">
    <XValues>
      <XData Name="Name" ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">Sales</XData>
    </XValues>
    <XORMTable ID="22222222-2222-4222-8222-222222222222" Name="Customer">
      <XValues>
        <XData Name="ID"     ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String">22222222-2222-4222-8222-222222222222</XData>
        <XData Name="Name"   ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">Customer</XData>
        <XData Name="Bounds" ID="F731FAEC-F42C-499C-AADB-71823B4600F3" Type="Rect">{X=80;Y=80;Width=200;Height=56}</XData>
      </XValues>
      <XORMPKField ID="22222222-2222-4222-8222-2222222222a1" Name="ID">
        <XValues>
          <XData Name="ID"              ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String">22222222-2222-4222-8222-2222222222a1</XData>
          <XData Name="Name"            ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">ID</XData>
          <XData Name="DataType"        ID="244BD6B3-4873-4957-A34D-FD97F7DBD90D" Type="String">Int32</XData>
          <XData Name="IsAutoIncrement" ID="00000001-0002-0003-0001-000000000006" Type="Boolean">true</XData>
        </XValues>
      </XORMPKField>
      <XORMField ID="22222222-2222-4222-8222-2222222222a2" Name="Name">
        <XValues>
          <XData Name="ID"       ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String">22222222-2222-4222-8222-2222222222a2</XData>
          <XData Name="Name"     ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">Name</XData>
          <XData Name="Index"    ID="5469955E-340A-40D3-A1AE-9C6122EE0BF9" Type="Double">1</XData>
          <XData Name="DataType" ID="244BD6B3-4873-4957-A34D-FD97F7DBD90D" Type="String">String</XData>
          <XData Name="Length"   ID="D1AEAA0E-9FC0-478D-9464-DF991F5CE009" Type="Double">120</XData>
        </XValues>
      </XORMField>
    </XORMTable>
    <XORMTable ID="33333333-3333-4333-8333-333333333333" Name="Order">
      <XValues>
        <XData Name="ID"     ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String">33333333-3333-4333-8333-333333333333</XData>
        <XData Name="Name"   ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">Order</XData>
        <XData Name="Bounds" ID="F731FAEC-F42C-499C-AADB-71823B4600F3" Type="Rect">{X=400;Y=80;Width=200;Height=72}</XData>
      </XValues>
      <XORMPKField ID="33333333-3333-4333-8333-3333333333a1" Name="ID">
        <XValues>
          <XData Name="ID"              ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String">33333333-3333-4333-8333-3333333333a1</XData>
          <XData Name="Name"            ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">ID</XData>
          <XData Name="DataType"        ID="244BD6B3-4873-4957-A34D-FD97F7DBD90D" Type="String">Int32</XData>
          <XData Name="IsAutoIncrement" ID="00000001-0002-0003-0001-000000000006" Type="Boolean">true</XData>
        </XValues>
      </XORMPKField>
      <XORMFKField ID="33333333-3333-4333-8333-3333333333a2" Name="CustomerID">
        <XValues>
          <XData Name="ID"       ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String">33333333-3333-4333-8333-3333333333a2</XData>
          <XData Name="Name"     ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">CustomerID</XData>
          <XData Name="Index"    ID="5469955E-340A-40D3-A1AE-9C6122EE0BF9" Type="Double">1</XData>
          <XData Name="DataType" ID="244BD6B3-4873-4957-A34D-FD97F7DBD90D" Type="String">Int32</XData>
          <XData Name="IsFK"     ID="7CBD471F-E1F2-4A36-B0FC-A962000DF07F" Type="Boolean">true</XData>
        </XValues>
      </XORMFKField>
      <XORMField ID="33333333-3333-4333-8333-3333333333a3" Name="Total">
        <XValues>
          <XData Name="ID"       ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String">33333333-3333-4333-8333-3333333333a3</XData>
          <XData Name="Name"     ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">Total</XData>
          <XData Name="Index"    ID="5469955E-340A-40D3-A1AE-9C6122EE0BF9" Type="Double">2</XData>
          <XData Name="DataType" ID="244BD6B3-4873-4957-A34D-FD97F7DBD90D" Type="String">Decimal</XData>
          <XData Name="Length"   ID="D1AEAA0E-9FC0-478D-9464-DF991F5CE009" Type="Double">18</XData>
          <XData Name="Scale"    ID="C093D02A-AF28-4E79-BD27-1CF1FAF20204" Type="Double">2</XData>
        </XValues>
      </XORMField>
    </XORMTable>
    <XORMReference ID="44444444-4444-4444-8444-444444444444" Name="FK_Order_Customer">
      <XValues>
        <XData     Name="ID"     ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String">44444444-4444-4444-8444-444444444444</XData>
        <XData     Name="Name"   ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">FK_Order_Customer</XData>
        <XLinkData Name="Source" ID="8A8851EB-B6CA-414F-B55A-C22A6A0F3753" Type="String"
                   ElementID="33333333-3333-4333-8333-3333333333a2" Text="" DocumentID="" DocumentName=""
                   ModuleID="" ModuleName="" DataEx="">33333333-3333-4333-8333-3333333333a2</XLinkData>
        <XLinkData Name="Target" ID="6461BED3-F1A0-4910-985D-9F0B0058D8BF" Type="String"
                   ElementID="22222222-2222-4222-8222-222222222222" Text="" DocumentID="" DocumentName=""
                   ModuleID="" ModuleName="" DataEx="">22222222-2222-4222-8222-222222222222</XLinkData>
        <XData     Name="Points" ID="E2378CBF-8185-465D-8215-142922E96006" Type="Point[]">{X=400;Y=124}|{X=340;Y=124}|{X=340;Y=108}|{X=280;Y=108}</XData>
      </XValues>
    </XORMReference>
  </XORMDesign>
</XORMDocument>
```

This file passes validation with zero issues.

### 12.2 State-controlled table

To add state control on `Customer` referencing a `SYSxState` table (assumed to exist in the design or in a parent model):

1. Set `design.StateControlTable = "SYSxState"`.
2. On the `Customer` `<XORMTable>`, add `<XData Name="UseStateControl" ... Type="Boolean">true</XData>`.
3. Append an `<XORMStateField>` child (see §6.8) named `SYSxStateID` with `DataType="Int32"`, `Index = max+1`.
4. Increment `Customer.Bounds.Height` by `16`.
5. After all tables, append an `<XORMStateReference>` linking the state field to the `SYSxState` table.
6. If `SYSxState` is not in the design, add it as a shadow table (see §6.4) and populate `ShadowDocumentName` to match an entry in `ParentModel`.

---

## 13. Anti-Patterns the AI Must Avoid

1. **Reusing a property GUID for a different property.** Each property has exactly one canonical GUID (§3). Reusing breaks deserialisation silently.
2. **Persisting default values verbatim.** Bloats files and breaks "no changes" diffs. Always elide defaults from `<XValues>`.
3. **Writing `<XData>` for a link property** (`Source`, `Target`). They are always `<XLinkData>`.
4. **Forgetting the `Type` attribute** on `<XData>`/`<XLinkData>`. The deserialiser uses it to pick a converter; omitting it falls back to `String` and silently corrupts numeric/colour values.
5. **Letting an FK field's DataType drift from its target's PKType.** The validator will auto-fix, but the file becomes non-deterministic on save. Set it correctly up front.
6. **Saving `IsShadow=true` table with children.** Shadow tables are pure placeholders.
7. **Skipping `IsAutoIncrement=false` on a `Guid` PK.** Some downstream generators emit `IDENTITY(1,1)` blindly on PKs without checking.
8. **Emitting `{Left=undefined;…}` Thickness payloads.** Use `0` or omit the property.
9. **Embedding `<XValues />` literally inside `<XFieldValue>.Value` payloads.** This is a DBML-import bug — do not propagate.
10. **Setting `Design.Name` to a GUID string.** The validator treats GUID-shaped names as "missing" and emits a Warning.
11. **Persisting `IsSelected`, `ElementType`, or `TreeDisplayText`.** These are runtime/UI state — never serialise.
12. **Forgetting that the element-level `ID` attribute must match the inner `<XData Name="ID">` payload.** They are written twice and consistency is mandatory.

---

## 14. Quick-Reference GUID Lookup (one-screen cheat sheet)

```
Common
  ID                  608239C5-A43C-47FF-91A0-661470EC4918   String
  Name                18043B8B-C189-4FE3-A3C6-552B5C87C7CE   String
  Description         B073026B-F262-4345-887E-BDE6AF586240   String

Visual (XRectangle/XLine)
  Bounds              F731FAEC-F42C-499C-AADB-71823B4600F3   Rect
  Padding             BFB1355A-A656-43B1-B214-68ABA4F4F9E4   Thickness
  Fill                7152B5B8-EE22-4D84-9EA1-50AA254DA63D   Color
  Stroke (Rect)       B80349A7-FD18-45BE-B0C8-DE8C6D8A349A   Color
  Stroke (Line)       00000001-0001-0001-0004-000000000005   Color
  StrokeThickness(L)  00000001-0001-0001-0004-000000000006   Double
  Source              8A8851EB-B6CA-414F-B55A-C22A6A0F3753   XLinkData
  Target              6461BED3-F1A0-4910-985D-9F0B0058D8BF   XLinkData
  Points              E2378CBF-8185-465D-8215-142922E96006   Point[]

Design
  Schema              95511660-A5D9-4339-9DE2-62ABD7AB4535   String
  ParentModel         C2F5A832-7D4B-4E1F-AC3A-6B7E8D1A4F20   String
  StateControlTable   3A8B7C2D-1E4F-4D6A-89C5-2D7E1F8A3B4C   String
  TenantControlTable  F6E1D9B4-3C2A-4A7E-B8D8-1B4C7E9F2A6D   String

Table
  PKType              8F3E9777-A802-4A9F-B5B5-0D5D568E0365   String
  UseStateControl     04C4A96C-B8C1-4EB3-8F56-72766FCE1823   Boolean
  IsShadow            7E3F9A2C-D1B8-4E6F-A3C5-2D9F7B1E4A6C   Boolean
  ShadowDocumentID    B4A7D3F1-8C2E-4A9B-D6F4-3E1C8B5D2A7F   String
  ShadowDocumentName  C9E2B6A4-F3D7-4C1E-B8A3-5D2F9C7E1B4A   String
  ShadowTableID       D6F4C1B8-A2E9-4F3B-C7D1-8E5B4A9F6C2D   String
  ShadowTableName     E1A8F5C3-B7D4-4A2C-E9B6-4F1D8A3C7E5B   String
  ShadowModuleID      F3D2A7E6-C8B1-4D5A-F2C9-7B4E1A6D3F8C   String
  ShadowModuleName    A7C5E1F4-D9B2-4B8A-E5D3-1C6F9A4E7B2D   String

Field
  Index               5469955E-340A-40D3-A1AE-9C6122EE0BF9   Double
  DataType            244BD6B3-4873-4957-A34D-FD97F7DBD90D   String
  Length              D1AEAA0E-9FC0-478D-9464-DF991F5CE009   Double
  Scale               C093D02A-AF28-4E79-BD27-1CF1FAF20204   Double
  IsRequired          6DF729B6-538E-4622-AB5C-8FE1E62618A3   Boolean
  DefaultValue        2152CB85-A8E7-4C05-85E0-02A6EAFB7C74   String
  IsAutoIncrement     00000001-0002-0003-0001-000000000006   Boolean
  IsFK                7CBD471F-E1F2-4A36-B0FC-A962000DF07F   Boolean
  AllowedValues       E7B3A1C5-D2F4-4E68-9A0B-1C2D3E4F5A6B   String

Seed / Index
  FieldID             3DA1B8E4-FA2C-4B7A-9E63-0D57C84A1F92   String
  Value               7A6E3F81-2B9C-4D5E-8F07-1C4D8E9A2B03   String
  IsUnique            93ADA328-E1D2-4B42-A86B-A3C442070D3E   Boolean
  IsDescending        2FDDA839-31AD-4EC6-B2D7-F3D0EB94BC81   Boolean
  AllowDuplicate      B2A239B4-6DEC-4AC9-98E5-4E60152CCD6A   Boolean
```

---

## 15. Source-of-Truth References

If the manual and code disagree, **the code wins**. Authoritative locations:

| Concern | File |
|---|---|
| Element registration / containment rules | [TFX/src/Designers/ORM/XORMRegistry.ts](TFX/src/Designers/ORM/XORMRegistry.ts) |
| Document/Design classes | [TFX/src/Designers/ORM/XORMDocument.ts](TFX/src/Designers/ORM/XORMDocument.ts), [TFX/src/Designers/ORM/XORMDesign.ts](TFX/src/Designers/ORM/XORMDesign.ts) |
| Table/Field classes | [TFX/src/Designers/ORM/XORMTable.ts](TFX/src/Designers/ORM/XORMTable.ts), [TFX/src/Designers/ORM/XORMField.ts](TFX/src/Designers/ORM/XORMField.ts), [TFX/src/Designers/ORM/XORMPKField.ts](TFX/src/Designers/ORM/XORMPKField.ts), [TFX/src/Designers/ORM/XORMFKField.ts](TFX/src/Designers/ORM/XORMFKField.ts), [TFX/src/Designers/ORM/XORMStateField.ts](TFX/src/Designers/ORM/XORMStateField.ts) |
| Reference classes | [TFX/src/Designers/ORM/XORMReference.ts](TFX/src/Designers/ORM/XORMReference.ts), [TFX/src/Designers/ORM/XORMStateReference.ts](TFX/src/Designers/ORM/XORMStateReference.ts) |
| Seed / Index classes | [TFX/src/Designers/ORM/XORMDataSet.ts](TFX/src/Designers/ORM/XORMDataSet.ts), [TFX/src/Designers/ORM/XORMDataTuple.ts](TFX/src/Designers/ORM/XORMDataTuple.ts), [TFX/src/Designers/ORM/XFieldValue.ts](TFX/src/Designers/ORM/XFieldValue.ts), [TFX/src/Designers/ORM/XORMIndex.ts](TFX/src/Designers/ORM/XORMIndex.ts), [TFX/src/Designers/ORM/XORMIndexField.ts](TFX/src/Designers/ORM/XORMIndexField.ts) |
| Validation rules | [TFX/src/Designers/ORM/XORMValidator.ts](TFX/src/Designers/ORM/XORMValidator.ts) |
| Geometry constants | [TFX/src/Designers/ORM/XORMMetrics.ts](TFX/src/Designers/ORM/XORMMetrics.ts) |
| XML write/read | [TFX/src/Data/XmlWriter.ts](TFX/src/Data/XmlWriter.ts), [TFX/src/Data/XmlReader.ts](TFX/src/Data/XmlReader.ts) |
| Type converters | [TFX/src/Data/XTypeConverter.ts](TFX/src/Data/XTypeConverter.ts) |
| Bridge / DASE flow | [DASE/src/Services/TFXBridge.ts](DASE/src/Services/TFXBridge.ts) |
| Property panel mapping | [DASE/src/Services/TFXBridge.ts:1259-1470](DASE/src/Services/TFXBridge.ts#L1259-L1470), [DASE/PROPERTY_EDITOR.md](DASE/PROPERTY_EDITOR.md) |
| Layout / Organize | [DASE/src/Designers/ORM/Commands/OrganizeTablesCommand.ts](DASE/src/Designers/ORM/Commands/OrganizeTablesCommand.ts) |
| Sample models | [DASE/samples/](DASE/samples/), [Engine Model.dsorm](Engine%20Model.dsorm) |

---

End of manual.
