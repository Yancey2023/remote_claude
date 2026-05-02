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
    pub token: String,
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
        tx: mpsc::Sender<String>,
    ) -> OnlineDeviceEntry {
        let id = Uuid::new_v4().to_string();
        let entry = OnlineDeviceEntry {
            id: id.clone(),
            token: token.to_string(),
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
    store: SqliteStore,
    config: Config,
) {
    let (mut ws_sender, mut ws_receiver) = ws.split();

    // Wait for register message
    let (token, name, version) = match receive_register(&mut ws_receiver).await {
        Some(t) => t,
        None => {
            warn!("client disconnected before registration");
            return;
        }
    };

    // Check if token already registered — kick old connection
    if let Some(old) = hub.get_by_token(&token).await {
        warn!(token = %token, "duplicate registration, replacing old connection");
        let _ = old.tx.send("__kick__".to_string()).await;
        hub.unregister(&token).await;
    }

    let (tx, mut rx) = mpsc::channel::<String>(256);

    let entry = hub.register(&token, &name, &version, tx).await;

    // Tell client it's registered
    let registered = serde_json::json!({
        "type": "registered",
        "payload": { "device_id": entry.id }
    });
    if ws_sender.send(Message::Text(registered.to_string())).await.is_err() {
        hub.unregister(&token).await;
        return;
    }

    // Update store
    let device = Device::new(entry.id.clone(), name.clone(), version.clone());
    store.upsert_device(device).await;
    store.set_device_online(&entry.id, true).await;

    let device_id = entry.id.clone();
    let last_pong = entry.last_pong.clone();
    let heartbeat_interval = Duration::from_secs(config.heartbeat_interval_secs);
    let heartbeat_timeout = Duration::from_secs(config.heartbeat_timeout_secs);

    // Clone for the heartbeat task
    let device_id_hb = device_id.clone();
    let last_pong_hb = last_pong.clone();
    let hub_hb = hub.clone();
    let token_hb = token.clone();
    let store_hb = store.clone();

    // Spawn heartbeat checker
    let heartbeat_handle = tokio::spawn(async move {
        loop {
            tokio::time::sleep(heartbeat_interval).await;
            let elapsed = last_pong_hb.read().await.elapsed();
            if elapsed > heartbeat_timeout {
                warn!(device_id = %device_id_hb, "heartbeat timeout, marking offline");
                hub_hb.unregister(&token_hb).await;
                store_hb.set_device_online(&device_id_hb, false).await;
                break;
            }
        }
    });

    // Main loop: relay messages from server → client and client → server
    let device_id_fwd = device_id.clone();
    let last_pong_fwd = last_pong.clone();
    let forward_handle = tokio::spawn(async move {
        loop {
            tokio::select! {
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
                            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&text) {
                                if parsed.get("type").and_then(|t| t.as_str()) == Some("pong") {
                                    *last_pong_fwd.write().await = Instant::now();
                                    continue;
                                }
                            }
                            tracing::debug!(device_id = %device_id_fwd, msg = %text, "unhandled client message");
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
    });

    // Wait for either handle to finish
    tokio::select! {
        _ = heartbeat_handle => {},
        _ = forward_handle => {},
    }

    hub.unregister(&token).await;
    store.set_device_online(&device_id, false).await;
    info!(device_id = %device_id, "client session ended");
}

async fn receive_register(
    receiver: &mut futures_util::stream::SplitStream<WebSocket>,
) -> Option<(String, String, String)> {
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
                        return Some((token, name, version));
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
