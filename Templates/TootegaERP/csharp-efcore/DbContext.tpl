{{ include "_Header.tpl" }}
#nullable enable

using Microsoft.EntityFrameworkCore;

using Tootega.Core.Data;
using Tootega.Core.Interfaces;
using {{ Model.Projects.Infra }}.Persistencia.Entidades;
{{~ if Model.Mirrors | count ~}}
using {{ Model.Projects.Infra }}.Persistencia.Entidades.Espelho;
{{~ end ~}}

namespace {{ Model.Projects.Infra }}.Persistencia;

public sealed partial class {{ Model.Prefix }}DBContext
{
    // ── Entidades de domínio ──────────────────────────────────────────────────
{{~ for T in Model.Entities ~}}
    public DbSet<{{ T.Name }}> {{ T.Name }} => Set<{{ T.Name }}>();
{{~ end ~}}
{{~ if Model.Mirrors | count ~}}

    // ── Espelhos de outros módulos: entidade HERDADA do dono, tabela fora da migração ──
{{~ for T in Model.Mirrors ~}}
    public DbSet<{{ T.Name }}> {{ T.Name }} => Set<{{ T.Name }}>();
{{~ end ~}}
{{~ end ~}}

    // ── Tabelas-lookup: DbSets de primeira classe, utilizáveis em selects/joins ──
{{~ for T in Model.Lookups ~}}
{{# A classe da lookup tem o mesmo nome do enum dela. Sem apelido de namespace: o caminho
    inteiro na linha diz qual dos dois está sendo mapeado. #}}    public DbSet<{{ Model.Projects.Infra }}.Persistencia.Lookups.{{ T.Name }}> {{ T.Name }} => Set<{{ Model.Projects.Infra }}.Persistencia.Lookups.{{ T.Name }}>();
{{~ end ~}}

    /// <summary>
    /// Parte gerada do OnModelCreating. Chamada pelo arquivo parcial escrito à mão,
    /// que decide a ordem em relação ao resto da configuração do contexto.
    /// </summary>
    private void ConfigurarModeloGerado(ModelBuilder pBuilder, XICurrentUserContext pContext)
    {
{{~ if Model.Mirrors | count ~}}
        // As entidades espelhadas HERDAM a classe do dono. O Entity Framework, ao mapear uma classe
        // derivada, sobe até a RAIZ da hierarquia e a trata como entidade — o que faria da classe do
        // dono uma entidade deste modelo, com discriminador de herança (TPH) e uma coluna nova na
        // tabela ALHEIA. Ignorar a base corta isso pela raiz.
{{~ for T in Model.Mirrors ~}}
        pBuilder.Ignore<{{ T.OwnerModule }}.Infra.Persistencia.{{ if T.SourceStereotype == "Lookup" }}Lookups{{ else }}Entidades{{ end }}.{{ T.Name }}>();
{{~ end ~}}

{{~ end ~}}
        pBuilder.ApplyConfigurationsFromAssembly(typeof({{ Model.Prefix }}DBContext).Assembly);
{{~ if Model.Owned | count ~}}

        // FILTRO IMPLÍCITO DE LEITURA (não burlável). Inquilino = {{ Model.TenantTable }}ID.
{{~ for T in Model.Owned ~}}
        XOwnership.ApplyOwnershipFilter<{{ T.Name }}>(pBuilder, pContext, pTenantKey: e => e.{{ T.TenantColumn }});
{{~ end ~}}
{{~ end ~}}
    }
{{~ if Model.Owned | count ~}}

    /// <summary>
    /// FILTRO IMPLÍCITO DE ESCRITA (não burlável). Mesmo conjunto de entidades da leitura.
    /// Chamada pelo SaveChanges do arquivo parcial escrito à mão.
    /// </summary>
    private void AplicarPosseNaEscritaGerado(XICurrentUserContext pContext)
    {
        const string inquilino = "{{ Model.TenantTable }}ID";

{{~ for T in Model.Owned ~}}
        XOwnership.EnforceOwnershipOnSave<{{ T.Name }}>(ChangeTracker, pContext, pTenantProperty: inquilino);
{{~ end ~}}
    }
{{~ end ~}}
}
