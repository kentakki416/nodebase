import { OAuth2Client } from "google-auth-library"

export type GoogleUserInfo = {
    email: string
    id: string
    name: string
    picture?: string
}

type GoogleUserInfoResponse = {
    email: string
    family_name?: string
    given_name?: string
    id: string
    locale?: string
    name: string
    picture?: string
    verified_email?: boolean
}

/**
 * GoogleOAuthクライアントのインターフェース
 *
 * code を token に交換する際の redirect_uri は Google OAuth の仕様上
 * 認証時に使った URL と完全一致する必要があるため、getUserInfo の引数で受け取る。
 */
export interface IGoogleOAuthClient {
    getUserInfo(code: string, redirectUri: string): Promise<GoogleUserInfo>
}

export class GoogleOAuthClient implements IGoogleOAuthClient {
  private _clientId: string
  private _clientSecret: string

  constructor(clientId: string, clientSecret: string) {
    this._clientId = clientId
    this._clientSecret = clientSecret
  }

  public async getUserInfo(code: string, redirectUri: string): Promise<GoogleUserInfo> {
    /**
     * リクエスト毎に OAuth2Client を生成する。
     * テスト容易性と、redirect_uri をリクエスト単位で切り替える要件のため。
     */
    const oauth2Client = new OAuth2Client(this._clientId, this._clientSecret, redirectUri)
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`
      }
    })

    const data = await response.json() as GoogleUserInfoResponse

    return {
      email: data.email,
      id: data.id,
      name: data.name,
      picture: data.picture
    }
  }
}
