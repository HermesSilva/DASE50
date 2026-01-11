import { XDesignerMessageType } from '../../../Designers/ORM/ORMDesignerMessages';

describe('XDesignerMessageType', () => {
    describe('constants', () => {
        it('should have DesignerReady message type', () => {
            expect(XDesignerMessageType.DesignerReady).toBe('DesignerReady');
        });

        it('should have LoadModel message type', () => {
            expect(XDesignerMessageType.LoadModel).toBe('LoadModel');
        });

        it('should have ModelLoaded message type', () => {
            expect(XDesignerMessageType.ModelLoaded).toBe('ModelLoaded');
        });

        it('should have SaveModel message type', () => {
            expect(XDesignerMessageType.SaveModel).toBe('SaveModel');
        });

        it('should have SelectElement message type', () => {
            expect(XDesignerMessageType.SelectElement).toBe('SelectElement');
        });

        it('should have SelectionChanged message type', () => {
            expect(XDesignerMessageType.SelectionChanged).toBe('SelectionChanged');
        });

        it('should have AddTable message type', () => {
            expect(XDesignerMessageType.AddTable).toBe('AddTable');
        });

        it('should have MoveElement message type', () => {
            expect(XDesignerMessageType.MoveElement).toBe('MoveElement');
        });

        it('should have DragDropAddRelation message type', () => {
            expect(XDesignerMessageType.DragDropAddRelation).toBe('DragDropAddRelation');
        });

        it('should have DeleteSelected message type', () => {
            expect(XDesignerMessageType.DeleteSelected).toBe('DeleteSelected');
        });

        it('should have RenameSelected message type', () => {
            expect(XDesignerMessageType.RenameSelected).toBe('RenameSelected');
        });

        it('should have UpdateProperty message type', () => {
            expect(XDesignerMessageType.UpdateProperty).toBe('UpdateProperty');
        });

        it('should have PropertiesChanged message type', () => {
            expect(XDesignerMessageType.PropertiesChanged).toBe('PropertiesChanged');
        });

        it('should have ValidateModel message type', () => {
            expect(XDesignerMessageType.ValidateModel).toBe('ValidateModel');
        });

        it('should have IssuesChanged message type', () => {
            expect(XDesignerMessageType.IssuesChanged).toBe('IssuesChanged');
        });

        it('should have RequestRename message type', () => {
            expect(XDesignerMessageType.RequestRename).toBe('RequestRename');
        });

        it('should have RenameCompleted message type', () => {
            expect(XDesignerMessageType.RenameCompleted).toBe('RenameCompleted');
        });
    });

    describe('type safety', () => {
        it('should be a const object', () => {
            expect(typeof XDesignerMessageType).toBe('object');
        });

        it('should have all message types defined', () => {
            const expectedTypes = [
                'DesignerReady',
                'LoadModel',
                'ModelLoaded',
                'SaveModel',
                'SelectElement',
                'SelectionChanged',
                'AddTable',
                'MoveElement',
                'DragDropAddRelation',
                'DeleteSelected',
                'RenameSelected',
                'UpdateProperty',
                'PropertiesChanged',
                'ValidateModel',
                'IssuesChanged',
                'RequestRename',
                'RenameCompleted'
            ];

            expectedTypes.forEach(type => {
                expect(XDesignerMessageType).toHaveProperty(type);
            });
        });
    });
});
