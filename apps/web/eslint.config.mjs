import path from "node:path"
import { fileURLToPath } from "node:url"

import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"
import tailwindcss from "eslint-plugin-tailwindcss"

import eslintConfigCommonRules from "@repo/eslint-config/common-rules"

const { commonRules } = eslintConfigCommonRules

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...tailwindcss.configs["flat/recommended"],
  {
    /** Tailwind CSS プラグイン設定（全ファイル共通） */
    settings: {
      tailwindcss: {
        config: path.resolve(__dirname, "src/app/globals.css"),
        cssFiles: ["src/app/globals.css"],
      },
    },
  },
  /** Override default ignores of eslint-config-next. */
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.json",
        },
      },
    },
    rules: {
      ...commonRules,

      /** React: JSX インデント */
      "react/jsx-indent": ["error", 2],
      "react/jsx-indent-props": ["error", 2],

      /** React: JSX タグのスペース */
      "react/jsx-tag-spacing": ["error", {
        "afterOpening": "never",
        "beforeClosing": "never",
        "beforeSelfClosing": "always",
        "closingSlash": "never",
      }],

      /** Tailwind CSS */
      "tailwindcss/classnames-order": "off",
    },
  },
])

export default eslintConfig
