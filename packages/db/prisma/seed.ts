/* eslint-disable no-console */
import { createPrismaClient } from "../src/client"

const prisma = createPrismaClient()

/**
 * dev-login で使う開発用ユーザー
 *
 * `/api/auth/dev-login` および web の sign-in 画面の「Login as alice/bob」
 * ボタン経由でログインできる。production 環境では seed 自体スキップする。
 */
type DevUserSeed = {
  email: string
  name: string
}

const devUsers: DevUserSeed[] = [
  { email: "alice@dev.local", name: "Alice (dev)" },
  { email: "bob@dev.local", name: "Bob (dev)" },
]

const seedDevUsers = async () => {
  for (const devUser of devUsers) {
    const user = await prisma.user.upsert({
      create: { email: devUser.email, name: devUser.name },
      update: { name: devUser.name },
      where: { email: devUser.email },
    })

    /**
     * AuthAccount(provider: "dev") を upsert して
     * Google アカウントと衝突しない形で dev ユーザーを識別できるようにする
     */
    await prisma.authAccount.upsert({
      create: {
        provider: "dev",
        providerAccountId: devUser.email,
        userId: user.id,
      },
      update: {},
      where: {
        provider_providerAccountId: {
          provider: "dev",
          providerAccountId: devUser.email,
        },
      },
    })
    console.log(`Seeded dev user: ${devUser.email} (id=${user.id})`)
  }
}

const main = async () => {
  if (process.env.NODE_ENV === "production") {
    console.log("Skip seeding: NODE_ENV=production")
    return
  }
  await seedDevUsers()
  console.log("Seed completed (PostgreSQL)")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
