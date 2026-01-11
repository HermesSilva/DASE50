import { XIssueItem, XIssueSeverity } from '../../Models/IssueItem';

describe('XIssueItem', () => {
    describe('constructor', () => {
        it('should create issue with all parameters', () => {
            const issue = new XIssueItem(
                'elem-1',
                'Table1',
                XIssueSeverity.Error,
                'Name is required',
                'prop-name'
            );

            expect(issue.ElementID).toBe('elem-1');
            expect(issue.ElementName).toBe('Table1');
            expect(issue.Severity).toBe(XIssueSeverity.Error);
            expect(issue.Message).toBe('Name is required');
            expect(issue.PropertyID).toBe('prop-name');
        });

        it('should create issue without PropertyID', () => {
            const issue = new XIssueItem(
                'elem-1',
                'Table1',
                XIssueSeverity.Warning,
                'No fields defined'
            );

            expect(issue.PropertyID).toBeNull();
        });
    });

    describe('SeverityText', () => {
        it('should return "Error" for Error severity', () => {
            const issue = new XIssueItem('id', 'name', XIssueSeverity.Error, 'msg');
            expect(issue.SeverityText).toBe('Error');
        });

        it('should return "Warning" for Warning severity', () => {
            const issue = new XIssueItem('id', 'name', XIssueSeverity.Warning, 'msg');
            expect(issue.SeverityText).toBe('Warning');
        });

        it('should return "Info" for Info severity', () => {
            const issue = new XIssueItem('id', 'name', XIssueSeverity.Info, 'msg');
            expect(issue.SeverityText).toBe('Info');
        });
    });

    describe('Icon', () => {
        it('should return "error" icon for Error severity', () => {
            const issue = new XIssueItem('id', 'name', XIssueSeverity.Error, 'msg');
            expect(issue.Icon).toBe('error');
        });

        it('should return "warning" icon for Warning severity', () => {
            const issue = new XIssueItem('id', 'name', XIssueSeverity.Warning, 'msg');
            expect(issue.Icon).toBe('warning');
        });

        it('should return "info" icon for Info severity', () => {
            const issue = new XIssueItem('id', 'name', XIssueSeverity.Info, 'msg');
            expect(issue.Icon).toBe('info');
        });
    });
});

describe('XIssueSeverity', () => {
    it('should have correct values', () => {
        expect(XIssueSeverity.Error).toBe(2);
        expect(XIssueSeverity.Warning).toBe(1);
        expect(XIssueSeverity.Info).toBe(0);
    });
});
