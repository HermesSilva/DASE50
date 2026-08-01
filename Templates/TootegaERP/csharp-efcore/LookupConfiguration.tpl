{{ include "_Header.tpl" }}
#nullable enable

namespace {{ Model.Projects.Infra }}.Persistencia.Configurations;

{{# Classe da lookup e enum têm o MESMO nome, em projetos diferentes. Sem apelido de namespace:
    cada um sai pelo caminho inteiro, e a linha diz sozinha quem é quem. #}}public sealed class {{ Table.Name }}Configuration : {{ Model.Prefix }}LookupConfiguration<{{ Model.Projects.Infra }}.Persistencia.Lookups.{{ Table.Name }}, {{ Model.Projects.Common }}.Lookups.{{ Table.Name }}>
{
    protected override string NomeChave => nameof({{ Model.Projects.Infra }}.Persistencia.Lookups.{{ Table.Name }}.{{ Table.PK.Name }});
}
