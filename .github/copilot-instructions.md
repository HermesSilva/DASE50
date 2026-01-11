# TFX50 Coding Standards
## 🎯 Objetivo Principal

Estas regras **não são sugestões**, são diretrizes mandatórias. O objetivo é produzir código C# (.NET 8+) que seja, em ordem de prioridade:
1.  **Seguro:** Inexpugnável contra ataques comuns.
2.  **Correto:** Livre de bugs e lógica falha.
3.  **Performático:** Rápido e com alocação de memória mínima (Zero-Allocation sempre que possível).
4.  **Claro:** Legível e autoexplicativo, sem necessidade de comentários.
5.  **Consistente:** Uniforme em todo o codebase.
6.  **Elegante:** Esteticamente agradável e fácil de navegar.
7.  **Manutenível:** Fácil de modificar e estender sem introduzir complexidade desnecessária.
8.  **Testável:** Facilmente coberto por testes automatizados.
9.  **Escalável:** Projetado para crescer com o sistema.
10. **Sustentável:** Baixo custo de manutenção a longo prazo. 
11. **Profissional:** Reflete as melhores práticas da indústria.
12. **Alinhado com o Negócio:** Suporta os objetivos e requisitos do CrediSIS.
13. **Documentado:** Uso adequado de XML-Doc para APIs públicas.
14. **Auditável:** Facilita a rastreabilidade e conformidade.
15. **Moderno:** Aproveita os recursos mais recentes do C# e .NET 8+.
16. **Eficiente:** Minimiza o uso de recursos do sistema.
17. **Testes Automatizados:** Facilita a criação e manutenção de testes unitários e de integração.
18. **Testes Unitários:** Código deve ser facilmente testável com frameworks como xUnit, NUnit ou MSTest.
19. **Testes de Integração:** Facilita a criação de testes que verificam a interação entre componentes.
20. **Teste Profundos:** Código deve ser projetado para permitir testes profundos, incluindo mocks e stubs.
21. **Cobertura de Testes:** Código deve ser escrito de forma a maximizar a cobertura de testes automatizados.
22. **Testabilidade:** Código deve ser modular e desacoplado para facilitar a testabilidade.
23. **Mockabilidade:** Dependências devem ser injetadas para permitir o uso de mocks em testes.
24. **Validações Finais:** Sempre realize build e validação final do código antes de mesclar em branches principais.
25. **Execução de Teste:** Execute todos os testes automatizados antes de qualquer commit final.

Padrões para orientar a escrita de código C# (.NET9 / C#13) e TypeScript neste repositório. O foco é legibilidade, performance e consistência.

## Convenções de Nomenclatura
- Nomes de Arquivos Seguem o padrão das classes.
  - Ex.: `XUserService.cs`, `XUserService.ts`.
