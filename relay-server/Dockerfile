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
# Force Cargo to rebuild the real binary. Without touching main.rs, Docker COPY
# can preserve mtimes and Cargo may keep the cached dummy binary.
RUN touch src/main.rs && \
    cargo build --release && \
    cp target/release/relay-server /relay-server

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /relay-server /app/relay-server
RUN mkdir -p /app/config

EXPOSE 8080

ENV CONFIG_PATH=/app/config/relay-server.toml
VOLUME /app/config
VOLUME /app/data

CMD ["/app/relay-server"]
