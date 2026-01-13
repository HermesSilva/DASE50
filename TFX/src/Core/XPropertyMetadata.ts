/**
 * XPropertyMetadata - Sistema de metadados dinâmicos para propriedades
 * 
 * ══════════════════════════════════════════════════════════════════════════════
 * ARQUITETURA
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * Este módulo fornece uma infraestrutura extensível para controlar o comportamento
 * dinâmico de propriedades baseado no estado do elemento. Permite:
 * 
 * 1. VISIBILIDADE: Mostrar/ocultar propriedades baseado no contexto
 *    Ex: Length só é visível quando DataType é String, Numeric ou Decimal
 * 
 * 2. READ-ONLY: Controlar se uma propriedade pode ser editada
 *    Ex: DataType é read-only quando o campo é uma Foreign Key
 * 
 * 3. REQUIRED: Indicar se uma propriedade é obrigatória
 *    Ex: Length é obrigatório quando DataType é Numeric
 * 
 * 4. VALIDAÇÃO: Validar valores baseado em regras contextuais
 *    Ex: Scale deve ser <= Length para campos Decimal
 * 
 * 5. EXTENSIBILIDADE: Fácil adição de novas regras e funcionalidades
 * 
 * ══════════════════════════════════════════════════════════════════════════════
 * USO
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * Cada designer (ORM, UI, Flow, etc.) deve:
 * 1. Criar um provider específico herdando de XPropertyMetadataProvider
 * 2. Registrar regras para cada propriedade que precisa de comportamento dinâmico
 * 3. O provider é usado pela UI para determinar como renderizar cada propriedade
 * 
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { XDesignerErrorSeverity } from "./XValidation.js";

/**
 * UserFix - Correção automática que pode ser aplicada pelo usuário
 * Representa uma ação que resolve um problema de validação
 */
export interface XIUserFix
{
    /** ID único do fix */
    readonly ID: string;
    /** Rótulo exibido para o usuário */
    readonly Label: string;
    /** Descrição detalhada do que o fix faz */
    readonly Description?: string;
    /** Função que aplica o fix no elemento. Retorna true se bem-sucedido */
    readonly Apply: (pElement: unknown) => boolean;
}

/**
 * Resultado de validação de uma propriedade
 */
export interface XIPropertyValidationResult
{
    /** ID da propriedade validada */
    readonly PropertyID: string;
    /** Nome da propriedade validada */
    readonly PropertyName: string;
    /** Severidade do problema (Warning ou Error) */
    readonly Severity: XDesignerErrorSeverity;
    /** Mensagem descritiva do problema */
    readonly Message: string;
    /** UserFixes disponíveis para resolver o problema */
    readonly UserFixes?: XIUserFix[];
}

/**
 * Metadados dinâmicos de uma propriedade para um elemento específico
 * Estes metadados são calculados baseados no estado atual do elemento
 */
export interface XIPropertyMetadata
{
    /** ID da propriedade */
    readonly PropertyID: string;
    /** Nome da propriedade para exibição */
    readonly PropertyName: string;
    /** A propriedade deve ser exibida na UI? */
    readonly IsVisible: boolean;
    /** A propriedade é somente leitura? */
    readonly IsReadOnly: boolean;
    /** A propriedade é obrigatória? */
    readonly IsRequired: boolean;
    /** Valor atual é válido? */
    readonly IsValid: boolean;
    /** Mensagens de validação (se houver) */
    readonly ValidationMessages: XIPropertyValidationResult[];
    /** Dica/tooltip para a propriedade */
    readonly Hint?: string;
    /** Placeholder para campos de entrada */
    readonly Placeholder?: string;
}

/**
 * Contexto para avaliação de regras de propriedade
 * Fornece acesso ao elemento e informações adicionais do ambiente
 */
export interface XIPropertyContext<TElement>
{
    /** Elemento sendo avaliado */
    readonly Element: TElement;
    /** ID da propriedade sendo avaliada */
    readonly PropertyID: string;
    /** Nome da propriedade sendo avaliada */
    readonly PropertyName: string;
    /** Valor atual da propriedade */
    readonly CurrentValue: unknown;
    /** Função para obter valor de outra propriedade do elemento */
    GetPropertyValue(pPropertyID: string): unknown;
}

/**
 * Função que avalia uma condição baseada no contexto
 */
export type TPropertyCondition<TElement> = (pContext: XIPropertyContext<TElement>) => boolean;

/**
 * Função que valida uma propriedade e retorna mensagem de erro ou null se válido
 */
export type TPropertyValidator<TElement> = (pContext: XIPropertyContext<TElement>) => XIPropertyValidationResult | null;

