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
