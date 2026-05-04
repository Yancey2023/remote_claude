use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use sqlx::Row;
use std::path::Path;
use std::str::FromStr;
use tracing::info;

use crate::models::{Device, Session, User, UserRole};

#[derive(Clone)]
pub struct SqliteStore {
    pub pool: SqlitePool,
}

impl SqliteStore {
    pub async fn new(database_url: &str) -> Result<Self, sqlx::Error> {
        let connect_options = SqliteConnectOptions::from_str(database_url)
            ?
            .create_if_missing(true);

        Self::ensure_parent_dir(&connect_options)?;

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(connect_options)
            .await?;

        let store = Self { pool };
        store.migrate().await?;
        info!("SQLite store initialized: {}", database_url);
        Ok(store)
    }

    fn ensure_parent_dir(options: &SqliteConnectOptions) -> Result<(), sqlx::Error> {
        let filename = options.get_filename();
        if filename == Path::new(":memory:") {
            return Ok(());
        }

        if let Some(parent) = filename.parent() {
            if parent.as_os_str().is_empty() {
                return Ok(());
            }
            std::fs::create_dir_all(parent)
                .map_err(|e| sqlx::Error::Configuration(Box::new(e)))?;
        }

        Ok(())
    }

    async fn migrate(&self) -> Result<(), sqlx::Error> {
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY NOT NULL,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'User',
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at INTEGER NOT NULL
            )",
        )
        .execute(&self.pool)
        .await?;

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS devices (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                version TEXT NOT NULL DEFAULT '0.1.0',
                online INTEGER NOT NULL DEFAULT 0,
                busy INTEGER NOT NULL DEFAULT 0,
                last_seen INTEGER NOT NULL DEFAULT 0,
                registered_at INTEGER NOT NULL DEFAULT 0
            )",
        )
        .execute(&self.pool)
        .await?;

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY NOT NULL,
                device_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                closed INTEGER NOT NULL DEFAULT 0,
                cwd TEXT
            )",
        )
        .execute(&self.pool)
        .await?;

        // Add cwd column for existing databases
        let _ = sqlx::query("ALTER TABLE sessions ADD COLUMN cwd TEXT")
            .execute(&self.pool)
            .await;

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS registration_tokens (
                token TEXT PRIMARY KEY NOT NULL,
                created_at INTEGER NOT NULL,
                is_used INTEGER NOT NULL DEFAULT 0,
                used_by_device_id TEXT
            )",
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    // ── Users ──

    pub async fn create_user(&self, user: User) -> Result<(), String> {
        let role_str = format!("{:?}", user.role);
        sqlx::query(
            "INSERT INTO users (id, username, password_hash, role, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&user.id)
        .bind(&user.username)
        .bind(&user.password_hash)
        .bind(&role_str)
        .bind(user.enabled as i32)
        .bind(user.created_at)
        .execute(&self.pool)
        .await
        .map_err(|e| {
            if e.to_string().contains("UNIQUE") {
                "username already exists".to_string()
            } else {
                format!("database error: {}", e)
            }
        })?;
        Ok(())
    }

    pub async fn get_user(&self, id: &str) -> Option<User> {
        sqlx::query("SELECT id, username, password_hash, role, enabled, created_at FROM users WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .ok()?
            .map(row_to_user)
    }

    pub async fn get_user_by_username(&self, username: &str) -> Option<User> {
        sqlx::query("SELECT id, username, password_hash, role, enabled, created_at FROM users WHERE username = ?")
            .bind(username)
            .fetch_optional(&self.pool)
            .await
            .ok()?
            .map(row_to_user)
    }

    pub async fn list_users(&self) -> Vec<User> {
        sqlx::query("SELECT id, username, password_hash, role, enabled, created_at FROM users ORDER BY created_at DESC")
            .fetch_all(&self.pool)
            .await
            .ok()
            .map(|rows| rows.into_iter().map(row_to_user).collect())
            .unwrap_or_default()
    }

    pub async fn update_user(&self, user: User) -> Result<(), String> {
        let role_str = format!("{:?}", user.role);
        let affected = sqlx::query(
            "UPDATE users SET username = ?, password_hash = ?, role = ?, enabled = ? WHERE id = ?",
        )
        .bind(&user.username)
        .bind(&user.password_hash)
        .bind(&role_str)
        .bind(user.enabled as i32)
        .bind(&user.id)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("database error: {}", e))?
        .rows_affected();

        if affected == 0 {
            return Err("user not found".into());
        }
        Ok(())
    }

    pub async fn delete_user(&self, id: &str) -> Result<(), String> {
        let affected = sqlx::query("DELETE FROM users WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| format!("database error: {}", e))?
            .rows_affected();

        if affected == 0 {
            return Err("user not found".into());
        }
        Ok(())
    }

    // ── Devices ──

    pub async fn upsert_device(&self, device: Device) {
        sqlx::query(
            "INSERT INTO devices (id, name, version, online, busy, last_seen, registered_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                version = excluded.version,
                online = excluded.online,
                busy = excluded.busy,
                last_seen = excluded.last_seen",
        )
        .bind(&device.id)
        .bind(&device.name)
        .bind(&device.version)
        .bind(device.online as i32)
        .bind(device.busy as i32)
        .bind(device.last_seen)
        .bind(device.registered_at)
        .execute(&self.pool)
        .await
        .ok();
    }

    pub async fn list_devices(&self) -> Vec<Device> {
        sqlx::query("SELECT id, name, version, online, busy, last_seen, registered_at FROM devices ORDER BY last_seen DESC")
            .fetch_all(&self.pool)
            .await
            .ok()
            .map(|rows| rows.into_iter().map(row_to_device).collect())
            .unwrap_or_default()
    }

    pub async fn set_device_online(&self, id: &str, online: bool) {
        let now = chrono::Utc::now().timestamp();
        sqlx::query("UPDATE devices SET online = ?, last_seen = ? WHERE id = ?")
            .bind(online as i32)
            .bind(now)
            .bind(id)
            .execute(&self.pool)
            .await
            .ok();
    }

    pub async fn delete_device(&self, id: &str) -> Result<(), String> {
        let affected = sqlx::query("DELETE FROM devices WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| format!("database error: {}", e))?
            .rows_affected();

        if affected == 0 {
            return Err("device not found".into());
        }
        Ok(())
    }

    // ── Sessions ──

    pub async fn create_session(&self, session: Session) -> Result<(), String> {
        sqlx::query(
            "INSERT INTO sessions (id, device_id, user_id, created_at, closed, cwd) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&session.id)
        .bind(&session.device_id)
        .bind(&session.user_id)
        .bind(session.created_at)
        .bind(session.closed as i32)
        .bind(&session.cwd)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("database error: {}", e))?;
        Ok(())
    }

    pub async fn close_session(&self, id: &str) -> Result<(), String> {
        let affected = sqlx::query("UPDATE sessions SET closed = 1 WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| format!("database error: {}", e))?
            .rows_affected();

        if affected == 0 {
            return Err("session not found".into());
        }
        Ok(())
    }

    pub async fn list_sessions(&self, user_id: &str) -> Vec<Session> {
        sqlx::query(
            "SELECT id, device_id, user_id, created_at, closed, cwd FROM sessions WHERE user_id = ? AND closed = 0 ORDER BY created_at DESC",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .ok()
        .map(|rows| rows.into_iter().map(row_to_session).collect())
        .unwrap_or_default()
    }

    pub async fn list_sessions_for_device(&self, device_id: &str) -> Vec<Session> {
        sqlx::query(
            "SELECT id, device_id, user_id, created_at, closed, cwd FROM sessions WHERE device_id = ? AND closed = 0 ORDER BY created_at DESC",
        )
        .bind(device_id)
        .fetch_all(&self.pool)
        .await
        .ok()
        .map(|rows| rows.into_iter().map(row_to_session).collect())
        .unwrap_or_default()
    }

    pub async fn get_session(&self, id: &str) -> Option<Session> {
        sqlx::query(
            "SELECT id, device_id, user_id, created_at, closed, cwd FROM sessions WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .ok()?
        .map(row_to_session)
    }
    // ── Registration Tokens ──

    pub async fn create_registration_token(&self, token: &str) -> Result<(), String> {
        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            "INSERT INTO registration_tokens (token, created_at, is_used) VALUES (?, ?, 0)",
        )
        .bind(token)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("database error: {}", e))?;
        Ok(())
    }

    pub async fn validate_registration_token(&self, token: &str) -> bool {
        let result: Option<bool> = sqlx::query(
            "SELECT COUNT(*) > 0 FROM registration_tokens WHERE token = ? AND is_used = 0",
        )
        .bind(token)
        .fetch_optional(&self.pool)
        .await
        .ok()
        .flatten()
        .map(|row| row.get::<i32, _>(0) != 0);

        result.unwrap_or(false)
    }

    pub async fn mark_token_used(&self, token: &str, device_id: &str) {
        let _ = sqlx::query(
            "UPDATE registration_tokens SET is_used = 1, used_by_device_id = ? WHERE token = ?",
        )
        .bind(device_id)
        .bind(token)
        .execute(&self.pool)
        .await;
    }
}

// ── Row mappers ──

fn row_to_session(row: sqlx::sqlite::SqliteRow) -> Session {
    Session {
        id: row.get("id"),
        device_id: row.get("device_id"),
        user_id: row.get("user_id"),
        created_at: row.get("created_at"),
        closed: row.get::<i32, _>("closed") != 0,
        cwd: row.get("cwd"),
    }
}

fn row_to_user(row: sqlx::sqlite::SqliteRow) -> User {
    let role_str: String = row.get("role");
    let role = match role_str.as_str() {
        "Admin" => UserRole::Admin,
        _ => UserRole::User,
    };
    User {
        id: row.get("id"),
        username: row.get("username"),
        password_hash: row.get("password_hash"),
        role,
        enabled: row.get::<i32, _>("enabled") != 0,
        created_at: row.get("created_at"),
    }
}

fn row_to_device(row: sqlx::sqlite::SqliteRow) -> Device {
    Device {
        id: row.get("id"),
        name: row.get("name"),
        version: row.get("version"),
        online: row.get::<i32, _>("online") != 0,
        busy: row.get::<i32, _>("busy") != 0,
        last_seen: row.get("last_seen"),
        registered_at: row.get("registered_at"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::UserRole;
    use std::time::{SystemTime, UNIX_EPOCH};

    async fn test_store() -> SqliteStore {
        SqliteStore::new("sqlite::memory:").await.unwrap()
    }

    #[test]
    fn test_ensure_parent_dir_creates_missing_dir() {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("relay-server-store-dir-{nanos}"));
        let db_path = root.join("nested").join("data.db");
        let parent = db_path.parent().unwrap();
        let options = SqliteConnectOptions::new().filename(&db_path);

        assert!(!parent.exists());

        SqliteStore::ensure_parent_dir(&options).unwrap();

        assert!(parent.exists());

        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn test_create_and_get_user() {
        let store = test_store().await;
        let user = User::new("u1".into(), "alice".into(), "hash".into(), UserRole::User);
        store.create_user(user).await.unwrap();
        let found = store.get_user("u1").await.unwrap();
        assert_eq!(found.username, "alice");
    }

    #[tokio::test]
    async fn test_get_user_by_username() {
        let store = test_store().await;
        let user = User::new("u1".into(), "bob".into(), "hash".into(), UserRole::User);
        store.create_user(user).await.unwrap();
        let found = store.get_user_by_username("bob").await.unwrap();
        assert_eq!(found.id, "u1");
    }

    #[tokio::test]
    async fn test_duplicate_username_fails() {
        let store = test_store().await;
        let u1 = User::new("u1".into(), "alice".into(), "hash".into(), UserRole::User);
        let u2 = User::new("u2".into(), "alice".into(), "hash2".into(), UserRole::User);
        store.create_user(u1).await.unwrap();
        let result = store.create_user(u2).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_update_user() {
        let store = test_store().await;
        let mut user = User::new("u1".into(), "alice".into(), "hash".into(), UserRole::User);
        store.create_user(user.clone()).await.unwrap();
        user.enabled = false;
        store.update_user(user).await.unwrap();
        let found = store.get_user("u1").await.unwrap();
        assert!(!found.enabled);
    }

    #[tokio::test]
    async fn test_delete_user() {
        let store = test_store().await;
        let user = User::new("u1".into(), "alice".into(), "hash".into(), UserRole::User);
        store.create_user(user).await.unwrap();
        store.delete_user("u1").await.unwrap();
        assert!(store.get_user("u1").await.is_none());
    }

    #[tokio::test]
    async fn test_list_users() {
        let store = test_store().await;
        store.create_user(User::new("u1".into(), "a".into(), "h".into(), UserRole::User)).await.unwrap();
        store.create_user(User::new("u2".into(), "b".into(), "h".into(), UserRole::Admin)).await.unwrap();
        assert_eq!(store.list_users().await.len(), 2);
    }

    #[tokio::test]
    async fn test_device_upsert_and_list() {
        let store = test_store().await;
        store.upsert_device(Device::new("dev-1".into(), "pc1".into(), "1.0".into())).await;
        let devices = store.list_devices().await;
        assert_eq!(devices.len(), 1);
        assert_eq!(devices[0].name, "pc1");
    }

    #[tokio::test]
    async fn test_device_online_status() {
        let store = test_store().await;
        store.upsert_device(Device::new("dev-1".into(), "pc1".into(), "1.0".into())).await;
        store.set_device_online("dev-1", false).await;
        let devices = store.list_devices().await;
        let device = devices.iter().find(|d| d.id == "dev-1").unwrap();
        assert!(!device.online);
    }

    #[tokio::test]
    async fn test_create_and_close_session() {
        let store = test_store().await;
        let session = Session::new("s1".into(), "dev-1".into(), "u1".into(), Some("/tmp".into()));
        store.create_session(session).await.unwrap();
        store.close_session("s1").await.unwrap();
        store.close_session("nonexistent").await.unwrap_err();
    }

    #[tokio::test]
    async fn test_list_sessions() {
        let store = test_store().await;
        store.create_session(Session::new("s1".into(), "dev-1".into(), "u1".into(), None)).await.unwrap();
        store.create_session(Session::new("s2".into(), "dev-1".into(), "u1".into(), Some("/home".into()))).await.unwrap();
        let list = store.list_sessions("u1").await;
        assert_eq!(list.len(), 2);
        let list_dev = store.list_sessions_for_device("dev-1").await;
        assert_eq!(list_dev.len(), 2);
        let s = store.get_session("s1").await.unwrap();
        assert_eq!(s.id, "s1");
    }

    // ── Registration Token Tests ──

    #[tokio::test]
    async fn test_create_and_validate_token() {
        let store = test_store().await;
        store.create_registration_token("test-token-1").await.unwrap();
        assert!(store.validate_registration_token("test-token-1").await);
    }

    #[tokio::test]
    async fn test_validate_nonexistent_token() {
        let store = test_store().await;
        assert!(!store.validate_registration_token("nonexistent").await);
    }

    #[tokio::test]
    async fn test_mark_token_used() {
        let store = test_store().await;
        store.create_registration_token("test-token-2").await.unwrap();
        assert!(store.validate_registration_token("test-token-2").await);

        store.mark_token_used("test-token-2", "dev-1").await;
        assert!(!store.validate_registration_token("test-token-2").await);
    }

    #[tokio::test]
    async fn test_token_cannot_be_reused() {
        let store = test_store().await;
        store.create_registration_token("single-use").await.unwrap();
        store.mark_token_used("single-use", "dev-1").await;
        assert!(!store.validate_registration_token("single-use").await);

        // A second device trying to use the same token should fail
        store.mark_token_used("single-use", "dev-2").await;
        assert!(!store.validate_registration_token("single-use").await);
    }

    #[tokio::test]
    async fn test_multiple_tokens_independent() {
        let store = test_store().await;
        store.create_registration_token("token-a").await.unwrap();
        store.create_registration_token("token-b").await.unwrap();
        store.create_registration_token("token-c").await.unwrap();

        assert!(store.validate_registration_token("token-a").await);
        assert!(store.validate_registration_token("token-b").await);
        assert!(store.validate_registration_token("token-c").await);

        store.mark_token_used("token-b", "dev-1").await;

        assert!(store.validate_registration_token("token-a").await);
        assert!(!store.validate_registration_token("token-b").await);
        assert!(store.validate_registration_token("token-c").await);
    }
}