/**
 * Função que retorna uma string dinâmica baseada no contexto
 */
export type TPropertyStringProvider<TElement> = (pContext: XIPropertyContext<TElement>) => string | undefined;

/**
 * Regra de comportamento para uma propriedade
 * Define como a propriedade deve se comportar baseado no estado do elemento
 */
export interface XIPropertyRule<TElement>
{
    /** ID da propriedade que esta regra afeta */
    readonly PropertyID: string;
    /** Nome da propriedade para exibição */
    readonly PropertyName: string;
    /** Condição para visibilidade (default: true) */
    readonly IsVisible?: TPropertyCondition<TElement>;
    /** Condição para read-only (default: false) */
    readonly IsReadOnly?: TPropertyCondition<TElement>;
    /** Condição para obrigatoriedade (default: false) */
    readonly IsRequired?: TPropertyCondition<TElement>;
    /** Validadores para a propriedade */
    readonly Validators?: TPropertyValidator<TElement>[];
    /** Provider de hint/tooltip dinâmico */
    readonly HintProvider?: TPropertyStringProvider<TElement>;
    /** Provider de placeholder dinâmico */
    readonly PlaceholderProvider?: TPropertyStringProvider<TElement>;
}

/**
 * Opções para criação de regra simplificada
 */
export interface XIPropertyRuleOptions<TElement>
{
    /** Condição para visibilidade */
    IsVisible?: TPropertyCondition<TElement>;
    /** Condição para read-only */
    IsReadOnly?: TPropertyCondition<TElement>;
    /** Condição para obrigatoriedade */
    IsRequired?: TPropertyCondition<TElement>;
    /** Validadores */
    Validators?: TPropertyValidator<TElement>[];
    /** Hint dinâmico */
    HintProvider?: TPropertyStringProvider<TElement>;
    /** Placeholder dinâmico */
    PlaceholderProvider?: TPropertyStringProvider<TElement>;
}

/**
 * Classe base abstrata para providers de metadados de propriedades
 * Cada designer deve criar uma implementação específica para seus elementos
 * 
 * @typeParam TElement - Tipo do elemento que este provider avalia
 */
export abstract class XPropertyMetadataProvider<TElement>
{
    private readonly _Rules: Map<string, XIPropertyRule<TElement>> = new Map();
    private readonly _GlobalValidators: TPropertyValidator<TElement>[] = [];

    /**
     * Registra uma regra para uma propriedade
     */
    protected AddRule(pRule: XIPropertyRule<TElement>): void
    {
        this._Rules.set(pRule.PropertyID, pRule);
    }

    /**
     * Forma simplificada de adicionar regra
     */
    protected AddPropertyRule(
        pPropertyID: string,
        pPropertyName: string,
        pOptions: XIPropertyRuleOptions<TElement>
    ): void
    {
        this.AddRule({
            PropertyID: pPropertyID,
            PropertyName: pPropertyName,
            ...pOptions
        });
    }

    /**
     * Adiciona um validador global que é executado para todas as propriedades
     */
    protected AddGlobalValidator(pValidator: TPropertyValidator<TElement>): void
    {
        this._GlobalValidators.push(pValidator);
    }

    /**
     * Remove uma regra existente (útil para herança/customização)
     */
    protected RemoveRule(pPropertyID: string): boolean
    {
        return this._Rules.delete(pPropertyID);
    }

    /**
     * Obtém regra de uma propriedade
     */
    protected GetRule(pPropertyID: string): XIPropertyRule<TElement> | undefined
    {
        return this._Rules.get(pPropertyID);
    }

    /**
     * Verifica se existe regra para uma propriedade
     */
    public HasRule(pPropertyID: string): boolean
    {
        return this._Rules.has(pPropertyID);
    }

    /**
     * Obtém lista de IDs de propriedades com regras registradas
     */
    public GetRegisteredPropertyIDs(): string[]
    {
        return Array.from(this._Rules.keys());
    }

    /**
     * Cria o contexto de avaliação para uma propriedade
     * Subclasses podem sobrescrever para fornecer contexto adicional
     */
    protected abstract CreateContext(
        pElement: TElement,
        pPropertyID: string,
        pPropertyName: string
    ): XIPropertyContext<TElement>;

    /**
     * Obtém o valor atual de uma propriedade do elemento
     * Subclasses devem implementar baseado na estrutura do elemento
     */
    protected abstract GetPropertyValue(pElement: TElement, pPropertyID: string): unknown;

    /**
     * Obtém o nome de uma propriedade
     * Subclasses devem implementar baseado na estrutura do elemento
     */
    protected abstract GetPropertyName(pPropertyID: string): string;

