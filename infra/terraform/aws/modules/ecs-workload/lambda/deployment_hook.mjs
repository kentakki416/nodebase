/**
 * ECS Blue/Green デプロイメント ライフサイクルフック
 *
 * POST_TEST_TRAFFIC_SHIFT ステージで呼び出され、SSMパラメータの値に基づいて
 * デプロイの続行/待機/ロールバックを制御する。
 *
 * 承認フロー:
 *   1. デプロイ開始 → テストトラフィックがGreenに流れる（:9000でアクセス可能）
 *   2. このLambdaが呼ばれ、SSMパラメータをチェック
 *   3. "approved" でなければ IN_PROGRESS を返して待機（30秒後に再呼び出し）
 *   4. ユーザーが動作確認後、以下を実行:
 *      aws ssm put-parameter --name "<PARAM_NAME>" --value "approved" --overwrite
 *   5. 次の呼び出しで SUCCEEDED を返し、本番トラフィック切り替えへ進む
 *
 * ロールバック:
 *   aws ssm put-parameter --name "<PARAM_NAME>" --value "rejected" --overwrite
 */

import { GetParameterCommand, PutParameterCommand, SSMClient } from '@aws-sdk/client-ssm'

const ssm = new SSMClient()
const PARAM_NAME = process.env.APPROVAL_PARAMETER_NAME

const resetParameter = async () => {
  await ssm.send(new PutParameterCommand({
    Name: PARAM_NAME,
    Value: 'pending',
    Overwrite: true,
  }))
}

export const handler = async (event) => {
  console.log('Event:', JSON.stringify(event))

  try {
    const { Parameter } = await ssm.send(new GetParameterCommand({ Name: PARAM_NAME }))
    const value = Parameter.Value

    if (value === 'approved') {
      await resetParameter()
      console.log('Deployment approved, proceeding to production traffic shift')
      return { hookStatus: 'SUCCEEDED' }
    }

    if (value === 'rejected') {
      await resetParameter()
      console.log('Deployment rejected, triggering rollback')
      return { hookStatus: 'FAILED' }
    }

    console.log(`Waiting for approval (current value: ${value})`)
    return { hookStatus: 'IN_PROGRESS' }
  } catch (error) {
    if (error.name === 'ParameterNotFound') {
      console.log('Approval parameter not found, waiting')
      return { hookStatus: 'IN_PROGRESS' }
    }

    console.error('Unexpected error:', error)
    return { hookStatus: 'FAILED' }
  }
}
