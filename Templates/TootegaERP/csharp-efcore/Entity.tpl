{{ include "_Header.tpl" }}
#nullable enable

using {{ Model.Projects.Common }}.Lookups;

namespace {{ Model.Projects.Infra }}.Persistencia.Entidades;

{{# A classe-mãe é a tabela declarada em `Inheritance`. Vindo de OUTRO módulo, ela sai com o
    namespace INTEIRO: este arquivo não tem `using` para o módulo alheio, e o nome curto ou
    não resolveria ou pegaria um homônimo daqui.

    `XEntidadeAuditavel` é o caso à parte, e por isso vem cravada: ela mora no MER comum
    `Back/Modules/MER-Model.dsorm`, que não é de módulo nenhum — o gerador derivaria o
    `BaseModule` do diretório ("Modules") e produziria `Modules.Infra.…`, namespace que não
    existe. A classe real vive no Core, em `Tootega.Core.Data`, referenciado por toda Infra.

    Sem herança declarada, vale a base convencional do próprio módulo.

    Cache (ADR-0005): marcada `IsCached`, a entidade também implementa
    `Tootega.Core.Data.XIEntidadeEmCache<{ela mesma}>` — o contrato de leitura/invalidação por tipo
    que o back usa (interceptor de SaveChanges + estratégia por categoria no DI). Sai pelo caminho
    inteiro, como XEntidadeAuditavel: este arquivo não tem `using` para o Core. #}}public partial class {{ Table.Name }} : {{ if Table.Inheritance == "XEntidadeAuditavel" }}Tootega.Core.Data.XEntidadeAuditavel{{ else if Table.Inheritance }}{{ if Table.BaseModule }}{{ Table.BaseModule }}.Infra.Persistencia.Entidades.{{ end }}{{ Table.Inheritance }}{{ else }}{{ Model.Prefix }}EntidadeAuditavel{{ end }}{{ if Table.IsCached }}, Tootega.Core.Data.XIEntidadeEmCache<{{ Table.Name }}>{{ end }}
{
{{# Campo da tabela MÃE não se repete na filha (dono, 2026-07-31): ele já chega pela herança da
    classe base, e redeclará-lo esconderia o membro herdado (CS0108). O modelo empresta os campos
    da mãe à filha; no C#, quem os declara é a base. Por isso o laço é sobre `Table.OwnFields`
    (só os próprios), e não `Table.Fields` (próprios + herdados). #}}
{{~ for F in Table.OwnFields ~}}
{{~ if F.Description ~}}
    /// <summary>{{ F.Description }}</summary>
{{~ end ~}}
    public {{ if F.LookupEnum }}{{ F.LookupEnum }}{{ else }}{{ F.Type }}{{ end }} {{ F.Name }} { get; set; }{{ if F.Init }} = {{ F.Init }};{{ end }}
{{~ end ~}}
{{~ if Table.IsCached && Table.PK ~}}

    /// <summary>Identidade da entrada no cache (ADR-0005): a chave primária. O serviço de cache a
    /// combina com o inquilino quando o dado é por-assinante.</summary>
    object Tootega.Core.Data.XIEntidadeEmCache<{{ Table.Name }}>.ChaveDeCache => {{ Table.PK.Name }};
{{~ end ~}}
}
