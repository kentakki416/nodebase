/**
 * Node 向け共通 ESLint 設定 (packages/* で使用)
 *
 * 各パッケージは以下のいずれかで利用する:
 *   module.exports = require("@repo/eslint-config")
 *
 * 追加で ignore したいパス等がある場合:
 *   const baseConfig = require("@repo/eslint-config")
 *   module.exports = [...baseConfig, { ignores: ["generated/**"] }]
 *
 * 全プロジェクト共通のルールは ./common-rules.js に集約してある。
 * apps/* の eslint.config.* からも同じルールを spread することで一元管理する。
 */
const { defineConfig } = require("eslint/config")
const typescriptEslint = require("@typescript-eslint/eslint-plugin")
const typescriptParser = require("@typescript-eslint/parser")
const importPlugin = require("eslint-plugin-import")

const { commonRules } = require("./common-rules")

module.exports = defineConfig([
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2020,
        project: "./tsconfig.json",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": typescriptEslint,
      import: importPlugin,
    },
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.json",
        },
      },
    },
    rules: commonRules,
  },
  {
    ignores: ["node_modules/**", "dist/**"],
  },
])
