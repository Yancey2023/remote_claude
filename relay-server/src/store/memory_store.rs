use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::models::{Device, Session, User};

#[derive(Clone)]
pub struct MemoryStore {
    users: Arc<RwLock<HashMap<String, User>>>,
    devices: Arc<RwLock<HashMap<String, Device>>>,
    sessions: Arc<RwLock<HashMap<String, Session>>>,
    usernames: Arc<RwLock<HashMap<String, String>>>, // username → id
}

impl MemoryStore {
    pub fn new() -> Self {
        Self {
            users: Arc::new(RwLock::new(HashMap::new())),
            devices: Arc::new(RwLock::new(HashMap::new())),
            sessions: Arc::new(RwLock::new(HashMap::new())),
            usernames: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    // ── Users ──

    pub async fn create_user(&self, user: User) -> Result<(), String> {
        let mut users = self.users.write().await;
        let mut usernames = self.usernames.write().await;
        if usernames.contains_key(&user.username) {
            return Err("username already exists".into());
        }
        usernames.insert(user.username.clone(), user.id.clone());
        users.insert(user.id.clone(), user);
        Ok(())
    }

    pub async fn get_user(&self, id: &str) -> Option<User> {
        self.users.read().await.get(id).cloned()
    }

    pub async fn get_user_by_username(&self, username: &str) -> Option<User> {
        let usernames = self.usernames.read().await;
        let uid = usernames.get(username)?.clone();
        self.users.read().await.get(&uid).cloned()
    }

    pub async fn list_users(&self) -> Vec<User> {
        self.users.read().await.values().cloned().collect()
    }

    pub async fn update_user(&self, user: User) -> Result<(), String> {
        let mut users = self.users.write().await;
        if !users.contains_key(&user.id) {
            return Err("user not found".into());
        }
        users.insert(user.id.clone(), user);
        Ok(())
    }

    pub async fn delete_user(&self, id: &str) -> Result<(), String> {
        let mut users = self.users.write().await;
        let mut usernames = self.usernames.write().await;
        let user = users.remove(id).ok_or("user not found")?;
        usernames.remove(&user.username);
        Ok(())
    }

    // ── Devices ──

    pub async fn upsert_device(&self, device: Device) {
        let mut devices = self.devices.write().await;
        devices.insert(device.id.clone(), device);
    }

    pub async fn get_device(&self, id: &str) -> Option<Device> {
        self.devices.read().await.get(id).cloned()
    }

    pub async fn list_devices(&self) -> Vec<Device> {
        self.devices.read().await.values().cloned().collect()
    }

    pub async fn list_online_devices(&self) -> Vec<Device> {
        self.devices
            .read()
            .await
            .values()
            .filter(|d| d.online)
            .cloned()
            .collect()
    }

    pub async fn set_device_online(&self, id: &str, online: bool) {
        let mut devices = self.devices.write().await;
        if let Some(device) = devices.get_mut(id) {
            device.online = online;
            device.last_seen = chrono::Utc::now().timestamp();
        }
    }

    // ── Sessions ──

    pub async fn create_session(&self, session: Session) -> Result<(), String> {
        let mut sessions = self.sessions.write().await;
        sessions.insert(session.id.clone(), session);
        Ok(())
    }

    pub async fn get_session(&self, id: &str) -> Option<Session> {
        self.sessions.read().await.get(id).cloned()
    }

    pub async fn close_session(&self, id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.write().await;
        let session = sessions.get_mut(id).ok_or("session not found")?;
        session.closed = true;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::UserRole;

    #[tokio::test]
    async fn test_create_and_get_user() {
        let store = MemoryStore::new();
        let user = User::new("u1".into(), "alice".into(), "hash".into(), UserRole::User);
        store.create_user(user).await.unwrap();

        let found = store.get_user("u1").await.unwrap();
        assert_eq!(found.username, "alice");
    }

    #[tokio::test]
    async fn test_get_user_by_username() {
        let store = MemoryStore::new();
        let user = User::new("u1".into(), "bob".into(), "hash".into(), UserRole::User);
        store.create_user(user).await.unwrap();

        let found = store.get_user_by_username("bob").await.unwrap();
        assert_eq!(found.id, "u1");
    }

    #[tokio::test]
    async fn test_duplicate_username_fails() {
        let store = MemoryStore::new();
        let u1 = User::new("u1".into(), "alice".into(), "hash".into(), UserRole::User);
        let u2 = User::new("u2".into(), "alice".into(), "hash2".into(), UserRole::User);
        store.create_user(u1).await.unwrap();
        let result = store.create_user(u2).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_update_user() {
        let store = MemoryStore::new();
        let mut user = User::new("u1".into(), "alice".into(), "hash".into(), UserRole::User);
        store.create_user(user.clone()).await.unwrap();
        user.enabled = false;
        store.update_user(user).await.unwrap();

        let found = store.get_user("u1").await.unwrap();
        assert!(!found.enabled);
    }

    #[tokio::test]
    async fn test_delete_user() {
        let store = MemoryStore::new();
        let user = User::new("u1".into(), "alice".into(), "hash".into(), UserRole::User);
        store.create_user(user).await.unwrap();
        store.delete_user("u1").await.unwrap();
        assert!(store.get_user("u1").await.is_none());
    }

    #[tokio::test]
    async fn test_device_upsert_and_list() {
        let store = MemoryStore::new();
        let d = Device::new("dev-1".into(), "pc1".into(), "1.0".into());
        store.upsert_device(d).await;

        let devices = store.list_devices().await;
        assert_eq!(devices.len(), 1);
        assert_eq!(devices[0].name, "pc1");
    }

    #[tokio::test]
    async fn test_device_online_status() {
        let store = MemoryStore::new();
        let d = Device::new("dev-1".into(), "pc1".into(), "1.0".into());
        store.upsert_device(d).await;
        store.set_device_online("dev-1", false).await;

        let device = store.get_device("dev-1").await.unwrap();
        assert!(!device.online);
    }

    #[tokio::test]
    async fn test_create_and_close_session() {
        let store = MemoryStore::new();
        let session = Session::new("s1".into(), "dev-1".into(), "u1".into());
        store.create_session(session).await.unwrap();

        let found = store.get_session("s1").await.unwrap();
        assert_eq!(found.device_id, "dev-1");
        assert!(!found.closed);

        store.close_session("s1").await.unwrap();
        let closed = store.get_session("s1").await.unwrap();
        assert!(closed.closed);
    }
}
