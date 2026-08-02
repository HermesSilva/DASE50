import { XAppBridge } from '../../Services/AppBridge';
import { XIssueSeverity } from '../../Models/IssueItem';
import { XSerializationEngine } from '@tootega/tfx';

describe('XAppBridge', () => {
    let bridge: XAppBridge;

    beforeEach(() => {
        bridge = new XAppBridge();
    });

    describe('constructor / Initialize', () => {
        it('should create an uninitialized bridge', () => {
            expect(bridge.Controller).toBeNull();
            expect(bridge.Document).toBeUndefined();
        });

        it('should initialize TFX components', () => {
            bridge.Initialize();
            expect(bridge.Controller).toBeDefined();
        });

        it('should not reinitialize if already initialized', () => {
            bridge.Initialize();
            const controller1 = bridge.Controller;
            bridge.Initialize();
            expect(bridge.Controller).toBe(controller1);
        });
    });

    describe('LoadAppModelFromText / SaveAppModelToText', () => {
        it('loads an empty model from an empty string', () => {
            const doc = bridge.LoadAppModelFromText('');
            expect(doc).toBeDefined();
            expect(doc.Name).toBe('App Model');
            expect(doc.Design).toBeDefined();
        });

        it('round-trips a saved model back through load', () => {
            bridge.LoadAppModelFromText('');
            bridge.Controller!.Design!.CreateApplication('SYSxPlanos').TitleKey = 'sys.plans.title';

            const xml = bridge.SaveAppModelToText();
            expect(xml).toContain('XAPPDocument');
            expect(xml).toContain('SYSxPlanos');

            const reloaded = new XAppBridge().LoadAppModelFromText(xml);
            expect(reloaded.Design.GetApplication()?.Name).toBe('SYSxPlanos');
            expect(reloaded.Design.GetApplication()?.TitleKey).toBe('sys.plans.title');
        });

        it('falls back to an empty document on malformed XML', () => {
            const doc = bridge.LoadAppModelFromText('<XAPPDocument><unclosed>');
            expect(doc).toBeDefined();
            expect(doc.Design).toBeDefined();
        });

        it('falls back to a fresh document when the serialization engine throws', () => {
            const deserializeSpy = jest.spyOn(XSerializationEngine.Instance, 'Deserialize').mockImplementation(() => {
                throw new Error('engine exploded');
            });

            const doc = bridge.LoadAppModelFromText('<XAPPDocument />');

            expect(doc.Name).toBe('App Model');
            expect(doc.Design).toBeDefined();

            deserializeSpy.mockRestore();
        });
    });

    describe('mutation vocabulary', () => {
        beforeEach(() => {
            bridge.LoadAppModelFromText('');
            bridge.Controller!.Design!.CreateApplication('SYSxPlanos');
        });

        it('CreateApplication is idempotent', () => {
            bridge.LoadAppModelFromText('');
            const first = bridge.CreateApplication('SYSxPlanos');
            expect(first.Success).toBe(true);

            const second = bridge.CreateApplication('Ignored');
            expect(second.ElementID).toBe(first.ElementID);
        });

        it('SetFormView / SetTabbedFormView / AddFormTab compose the form', () => {
            const formResult = bridge.SetFormView();
            expect(formResult.Success).toBe(true);

            const tabbedResult = bridge.SetTabbedFormView();
            expect(tabbedResult.Success).toBe(true);
            expect(tabbedResult.ElementID).not.toBe(formResult.ElementID); // FormView foi substituído

            expect(bridge.AddFormTab('crm.people.tab.identification').Success).toBe(true);
        });

        it('adds a column, a filter, a button and a row action', () => {
            expect(bridge.AddColumn('Nome').Success).toBe(true);
            expect(bridge.AddFilter('Nome').Success).toBe(true);
            expect(bridge.AddButton('buttonBar.new').Success).toBe(true);
            expect(bridge.AddRowAction('orders.invoice').Success).toBe(true);
        });

        it('adds a form section and a field inside it', () => {
            const app = bridge.Controller!.GetApplication()!;
            const form = app.SetFormView();

            const sectionResult = bridge.AddFormSection({ ParentID: form.ID, TitleKey: 'sys.plans.section.billing' });
            expect(sectionResult.Success).toBe(true);

            const fieldResult = bridge.AddField({
                SectionID: sectionResult.ElementID!,
                FieldName: 'Preco',
                Row: 0,
                ColSpan: 16
            });
            expect(fieldResult.Success).toBe(true);
        });

        it('updates a property using a spaced label, matching TFXBridge.UpdateProperty convention', () => {
            const app = bridge.Controller!.GetApplication()!;
            const result = bridge.UpdateProperty(app.ID, 'Title Key', 'sys.plans.title');
            expect(result.Success).toBe(true);
            expect(app.TitleKey).toBe('sys.plans.title');
        });

        it('renames and deletes an element', () => {
            const columnResult = bridge.AddColumn('Nome');
            expect(bridge.RenameElement(columnResult.ElementID!, 'NomeRenomeado').Success).toBe(true);
            expect(bridge.DeleteElement(columnResult.ElementID!).Success).toBe(true);
        });

        it('resolves element info by ID', () => {
            const columnResult = bridge.AddColumn('Nome');
            const info = bridge.GetElementInfo(columnResult.ElementID!);
            expect(info).toEqual({ ID: columnResult.ElementID, Name: '', Type: 'XAPPColumn' });
        });

        it('returns null element info for an unknown ID', () => {
            expect(bridge.GetElementInfo('does-not-exist')).toBeNull();
        });
    });

    describe('SaveAppModelToText edge cases', () => {
        it('returns an empty document XML when nothing was loaded yet', () => {
            expect(bridge.SaveAppModelToText()).toBe('<?xml version="1.0" encoding="utf-8"?>\n<XAPPDocument />');
        });

        it('returns an empty document XML when the engine reports failure', () => {
            bridge.LoadAppModelFromText('');
            const serializeSpy = jest.spyOn(XSerializationEngine.Instance, 'Serialize').mockReturnValue({ Success: false } as ReturnType<typeof XSerializationEngine.Instance.Serialize>);

            expect(bridge.SaveAppModelToText()).toBe('<?xml version="1.0" encoding="utf-8"?>\n<XAPPDocument />');

            serializeSpy.mockRestore();
        });

        it('returns an empty document XML when the engine throws', () => {
            bridge.LoadAppModelFromText('');
            const serializeSpy = jest.spyOn(XSerializationEngine.Instance, 'Serialize').mockImplementation(() => {
                throw new Error('engine exploded');
            });

            expect(bridge.SaveAppModelToText()).toBe('<?xml version="1.0" encoding="utf-8"?>\n<XAPPDocument />');

            serializeSpy.mockRestore();
        });
    });

    describe('GetModelData', () => {
        it('returns null Application when nothing is loaded', () => {
            expect(bridge.GetModelData()).toEqual({ Application: null });
        });

        it('maps a full tabbed App (CRUD-com-abas + mestre-detalhe) to plain JSON', () => {
            bridge.LoadAppModelFromText('');
            const app = bridge.Controller!.Design!.CreateApplication('CRMxPessoas');
            app.TitleKey = 'crm.people.title';

            app.AddColumn('Nome').TitleKey = 'crm.people.name';
            app.AddFilter('Nome').TitleKey = 'crm.people.name';
            app.AddButton('buttonBar.new');
            app.AddRowAction('orders.invoice').VisibleWhenValues = '1|2';
            const viewer = app.AddViewer('resumo');
            viewer.AddSection('crm.people.section.summary');

            const form = app.SetTabbedFormView();
            form.ModalWidth = 56;
            const tab = form.AddFormTab('crm.people.tab.identification', 'contact');
            const section = tab.AddSection('crm.people.section.identification');
            const field = section.AddField('Nome', 0, 32);
            field.TitleKey = 'crm.people.name';
            field.CreateFieldBinding('razaoSocial', 'Nome');
            field.CreateVisibilityRule().Field = 'TipoPessoa';

            const detailTab = form.AddDetailGridTab('crm.people.tab.services', 'receipt');
            const grid = detailTab.SetAsDetailGrid();
            grid.DataEndpoint = '/nfe/services/people/{id}/services';
            grid.AddColumn('codigo');
            grid.AddDetailField('descricao');
            grid.CreateChildGrid().AddColumn('aliquota');

            const modelData = bridge.GetModelData();
            const mappedApp = modelData.Application!;

            expect(mappedApp.Name).toBe('CRMxPessoas');
            expect(mappedApp.Columns).toHaveLength(1);
            expect(mappedApp.Filters).toHaveLength(1);
            expect(mappedApp.Buttons).toHaveLength(1);
            expect(mappedApp.RowActions[0].VisibleWhenValues).toBe('1|2');
            expect(mappedApp.Viewers[0].Sections).toHaveLength(1);
            expect(mappedApp.FormView).toBeNull();

            const mappedForm = mappedApp.TabbedFormView!;
            expect(mappedForm.ModalWidth).toBe(56);
            expect(mappedForm.Tabs).toHaveLength(2);

            const mappedField = mappedForm.Tabs[0].Sections[0].Fields[0];
            expect(mappedField.FieldBindings).toHaveLength(1);
            expect(mappedField.VisibilityRules).toHaveLength(1);

            const mappedDetailGrid = mappedForm.Tabs[1].DetailGrid!;
            expect(mappedDetailGrid.Columns).toHaveLength(1);
            expect(mappedDetailGrid.DetailFields).toHaveLength(1);
            expect(mappedDetailGrid.ChildGrid).not.toBeNull();
            expect(mappedDetailGrid.ChildGrid!.Columns[0].FieldName).toBe('aliquota');
        });

        it('maps a plain FormView (CRUD simples) App', () => {
            bridge.LoadAppModelFromText('');
            const app = bridge.Controller!.Design!.CreateApplication('SYSxPlanos');
            const form = app.SetFormView();
            form.AddSection('sys.plans.section.billing').AddField('Preco', 0, 16);

            const modelData = bridge.GetModelData();

            expect(modelData.Application!.FormView).not.toBeNull();
            expect(modelData.Application!.TabbedFormView).toBeNull();
            expect(modelData.Application!.FormView!.Sections[0].Fields[0].FieldName).toBe('Preco');
        });
    });

    describe('GetProperties / UpdateProperty (enum ⇄ nome)', () => {
        beforeEach(() => {
            bridge.LoadAppModelFromText('');
        });

        it('returns an empty list for an unknown element', () => {
            expect(bridge.GetProperties('does-not-exist')).toEqual([]);
        });

        it('exposes Application properties, with Scope as an Enum by name', () => {
            const app = bridge.Controller!.Design!.CreateApplication('SYSxPlanos');
            app.TitleKey = 'sys.plans.title';

            const props = bridge.GetProperties(app.ID);
            const titleProp = props.find(p => p.Key === 'TitleKey');
            const scopeProp = props.find(p => p.Key === 'Scope');

            expect(titleProp?.Value).toBe('sys.plans.title');
            expect(scopeProp?.Type).toBe('Enum');
            expect(scopeProp?.Value).toBe('TenantUse'); // default de XAPPApplication.Scope
            expect(scopeProp?.Options).toEqual(expect.arrayContaining(['TenantAdmin', 'TenantUse']));
        });

        it('exposes Column properties, with DataType as an Enum by name', () => {
            const app = bridge.Controller!.Design!.CreateApplication('SYSxPlanos');
            const columnResult = bridge.AddColumn('Nome');

            const props = bridge.GetProperties(columnResult.ElementID!);
            const dataTypeProp = props.find(p => p.Key === 'DataType');
            expect(dataTypeProp?.Value).toBe('String'); // default de XAPPColumn.DataType

            void app;
        });

        it('UpdateProperty converts an Enum name back to its numeric code', () => {
            const app = bridge.Controller!.Design!.CreateApplication('SYSxPlanos');

            const result = bridge.UpdateProperty(app.ID, 'Scope', 'TenantAdmin');
            expect(result.Success).toBe(true);
            expect(app.Scope).toBe(1); // XAPPScope.TenantAdmin
        });

        it('UpdateProperty leaves non-enum text values untouched', () => {
            const app = bridge.Controller!.Design!.CreateApplication('SYSxPlanos');

            bridge.UpdateProperty(app.ID, 'TitleKey', 'sys.plans.title');
            expect(app.TitleKey).toBe('sys.plans.title');
        });

        it('exposes Field properties, with EditorType as an Enum by name', () => {
            const app = bridge.Controller!.Design!.CreateApplication('SYSxPlanos');
            const form = app.SetFormView();
            const section = form.AddSection('sys.plans.section.billing');
            const field = section.AddField('Preco', 0, 16);

            const props = bridge.GetProperties(field.ID);
            const editorTypeProp = props.find(p => p.Key === 'EditorType');
            expect(editorTypeProp?.Value).toBe('Text'); // default de XAPPField.EditorType
        });
    });

    describe('ValidateAppModel', () => {
        it('returns no issues for a well-formed application', () => {
            bridge.LoadAppModelFromText('');
            const app = bridge.Controller!.Design!.CreateApplication('SYSxPlanos');
            app.TitleKey = 'sys.plans.title';

            expect(bridge.ValidateAppModel()).toHaveLength(0);
        });

        it('reports an error when the application has no TitleKey', () => {
            bridge.LoadAppModelFromText('');
            bridge.Controller!.Design!.CreateApplication('SYSxPlanos');

            const issues = bridge.ValidateAppModel();
            expect(issues.some(i => i.Severity === XIssueSeverity.Error && i.Message.includes('TitleKey'))).toBe(true);
        });

        it('returns no issues when there is no document loaded', () => {
            expect(bridge.ValidateAppModel()).toHaveLength(0);
        });
    });
});
