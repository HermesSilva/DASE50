import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        include: ["tests/**/*.test.ts"],
        reporters: ["default", "json"],
        outputFile: "test-results.json",
        coverage: {
            provider: "v8",
            reporter: ["text", "html", "json-summary"],
            include: ["src/**/*.ts"],
            exclude: [
                "**/index.ts",
                "**/*.d.ts",
                "**/XTypes.ts",
                "**/XORMController.ts"
            ],
            thresholds: {
                lines: 100,
                branches: 100,
                functions: 100,
                statements: 100
            }
        }
    }
});
