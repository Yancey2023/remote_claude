# Remote Control Claude Code

三个独立程序组成的中转远程控制系统，通过 JSON WebSocket/REST 协议实现对 Claude CLI 的远程控制。

## 项目结构

```
├── relay-server/       Rust 中转服务器 (axum + tokio)
│   ├── Dockerfile      多阶段构建镜像
│   └── .dockerignore
├── desktop-client/     Rust 电脑客户端 (tokio-tungstenite)
│   ├── Dockerfile      多阶段构建镜像
│   └── .dockerignore
├── web-ui/            React 前端 (Vite + TypeScript + xterm.js)
│   ├── Dockerfile      多阶段构建镜像（node:latest → nginx:alpine）
│   └── nginx.conf      API/WS 反向代理配置
├── shared-types/      共享 TypeScript 类型定义
├── docker-compose.yml 后端 Docker Compose 编排
├── .dockerignore      根级别构建上下文过滤
├── pnpm-workspace.yaml
└── CLAUDE.md
```

## 开发约定

最高优先级的开发规则，任何代码变更必须遵守：

1. **每次代码变更必须同步更新文档和单元测试**。新增功能、修改接口、修复 bug 后，先确认所有测试通过，再提交。
2. **代码变更后自动提交 git**。每完成一组相关联的更改后，创建有意义的 commit，包含变更范围和原因的说明。
3. **保持依赖最新**。定期运行 `cargo update`（Rust）和 `pnpm update --latest`（前端）更新依赖到最新兼容版本。如有大版本变更导致编译失败，需要同步修复代码。

### 测试约定

测试覆盖范围：核心数据结构、鉴权逻辑、存储 CRUD、消息序列化。WebSocket handler 等集成环节至少要有 happy path 覆盖。

```rust
// Rust: 内联在源文件末尾，使用 #[cfg(test)] mod tests
// 同步测试
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_some_behavior() {
        // Arrange
        let input = "test";
        // Act
        let result = process(input);
        // Assert
        assert_eq!(result, expected);
    }
}

// 异步测试
#[cfg(test)]
mod async_tests {
    use super::*;

    #[tokio::test]
    async fn test_async_behavior() {
        let result = some_async_fn().await;
        assert!(result.is_ok());
    }
}
```

```typescript
// TypeScript: 使用 vitest，文件命名 *.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('模块名', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('描述具体行为', async () => {
    // Arrange
    const mockFn = vi.fn().mockResolvedValue(mockResponse(200, { data: 'ok' }));
    globalThis.fetch = mockFn;

    // Act
    const result = await apiClient.someMethod();

    // Assert
    expect(result).toEqual(expected);
    expect(mockFn).toHaveBeenCalledWith(
      expect.stringContaining('/api/some-path'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
```

| 项目 | 框架 | 测试数量 | 位置 |
|------|------|----------|------|
| relay-server | `cargo test` / `tokio::test` | 75 | `#[cfg(test)]` 内联在源文件中 |
| desktop-client | `cargo test` / `tokio::test` | 23 | `#[cfg(test)]` 内联在源文件中 |
| web-ui | `vitest` / `pnpm test` | 64 | `*.test.ts` 和测试文件同目录 |

## 配置系统

所有程序采用 **配置文件优先** 的配置加载策略：

1. 读取配置文件（TOML / JSON）
2. 配置文件中缺失的字段，回退到环境变量
3. 如果环境变量提供了初始值，自动保存到配置文件中
4. 下次启动时配置文件已完整，不再需要环境变量

配置文件路径：

| 程序 | 路径 |
|------|------|
| relay-server | `{exe_dir}/config/relay-server.toml` |
| desktop-client | `{exe_dir}/config/desktop-client.toml` |
| web-ui | 构建时 `VITE_BASE_URL` 编译进 bundle |

可通过 `CONFIG_PATH` 环境变量覆盖配置文件路径。

## 启动方式

### 1. 中转服务器

