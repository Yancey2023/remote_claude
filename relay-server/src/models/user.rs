use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum UserRole {
    Admin,
    User,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub username: String,
    pub password_hash: String,
    pub role: UserRole,
    pub enabled: bool,
    pub created_at: i64,
}

impl User {
    pub fn new(id: String, username: String, password_hash: String, role: UserRole) -> Self {
        Self {
            id,
            username,
            password_hash,
            role,
            enabled: true,
            created_at: chrono::Utc::now().timestamp(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_user() {
        let user = User::new("id-1".into(), "alice".into(), "hash123".into(), UserRole::User);
        assert_eq!(user.id, "id-1");
        assert_eq!(user.username, "alice");
        assert_eq!(user.password_hash, "hash123");
        assert_eq!(user.role, UserRole::User);
        assert!(user.enabled);
    }

    #[test]
    fn test_new_admin() {
        let user = User::new("id-2".into(), "root".into(), "hash456".into(), UserRole::Admin);
        assert_eq!(user.role, UserRole::Admin);
    }

    #[test]
    fn test_user_disabled() {
        let mut user = User::new("id-3".into(), "bob".into(), "hash".into(), UserRole::User);
        user.enabled = false;
        assert!(!user.enabled);
    }
}
