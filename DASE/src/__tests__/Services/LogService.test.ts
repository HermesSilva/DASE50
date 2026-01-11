// O LogService usa um singleton, então precisamos testar de forma diferente
// já que ele já pode ter sido inicializado por outros testes

import * as vscode from 'vscode';
import { GetLogService, InitializeLogService } from '../../Services/LogService';

// Mock manual do vscode.window.createOutputChannel
jest.mock('vscode', () => {
    const mockOutputChannel = {
        appendLine: jest.fn(),
        append: jest.fn(),
        clear: jest.fn(),
        show: jest.fn(),
        hide: jest.fn(),
        dispose: jest.fn()
    };
    
    return {
        window: {
            createOutputChannel: jest.fn(() => mockOutputChannel)
        },
        // Expondo o mock para acesso nos testes
        __mockOutputChannel: mockOutputChannel
    };
});

describe('LogService', () => {
    // Obter o mock do output channel
    const mockOutputChannel = (vscode as any).__mockOutputChannel;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GetLogService', () => {
        it('should return singleton instance', () => {
            const instance1 = GetLogService();
            const instance2 = GetLogService();

            expect(instance1).toBe(instance2);
        });

        it('should return an object with logging methods', () => {
            const service = GetLogService();

            expect(typeof service.Info).toBe('function');
            expect(typeof service.Warn).toBe('function');
            expect(typeof service.Error).toBe('function');
            expect(typeof service.Debug).toBe('function');
            expect(typeof service.Show).toBe('function');
            expect(typeof service.Clear).toBe('function');
        });
    });

    describe('InitializeLogService', () => {
        it('should add output channel to subscriptions', () => {
            const mockContext = {
                subscriptions: [] as { dispose(): void }[]
            } as vscode.ExtensionContext;

            InitializeLogService(mockContext);

            expect(mockContext.subscriptions.length).toBeGreaterThan(0);
        });

        it('should return log service instance', () => {
            const mockContext = {
                subscriptions: [] as { dispose(): void }[]
            } as vscode.ExtensionContext;

            const service = InitializeLogService(mockContext);

            expect(service).toBeDefined();
            expect(service).toBe(GetLogService());
        });
    });

    describe('Logging methods', () => {
        const service = GetLogService();

        describe('Info', () => {
            it('should call appendLine with formatted message', () => {
                service.Info('Test info message');

                expect(mockOutputChannel.appendLine).toHaveBeenCalled();
                const call = mockOutputChannel.appendLine.mock.calls[mockOutputChannel.appendLine.mock.calls.length - 1];
                expect(call[0]).toContain('[INFO]');
                expect(call[0]).toContain('Test info message');
            });
        });

        describe('Warn', () => {
            it('should call appendLine with formatted message', () => {
                service.Warn('Test warning message');

                expect(mockOutputChannel.appendLine).toHaveBeenCalled();
                const call = mockOutputChannel.appendLine.mock.calls[mockOutputChannel.appendLine.mock.calls.length - 1];
                expect(call[0]).toContain('[WARN]');
                expect(call[0]).toContain('Test warning message');
            });
        });

        describe('Error', () => {
            it('should call appendLine with formatted message', () => {
                service.Error('Test error message');

                expect(mockOutputChannel.appendLine).toHaveBeenCalled();
                const call = mockOutputChannel.appendLine.mock.calls[mockOutputChannel.appendLine.mock.calls.length - 1];
                expect(call[0]).toContain('[ERROR]');
                expect(call[0]).toContain('Test error message');
            });

            it('should include error details when Error object provided', () => {
                const error = new Error('Original error');
                service.Error('Test error message', error);

                expect(mockOutputChannel.appendLine).toHaveBeenCalled();
                const call = mockOutputChannel.appendLine.mock.calls[mockOutputChannel.appendLine.mock.calls.length - 1];
                expect(call[0]).toContain('Original error');
            });

            it('should handle non-Error objects', () => {
                service.Error('Test error message', 'string error');

                expect(mockOutputChannel.appendLine).toHaveBeenCalled();
                const call = mockOutputChannel.appendLine.mock.calls[mockOutputChannel.appendLine.mock.calls.length - 1];
                expect(call[0]).toContain('string error');
            });

            it('should include stack trace when available', () => {
                const error = new Error('Error with stack');
                error.stack = 'Stack trace line 1\nStack trace line 2';
                service.Error('Test error message', error);

                expect(mockOutputChannel.appendLine).toHaveBeenCalled();
                const calls = mockOutputChannel.appendLine.mock.calls;
                // Check if stack trace was logged
                const allCalls = calls.map((c: any[]) => c[0]).join('\n');
                expect(allCalls).toContain('Stack trace');
            });

            it('should handle Error without stack', () => {
                const error = new Error('Error without stack');
                error.stack = undefined;
                service.Error('Test error message', error);

                expect(mockOutputChannel.appendLine).toHaveBeenCalled();
                const call = mockOutputChannel.appendLine.mock.calls[mockOutputChannel.appendLine.mock.calls.length - 1];
                expect(call[0]).toContain('Error without stack');
            });

            it('should handle Error with empty stack', () => {
                const error = new Error('Error with empty stack');
                error.stack = '';
                service.Error('Test error message', error);

                expect(mockOutputChannel.appendLine).toHaveBeenCalled();
            });
        });

        describe('Debug', () => {
            it('should call appendLine with formatted message', () => {
                service.Debug('Test debug message');

                expect(mockOutputChannel.appendLine).toHaveBeenCalled();
                const call = mockOutputChannel.appendLine.mock.calls[mockOutputChannel.appendLine.mock.calls.length - 1];
                expect(call[0]).toContain('[DEBUG]');
                expect(call[0]).toContain('Test debug message');
            });
        });

        describe('Show', () => {
            it('should call show on output channel', () => {
                service.Show();

                expect(mockOutputChannel.show).toHaveBeenCalled();
            });
        });

        describe('Clear', () => {
            it('should call clear on output channel', () => {
                service.Clear();

                expect(mockOutputChannel.clear).toHaveBeenCalled();
            });
        });
    });

    describe('Message formatting', () => {
        const service = GetLogService();

        it('should include timestamp in ISO format', () => {
            service.Info('Test message');

            const call = mockOutputChannel.appendLine.mock.calls[mockOutputChannel.appendLine.mock.calls.length - 1];
            // Verifica formato ISO: [YYYY-MM-DDTHH:mm:ss
            expect(call[0]).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });
    });
});

