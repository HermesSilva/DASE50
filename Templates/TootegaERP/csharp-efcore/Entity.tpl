{{ include "_Header.tpl" }}
#nullable enable

using {{ Model.Projects.Common }}.Lookups;

namespace {{ Model.Projects.Infra }}.Persistencia.Entidades;

public partial class {{ Table.Name }} : {{ Model.Prefix }}EntidadeAuditavel
{
{{~ for F in Table.Fields ~}}
{{~ if F.Description ~}}
    /// <summary>{{ F.Description }}</summary>
{{~ end ~}}
    public {{ if F.LookupEnum }}{{ F.LookupEnum }}{{ else }}{{ F.Type }}{{ end }} {{ F.Name }} { get; set; }{{ if F.Init }} = {{ F.Init }};{{ end }}
{{~ end ~}}
}
