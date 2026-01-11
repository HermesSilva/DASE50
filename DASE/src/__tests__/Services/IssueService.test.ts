// Importar mock antes do módulo real
jest.mock('vscode');

import { XIssueService, GetIssueService } from '../../Services/IssueService';
import { XIssueItem, XIssueSeverity } from '../../Models/IssueItem';

describe('XIssueService', () => {
    let service: XIssueService;

    beforeEach(() => {
        service = new XIssueService();
    });

    afterEach(() => {
        service.Dispose();
    });

    describe('constructor', () => {
        it('should initialize with empty issues', () => {
            expect(service.Issues).toEqual([]);
            expect(service.ErrorCount).toBe(0);
            expect(service.WarningCount).toBe(0);
        });
    });

    describe('SetIssues', () => {
        it('should set issues', () => {
            const issues = [
                new XIssueItem('elem-1', 'Table1', XIssueSeverity.Error, 'Error 1'),
                new XIssueItem('elem-2', 'Table2', XIssueSeverity.Warning, 'Warning 1')
            ];

            service.SetIssues(issues);

            expect(service.Issues).toEqual(issues);
        });

        it('should fire OnIssuesChanged event', () => {
            const mockListener = jest.fn();
            service.OnIssuesChanged(mockListener);

            service.SetIssues([
                new XIssueItem('elem-1', 'Table1', XIssueSeverity.Error, 'Error 1')
            ]);

            expect(mockListener).toHaveBeenCalledTimes(1);
        });

        it('should handle null input as empty array', () => {
            service.SetIssues(null as unknown as XIssueItem[]);

            expect(service.Issues).toEqual([]);
        });

        it('should handle undefined input as empty array', () => {
            service.SetIssues(undefined as unknown as XIssueItem[]);

            expect(service.Issues).toEqual([]);
        });
    });

    describe('Clear', () => {
        it('should clear all issues', () => {
            service.SetIssues([
                new XIssueItem('elem-1', 'Table1', XIssueSeverity.Error, 'Error 1')
            ]);

            service.Clear();

            expect(service.Issues).toEqual([]);
        });

        it('should fire OnIssuesChanged event', () => {
            const mockListener = jest.fn();
            service.OnIssuesChanged(mockListener);

            service.Clear();

            expect(mockListener).toHaveBeenCalledTimes(1);
        });
    });

    describe('AddIssue', () => {
        it('should add issue to list', () => {
            const issue = new XIssueItem('elem-1', 'Table1', XIssueSeverity.Error, 'Error 1');

            service.AddIssue(issue);

            expect(service.Issues).toContain(issue);
            expect(service.Issues.length).toBe(1);
        });

        it('should fire OnIssuesChanged event', () => {
            const mockListener = jest.fn();
            service.OnIssuesChanged(mockListener);

            service.AddIssue(new XIssueItem('elem-1', 'Table1', XIssueSeverity.Error, 'Error 1'));

            expect(mockListener).toHaveBeenCalledTimes(1);
        });

        it('should append to existing issues', () => {
            service.AddIssue(new XIssueItem('elem-1', 'Table1', XIssueSeverity.Error, 'Error 1'));
            service.AddIssue(new XIssueItem('elem-2', 'Table2', XIssueSeverity.Warning, 'Warning 1'));

            expect(service.Issues.length).toBe(2);
        });
    });

    describe('ErrorCount', () => {
        it('should return count of error issues', () => {
            service.SetIssues([
                new XIssueItem('elem-1', 'Table1', XIssueSeverity.Error, 'Error 1'),
                new XIssueItem('elem-2', 'Table2', XIssueSeverity.Error, 'Error 2'),
                new XIssueItem('elem-3', 'Table3', XIssueSeverity.Warning, 'Warning 1')
            ]);

            expect(service.ErrorCount).toBe(2);
        });

        it('should return 0 when no errors', () => {
            service.SetIssues([
                new XIssueItem('elem-1', 'Table1', XIssueSeverity.Warning, 'Warning 1'),
                new XIssueItem('elem-2', 'Table2', XIssueSeverity.Info, 'Info 1')
            ]);

            expect(service.ErrorCount).toBe(0);
        });
    });

    describe('WarningCount', () => {
        it('should return count of warning issues', () => {
            service.SetIssues([
                new XIssueItem('elem-1', 'Table1', XIssueSeverity.Error, 'Error 1'),
                new XIssueItem('elem-2', 'Table2', XIssueSeverity.Warning, 'Warning 1'),
                new XIssueItem('elem-3', 'Table3', XIssueSeverity.Warning, 'Warning 2')
            ]);

            expect(service.WarningCount).toBe(2);
        });

        it('should return 0 when no warnings', () => {
            service.SetIssues([
                new XIssueItem('elem-1', 'Table1', XIssueSeverity.Error, 'Error 1'),
                new XIssueItem('elem-2', 'Table2', XIssueSeverity.Info, 'Info 1')
            ]);

            expect(service.WarningCount).toBe(0);
        });
    });

    describe('GetIssuesForElement', () => {
        beforeEach(() => {
            service.SetIssues([
                new XIssueItem('elem-1', 'Table1', XIssueSeverity.Error, 'Error 1'),
                new XIssueItem('elem-1', 'Table1', XIssueSeverity.Warning, 'Warning 1'),
                new XIssueItem('elem-2', 'Table2', XIssueSeverity.Error, 'Error 2')
            ]);
        });

        it('should return issues for specific element', () => {
            const issues = service.GetIssuesForElement('elem-1');

            expect(issues.length).toBe(2);
            expect(issues.every(i => i.ElementID === 'elem-1')).toBe(true);
        });

        it('should return empty array for element with no issues', () => {
            const issues = service.GetIssuesForElement('elem-99');

            expect(issues).toEqual([]);
        });
    });

    describe('Dispose', () => {
        it('should dispose event emitter', () => {
            expect(() => service.Dispose()).not.toThrow();
        });
    });
});

describe('GetIssueService', () => {
    it('should return singleton instance', () => {
        const instance1 = GetIssueService();
        const instance2 = GetIssueService();

        expect(instance1).toBe(instance2);
    });

    it('should return XIssueService instance', () => {
        const instance = GetIssueService();

        expect(instance).toBeInstanceOf(XIssueService);
    });
});
