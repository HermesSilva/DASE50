{{ include "_Header.tpl" }}
#nullable enable

using {{ Model.Projects.Common }}.Lookups;

namespace {{ Model.Projects.Infra }}.Persistencia.Entidades;

{{# A classe-mãe é a tabela declarada em `Inheritance`. Vindo de OUTRO módulo, ela sai com o
    namespace INTEIRO: este arquivo não tem `using` para o módulo alheio, e o nome curto ou
    não resolveria ou pegaria um homônimo daqui. Sem herança declarada, vale a base
    convencional do próprio módulo. #}}public partial class {{ Table.Name }} : {{ if Table.Inheritance }}{{ if Table.BaseModule }}{{ Table.BaseModule }}.Infra.Persistencia.Entidades.{{ end }}{{ Table.Inheritance }}{{ else }}{{ Model.Prefix }}EntidadeAuditavel{{ end }}
{
{{# Só os campos PRÓPRIOS: o herdado já é declarado pela classe base, e redeclará-lo aqui
    esconderia o membro herdado (CS0108). #}}
{{~ for F in Table.OwnFields ~}}
{{~ if F.Description ~}}
    /// <summary>{{ F.Description }}</summary>
{{~ end ~}}
    public {{ if F.LookupEnum }}{{ F.LookupEnum }}{{ else }}{{ F.Type }}{{ end }} {{ F.Name }} { get; set; }{{ if F.Init }} = {{ F.Init }};{{ end }}
{{~ end ~}}
}