**方式 A** — 首次运行，通过环境变量生成配置文件：

```bash
cd relay-server
ADMIN_USER=admin ADMIN_PASS=admin123 JWT_SECRET=change-me cargo run
# 自动创建 config/relay-server.toml（相对于可执行文件路径）
```

**方式 B** — 直接创建配置文件（推荐生产环境）：

```toml
# {exe_dir}/config/relay-server.toml
admin_user = "admin"
admin_pass = "admin123"
jwt_secret = "change-me"
database_url = "sqlite:data.db"
host = "0.0.0.0"
port = 8080
jwt_expiry_hours = 24
heartbeat_interval_secs = 15
heartbeat_timeout_secs = 30
```

```bash
cd relay-server
cargo run
```

配置字段（兼容的环境变量名作为回退来源）：

| 字段 | 环境变量 | 默认值 | 说明 |
|------|----------|--------|------|
| `admin_user` | `ADMIN_USER` | `admin` | 管理员用户名 |
| `admin_pass` | `ADMIN_PASS` | `admin123` | 管理员密码（勿用于生产） |
| `jwt_secret` | `JWT_SECRET` | `dev-secret-...` | JWT 签名密钥 |
| `host` | `HOST` | `0.0.0.0` | 监听地址 |
| `port` | `PORT` | `8080` | 监听端口 |
| `database_url` | `DATABASE_URL` | `sqlite:data.db` | SQLite 数据库路径 |
| `heartbeat_interval_secs` | `HEARTBEAT_INTERVAL_SECS` | `15` | 设备心跳间隔（秒） |
| `heartbeat_timeout_secs` | `HEARTBEAT_TIMEOUT_SECS` | `30` | 心跳超时断连（秒） |

### 2. 电脑客户端

**方式 A** — 首次运行，通过环境变量生成配置文件：

```bash
cd desktop-client
REGISTER_TOKEN=<token> cargo run
# 默认连接 ws://127.0.0.1:8080/ws/client（本地开发）
# 生产环境：SERVER_URL=wss://your-domain.com/ws/client
# 自动创建 config/desktop-client.toml（相对于可执行文件路径）
```

**方式 B** — 直接创建配置文件：

```toml
# {exe_dir}/config/desktop-client.toml
server_url = "ws://127.0.0.1:8080/ws/client"
device_name = "my-pc"
client_version = "0.1.0"
max_retry_delay_secs = 60
```

```bash
cd desktop-client
cargo run
```

配置字段（兼容的环境变量名）：

| 字段 | 环境变量 | 默认值 | 说明 |
|------|----------|--------|------|
| `server_url` | `SERVER_URL` | `ws://127.0.0.1:8080/ws/client` | 中转服务器地址（支持 `wss://`） |
| `register_token` | `REGISTER_TOKEN` | **(必填)** | 管理员生成的注册令牌 |
| `device_name` | `DEVICE_NAME` | `hostname` | 设备显示名称（Linux: `HOSTNAME`, Windows: `COMPUTERNAME`） |
| `client_version` | `CLIENT_VERSION` | `0.1.0` | 客户端版本标识 |
| `max_retry_delay_secs` | `MAX_RETRY_DELAY_SECS` | `60` | 最大重连间隔（秒） |
| `claude_binary` | `CLAUDE_BINARY` | `claude` | Claude CLI 可执行文件路径/名称 |

### 3. 网页前端

```bash
cd web-ui
pnpm dev          # 开发模式（Vite proxy → localhost:8080），API/WS 无前缀
pnpm build        # 生产构建 → dist/，部署时通过 VITE_BASE_URL 指定路径前缀
```

构建时通过 `VITE_BASE_URL` 指定路径前缀，所有 API 和 WS 请求自动拼接到该前缀下：