- Classes (C# e TS): inglês, prefixo `X`, `PascalCase`.
 - Ex.: `XUserService`, `XOrderProcessor`.
- Interfaces (C# e TS): inglês, prefixo `XI`, `PascalCase`.
 - Ex.: `XIRepository`, `XIUserStore`.
- Métodos e propriedades: `PascalCase`.
 - Ex.: `GetById`, `SaveChanges`, `LastAccessAt`.
- Campos (field) no corpo da classe: prefixo `_` seguido de `PascalCase`.
 - Ex.: `_Cache`, `_Repository`, `_MaxSize`.
- Parâmetros de métodos: `p` + `PascalCase`.
 - Ex.: `pUserID`, `pOptions`, `pToken`.
- Variáveis locais: mnemônicas, abreviadas, tudo em minúsculo.
 - Ex.: `lstua` (lista de usuários ativos), `frsrt` (first read table).
- Quando o nome original é abreviado ou siglas, comp CEP, CPF, ID, URL, HTTP, JSON, XML, SQL, DB, UI, UX, deve manter caixa alta
 - Ex.: `pUserID`, `GetByURL`, `LoadFromDB`,`ORM=Object-Relational Mapping`, `TCP=transmission control protocol`.
- Todas as propriedades do package TFX devem ser do tipo TFXProperty (usando GetValue e SetValue )
 - Ex.: `public get CanDelete(): boolean {return this.GetValue(XPersistableElement.CanDeleteProp) as boolean;}`, `public set CanDelete(pValue: boolean){this.SetValue(XPersistableElement.CanDeleteProp, pValue);}`

- Nomes sempre em inglês para tipos, membros e arquivos.
Esta é uma ampliação das suas instruções, focada em C# (.NET 8+), para que o Copilot (e qualquer desenvolvedor) siga padrões **extremamente rigorosos** de qualidade, performance, segurança, coerência e elegância.

As novas seções estão marcadas e o conteúdo existente foi integrado e reforçado.


## 1. Convenções de Nomenclatura (C#)

Aderência estrita a estas regras é fundamental para a legibilidade.

* **Classes, Structs, Enums, Records:** `PascalCase`.
    * Ex.: `UserService`, `OrderProcessor`, `CustomerStatus`.
* **Interfaces:** Prefixo `I` obrigatório, seguido de `PascalCase`.
    * Ex.: `IRepository`, `IUserStore`, `IUnitOfWork`.
* **Métodos e Propriedades:** `PascalCase`.
    * Ex.: `GetByIdAsync`, `SaveChanges`, `LastAccessAt`, `IsValid`.
* **Campos (Fields) Privados:** Prefixo `_` obrigatório, seguido de `PascalCase`.
    * Ex.: `_Cache`, `_Repository`, `_MaxSize`.
* **Campos (Fields) Estáticos Privados:** Prefixo `s_` (para estático) seguido de `PascalCase`.
* **Campos (Fields) de Thread-Static:** Prefixo `t_` (para thread) seguido de `PascalCase`.
* **Variáveis Locais:** `camelCase` (minúsculas). Devem ser curtas e mnemônicas.
* **Parâmetros de Métodos:** `p` (de "parâmetro") seguido de `PascalCase` (como nos exemplos) ou `camelCase` simples. **Seja consistente.** O exemplo original usa `pPascalCase`.
    * Ex.: `GetById(Guid pId)`, `UpdateUser(User pUser)`.

## 2. Estilo de Código e Elegância

O código deve ser limpo, vertical e com o mínimo de ruído visual.

* **Um Tipo por Arquivo:** Mandatório. O nome do arquivo (`.cs`) deve ser idêntico ao do tipo principal (classe, interface, struct) que ele contém.
* **Sem Chaves em Blocos de Linha Única:** `if`, `else`, `foreach`, `while` ou `for` que contenham apenas uma instrução **não devem** usar chaves (`{}`).
    * Ex.: `if (pUser == null) return false;`
* **Retornos Antecipados (Early Returns):** **Mandatório.** Use o padrão *guard clause* para validar condições no início do método e retornar imediatamente. Isso reduz o aninhamento e a carga cognitiva.
* **Sem Comentários:** O código **deve** ser autoexplicativo. A necessidade de um comentário (`//` ou `/* */`) indica que o código precisa ser refatorado para maior clareza (ex: extrair método, renomear variável).
    * **Exceção Única:** XML-Doc (`<summary>`) para APIs públicas e membros de interfaces é permitido, mas deve descrever o "quê" e não o "como".
* **Evitar Métodos Anônimos e Lambdas:** **Regra Crítica.** Evite `Func<>`, `Action<>` e expressões lambda (`=>`) em caminhos de execução.
    * Sempre prefira métodos nomeados (estáticos ou de instância). Isso melhora a legibilidade, facilita o debugging (profiling) e reduz alocações de *delegate* e *closure*.
    * *Exceção:* Configuração de startup (ex: `Program.cs`) onde a legibilidade é o único foco e a performance não é crítica.

## 3. Qualidade e Design (SOLID e Imutabilidade)

* **SOLID:** Os princípios SOLID não são opcionais.
    * **S (Single Responsibility):** Classes devem ter uma, e apenas uma, razão para mudar.
    * **O (Open/Closed):** Aberto para extensão (herança, implementação), fechado para modificação.
    * **L (Liskov Substitution):** Tipos derivados devem ser substituíveis por seus tipos base sem alterar a corretude.
    * **I (Interface Segregation):** Crie interfaces pequenas e focadas (`IUserReader`, `IUserWriter`) em vez de interfaces monolíticas (`IUserService`).
    * **D (Dependency Inversion):** Dependa de abstrações (`IRepository`), não de implementações (`SqlRepository`). Use Injeção de Dependência (DI) exaustivamente.
* **Imutabilidade é o Padrão:** Prefira imutabilidade.
    * Use `record` para Data Transfer Objects (DTOs) e tipos de valor.
    * Use `readonly` em campos privados sempre que não forem modificados após o construtor.
    * Exponha coleções como `IReadOnlyCollection<T>` ou `IEnumerable<T>`, nunca `List<T>`.

## 4. Performance Extrema (Zero-Allocation Mindset)

Seja **obsessivo** com alocações de memória, especialmente em caminhos críticos (hot paths).

* **Não Use LINQ em Hot Paths:** Evite LINQ (`.Where()`, `.Select()`, `.ToList()`, etc.) em código que é executado com frequência (ex: dentro de loops, processamento de requests).
    * **Justificativa:** LINQ aloca enumeradores, delegates e coleções intermediárias.
    * **Ação:** Prefira loops explícitos (`for`, `foreach`) para controle manual e zero alocação.
* **Async/Await Rigoroso:**
    * Use `async/await` para todo I/O (rede, disco, banco de dados).
    * **Nunca** use `async void`, exceto para event handlers de UI.
    * Em código de biblioteca (projetos de serviço, domínio, infra), **sempre** use `ConfigureAwait(false)` para evitar deadlocks de contexto de sincronização.
    * Use `ValueTask<T>` em vez de `Task<T>` para métodos `async` que podem, com frequência, completar sincronicamente (ex: retorno de cache).
* **Acesso a Dados (EF Core / Dapper):**
    * **Projeções Sempre:** Use `Select` (projeções) para buscar *apenas* os campos necessários. Nunca faça `SELECT *` (`context.Users.ToList()`).
    * **Previna N+1:** Sempre que carregar entidades e suas relações, use `Include()`, `ThenInclude()` ou projeções explícitas para evitar o problema N+1.
    * **Não Materialize Cedo:** Não chame `.ToList()` ou `.ToArray()` até o último momento necessário.
* **Use Tipos de Valor (Structs):** Para objetos pequenos e imutáveis que são criados em grande quantidade, prefira `readonly struct` para evitar pressão no Garbage Collector (GC).
* **Strings e Texto:**
    * **Nunca** concatene strings em loops usando `+`. Use `StringBuilder`.
    * Em processamento de texto de alta performance (parsing, manipulação de bytes), use `Span<T>` e `ReadOnlySpan<T>` para evitar alocações de string e cópias de buffer.
* **Classes `sealed`:** Se uma classe não foi desenhada para herança (a maioria não é), marque-a como `sealed`. Isso ajuda o JIT a otimizar (devirtualização).
* **Parâmetros `in`:** Use o modificador `in` para passar `structs` grandes (que não sejam `readonly`) por referência sem permitir modificação, evitando custos de cópia.

## 5. Segurança Mandatória

Código inseguro invalida todos os outros requisitos.

* **Validação de Entrada:** **Nunca confie na entrada do usuário.** Valide *toda* entrada (de APIs, formulários, query strings) na fronteira do sistema (Controllers, API Endpoints). Use `FluentValidation` ou validação de modelo.
* **SQL Injection:** **Tolerância Zero.**
    * **Sempre** use queries parametrizadas.
    * Com EF Core, isso é o padrão.
    * Com Dapper ou ADO.NET, use `new { Id = pId }` ou `SqlParameter`.
    * **Nunca, sob nenhuma circunstância,** concatene strings de entrada do usuário para formar uma query SQL.
* **Gerenciamento de Segredos:**
    * **Não hardcodar** strings de conexão, chaves de API, senhas ou tokens no código-fonte.
    * Use `IConfiguration` (lendo de `appsettings.json`, variáveis de ambiente) ou um cofre de segredos (Azure Key Vault, HashiCorp Vault).
* **Autorização e Autenticação:**
    * Aplique `[Authorize]` (ou verificação de permissão equivalente) em *todos* os endpoints que não sejam publicamente anônimos.
    * Não confie que o front-end fará a verificação de segurança. A API *deve* ser segura por si só.
* **Cross-Site Scripting (XSS):** Ao retornar dados que serão renderizados em HTML/JS, garanta que eles sejam devidamente encodados (Razor faz isso por padrão; APIs de frontend precisam de cuidado).
* **Criptografia:** Use as APIs modernas do .NET (ex: `System.Security.Cryptography`) para hashing de senhas (com *salt*) e criptografia de dados sensíveis.

## 6. Tratamento de Erros e Resiliência

* **Não Use Exceções para Controle de Fluxo:** Exceções são para casos *excepcionais*.
    * Para fluxos esperados (ex: "usuário não encontrado"), use o padrão `Try*` (ex: `bool TryGetUser(Guid pId, out User pUser)`) ou retorne `null` / `*OrDefault`.
* **Lance Exceções Específicas:** Não lance `new Exception("Erro")`. Lance exceções de domínio específicas (ex: `new InvalidUserStateException("Usuário já está inativo.")`) ou tipos padrão (`ArgumentNullException`, `InvalidOperationException`).
* **Não Suprima Erros:** Evite `catch (Exception e) {}` ou blocos `catch` que apenas logam o erro e continuam. Capture exceções apenas se você puder *tratá-las* ou adicionar contexto valioso antes de relançá-las.
* **Recursos `IDisposable`:** Use `using` *declarations* para garantir a liberação de recursos (ex: `DbContext`, `Stream`, `HttpClient`).
    * `using var context = _factory.CreateDbContext();` (Prefira isto ao bloco `using {}` para reduzir aninhamento).

## Resumo (Checklist de Rigor)

1.  **Nomenclatura:** `PascalCase`, `IInterface`, `_PrivadoPascal`, `pParametroPascal`.
2.  **Estilo:** Um tipo por arquivo. Sem chaves em linha única. Retornos antecipados.
3.  **Sem "Ruído":** Sem comentários. Sem lambdas/anônimos em hot paths.
4.  **Design:** SOLID, DI, Imutabilidade (`record`, `readonly`).
5.  **Performance:** `sealed`, `Span<T>`, `StringBuilder`, `ConfigureAwait(false)`.
6.  **SQL/EF:** Sem N+1, use `Select` (projeção), não materialize cedo.
7.  **Segurança:** Valide *toda* entrada. Use parâmetros SQL. Não hardcode segredos.

---
*Fim das instruções ampliadas.*