{{ include "_Header.tpl" }}
#nullable enable

using En = {{ Model.Projects.Common }}.Lookups;

namespace {{ Model.Projects.Infra }}.Persistencia.Lookups;

/// <summary>Tabela-lookup de {{ Table.Name }}.</summary>
public sealed class {{ Table.Name }}
{
    public En.{{ Table.Name }} {{ Table.PK.Name }} { get; set; }
{{~ for F in Table.DataFields ~}}
    public {{ F.Type }} {{ F.Name }} { get; set; }{{ if F.Init }} = {{ F.Init }};{{ end }}
{{~ end ~}}
}
