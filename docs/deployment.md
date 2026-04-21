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
       ├── /mcp           → 反向代理 → Hono (127.0.0.1:3000)
       ├── /api           → 反向代理 → Hono (127.0.0.1:3000)
       ├── /health        → 反向代理 → Hono (127.0.0.1:3000)
       ├── /join/:code    → 反向代理 → Hono (127.0.0.1:3000)
       └── /card/:code.png → 反向代理 → Hono (127.0.0.1:3000)
```

新增后端路由时，必须同步在 `/etc/nginx/sites-available/linka` 和 `sites-enabled/linka`（注意：当前不是 symlink，两份都要改）里加 `location` 块，否则 nginx 会把请求当 SPA 路由返回 index.html。

## 目录结构（服务器）

| 路径 | 用途 |
|------|------|
| `/root/Linka/` | 后端项目代码（部署时 rsync 的目标，可随时整个重建） |
| `/var/lib/linka/linka.db` | SQLite 数据库（与代码物理隔离，部署流程碰不到） |
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

## 后端部署

在本地执行：

```bash
# 1. 构建 TypeScript（build 脚本已包含把 src/assets 拷进 dist/，字体文件必须同步）
pnpm build

# 2. 同步代码到服务器（排除整个 data/ 目录以保护 SQLite WAL + shm；
#    以前只排除 data/*.db 导致 --delete 把未 checkpoint 的 WAL 删掉，丢数据）
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='data/' \
  --exclude='.git' \
  --exclude='web/dist' \
  --exclude='web/node_modules' \
  --exclude='.claude/worktrees' \
  --exclude='.superpowers' \
  . root@123.56.163.63:/root/Linka/

# 3. 在服务器上安装依赖并重启
ssh root@123.56.163.63 "cd /root/Linka && pnpm install --prod && systemctl restart linka.service"

# 4. 验证
ssh root@123.56.163.63 "curl -s http://localhost:3000/health"
# 应返回: {"status":"ok"}
```

## Systemd 服务

服务文件位于 `/etc/systemd/system/linka.service`：

```ini
[Unit]
Description=Linka MCP Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/Linka
ExecStart=/usr/local/bin/node dist/index.js
Environment=DB_PATH=/var/lib/linka/linka.db
Environment=PORT=3000
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
```

## Nginx 配置

配置文件：`/etc/nginx/sites-available/linka`

已通过 symlink 启用：`/etc/nginx/sites-enabled/linka`

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

## 快速全量部署

一键部署前后端：

```bash
# 在项目根目录执行
pnpm build && \
cd web && pnpm install && npx vite build && cd .. && \
scp -r web/dist/* root@123.56.163.63:/var/www/linka/ && \
rsync -avz --delete \
  --exclude='node_modules' --exclude='data/' --exclude='.git' \
  --exclude='web/dist' --exclude='web/node_modules' \
  --exclude='.claude/worktrees' --exclude='.superpowers' \
  . root@123.56.163.63:/root/Linka/ && \
ssh root@123.56.163.63 "cd /root/Linka && pnpm install --prod && systemctl restart linka.service && nginx -t && systemctl reload nginx && curl -s http://localhost:3000/health"
```

## 验证

```bash
# 健康检查
curl https://linka.zone/health

# 前端页面
curl -s -o /dev/null -w "%{http_code}" https://linka.zone

# MCP 端点
curl -X POST https://linka.zone/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```
