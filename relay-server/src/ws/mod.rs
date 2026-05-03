pub mod client_hub;
pub mod session;
pub mod web_hub;

use axum::extract::ws::WebSocket;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::Instrument;

use crate::api::rate_limit::LoginRateLimiter;
use crate::config::Config;

pub struct AppState {
    pub config: Config,
    pub client_hub: client_hub::ClientHub,
    pub web_hub: web_hub::WebHub,
    pub store: crate::store::SqliteStore,
    pub login_rate_limiter: LoginRateLimiter,
}

/// Handle a raw WebSocket connection, routing by URL path.
pub async fn ws_handler(
    ws: WebSocket,
    path: String,
    state: Arc<RwLock<AppState>>,
) {
    let s = state.read().await;
    match path.as_str() {
        "/ws/client" => {
            let client_hub = s.client_hub.clone();
            let web_hub = s.web_hub.clone();
            let store = s.store.clone();
            let config = s.config.clone();
            drop(s);
            client_hub::handle_client_ws(ws, client_hub, web_hub, store, config)
                .instrument(tracing::info_span!("client_ws"))
                .await;
        }
        "/ws/web" => {
            let web_hub = s.web_hub.clone();
            let client_hub = s.client_hub.clone();
            let store = s.store.clone();
            let config = s.config.clone();
            drop(s);
            web_hub::handle_web_ws(ws, web_hub, client_hub, store, config)
                .instrument(tracing::info_span!("web_ws"))
                .await;
        }
        _ => {
            tracing::warn!("unknown ws path: {}", path);
        }
    }
}
