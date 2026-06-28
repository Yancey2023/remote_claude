# syntax=docker/dockerfile:1

# ── relay-server builder (latest Rust) ──
FROM rust:bookworm AS relay-builder

WORKDIR /app
RUN apt-get update && apt-get install -y musl-tools && rm -rf /var/lib/apt/lists/* && \
    rustup target add x86_64-unknown-linux-musl

# Copy workspace root + all member Cargo.tomls and lockfile for dependency caching
COPY Cargo.toml ./Cargo.toml
COPY Cargo.lock ./Cargo.lock
COPY apps/server/Cargo.toml ./apps/server/Cargo.toml
COPY apps/client/Cargo.toml ./apps/client/Cargo.toml

# Build dependencies with dummy main.rs
RUN mkdir -p apps/server/src && echo "fn main() {}" > apps/server/src/main.rs && \
    cargo build -p remote-claude-server --release --target x86_64-unknown-linux-musl && \
    rm -rf apps/server/src

# Copy real source and rebuild (dependencies are cached)
COPY apps/server/src ./apps/server/src
RUN touch apps/server/src/main.rs && \
    cargo build -p remote-claude-server --release --target x86_64-unknown-linux-musl && \
    cp target/x86_64-unknown-linux-musl/release/remote-claude-server /remote-claude-server

# ── desktop-client binaries ──
# Pre-built by GitHub Actions on native runners (see .github/workflows/docker.yml).
FROM scratch AS client-binaries
COPY downloads /downloads

# ── Runtime ──
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=relay-builder /remote-claude-server /app/remote-claude-server
COPY --from=client-binaries /downloads /app/downloads
RUN mkdir -p /app/config /app/data && chmod 777 /app /app/config /app/data /app/downloads

EXPOSE 8080

ENV CONFIG_PATH=/app/config/remote-claude-server.toml
ENV DATABASE_URL=sqlite:///app/data/data.db?mode=rwc
VOLUME /app/config
VOLUME /app/data

CMD ["/app/remote-claude-server"]
