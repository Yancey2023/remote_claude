mod api;
mod auth;
mod config;
mod error;
mod models;
mod store;
mod ws;

use std::sync::Arc;
use tokio::sync::RwLock;

use axum::extract::ws::WebSocketUpgrade;
use axum::extract::{Path, State};
use axum::response::IntoResponse;
use axum::routing::get;
use tower_http::cors::{Any, CorsLayer};
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

    let config = config::Config::from_env();
    let store = store::SqliteStore::new(&config.database_url)
        .await
        .expect("failed to initialize database");
    let client_hub = ClientHub::new();
    let web_hub = WebHub::new();

    let state = Arc::new(RwLock::new(AppState {
        config: config.clone(),
        client_hub,
        web_hub,
        store,
    }));

    // Build router
    let app = api::router()
        .route("/ws/{*path}", get(ws_upgrade))
        .route("/", get(|| async { "Relay Server" }))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
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
    State(state): State<Arc<RwLock<AppState>>>,
) -> impl IntoResponse {
    let path = format!("/{}", path);
    info!(%path, "WebSocket upgrade request");
    ws.on_upgrade(move |socket| ws::ws_handler(socket, path, state))
}
