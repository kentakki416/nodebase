/**
 * 全プロジェクト共通の ESLint ルール定義
 *
 * apps / packages 双方の eslint.config.* から spread して使う:
 *
 *   const { commonRules } = require("@repo/eslint-config/common-rules")
 *   rules: { ...commonRules, "app-specific-rule": "error" }
 *
 * naming-convention は配列全体で上書きされる仕様のため、selector を個別に
 * 上書きしたい場合 (mobile の variable に filter を足す等) は
 * `commonNamingConvention` を import してから map で書き換える。
 */

const commonNamingConvention = [
  {
    format: ["camelCase", "UPPER_CASE", "PascalCase"],
    selector: "variable",
  },
  {
    format: ["camelCase", "PascalCase"],
    selector: "function",
  },
  {
    format: ["PascalCase"],
    selector: "typeLike",
  },
  {
    format: ["camelCase"],
    leadingUnderscore: "require",
    modifiers: ["private"],
    selector: "memberLike",
  },
]

const commonRules = {
  /** インデント */
  indent: ["error", 2],

  /** Console */
  "no-console": ["warn", { allow: ["warn", "error"] }],

  /** 未使用変数 */
  "@typescript-eslint/no-unused-vars": [
    "warn",
    {
      args: "after-used",
      argsIgnorePattern: "^_",
      ignoreRestSiblings: true,
      varsIgnorePattern: "^_",
    },
  ],

  /** コードスタイル */
  "object-curly-spacing": ["error", "always"],
  quotes: ["error", "double"],
  semi: ["error", "never"],
  "no-multiple-empty-lines": ["error", { max: 1, maxBOF: 0, maxEOF: 0 }],
  "padded-blocks": ["error", "never"],
  "no-trailing-spaces": "error",
  "no-multi-spaces": "error",

  /** Import 順序 */
  "import/order": [
    "error",
    {
      alphabetize: {
        caseInsensitive: true,
        order: "asc",
      },
      groups: [
        "builtin",
        "external",
        "internal",
        "parent",
        "sibling",
        "index",
      ],
      "newlines-between": "always",
      pathGroups: [
        {
          group: "internal",
          pattern: "@repo/**",
          position: "before",
        },
      ],
      pathGroupsExcludedImportTypes: ["builtin"],
    },
  ],
  "import/no-duplicates": ["error", { "prefer-inline": true }],

  /** TypeScript: 型安全性 */
  "@typescript-eslint/no-empty-function": "error",
  "@typescript-eslint/no-explicit-any": "warn",
  "@typescript-eslint/no-unnecessary-type-assertion": "error",
  "@typescript-eslint/promise-function-async": "warn",

  /** TypeScript: クラスメンバーのアクセス修飾子を明示（constructor は除外） */
  "@typescript-eslint/explicit-member-accessibility": [
    "error",
    {
      accessibility: "explicit",
      overrides: {
        constructors: "off",
      },
    },
  ],

  /** TypeScript: 命名規則（private メンバーには _ プレフィックス必須） */
  "@typescript-eslint/naming-convention": ["error", ...commonNamingConvention],

  /** コード品質 */
  eqeqeq: ["error", "always"],
  "no-return-await": "error",
  "no-unneeded-ternary": "error",
  "no-var": "error",
  "prefer-arrow-callback": "error",
  "prefer-const": "error",
  "prefer-template": "error",
}

module.exports = {
  commonNamingConvention,
  commonRules,
}
