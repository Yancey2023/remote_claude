use tokio::sync::RwLock;
use std::sync::Arc;
use std::collections::{HashMap, VecDeque};
use uuid::Uuid;

/// Bidirectional session between a web client and a device client.
#[derive(Clone)]
pub struct SessionActor {
    pub id: String,
    pub device_id: String,
    pub user_id: String,
    pub cwd: Option<String>,
}

impl SessionActor {
    pub fn new(device_id: String, user_id: String, cwd: Option<String>) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            device_id,
            user_id,
            cwd,
        }
    }
}

/// Registry of all active sessions.
#[derive(Clone)]
pub struct SessionRegistry {
    sessions: Arc<RwLock<HashMap<String, SessionState>>>,
}

const MAX_HISTORY_BYTES: usize = 512 * 1024;
const MAX_HISTORY_CHUNKS: usize = 2048;

#[derive(Clone)]
struct SessionState {
    actor: SessionActor,
    history_chunks: VecDeque<String>,
    history_bytes: usize,
}

impl SessionState {
    fn new(actor: SessionActor) -> Self {
        Self {
            actor,
            history_chunks: VecDeque::new(),
            history_bytes: 0,
        }
    }

    fn append_history(&mut self, chunk: &str) {
        if chunk.is_empty() {
            return;
        }

        let owned = chunk.to_string();
        self.history_bytes += owned.len();
        self.history_chunks.push_back(owned);

        while self.history_bytes > MAX_HISTORY_BYTES || self.history_chunks.len() > MAX_HISTORY_CHUNKS {
            if let Some(removed) = self.history_chunks.pop_front() {
                self.history_bytes = self.history_bytes.saturating_sub(removed.len());
            } else {
                break;
            }
        }
    }
}

impl SessionRegistry {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn register(&self, session: SessionActor) -> String {
        let id = session.id.clone();
        self.sessions
            .write()
            .await
            .insert(id.clone(), SessionState::new(session));
        id
    }

    pub async fn unregister(&self, id: &str) {
        self.sessions.write().await.remove(id);
    }

    pub async fn get(&self, id: &str) -> Option<SessionActor> {
        self.sessions.read().await.get(id).map(|s| s.actor.clone())
    }

    pub async fn append_history(&self, id: &str, chunk: &str) {
        let mut sessions = self.sessions.write().await;
        if let Some(state) = sessions.get_mut(id) {
            state.append_history(chunk);
        }
    }

    pub async fn get_history(&self, id: &str) -> Option<String> {
        self.sessions.read().await.get(id).map(|s| {
            let mut out = String::with_capacity(s.history_bytes);
            for c in &s.history_chunks {
                out.push_str(c);
            }
            out
        })
    }

    pub async fn get_sessions_for_user(&self, user_id: &str) -> Vec<SessionActor> {
        self.sessions
            .read()
            .await
            .values()
            .filter(|s| s.actor.user_id == user_id)
            .map(|s| s.actor.clone())
            .collect()
    }

    pub async fn get_sessions_for_device(&self, device_id: &str) -> Vec<SessionActor> {
        self.sessions
            .read()
            .await
            .values()
            .filter(|s| s.actor.device_id == device_id)
            .map(|s| s.actor.clone())
            .collect()
    }
}