    /**
     * Calcula os metadados de uma propriedade para um elemento específico
     */
    public GetMetadata(pElement: TElement, pPropertyID: string): XIPropertyMetadata
    {
        const rule = this._Rules.get(pPropertyID);
        const propertyName = rule?.PropertyName ?? this.GetPropertyName(pPropertyID);
        const context = this.CreateContext(pElement, pPropertyID, propertyName);

        // Valores default
        let isVisible = true;
        let isReadOnly = false;
        let isRequired = false;
        let hint: string | undefined;
        let placeholder: string | undefined;
        const validationMessages: XIPropertyValidationResult[] = [];

        if (rule)
        {
            // Avalia condições
            if (rule.IsVisible)
                isVisible = rule.IsVisible(context);

            if (rule.IsReadOnly)
                isReadOnly = rule.IsReadOnly(context);

            if (rule.IsRequired)
                isRequired = rule.IsRequired(context);

            // Providers de texto
            if (rule.HintProvider)
                hint = rule.HintProvider(context);

            if (rule.PlaceholderProvider)
                placeholder = rule.PlaceholderProvider(context);

            // Validadores da regra
            if (rule.Validators)
            {
                for (const validator of rule.Validators)
                {
                    const result = validator(context);
                    if (result)
                        validationMessages.push(result);
                }
            }
        }

        // Validadores globais
        for (const validator of this._GlobalValidators)
        {
            const result = validator(context);
            if (result && result.PropertyID === pPropertyID)
                validationMessages.push(result);
        }

        // Validação de obrigatoriedade
        if (isRequired && isVisible && !isReadOnly)
        {
            const value = context.CurrentValue;
            if (value === null || value === undefined || value === "")
            {
                validationMessages.push({
                    PropertyID: pPropertyID,
                    PropertyName: propertyName,
                    Severity: XDesignerErrorSeverity.Error,
                    Message: `${propertyName} is required.`
                });
            }
        }

        return {
            PropertyID: pPropertyID,
            PropertyName: propertyName,
            IsVisible: isVisible,
            IsReadOnly: isReadOnly,
            IsRequired: isRequired,
            IsValid: validationMessages.length === 0,
            ValidationMessages: validationMessages,
            Hint: hint,
            Placeholder: placeholder
        };
    }

    /**
     * Calcula metadados para todas as propriedades com regras registradas
     */
    public GetAllMetadata(pElement: TElement): Map<string, XIPropertyMetadata>
    {
        const result = new Map<string, XIPropertyMetadata>();
        for (const propertyID of this._Rules.keys())
            result.set(propertyID, this.GetMetadata(pElement, propertyID));
        return result;
    }

    /**
     * Valida todas as propriedades e retorna lista de problemas
     */
    public ValidateAll(pElement: TElement): XIPropertyValidationResult[]
    {
        const results: XIPropertyValidationResult[] = [];
        for (const propertyID of this._Rules.keys())
        {
            const metadata = this.GetMetadata(pElement, propertyID);
            results.push(...metadata.ValidationMessages);
        }
        return results;
    }

    /**
     * Verifica se uma propriedade é visível
     */
    public IsPropertyVisible(pElement: TElement, pPropertyID: string): boolean
    {
        return this.GetMetadata(pElement, pPropertyID).IsVisible;
    }

    /**
     * Verifica se uma propriedade é read-only
     */
    public IsPropertyReadOnly(pElement: TElement, pPropertyID: string): boolean
    {
        return this.GetMetadata(pElement, pPropertyID).IsReadOnly;
    }

