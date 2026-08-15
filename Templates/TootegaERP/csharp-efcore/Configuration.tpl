{{ include "_Header.tpl" }}
#nullable enable

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

using {{ Model.Projects.Common }}.Lookups;
using {{ Model.Projects.Infra }}.Persistencia.Entidades;
{{# A FK pode apontar um ESPELHO de outro módulo, cuja classe vive em Entidades.Espelho. O `using`
    só sai quando há espelho: em módulo sem nenhum, o namespace não existe e não compilaria. #}}
{{~ if Model.Mirrors | count ~}}
using {{ Model.Projects.Infra }}.Persistencia.Entidades.Espelho;
{{~ end ~}}

namespace {{ Model.Projects.Infra }}.Persistencia.Configurations;

public sealed class {{ Table.Name }}Configuration : {{ Model.Prefix }}BaseConfiguration<{{ Table.Name }}>
{
    public override void Configure(EntityTypeBuilder<{{ Table.Name }}> pBuilder)
    {
        pBuilder.ToTable(nameof({{ Table.Name }}));
{{~ if Table.PK ~}}
        pBuilder.HasKey(e => e.{{ Table.PK.Name }});
{{~ end ~}}

{{# Campo da tabela MÃE fica fora daqui: a propriedade é da base, e quem declara o tipo de coluna
    dela é o ConfigurarAuditoria da configuração-base do módulo, chamado ao fim deste Configure.
    Por isso o laço é sobre `Table.OwnFields` (só os próprios), e não `Table.Fields`. #}}
{{~ for F in Table.OwnFields ~}}
        pBuilder.Property(e => e.{{ F.Name }}).HasColumnType({{ F.ColumnType }}){{ if F.IsPrimaryKey && Table.PKValueGeneratedNever }}.ValueGeneratedNever(){{ end }}{{ if F.IsRequired && !F.IsPrimaryKey && F.BaseType == "string" }}.IsRequired(){{ end }}{{ if F.DefaultValue }}.HasDefaultValue({{ F.DefaultValue | strip_prefix "=" }}){{ end }};
{{~ end ~}}
{{~ if Table.ForeignKeys | count ~}}

{{~ for F in Table.ForeignKeys ~}}
{{# O ALVO é espelho? A FK não sabe dizer — o vocabulário dela expõe só o nome da tabela de
    destino —, mas o MODELO sabe: `Model.Mirrors` é a lista das tabelas espelhadas. Cruzar o nome
    é o que distingue uma lookup PRÓPRIA (que nasce em `Persistencia/Lookups`) de uma ESPELHADA
    (que nasce em `Persistencia/Entidades/Espelho`, herdando da do módulo dono).

    Sem esta distinção, toda FK para lookup era qualificada como `<Infra>.Persistencia.Lookups.X`
    — e, no caso espelhado, apontava um tipo que não existe neste módulo: o NFExCFOP, apontando
    STQxTipoMovimento, não compilava (2026-08-08). #}}
{{~ if F.LookupEnum ~}}
{{# A tabela-lookup tem o nome do enum que o `using` acima já trouxe. Sem apelido de namespace:
    o caminho inteiro diz qual dos dois é na própria linha, e não obriga a subir o arquivo para
    descobrir o que `Lk` significava.

    E o caminho DEPENDE DA ORIGEM: lookup própria vive em `Persistencia/Lookups`; lookup ESPELHADA
    de outro módulo vive em `Persistencia/Entidades/Espelho`, herdando a do dono. A FK não sabe
    dizer qual é — o vocabulário dela expõe só o nome do destino —, mas o MODELO sabe: o alvo está
    em `Model.Lookups` OU em `Model.Mirrors`, nunca nos dois. Daí os dois laços: cada um emite a
    linha no seu caso, e exatamente um deles casa.

    Sem isto, toda FK de lookup saía como `<Infra>.Persistencia.Lookups.X` e, no caso espelhado,
    apontava um tipo inexistente neste módulo — o NFExCFOP, apontando STQxTipoMovimento, não
    compilava (2026-08-08). #}}
{{~ for L in Model.Lookups ~}}
{{~ if L.Name == F.TargetTable ~}}
        pBuilder.HasOne<{{ Model.Projects.Infra }}.Persistencia.Lookups.{{ F.TargetTable }}>().WithMany().HasForeignKey(e => e.{{ F.Name }});
{{~ end ~}}
{{~ end ~}}
{{~ for M in Model.Mirrors ~}}
{{~ if M.Name == F.TargetTable ~}}
        pBuilder.HasOne<{{ Model.Projects.Infra }}.Persistencia.Entidades.Espelho.{{ F.TargetTable }}>().WithMany().HasForeignKey(e => e.{{ F.Name }});
{{~ end ~}}
{{~ end ~}}
{{~ else if F.IsOneToOne ~}}
        pBuilder.HasOne<{{ F.TargetTable }}>().WithOne().HasForeignKey<{{ Table.Name }}>(e => e.{{ F.Name }});
{{~ else ~}}
        pBuilder.HasOne<{{ F.TargetTable }}>().WithMany().HasForeignKey(e => e.{{ F.Name }});
{{~ end ~}}
{{~ end ~}}
{{~ end ~}}
{{~ if Table.Indexes | count ~}}

{{~ for IX in Table.Indexes ~}}
        pBuilder.HasIndex({{ if IX.Fields | count > 1 }}e => new { {{ for C in IX.Fields }}e.{{ C }}{{ if !for.last }}, {{ end }}{{ end }} }{{ else }}e => e.{{ IX.Fields | first }}{{ end }}){{ if IX.IsUnique }}.IsUnique(){{ end }}{{ if IX.Filter }}.HasFilter({{ IX.Filter }}){{ end }};
{{~ end ~}}
{{~ end ~}}
{{# LINHA-SENTINELA (CE-12 forma 1) fica FORA do HasData. A chave dela é 0, e o Entity Framework
    recusa seed com chave 0 em coluna de identidade ("a non-zero value is required") — o
    `migrations add` nem chega a rodar. A linha continua declarada no MER, que é a verdade do
    modelo (CE-14); quem a grava é o semeador do módulo, no go-live, de forma idempotente.
    Tabela cuja chave NÃO é gerada pelo banco não tem esse impedimento: ali o 0 é seed normal. #}}
{{# O seed sai como ARRAY (e não como lista de argumentos) para a vírgula final ser legal em C#:
    pular a última linha por ser sentinela deixaria um argumento pendurado. Array vazio é válido e
    não semeia nada. #}}
{{~ if Table.Seed | count ~}}

        pBuilder.HasData(new {{ Table.Name }}[]
        {
{{~ for R in Table.Seed ~}}
{{~ if !(Table.PK && !Table.PKValueGeneratedNever && R.Raw[Table.PK.Name] == "0") ~}}
            new {{ Table.Name }}
            {
{{~ for C in Table.Fields ~}}
{{~ if R.Values[C.Name] ~}}
{{# FK de lookup é tipada no ENUM da lookup (CE-1), e o seed traz o código numérico: sem a
    conversão explícita o literal inteiro não atribui ao enum. #}}
                {{ C.Name }} = {{ if C.LookupEnum }}({{ C.LookupEnum }}){{ end }}{{ R.Values[C.Name] }},
{{~ end ~}}
{{~ end ~}}
            },
{{~ end ~}}
{{~ end ~}}
        });
{{~ end ~}}

        ConfigurarAuditoria(pBuilder);
    }
}
