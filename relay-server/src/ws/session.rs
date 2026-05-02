use tokio::sync::{mpsc, RwLock};
use std::sync::Arc;
use uuid::Uuid;

use super::client_hub::ClientHub;

/// Bidirectional session between a web client and a device client.
#[derive(Clone)]
pub struct SessionActor {
    pub id: String,
    pub device_id: String,
    pub user_id: String,
    pub web_tx: mpsc::Sender<String>,
}

impl SessionActor {
    pub fn new(device_id: String, user_id: String, web_tx: mpsc::Sender<String>) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            device_id,
            user_id,
            web_tx,
        }
    }

    pub fn id(&self) -> &str {
        &self.id
    }

    /// Forward a command from web to the device
    pub async fn send_command(&self, hub: &ClientHub, command: &str) -> Result<(), String> {
        let msg = serde_json::json!({
            "type": "command",
            "payload": {
                "session_id": self.id,
                "command": command
            }
        });
        hub.send_to_device(&self.device_id, &msg.to_string()).await
    }

    /// Forward a result chunk from device to the web
    pub async fn send_result(&self, chunk: &str, done: bool) -> Result<(), String> {
        let msg = serde_json::json!({
            "type": "result_chunk",
            "payload": {
                "session_id": self.id,
                "chunk": chunk,
                "done": done
            }
        });
        self.web_tx
            .send(msg.to_string())
            .await
            .map_err(|_| "web channel closed".to_string())
    }

    /// Send an error to the web
    pub async fn send_error(&self, code: &str, message: &str) -> Result<(), String> {
        let msg = serde_json::json!({
            "type": "error",
            "payload": {
                "session_id": self.id,
                "code": code,
                "message": message
            }
        });
        self.web_tx
            .send(msg.to_string())
            .await
            .map_err(|_| "web channel closed".to_string())
    }
}

/// Registry of all active sessions.
#[derive(Clone)]
pub struct SessionRegistry {
    sessions: Arc<RwLock<std::collections::HashMap<String, SessionActor>>>,
}

impl SessionRegistry {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(std::collections::HashMap::new())),
        }
    }

    pub async fn register(&self, session: SessionActor) -> String {
        let id = session.id.clone();
        self.sessions.write().await.insert(id.clone(), session);
        id
    }

    pub async fn unregister(&self, id: &str) {
        self.sessions.write().await.remove(id);
    }

    pub async fn get(&self, id: &str) -> Option<SessionActor> {
        self.sessions.read().await.get(id).cloned()
    }

    /// Find a session by device_id and user_id (returns the first match).
    pub async fn find_by_device_and_user(&self, device_id: &str, user_id: &str) -> Option<SessionActor> {
        self.sessions
            .read()
            .await
            .values()
            .find(|s| s.device_id == device_id && s.user_id == user_id)
            .cloned()
    }

    pub async fn list_by_device(&self, device_id: &str) -> Vec<SessionActor> {
        self.sessions
            .read()
            .await
            .values()
            .filter(|s| s.device_id == device_id)
            .cloned()
            .collect()
    }
}
