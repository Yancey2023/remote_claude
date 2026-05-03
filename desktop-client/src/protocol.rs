use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Messages received from the server.
#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum ServerMessage {
    #[serde(rename = "ping")]
    Ping,
    #[serde(rename = "registered")]
    Registered { payload: RegisteredPayload },
    #[serde(rename = "command")]
    Command { payload: CommandPayload },
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
    pub fn register(token: &str, name: &str, version: &str, device_id: &str) -> String {
        serde_json::json!({
            "type": "register",
            "payload": {
                "token": token,
                "name": name,
                "version": version,
                "device_id": device_id
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_register_message() {
        let msg = ClientMessage::register("token-123", "my-pc", "1.0.0", "dev-abc");
        let parsed: serde_json::Value = serde_json::from_str(&msg).unwrap();
        assert_eq!(parsed["type"], "register");
        assert_eq!(parsed["payload"]["token"], "token-123");
        assert_eq!(parsed["payload"]["name"], "my-pc");
        assert_eq!(parsed["payload"]["version"], "1.0.0");
        assert_eq!(parsed["payload"]["device_id"], "dev-abc");
    }

    #[test]
    fn test_pong_message() {
        let msg = ClientMessage::pong();
        let parsed: serde_json::Value = serde_json::from_str(&msg).unwrap();
        assert_eq!(parsed["type"], "pong");
    }

    #[test]
    fn test_result_chunk() {
        let msg = ClientMessage::result_chunk("session-1", "hello world", false);
        let parsed: serde_json::Value = serde_json::from_str(&msg).unwrap();
        assert_eq!(parsed["type"], "result_chunk");
        assert_eq!(parsed["payload"]["session_id"], "session-1");
        assert_eq!(parsed["payload"]["chunk"], "hello world");
        assert!(!parsed["payload"]["done"].as_bool().unwrap());
    }

    #[test]
    fn test_result_chunk_done() {
        let msg = ClientMessage::result_chunk("session-1", "", true);
        let parsed: serde_json::Value = serde_json::from_str(&msg).unwrap();
        assert!(parsed["payload"]["done"].as_bool().unwrap());
    }

    #[test]
    fn test_status_update() {
        let msg = ClientMessage::status_update(true, false);
        let parsed: serde_json::Value = serde_json::from_str(&msg).unwrap();
        assert_eq!(parsed["type"], "status_update");
        assert!(parsed["payload"]["online"].as_bool().unwrap());
        assert!(!parsed["payload"]["busy"].as_bool().unwrap());
    }

    #[test]
    fn test_deserialize_registered() {
        let json = r#"{"type":"registered","payload":{"device_id":"dev-123"}}"#;
        let msg: ServerMessage = serde_json::from_str(json).unwrap();
        match msg {
            ServerMessage::Registered { payload } => {
                assert_eq!(payload.device_id, "dev-123");
            }
            _ => panic!("expected Registered variant"),
        }
    }

    #[test]
    fn test_deserialize_command() {
        let json = r#"{"type":"command","payload":{"session_id":"s1","command":"hello"}}"#;
        let msg: ServerMessage = serde_json::from_str(json).unwrap();
        match msg {
            ServerMessage::Command { payload } => {
                assert_eq!(payload.session_id, "s1");
                assert_eq!(payload.command, "hello");
            }
            _ => panic!("expected Command variant"),
        }
    }

    #[test]
    fn test_deserialize_ping() {
        let json = r#"{"type":"ping"}"#;
        let msg: ServerMessage = serde_json::from_str(json).unwrap();
        assert!(matches!(msg, ServerMessage::Ping));
    }
}
