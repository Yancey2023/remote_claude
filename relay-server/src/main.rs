mod api;
mod auth;
mod config;
mod error;
mod models;
mod store;
mod ws;

use std::net::{IpAddr, Ipv4Addr};
use std::sync::Arc;
use tokio::sync::RwLock;

use axum::extract::ws::WebSocketUpgrade;
use axum::extract::{Path, State};
use axum::http::HeaderMap;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::{error, info};

use ws::client_hub::ClientHub;
use ws::web_hub::WebHub;
use ws::AppState;

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "relay_server=debug,tower_http=debug".into()),
        )
        .with_target(true)
        .init();

    // Set panic hook — catch panics, log them, keep running
    std::panic::set_hook(Box::new(|panic_info| {
        let msg = if let Some(s) = panic_info.payload().downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = panic_info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "unknown panic".to_string()
        };
        let location = panic_info
            .location()
            .map(|l| l.to_string())
            .unwrap_or_default();
        error!(message = %msg, location = %location, "PANIC caught");
    }));

    let mut config = config::Config::load();

    // Auto-generate jwt_secret if empty (first run)
    config.ensure_jwt_secret();

    let store = store::SqliteStore::new(&config.database_url)
        .await
        .expect("failed to initialize database");
    let client_hub = ClientHub::new();
    let web_hub = WebHub::new();

    let login_rate_limiter = api::rate_limit::LoginRateLimiter::new(10, 300); // 10 attempts per 5 min per IP
    let ws_rate_limiter = Arc::new(api::rate_limit::LoginRateLimiter::new(30, 60));   // 30 WS upgrades per min per IP
    let register_rate_limiter = Arc::new(api::rate_limit::LoginRateLimiter::new(5, 60)); // 5 registration attempts per min per IP

    let state = Arc::new(RwLock::new(AppState {
        config: config.clone(),
        client_hub,
        web_hub,
        store,
        login_rate_limiter,
        ws_rate_limiter,
        register_rate_limiter,
    }));

    // Build router
    let app = api::router()
        .route("/ws/{*path}", get(ws_upgrade))
        .route("/", get(|| async { "Relay Server" }))
        .layer({
            use axum::http::header::{AUTHORIZATION, CONTENT_TYPE};
            use axum::http::Method;

            let cors = CorsLayer::new()
                .allow_methods([Method::GET, Method::POST, Method::DELETE, Method::PATCH])
                .allow_headers([CONTENT_TYPE, AUTHORIZATION]);
            if config.allowed_origin.is_empty() {
                cors
            } else {
                cors.allow_origin(
                    config.allowed_origin
                        .parse::<axum::http::HeaderValue>()
                        .map(AllowOrigin::exact)
                        .unwrap_or(AllowOrigin::any()),
                )
            }
        })
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = format!("{}:{}", config.host, config.port);
    info!("relay-server starting on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("failed to bind address");

    axum::serve(listener, app)
        .await
        .expect("server error");
}

async fn ws_upgrade(
    ws: WebSocketUpgrade,
    Path(path): Path<String>,
    headers: HeaderMap,
    State(state): State<Arc<RwLock<AppState>>>,
) -> Response {
    let client_ip = extract_client_ip(&headers);
    let path = format!("/ws/{path}");

    // Rate limit WebSocket upgrades per IP (prevents connection flood)
    {
        let s = state.read().await;
        if !s.ws_rate_limiter.check_and_record(client_ip) {
            return (StatusCode::TOO_MANY_REQUESTS, "too many connections").into_response();
        }
    }

    info!(%path, "WebSocket upgrade request");
    ws.on_upgrade(move |socket| ws::ws_handler(socket, path, client_ip, state))
}

fn extract_client_ip(headers: &HeaderMap) -> IpAddr {
    headers
        .get("X-Forwarded-For")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(',').next().map(|s| s.trim()))
        .and_then(|s| s.parse::<IpAddr>().ok())
        .or_else(|| {
            headers
                .get("X-Real-IP")
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.parse::<IpAddr>().ok())
        })
        .unwrap_or(IpAddr::V4(Ipv4Addr::new(0, 0, 0, 0)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use store::SqliteStore;

    /// Simulate creating a client token: generate a UUID, persist it, verify it's valid.
    #[tokio::test]
    async fn test_first_run_creates_valid_client_token() {
        let store = SqliteStore::new("sqlite::memory:").await.unwrap();

        // Simulate the first-run logic from main()
        let reg_token = uuid::Uuid::new_v4().to_string();
        store.create_client_token(&reg_token, "").await.unwrap();

        assert!(store.validate_client_token(&reg_token).await);
    }

    /// Verify that a random string is NOT accepted as a client token
    /// when no tokens have been stored.
    #[tokio::test]
    async fn test_random_token_not_valid_when_empty() {
        let store = SqliteStore::new("sqlite::memory:").await.unwrap();

        let fake_token = uuid::Uuid::new_v4().to_string();
        assert!(!store.validate_client_token(&fake_token).await);
    }

    /// Simulate the fallback logic when no tokens exist:
    /// generate a token, store it, and verify it becomes valid.
    #[tokio::test]
    async fn test_fallback_generates_token_when_none_exist() {
        let store = SqliteStore::new("sqlite::memory:").await.unwrap();

        // Precondition: no tokens
        assert!(!store.has_client_tokens().await);

        // Simulate the fallback: generate + persist a token
        let reg_token = uuid::Uuid::new_v4().to_string();
        store.create_client_token(&reg_token, "").await.unwrap();

        assert!(store.has_client_tokens().await);
        assert!(store.validate_client_token(&reg_token).await);
    }
}
