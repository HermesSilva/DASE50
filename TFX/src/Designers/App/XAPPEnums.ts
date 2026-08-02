/**
 * Enumerados do domínio de App/Formulário — espelham, por nome, os enums de
 * `Tootega.Core.Model` (back do TootegaERP: `XApplication.cs`, `XUIEditorModel.cs`,
 * `XButton.cs`, `XFilter.cs`, `XVisibilityRule.cs`). O designer edita aqui o MESMO
 * vocabulário que a `FabricaAppXXX.cs` grava à mão hoje.
 */

/** D31 — fronteira dura entre administração do tenant e uso do tenant. */
export enum XAPPScope
{
    TenantAdmin = 1,
    TenantUse = 2
}

/** Espelha `XViewTemplate` — qual armação estrutural o front desenha. */
export enum XAPPViewTemplate
{
    DataGrid = 1,
    Custom = 2,
    Dashboard = 3
}

/** Espelha `XUIEditorType` (`XUIEditorModel.cs`) — 28 membros hoje. */
export enum XAPPEditorType
{
    Text = 1,
    TextArea = 2,
    Number = 3,
    Date = 4,
    DateTime = 5,
    Time = 6,
    Boolean = 7,
    ComboBox = 8,
    RadioButton = 9,
    Checkbox = 10,
    FileUpload = 11,
    ColorPicker = 12,
    DataLookup = 13,
    AutoComplete = 14,
    Password = 15,
    Email = 16,
    Phone = 17,
    Currency = 18,
    CPF = 19,
    CNPJ = 20,
    CEP = 21,
    Slider = 22,
    Rating = 23,
    Hidden = 24,
    Percent = 25,
    URL = 26,
    MultiSelect = 27,
    ImageUpload = 28
}

/** Espelha `XDataType` — tipo de exibição de uma coluna de grade/coluna de detalhe. */
export enum XAPPDataType
{
    String = 1,
    Integer = 2,
    Decimal = 3,
    Currency = 4,
    Date = 5,
    DateTime = 6,
    Boolean = 7,
    CPF = 8,
    CNPJ = 9,
    CEP = 10
}

/** Espelha `XButtonType` — cor/ênfase visual do botão. */
export enum XAPPButtonType
{
    Primary = 1,
    Secondary = 2,
    Danger = 3,
    Success = 4
}

/**
 * Espelha `XButtonAction` — ação padrão do motor genérico, ou `Custom` quando o
 * comportamento vem de `ActionCommand` (registrado no front via `XButtonActionRegistry`,
 * ver `extensao-do-motor.md`).
 */
export enum XAPPButtonAction
{
    Create = 1,
    Edit = 2,
    Delete = 3,
    View = 4,
    Import = 5,
    Export = 6,
    Print = 7,
    Activate = 8,
    Deactivate = 9,
    RemoveChecked = 10,
    Custom = 11
}

/** Espelha `XFilterOperator` — usado por `XAPPFilterField.DefaultOperator`. */
export enum XAPPFilterOperator
{
    Contains = 1,
    Equal = 2,
    GreaterThanOrEqual = 3,
    LessThanOrEqual = 4
}

/**
 * Espelha as três formas de `XVisibilityRule` (`app-acoes-de-linha.md` §3):
 * "tem valor", "está vazio", "é igual a um dos valores".
 */
export enum XAPPVisibilityOperator
{
    Preenchido = 1,
    Vazio = 2,
    Igual = 3
}
