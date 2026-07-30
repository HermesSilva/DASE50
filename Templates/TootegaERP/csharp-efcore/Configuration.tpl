{{ include "_Header.tpl" }}
#nullable enable

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

using {{ Model.Projects.Common }}.Lookups;
using {{ Model.Projects.Infra }}.Persistencia.Entidades;

using Lk = {{ Model.Projects.Infra }}.Persistencia.Lookups;

namespace {{ Model.Projects.Infra }}.Persistencia.Configurations;

public sealed class {{ Table.Name }}Configuration : {{ Model.Prefix }}BaseConfiguration<{{ Table.Name }}>
{
    public override void Configure(EntityTypeBuilder<{{ Table.Name }}> pBuilder)
    {
        pBuilder.ToTable(nameof({{ Table.Name }}));
{{~ if Table.PK ~}}
        pBuilder.HasKey(e => e.{{ Table.PK.Name }});
{{~ end ~}}

{{~ for F in Table.Fields ~}}
        pBuilder.Property(e => e.{{ F.Name }}).HasColumnType({{ F.ColumnType }}){{ if F.IsPrimaryKey && Table.PKValueGeneratedNever }}.ValueGeneratedNever(){{ end }}{{ if F.IsRequired && !F.IsPrimaryKey && F.BaseType == "string" }}.IsRequired(){{ end }}{{ if F.DefaultValue }}.HasDefaultValue({{ F.DefaultValue | strip_prefix "=" }}){{ end }};
{{~ end ~}}
{{~ if Table.ForeignKeys | count ~}}

{{~ for F in Table.ForeignKeys ~}}
{{~ if F.LookupEnum ~}}
        pBuilder.HasOne<Lk.{{ F.TargetTable }}>().WithMany().HasForeignKey(e => e.{{ F.Name }});
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
{{~ if Table.Seed | count ~}}

        pBuilder.HasData(
{{~ for R in Table.Seed ~}}
            new {{ Table.Name }}
            {
{{~ for C in Table.Fields ~}}
{{~ if R.Values[C.Name] ~}}
                {{ C.Name }} = {{ R.Values[C.Name] }},
{{~ end ~}}
{{~ end ~}}
            }{{ if !for.last }},{{ end }}
{{~ end ~}}
        );
{{~ end ~}}

        ConfigurarAuditoria(pBuilder);
    }
}
