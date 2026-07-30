{{ include "_Header.tpl" }}
#nullable enable

using {{ Table.OwnerPrefix | lower | capitalize }} = {{ Table.OwnerModule }}.Infra.Persistencia.Entidades;

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
public sealed class {{ Table.Name }} : {{ Table.OwnerPrefix | lower | capitalize }}.{{ Table.Name }};
