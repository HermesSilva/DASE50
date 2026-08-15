{{ include "_Header.tpl" }}
#nullable enable

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

using Tootega.Core.Data;

namespace {{ Model.Projects.Infra }}.Persistencia.Configurations;

/// <summary>
/// Base das configs de entidade de domínio: tipos das colunas de auditoria (B1). Deriva de
/// <c>XBaseEntityConfiguration</c> (tipos por provedor). As configurações geradas chamam
/// <see cref="ConfigurarAuditoria"/> ao fim do <c>Configure</c> — as quatro colunas vêm da tabela
/// modelo <c>XEntidadeAuditavel</c> (MER comum, CE-14), declarada no Core, de onde as entidades
/// geradas herdam.
/// </summary>
public abstract class {{ Model.Prefix }}BaseConfiguration<TEntidade> : XBaseEntityConfiguration<TEntidade>
    where TEntidade : XEntidadeAuditavel
{
    protected void ConfigurarAuditoria(EntityTypeBuilder<TEntidade> pBuilder)
    {
        pBuilder.Property(e => e.DataCriacao).HasColumnType(DateTime());
        pBuilder.Property(e => e.DataAlteracao).HasColumnType(DateTime());
        pBuilder.Property(e => e.UsuarioCriacaoID).HasColumnType(UniqueIdentifier());
        pBuilder.Property(e => e.UsuarioAlteracaoID).HasColumnType(UniqueIdentifier());
    }
}
