# Guia — criando um perfil do zero

Vamos construir um perfil completo para um alvo novo. O exemplo gera **TypeScript com
TypeORM**, mas o roteiro serve para qualquer linguagem.

Referência de tudo que aparece aqui: **[REFERENCIA.md](REFERENCIA.md)**.

---

## 1. Criar a pasta

No repositório onde estão os modelos:

```
.DASE/Templates/ts-typeorm/
```

O nome da pasta é o **id do perfil**. Ele reaparece em dois lugares: no `profile.json` e
como chave dos mapeamentos em `ORM.Types.json`. Use algo estável — `linguagem-framework`.

## 2. Ensinar os tipos

O DASE conhece `String`, `Int32`, `Guid`, `Numeric`… mas não sabe o que cada um vira na sua
linguagem. Isso se declara em `.DASE/ORM.Types.json`, no bloco `Mappings` de cada tipo:

```json
{
  "TypeName": "String",
  "CanUseInPK": false, "HasLength": true, "HasScale": false,
  "CanUseInIndex": true, "IsUTF8": true, "CanAutoIncrement": false,

  "Mappings": {
    "csharp-efcore": { "…já existente, não mexa…" },

    "ts-typeorm": {
      "Type":         "string",
      "TypeNullable": "string | null",
      "Column":       "{ type: \"varchar\", length: {Length} }",
      "ColumnMax":    "{ type: \"text\" }",
      "Init":         "\"\"",
      "Literal":      "\"{Value}\""
    }
  }
}
```

Perfis convivem no mesmo arquivo — cada um sob a sua chave. Um tipo sem mapeamento para o
perfil em uso **interrompe a geração** com o nome do tipo; nunca gera código torto.

Campos disponíveis e o significado de cada um: [REFERENCIA.md § Mapeamento de tipos](REFERENCIA.md#mapeamento-de-tipos).

## 3. Declarar o perfil

`.DASE/Templates/ts-typeorm/profile.json`:

```json
{
  "Id": "ts-typeorm",
  "Language": "TypeScript",
  "Framework": "TypeORM",

  "ProjectSuffixes": ["Domain"],

  "Artifacts": [
    {
      "Id": "entity",
      "Scope": "Table",
      "Where": "Stereotype == \"Entity\"",
      "Template": "Entity.tpl",
      "Output": "{{ Model.Projects.Domain }}/entities/{{ Table.Name | kebab }}.entity.ts"
    },
    {
      "Id": "index",
      "Scope": "Model",
      "Template": "Index.tpl",
      "Output": "{{ Model.Projects.Domain }}/entities/index.ts"
    }
  ]
}
```

Cada artefato responde três coisas:

- **`Scope`** — `Table` roda uma vez por tabela; `Model`, uma vez para o modelo inteiro.
- **`Where`** — filtro opcional sobre a tabela (`Stereotype == "Entity"`, `IsShadow`,
  `HasTenant`). Ausente significa todas.
- **`Output`** — o caminho, que também é template.

`ProjectSuffixes` faz o DASE procurar, junto ao modelo, o projeto cujo nome termina em cada
sufixo, e publicar o nome real em `Model.Projects.<sufixo>`. Sem projeto correspondente, o
valor vira `Namespace.<sufixo>`.

## 4. Escrever o template

`Entity.tpl`:

```
{{ include "_Header.tpl" }}
import { Entity, Column, PrimaryColumn } from "typeorm";

@Entity("{{ Table.Name }}")
export class {{ Table.Name }} {
{{~ for F in Table.Fields ~}}
{{~ if F.Description ~}}
    /** {{ F.Description }} */
{{~ end ~}}
    @{{ if F.IsPrimaryKey }}PrimaryColumn{{ else }}Column{{ end }}({{ F.ColumnType }})
    {{ F.Name | camel }}!: {{ F.Type }};

{{~ end ~}}
}
```

`_Header.tpl` — o `_` é só convenção para parciais; qualquer `.tpl` pode ser incluído:

```
// ATENÇÃO: arquivo gerado pelo DASE. Não edite — as alterações se perdem.
```

`Index.tpl`, com escopo de modelo:

```
{{~ for T in Model.Entities ~}}
export * from "./{{ T.Name | kebab }}.entity";
{{~ end ~}}
```

### Sobre o `~`

`{{~ ... ~}}` faz a tag consumir a própria linha, sem deixar linha em branco. Sem ele, cada
`for` e cada `if` deixaria uma linha vazia na saída. Detalhes e o modelo mental:
[REFERENCIA.md § Espaço em branco](REFERENCIA.md#espaço-em-branco).

## 5. Gerar

Abra o `.dsorm`, chame **Generate ORM Code** e escolha `ts-typeorm`. A notificação informa
quantos arquivos foram criados, atualizados e mantidos.

Para fixar o perfil num modelo e não escolher toda vez, marque **Code Template** nas
propriedades do modelo (grupo *CodeGen*).

---

## Ajustes finos no modelo

Quatro propriedades do modelo (grupo *CodeGen* no painel) mudam a geração:

| Propriedade | Efeito |
|---|---|
| **Generate Code** | desligue para o modelo não gerar nada (rascunho, estudo) |
| **Code Template** | fixa o perfil |
| **Namespace** | raiz do namespace/pacote; vazio, é derivado da estrutura |
| **Output Root** | raiz de saída, relativa à pasta do `.dsorm` |

Cada **tabela** também tem seu **Generate Code** — desligue para mantê-la no diagrama sem
que produza arquivo — e um **Stereotype** (`Entity` / `Lookup` / vazio para deduzir).

## Erros comuns

**"tipo X não tem Mappings[perfil]"** — falta o bloco do perfil naquele tipo em
`ORM.Types.json`. O id no `profile.json` e a chave em `Mappings` têm de ser idênticos.

**"artefatos A e B geram o mesmo arquivo"** — dois `Output` colidem. Quase sempre uma
variável vazia no caminho: `{{ Model.Projects.Xpto }}` com um sufixo não declarado em
`ProjectSuffixes`.

**"filtro desconhecido"** — só existem os filtros da
[lista](REFERENCIA.md#filtros); não há como chamar função arbitrária de dentro do template.

**Saída com linhas em branco a mais** — faltou `~` nas tags de bloco.

**Tudo foi para uma pasta errada** — o `Output` está concatenando em vez de usar
`Model.Projects.<sufixo>`.

## Testando sem abrir o VS Code

```bash
node tools/orm-codegen/gerar.mjs <caminho/MER.dsorm>                    # simula
node tools/orm-codegen/gerar.mjs <caminho/MER.dsorm> --mostrar Entity   # imprime o gerado
node tools/orm-codegen/gerar.mjs <caminho/MER.dsorm> --gravar           # grava
```

Sem `--gravar` nada é escrito, e a saída informa quantos arquivos seriam criados,
alterados ou mantidos.
