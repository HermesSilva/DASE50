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
                lines: 90,
                branches: 90,
                functions: 90,
                statements: 90
            }
        }
    }
});
