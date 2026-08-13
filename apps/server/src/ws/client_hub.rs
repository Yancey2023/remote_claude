use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::Arc;
use std::time::Duration;

use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use tokio::sync::{mpsc, RwLock};
use tokio::time::{timeout, Instant};
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::api::rate_limit::LoginRateLimiter;
use crate::config::Config;
use crate::models::Device;
use crate::store::SqliteStore;

use super::web_hub::WebHub;

/// Maximum age for pending directory listing requests before cleanup (30 seconds)
const DIR_LIST_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(30);

#[derive(Clone)]
pub struct ClientHub {
    /// Single lock protecting both maps. Both indices are always mutated together,
    /// so keeping them behind one lock makes lookups/removals atomic and avoids
    /// lock-ordering deadlocks between the two maps.
    inner: Arc<RwLock<HubInner>>,
}

#[derive(Default)]
struct HubInner {
    /// device_id → device info + sender channel (primary map for hot-path lookups)
    connections: HashMap<String, OnlineDeviceEntry>,
    /// token → device_id (reverse index for registration/unregister)
    token_to_device_id: HashMap<String, String>,
}

#[derive(Clone)]
pub struct OnlineDeviceEntry {
    pub id: String,
    pub token: String,
    /// Unique identifier for this specific WebSocket connection. Used to make
    /// unregistration conditional so a stale connection's cleanup can never
    /// remove a newer connection that has already taken over.
    pub connection_id: String,
    #[allow(dead_code)]
    pub name: String,
    #[allow(dead_code)]
    pub version: String,
    pub tx: mpsc::Sender<String>,
    pub last_pong: Arc<RwLock<Instant>>,
}

impl ClientHub {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(RwLock::new(HubInner::default())),
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
        let token_owned = token.to_string();
        let connection_id = Uuid::new_v4().to_string();
        let entry = OnlineDeviceEntry {
            id: id.clone(),
            token: token_owned.clone(),
            connection_id: connection_id.clone(),
            name: name.to_string(),
            version: version.to_string(),
            tx,
            last_pong: Arc::new(RwLock::new(Instant::now())),
        };

        let mut inner = self.inner.write().await;
        inner.connections.insert(id.clone(), entry.clone());
        inner.token_to_device_id.insert(token_owned, id.clone());

