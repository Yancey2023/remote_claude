use axum::{routing::{delete, get, post}, extract::Path, Json, Router};
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::auth::extractor::AuthUser;
use crate::error::AppError;
use crate::ws::AppState;

pub fn router() -> Router<Arc<RwLock<AppState>>> {
    Router::new()
        .route("/", post(generate_token).get(list_tokens))
        .route("/{token}", delete(revoke_token))
}

#[derive(Serialize)]
pub struct TokenResponse {
    pub token: String,
    pub created_at: i64,
}

/// Create a registration token bound to the authenticated user.
async fn generate_token(
    state: axum::extract::State<Arc<RwLock<AppState>>>,
    user: AuthUser,
) -> Result<Json<TokenResponse>, AppError> {
    let token = Uuid::new_v4().to_string();

    let state = state.read().await;
    state
        .store
        .create_client_token(&token, &user.user_id)
        .await
        .map_err(|e| AppError::Internal(e))?;

    Ok(Json(TokenResponse {
        token,
        created_at: chrono::Utc::now().timestamp(),
    }))
}

/// List registration tokens owned by the authenticated user.
async fn list_tokens(
    state: axum::extract::State<Arc<RwLock<AppState>>>,
    user: AuthUser,
) -> Json<Vec<TokenResponse>> {
    let state = state.read().await;
    let tokens = state.store.list_client_tokens(&user.user_id).await;
    Json(
        tokens
            .into_iter()
            .map(|t| TokenResponse {
                token: t.token,
                created_at: t.created_at,
            })
            .collect(),
    )
}

/// Revoke a registration token owned by the authenticated user.
async fn revoke_token(
    state: axum::extract::State<Arc<RwLock<AppState>>>,
    user: AuthUser,
    Path(token): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = state.read().await;
    state
        .store
        .delete_client_token(&token, &user.user_id)
        .await
        .map_err(|e| AppError::NotFound(e))?;

    Ok(Json(serde_json::json!({ "message": "token revoked" })))
}
