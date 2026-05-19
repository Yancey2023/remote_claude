use tokio::sync::RwLock;
use std::sync::Arc;
use std::collections::{HashMap, HashSet, VecDeque};
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
        let chunks: Vec<String> = {
            let sessions = self.sessions.read().await;
            sessions.get(id).map(|s| s.history_chunks.iter().cloned().collect())?
        };
        let mut out = String::with_capacity(chunks.iter().map(|c| c.len()).sum());
        for c in &chunks {
            out.push_str(c);
        }
        Some(out)
    }

    /// Check which session IDs from `ids` still exist in the registry.
    /// Acquires the read lock once instead of N times.
    pub async fn filter_existing(&self, ids: &[String]) -> HashSet<String> {
        let sessions = self.sessions.read().await;
        ids.iter()
            .filter(|id| sessions.contains_key(*id))
            .cloned()
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_actor_new() {
        let actor = SessionActor::new("dev-1".into(), "user-1".into());
        assert!(!actor.id.is_empty());
        assert_eq!(actor.device_id, "dev-1");
        assert_eq!(actor.user_id, "user-1");
    }

    #[tokio::test]
    async fn test_register_and_get() {
        let registry = SessionRegistry::new();
        let actor = SessionActor::new("dev-1".into(), "user-1".into());
        let id = registry.register(actor.clone()).await;
        let retrieved = registry.get(&id).await.unwrap();
        assert_eq!(retrieved.device_id, "dev-1");
        assert_eq!(retrieved.user_id, "user-1");
    }

    #[tokio::test]
    async fn test_get_nonexistent() {
        let registry = SessionRegistry::new();
        assert!(registry.get("nonexistent").await.is_none());
    }

    #[tokio::test]
    async fn test_unregister_removes_session() {
        let registry = SessionRegistry::new();
        let actor = SessionActor::new("dev-1".into(), "user-1".into());
        let id = registry.register(actor).await;
        registry.unregister(&id).await;
        assert!(registry.get(&id).await.is_none());
    }

    #[tokio::test]
    async fn test_append_and_get_history() {
        let registry = SessionRegistry::new();
        let actor = SessionActor::new("dev-1".into(), "user-1".into());
        let id = registry.register(actor).await;
        registry.append_history(&id, "hello ").await;
        registry.append_history(&id, "world").await;
        let history = registry.get_history(&id).await.unwrap();
        assert_eq!(history, "hello world");
    }

    #[tokio::test]
    async fn test_get_history_empty() {
        let registry = SessionRegistry::new();
        let actor = SessionActor::new("dev-1".into(), "user-1".into());
        let id = registry.register(actor).await;
        let history = registry.get_history(&id).await;
        assert!(history.is_some());
        assert!(history.unwrap().is_empty());
    }

    #[tokio::test]
    async fn test_filter_existing() {
        let registry = SessionRegistry::new();
        let s1 = SessionActor::new("dev-1".into(), "user-1".into());
        let s2 = SessionActor::new("dev-1".into(), "user-1".into());
        let sid1 = registry.register(s1).await;
        let sid2 = registry.register(s2).await;

        let ids = vec![sid1.clone(), sid2.clone(), "nonexistent".into()];
        let existing = registry.filter_existing(&ids).await;
        assert_eq!(existing.len(), 2);
        assert!(existing.contains(&sid1));
        assert!(existing.contains(&sid2));
        assert!(!existing.contains("nonexistent"));
    }
}