        info!(device_id = %id, name = %name, connection_id = %connection_id, "device registered");
        entry
    }

    /// Unregister a connection ONLY if it is still the current connection for its
    /// device/token.
    ///
    /// Returns the removed entry when this connection was still the active one, and
    /// `None` when a newer connection has already taken over. This is the key guard
    /// against the reconnect race: a stale connection's delayed cleanup must never
    /// evict the freshly-registered connection, write an offline state, or notify
    /// the frontend that the device went offline.
    pub async fn unregister_if_current(
        &self,
        token: &str,
        connection_id: &str,
    ) -> Option<OnlineDeviceEntry> {
        let mut inner = self.inner.write().await;
        let device_id = inner.token_to_device_id.get(token)?.clone();
        let current = inner.connections.get(&device_id)?;
        if current.connection_id != connection_id {
            warn!(
                device_id = %device_id,
                connection_id = %connection_id,
                current_connection_id = %current.connection_id,
                "stale connection cleanup skipped; a newer connection already owns the device"
            );
            return None;
        }
        inner.token_to_device_id.remove(token);
        let entry = inner.connections.remove(&device_id);
        if let Some(ref e) = entry {
            info!(device_id = %e.id, connection_id = %connection_id, "device unregistered");
        }
        entry
    }

    /// Kick and unregister a device by its device_id.
    /// Returns the device token if found, so callers can await cleanup.
    pub async fn kick_and_unregister(&self, device_id: &str) -> Option<String> {
        let mut inner = self.inner.write().await;
        let entry = inner.connections.get(device_id)?;
        let token = entry.token.clone();
        // Use try_send so a blocked receiver can never stall the hub lock; the
        // connection will be reaped by heartbeat timeout otherwise.
        let _ = entry.tx.try_send("__kick__".to_string());
        inner.connections.remove(device_id);
        inner.token_to_device_id.remove(&token);
        info!(device_id = %device_id, "device kicked and unregistered");
        Some(token)
    }

    pub async fn get_by_token(&self, token: &str) -> Option<OnlineDeviceEntry> {
        let inner = self.inner.read().await;
        let device_id = inner.token_to_device_id.get(token)?;
        inner.connections.get(device_id).cloned()
    }

    pub async fn get_by_device_id(&self, device_id: &str) -> Option<OnlineDeviceEntry> {
        self.inner.read().await.connections.get(device_id).cloned()
    }

    pub async fn list_online(&self) -> Vec<OnlineDeviceEntry> {
        self.inner.read().await.connections.values().cloned().collect()
    }

    pub async fn is_device_online(&self, device_id: &str) -> bool {
        self.inner.read().await.connections.contains_key(device_id)
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
    register_rate_limiter: Arc<LoginRateLimiter>,
    client_ip: IpAddr,
    pending_dir_requests: Arc<std::sync::Mutex<HashMap<String, String>>>,
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

    // Rate limit registration attempts per IP
    if !register_rate_limiter.check_and_record(client_ip) {
        warn!(ip = %client_ip, "registration rate limit exceeded");
        let err = serde_json::json!({
            "type": "error",
            "payload": { "code": "ERR_RATE_LIMITED", "message": "too many registration attempts" }
        });
        let _ = ws_sender.send(Message::Text(err.to_string().into())).await;
        let _ = ws_sender.close().await;
        return;
    }

    // Validate registration token against database
    let client_token = match store.get_client_token(&token).await {
        Some(t) => {
            // If token is already bound to a device_id, verify it matches the connecting device.
            // This prevents token reuse on a different device.
            if let Some(ref bound_device_id) = t.device_id {
                if bound_device_id != &device_id {
                    warn!(token = %token, expected = %bound_device_id, got = %device_id, "token bound to different device, rejecting");
                    let err = serde_json::json!({
                        "type": "error",
                        "payload": { "code": "ERR_TOKEN_BOUND", "message": "token already bound to a different device" }
                    });
                    let _ = ws_sender.send(Message::Text(err.to_string().into())).await;
                    let _ = ws_sender.close().await;
                    return;
                }
            }
            t
        }
        None => {
            warn!(token = %token, "invalid registration token, rejecting connection");
            let err = serde_json::json!({
                "type": "error",
                "payload": { "code": "ERR_INVALID_TOKEN", "message": "invalid registration token" }
            });
            let _ = ws_sender.send(Message::Text(err.to_string().into())).await;
            let _ = ws_sender.close().await;
            return;
        }
    };

    // Check if token already registered — kick old connection.
    // Only remove the old connection if it is still the current one; if its cleanup
    // already ran (or it was already superseded), `register` below simply overwrites.
    if let Some(old) = hub.get_by_token(&token).await {
        warn!(token = %token, "duplicate registration, replacing old connection");
        let _ = old.tx.send("__kick__".to_string()).await;
        hub.unregister_if_current(&token, &old.connection_id).await;
    }

    let (tx, mut rx) = mpsc::channel::<String>(256);

    let entry = hub.register(&token, &name, &version, &device_id, tx).await;

    // Tell client it's registered
    let registered = serde_json::json!({
        "type": "registered",
        "payload": { "device_id": entry.id }
    });
    if ws_sender.send(Message::Text(registered.to_string().into())).await.is_err() {
        hub.unregister_if_current(&token, &entry.connection_id).await;
        return;
    }

    // Update store — bind device to the token owner
    let device = Device::new(entry.id.clone(), name.clone(), version.clone(), client_token.user_id.clone());
    store.upsert_device(device).await;
    store.set_device_online(&entry.id, true).await;

    // Bind token to device_id to prevent reuse on different devices
    let _ = store.bind_client_token_device(&token, &entry.id).await;

    // Notify web UI that device is online
    let online_msg = format!(r#"{{"type":"device_status","payload":{{"device_id":"{}","online":true}}}}"#, entry.id);
    let _ = web_hub.send_to_user(&client_token.user_id, &online_msg).await;

    let device_id = entry.id.clone();
    let last_pong = entry.last_pong.clone();
    let heartbeat_interval = Duration::from_secs(config.heartbeat_interval_secs);
    let heartbeat_timeout = Duration::from_secs(config.heartbeat_timeout_secs);

    // Main loop: relay messages from server → client and client → server
    let device_id_fwd = device_id.clone();
    let connection_id_fwd = entry.connection_id.clone();
    let last_pong_fwd = last_pong.clone();
    let web_hub_fwd = web_hub.clone();
    let pending_reqs_fwd = pending_dir_requests.clone();
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
                            if text.len() > 1_048_576 {
                                warn!(device_id = %device_id_fwd, "client message too large ({} bytes)", text.len());
                                continue;
                            }
                            *last_pong_fwd.write().await = Instant::now();
                            // Quick check: pong/status_update need no JSON parsing
                            if text.len() <= 64 && (text.contains("\"pong\"") || text.contains("\"status_update\"")) {
                                continue;
                            }
                            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&text) {
                                let msg_type = parsed.get("type").and_then(|t| t.as_str());
                                if msg_type == Some("result_chunk") {
                                    // Forward result_chunk to the web user who owns this session
                                    let payload = parsed.get("payload");
                                    let session_id = payload.and_then(|p| p.get("session_id")).and_then(|s| s.as_str());
                                    let done = payload.and_then(|p| p.get("done")).and_then(|d| d.as_bool()).unwrap_or(false);
                                    if let Some(sid) = session_id {
                                        if let Some(session) = web_hub_fwd.session_registry.get(sid).await {
                                            if let Some(chunk) = payload.and_then(|p| p.get("chunk")).and_then(|c| c.as_str()) {
                                                web_hub_fwd
                                                    .session_registry
                                                    .append_history(sid, chunk)
                                                    .await;
                                            }
                                            if let Err(e) = web_hub_fwd.send_to_user(&session.user_id, &text).await {
                                                warn!(session_id = %sid, user_id = %session.user_id, error = %e, "failed to forward to web user");
                                            }
                                            // PTY process exited: auto-close stale/invalid session.
                                            if done {
                                                web_hub_fwd.session_registry.unregister(sid).await;
                                                let _ = store.close_session(sid).await;
                                                let closed_msg = format!(
                                                    r#"{{"type":"session_closed","payload":{{"session_id":"{sid}"}}}}"#
                                                );
                                                let _ = web_hub_fwd
                                                    .send_to_user(&session.user_id, &closed_msg)
                                                    .await;
                                            }
                                        } else {
                                            warn!(session_id = %sid, "result_chunk for unknown session");
                                        }
                                    } else {
                                        warn!(msg = %text, "result_chunk missing session_id");
                                    }
                                    continue;
                                }
                                if matches!(msg_type, Some("pong") | Some("status_update")) {
                                    // heartbeat already updated above; nothing to forward
                                    continue;
                                }
                                if msg_type == Some("directory_list") {
                                    if let Some(payload) = parsed.get("payload") {
                                        if let Some(request_id) = payload.get("request_id").and_then(|r| r.as_str()) {
                                            if let Some(user_id) = pending_reqs_fwd
                                                .lock()
                                                .ok()
                                                .and_then(|mut map| map.remove(request_id))
                                            {
                                                if let Err(e) = web_hub_fwd.send_to_user(&user_id, &text).await {
                                                    warn!(request_id = %request_id, user_id = %user_id, error = %e, "failed to forward directory_list");
                                                }
                                            }
                                        }
                                    }
                                    continue;
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

        use std::collections::HashSet;

        // Cleanup on exit. A reconnecting client may have already registered a NEW
        // connection for the same device/token by the time this stale task unwinds.
        // Only take the device offline if THIS connection is still the current one;
        // otherwise the newer connection must be left untouched and the device must
        // stay online.
        match hub.unregister_if_current(&token, &connection_id_fwd).await {
            Some(_) => {
                // We removed our own connection. Double-check nobody re-registered
                // between our unregister and now before pushing the offline state.
                if hub.is_device_online(&device_id_fwd).await {
                    warn!(
                        device_id = %device_id_fwd,
                        connection_id = %connection_id_fwd,
                        "old connection removed but a newer connection is active; skipping offline marking"
                    );
                } else {
                    info!(device_id = %device_id_fwd, connection_id = %connection_id_fwd, "device going offline (last connection closed)");
                    let sessions = web_hub_fwd.session_registry.list_by_device(&device_id_fwd).await;
                    let notified: HashSet<&str> = sessions.iter().map(|s| s.user_id.as_str()).collect();
                    let status_msg = format!(r#"{{"type":"device_status","payload":{{"device_id":"{}","online":false}}}}"#, device_id_fwd);
                    for user_id in notified {
                        let _ = web_hub_fwd.send_to_user(user_id, &status_msg).await;
                    }
                    store.set_device_online(&device_id_fwd, false).await;
                }
            }
            None => {
                info!(
                    device_id = %device_id_fwd,
                    connection_id = %connection_id_fwd,
                    "stale connection cleanup skipped; superseded by a newer connection"
                );
            }
        }
    });

    // Wait for forward handle to finish
    let _ = forward_handle.await;
    info!(device_id = %device_id, "client session ended");
}

async fn receive_register(
    receiver: &mut futures_util::stream::SplitStream<WebSocket>,
) -> Option<(String, String, String, String)> {
    loop {
        let msg = timeout(Duration::from_secs(10), receiver.next()).await.ok()??;
        match msg {
            Ok(Message::Text(text)) => {
                if text.len() > 1_048_576 {
                    warn!("register message too large ({} bytes)", text.len());
                    return None;
                }
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

        let entry = hub.register("token-2", "pc-2", "1.0", "dev-2", tx).await;
        assert_eq!(hub.list_online().await.len(), 1);

        let removed = hub
            .unregister_if_current("token-2", &entry.connection_id)
            .await;
        assert!(removed.is_some());
        assert_eq!(removed.unwrap().name, "pc-2");

        assert!(hub.list_online().await.is_empty());
        assert!(hub.get_by_token("token-2").await.is_none());
    }

    #[tokio::test]
    async fn test_unregister_nonexistent() {
        let hub = ClientHub::new();
        let removed = hub
            .unregister_if_current("nonexistent", "whatever")
            .await;
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
    async fn test_is_device_online() {
        let hub = ClientHub::new();
        let (tx, _rx) = mpsc::channel(256);

        assert!(!hub.is_device_online("dev-1").await);
        hub.register("token-1", "pc-1", "1.0", "dev-1", tx).await;
        assert!(hub.is_device_online("dev-1").await);
    }

    #[tokio::test]
    async fn test_registration_uses_provided_device_id() {
        let hub = ClientHub::new();
        let (tx, _rx) = mpsc::channel(256);

        let entry = hub.register("token-1", "pc-1", "1.0", "my-fixed-device-id", tx).await;
        assert_eq!(entry.id, "my-fixed-device-id");
    }

    #[tokio::test]
    async fn test_connection_ids_are_unique() {
        let hub = ClientHub::new();
        let (tx1, _rx1) = mpsc::channel(256);
        let (tx2, _rx2) = mpsc::channel(256);

        let a = hub.register("token-1", "pc-1", "1.0", "dev-1", tx1).await;
        let b = hub.register("token-2", "pc-2", "1.0", "dev-2", tx2).await;

        assert!(!a.connection_id.is_empty());
        assert!(!b.connection_id.is_empty());
        assert_ne!(a.connection_id, b.connection_id);
    }

    /// The reconnect race: old connection A drops (TLS EOF / network / proxy), the
    /// client immediately reconnects as connection B for the same token/device, and
    /// only afterwards does A's delayed cleanup run. A's stale cleanup must NOT evict
    /// B, must NOT mark the device offline, and B must stay reachable for commands.
    #[tokio::test]
    async fn test_stale_cleanup_does_not_affect_new_connection() {
        let hub = ClientHub::new();

        // Connection A registers first.
        let (tx_a, mut rx_a) = mpsc::channel(256);
        let entry_a = hub.register("token-race", "pc", "1.0", "dev-race", tx_a).await;

        // Connection B reconnects (same token + device_id) BEFORE A's cleanup runs.
        let (tx_b, mut rx_b) = mpsc::channel(256);
        let entry_b = hub.register("token-race", "pc", "1.0", "dev-race", tx_b).await;
        assert_ne!(entry_a.connection_id, entry_b.connection_id);
        assert!(hub.is_device_online("dev-race").await);

        // A's delayed cleanup runs with A's stale connection_id.
        let removed = hub
            .unregister_if_current("token-race", &entry_a.connection_id)
            .await;
        assert!(removed.is_none(), "stale cleanup must not remove the new connection");

        // B is still online and can receive commands routed by device_id.
        assert!(hub.is_device_online("dev-race").await);
        assert!(hub.get_by_token("token-race").await.is_some());
        assert!(hub.send_to_device("dev-race", "ls -la").await.is_ok());
        assert_eq!(rx_b.recv().await.as_deref(), Some("ls -la"));

        // A's own channel is gone (its sender was dropped when B replaced it).
        assert!(rx_a.try_recv().is_err());
    }

    /// If no newer connection took over, the current connection MUST be able to
    /// unregister itself (e.g. genuine device shutdown) so the device goes offline.
    #[tokio::test]
    async fn test_current_connection_can_unregister() {
        let hub = ClientHub::new();
        let (tx, _rx) = mpsc::channel(256);

        let entry = hub.register("token-solo", "pc", "1.0", "dev-solo", tx).await;
        assert!(hub.is_device_online("dev-solo").await);

        let removed = hub
            .unregister_if_current("token-solo", &entry.connection_id)
            .await;
        assert!(removed.is_some(), "the current connection must be able to unregister");
        assert!(!hub.is_device_online("dev-solo").await);
        assert!(hub.get_by_token("token-solo").await.is_none());
    }

    /// Cleanup from an already-superseded connection for a DIFFERENT token/device
    /// must also be a no-op (defensive: stale connection id never matches anything).
    #[tokio::test]
    async fn test_unregister_if_current_wrong_connection_id() {
        let hub = ClientHub::new();
        let (tx, _rx) = mpsc::channel(256);

        let entry = hub.register("token-x", "pc", "1.0", "dev-x", tx).await;
        let removed = hub
            .unregister_if_current("token-x", "some-other-connection-id")
            .await;
        assert!(removed.is_none());
        assert!(hub.is_device_online("dev-x").await);
        assert_eq!(entry.connection_id, hub.get_by_token("token-x").await.unwrap().connection_id);
    }

    #[tokio::test]
    async fn test_kick_and_unregister() {
        let hub = ClientHub::new();
        let (tx, _rx) = mpsc::channel(256);

        hub.register("token-kick", "pc", "1.0", "dev-kick", tx).await;
        assert!(hub.is_device_online("dev-kick").await);

        let token = hub.kick_and_unregister("dev-kick").await;
        assert_eq!(token.as_deref(), Some("token-kick"));
        assert!(!hub.is_device_online("dev-kick").await);
        assert!(hub.get_by_token("token-kick").await.is_none());
    }
}
