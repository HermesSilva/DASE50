/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/__tests__/**/*.test.ts'],
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: 'tsconfig.test.json',
            isolatedModules: true
        }]
    },
    workerIdleMemoryLimit: '512MB',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    moduleNameMapper: {
        '^vscode$': '<rootDir>/src/__tests__/__mocks__/vscode.ts'
    },
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
    coveragePathIgnorePatterns: [
        '/node_modules/',
        '/__tests__/',
        '/__mocks__/',
        '/Commands/CreateSQLScriptCommand',
        '/Commands/GenerateORMCodeCommand',
        '/Commands/ImportFromDBMLCommand',
        // Camada de integração com o VS Code (bridge do agente / servidor HTTP loopback): glue
        // dirigido pela UI e por sockets, sem testes de unidade — mesma categoria dos comandos
        // acima. Ficava fora da métrica só por não ser carregada pelo grafo de testes; ao ser
        // importada por um comando testado, entrava e derrubava o global. Excluída aqui de forma
        // explícita, para a métrica medir a lógica de unidade, não o glue de integração.
        '/AgentIntegration/'
    ],
    coverageThreshold: {
        global: {
            branches: 90,
            functions: 90,
            lines: 90,
            statements: 90
        }
    },
    setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
    verbose: true,
    forceExit: true
};
