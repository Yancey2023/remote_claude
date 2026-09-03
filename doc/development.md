# 开发指南

## 项目结构

```text
apps/server/             Rust 中转服务器（axum + tokio + sqlx）
apps/client/             Rust 电脑客户端（tokio-tungstenite）
apps/web/                React + TypeScript + Vite + xterm.js
package/shared-types/    共享 TypeScript 类型
Dockerfile               多阶段构建文件
.github/workflows/       CI/CD 工作流
doc/                     项目文档
```

## 本地启动

服务器：

```bash
cd apps/server
ADMIN_USER=admin ADMIN_PASS=admin123 JWT_SECRET=change-me cargo run
```

客户端需要先通过管理员 API 生成令牌：

```bash
cd apps/client
CLIENT_TOKEN=<token> SERVER_URL=ws://127.0.0.1:8080/ws/client cargo run
```

Web 前端：

```bash
cd apps/web
pnpm install
pnpm dev
```

开发服务器默认在 `http://localhost:5173`，并将 `/api`、`/ws` 代理到 `localhost:8080`。

## 测试

```bash
cd apps/server && cargo test
cd apps/client && cargo test
cd apps/web && pnpm test
```

前端单文件测试：`pnpm test -- src/api/client.test.ts`；监听模式：`pnpm test:watch`。

测试应覆盖核心数据结构、鉴权、存储 CRUD、消息序列化；WebSocket handler 至少覆盖 happy path。Rust 测试以内联 `#[cfg(test)]` 模块为主，TypeScript 测试使用 Vitest，文件名为 `*.test.ts` 或 `*.test.tsx`。

## 开发约定

- 代码变更同步更新相关文档和单元测试。
- 修改完成后先运行受影响项目的测试，再运行必要的全量检查。
- 保持接口、配置字段和协议文档与实现一致。
- 提交信息使用清晰的 Conventional Commits 格式。
