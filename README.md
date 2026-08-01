# LinkPay Hub

多工作室支付任务提交与处理平台。用户通过 AT Token + 支付链接提交任务，工作室扫码处理，管理员统一管理密钥与工作室。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19, TypeScript, Vite, React Router 7 |
| 后端 | Fastify 5, TypeScript, Prisma 7 |
| 数据库 | PostgreSQL 16 |
| 部署 | Docker Compose, Nginx |
| 测试 | Vitest |

## 项目结构

```
├── apps/
│   ├── api/           # Fastify 后端 API
│   │   └── src/
│   │       ├── modules/   # 功能模块 (auth, admin, tasks, at-parser, health)
│   │       ├── plugins/   # Fastify 插件 (auth, security, request-context)
│   │       ├── lib/       # 工具库 (errors, user-keys)
│   │       └── generated/ # Prisma 生成的客户端
│   └── web/           # React 前端
│       └── src/
│           ├── api/       # API 客户端
│           ├── auth/      # 认证上下文
│           ├── components/# 通用组件
│           └── pages/     # 页面组件
├── packages/
│   └── contracts/     # Zod 校验模型 & TypeScript 类型
├── prisma/            # 数据库模型 & 迁移
├── infra/             # Nginx 配置 & 备份脚本
├── compose.yaml       # Docker Compose 编排
├── Dockerfile.api     # API 镜像
└── Dockerfile.web     # 前端镜像
```

## 快速开始

### 环境要求

- Node.js 22+
- PostgreSQL 16+
- npm 10+

### 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 创建 .env 文件
cp .env.example .env
# 编辑 .env 填充数据库连接信息

# 3. 初始化数据库
npm run db:migrate:dev

# 4. 创建管理员账号
npm run admin:create -w @linkpay/api

# 5. 启动开发服务
npm run dev          # 前端 + 后端一起启动
# 或分别启动:
npm run dev:web      # 前端 http://localhost:5173
npm run dev:api      # 后端 http://localhost:3000
```

### 生产部署

```bash
# 1. 创建 .env.production 配置
cp .env.example .env.production

# 2. 构建并启动
docker compose up -d

# 3. 查看日志
docker compose logs -f
```

服务通过 Nginx 统一暴露在 `:8080` 端口（由 `HTTP_PORT` 环境变量控制）。

## 环境变量

| 变量 | 说明 | 必填 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | ✓ |
| `COOKIE_SECRET` | Session 加密密钥 (≥32 字符) | ✓ |
| `APP_ORIGIN` | 前端访问地址 | ✓ |
| `POSTGRES_PASSWORD` | 数据库密码 | ✓ |
| `ADMIN_BOOTSTRAP_USERNAME` | 首次启动自动创建的管理员用户名 | 仅首次 |
| `ADMIN_BOOTSTRAP_PASSWORD` | 首次启动自动创建的管理员密码 | 仅首次 |
| `USER_SESSION_HOURS` | 用户会话有效期 (默认 168h) | |
| `STUDIO_SESSION_HOURS` | 工作室会话有效期 (默认 12h) | |
| `BACKUP_RETENTION_DAYS` | 数据库备份保留天数 (默认 7) | |

## API 概览

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/auth/user/login` | 用户密钥登录 |
| POST | `/api/v1/auth/user/key-verify` | 密钥连通性检测 |
| POST | `/api/v1/auth/admin/login` | 管理员登录 |
| GET  | `/api/v1/auth/session` | 获取当前会话 |
| POST | `/api/v1/auth/logout` | 登出 |

### 任务

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/user/tasks/chunk` | 用户提交任务 |
| GET  | `/api/v1/user/tasks` | 用户任务列表 |
| GET  | `/api/v1/user/tasks/:id` | 任务详情 |
| POST | `/api/v1/studio/tasks` | 工作室创建任务 |

### AT 解析

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/user/at/check` | AT Token 解码 & 订阅查询 |

### 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/v1/admin/users` | 用户列表 |
| POST | `/api/v1/admin/user-keys` | 创建用户密钥 |
| PATCH | `/api/v1/admin/user-keys/:userId` | 编辑用户密钥 |
| POST | `/api/v1/admin/user-keys/:userId/revoke` | 撤销密钥 |
| GET  | `/api/v1/admin/studios` | 工作室列表 |
| POST | `/api/v1/admin/studio` | 创建工作室 |
| PATCH | `/api/v1/admin/studios/:studioId` | 编辑工作室 |
| POST | `/api/v1/admin/studios/:studioId/rotate-access` | 轮换工作室入口密钥 |
| GET  | `/api/v1/admin/trends` | 趋势数据 |

### 健康检查

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/health/ready` | 就绪探针 |
| GET  | `/health/live` | 存活探针 |

## 数据模型

- **Studio** — 工作室，拥有独立入口链接，用户和管理员归属于工作室
- **User** — 用户，通过访问密钥认证，可提交任务
- **Admin** — 管理员，可管理用户密钥和工作室内设置
- **Task** — 支付任务，包含链接、AT Token、状态（排队中/处理中/成功/失败）
- **Session** — 用户/管理员/工作室会话
- **AuditLog** — 审计日志
- **SubmissionBatch** / **SubmissionChunk** — 批量提交分块，带幂等键防重

## 测试

```bash
npm test           # 全部测试 (watch 模式)
npm run test:run   # 单次运行
```

## License

MIT
