# API 文档

Base URL: `https://kakaotasks.xdauv.xyz`

## 认证说明

除 CSRF 外，所有写操作（POST/PATCH/DELETE）需要：
- Header: `x-csrf-token: <csrf_token>`
- Cookie: `studio_csrf=<csrf_cookie>`

## 1. CSRF

### GET /api/v1/csrf
获取 CSRF token。

**响应**
```json
{"token": "W7IamYl1-9WjvBrIrEl3..."}
```

---

## 2. 用户认证

### POST /api/v1/auth/user/key-login
用户密钥登录。

| 参数 | 类型 | 说明 |
|------|------|------|
| key | string | 访问密钥 |

```bash
curl -X POST https://kakaotasks.xdauv.xyz/api/v1/auth/user/key-login \
  -H "x-csrf-token: <csrf>" -H "Content-Type: application/json" \
  -d '{"key":"xiaodan"}'
```

**响应 200**
```json
{"principal":{"id":"uuid","role":"user","userLabel":"xiaodan","studioId":"uuid"}}
```

### POST /api/v1/auth/user/key-verify
密钥连通检测，只验证不登录。

```bash
curl -X POST https://kakaotasks.xdauv.xyz/api/v1/auth/user/key-verify \
  -H "x-csrf-token: <csrf>" \
  -d '{"key":"xiaodan"}'
```

**响应**
```json
{"valid":true,"user":{"id":"uuid","maskedKey":"••••-••••-••••-••••","note":"xiaodan","studioId":"uuid","studioName":"lab","enabled":true,"lastUsedAt":null}}
```

### GET /api/v1/auth/user/session
获取当前用户会话。

### POST /api/v1/auth/user/logout
退出登录。

---

## 3. 管理员认证

### POST /api/v1/auth/admin/login

| 参数 | 类型 | 说明 |
|------|------|------|
| username | string | 管理员账号 |
| password | string | 管理员密码 |

### GET /api/v1/auth/admin/session
获取当前管理员会话。

### POST /api/v1/auth/admin/logout
退出管理员登录。

---

## 4. 用户任务

### POST /api/v1/user/task-batches
创建任务批次。

| 参数 | 类型 | 说明 |
|------|------|------|
| requestedCount | number | 声明链接总数 |

```json
{"batchId":"uuid","requestedCount":10,"createdCount":0}
```

### POST /api/v1/user/task-batches/:batchId/chunks
提交链接块（最多 200 条）。

| 参数 | 类型 | 说明 |
|------|------|------|
| batchId | uuid | 批次 ID |
| idempotencyKey | uuid | 幂等键（每次不同） |
| urls | string[] | 支付链接数组 |
| at | string? | AT Token（可选） |

```bash
curl -X POST https://kakaotasks.xdauv.xyz/api/v1/user/task-batches/<batchId>/chunks \
  -H "Cookie: studio_user_session=<session>" \
  -H "x-csrf-token: <csrf>" -H "Content-Type: application/json" \
  -d '{"batchId":"...","idempotencyKey":"<UUID>","urls":["https://..."],"at":"eyJ..."}'
```

**响应 201**
```json
{"batchId":"uuid","createdCount":2,"cumulativeCreatedCount":2,"taskPublicIds":["TASK-1","TASK-2"]}
```

### GET /api/v1/user/tasks
获取用户任务列表。

| 参数 | 类型 | 说明 |
|------|------|------|
| status | string? | 筛选：queued/processing/success/failed |
| search | string? | 搜索：编号/链接/账号/备注 |
| limit | number | 每页条数 (默认 50) |

### GET /api/v1/user/tasks/:publicId
获取单个任务详情。

### POST /api/v1/user/at/check
AT 测活/查套餐。JWT 本地解码 + ChatGPT 订阅查询。

| 参数 | 类型 | 说明 |
|------|------|------|
| at | string | JWT Token |

```bash
curl -X POST https://kakaotasks.xdauv.xyz/api/v1/user/at/check \
  -H "Cookie: studio_user_session=<session>" \
  -H "x-csrf-token: <csrf>" \
  -d '{"at":"eyJ..."}'
```

**响应**
```json
{
  "ok": true,
  "jwt": {
    "email": "user@example.com",
    "plan_type": "free",
    "user_id": "user-xxx",
    "account_id": "uuid",
    "issued_at": "2026-08-01T00:00:00.000Z",
    "expires_at": "2026-08-10T00:00:00.000Z",
    "is_expired": false,
    "days_left": 9,
    "hours_left": 216
  },
  "subscription": {
    "plan_type": "free",
    "subscription_plan": "chatgptfreeplan",
    "has_active_subscription": false,
    "is_gratis": true,
    "will_renew": false,
    "expires_at": null,
    "days_left": null,
    "purchase_origin_platform": "chatgpt_not_purchased"
  }
}
```

---

## 5. 工作室任务

认证方式：通过 `POST /api/v1/auth/studio/exchange/:accessToken` 获取 session。

