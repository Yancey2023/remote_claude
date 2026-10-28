# 协议说明

所有消息均为 JSON。REST API 默认以 `/api` 为前缀，WebSocket 默认使用 `/ws`。

## REST API

| 方法 | 路径 | 鉴权 | 用途 |
|---|---|---|---|
| POST | `/api/auth/login` | 无 | 登录并返回 JWT |
| POST | `/api/auth/logout` | JWT | 登出 |
| POST | `/api/auth/verify` | JWT | 验证令牌 |
| POST | `/api/auth/change-password` | JWT | 修改密码 |
| GET/DELETE | `/api/devices`、`/api/devices/:id` | JWT | 查看或删除自己的设备 |
| POST/GET | `/api/sessions` | JWT | 创建或列出会话 |
| GET/DELETE | `/api/sessions/:id` | JWT | 查看或关闭会话 |
| POST/GET/DELETE | `/api/admin/users`、`/api/admin/users/:id` | Admin | 管理用户 |
| PATCH | `/api/admin/users/:id/status` | Admin | 启用或禁用用户 |
| POST | `/api/admin/users/:id/password` | Admin | 重置用户密码 |
| GET/DELETE | `/api/admin/devices`、`/api/admin/devices/:id` | Admin | 管理设备 |
| GET | `/api/admin/sessions`、`/api/admin/sessions/:id` | Admin | 查看全部会话和历史 |
| POST | `/api/admin/tokens` | Admin | 生成客户端令牌 |
| GET | `/api/downloads` | 无 | 列出客户端下载文件 |
| GET | `/api/downloads/sizes` | 无 | 获取客户端下载文件大小 |
| GET | `/api/downloads/{filename}` | 无 | 下载客户端文件 |

下载接口公开读取 `downloads_dir` 中的发布文件，供未登录的新设备通过命令行安装。仅支持目录内的单个普通文件，拒绝路径穿越、子目录和符号链接；此目录只应存放可公开分发的安装包。设备注册仍需客户端令牌，设备、会话和令牌管理接口仍需 JWT。

## WebSocket

### 设备通道 `/ws/client`

客户端先发送 `register`：`{ token, name, version, device_id }`。服务器回复 `registered`：`{ device_id }`。服务器发送 `ping`，客户端回复 `pong`。

业务消息包括：`command`、`terminal_input`、`terminal_resize`、`session_closed`、`list_directory`；客户端回复 `result_chunk`、`status_update` 和 `directory_list`。

### Web 通道 `/ws/web`

连接后首先发送 `{ type: "auth", payload: { token } }`。业务消息包括 `create_session`、`attach_session`、`command`、`terminal_input`、`terminal_resize`、`close_session` 和 `list_directory`；服务器回复 `session_created`、`result_chunk`、`device_status`、`directory_list` 或 `error`。

会话消息通常带有 `session_id`；目录请求使用 `request_id`，目录项格式为 `{ name, is_dir, size? }`。
