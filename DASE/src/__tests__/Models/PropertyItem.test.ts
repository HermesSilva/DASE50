import { XPropertyItem, XPropertyType } from '../../Models/PropertyItem';

describe('XPropertyItem', () => {
    describe('constructor', () => {
        it('should create property with minimum parameters', () => {
            const prop = new XPropertyItem('key1', 'Property Name', 'value1');

            expect(prop.Key).toBe('key1');
            expect(prop.Name).toBe('Property Name');
            expect(prop.Value).toBe('value1');
            expect(prop.Type).toBe(XPropertyType.String);
            expect(prop.Options).toBeNull();
            expect(prop.IsReadOnly).toBe(false);
            expect(prop.Category).toBe('General');
        });

        it('should create property with custom type', () => {
            const prop = new XPropertyItem('key1', 'Count', 10, XPropertyType.Number);

            expect(prop.Type).toBe(XPropertyType.Number);
        });

        it('should create property with options for Enum type', () => {
            const options = ['Option1', 'Option2', 'Option3'];
            const prop = new XPropertyItem('key1', 'Selection', 'Option1', XPropertyType.Enum, options);

            expect(prop.Type).toBe(XPropertyType.Enum);
            expect(prop.Options).toEqual(options);
        });

        it('should handle boolean values', () => {
            const prop = new XPropertyItem('key1', 'Is Active', true, XPropertyType.Boolean);

            expect(prop.Value).toBe(true);
            expect(prop.Type).toBe(XPropertyType.Boolean);
        });

        it('should handle null value', () => {
            const prop = new XPropertyItem('key1', 'Nullable', null);

            expect(prop.Value).toBeNull();
        });
    });

    describe('properties', () => {
        it('should allow modification of IsReadOnly', () => {
            const prop = new XPropertyItem('key1', 'Name', 'value');
            prop.IsReadOnly = true;

            expect(prop.IsReadOnly).toBe(true);
        });

        it('should allow modification of Category', () => {
            const prop = new XPropertyItem('key1', 'Name', 'value');
            prop.Category = 'Advanced';

            expect(prop.Category).toBe('Advanced');
        });

        it('should allow modification of Value', () => {
            const prop = new XPropertyItem('key1', 'Name', 'value1');
            prop.Value = 'value2';

            expect(prop.Value).toBe('value2');
        });
    });
});

describe('XPropertyType', () => {
    it('should have correct values', () => {
        expect(XPropertyType.String).toBe('String');
        expect(XPropertyType.Number).toBe('Number');
        expect(XPropertyType.Boolean).toBe('Boolean');
        expect(XPropertyType.Enum).toBe('Enum');
        expect(XPropertyType.Color).toBe('Color');
        expect(XPropertyType.Rect).toBe('Rect');
    });
});
