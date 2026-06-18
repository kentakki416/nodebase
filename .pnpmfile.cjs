/**
 * pnpm install / pnpm deploy 時に呼ばれるフック。
 * 各パッケージの manifest (package.json) を読み込み時に書き換えられる。
 *
 * 目的: @prisma/client が optional peer dep として宣言している `prisma` (CLI) を
 *       peer dep ツリーから除去し、production deploy 時の image bloat を防ぐ。
 *
 * 背景:
 *   - @prisma/client@7 の peerDependencies に `prisma: *` が optional 指定で入っている
 *   - 一方 packages/db の devDependencies には `prisma` (CLI 用) が入っている
 *   - pnpm は「workspace に prisma が存在する → optional peer を満たそう」と判断し、
 *     pnpm deploy --prod の出力にも prisma CLI + 関連依存
 *     (Prisma Studio / PGlite / @prisma/dev など計 ~100MB) を引きずる
 *   - 我々は @prisma/adapter-pg 経由で接続しており runtime で prisma CLI は不要
 *
 * 対策:
 *   @prisma/client の peerDependencies / peerDependenciesMeta から prisma を消すと、
 *   pnpm が「peer 要求なし」と認識し、deploy 出力から prisma CLI 等が除外される。
 *   packages/db の devDependencies はそのまま残せるので、開発時の
 *   `pnpm --filter @repo/db db:generate` 等の CLI 利用には影響しない。
 */
function readPackage(pkg) {
  if (pkg.name === "@prisma/client") {
    if (pkg.peerDependencies) {
      delete pkg.peerDependencies.prisma
    }
    if (pkg.peerDependenciesMeta) {
      delete pkg.peerDependenciesMeta.prisma
    }
  }
  return pkg
}

module.exports = {
  hooks: { readPackage },
}
