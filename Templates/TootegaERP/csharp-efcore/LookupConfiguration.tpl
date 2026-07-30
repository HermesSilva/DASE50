{{ include "_Header.tpl" }}
#nullable enable

using En = {{ Model.Projects.Common }}.Lookups;
using Lk = {{ Model.Projects.Infra }}.Persistencia.Lookups;

namespace {{ Model.Projects.Infra }}.Persistencia.Configurations;

public sealed class {{ Table.Name }}Configuration : {{ Model.Prefix }}LookupConfiguration<Lk.{{ Table.Name }}, En.{{ Table.Name }}>
{
    protected override string NomeChave => nameof(Lk.{{ Table.Name }}.{{ Table.PK.Name }});
}
