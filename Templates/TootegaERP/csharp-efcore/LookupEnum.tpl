{{ include "_Header.tpl" }}
#nullable enable

using System.ComponentModel;

namespace {{ Model.Projects.Common }}.Lookups;

{{~ if Table.Description ~}}
/// <summary>{{ Table.Description }}</summary>
{{~ end ~}}
public enum {{ Table.Name }} : {{ Table.PK.BaseType }}
{
{{~ for R in Table.Seed ~}}
    [Description("{{ R.Raw["Valor"] | escape }}")] {{ if R.Member }}{{ R.Member }}{{ else }}{{ R.Raw["Valor"] | pascal }}{{ end }} = {{ R.Raw[Table.PK.Name] }}{{ if !for.last }},{{ end }}
{{~ end ~}}
}
