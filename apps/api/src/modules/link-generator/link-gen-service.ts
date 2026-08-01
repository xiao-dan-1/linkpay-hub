import { prisma } from '../../db.js'
import { config } from '../../config.js'

export interface Stage {
  key: string
  label: string
  status: 'done' | 'running' | 'pending'
}

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

export async function createLinkJob(accessToken: string): Promise<{ ok: boolean; jobId?: string; error?: string }> {
  const cfg = await getLinkGenConfig()
  if (!cfg.password) {
    return { ok: false, error: '链接生成服务未配置凭据，请在管理员设置中配置' }
  }
  const authHeaders = {
    ...JSON_HEADERS,
    'Authorization': `Basic ${basicAuth(cfg.username, cfg.password)}`,
  }

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

  const data = (await res.json()) as { ok: boolean; job_ids?: string[]; error?: string }
  if (!data.ok || !data.job_ids?.[0]) {
    return { ok: false, error: data.error ?? '创建生成任务失败' }
  }

  return { ok: true, jobId: data.job_ids[0] }
}

export async function checkLinkJob(jobId: string): Promise<{
  status: 'running' | 'done' | 'failed'
  stages?: Stage[]
  pay_url?: string
  error?: string
}> {
  const cfg = await getLinkGenConfig()
  if (!cfg.password) return { status: 'failed', error: '链接生成服务未配置凭据' }

  const authHeaders = {
    ...JSON_HEADERS,
    'Authorization': `Basic ${basicAuth(cfg.username, cfg.password)}`,
  }

  let pollRes: Response
  try {
    pollRes = await fetch(`${cfg.apiUrl}/api/jobs`, { headers: authHeaders })
  } catch {
    return { status: 'running' }
  }

  if (!pollRes.ok) return { status: 'running' }

  const pollData = (await pollRes.json()) as {
    ok: boolean
    jobs?: Array<{
      id: string
      status: string
      stages?: Stage[]
      result?: { pay_url?: string }
      error?: { message?: string }
    }>
  }

  const job = pollData.jobs?.find((j) => j.id === jobId)
  if (!job) return { status: 'running' }

  if (job.status === 'done' && job.result?.pay_url) {
    return { status: 'done', pay_url: job.result.pay_url, stages: job.stages }
  }
  if (job.status === 'failed') {
    return { status: 'failed', error: job.error?.message || '链接生成失败', stages: job.stages }
  }

  return { status: 'running', stages: job.stages }
}
