use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientToken {
    pub token: String,
    pub created_at: i64,
    pub user_id: String,
}

impl ClientToken {
    pub fn new(token: String, user_id: String) -> Self {
        Self {
            token,
            created_at: chrono::Utc::now().timestamp(),
            user_id,
        }
    }
}
