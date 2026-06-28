use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientToken {
    pub token: String,
    pub created_at: i64,
    pub user_id: String,
}

