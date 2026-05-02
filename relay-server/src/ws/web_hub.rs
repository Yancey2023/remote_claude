use std::collections::HashMap;
use std::sync::Arc;

use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use tokio::sync::{mpsc, RwLock};
use tracing::{error, info, warn};

use crate::auth::jwt::verify_token;
use crate::config::Config;
use crate::store::MemoryStore;

use super::client_hub::ClientHub;
use super::session::{SessionActor, SessionRegistry};

/// Represents a connected web UI client with an authenticated user.
pub struct WebSession {
    pub user_id: String,
    pub username: String,
    pub tx: mpsc::Sender<String>,
}

/// Manages all web UI WebSocket connections.
#[derive(Clone)]
pub struct WebHub {
    pub sessions: Arc<RwLock<HashMap<String, WebSession>>>,
    pub session_registry: SessionRegistry,
}

impl WebHub {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            session_registry: SessionRegistry::new(),
        }
    }

    pub async fn register(&self, user_id: String, username: String) -> mpsc::Receiver<String> {
        let (tx, rx) = mpsc::channel(256);
        let session = WebSession {
            user_id,
            username,
            tx,
        };
        self.sessions
            .write()
            .await
            .insert(session.user_id.clone(), session);
        rx
    }

    pub async fn unregister(&self, user_id: &str) {
        self.sessions.write().await.remove(user_id);
    }

    pub async fn send_to_user(&self, user_id: &str, msg: &str) -> Result<(), String> {
        let sessions = self.sessions.read().await;
        let session = sessions
            .get(user_id)
            .ok_or_else(|| "user not connected".to_string())?;
        session
            .tx
            .send(msg.to_string())
            .await
            .map_err(|_| "web channel closed".to_string())
    }
}

/// Handle a web UI WebSocket connection.
pub async fn handle_web_ws(
    ws: WebSocket,
    hub: WebHub,
    client_hub: ClientHub,
    store: MemoryStore,
    config: Config,
) {
    let (mut ws_sender, mut ws_receiver) = ws.split();

    let (user_id, username) = match receive_auth(&mut ws_receiver, &config).await {
        Some(auth) => auth,
        None => {
            warn!("web ws disconnected before auth");
            return;
        }
    };

    info!(user_id = %user_id, username = %username, "web UI connected");

    let rx = hub.register(user_id.clone(), username.clone()).await;
    let mut rx = rx;

    let hub_clone = hub.clone();
    let client_hub_clone = client_hub.clone();
    let store_clone = store.clone();
    let user_id_clone = user_id.clone();

    let recv_handle = tokio::spawn(async move {
        loop {
            tokio::select! {
                Some(msg) = rx.recv() => {
                    if ws_sender.send(Message::Text(msg.into())).await.is_err() {
                        break;
                    }
                }
                msg = ws_receiver.next() => {
                    match msg {
                        Some(Ok(Message::Text(text))) => {
                            if let Err(e) = handle_web_message(
                                &text, &user_id_clone, &hub_clone, &client_hub_clone, &store_clone
                            ).await {
                                warn!(error = %e, "handling web message");
                            }
                        }
                        Some(Ok(Message::Close(_))) | None => break,
                        Some(Err(e)) => {
                            error!(error = %e, "web ws error");
                            break;
                        }
                        _ => {}
                    }
                }
            }
        }
    });

    recv_handle.await.ok();
    hub.unregister(&user_id).await;
    info!(user_id = %user_id, "web UI disconnected");
}

async fn receive_auth(
    receiver: &mut futures_util::stream::SplitStream<WebSocket>,
    config: &Config,
) -> Option<(String, String)> {
    loop {
        match receiver.next().await? {
            Ok(Message::Text(text)) => {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&text) {
                    if parsed.get("type").and_then(|t| t.as_str()) == Some("auth") {
                        let payload = parsed.get("payload")?;
                        let token = payload.get("token")?.as_str()?;
                        match verify_token(token, &config.jwt_secret) {
                            Ok(claims) => return Some((claims.sub, claims.username)),
                            Err(e) => {
                                warn!(error = %e, "web ws auth failed");
                            }
                        }
                    }
                }
            }
            Ok(Message::Close(_)) | Err(_) => return None,
            _ => {}
        }
    }
}

async fn handle_web_message(
    text: &str,
    user_id: &str,
    hub: &WebHub,
    client_hub: &ClientHub,
    _store: &MemoryStore,
) -> Result<(), String> {
    let parsed: serde_json::Value =
        serde_json::from_str(text).map_err(|e| format!("invalid JSON: {}", e))?;

    let msg_type = parsed
        .get("type")
        .and_then(|t| t.as_str())
        .ok_or("missing type")?;

    match msg_type {
        "command" => {
            let payload = parsed.get("payload").ok_or("missing payload")?;
            let session_id = payload
                .get("session_id")
                .and_then(|s| s.as_str())
                .ok_or("missing session_id")?;
            let command = payload
                .get("command")
                .and_then(|c| c.as_str())
                .ok_or("missing command")?;

            let session = hub
                .session_registry
                .get(session_id)
                .await
                .ok_or("session not found")?;

            if session.user_id != user_id {
                return Err("not your session".to_string());
            }

            let msg = serde_json::json!({
                "type": "command",
                "payload": {
                    "session_id": session_id,
                    "command": command
                }
            });

            client_hub
                .send_to_device(&session.device_id, &msg.to_string())
                .await?;
        }
        "create_session" => {
            let payload = parsed.get("payload").ok_or("missing payload")?;
            let device_id = payload
                .get("device_id")
                .and_then(|d| d.as_str())
                .ok_or("missing device_id")?;

            let device = client_hub
                .get_by_device_id(device_id)
                .await
                .ok_or("device not found or offline")?;

            let web_tx = {
                let sessions = hub.sessions.read().await;
                sessions
                    .get(user_id)
                    .map(|s| s.tx.clone())
                    .ok_or("user not connected")?
            };

            let session =
                SessionActor::new(device.id.clone(), user_id.to_string(), web_tx);

            let session_id = hub.session_registry.register(session).await;

            // Notify the web about the new session
            let msg = serde_json::json!({
                "type": "session_created",
                "payload": {
                    "session_id": session_id,
                    "device_id": device_id
                }
            });

            hub.send_to_user(user_id, &msg.to_string()).await?;
        }
        "close_session" => {
            let payload = parsed.get("payload").ok_or("missing payload")?;
            let session_id = payload
                .get("session_id")
                .and_then(|s| s.as_str())
                .ok_or("missing session_id")?;

            hub.session_registry.unregister(session_id).await;
        }
        _ => {
            warn!(type = %msg_type, "unknown web message type");
        }
    }

    Ok(())
}