    /**
     * Verifica se uma propriedade é required
     */
    public IsPropertyRequired(pElement: TElement, pPropertyID: string): boolean
    {
        return this.GetMetadata(pElement, pPropertyID).IsRequired;
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS PARA CRIAÇÃO DE REGRAS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Cria um validador que verifica se o valor está em uma lista permitida
 */
export function CreateEnumValidator<TElement>(
    pPropertyID: string,
    pPropertyName: string,
    pAllowedValues: unknown[]
): TPropertyValidator<TElement>
{
    return (ctx) =>
    {
        if (!pAllowedValues.includes(ctx.CurrentValue))
        {
            return {
                PropertyID: pPropertyID,
                PropertyName: pPropertyName,
                Severity: XDesignerErrorSeverity.Error,
                Message: `${pPropertyName} must be one of: ${pAllowedValues.join(", ")}`
            };
        }
        return null;
    };
}

/**
 * Cria um validador que verifica valor mínimo
 */
export function CreateMinValidator<TElement>(
    pPropertyID: string,
    pPropertyName: string,
    pMin: number
): TPropertyValidator<TElement>
{
    return (ctx) =>
    {
        const value = ctx.CurrentValue as number;
        if (typeof value === "number" && value < pMin)
        {
            return {
                PropertyID: pPropertyID,
                PropertyName: pPropertyName,
                Severity: XDesignerErrorSeverity.Error,
                Message: `${pPropertyName} must be at least ${pMin}.`
            };
        }
        return null;
    };
}

/**
 * Cria um validador que verifica valor máximo
 */
export function CreateMaxValidator<TElement>(
    pPropertyID: string,
    pPropertyName: string,
    pMax: number
): TPropertyValidator<TElement>
{
    return (ctx) =>
    {
        const value = ctx.CurrentValue as number;
        if (typeof value === "number" && value > pMax)
        {
            return {
                PropertyID: pPropertyID,
                PropertyName: pPropertyName,
                Severity: XDesignerErrorSeverity.Error,
                Message: `${pPropertyName} must be at most ${pMax}.`
            };
        }
        return null;
    };
}

/**
 * Cria um validador que verifica range (min-max)
 */
export function CreateRangeValidator<TElement>(
    pPropertyID: string,
    pPropertyName: string,
    pMin: number,
    pMax: number
): TPropertyValidator<TElement>
{
    return (ctx) =>
    {
        const value = ctx.CurrentValue as number;
        if (typeof value === "number" && (value < pMin || value > pMax))
        {
            return {
                PropertyID: pPropertyID,
                PropertyName: pPropertyName,
                Severity: XDesignerErrorSeverity.Error,
                Message: `${pPropertyName} must be between ${pMin} and ${pMax}.`
            };
        }
        return null;
    };
}

/**
 * Cria um validador baseado em regex
 */
export function CreatePatternValidator<TElement>(
    pPropertyID: string,
    pPropertyName: string,
    pPattern: RegExp,
    pMessage?: string
): TPropertyValidator<TElement>
{
    return (ctx) =>
    {
        const value = ctx.CurrentValue;
        if (typeof value === "string" && !pPattern.test(value))
        {
            return {
                PropertyID: pPropertyID,
                PropertyName: pPropertyName,
                Severity: XDesignerErrorSeverity.Error,
                Message: pMessage ?? `${pPropertyName} has invalid format.`
            };
        }
        return null;
    };
}

/**
 * Cria um validador customizado
 */
export function CreateCustomValidator<TElement>(
    pPropertyID: string,
    pPropertyName: string,
    pCondition: (pValue: unknown, pContext: XIPropertyContext<TElement>) => boolean,
    pMessage: string,
    pSeverity: XDesignerErrorSeverity = XDesignerErrorSeverity.Error,
    pUserFixes?: XIUserFix[]
): TPropertyValidator<TElement>
{
    return (ctx) =>
    {
        if (!pCondition(ctx.CurrentValue, ctx))
        {
            return {
                PropertyID: pPropertyID,
                PropertyName: pPropertyName,
                Severity: pSeverity,
                Message: pMessage,
                UserFixes: pUserFixes
            };
        }
        return null;
    };
}

/**
 * Cria uma condição que verifica se uma propriedade tem um valor específico
 */
export function WhenPropertyEquals<TElement>(
    pPropertyID: string,
    pValue: unknown
): TPropertyCondition<TElement>
{
    return (ctx) => ctx.GetPropertyValue(pPropertyID) === pValue;
}

/**
 * Cria uma condição que verifica se uma propriedade está em uma lista de valores
 */
export function WhenPropertyIn<TElement>(
    pPropertyID: string,
    pValues: unknown[]
): TPropertyCondition<TElement>
{
    return (ctx) => pValues.includes(ctx.GetPropertyValue(pPropertyID));
}

/**
 * Cria uma condição que verifica se uma propriedade NÃO está em uma lista
 */
export function WhenPropertyNotIn<TElement>(
    pPropertyID: string,
    pValues: unknown[]
): TPropertyCondition<TElement>
{
    return (ctx) => !pValues.includes(ctx.GetPropertyValue(pPropertyID));
}

/**
 * Combina múltiplas condições com AND
 */
export function AllOf<TElement>(
    ...pConditions: TPropertyCondition<TElement>[]
): TPropertyCondition<TElement>
{
    return (ctx) => pConditions.every(c => c(ctx));
}

/**
 * Combina múltiplas condições com OR
 */
export function AnyOf<TElement>(
    ...pConditions: TPropertyCondition<TElement>[]
): TPropertyCondition<TElement>
{
    return (ctx) => pConditions.some(c => c(ctx));
}

/**
 * Inverte uma condição (NOT)
 */
export function Not<TElement>(
    pCondition: TPropertyCondition<TElement>
): TPropertyCondition<TElement>
{
    return (ctx) => !pCondition(ctx);
}
