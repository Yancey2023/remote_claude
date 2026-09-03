# Remote Control Claude Code

这是一个由三个独立程序组成的远程控制系统，通过 JSON WebSocket/REST 协议控制 Claude CLI。

## 仓库结构

```text
apps/server/          Rust 中转服务器
apps/client/          Rust 电脑客户端
apps/web/             React 前端
package/shared-types/ 共享 TypeScript 类型
Dockerfile            多阶段构建文件
doc/                  详细项目文档
```

## 开发要求

1. 代码变更同步更新相关文档和单元测试。
2. 修改后先运行受影响项目测试，再提交清晰的 Conventional Commits。
3. 保持实现、配置字段、API 和 WebSocket 协议文档一致。
4. 不提交密钥、令牌、数据库或构建产物。

## 测试约定

- server/client：Rust 内联 `#[cfg(test)]`，使用 `cargo test` 和 `tokio::test`。
- web-ui：Vitest，测试文件使用 `*.test.ts` 或 `*.test.tsx`，使用 `pnpm test`。
- 核心数据结构、鉴权、存储 CRUD、消息序列化必须有覆盖；WebSocket handler 至少覆盖 happy path。

```bash
cd apps/server && cargo test
cd apps/client && cargo test
cd apps/web && pnpm test
```

## 常用开发命令

```bash
cd apps/server && cargo run
cd apps/client && cargo run
cd apps/web && pnpm dev
```

Web 开发服务器默认代理 `/api` 和 `/ws` 到 `localhost:8080`。前端生产构建使用 `VITE_BASE_URL` 设置部署路径前缀。

## 文档索引

详细内容全部集中在 `doc/`：

- [开发指南](doc/development.md)：结构、启动、测试和开发流程。
- [配置说明](doc/configuration.md)：配置文件、环境变量和迁移。
- [部署指南](doc/deployment.md)：Docker、卷、CI/CD 和 nginx。
- [协议说明](doc/protocol.md)：REST API、设备 WS 和 Web WS。
- [架构说明](doc/architecture.md)：数据流、安全、存储和可靠性设计。
- [文档目录](doc/README.md)

根目录 [README.md](README.md) 面向项目用户，[CHANGELOG.md](CHANGELOG.md) 记录版本历史。
