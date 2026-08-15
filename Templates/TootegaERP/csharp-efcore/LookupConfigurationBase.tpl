{{ include "_Header.tpl" }}
#nullable enable

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

using Tootega.Core.Data;

namespace {{ Model.Projects.Infra }}.Persistencia.Configurations;

/// <summary>
/// Base das configs de tabela-lookup (CE-1): tabela própria, PK = código <b>SMALLINT/Int16</b>
/// (CE-2, emenda 2026-06-30 — TINYINT/Int8 proibido como chave de lookup), coluna <c>Valor</c> =
/// <b>Description</b> pt-BR do enum (CE-13) e seed determinístico a partir do enum. Cada lookup é
/// tabela de primeira classe (DbSet + config + FK), utilizável em selects e junções.
///
/// <para>
/// O seed sair <b>do enum</b>, e não de uma lista à parte, é o que impede a tabela e o código de
/// divergirem: código novo entra no enum e chega ao banco pela migração seguinte, sem depender de
/// alguém lembrar de atualizar dois lugares.
/// </para>
///
/// <para>
/// Quando a entidade declara a propriedade <c>Sigla</c>, ela é semeada com o <c>[XSigla]</c> do
/// membro — o acrônimo (FEFO, LIFO) que a Description por extenso não carrega. Membro sem acrônimo
/// grava string vazia (CE-12). A lookup que não tem a coluna simplesmente não entra neste caminho.
/// </para>
/// </summary>
public abstract class {{ Model.Prefix }}LookupConfiguration<TEntidade, TEnum> : XBaseEntityConfiguration<TEntidade>
    where TEntidade : class, new()
    where TEnum : struct, Enum
{
    protected abstract string NomeChave { get; }

    /// <summary>
    /// Tamanho da coluna <c>Valor</c>. Virtual porque há lookup cuja Description não cabe em 120 —
    /// a classificação tributária do IBS/CBS é o caso conhecido. A concreta sobrescreve; as demais
    /// ficam no padrão.
    /// </summary>
    protected virtual int TamanhoValor => 120;

    public override void Configure(EntityTypeBuilder<TEntidade> pBuilder)
    {
        pBuilder.ToTable(typeof(TEntidade).Name);
        pBuilder.HasKey(NomeChave);
        pBuilder.Property(NomeChave).HasColumnType(SmallInt());
        pBuilder.Property("Valor").HasColumnType(VarChar(TamanhoValor)).IsRequired();

        var propChave = typeof(TEntidade).GetProperty(NomeChave)!;
        var propValor = typeof(TEntidade).GetProperty("Valor")!;
        var propSigla = typeof(TEntidade).GetProperty("Sigla");

        if (propSigla is not null)
            pBuilder.Property("Sigla").HasColumnType(VarChar(20)).IsRequired();

        var linhas = new List<object>();
        foreach (var valor in Enum.GetValues<TEnum>())
        {
            var linha = new TEntidade();
            propChave.SetValue(linha, valor);
            propValor.SetValue(linha, valor.AsString());
            propSigla?.SetValue(linha, valor.AsSigla());
            linhas.Add(linha);
        }

        pBuilder.HasData(linhas);
    }
}