### POST /api/v1/studio/tasks
工作室直接创建任务（免 batch/chunk）。

| 参数 | 类型 | 说明 |
|------|------|------|
| urls | string[] | 支付链接（最多 200） |
| at | string? | AT Token（可选） |

```bash
curl -X POST https://kakaotasks.xdauv.xyz/api/v1/studio/tasks \
  -H "Cookie: studio_workspace_session=<session>" \
  -H "x-csrf-token: <csrf>" \
  -d '{"urls":["https://pay.example.com/1"],"at":"eyJ..."}'
```

**响应 201**
```json
{"taskPublicIds":["TASK-1"],"createdCount":1}
```

### GET /api/v1/studio/tasks
工作室任务队列。

### POST /api/v1/studio/tasks/:publicId/open
打开任务（排队 → 处理中）。

### POST /api/v1/studio/tasks/:publicId/complete
完成任务。

| 参数 | 类型 | 说明 |
|------|------|------|
| result | string | success / failed |
| feedback | string? | 处理反馈 |
| version | number | 乐观锁版本号 |

### POST /api/v1/studio/tasks/:publicId/next
获取下一个任务。

---

## 6. 管理员 API

### GET /api/v1/admin/dashboard
仪表盘统计。

```json
{"users":5,"tasks":42,"queued":3,"processing":2,"success":30,"failed":7}
```

### GET /api/v1/admin/tasks
全部任务（支持 status/search/limit 查询）。

### GET /api/v1/admin/tasks/:publicId
任务详情。

### GET /api/v1/admin/users
用户密钥列表。

### POST /api/v1/admin/user-keys
创建用户密钥。

| 参数 | 类型 | 说明 |
|------|------|------|
| note | string? | 备注 |
| key | string? | 自定义密钥（留空自动生成） |

```bash
curl -X POST https://kakaotasks.xdauv.xyz/api/v1/admin/user-keys \
  -H "Cookie: studio_admin_session=<session>" \
  -H "x-csrf-token: <csrf>" \
  -d '{"note":"客户A","key":"mykey123"}'
```

**响应 201**
```json
{"user":{"id":"uuid","maskedKey":"••••-••••-••••-••••","note":"客户A","enabled":true,"taskCount":0},"accessKey":"mykey123"}
```

### PATCH /api/v1/admin/user-keys/:userId
编辑密钥备注和密钥值。

| 参数 | 类型 | 说明 |
|------|------|------|
| note | string? | 新备注（可选） |
| key | string? | 新密钥值（可选，留空不改） |

### PATCH /api/v1/admin/users/:userId
启用/停用密钥。

| 参数 | 类型 | 说明 |
|------|------|------|
| enabled | boolean | 是否启用 |

### DELETE /api/v1/admin/users/:userId
删除密钥（有关联任务则不可删除）。

### GET /api/v1/admin/users/:userId/key
查看完整密钥。

### GET /api/v1/admin/studio
工作室设置（含入口链接）。

### PATCH /api/v1/admin/studio
更新工作室名称。

| 参数 | 类型 | 说明 |
|------|------|------|
| name | string | 1-120 字符 |

### POST /api/v1/admin/studio/rotate-access
轮换工作室入口（旧入口立即失效）。

### GET /api/v1/admin/audit-logs
审计日志。

---

## 完整调用流程

### 用户创建任务
```bash
# 1. 获取 CSRF
CSRF=$(curl -s -c - https://kakaotasks.xdauv.xyz/api/v1/csrf)
COOKIE=$(echo "$CSRF" | grep studio_csrf | awk '{print $NF}')
TOKEN=$(echo "$CSRF" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# 2. 登录
LOGIN=$(curl -s -c - -b "studio_csrf=$COOKIE" \
  -H "x-csrf-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"key":"mykey"}' https://kakaotasks.xdauv.xyz/api/v1/auth/user/key-login)
SESSION=$(echo "$LOGIN" | grep studio_user_session | awk '{print $NF}')

# 3. 创建批次
BATCH=$(curl -s -b "studio_csrf=$COOKIE; studio_user_session=$SESSION" \
  -H "x-csrf-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"requestedCount":2}' https://kakaotasks.xdauv.xyz/api/v1/user/task-batches)
BATCH_ID=$(echo "$BATCH" | grep -o '"batchId":"[^"]*"' | cut -d'"' -f4)

# 4. 提交链接
curl -s -b "studio_csrf=$COOKIE; studio_user_session=$SESSION" \
  -H "x-csrf-token: $TOKEN" -H "Content-Type: application/json" \
  -d "{\"batchId\":\"$BATCH_ID\",\"idempotencyKey\":\"$(uuidgen)\",\"urls\":[\"https://pay.test/1\"],\"at\":\"eyJ...\"}" \
  https://kakaotasks.xdauv.xyz/api/v1/user/task-batches/$BATCH_ID/chunks
```
