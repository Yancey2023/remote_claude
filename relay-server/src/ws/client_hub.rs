use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use tokio::sync::{mpsc, RwLock};
use tokio::time::Instant;
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::config::Config;
use crate::models::Device;
use crate::store::SqliteStore;

use super::web_hub::WebHub;

#[derive(Clone)]
pub struct ClientHub {
    /// token → device info + sender channel
    pub online_devices: Arc<RwLock<HashMap<String, OnlineDeviceEntry>>>,
    /// device_id → token (lookup by device id)
    pub device_id_to_token: Arc<RwLock<HashMap<String, String>>>,
}

#[derive(Clone)]
pub struct OnlineDeviceEntry {
    pub id: String,
    pub name: String,
    pub version: String,
    pub tx: mpsc::Sender<String>,
    pub last_pong: Arc<RwLock<Instant>>,
}

impl ClientHub {
    pub fn new() -> Self {
        Self {
            online_devices: Arc::new(RwLock::new(HashMap::new())),
            device_id_to_token: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn register(
        &self,
        token: &str,
        name: &str,
        version: &str,
        device_id: &str,
        tx: mpsc::Sender<String>,
    ) -> OnlineDeviceEntry {
        let id = device_id.to_string();
        let entry = OnlineDeviceEntry {
            id: id.clone(),
            name: name.to_string(),
            version: version.to_string(),
            tx,
            last_pong: Arc::new(RwLock::new(Instant::now())),
        };

        self.online_devices
            .write()
            .await
            .insert(token.to_string(), entry.clone());
        self.device_id_to_token
            .write()
            .await
            .insert(id.clone(), token.to_string());

        info!(device_id = %id, name = %name, "device registered");
        entry
    }

    pub async fn unregister(&self, token: &str) -> Option<OnlineDeviceEntry> {
        let entry = self.online_devices.write().await.remove(token)?;
        self.device_id_to_token
            .write()
            .await
            .remove(&entry.id);
        info!(device_id = %entry.id, "device unregistered");
        Some(entry)
    }

    /// Kick and unregister a device by its device_id.
    /// Returns the device token if found, so callers can await cleanup.
    pub async fn kick_and_unregister(&self, device_id: &str) -> Option<String> {
        let token = self.device_id_to_token.read().await.get(device_id)?.clone();
        // Kick the device connection
        if let Some(entry) = self.online_devices.read().await.get(&token) {
            let _ = entry.tx.send("__kick__".to_string()).await;
        }
        // Remove from maps
        self.online_devices.write().await.remove(&token);
        self.device_id_to_token.write().await.remove(device_id);
        info!(device_id = %device_id, "device kicked and unregistered");
        Some(token)
    }

    pub async fn get_by_token(&self, token: &str) -> Option<OnlineDeviceEntry> {
        self.online_devices.read().await.get(token).cloned()
    }

    pub async fn get_by_device_id(&self, device_id: &str) -> Option<OnlineDeviceEntry> {
        let token = self.device_id_to_token.read().await.get(device_id)?.clone();
        self.online_devices.read().await.get(&token).cloned()
    }

    pub async fn list_online(&self) -> Vec<OnlineDeviceEntry> {
        self.online_devices
            .read()
            .await
            .values()
            .cloned()
            .collect()
    }

    pub async fn send_to_device(&self, device_id: &str, msg: &str) -> Result<(), String> {
        let entry = self.get_by_device_id(device_id)
            .await
            .ok_or_else(|| "device offline".to_string())?;
        entry
            .tx
            .send(msg.to_string())
            .await
            .map_err(|_| "device channel closed".to_string())
    }
}

/// Handle a client (desktop) WebSocket connection.
/// Reads registration, then loops: server sends pings, receives pongs and result_chunks.
pub async fn handle_client_ws(
    ws: WebSocket,
    hub: ClientHub,
    web_hub: WebHub,
    store: SqliteStore,
    config: Config,
) {
    let (mut ws_sender, mut ws_receiver) = ws.split();

    // Wait for register message
    let (token, name, version, device_id) = match receive_register(&mut ws_receiver).await {
        Some(t) => t,
        None => {
            warn!("client disconnected before registration");
            return;
        }
    };

    // Validate registration token against database
    if !store.validate_registration_token(&token).await {
        warn!(token = %token, "invalid registration token, rejecting connection");
        let err = serde_json::json!({
            "type": "error",
            "payload": { "code": "ERR_INVALID_TOKEN", "message": "invalid registration token" }
        });
        let _ = ws_sender.send(Message::Text(err.to_string().into())).await;
        let _ = ws_sender.close().await;
        return;
    }

    // Check if token already registered — kick old connection
    if let Some(old) = hub.get_by_token(&token).await {
        warn!(token = %token, "duplicate registration, replacing old connection");
        let _ = old.tx.send("__kick__".to_string()).await;
        hub.unregister(&token).await;
    }

    let (tx, mut rx) = mpsc::channel::<String>(256);

    let entry = hub.register(&token, &name, &version, &device_id, tx).await;

    // Tell client it's registered
    let registered = serde_json::json!({
        "type": "registered",
        "payload": { "device_id": entry.id }
    });
    if ws_sender.send(Message::Text(registered.to_string().into())).await.is_err() {
        hub.unregister(&token).await;
        return;
    }

    // Update store
    let device = Device::new(entry.id.clone(), name.clone(), version.clone());
    store.upsert_device(device).await;
    store.set_device_online(&entry.id, true).await;
    store.mark_token_used(&token, &entry.id).await;

    let device_id = entry.id.clone();
    let last_pong = entry.last_pong.clone();
    let heartbeat_interval = Duration::from_secs(config.heartbeat_interval_secs);
    let heartbeat_timeout = Duration::from_secs(config.heartbeat_timeout_secs);

    // Main loop: relay messages from server → client and client → server
    let device_id_fwd = device_id.clone();
    let last_pong_fwd = last_pong.clone();
    let web_hub_fwd = web_hub.clone();
    let forward_handle = tokio::spawn(async move {
        let mut ping_timer = tokio::time::interval(heartbeat_interval);
        ping_timer.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

        loop {
            tokio::select! {
                // Periodic heartbeat: check timeout and send ping
                _ = ping_timer.tick() => {
                    let elapsed = last_pong_fwd.read().await.elapsed();
                    if elapsed > heartbeat_timeout {
                        warn!(device_id = %device_id_fwd, elapsed_secs = %elapsed.as_secs(), "heartbeat timeout, marking offline");
                        break;
                    }
                    // Send WebSocket ping; client's tungstenite auto-replies with Pong
                    if ws_sender.send(Message::Ping(vec![].into())).await.is_err() {
                        break;
                    }
                }
                // Messages from web (relayed through server) → client
                Some(msg) = rx.recv() => {
                    if msg == "__kick__" {
                        info!("connection replaced by new registration");
                        let _ = ws_sender.close().await;
                        break;
                    }
                    if ws_sender.send(Message::Text(msg.into())).await.is_err() {
                        break;
                    }
                }
                // Messages from client → server
                msg = ws_receiver.next() => {
                    match msg {
                        Some(Ok(Message::Text(text))) => {
                            *last_pong_fwd.write().await = Instant::now();
                            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&text) {
                                let msg_type = parsed.get("type").and_then(|t| t.as_str());
                                match msg_type {
                                    Some("result_chunk") => {
                                        // Forward result_chunk to the web user who owns this session
                                        if let Some(session_id) = parsed["payload"]["session_id"].as_str() {
                                            if let Some(session) = web_hub_fwd.session_registry.get(session_id).await {
                                                if let Some(chunk) = parsed["payload"]["chunk"].as_str() {
                                                    web_hub_fwd
                                                        .session_registry
                                                        .append_history(session_id, chunk)
                                                        .await;
                                                }
                                                if let Err(e) = web_hub_fwd.send_to_user(&session.user_id, &text).await {
                                                    warn!(session_id = %session_id, user_id = %session.user_id, error = %e, "failed to forward to web user");
                                                }

                                                // PTY process exited: auto-close stale/invalid session.
                                                if parsed["payload"]["done"].as_bool().unwrap_or(false) {
                                                    web_hub_fwd.session_registry.unregister(session_id).await;
                                                    let _ = store.close_session(session_id).await;
                                                    let closed_msg = serde_json::json!({
                                                        "type": "session_closed",
                                                        "payload": { "session_id": session_id }
                                                    });
                                                    let _ = web_hub_fwd
                                                        .send_to_user(&session.user_id, &closed_msg.to_string())
                                                        .await;
                                                }
                                            } else {
                                                warn!(session_id = %session_id, "result_chunk for unknown session");
                                            }
                                        } else {
                                            warn!(msg = %text, "result_chunk missing session_id");
                                        }
                                        continue;
                                    }
                                    Some("pong") | Some("status_update") => {
                                        // heartbeat already updated above; nothing to forward
                                        continue;
                                    }
                                    _ => {}
                                }
                            }
                            tracing::debug!(device_id = %device_id_fwd, msg = %text, "unhandled client message");
                        }
                        Some(Ok(Message::Pong(_))) => {
                            // Client auto-replied to our Ping, update heartbeat
                            *last_pong_fwd.write().await = Instant::now();
                        }
                        Some(Ok(Message::Close(_))) => {
                            info!(device_id = %device_id_fwd, "client disconnected");
                            break;
                        }
                        None => {
                            info!(device_id = %device_id_fwd, "client stream ended");
                            break;
                        }
                        Some(Err(e)) => {
                            error!(device_id = %device_id_fwd, error = %e, "client ws error");
                            break;
                        }
                        _ => {}
                    }
                }
            }
        }

        // Cleanup on exit
        hub.unregister(&token).await;
        store.set_device_online(&device_id_fwd, false).await;
    });

    // Wait for forward handle to finish
    let _ = forward_handle.await;
    info!(device_id = %device_id, "client session ended");
}

async fn receive_register(
    receiver: &mut futures_util::stream::SplitStream<WebSocket>,
) -> Option<(String, String, String, String)> {
    loop {
        let msg = receiver.next().await?;
        match msg {
            Ok(Message::Text(text)) => {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&text) {
                    if parsed.get("type").and_then(|t| t.as_str()) == Some("register") {
                        let payload = parsed.get("payload")?;
                        let token = payload.get("token")?.as_str()?.to_string();
                        let name = payload.get("name")?.as_str()?.to_string();
                        let version = payload.get("version").and_then(|v| v.as_str()).unwrap_or("0.1.0").to_string();
                        let device_id = payload.get("device_id").and_then(|d| d.as_str()).unwrap_or("").to_string();
                        let device_id = if device_id.is_empty() {
                            Uuid::new_v4().to_string()
                        } else {
                            device_id
                        };
                        return Some((token, name, version, device_id));
                    }
                }
                warn!(msg = %text, "unexpected message before registration");
            }
            Ok(Message::Close(_)) => return None,
            Err(e) => {
                error!(error = %e, "ws error during registration");
                return None;
            }
            _ => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::sync::mpsc;

    #[tokio::test]
    async fn test_new_hub_empty() {
        let hub = ClientHub::new();
        assert!(hub.list_online().await.is_empty());
    }

    #[tokio::test]
    async fn test_register_and_lookup() {
        let hub = ClientHub::new();
        let (tx, _rx) = mpsc::channel(256);

        let entry = hub.register("token-1", "pc-1", "1.0", "dev-1", tx).await;
        assert_eq!(entry.id, "dev-1");
        assert_eq!(entry.name, "pc-1");
        assert_eq!(entry.version, "1.0");

        let found = hub.get_by_token("token-1").await;
        assert!(found.is_some());
        assert_eq!(found.as_ref().unwrap().id, entry.id);

        let found_by_id = hub.get_by_device_id(&entry.id).await;
        assert!(found_by_id.is_some());
        assert_eq!(found_by_id.unwrap().id, entry.id);
    }

    #[tokio::test]
    async fn test_get_by_token_not_found() {
        let hub = ClientHub::new();
        let found = hub.get_by_token("nonexistent").await;
        assert!(found.is_none());
    }

    #[tokio::test]
    async fn test_get_by_device_id_not_found() {
        let hub = ClientHub::new();
        let found = hub.get_by_device_id("nonexistent").await;
        assert!(found.is_none());
    }

    #[tokio::test]
    async fn test_unregister_removes_entry() {
        let hub = ClientHub::new();
        let (tx, _rx) = mpsc::channel(256);

        hub.register("token-2", "pc-2", "1.0", "dev-2", tx).await;
        assert_eq!(hub.list_online().await.len(), 1);

        let removed = hub.unregister("token-2").await;
        assert!(removed.is_some());
        assert_eq!(removed.unwrap().name, "pc-2");

        assert!(hub.list_online().await.is_empty());
        assert!(hub.get_by_token("token-2").await.is_none());
    }

    #[tokio::test]
    async fn test_unregister_nonexistent() {
        let hub = ClientHub::new();
        let removed = hub.unregister("nonexistent").await;
        assert!(removed.is_none());
    }

    #[tokio::test]
    async fn test_list_online_returns_all() {
        let hub = ClientHub::new();
        let (tx1, _rx1) = mpsc::channel(256);
        let (tx2, _rx2) = mpsc::channel(256);
        let (tx3, _rx3) = mpsc::channel(256);

        hub.register("token-a", "pc-a", "1.0", "dev-a", tx1).await;
        hub.register("token-b", "pc-b", "2.0", "dev-b", tx2).await;
        hub.register("token-c", "pc-c", "3.0", "dev-c", tx3).await;

        let list = hub.list_online().await;
        assert_eq!(list.len(), 3);

        let names: std::collections::HashSet<&str> = list.iter().map(|e| e.name.as_str()).collect();
        assert!(names.contains("pc-a"));
        assert!(names.contains("pc-b"));
        assert!(names.contains("pc-c"));
    }

    #[tokio::test]
    async fn test_send_to_device_offline() {
        let hub = ClientHub::new();
        let result = hub.send_to_device("unknown-device", "hello").await;
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "device offline");
    }

    #[tokio::test]
    async fn test_send_to_device_success() {
        let hub = ClientHub::new();
        let (tx, mut rx) = mpsc::channel(256);

        let entry = hub.register("token-send", "pc-send", "1.0", "dev-send", tx).await;

        let result = hub.send_to_device(&entry.id, "test message").await;
        assert!(result.is_ok());

        let received = rx.recv().await;
        assert!(received.is_some());
        assert_eq!(received.unwrap(), "test message");
    }

    #[tokio::test]
    async fn test_registration_uses_provided_device_id() {
        let hub = ClientHub::new();
        let (tx, _rx) = mpsc::channel(256);

        let entry = hub.register("token-1", "pc-1", "1.0", "my-fixed-device-id", tx).await;
        assert_eq!(entry.id, "my-fixed-device-id");
    }
}
