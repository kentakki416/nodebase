const baseConfig = require("@repo/eslint-config")

/**
 * packages/db は generated/ (prisma generate の出力) と prisma/ (CLI 用設定) を
 * lint 対象外にする
 */
module.exports = [
  ...baseConfig,
  {
    ignores: ["generated/**", "prisma/**"],
  },
]