| 构建方式 | VITE_BASE_URL | apiBaseUrl | wsBaseUrl |
|----------|---------------|------------|-----------|
| `pnpm dev`（默认） | 空 | `/api` | `/ws` |
| `VITE_BASE_URL=/remote_claude pnpm build` | `/remote_claude` | `/remote_claude/api` | `/remote_claude/ws` |

> 无运行时配置文件，所有配置在构建时直接编译进 bundle。

开发环境通过 Vite proxy 将 `/api` 和 `/ws` 转发到 `localhost:8080`。

## Docker 部署

所有程序支持 Docker 构建，使用最新的 Rust/Node 基础镜像多阶段构建，最小化最终镜像体积。

### 单独构建

| 项目 | 构建命令 | 运行镜像 |
|------|----------|----------|
| relay-server | `docker build -t remote-claude/relay-server relay-server/` | `debian:bookworm-slim` |
| desktop-client | `docker build -t remote-claude/desktop-client desktop-client/` | `debian:bookworm-slim` |
| web-ui | `docker build -t remote-claude/web-ui -f web-ui/Dockerfile .` | `nginx:alpine` |

> web-ui 构建需要 monorepo 上下文（共享 shared-types），因此 context 为项目根目录。

### 中转服务器

```bash
# 构建镜像
docker build -t remote-claude/relay-server relay-server/

# 首次运行（通过环境变量生成配置文件）
docker run -d --name remote-claude-relay-server -p 8080:8080 \
  -e ADMIN_USER=admin \
  -e ADMIN_PASS=admin123 \
  -e JWT_SECRET=change-me \
  -v relay-config:/app/config \
  -v relay-data:/app/data \
  remote-claude/relay-server

# 后续运行（配置文件已持久化到 volume 中）
docker start remote-claude-relay-server
```

### 电脑客户端

```bash
# 构建镜像
docker build -t remote-claude/desktop-client desktop-client/

# 运行（必须提供 REGISTER_TOKEN）
# 通过 nginx 代理（推荐，支持 WSS 加密）：
docker run -d --name remote-claude-desktop-client \
  -e REGISTER_TOKEN=<token> \
  -e SERVER_URL=wss://your-domain.com/ws/client \
  -v client-config:/app/config \
  remote-claude/desktop-client

# 直接连接 relay-server（仅开发测试）：
docker run -d --name remote-claude-desktop-client \
  -e REGISTER_TOKEN=<token> \
  -e SERVER_URL=ws://host.docker.internal:8080/ws/client \
  -v client-config:/app/config \
  remote-claude/desktop-client
```

> **注意**: desktop-client 容器内需要访问 Claude CLI。建议将宿主机的 `claude` 二进制文件挂载到容器中，并通过 `CLAUDE_BINARY` 环境变量指定路径。
> **注意**: 容器内配置路径默认为 `/app/config/*.toml`（通过 `CONFIG_PATH` 环境变量设置）。所有配置项也可通过环境变量传入。
> **加密**: desktop-client 支持 `wss://`（通过 native-tls），生产环境应通过 nginx 反向代理终结 TLS。

### 网页前端

```bash
# 构建（注意 context 为项目根目录）
docker build -t remote-claude/web-ui -f web-ui/Dockerfile .
# 运行
docker run -d --name remote-claude-web-ui -p 80:80 remote-claude/web-ui
```

> nginx 代理所有 `/api/` 和 `/ws` 流量（包括 `/ws/client` 和 `/ws/web`）到 relay-server。
> nginx.conf 包含安全头（X-Content-Type-Options, X-Frame-Options），nginx.ssl.conf 额外包含 HSTS。
> 所有外部流量统一经过 nginx 终结 TLS，relay-server 不直接对外暴露。

### Docker Compose

一键启动所有服务：

```bash
# 1. 先在中转服务器上生成一个注册令牌（通过 API）
#    然后在项目根目录创建 .env 文件：
echo "CLIENT_REGISTER_TOKEN=<生成的令牌>" > .env

# 2. 启动所有服务
docker compose up -d

# 查看日志
docker compose logs -f

# 停止
docker compose down
```

