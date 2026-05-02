use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Messages received from the server.
#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum ServerMessage {
    Ping {
        #[serde(rename = "type")]
        msg_type: String,
    },
    Registered {
        #[serde(rename = "type")]
        msg_type: String,
        payload: RegisteredPayload,
    },
    Command {
        #[serde(rename = "type")]
        msg_type: String,
        payload: CommandPayload,
    },
    Kick, // "__kick__" text message not JSON
}

#[derive(Debug, Deserialize)]
pub struct RegisteredPayload {
    pub device_id: String,
}

#[derive(Debug, Deserialize)]
pub struct CommandPayload {
    pub session_id: String,
    pub command: String,
}

/// Messages sent to the server.
#[derive(Debug, Serialize)]
pub struct ClientMessage {
    #[serde(rename = "type")]
    pub msg_type: String,
    pub payload: Value,
}

impl ClientMessage {
    pub fn register(token: &str, name: &str, version: &str) -> String {
        serde_json::json!({
            "type": "register",
            "payload": {
                "token": token,
                "name": name,
                "version": version
            }
        })
        .to_string()
    }

    pub fn pong() -> String {
        serde_json::json!({ "type": "pong", "payload": {} }).to_string()
    }

    pub fn result_chunk(session_id: &str, chunk: &str, done: bool) -> String {
        serde_json::json!({
            "type": "result_chunk",
            "payload": {
                "session_id": session_id,
                "chunk": chunk,
                "done": done
            }
        })
        .to_string()
    }

    pub fn status_update(online: bool, busy: bool) -> String {
        serde_json::json!({
            "type": "status_update",
            "payload": {
                "online": online,
                "busy": busy
            }
        })
        .to_string()
    }
}
