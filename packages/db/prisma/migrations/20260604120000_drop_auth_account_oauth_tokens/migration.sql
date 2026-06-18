-- auth_accounts から OAuth プロバイダのトークン系カラムを削除
-- （プロバイダ側で発行・管理し、アプリは取得した user info のみ保持して以降は内部 JWT で完結する）
ALTER TABLE "auth_accounts" DROP COLUMN "access_token";
ALTER TABLE "auth_accounts" DROP COLUMN "refresh_token";
ALTER TABLE "auth_accounts" DROP COLUMN "expires_at";
ALTER TABLE "auth_accounts" DROP COLUMN "token_type";
ALTER TABLE "auth_accounts" DROP COLUMN "scope";
ALTER TABLE "auth_accounts" DROP COLUMN "id_token";

-- 未使用の Provider Enum を削除（モデルでは String で扱う）
DROP TYPE IF EXISTS "Provider";
