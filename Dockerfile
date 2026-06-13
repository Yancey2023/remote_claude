# syntax=docker/dockerfile:1

# ── relay-server builder (latest Rust) ──
FROM rust:bookworm AS relay-builder

WORKDIR /app
COPY relay-server/Cargo.toml relay-server/Cargo.lock ./relay-server/
RUN mkdir -p relay-server/src && echo "fn main() {}" > relay-server/src/main.rs && \
    cd relay-server && cargo build --release && cd .. && rm -rf relay-server/src
COPY relay-server/src ./relay-server/src
RUN cd relay-server && touch src/main.rs && cargo build --release && cp target/release/relay-server /relay-server

# ── desktop-client builder (Ubuntu 22.04 → glibc 2.35, compatible with older distros) ──
FROM ubuntu:22.04 AS client-builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates build-essential pkg-config libssl-dev && \
    rm -rf /var/lib/apt/lists/*

ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | \
    sh -s -- -y --default-toolchain stable --profile minimal --no-modify-path

WORKDIR /app

# Cache dependencies
COPY desktop-client/Cargo.toml desktop-client/Cargo.lock ./desktop-client/
RUN mkdir -p desktop-client/src && echo "fn main() {}" > desktop-client/src/main.rs && \
    cd desktop-client && cargo build --release && cd .. && rm -rf desktop-client/src

# Build real binary
COPY desktop-client/src ./desktop-client/src
RUN cd desktop-client && touch src/main.rs && cargo build --release

# Package into downloads directory with release naming
RUN version=$(grep '^version' desktop-client/Cargo.toml | head -1 | cut -d'"' -f2) && \
    os=$(uname -s | tr '[:upper:]' '[:lower:]') && \
    arch=$(uname -m) && \
    case "$arch" in \
        x86_64)  arch="x64" ;; \
        aarch64) arch="arm64" ;; \
    esac && \
    mkdir -p /app/downloads && \
    cp target/release/desktop-client "/app/downloads/remote-claude-desktop-client-v${version}-${os}-${arch}"

# ── Runtime ──
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=relay-builder /relay-server /app/relay-server
COPY --from=client-builder /app/downloads /app/downloads
RUN mkdir -p /app/config /app/data && chmod 777 /app /app/config /app/data /app/downloads

EXPOSE 8080

ENV CONFIG_PATH=/app/config/relay-server.toml
ENV DATABASE_URL=sqlite:///app/data/data.db?mode=rwc
VOLUME /app/config
VOLUME /app/data

CMD ["/app/relay-server"]
