import { config } from '../../config.js'

const BASIC = Buffer.from(
  `${config.LINK_GEN_USERNAME}:${config.LINK_GEN_PASSWORD}`,
).toString('base64')

const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Basic ${BASIC}`,
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function generateKakaoPayLink(
  accessToken: string,
): Promise<{ ok: boolean; pay_url?: string; error?: string }> {
  // 1. Create kakao_kr job
  let res: Response
  try {
    res = await fetch(`${config.LINK_GEN_API_URL}/api/jobs`, {
      method: 'POST',
      headers: HEADERS,
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
    jobs?: Array<{ id: string; status: string; result?: { pay_url?: string }; error?: { message?: string } }>
    error?: string
  }

  if (!data.ok || !data.jobs?.[0]?.id) {
    return { ok: false, error: data.error ?? '创建生成任务失败' }
  }

  const jobId = data.jobs[0].id

  // 2. Poll for completion (max 60s, every 2s)
  for (let i = 0; i < 30; i++) {
    await sleep(2000)
    let pollRes: Response
    try {
      pollRes = await fetch(`${config.LINK_GEN_API_URL}/api/jobs`, {
        headers: HEADERS,
      })
    } catch {
      continue
    }

    if (!pollRes.ok) continue

    const pollData = (await pollRes.json()) as {
      ok: boolean
      jobs?: Array<{ id: string; status: string; result?: { pay_url?: string }; error?: { message?: string } }>
    }

    const job = pollData.jobs?.find((j) => j.id === jobId)
    if (!job) continue

    if (job.status === 'done' && job.result?.pay_url) {
      return { ok: true, pay_url: job.result.pay_url }
    }
    if (job.status === 'failed') {
      return { ok: false, error: job.error?.message || '链接生成失败' }
    }
  }

  return { ok: false, error: '生成超时（30s），请重试' }
}
