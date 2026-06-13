# syntax=docker/dockerfile:1

# ── relay-server builder (latest Rust) ──
FROM rust:bookworm AS relay-builder

WORKDIR /app
COPY relay-server/Cargo.toml relay-server/Cargo.lock ./relay-server/
RUN mkdir -p relay-server/src && echo "fn main() {}" > relay-server/src/main.rs && \
    cd relay-server && cargo build --release && cd .. && rm -rf relay-server/src
COPY relay-server/src ./relay-server/src
RUN cd relay-server && touch src/main.rs && cargo build --release && cp target/release/relay-server /relay-server

# ── desktop-client binaries ──
# Pre-built by GitHub Actions on native runners (see .github/workflows/docker.yml).
# The downloads/ directory (at build context root) contains the release-named binaries.
FROM scratch AS client-binaries
COPY downloads /downloads

# ── Runtime ──
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=relay-builder /relay-server /app/relay-server
COPY --from=client-binaries /downloads /app/downloads
RUN mkdir -p /app/config /app/data && chmod 777 /app /app/config /app/data /app/downloads

EXPOSE 8080

ENV CONFIG_PATH=/app/config/relay-server.toml
ENV DATABASE_URL=sqlite:///app/data/data.db?mode=rwc
VOLUME /app/config
VOLUME /app/data

CMD ["/app/relay-server"]
