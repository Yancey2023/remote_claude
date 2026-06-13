# syntax=docker/dockerfile:1
FROM rust:bookworm AS builder

WORKDIR /app

# ── relay-server dependencies (cache layer) ──
COPY relay-server/Cargo.toml relay-server/Cargo.lock ./relay-server/
RUN mkdir -p relay-server/src && \
    echo "fn main() {}" > relay-server/src/main.rs && \
    cd relay-server && cargo build --release && cd .. && \
    rm -rf relay-server/src

# ── desktop-client dependencies (cache layer) ──
COPY desktop-client/Cargo.toml desktop-client/Cargo.lock ./desktop-client/
RUN mkdir -p desktop-client/src && \
    echo "fn main() {}" > desktop-client/src/main.rs && \
    cd desktop-client && cargo build --release && cd .. && \
    rm -rf desktop-client/src

# ── Build relay-server ──
COPY relay-server/src ./relay-server/src
RUN cd relay-server && \
    touch src/main.rs && \
    cargo build --release && \
    cp target/release/relay-server /relay-server

# ── Build desktop-client ──
COPY desktop-client/src ./desktop-client/src
RUN cd desktop-client && \
    touch src/main.rs && \
    cargo build --release && \
    cp target/release/desktop-client /desktop-client

# ── Package client binary into downloads directory ──
RUN version=$(grep '^version' relay-server/Cargo.toml | head -1 | cut -d'"' -f2) && \
    os=$(uname -s | tr '[:upper:]' '[:lower:]') && \
    arch=$(uname -m) && \
    case "$arch" in \
        x86_64)  arch="x64" ;; \
        aarch64) arch="arm64" ;; \
    esac && \
    mkdir -p /app/downloads && \
    cp /desktop-client "/app/downloads/remote-claude-desktop-client-v${version}-${os}-${arch}"

# ── Runtime ──
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /relay-server /app/relay-server
COPY --from=builder /app/downloads /app/downloads
RUN mkdir -p /app/config /app/data && chmod 777 /app /app/config /app/data /app/downloads

EXPOSE 8080

ENV CONFIG_PATH=/app/config/relay-server.toml
ENV DATABASE_URL=sqlite:///app/data/data.db
VOLUME /app/config
VOLUME /app/data
VOLUME /app/downloads

CMD ["/app/relay-server"]
