# Referência

Sintaxe do motor, filtros e todo o objeto disponível dentro de um template.

- [Sintaxe](#sintaxe)
- [Espaço em branco](#espaço-em-branco)
- [Filtros](#filtros)
- [`profile.json`](#profilejson)
- [Objeto do template](#objeto-do-template)
- [Mapeamento de tipos](#mapeamento-de-tipos)

---

## Sintaxe

| Construção | Efeito |
|---|---|
| `{{ expr }}` | escreve o valor |
| `{{~ expr ~}}` | idem, aparando o espaço em branco (ver adiante) |
| `{{ if cond }}` … `{{ else if c }}` … `{{ else }}` … `{{ end }}` | condicional |
| `{{ for x in lista }}` … `{{ end }}` | repetição |
| `{{ include "Arquivo.tpl" }}` | insere outro template, no mesmo escopo |
| `{{# comentário #}}` | não sai na saída |

### Expressões

```
Table.Name                     caminho
Table.Fields[0].Name           índice
"texto"   'texto'   42   true   false   null       literais
==  !=  <  <=  >  >=           comparação
&&  ||  !                      lógica (&& e || fazem curto-circuito)
( ... )                        agrupamento
valor | filtro arg1 arg2       filtro
```

Filtro liga mais forte que comparação: `{{ if F.Name | upper == "ID" }}` significa
`(upper F.Name) == "ID"`.

**Não existe** atribuição, chamada de função arbitrária nem acesso ao ambiente. Um template
descreve saída; toda transformação passa por um filtro registrado. Método de objeto é
ignorado de propósito.

### Verdade

Falso apenas para: `null`, `undefined`, `false`, `0`, `""` e **lista vazia**. Por isso
`{{ if Table.Indexes }}` já funciona como "tem índice".

Caminho inexistente devolve vazio em vez de quebrar: `{{ Nada.De.Nada }}` escreve `""`.

### Dentro de um `for`

```
for.index    base 0
for.number   base 1
for.first    booleano
for.last     booleano
for.count    tamanho da lista
```

Uso típico, para separador sem sobra no fim:

```
{{ for C in IX.Fields }}e.{{ C }}{{ if !for.last }}, {{ end }}{{ end }}
```

A variável do laço não vaza; o escopo de fora continua visível.

---

## Espaço em branco

- `{{~` remove espaços e tabulações **à esquerda**, sem tocar na quebra de linha anterior.
- `~}}` remove espaços e tabulações à direita **mais a primeira quebra de linha**.

Combinados, fazem uma tag sozinha na linha consumir a própria linha e nada além. Este
template:

```
class X
{
{{~ for F in Fs ~}}
    public {{ F.T }} {{ F.N }};
{{~ end ~}}
}
```

produz exatamente:

```csharp
class X
{
    public int A;
    public string B;
}
```

Sem `~`, cada `for`/`end` deixaria uma linha em branco. Cortando também a quebra à
esquerda, tudo colaria numa linha só.

---

## Filtros

### Identificadores

| Filtro | Exemplo |
|---|---|
| `pascal` | `nome_do_campo` → `NomeDoCampo` |
| `camel` | `NomeDoCampo` → `nomeDoCampo` |
| `snake` | `NomeDoCampo` → `nome_do_campo` |
| `kebab` | `NomeDoCampo` → `nome-do-campo` |
| `upper` / `lower` | caixa inteira |
| `capitalize` | só a primeira letra; o resto fica |
| `unaccent` | `Período` → `Periodo` |

`pascal`, `camel`, `snake` e `kebab` já removem acento — `"Período de teste" | pascal` dá
`PeriodoDeTeste`.

### Texto

| Filtro | Efeito |
|---|---|
| `trim` | apara as pontas |
| `indent n` | recua todas as linhas **menos a primeira** — para interpolar bloco já posicionado |
| `prefix "s"` | prefixa cada linha não vazia (comentário de várias linhas) |
| `replace "de" "para"` | troca literal |
| `escape` | escapa `\`, `"` e quebras, para caber num literal de string |
| `strip_prefix "s"` / `strip_suffix "s"` | remove se presente |
| `default v` | `v` quando o valor é nulo, indefinido ou vazio |

### Listas

| Filtro | Efeito |
|---|---|
| `join "sep"` | concatena |
| `first` / `last` / `count` | óbvios |
| `reverse` | inverte |
| `take n` / `skip n` | recorta |
| `where "Prop" valor` | filtra por igualdade (valor omitido = `true`) |
| `where_not "Prop" valor` | o complemento |
| `pluck "Prop"` | projeta uma propriedade de cada item |
| `sort` / `sort "Prop"` | ordena, estável e **sem locale** — a saída tem de ser igual em qualquer máquina |

```
{{ Table.Fields | where "IsPrimaryKey" true | pluck "Name" | join ", " }}
{{ Model.Entities | where_not "HasTenant" true | count }}
```

---

## `profile.json`

```json
{
  "Id": "csharp-efcore",
  "Language": "C#",
  "Framework": "EF Core",
  "ProjectSuffixes": ["Infra", "Common"],
  "Artifacts": [ … ]
}
```

| Campo | Obrigatório | Papel |
|---|---|---|
| `Id` | sim | chave dos mapeamentos em `ORM.Types.json`; use o nome da pasta |
| `Language`, `Framework` | não | descritivos |
| `ProjectSuffixes` | não | sufixos a localizar; alimentam `Model.Projects` |
| `Artifacts` | sim | o que gerar |

### Artefato

| Campo | Papel |
|---|---|
| `Id` | identifica o artefato nas mensagens de erro |
| `Scope` | `Table` (um arquivo por tabela) ou `Model` (um por modelo) |
| `Where` | expressão booleana sobre a tabela; ausente = todas |
| `Template` | nome do `.tpl` na pasta do perfil |
| `Output` | caminho de saída, relativo a `OutputRoot`; também é template |

No escopo `Table`, o template recebe `Model` **e** `Table`. No escopo `Model`, só `Model`.

Em `Where` os campos da tabela são referenciados **sem prefixo**: `Stereotype == "Entity"`,
`IsShadow`, `HasTenant`, `Seed | count > 0`.

Dois artefatos que produzam o mesmo caminho interrompem a geração — seria perda silenciosa
de arquivo.

---

## Objeto do template

### `Model`

| Campo | Tipo | Conteúdo |
|---|---|---|
| `Name` | string | nome do documento |
| `Namespace` | string | raiz declarada no modelo, ou derivada da estrutura |
| `Schema` | string | schema do banco (`dbo`, `public`) |
| `OutputRoot` | string | raiz de saída, relativa à pasta do `.dsorm` |
| `Module` | string | sigla do módulo — `SYS` |
| `Prefix` | string | prefixo das tabelas próprias — `SYSx` |
| `Projects` | mapa | **nome real** do projeto por sufixo — `Projects.Infra` |
| `Tables` | lista | todas as tabelas que geram, em ordem alfabética |
| `Entities` | lista | só as entidades de domínio |
| `Lookups` | lista | só as tabelas-lookup |
| `Mirrors` | lista | só os espelhos de outros módulos |
| `Owned` | lista | entidades com posse por inquilino |
| `OwnerModules` | lista | `{ Prefix, Module }` dos módulos donos citados por espelhos |
| `TenantTable` | string | tabela mestre de posse |
| `StateTable` | string | tabela de controle de estado |

`Tables` já vem ordenada e as sublistas preservam essa ordem — a saída não depende da ordem
em que as tabelas foram desenhadas.

Tabela marcada como **tabela-modelo** (`IsModel` no designer) **não aparece em `Tables`** nem
em nenhuma sublista: ela existe só para ser herdada, e seus campos chegam achatados dentro de
cada tabela que a declara em `Inheritance`. Gerá-la duplicaria no banco as colunas que já
emprestou às filhas.

### `Table`

| Campo | Tipo | Conteúdo |
|---|---|---|
| `Name` | string | nome da tabela |
| `Description` | string | descrição do modelo |
| `Stereotype` | string | `Entity`, `Lookup` ou `Mirror`. **`Mirror` só vem de tabela shadow** — não se declara |
| `IsShadow` | booleano | é espelho de outro módulo |
| `OwnerPrefix` | string | sigla do dono, quando espelho — `SYS` |
| `OwnerModule` | string | namespace do dono, quando espelho |
| `PKType` | string | tipo da chave, no vocabulário do modelo |
| `PK` | campo\|nulo | o campo chave |
| `PKValueGeneratedNever` | booleano | a chave nunca é gerada pelo banco |
| `Fields` | lista | todos os campos, **chave inclusa** — os próprios e, depois, os herdados |
| `DataFields` | lista | todos menos a chave |
| `ForeignKeys` | lista | só os campos que são chave estrangeira |
| `Inheritance` | string | nome da tabela-base declarada, ou vazio |
| `BaseModule` | string | namespace do módulo da base, quando ela vem de OUTRO módulo; vazio quando é daqui |
| `InheritedFields` | lista | os campos que vieram da base, na ordem em que entram em `Fields` |
| `Indexes` | lista | índices |
| `Seed` | lista | linhas de carga inicial |
| `HasTenant` | booleano | tem coluna de posse |
| `TenantColumn` | string | nome dessa coluna |
| `EnumName` | string | nome do enum, quando lookup |

### `Field`

| Campo | Tipo | Conteúdo |
|---|---|---|
| `Name` | string | nome da coluna |
| `Description` | string | descrição |
| `DataType` | string | tipo no vocabulário do modelo — `String`, `Guid` |
| `Length`, `Scale` | número | 0 quando não se aplica |
| `IsRequired` | booleano | obrigatório |
| `IsPrimaryKey` | booleano | é a chave |
| `IsForeignKey` | booleano | aponta para outra tabela |
| `IsAutoIncrement` | booleano | ⚠ **não confiável em chave** (ver nota) |
| `DefaultValue` | string | valor default; iniciado por `=` é expressão de código |
| **`Type`** | string | **tipo na linguagem**, já anulável se o campo for |
| `BaseType` | string | o mesmo, sempre não anulável |
| **`ColumnType`** | string | **expressão da coluna** — `VarChar(160)` |
| `Init` | string | inicializador — `""` para texto obrigatório |
| `TargetTable` | string | tabela apontada, quando FK |
| `IsOneToOne` | booleano | a referência é 1:1 |
| `LookupEnum` | string | nome do enum, quando aponta para lookup |

`Type`, `ColumnType` e `Init` saem prontos do mapeamento do perfil — o template não converte
tipo, só posiciona o texto.

> **⚠ `IsAutoIncrement` em campo chave.** A leitura do `.dsorm` não preserva esse valor:
> toda chave relida volta como `true`, inclusive `Guid`. Para decidir se a chave é gerada
> pelo banco, use **`Table.PKValueGeneratedNever`**, que já considera a marca explícita do
> modelo e a chave compartilhada 1:1. Em campo comum o valor é confiável.

### `Index`

| Campo | Conteúdo |
|---|---|
| `Name` | nome do índice |
| `IsUnique` | restrição de unicidade |
| `Filter` | condição de índice parcial, ou vazio |
| `Fields` | nomes das colunas, na ordem |

### `Seed`

| Campo | Conteúdo |
|---|---|
| `Member` | identificador do membro do enum, quando lookup |
| `Values` | valor por coluna, **já formatado** como literal da linguagem |
| `Raw` | valor por coluna, como está no modelo |

`Values` resolve chave estrangeira para lookup automaticamente: a coluna guarda o código
`1`, e o valor entregue é `SYSxEstadoInquilino.Ativo`.

Quando o literal de um tipo **não compila** no alvo, o conserto é o `Literal` do tipo em
`.DASE/ORM.Types.json` — nunca o template, que interpola mas não transforma. Foi assim que
data deixou de sair como `new(2026-01-01T00:00:00Z)`, que C# não aceita, e passou a sair
como `DateTime.Parse(…)`.

`Member` importa porque o identificador de um membro **não se deriva do texto** — `BRL` de
"Real brasileiro", `Trial` de "Período de teste". Quando está vazio, derive do valor:

```
{{ if R.Member }}{{ R.Member }}{{ else }}{{ R.Raw["Valor"] | pascal }}{{ end }}
```

---

## Mapeamento de tipos

Fica em `.DASE/ORM.Types.json`, dentro de cada tipo, sob a chave do perfil:

```json
"Mappings": {
  "csharp-efcore": {
    "Type":         "string",
    "TypeNullable": "string?",
    "Column":       "VarChar({Length})",
    "ColumnMax":    "VarCharMax()",
    "Init":         "\"\"",
    "Literal":      "\"{Value}\""
  }
}
```

| Campo | Papel |
|---|---|
| `Type` | tipo na linguagem |
| `TypeNullable` | forma anulável; nem toda linguagem usa `?` |
| `Column` | expressão da coluna; `{Length}` e `{Scale}` são substituídos |
| `ColumnMax` | usada quando o campo **não tem** `Length` — separa `VarChar(160)` de `VarCharMax()` |
| `Init` | inicializador de campo obrigatório |
| `Literal` | molde do valor no seed; `{Value}` é substituído |

`Column` e `ColumnMax` aceitam também um valor **por provider**, para frameworks que
precisam do tipo SQL literal já na geração:

```json
"Column": { "Default": "varchar({Length})", "PostgreSQL": "varchar({Length})", "Sqlite": "TEXT" }
```

Quando o alvo resolve multi-banco em tempo de execução — como o `XBaseEntityConfiguration`
do TootegaERP, que faz o `switch` por provider —, basta a string única com a chamada do
helper.

Campo anulável não recebe `Init`: o default dele é o próprio nulo.

Valor de seed iniciado por `=` é emitido **verbatim**, sem o `=`. É assim que o modelo
guarda uma expressão de código (`=SeedSYS.InquilinoRaizID`) em vez de um literal.
