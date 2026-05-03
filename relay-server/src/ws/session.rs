use tokio::sync::RwLock;
use std::sync::Arc;
use uuid::Uuid;

/// Bidirectional session between a web client and a device client.
#[derive(Clone)]
pub struct SessionActor {
    pub id: String,
    pub device_id: String,
    pub user_id: String,
}

impl SessionActor {
    pub fn new(device_id: String, user_id: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            device_id,
            user_id,
        }
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

    pub async fn get_sessions_for_user(&self, user_id: &str) -> Vec<SessionActor> {
        self.sessions
            .read()
            .await
            .values()
            .filter(|s| s.user_id == user_id)
            .cloned()
            .collect()
    }
}
