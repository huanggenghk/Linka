# Linka 部署文档

## 服务器信息

- **服务器**: 阿里云 ECS (Ubuntu 22.04, 2C2G)
- **IP**: 123.56.163.63
- **域名**: linka.zone (阿里云 DNS 解析)
- **SSH**: `ssh root@123.56.163.63`

## 架构概览

```
用户 → https://linka.zone
         ↓
      Nginx (443/80)
       ├── /              → 静态文件 (/var/www/linka)
       ├── /api           → 反向代理 → Hono (127.0.0.1:3000)
       ├── /health        → 反向代理 → Hono (127.0.0.1:3000)
       └── /test-api/*    → 反向代理 → Hono 测试环境 (127.0.0.1:3001)
```

常规业务 API 都挂在 `/api/*` 下，不需要每次新增子路由就改 Nginx。只有新增顶层路径时，才需要同步 `/etc/nginx/sites-available/linka`。

## 目录结构（服务器）

| 路径 | 用途 |
|------|------|
| `/root/Linka/` | 后端项目代码（部署时 rsync 的目标，可随时整个重建） |
| `/root/Linka-test/` | 测试后端项目代码（功能分支部署目标，可随时整个重建） |
| `/var/lib/linka/linka.db` | SQLite 数据库（与代码物理隔离，部署流程碰不到） |
| `/var/lib/linka-test/linka-test.db` | 测试 SQLite 数据库（与生产数据库隔离） |
| `/var/lib/linka/backups/` | 数据库备份目录（Layer 3 未实现前为空） |
| `/var/www/linka/` | 前端静态文件（构建产物） |

> **为什么数据放 `/var/lib/linka/`**：让数据目录物理上离开代码目录 `/root/Linka/`，这样任何 rsync / git clean / `rm -rf /root/Linka` 的失误都碰不到生产数据。rsync 的 `--exclude='data/'` 只是第二重防御。

## 前端部署

在本地执行：

```bash
# 1. 构建
cd web && pnpm install && npx vite build

# 2. 上传到服务器
scp -r web/dist/* root@123.56.163.63:/var/www/linka/

# 3. 重载 Nginx
ssh root@123.56.163.63 "nginx -t && systemctl reload nginx"
```

## 发布流程

Linka 使用开发-测试-生产隔离流程。功能分支只能部署到测试环境；生产环境只能从 `main` 部署。

### 测试后端部署

在任意干净功能分支执行：

```bash
pnpm build
pnpm mini:check
pnpm test
pnpm deploy:test
```

测试环境地址：

- 健康检查：`https://linka.zone/test-api/health`
- API Base：`https://linka.zone/test-api`
- 小程序测试时，把 API 地址设为 `https://linka.zone/test-api`

### 生产后端部署

生产只能从干净 `main` 执行：

```bash
git switch main
git pull --ff-only origin main
pnpm build
pnpm mini:check
pnpm test
pnpm deploy:prod
```

`pnpm deploy:prod` 会检查当前分支，非 `main` 会直接失败。

### 手动后端部署

在本地执行：

```bash
# 1. 构建 TypeScript，build 会先清理 dist，避免旧构建产物残留
pnpm build

# 2. 同步代码到服务器（排除整个 data/ 目录以保护 SQLite WAL + shm；
#    以前只排除 data/*.db 导致 --delete 把未 checkpoint 的 WAL 删掉，丢数据）
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='.pnpm-store' \
  --exclude='.DS_Store' \
  --exclude='data.db*' \
  --exclude='data/' \
  --exclude='data.archived-*' \
  --exclude='.git' \
  --exclude='web/dist' \
  --exclude='web/node_modules' \
  --exclude='.claude' \
  --exclude='.superpowers' \
  --exclude='mini-wx/project.config.json' \
  --exclude='mini-wx/project.private.config.json' \
  . root@123.56.163.63:/root/Linka/

# 3. 在服务器上安装依赖并重启
ssh root@123.56.163.63 "cd /root/Linka && pnpm install --prod && systemctl restart linka.service"

# 4. 验证
ssh root@123.56.163.63 "curl -s http://localhost:3000/health"
# 应返回: {"status":"ok"}
```

## Systemd 服务

生产服务文件位于 `/etc/systemd/system/linka.service`：

```ini
[Unit]
Description=Linka Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/Linka
ExecStart=/usr/local/bin/node dist/index.js
Environment=DB_PATH=/var/lib/linka/linka.db
Environment=PORT=3000
EnvironmentFile=-/etc/linka/linka.env
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

测试服务文件位于 `/etc/systemd/system/linka-test.service`：

```ini
[Unit]
Description=Linka Test Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/Linka-test
ExecStart=/usr/local/bin/node dist/index.js
Environment=DB_PATH=/var/lib/linka-test/linka-test.db
Environment=PORT=3001
Environment=NODE_ENV=test
EnvironmentFile=-/etc/linka/linka.env
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

常用命令：

```bash
systemctl status linka.service    # 查看状态
systemctl restart linka.service   # 重启
systemctl stop linka.service      # 停止
journalctl -u linka.service -f    # 查看实时日志

systemctl status linka-test.service
systemctl restart linka-test.service
journalctl -u linka-test.service -f
```

微信小程序真实登录依赖 `/etc/linka/linka.env`：

```bash
mkdir -p /etc/linka
cat >/etc/linka/linka.env <<'EOF'
WECHAT_APP_ID=你的微信小程序 AppID
WECHAT_APP_SECRET=你的微信小程序 AppSecret
EOF
chmod 600 /etc/linka/linka.env
systemctl daemon-reload
systemctl restart linka.service
```

不要把 `WECHAT_APP_SECRET` 写入仓库。小程序真机测试时，还需要在微信小程序后台把 `https://linka.zone` 加入 request 合法域名。

## Nginx 配置

配置文件：`/etc/nginx/sites-available/linka`

已通过 symlink 启用：`/etc/nginx/sites-enabled/linka`

关键代理：

- `/api` → 生产后端 `127.0.0.1:3000`
- `/health` → 生产后端 `127.0.0.1:3000`
- `/test-api/` → 测试后端 `127.0.0.1:3001`，会去掉 `/test-api/` 前缀后转发
- `/join/`、`/card/`、`/mcp` → 已退役，直接返回 404

```bash
nginx -t                  # 测试配置
systemctl reload nginx    # 重载
```

## SSL 证书

- **方式**: Let's Encrypt (Certbot)
- **到期**: 2026-07-11
- **自动续期**: 已配置 (certbot renew via systemd timer)
- **费用**: 免费

手动续期：

```bash
certbot renew --dry-run   # 测试
certbot renew             # 续期
```

## 快速部署

后端默认使用受保护脚本：

```bash
pnpm deploy:test
pnpm deploy:prod
```

前端仍按“前端部署”章节单独构建并上传。

## 验证

```bash
# 健康检查
curl https://linka.zone/health
curl https://linka.zone/test-api/health

# 前端页面
curl -s -o /dev/null -w "%{http_code}" https://linka.zone

# API 鉴权检查
curl -I https://linka.zone/api/agent-bindings/current

# 活动兼容层已退役，预期返回 404
curl -I https://linka.zone/api/events
curl -I https://linka.zone/api/stats
curl -I https://linka.zone/join/OLD12345
curl -I https://linka.zone/card/OLD12345.png

# MCP 端点已退役，预期返回 404
curl -I https://linka.zone/mcp
```
