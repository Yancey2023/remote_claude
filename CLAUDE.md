# Remote Control Claude Code

三个独立程序组成的中转远程控制系统，通过 JSON WebSocket/REST 协议实现对 Claude CLI 的远程控制。

## 项目结构

```
├── relay-server/       Rust 中转服务器 (axum + tokio)
├── desktop-client/     Rust 电脑客户端 (tokio-tungstenite)
├── web-ui/            React 前端 (Vite + TypeScript + xterm.js)
├── shared-types/      共享 TypeScript 类型定义
├── pnpm-workspace.yaml
└── CLAUDE.md
```

## 启动方式

### 1. 中转服务器

```bash
cd relay-server
ADMIN_USER=admin ADMIN_PASS=admin123 JWT_SECRET=change-me cargo run
```

环境变量：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `ADMIN_USER` | `admin` | 管理员用户名 |
| `ADMIN_PASS` | `admin123` | 管理员密码（勿用于生产） |
| `JWT_SECRET` | `dev-secret-...` | JWT 签名密钥 |
| `HOST` | `0.0.0.0` | 监听地址 |
| `PORT` | `8080` | 监听端口 |
| `DATABASE_URL` | `sqlite:data.db?mode=rwc` | SQLite 数据库路径 |
| `HEARTBEAT_INTERVAL_SECS` | `15` | 设备心跳间隔 |
| `HEARTBEAT_TIMEOUT_SECS` | `30` | 心跳超时断连 |

### 2. 电脑客户端

```bash
cd desktop-client
REGISTER_TOKEN=<token> SERVER_URL=ws://127.0.0.1:8080/ws/client cargo run
```

环境变量：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SERVER_URL` | `ws://127.0.0.1:8080/ws/client` | 中转服务器地址 |
| `REGISTER_TOKEN` | **(必填)** | 管理员生成的注册令牌 |
| `DEVICE_NAME` | `hostname` | 设备显示名称 |
| `MAX_RETRY_DELAY_SECS` | `60` | 最大重连间隔（秒） |

### 3. 网页前端

```bash
cd web-ui
pnpm dev          # 开发模式
pnpm build        # 生产构建 → dist/
```

开发环境通过 Vite proxy 将 `/api` 和 `/ws` 转发到 `localhost:8080`。

## 协议

### REST API

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| POST | `/api/auth/login` | 无 | 登录，返回 JWT |
| POST | `/api/auth/logout` | JWT | 登出 |
| POST | `/api/auth/verify` | JWT | 验证 token 有效性 |
| GET | `/api/devices` | JWT | 设备列表 |
| POST | `/api/sessions` | JWT | 创建设备控制会话 |
| DELETE | `/api/sessions/:id` | JWT | 关闭会话 |
| POST | `/api/admin/users` | Admin | 创建用户 |
| GET | `/api/admin/users` | Admin | 用户列表 |
| DELETE | `/api/admin/users/:id` | Admin | 删除用户 |
| PATCH | `/api/admin/users/:id/status` | Admin | 启用/禁用用户 |
| POST | `/api/admin/tokens` | Admin | 生成注册令牌 |

### WebSocket 协议

**设备 ↔ 服务器** (`/ws/client`)：

| type | 方向 | payload |
|------|------|---------|
| `register` | C→S | `{ token, name, version }` |
| `registered` | S→C | `{ device_id }` |
| `ping` | S→C | `{}` |
| `pong` | C→S | `{}` |
| `command` | S→C | `{ session_id, command }` |
| `result_chunk` | C→S | `{ session_id, chunk, done }` |
| `status_update` | C→S | `{ online, busy }` |

**网页 ↔ 服务器** (`/ws/web`)：

先发送 `{ type: "auth", payload: { token } }` 鉴权，随后：

| type | 方向 | payload |
|------|------|---------|
| `create_session` | C→S | `{ device_id }` |
| `session_created` | S→C | `{ session_id, device_id }` |
| `command` | C→S | `{ session_id, command }` |
| `result_chunk` | S→C | `{ session_id, chunk, done }` |
| `close_session` | C→S | `{ session_id }` |
| `device_status` | S→C | `{ device_id, online }` |
| `error` | S→C | `{ code, message }` |

## 运行测试

```bash
cd relay-server && cargo test    # 22 tests
cd desktop-client && cargo test  # 8 tests
```

## 开发约定

- **每次代码变更必须同步更新文档和单元测试**。新增功能、修改接口、修复 bug 后，先确认所有测试通过，再提交。
- 测试覆盖：核心数据结构、鉴权逻辑、存储 CRUD、消息序列化。WebSocket handler 等集成环节至少要有 happy path 覆盖。
- Rust: `#[cfg(test)] mod tests { ... }` 内联在源文件中，`tokio::test` 用于异步测试。

## 架构要点

- **密码安全**: 普通用户 Argon2 哈希，管理员凭据仅环境变量
- **心跳**: 15s 间隔 ping，30s 超时自动标记离线
- **重连**: 指数退避 1s→2s→...→60s max
- **错误边界**: 所有程序有 panic hook 不崩溃，前端 ErrorBoundary 防白屏
- **JWT**: API 除登录外全部 Bearer token 鉴权
- **双通道**: 设备长连 WS，网页 REST + WS 控制通道
- **透传**: 客户端不解析 Claude 输出，只做命令下发和结果收集
- **存储**: SQLite (sqlx)，三表 users/devices/sessions，自动迁移建表
