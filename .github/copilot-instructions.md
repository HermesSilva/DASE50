# TFX Coding Standards

## 🎯 Primary Goal

These rules are **not suggestions**. They are **mandatory directives**. Work is only considered complete when it complies with them.

The goal is to produce code (C# / .NET 9+ / C# 13, and TypeScript where applicable) that is, in strict priority order:

1.  **Secure:** hardened against common attacks.
2.  **Correct:** free of bugs and flawed logic.
3.  **Performant:** fast, with minimal memory allocation (Zero-Allocation whenever feasible).
4.  **Clear:** readable and self-explanatory, without needing comments.
5.  **Consistent:** uniform across the entire codebase.
6.  **Elegant:** aesthetically pleasant and easy to navigate.
7.  **Maintainable:** easy to modify and extend without unnecessary complexity.
8.  **Testable:** straightforward to cover with automated tests.
9.  **Scalable:** designed to grow with the system.
10. **Sustainable:** low long-term maintenance cost.
11. **Professional:** reflects industry best practices.
12. **Business-aligned:** supports the objectives and requirements of CrediSIS.
13. **Documented:** appropriate use of XML-Doc for public APIs.
14. **Auditable:** facilitates traceability and compliance.
15. **Modern:** leverages the newest C# and .NET 9+ capabilities.
16. **Efficient:** minimizes system resource usage.
17. **Automated Testing:** facilitates creation and maintenance of unit and integration tests.
18. **Unit Testing:** code MUST be easily testable with frameworks such as xUnit, NUnit, or MSTest.
19. **Integration Testing:** facilitates tests that verify component interactions.
20. **Deep Testing:** design MUST enable deeper testing (including mocks and stubs).
21. **Test Coverage:** code MUST be written to maximize automated test coverage.
22. **Testability:** code MUST be modular and decoupled to improve testability.
23. **Mockability:** dependencies MUST be injected to enable mocking in tests.
24. **Final Validation:** always build and run final validation before merging into main branches.
25. **Test Execution:** run all automated tests before any final commit.

These standards guide writing for this repository. The focus is readability, performance, and consistency, with rigor strong enough that both Copilot and developers can follow it without ambiguity.


## 🧭 Philosophical Principles

These principles are the foundation behind every directive in this document.  
They exist to keep decisions consistent when trade-offs appear.

1. The best code is code that writes itself — guided by clear intent.
2. Any line of code that cannot be exercised by automated tests should not exist.
3. Code is a liability: every added line MUST pay rent (clear value, verified behavior).
4. Prefer constraints over freedom: strong types, explicit contracts, deterministic behavior.
5. Make state explicit; implicit state becomes hidden bugs.
6. Optimize for the next reader: the future maintainer is usually you.
7. Complexity must be earned by measurable benefit; simple mechanisms scale best.
8. Fail fast, fail loud: reject invalid input early with precise, actionable errors.
9. Measure before optimizing; optimize only what profiling proves is hot.
10. Security is an invariant, not a feature.
11. **No metric theater:** we do not create artificial scenarios or “impossible” tests just to inflate coverage.
12. **Coverage is a consequence:** aim for confidence and correctness; coverage follows.
13. **If code is unreachable by design, make it explicit:** remove the branch or replace it with a clear invariant (e.g., unreachable/guard) and test the invariant through realistic behavior, not fabricated inputs.

---

## Naming Conventions

- File names MUST follow class/type names.
  - Example: `XUserService.cs`, `XUserService.ts`.
- Classes (C# and TS): English names, prefix `X`, `PascalCase`.
  - Example: `XUserService`, `XOrderProcessor`.
- Interfaces (C# and TS): English names, prefix `XI`, `PascalCase`.
  - Example: `XIRepository`, `XIUserStore`.
- Methods and properties: `PascalCase`.
  - Example: `GetById`, `SaveChanges`, `LastAccessAt`.
- Fields inside class bodies: prefix `_` followed by `PascalCase` (this is the repository style; follow it exactly).
  - Example: `_Cache`, `_Repository`, `_MaxSize`.
- Method parameters: `p` + `PascalCase`.
  - Example: `pUserID`, `pOptions`, `pToken`.
- Local variables: mnemonic, shortened, all lowercase.
  - Example: `lstua` (active users list), `frsrt` (first read table).
- When the original name is an abbreviation/acronym (CEP, CPF, ID, URL, HTTP, JSON, XML, SQL, DB, UI, UX), keep it uppercase.
  - Example: `pUserID`, `GetByURL`, `LoadFromDB`, `ORM = Object-Relational Mapping`, `TCP = Transmission Control Protocol`.
- All properties in the TFX package MUST use the TFX property system (`TFXProperty`) through `GetValue` / `SetValue`.
  - Example:
    - `public get CanDelete(): boolean { return this.GetValue(...); }`
    - `public set CanDelete(pValue: boolean) { this.SetValue(XPersistableElement.CanDeleteProp, pValue); }`

- Names MUST be in English for types, members, and files.

This document expands your existing instructions so Copilot (and any developer) follows **extremely rigorous** standards for quality, performance, security, coherence, and elegance.

New sections are clearly marked, and existing content was preserved and reinforced.

---

## 1. Naming Conventions (C#)

Strict adherence to these rules is critical for readability.

- **Classes, Structs, Enums, Records:** `PascalCase`.
  - Example: `UserService`, `OrderProcessor`, `CustomerStatus`.
- **Interfaces:** mandatory `I` prefix, followed by `PascalCase`.
  - Example: `IRepository`, `IUserStore`, `IUnitOfWork`.
- **Methods and Properties:** `PascalCase`.
  - Example: `GetByIdAsync`, `SaveChanges`, `LastAccessAt`, `IsValid`.
- **Private Fields:** mandatory `_` prefix, followed by `PascalCase` (repository style).
  - Example: `_Cache`, `_Repository`, `_MaxSize`.
- **Private Static Fields:** prefix `s_` (static) followed by `PascalCase`.
- **Thread-Static Fields:** prefix `t_` (thread) followed by `PascalCase`.
- **Local Variables:** `camelCase` (lowercase). Keep them short and mnemonic.
- **Method Parameters:** `p` (parameter) followed by either `PascalCase` or `camelCase`. **Be consistent.** This repository uses `pPascalCase`.
  - Example: `GetById(Guid pId)`, `UpdateUser(User pUser)`.

---

## 2. Code Style and Elegance

Code MUST be clean, vertical, and with minimal visual noise.

- **One Type per File:** mandatory. The `.cs` filename MUST match the primary type (class/interface/struct) it contains.
- **No Braces for Single-Line Blocks:** `if`, `else`, `foreach`, `for`, `while` blocks that contain a single statement MUST NOT use braces (`{}`).
  - Example: `if (pUser == null) return false;`
- **Early Returns:** **mandatory.** Validate and return immediately. Reduce nesting and cognitive load.
- **No Comments:** code MUST be self-explanatory. If a comment seems necessary, refactor for clarity (extract method, rename variable, split responsibilities).
  - **Only exception:** XML-Doc (`<summary>`) for public APIs and interfaces is allowed, but it MUST describe the “what”, not the “how”.
- **Avoid Anonymous Methods and Lambdas:** **critical rule.** Avoid `Func<>`, `Action<>`, and lambda expressions (`=>`) on execution paths.
  - Prefer named methods (static or instance). This improves profiling/debugging and reduces delegate/closure allocations.
  - *Exception:* startup configuration (e.g., `Program.cs`) where readability is the only concern and performance is not critical.

---

## 3. Quality and Design (SOLID and Immutability)

- **SOLID:** SOLID principles are not optional.
  - **S (Single Responsibility):** classes MUST have one—and only one—reason to change.
  - **O (Open/Closed):** open for extension (inheritance/implementation), closed for modification.
  - **L (Liskov Substitution):** derived types MUST be substitutable for base types without breaking correctness.
  - **I (Interface Segregation):** create small, specific interfaces (e.g., `IUserReader`, `IUserWriter`) instead of monolithic interfaces (e.g., `IUserService`).
  - **D (Dependency Inversion):** depend on abstractions (`IRepository`), not concretions (`SqlRepository`). Use dependency injection (DI) exhaustively.
- **Immutability is the Default:** prefer immutability.
  - Use `record` for DTOs and value types.
  - Use `readonly` for private fields whenever they are not modified after construction.
  - Expose collections as `IReadOnlyCollection<T>` or `IEnumerable<T>`, never `List<T>`.

---

## 4. Extreme Performance (Zero-Allocation Mindset)

Be **obsessive** about memory allocations, especially on hot paths.

- **Do Not Use LINQ on Hot Paths:** avoid LINQ (`.Where()`, `.Select()`, `.ToList()`, etc.) in code that runs frequently (loops, request processing).
  - **Reason:** LINQ allocates enumerators, delegates, and intermediate collections.
  - **Action:** prefer explicit loops (`for`, `foreach`) for manual control and zero allocation.
- **Async/Await Discipline:**
  - Use `async/await` for all I/O (network, disk, database).
  - **Never** use `async void` (except UI event handlers).
  - In library code (services/domain/infrastructure), use `ConfigureAwait(false)` to avoid synchronization-context deadlocks.
  - Use `ValueTask<T>` instead of `Task<T>` for `async` methods that frequently complete synchronously (e.g., cache returns).
- **Data Access (EF Core / Dapper):**
  - **Always Project:** use `Select` projections to fetch only required fields. Never do `SELECT *` (e.g., avoid `context.Users.ToList()` for broad reads).
  - **Prevent N+1:** when loading entities with relationships, always use `Include()` or explicit projections to avoid N+1 behavior.
  - **Do Not Materialize Early:** do not call `.ToList()` or `.ToArray()` until the last possible moment.
  - *(Additional performance guidance when applicable):* use `AsNoTracking()` for read-only queries; avoid indiscriminate `Include()`; measure with profiling before changing.
- **Prefer Value Types (Structs):** for small immutable objects, prefer `struct`/`readonly struct` to reduce GC pressure.
- **Strings and Text:**
  - **Never** concatenate strings inside loops using `+`. Use `StringBuilder`.
  - For high-performance text processing (parsing/masking), prefer `Span<T>` / `ReadOnlySpan<T>` to avoid string allocations and buffer copies.
- **`sealed` Classes:** if a class is not designed for inheritance, mark it `sealed`. This helps the JIT optimize (devirtualization).
- **`in` Parameters:** use the `in` modifier to pass structs by reference while preventing modification, avoiding copy costs.

---

## 5. Mandatory Security

Insecure code invalidates all other requirements.

- **Input Validation:** **never** trust user input (forms, query strings, headers, API endpoints). Use `FluentValidation` or model validation.
- **SQL Injection:** **zero tolerance.**
  - Always use parameterized queries.
  - With EF Core, this is the default.
  - With Dapper/ADO.NET, use parameters (`new { Id = pId }` / `SqlParameter`).
  - **Never, under any circumstances,** concatenate user input into SQL strings.
- **Secrets Management:**
  - MUST NOT hardcode connection strings, API keys, passwords, or tokens.
  - Use `IConfiguration` (appsettings, environment variables) or a secret store (Azure Key Vault, HashiCorp Vault).
- **Authentication and Authorization:**
  - Apply `[Authorize]` (or equivalent permission checks) to *all* endpoints that are not explicitly anonymous.
  - Never rely on the front-end for security. The API MUST be secure on its own.
- **Cross-Site Scripting (XSS):** when returning data to be rendered as HTML, ensure correct encoding/escaping (Razor does this by default; front-end APIs require care).
- **Cryptography:** use modern .NET APIs (e.g., `System.Security.Cryptography`) for password hashing (with salt) and encrypting sensitive data.

---

## 6. Error Handling and Resilience

- **Do Not Use Exceptions for Control Flow:** exceptions are for *exceptional* cases.
  - For expected flows (e.g., “user not found”), use `TryXxx` patterns (`TryGetUser(Guid pId, out User pUser)`) or return `null` / `*OrDefault`.
- **Throw Specific Exceptions:** do not throw `new Exception("Error")`. Use domain-specific exceptions or standard ones (`ArgumentNullException`, `InvalidOperationException`).
- **Do Not Suppress Errors:** avoid `catch (Exception e) {}` or blocks that swallow exceptions. Catch only to *handle* or add valuable context and rethrow.
- **`IDisposable` Resources:** use `using` declarations for deterministic cleanup (`DbContext`, `Stream`, `HttpClient`).
  - Prefer `using var context = _factory.CreateDbContext();` over `using {}` blocks to reduce nesting.

---

## Summary (Rigour Checklist)

A change is **not acceptable** unless ALL items below are true:

1. **Naming:** `PascalCase`, `IInterface`, `_PrivatePascal`, `pParameterPascal`.
2. **Style:** one type per file; no braces for single-line blocks; early returns.
3. **No Noise:** no comments; no lambdas/anonymous constructs on hot paths.
4. **Design:** SOLID, DI, immutability (`record`, `readonly`).
5. **Performance:** `sealed`, `Span<T>`, `StringBuilder`, `ConfigureAwait(false)`.
6. **SQL/EF:** no N+1; use `Select` (projection); do not materialize early.
7. **Security:** validate *all* input; parameterize SQL; do not hardcode secrets.

Additionally, ALL of these MUST hold:

1. **Security:** no insecure patterns; validation is explicit.
2. **Correctness:** logic is verifiable; edge cases are handled.
3. **Performance:** no avoidable allocations on hot paths; LINQ avoided where critical.
4. **Style:** one type per file; early returns; single-line blocks without braces when applicable; no unnecessary comments.
5. **Design:** SOLID respected; dependencies explicit; immutability preferred.
6. **Resilience:** errors handled correctly; no swallowed exceptions; disposables are deterministic.
7. **Tests:** tests exist and cover the change, including negative/edge scenarios.
8. **Final Validation:** build + lint + tests (including coverage) have run and passed.

---
*End of the expanded instructions.*
---

# Repository-Specific Guidelines for DASE50 (TFX + DASE)

The rules above remain valid. The guidelines below expand them for this repository, ensuring professional quality with total test coverage.

## 7. Context and Scope Rules

1. **Two components, one coherent standard**
   - **TFX/** is the base library (framework) for designers and infrastructure.
   - **DASE/** is the VS Code extension that implements visual designers (current phase: ORM Designer).
   - Changes MUST respect this split: **generic code goes to TFX**, **extension-specific code goes to DASE**.

2. **Current phase: ORM Designer**
   - Immediate focus is the ORM designer for `.daseorm.json` files.
   - Avoid introducing UI Designer, Flow Designer, or API Designer until the ORM foundation is solid.

3. **Actions via context menu**
   - User interaction MUST occur through **context menus**.
   - Avoid adding toolbox, toolbar, “magic” shortcuts, or parallel UI surfaces that deviate from the current standard.

4. **Mandatory panels**
   - The repository keeps an **Issues** panel and a **Properties** panel as the official surfaces for diagnosis and editing.
   - Do not duplicate the responsibilities of these panels elsewhere unless there is a clear necessity.


---

## 8. Change Workflow Protocol (Process)

When implementing any change:

1. **Understand and record intent**
   - Identify goal, impact, and the expected “contract” (API, behavior, persistence, messages).
2. **Minimal change with full impact review**
   - Make the smallest change that satisfies the goal, but review the system end-to-end: command, state, serialization, validation, tests, and CI.
3. **Align with existing architecture**
   - Respect the established folder organization (Commands, Views, Designer, Services, Models).
4. **Test before finishing**
   - Every change MUST include appropriate tests and keep 100% coverage.
5. **Avoid silent regressions**
   - If you change contracts (types, message names, persisted formats), add validations and compatibility tests.

---

## 9. VS Code Extension Guidelines (DASE/)

### 9.1 Structure and responsibilities

1. **Commands/**
   - Commands MUST be thin and orchestration-focused.
2. **Views/**
   - Views MUST remain minimal and focused on UI composition.
3. **Designer/**
   - `ORMDesignerEditorProvider` is the visual editor provider.
   - `ORMDesignerMessages` defines the typed message contract.
   - `ORMDesignerState` holds in-memory state and MUST be the source of truth.
4. **Services/**
   - `IssueService`: consolidates, sorts, and publishes issues.
   - `SelectionService`: controls selection, focus, and selection changes.
   - `TFXBridge`: integrates the designer model with TFX (document, design, serialization, validation).
5. **Models/**
   - Models MUST be simple, stable, and easy to test.
   - Avoid coupling to the VS Code API inside Models.

### 9.2 Custom editor and persistence

1. **`.daseorm.json` files**
   - The visual editor MUST be the default experience when opening these files.
   - Persistence MUST be deterministic: the same model MUST produce the same content (ordering/formatting when applicable).
2. **Safe save**
   - Never overwrite content without consistency validation.
   - Whenever possible, keep format versioning and migration to avoid breaking existing models.

### 9.3 Message protocol (Webview ↔ Extension)

- Messages MUST follow the typed contract.
- Treat Webview messages as untrusted input:
  - validate payloads, size limits, and formats,
  - reject unknown actions,
  - never evaluate or execute dynamic strings from external sources.
- The contract is a contract: changes require migration and tests.

---

## 10. TFX Framework Guidelines (TFX/)

### 10.1 Reactive property system

- Properties MUST use `XProperty` / `TFXProperty` and be accessed via `GetValue` / `SetValue`.
- Do not bypass the property system for values that require change tracking, persistence, validation, or UI binding.

### 10.2 Hierarchical model (XElement)

1. **Consistent tree**
   - Operations that modify the tree MUST keep parent/child relationships intact.
   - Avoid circular references and partial states.
2. **Typed queries**
   - Prefer APIs such as `GetChild<T>`, `GetChildDeep<T>` and traversals offered by `XElement`.

### 10.3 Change Tracking (Undo/Redo)

1. **Changes MUST be traceable**
   - Every property/structure change MUST generate events and feed `XChangeTracker`.
2. **Transactions**
   - Use transactions to group multiple changes from a single user action.

### 10.4 Serialization (Data Module)

1. **Determinism and compatibility**
   - Serialization MUST be stable and reproducible.
   - When changing formats, adopt a migration strategy and preserve the ability to read older versions.
2. **Type registration**
   - Polymorphic types MUST be registered in the serialization mechanism.

### 10.5 Validation (XValidator / XValidation)

1. **Declarative validation**
   - Errors and warnings MUST be expressed as validation items with explicit severity.
2. **UI integration**
   - Issues MUST be aggregated and published to VS Code panels and to the Webview.

---

## 11. Quality Rules: Tests, Coverage, and Extension Security

1. **Total coverage is non-negotiable**
   - Every change MUST keep 100% coverage.
   - If something is not testable, restructure the code to allow testing (DI, separation of responsibilities).
2. **Vitest as the standard**
   - Unit tests MUST be close to the tested module, following the existing organization.
   - Prefer deterministic tests with explicit inputs and clear output assertions.
3. **Integration tests when required**
   - For extension flows (messages, commands, persistence), add integration tests across layers using controlled mocks of the VS Code API.
4. **Extension security**
   - Treat Webview messages as untrusted input.
   - Validate payloads, size limits, and formats.
   - Never execute commands or dynamic evaluations based on externally sourced strings.

---

## 12. CI/CD and Delivery Quality Rules

1. **The pipeline MUST stay green**
   - Script adjustments (`npm run build`, `npm run test`, `npm run test:coverage`, lint) MUST be reflected in the workflow.
2. **Runtime compatibility**
   - Respect Node.js 20+ and TypeScript 5.3+ as baseline.
3. **Failures MUST be explicit**
   - If something does not meet standards (compile, lint, tests, coverage), the build MUST fail. Never mask failures to pass CI.

---

## 13. Future extension without coherence loss (Roadmap)

The repository anticipates other designers (UI, Flow, API). When evolving:

1. **Reuse what is generic**
   - Common elements, properties, serialization, validation, and tracking MUST live in TFX.
2. **Domain isolation**
   - Each new designer MUST have its own models, validations, and commands, without contaminating the ORM.
3. **Stable contracts**
   - Command names, message names, and persisted formats are contracts. Changes require migration and tests.

---

*End of repository-specific guidelines for DASE50.*
