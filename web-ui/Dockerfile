# syntax=docker/dockerfile:1
FROM node:latest AS builder

WORKDIR /app

# Copy workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY shared-types/ ./shared-types/
COPY web-ui/ ./web-ui/

RUN corepack enable && \
    pnpm install --frozen-lockfile && \
    pnpm --filter @remote-claude/web-ui build

FROM nginx:alpine

COPY --from=builder /app/web-ui/dist /usr/share/nginx/html
COPY web-ui/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
