{{ include "_Header.tpl" }}
#nullable enable

namespace {{ Model.Projects.Infra }}.Persistencia.Lookups;

{{# NÃO É `sealed`: outro módulo pode ESPELHAR esta lookup, e o espelho se faz herdando a classe
    do dono (ver MirrorEntity.tpl) — selar aqui impedia a FK entre módulos, que é o motivo de a
    lookup existir como tabela. Herdar não acrescenta coluna nem discriminador: o DbContext do
    outro módulo ignora a base e mapeia a derivada na MESMA tabela, fora da migração dele. #}}/// <summary>Tabela-lookup de {{ Table.Name }}.</summary>
public class {{ Table.Name }}
{
{{# A chave é o ENUM de mesmo nome, que mora no projeto Common. Sem apelido de namespace: um
    `using` curto aqui colidiria com esta própria classe, e o caminho inteiro resolve na linha. #}}    public {{ Model.Projects.Common }}.Lookups.{{ Table.Name }} {{ Table.PK.Name }} { get; set; }
{{~ for F in Table.DataFields ~}}
    public {{ F.Type }} {{ F.Name }} { get; set; }{{ if F.Init }} = {{ F.Init }};{{ end }}
{{~ end ~}}
}
