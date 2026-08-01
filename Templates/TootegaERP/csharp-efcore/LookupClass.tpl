{{ include "_Header.tpl" }}
#nullable enable

namespace {{ Model.Projects.Infra }}.Persistencia.Lookups;

/// <summary>Tabela-lookup de {{ Table.Name }}.</summary>
public sealed class {{ Table.Name }}
{
{{# A chave é o ENUM de mesmo nome, que mora no projeto Common. Sem apelido de namespace: um
    `using` curto aqui colidiria com esta própria classe, e o caminho inteiro resolve na linha. #}}    public {{ Model.Projects.Common }}.Lookups.{{ Table.Name }} {{ Table.PK.Name }} { get; set; }
{{~ for F in Table.DataFields ~}}
    public {{ F.Type }} {{ F.Name }} { get; set; }{{ if F.Init }} = {{ F.Init }};{{ end }}
{{~ end ~}}
}
