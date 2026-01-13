/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/__tests__/**/*.test.ts'],
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: 'tsconfig.test.json'
        }]
    },
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
        '/__mocks__/'
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
    verbose: true
};
