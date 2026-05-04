# syntax=docker/dockerfile:1
FROM rust:bookworm AS builder

WORKDIR /app

# Cache dependencies: copy manifests first, build a dummy binary
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Now copy real source and rebuild (deps cached from previous layer)
COPY src ./src
RUN cargo build --release && \
    cp target/release/desktop-client /desktop-client

FROM debian:bookworm-slim

# native-tls (tokio-tungstenite) needs libssl3 at runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /desktop-client /app/desktop-client
RUN mkdir -p /app/config

ENV CONFIG_PATH=/app/config/desktop-client.toml
VOLUME /app/config

CMD ["/app/desktop-client"]
