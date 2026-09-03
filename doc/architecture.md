# 架构说明

## 组件与数据流

```text
Web UI ── REST/WS ──> server ── WS ──> client ──> Claude CLI
  ^                    │                  │
  └── 实时结果 ────────┴──── SQLite ──────┘
```

- server 负责用户鉴权、设备注册、会话路由、结果转发和 SQLite 持久化。
- client 维持设备长连接，在本机启动和管理 Claude CLI，不解析 CLI 输出。
- web-ui 负责登录、设备与会话管理、终端交互和实时输出展示。

## 关键设计

- **配置**：Rust 程序配置文件优先，环境变量用于首次初始化；Web 配置在构建时注入。
- **鉴权**：普通用户密码使用 Argon2 哈希；REST 使用 HttpOnly cookie/JWT，WebSocket 使用 JSON token；密码变更会使旧令牌失效。
- **连接**：设备每 15 秒心跳，30 秒超时标记离线；客户端按 1、2、4 秒指数退避，最大 60 秒重连。
- **存储**：SQLite 通过 sqlx 自动迁移，核心表为 `users`、`devices`、`sessions`。
- **安全边界**：生产环境由 nginx 统一提供 TLS 和安全头，server 不直接暴露到公网。
- **容错**：Rust 程序设置 panic hook，前端使用 ErrorBoundary，避免单个错误导致整体不可用。
- **实时控制**：设备通道与 Web 通道分离，server 只路由命令和结果，客户端负责本地进程生命周期。
