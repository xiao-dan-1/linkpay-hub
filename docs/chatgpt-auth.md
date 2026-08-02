# ChatGPT 认证机制分析

> 2026-08-02 实测验证

## Token 体系

ChatGPT (chatgpt.com) 使用两层 token 体系：

| Token | 格式 | 载体 | 有效期 | 说明 |
|-------|------|------|--------|------|
| `st` (session token) | JWE `dir` + `A256GCM` | `__Secure-next-auth.session-token` cookie (httpOnly, domain=`.chatgpt.com`) | 30 天 | 真正持久载体，服务端对称密钥加密 |
| `accessToken` | JWS `RS256` | 响应体 `accessToken` 字段 | ~8 天 | 签名 JWT，用于调用 ChatGPT 后端 API |
| `sessionToken` | JWE `dir` + `A256GCM` | 响应体 `sessionToken` 字段 | — | 每次请求轮换，但旧 token 不立即撤销 |

## 架构

```
浏览器                          ChatGPT 服务端
  │                                 │
  │  Cookie: __Secure-next-auth.session-token = <JWE st>
  │ ─────────────────────────────▶  │  对称密钥解密 st
  │                                 │  ├── 查 session store
  │                                 │  │   ├── OAuth refresh_token
  │                                 │  │   └── 用户信息
  │                                 │  ├── 验证 session 有效
  │                                 │  ├── 复用已有的 accessToken (长期)
  │                                 │  └── 签发新的 sessionToken (轮换)
  │                                 │
  │  { accessToken, sessionToken, user, expires }
  │ ◀─────────────────────────────  │
  │                                 │
  │  Authorization: Bearer <accessToken>
  │ ─────────────────────────────▶  │  调用 /backend-api/*
  │                                 │
```

## 关键发现

### 1. `st` 无法自续

- `st` 使用 `dir` (direct encryption) 模式，加密密钥仅服务端持有
- 载荷完全密文，客户端无法解密/修改
- 一旦服务端 session 过期或撤销，`st` 直接变死字节
- 不存在"拿 st 换新 st"的路径
- 续命唯一方式：`__Secure-next-auth.session-token` cookie → 服务端 session store → OAuth `refresh_token`

### 2. 真正的持久载体是 cookie

`__Secure-next-auth.session-token` 是 NextAuth.js 标准 session cookie：
- `httpOnly` — JS 不可读，防 XSS
- `Secure` — 仅 HTTPS
- `domain=.chatgpt.com` — 全站共享
- 30 天有效期 — 匹配 OAuth refresh_token 生命周期

### 3. `accessToken` 是短期稳定的，不是一次性

实测用同一个 `st` cookie 连续 3 次请求 `/api/auth/session`，返回的 `accessToken` 完全相同：

```
请求1 jti: b3053e98dc66421fbf15e2d3314bd6a6
请求2 jti: b3053e98dc66421fbf15e2d3314bd6a6  ← 相同
请求3 jti: b3053e98dc66421fbf15e2d3314bd6a6  ← 相同
exp: 1786482463 (~8 天)
```

### 4. `sessionToken` 每次轮换（宽松模式）

用同一个 `st` cookie 连续请求，每次返回**不同的** `sessionToken`：

```
cookie st:   ...90YDBZKg3yJjOGxZ.YJ...
请求1 返回:  ...oeDNmFF92kkKJu42.YM...  ← 不同
请求2 返回:  ...bBPfcvgvRiOgMZeQ.k9...  ← 不同
请求3 返回:  ...GUX0SWWSBbiHvlvF.zC...  ← 不同
```

但旧的 `st` cookie 仍然可用——没有立即撤销，属于宽松轮换策略。

### 5. Bearer 模式也可用

`st` 既可作为 cookie 传递，也可作为 `Authorization: Bearer` 头传递——两种方式都能通过认证。但 Bearer 方式需过 Cloudflare 的浏览器指纹检测（JS Challenge）。

## 实测验证

```bash
# Step 1: 用 st cookie 获取 accessToken
curl -sS "https://chatgpt.com/api/auth/session" \
  -H "Cookie: __Secure-next-auth.session-token=<st>" \
  -H "Accept: application/json"

# 响应包含:
#   accessToken  - JWS RS256, 用于调 API
#   sessionToken - JWE, 新轮换 token
#   user         - {id, name, email, idp}
#   expires      - session 过期时间

# Step 2: 用 accessToken 调 ChatGPT 后端 API
curl -sS "https://chatgpt.com/backend-api/me" \
  -H "Authorization: Bearer <accessToken>"

# → 返回用户信息，验证链路完整
```

## Token 结构详解

### st / sessionToken (JWE)

```
Header:  {"alg":"dir","enc":"A256GCM"}
Payload: 加密不可读（AES-256-GCM，密钥仅服务端持有）
```

- `dir` = Direct encryption，对称密钥即 CEK
- `A256GCM` = 认证加密，防篡改

### accessToken (JWS)

```
Header:   {"alg":"RS256","kid":"MHW4DpkKk4Qo3lnCp-UPr0ydkuCGq1OA_t4PZqBR_0Q","typ":"JWT"}
Payload:  {
  "iss": "https://auth.openai.com",
  "sub": "auth0|D4E4l5K...",
  "aud": ["https://api.openai.com/v1"],
  "iat": 1785618463,
  "exp": 1786482463,
  "jti": "b3053e98dc66421fbf15e2d3314bd6a6",
  "chatgpt_plan_type": "free",
  "chatgpt_account_id": "a9dc14b9-...",
  "session_id": "authsess_KPjEcUZT5TGnzqyohIJNodzP",
  ...
}
签名:   RSA SHA-256
```

## 总结

```
st (客户端持有, httpOnly cookie)
  │  JWE dir + A256GCM, 纯密文, 无法自解
  │  30 天有效期
  │
  ▼
服务端 session store (服务端持有)
  ├── OAuth refresh_token (真正续命能力)
  ├── accessToken JWS (短期稳定, 调 API 用)
  └── 用户信息

关键结论:
  - st 只是加密的 session handle, 不是 credential
  - 真正的 credential 是服务端存的 OAuth refresh_token
  - st 过期/撤销后无法恢复, 必须通过浏览器 cookie 让服务端用 refresh_token 续
  - accessToken 在 session 有效期内复用, 不每次重新签发
```
