/** https://docs.expo.dev/guides/using-eslint/ */
const { defineConfig } = require("eslint/config")
const expoConfig = require("eslint-config-expo/flat")
const tailwindcss = require("eslint-plugin-tailwindcss")

const { commonNamingConvention, commonRules } = require("@repo/eslint-config/common-rules")

/**
 * mobile では Expo Router の `unstable_*` 変数を許容するため、
 * 共通の naming-convention の `variable` selector に filter を追加する。
 */
const mobileNamingConvention = commonNamingConvention.map((entry) =>
  entry.selector === "variable"
    ? { ...entry, filter: { match: false, regex: "^unstable_" } }
    : entry,
)

module.exports = defineConfig([
  expoConfig,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2020,
        project: "./tsconfig.json",
        sourceType: "module",
      },
    },
    plugins: {
      tailwindcss: tailwindcss,
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

      /** TypeScript: 命名規則（mobile 固有: Expo Router の unstable_ を除外） */
      "@typescript-eslint/naming-convention": ["error", ...mobileNamingConvention],

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

      /** Tailwind CSS (NativeWind) */
      "tailwindcss/classnames-order": "error",
      "tailwindcss/no-custom-classname": "error",
    },
  },
  {
    ignores: ["dist/*"],
  },
])
