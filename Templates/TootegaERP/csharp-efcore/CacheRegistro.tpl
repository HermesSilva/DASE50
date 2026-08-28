{{ include "_Header.tpl" }}
#nullable enable

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

using Tootega.Core.Data;
using {{ Model.Projects.Infra }}.Persistencia.Entidades;

namespace {{ Model.Projects.Infra }}.Persistencia;

{{# Registro AUTOMÁTICO do cache local (ADR-0005). Uma entrada por entidade marcada `IsCached` no
    MER — regerado a cada geração, então tabela que entra ou sai da regra se reflete aqui sozinha,
    sem edição à mão. A categoria vem da FORMA da tabela, não de nova propriedade:
      • tem posse por inquilino  ⇒ RegistrarPorInquilino  (invalida na escrita, chave com o tenant);
      • sem posse (referência global) ⇒ RegistrarReferencia (servida da memória, sem refresh).
    O CARREGADOR é montado aqui, na Infra, porque é só aqui que o {{ Model.Prefix }}DBContext existe
    (CE-7/CE-11): a estratégia no Core fica agnóstica de contexto e recebe como ler cada entidade.
    Lookup não aparece aqui: já é cache por ser lookup (enum + XLookupCache), e não gera Entity. #}}
public static class {{ Model.Prefix }}CacheRegistro
{
    /// <summary>
    /// Registra no contêiner o cache local de todas as entidades cacheadas do módulo {{ Model.Module }}.
    /// Chamado uma vez pela raiz de composição do módulo (AddTootega{{ Model.Module }}API).
    /// </summary>
    public static IServiceCollection AddCache{{ Model.Module }}(this IServiceCollection pServicos)
    {
{{~ for T in Model.Cached ~}}
{{~ if T.HasTenant ~}}
        XCacheEntidade.RegistrarPorInquilino<{{ T.Name }}>(pServicos, Carregar{{ T.Name }}, e => e.{{ T.TenantColumn }});
{{~ else ~}}
        XCacheEntidade.RegistrarReferencia<{{ T.Name }}>(pServicos, Carregar{{ T.Name }});
{{~ end ~}}
{{~ end ~}}
        return pServicos;
    }
{{~ for T in Model.Cached ~}}

    private static IReadOnlyList<{{ T.Name }}> Carregar{{ T.Name }}(IServiceProvider pSp)
        => pSp.GetRequiredService<{{ Model.Prefix }}DBContext>().Set<{{ T.Name }}>().AsNoTracking().ToList();
{{~ end ~}}
}
