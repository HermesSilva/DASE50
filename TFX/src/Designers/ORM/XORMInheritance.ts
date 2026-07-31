/**
 * ╔═══════════════════════════════════════════════════════════════════════════════════════════════╗
 * ║                              HERANÇA ENTRE TABELAS                                            ║
 * ╠═══════════════════════════════════════════════════════════════════════════════════════════════╣
 * ║  Uma tabela que declara `Inheritance` também gera os campos da tabela apontada. A cadeia é    ║
 * ║  percorrida AQUI, num lugar só, porque três frentes precisam exatamente da mesma resposta:    ║
 * ║                                                                                               ║
 * ║    · a geração de código, que emite os campos herdados junto com os próprios;                 ║
 * ║    · a validação, que acusa colisão de nome entre o campo próprio e o herdado;                ║
 * ║    · o painel de propriedades, que precisa saber se a base declarada existe.                  ║
 * ║                                                                                               ║
 * ║  A base pode morar em OUTRO modelo (pai ou importado). Quem tem acesso ao disco carrega       ║
 * ║  esses modelos e passa as tabelas em `XIExternalTable`; o TFX não lê arquivo.                 ║
 * ╚═══════════════════════════════════════════════════════════════════════════════════════════════╝
 */

import { XORMField } from "./XORMField.js";
import { XORMReference } from "./XORMReference.js";
import type { XORMDesign } from "./XORMDesign.js";
import type { XORMTable } from "./XORMTable.js";

/**
 * Campo tal como ele atravessa a herança — o suficiente para a tabela filha gerar a coluna,
 * sem depender do objeto de origem, que pode estar em outro documento.
 */
export interface XIInheritedField
{
    Name: string;
    Description: string;
    DataType: string;
    Length: number;
    Scale: number;
    IsRequired: boolean;
    IsAutoIncrement: boolean;
    DefaultValue: string;
    /** Nome da tabela apontada, quando o campo é chave estrangeira na origem. */
    TargetTable: string;
    /** A referência do campo é 1:1 na origem. */
    IsOneToOne: boolean;
}

/** Tabela de fora do modelo aberto, candidata a base de herança. */
export interface XIExternalTable
{
    Name: string;
    /** Campos herdáveis: os próprios da tabela, sem a chave primária. */
    Fields: XIInheritedField[];
    /** Base que ELA declara, para a cadeia continuar através dos modelos. */
    Inheritance: string;
}

export interface XIInheritanceResult
{
    /** Campos herdados, do ancestral mais distante para o mais próximo, sem repetição. */
    Fields: XIInheritedField[];
    /** Bases percorridas, da mais próxima para a mais distante. */
    Chain: string[];
    /** Base declarada que não existe nem no modelo nem entre as externas, ou vazio. */
    Missing: string;
    /** Nome onde a cadeia se fechou sobre si mesma, ou vazio. */
    Cycle: string;
}

/**
 * Campos que uma tabela cede a quem a herda: os próprios, MENOS a chave primária.
 *
 * A chave fica de fora porque quem herda tem a sua — duas colunas marcadas como primária
 * na mesma tabela não é modelo válido em lugar nenhum. A herança aqui é achatamento de
 * colunas comuns, não chave compartilhada; para compartilhar chave existe a referência 1:1.
 */
export function DescribeInheritableFields(pTable: XORMTable, pDesign: XORMDesign | null): XIInheritedField[]
{
    const referencias = pDesign?.GetChildrenOfType?.(XORMReference) ?? [];
    const tabelas = pDesign?.GetTables?.() ?? [];

    const saida: XIInheritedField[] = [];

    for (const campo of pTable.GetChildrenOfType(XORMField))
    {
        if (campo.IsPrimaryKey)
            continue;

        const ref = referencias.find(r => r.Source === campo.ID) ?? null;
        const alvo = ref ? tabelas.find(t => t.ID === ref.Target) ?? null : null;

        saida.push({
            Name: campo.Name,
            Description: campo.Description,
            DataType: campo.DataType,
            Length: campo.Length,
            Scale: campo.Scale,
            IsRequired: campo.IsRequired,
            IsAutoIncrement: campo.IsAutoIncrement,
            DefaultValue: campo.DefaultValue,
            TargetTable: alvo?.Name ?? "",
            IsOneToOne: (ref as unknown as { IsOneToOne?: boolean } | null)?.IsOneToOne === true
        });
    }

    return saida;
}

/**
 * Percorre a cadeia de herança de uma tabela e devolve os campos que ela ganha.
 *
 * A busca por cada base tenta primeiro o próprio modelo e depois as tabelas externas.
 * Tabela espelho é PULADA de propósito: ela não tem campos, é só a marca de que a original
 * mora em outro módulo — e essa original costuma estar entre as externas, que é de onde os
 * campos devem vir.
 *
 * Nada aqui lança: base ausente e ciclo voltam como dado (`Missing`, `Cycle`) para quem
 * chamou decidir. A geração precisa seguir com o que dá, e a validação é que acusa.
 */
export function ResolveInheritance(
    pTable: XORMTable,
    pDesign: XORMDesign | null,
    pExternal?: XIExternalTable[]
): XIInheritanceResult
{
    const externas = new Map<string, XIExternalTable>();
    for (const externa of pExternal ?? [])
        if (!externas.has(externa.Name.toLowerCase()))
            externas.set(externa.Name.toLowerCase(), externa);

    const proprias = (pDesign?.GetTables?.() ?? []).filter(t => !t.IsShadow);

    const visitados = new Set<string>([pTable.Name.toLowerCase()]);
    const cadeia: string[] = [];
    const camadas: XIInheritedField[][] = [];

    let missing = "";
    let cycle = "";
    let nome = pTable.Inheritance.trim();

    while (nome.length > 0)
    {
        const chave = nome.toLowerCase();

        if (visitados.has(chave))
        {
            cycle = nome;
            break;
        }
        visitados.add(chave);

        const local = proprias.find(t => t.Name.toLowerCase() === chave) ?? null;
        if (local !== null)
        {
            cadeia.push(local.Name);
            camadas.push(DescribeInheritableFields(local, pDesign));
            nome = local.Inheritance.trim();
            continue;
        }

        const externa = externas.get(chave);
        if (externa !== undefined)
        {
            cadeia.push(externa.Name);
            camadas.push(externa.Fields);
            nome = externa.Inheritance.trim();
            continue;
        }

        missing = nome;
        break;
    }

    // Do ancestral mais distante para o mais próximo: é a ordem em que os campos entram
    // na tabela filha, e a que mantém a saída estável quando um nível novo é inserido no meio.
    const campos: XIInheritedField[] = [];
    const nomesVistos = new Set<string>();

    for (let i = camadas.length - 1; i >= 0; i--)
    {
        for (const campo of camadas[i])
        {
            const chave = campo.Name.toLowerCase();
            if (nomesVistos.has(chave))
                continue;
            nomesVistos.add(chave);
            campos.push(campo);
        }
    }

    return { Fields: campos, Chain: cadeia, Missing: missing, Cycle: cycle };
}
