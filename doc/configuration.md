# 配置说明

所有 Rust 程序采用配置文件优先策略：先读取配置文件，缺失字段再读取环境变量；环境变量提供初始值后会自动保存到配置文件。可用 `CONFIG_PATH` 覆盖配置文件路径。

## 服务器

配置文件：`{exe_dir}/config/remote-claude-server.toml`。

```toml
admin_user = "admin"
admin_pass = "admin123"
jwt_secret = "change-me"
database_url = "sqlite:data.db?mode=rwc"
host = "0.0.0.0"
port = 8080
jwt_expiry_hours = 24
heartbeat_interval_secs = 15
heartbeat_timeout_secs = 30
downloads_dir = "./downloads"
```

| 字段 | 环境变量 | 默认值 |
|---|---|---|
| `admin_user` | `ADMIN_USER` | `admin` |
| `admin_pass` | `ADMIN_PASS` | `admin123` |
| `jwt_secret` | `JWT_SECRET` | 开发环境密钥 |
| `host` | `HOST` | `0.0.0.0` |
| `port` | `PORT` | `8080` |
| `database_url` | `DATABASE_URL` | `sqlite:data.db?mode=rwc` |
| `heartbeat_interval_secs` | `HEARTBEAT_INTERVAL_SECS` | `15` |
| `heartbeat_timeout_secs` | `HEARTBEAT_TIMEOUT_SECS` | `30` |
| `downloads_dir` | `DOWNLOADS_DIR` | `./downloads` |

生产环境必须替换管理员密码和 JWT 密钥，并持久化配置、数据库和下载目录。

## 客户端

配置文件：`{exe_dir}/config/remote-claude-client.toml`。

```toml
server_url = "ws://127.0.0.1:8080/ws/client"
device_name = "my-pc"
client_version = "0.1.0"
max_retry_delay_secs = 60
```

| 字段 | 环境变量 | 默认值 |
|---|---|---|
| `server_url` | `SERVER_URL` | `ws://127.0.0.1:8080/ws/client` |
| `client_token` | `CLIENT_TOKEN` | 首次启动时交互输入 |
| `device_name` | `DEVICE_NAME` | 主机名 |
| `client_version` | `CLIENT_VERSION` | `0.1.0` |
| `max_retry_delay_secs` | `MAX_RETRY_DELAY_SECS` | `60` |

缺少客户端令牌时，程序会交互式提示并保存。Windows 下 `.cmd`、`.bat` 或无扩展名命令会通过 `cmd.exe /D /C` 启动。

## Web 前端

前端配置在构建时写入 bundle，无运行时配置文件。`VITE_BASE_URL` 用于部署路径前缀：

| 构建方式 | API 地址 | WebSocket 地址 |
|---|---|---|
| `pnpm dev` | `/api` | `/ws` |
| `VITE_BASE_URL=/remote_claude pnpm build` | `/remote_claude/api` | `/remote_claude/ws` |

从旧版纯环境变量配置迁移时，首次运行设置环境变量即可自动生成配置文件。
