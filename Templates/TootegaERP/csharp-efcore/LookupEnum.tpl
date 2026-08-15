{{ include "_Header.tpl" }}
#nullable enable

using System.ComponentModel;

using Tootega.Core.Data;

namespace {{ Model.Projects.Common }}.Lookups;

{{~ if Table.Description ~}}
/// <summary>{{ Table.Description }}</summary>
{{~ end ~}}
public enum {{ Table.Name }} : {{ Table.PK.BaseType }}
{
{{# A Description é o nome POR EXTENSO (coluna Valor, CE-13); a sigla é o acrônimo da coluna
    Sigla, e vai no XSigla — é dela que sai a apresentação compacta (grade, resumo). Membro sem
    acrônimo não recebe o atributo: a sigla resolve para vazio (CE-12, sentinela). #}}
{{~ for R in Table.Seed ~}}
    {{ if R.Raw["Sigla"] }}[XSigla("{{ R.Raw["Sigla"] | escape }}")] {{ end }}[Description("{{ R.Raw["Valor"] | escape }}")] {{ if R.Member }}{{ R.Member }}{{ else }}{{ R.Raw["Valor"] | pascal }}{{ end }} = {{ R.Raw[Table.PK.Name] }}{{ if !for.last }},{{ end }}
{{~ end ~}}
}
