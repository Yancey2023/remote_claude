# Remote Control Claude Code

通过 WebSocket/REST 协议远程控制 [Claude Code](https://claude.ai/code) CLI 的中转控制系统。三个独立程序协作实现远程设备管理、会话控制和实时输出查看。

## 架构

```
┌─────────────┐     REST/WS      ┌────────────────┐     WS      ┌──────────────────┐
│  Web UI      │ ──────────────> │  Relay Server   │ ─────────> │  Desktop Client  │
│  (React)     │                 │  (Rust/Axum)    │            │  (Rust/tungstenite│
│              │ <────────────── │                 │ <───────── │  → Claude CLI)   │
│  xterm.js    │    JSON协议      │  SQLite存储     │   JSON协议  │                  │
└─────────────┘                 └────────────────┘            └──────────────────┘
```

- **relay-server** — Rust 中转服务器，管理设备连接、会话路由和用户鉴权
- **desktop-client** — Rust 桌面客户端，连接到 relay-server 并在本地执行 Claude CLI 命令
- **web-ui** — React 前端，通过浏览器远程创建会话、下发命令、查看实时输出

## 快速开始

### 1. 启动中转服务器

```bash
cd relay-server

# 首次运行，通过环境变量自动生成配置文件
ADMIN_USER=admin ADMIN_PASS=admin123 JWT_SECRET=change-me cargo run

# 或直接创建配置文件后运行
cargo run
```

### 2. 生成注册令牌

```bash
# 登录获取 JWT
TOKEN=$(curl -s -X POST http://127.0.0.1:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.token')

# 生成客户端注册令牌
REGISTER_TOKEN=$(curl -s -X POST http://127.0.0.1:8080/api/admin/tokens \
  -H "Authorization: Bearer $TOKEN" | jq -r '.token')

echo $REGISTER_TOKEN
```

### 3. 启动桌面客户端

```bash
cd desktop-client

REGISTER_TOKEN=<上一步生成的令牌> SERVER_URL=ws://127.0.0.1:8080/ws/client cargo run
```

### 4. 启动网页前端

```bash
cd web-ui
pnpm install
pnpm dev          # → http://localhost:5173 (Vite proxy → localhost:8080)
```

### 5. Docker Compose 一键部署

```bash
# 先在中转服务器上生成注册令牌，写入 .env 文件
echo "CLIENT_REGISTER_TOKEN=<令牌>" > .env

# 启动所有服务
docker compose up -d
```

## 项目结构

```
├── relay-server/       Rust 中转服务器 (axum + tokio + sqlx)
├── desktop-client/     Rust 电脑客户端 (tokio-tungstenite)
├── web-ui/             React 前端 (Vite + TypeScript + xterm.js)
├── shared-types/       共享 TypeScript 类型定义
├── docker-compose.yml  后端 Docker Compose 编排
└── pnpm-workspace.yaml
```

## 配置

配置文件优先，环境变量仅作为首次运行时的初始值来源。

| 程序 | 配置文件路径 |
|------|-------------|
| relay-server | `config/relay-server.toml` |
| desktop-client | `config/desktop-client.toml` |
| web-ui | `dist/config.json`（生产部署） |

通过 `CONFIG_PATH` 环境变量可覆盖配置文件路径。

## 协议

### REST API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录，返回 JWT |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/devices` | 设备列表 |
| POST | `/api/sessions` | 创建设备控制会话 |
| DELETE | `/api/sessions/:id` | 关闭会话 |
| POST | `/api/admin/tokens` | 生成注册令牌 |
| POST | `/api/admin/users` | 创建用户 |
| GET | `/api/admin/users` | 用户列表 |

### WebSocket 协议

- **设备通道** `/ws/client` — 设备注册、心跳、命令下发、结果回传
- **Web 通道** `/ws/web` — 创建会话、下发命令、接收实时输出

详见 [CLAUDE.md](CLAUDE.md) 协议章节。

## 运行测试

```bash
cd relay-server && cargo test    # 54 个测试
cd desktop-client && cargo test  # 18 个测试
cd web-ui && pnpm test           # 55 个测试
```

## 技术栈

- **后端**: Rust (Axum, Tokio, sqlx, tokio-tungstenite)
- **前端**: React, TypeScript, Vite, xterm.js
- **存储**: SQLite
- **容器**: Docker 多阶段构建, Docker Compose
- **密码**: Argon2 哈希
- **鉴权**: JWT Bearer Token
