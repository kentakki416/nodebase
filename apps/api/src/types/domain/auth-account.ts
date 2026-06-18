import { User } from "./user"

/**
 * 認証アカウントドメイン型（複数プロバイダー対応、 (provider, providerAccountId) で一意）
 *
 * OAuth プロバイダの access_token / refresh_token 等は本アプリでは保持しない
 * （プロバイダ側で発行・管理し、アプリは取得した user info を DB に保存後は内部 JWT で完結する）。
 */
export type AuthAccount = {
    createdAt: Date
    id: number
    /**
     * "google" | "github" | "credentials" など
     */
    provider: string
    /**
     * プロバイダー側のユーザー ID
     */
    providerAccountId: string
    updatedAt: Date
    userId: number
}

/**
 * ユーザー情報を含む認証アカウント（リレーション含む取得）
 */
export type AuthAccountWithUser = AuthAccount & {
    user: User
}
