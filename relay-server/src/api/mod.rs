pub mod admin;
pub mod auth;
pub mod devices;
pub mod rate_limit;
pub mod sessions;
pub mod tokens;

use axum::{routing::get, Router};
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::ws::AppState;

pub fn router() -> Router<Arc<RwLock<AppState>>> {
    Router::new()
        .route("/api/health", get(health))
        .nest("/api/auth", auth::router())
        .nest("/api/devices", devices::router())
        .nest("/api/sessions", sessions::router())
        .nest("/api/admin", admin::router())
        .nest("/api/tokens", tokens::router())
}

async fn health() -> &'static str {
    "ok"
}
