import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/*.d.ts", "**/*.mjs"] },
  {
    files: ["packages/*/src/**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ],
      "no-console": ["error", { allow: ["error"] }]
    }
  },
  {
    files: ["packages/console/src/**/*.{ts,tsx}"],
    rules: {
      "no-console": "off"
    }
  },
  {
    // CLI 入口(W2 阶段 A/B):人机 stdout 交互面,console 输出即产品输出(daemon 运行时仍禁)
    files: ["packages/daemon/src/launchd/cli.ts", "packages/daemon/src/net/pairUrl.ts"],
    rules: {
      "no-console": "off"
    }
  }
);
