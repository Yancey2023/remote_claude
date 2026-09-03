# 部署指南

## Docker

根目录 Dockerfile 构建服务器镜像，并打包客户端发布产物到 `/app/downloads`。

```bash
docker build -t yanceyawa/remote-claude .
docker run -d --name remote-claude -p 8080:8080 \
  -e ADMIN_USER=admin \
  -e ADMIN_PASS=admin123 \
  -e JWT_SECRET=change-me \
  -v claude-config:/app/config \
  -v claude-data:/app/data \
  -v claude-downloads:/app/downloads \
  yanceyawa/remote-claude
```

生产环境请使用强密码和随机 JWT 密钥。配置、SQLite 数据库和下载目录都应使用持久化卷。镜像支持通过 Docker Hub 拉取：`docker pull yanceyawa/remote-claude`。

Compose 示例：

```yaml
services:
  remote-claude:
    image: yanceyawa/remote-claude
    ports:
      - "8080:8080"
    volumes:
      - claude-config:/app/config
      - claude-data:/app/data
      - claude-downloads:/app/downloads
    environment:
      ADMIN_USER: admin
      ADMIN_PASS: change-me
      JWT_SECRET: change-me
    restart: unless-stopped
volumes:
  claude-config:
  claude-data:
  claude-downloads:
```

## CI/CD

- `ci.yml`：push 到 main 或创建 Pull Request 时构建并测试 server、client、web。
- `docker.yml`：push 到 main 或 `v*` 标签时构建并推送 Docker 镜像，并执行部署流程。
- `release.yml`：构建各平台客户端和 Web 资源并创建 GitHub Release。

Docker 发布需要配置 `DOCKER_USERNAME`、`DOCKER_PASSWORD`；SSH 部署需要 `REMOTE_HOST`、`REMOTE_USER` 和 `ACCESS_TOKEN`。生产入口建议使用 nginx 终止 TLS，并代理 `/api/`、`/ws/client` 和 `/ws/web`。
