# 正式部署

## 1. 环境准备

服务器安装 Docker Engine 与 Docker Compose，开放反向代理需要的 HTTP/HTTPS 端口。生产域名必须使用 HTTPS；应用 Cookie 在生产模式下带 `Secure`。

复制 `.env.example` 为 `.env.production`，至少填写：

```dotenv
POSTGRES_DB=studio_tasks
POSTGRES_USER=studio
POSTGRES_PASSWORD=替换为高强度数据库密码
DATABASE_URL=postgresql://studio:对密码进行URL编码后填写@postgres:5432/studio_tasks
TEST_DATABASE_URL=postgresql://测试用户:测试密码@127.0.0.1:5432/studio_tasks_test
TEST_APP_ORIGIN=http://127.0.0.1:5173
COOKIE_SECRET=替换为至少32字符的随机密钥
APP_ORIGIN=https://tasks.example.com
HTTP_PORT=8080
USER_SESSION_HOURS=168
STUDIO_SESSION_HOURS=12
BACKUP_RETENTION_DAYS=7
```

## 2. 启动

```bash
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d
docker compose --env-file .env.production ps
curl -fsS http://127.0.0.1:8080/health/ready
```

将公网 HTTPS 反向代理到 `127.0.0.1:8080`，并传递 `Host`、`X-Forwarded-For`、`X-Forwarded-Proto`。PostgreSQL 不映射公网端口。

## 3. 初始化管理员和工作室

```bash
docker compose --env-file .env.production exec api \
  env ADMIN_USERNAME=admin ADMIN_PASSWORD='替换为高强度密码' \
  node apps/api/dist/cli/create-admin.js

docker compose --env-file .env.production exec api \
  env STUDIO_NAME='工作室名称' \
  node apps/api/dist/cli/create-studio.js
```

工作室初始化命令只输出一次用户注册链接和工作室入口，请立即保存到密码管理器。

## 4. 更新与回滚

```bash
git pull
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d
docker compose --env-file .env.production logs --tail=200 api nginx
```

回滚时切回上一个 Git 提交重新构建；数据库迁移上线前先备份，涉及不可逆迁移时按对应迁移说明恢复数据库。

## 5. 备份与恢复

Compose 的 `backup` 服务每日生成一次压缩备份并保留七天。应再将 `postgres_backups` 卷同步到异机或对象存储。

手动备份：

```powershell
.\infra\backup\backup.ps1
```

恢复验证必须使用独立数据库：

```bash
gunzip -c studio_tasks_TIMESTAMP.dump.gz > /tmp/studio.dump
createdb -h HOST -U USER studio_tasks_verify
pg_restore -h HOST -U USER -d studio_tasks_verify --clean --if-exists /tmp/studio.dump
```

## 6. 日常运维

```bash
docker compose --env-file .env.production logs -f --tail=200 api nginx
docker compose --env-file .env.production exec postgres psql -U studio -d studio_tasks
docker compose --env-file .env.production restart api nginx
```

管理员可在“工作室设置”中轮换注册链接和工作室入口。轮换工作室入口会使旧入口和旧工作室会话失效。