环境变量（通过 `.env` 文件或 shell 设置）：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `RELAY_ADMIN_USER` | `admin` | 中转服务器管理员用户名 |
| `RELAY_ADMIN_PASS` | `admin123` | 中转服务器管理员密码 |
| `RELAY_JWT_SECRET` | `change-me` | JWT 签名密钥 |
| `CLIENT_REGISTER_TOKEN` | **(必填)** | 客户端注册令牌 |
| `CLIENT_DEVICE_NAME` | `docker-client` | 客户端设备名称 |

> `desktop-client` 容器通过 Docker DNS 自动连接 `web-ui`（nginx），再转发到 `relay-server`。
> 如需 TLS 加密，取消 web-ui 端口 443 注释、挂载证书并使用 nginx.ssl.conf，然后将 `SERVER_URL` 改为 `wss://web-ui:443/ws/client`。

## 迁移说明

从旧版（纯环境变量）升级：

1. **Rust 程序**：首次运行时设置所需环境变量，程序自动创建配置文件并保存所有值。后续运行无需再设置环境变量。
2. **网页前端**：生产部署时通过 `VITE_BASE_URL` 环境变量指定路径前缀，编译进 bundle。开发环境无需配置。

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

## CI/CD

GitHub Actions 自动构建和发布：

### CI（`.github/workflows/ci.yml`）

| 触发 | 操作 |
|------|------|
| `push` main | 构建 + 测试全部三个项目 |
| `pull_request` main | 同上 |

三个并行 job：`relay-server`（`cargo test`）、`desktop-client`（`cargo test`）、`web-ui`（`pnpm test`）。Rust 使用 cargo 缓存加速，前端使用 pnpm 缓存。

### Docker 发布（`.github/workflows/docker.yml`）

| 触发 | 操作 |
|------|------|
| `push` main | 构建并推送镜像，标签：`main`、`<git-sha>` |
| `push` tag `v*` | 同上 + semver 标签：`vX.Y.Z`、`vX.Y` |

仅 relay-server 发布到 GitHub Container Registry（`ghcr.io/<owner>/<repo>-relay-server`），无需额外注册。使用 `GITHUB_TOKEN` 自动鉴权，BuildKit `type=gha` 缓存加速构建。

## 运行测试

```bash
# 运行全部
cd relay-server && cargo test    # 66 tests
cd desktop-client && cargo test  # 23 tests
cd web-ui && pnpm test           # 64 tests

# 运行单个测试文件（Rust）
cd relay-server && cargo test test_config_default_values

# 运行单个测试文件（前端）
cd web-ui && pnpm test -- src/api/client.test.ts

# 监听模式（前端）
cd web-ui && pnpm test:watch
```

## 架构要点

- **配置系统**: 配置文件优先（TOML/JSON），环境变量仅作为首次运行的初始值来源。配置文件存放于可执行文件所在目录的 `config/` 子目录下。
- **密码安全**: 普通用户 Argon2 哈希，管理员凭据仅环境变量
- **心跳**: 15s 间隔 ping，30s 超时自动标记离线
- **重连**: 指数退避 1s→2s→...→60s max
- **错误边界**: 所有程序有 panic hook 不崩溃，前端 ErrorBoundary 防白屏
- **JWT**: 登录后返回 HttpOnly cookie（REST API 鉴权）+ JSON body 中 token（WebSocket 鉴权）
- **nginx 统一入口**: 所有外部流量经 nginx（TLS 终结 + 安全头），relay-server 不直接对外暴露
- **双通道**: 设备长连 WS（通过 nginx 代理 `/ws/client`），网页 REST + WS 控制通道（通过 nginx 代理 `/api/` 和 `/ws/web`）
- **透传**: 客户端不解析 Claude 输出，只做命令下发和结果收集
- **存储**: SQLite (sqlx)，三表 users/devices/sessions，自动迁移建表
