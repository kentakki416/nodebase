# step: Web に /dev/login と sign-in ボタンを追加

`apps/web` に dev-login の Route Handler、proxy 設定、sign-in 画面のボタンを追加する。

## 対応内容

### `apps/web/src/app/dev/login/route.ts`（新規）

UI を持たない Route Handler。`?as=alice|bob` を受け取って API の dev-login を叩き、Cookie を保存して `/` にリダイレクト。

```typescript
const DEV_USERS: Record<string, string> = {
  alice: "alice@dev.local",
  bob: "bob@dev.local",
}

export const GET = async (req: NextRequest) => {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not Found", { status: 404 })
  }
  const as = req.nextUrl.searchParams.get("as")
  if (!as || !(as in DEV_USERS)) {
    return new NextResponse(`Usage: /dev/login?as=alice|bob`, { status: 400 })
  }
  const apiRes = await fetch(`${API_BASE_URL}/api/auth/dev-login`, {
    body: JSON.stringify({ email: DEV_USERS[as] }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  })
  if (!apiRes.ok) {
    return new NextResponse("dev-login failed. Did you run `pnpm --filter api db:seed`?", { status: 500 })
  }
  const json = authDevLoginResponseSchema.parse(await apiRes.json())
  await setAuthCookies(json.access_token, json.refresh_token)
  return NextResponse.redirect(new URL("/", req.url))
}
```

Server Component から `cookies().set()` を呼べないため Route Handler 必須。

### `apps/web/src/proxy.ts`

`/dev/login` を production 以外で PUBLIC_PATHS に追加する。

```typescript
const DEV_ONLY_PUBLIC_PATHS = process.env.NODE_ENV !== "production"
  ? ["/dev/login"]
  : []

const PUBLIC_PATHS = [
  "/sign-in",
  "/api/auth/callback/google",
  ...DEV_ONLY_PUBLIC_PATHS,
]
```

### `apps/web/src/app/sign-in/page.tsx`

`NODE_ENV !== "production"` のときだけ dev login ボタンを表示する（次の Google ボタンと並べる）。

```tsx
const isProduction = process.env.NODE_ENV === "production"
const DEV_LOGIN_USERS = ["alice", "bob"] as const

{!isProduction && (
  <div className="space-y-2 border-t border-dashed border-gray-200 pt-4">
    <p className="text-center text-xs font-medium text-gray-500">Dev Login</p>
    <div className="flex gap-2">
      {DEV_LOGIN_USERS.map((user) => (
        <Link href={`/dev/login?as=${user}`} key={user} className="...">
          Login as {user}
        </Link>
      ))}
    </div>
  </div>
)}
```

## 動作確認

```bash
# 事前に seed
pnpm --filter api db:seed

# Web + API 起動
pnpm dev
```

1. ブラウザで `http://localhost:3000/sign-in` を開く
2. 「Login as alice」ボタンをクリックすると `/` に遷移し、認証済み状態になる
3. DevTools の Application タブで `app_access_token` / `app_refresh_token` Cookie が設定されていることを確認
4. `http://localhost:3000/dev/login?as=bob` を直接踏んでも同じく `/` にリダイレクトされる
5. 不正な値 `http://localhost:3000/dev/login?as=charlie` は 400 + 案内文を返す
6. `verify-web-page` skill で sign-in 画面の before/after スクショを取って PR に貼る

`NODE_ENV=production pnpm build && pnpm start` でビルドし、`/dev/login?as=alice` が 404、sign-in 画面に dev ボタンが出ないことを確認する。
