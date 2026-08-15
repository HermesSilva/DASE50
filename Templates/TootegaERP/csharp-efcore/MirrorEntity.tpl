{{ include "_Header.tpl" }}
#nullable enable

namespace {{ Model.Projects.Infra }}.Persistencia.Entidades.Espelho;

/// <summary>
/// ESPELHO de <c>{{ Table.Name }}</c> (dono: {{ Table.OwnerModule }}). A entidade é <b>herdada</b>, nunca
/// redeclarada: a tabela tem um dono só, e duas classes para a mesma tabela divergiriam no primeiro
/// campo novo. O que nasce aqui é apenas a <b>configuração</b>, que mapeia a tabela e a exclui da
/// migração deste módulo — quem cria e versiona o schema é o dono.
/// <para>
/// A herança é só de <b>tipo</b>, não de schema: o DbContext mapeia a classe derivada à mesma tabela,
/// sem discriminador e sem coluna nova. Campo próprio deste módulo sobre esta entidade entraria
/// <b>aqui</b> — e aí o schema muda e o MER manda.
/// </para>
/// </summary>
{{# A base vem com o namespace INTEIRO, sem apelido: espelho e original têm o MESMO nome de
    classe, e um `using` que só encurta o caminho obriga o leitor a subir o arquivo para saber
    de quem se herda. É também a forma que o DbContext já usa no `Ignore<>`.

    A PASTA do dono depende do papel que a tabela tem LÁ: entidade nasce em `Entidades`, e
    tabela-lookup, em `Lookups`. Sem esta distinção, espelhar uma lookup gerava herança de um
    tipo inexistente — o `Stereotype` de um espelho é sempre `Mirror`, e é o `SourceStereotype`
    que guarda o papel de origem. #}}public sealed class {{ Table.Name }} : {{ Table.OwnerModule }}.Infra.Persistencia.{{ if Table.SourceStereotype == "Lookup" }}Lookups{{ else }}Entidades{{ end }}.{{ Table.Name }};
