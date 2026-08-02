{{ include "_Header.tpl" }}
#nullable enable

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

using Tootega.Core.Data;
using {{ Model.Projects.Infra }}.Persistencia.Entidades.Espelho;

namespace {{ Model.Projects.Infra }}.Persistencia.Configurations;

/// <summary>
/// Espelho de <c>{{ Table.Name }}</c> (dono: {{ Table.OwnerModule }}), excluído da migração deste módulo.
/// As chaves estrangeiras às lookups e catálogos do dono NÃO se declaram aqui: pertencem ao modelo
/// dele, e trazê-las obrigaria este módulo a mapear tabelas alheias sem ganho.
/// </summary>
public sealed class {{ Table.Name }}EspelhoConfiguration : XBaseEntityConfiguration<{{ Table.Name }}>
{
    public override void Configure(EntityTypeBuilder<{{ Table.Name }}> pBuilder)
    {
        pBuilder.ToTable(nameof({{ Table.Name }}), t => t.ExcludeFromMigrations());
{{~ if Table.PK ~}}
        pBuilder.HasKey(e => e.{{ Table.PK.Name }});
{{~ end ~}}

{{~ for F in Table.Fields ~}}
        pBuilder.Property(e => e.{{ F.Name }}).HasColumnType({{ F.ColumnType }}){{ if F.IsPrimaryKey && Table.PKValueGeneratedNever }}.ValueGeneratedNever(){{ end }}{{ if F.IsRequired && !F.IsPrimaryKey && F.BaseType == "string" }}.IsRequired(){{ end }};
{{~ end ~}}
{{~ if Table.Indexes | count ~}}

{{~ for IX in Table.Indexes ~}}
        pBuilder.HasIndex({{ if IX.Fields | count > 1 }}e => new { {{ for C in IX.Fields }}e.{{ C }}{{ if !for.last }}, {{ end }}{{ end }} }{{ else }}e => e.{{ IX.Fields | first }}{{ end }}){{ if IX.IsUnique }}.IsUnique(){{ end }}{{ if IX.HasDescending }}.IsDescending({{ for D in IX.Descending }}{{ D }}{{ if !for.last }}, {{ end }}{{ end }}){{ end }}{{ if IX.IncludeFields | count ~}}.IncludeProperties(e => new { {{ for C in IX.IncludeFields }}e.{{ C }}{{ if !for.last }}, {{ end }}{{ end }} }){{~ end }}{{ if IX.Filter }}.HasFilter({{ IX.Filter }}){{ end }};
{{~ end ~}}
{{~ end ~}}
    }
}
