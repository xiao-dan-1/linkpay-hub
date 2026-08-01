import { prisma } from '../../db.js'
import { config } from '../../config.js'

async function getLinkGenConfig() {
  const studio = await prisma.studio.findFirst()
  return {
    apiUrl: studio?.linkGenApiUrl || config.LINK_GEN_API_URL,
    username: studio?.linkGenUsername || config.LINK_GEN_USERNAME,
    password: studio?.linkGenPassword || config.LINK_GEN_PASSWORD,
  }
}

function basicAuth(username: string, password: string) {
  return Buffer.from(`${username}:${password}`).toString('base64')
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface Stage {
  key: string
  label: string
  status: 'done' | 'running' | 'pending'
}

export interface LinkGenResult {
  ok: boolean
  pay_url?: string
  error?: string
  stages?: Stage[]
}

export async function generateKakaoPayLink(
  accessToken: string,
): Promise<LinkGenResult> {
  const cfg = await getLinkGenConfig()
  if (!cfg.password) {
    return { ok: false, error: '链接生成服务未配置凭据，请在管理员设置中配置' }
  }
  const authHeaders = {
    ...JSON_HEADERS,
    'Authorization': `Basic ${basicAuth(cfg.username, cfg.password)}`,
  }

  // 1. Create kakao_kr job
  let res: Response
  try {
    res = await fetch(`${cfg.apiUrl}/api/jobs`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        items: [{ access_token: accessToken, extract_type: 'kakao_kr' }],
      }),
    })
  } catch {
    return { ok: false, error: '无法连接链接生成服务' }
  }

  if (!res.ok) {
    return { ok: false, error: `链接生成服务返回 ${res.status}` }
  }

  const data = (await res.json()) as {
    ok: boolean
    job_ids?: string[]
    error?: string
  }

  if (!data.ok || !data.job_ids?.[0]) {
    return { ok: false, error: data.error ?? '创建生成任务失败' }
  }

  const jobId = data.job_ids[0]

  // 2. Poll for completion (max 60s, every 2s)
  let latestStages: Stage[] | undefined
  for (let i = 0; i < 30; i++) {
    await sleep(2000)
    let pollRes: Response
    try {
      pollRes = await fetch(`${cfg.apiUrl}/api/jobs`, {
        headers: authHeaders,
      })
    } catch {
      continue
    }

    if (!pollRes.ok) continue

    const pollData = (await pollRes.json()) as {
      ok: boolean
      jobs?: Array<{
        id: string
        status: string
        detail?: string
        stages?: Stage[]
        result?: { pay_url?: string }
        error?: { message?: string }
      }>
    }

    const job = pollData.jobs?.find((j) => j.id === jobId)
    if (!job) continue

    if (job.stages?.length) latestStages = job.stages

    if (job.status === 'done' && job.result?.pay_url) {
      return { ok: true, pay_url: job.result.pay_url, stages: latestStages }
    }
    if (job.status === 'failed') {
      return { ok: false, error: job.error?.message || '链接生成失败', stages: latestStages }
    }
  }

  return { ok: false, error: '生成超时（60s），请重试', stages: latestStages }
}
