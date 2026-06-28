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
    #[serde(rename = "terminal_input")]
    TerminalInput { payload: TerminalInputPayload },
    #[serde(rename = "terminal_resize")]
    TerminalResize { payload: TerminalResizePayload },
    #[serde(rename = "session_closed")]
    SessionClosed { payload: SessionClosedPayload },
    #[serde(rename = "list_directory")]
    ListDirectory { payload: ListDirectoryPayload },
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

#[derive(Debug, Deserialize)]
pub struct TerminalInputPayload {
    pub session_id: String,
    pub data: String,
    pub cwd: Option<String>,
    pub program: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TerminalResizePayload {
    pub session_id: String,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Deserialize)]
pub struct SessionClosedPayload {
    pub session_id: String,
}

#[derive(Debug, Deserialize)]
pub struct ListDirectoryPayload {
    pub request_id: String,
    pub path: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DirectoryEntry {
    pub name: String,
    #[serde(rename = "is_dir")]
    pub is_dir: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
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
        static PONG: &str = r#"{"type":"pong","payload":{}}"#;
        PONG.to_string()
    }

    pub fn result_chunk(session_id: &str, chunk: &str, done: bool) -> String {
        #[derive(serde::Serialize)]
        struct Payload<'a> {
            session_id: &'a str,
            chunk: &'a str,
            done: bool,
        }
        #[derive(serde::Serialize)]
        struct Msg<'a> {
            #[serde(rename = "type")]
            msg_type: &'a str,
            payload: Payload<'a>,
        }
        serde_json::to_string(&Msg {
            msg_type: "result_chunk",
            payload: Payload { session_id, chunk, done },
        })
        .expect("result_chunk serialization")
    }

    pub fn status_update(online: bool, busy: bool) -> String {
        #[derive(serde::Serialize)]
        struct Payload {
            online: bool,
            busy: bool,
        }
        #[derive(serde::Serialize)]
        struct Msg {
            #[serde(rename = "type")]
            msg_type: &'static str,
            payload: Payload,
        }
        serde_json::to_string(&Msg {
            msg_type: "status_update",
            payload: Payload { online, busy },
        })
        .expect("status_update serialization")
    }

    pub fn directory_list(request_id: &str, path: &str, entries: &[DirectoryEntry]) -> String {
        serde_json::json!({
            "type": "directory_list",
            "payload": {
                "request_id": request_id,
                "path": path,
                "entries": entries
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
    fn test_deserialize_terminal_input_with_program() {
        let json = r#"{"type":"terminal_input","payload":{"session_id":"s1","data":"echo hi","cwd":"/tmp","program":"powershell"}}"#;
        let msg: ServerMessage = serde_json::from_str(json).unwrap();
        match msg {
            ServerMessage::TerminalInput { payload } => {
                assert_eq!(payload.session_id, "s1");
                assert_eq!(payload.data, "echo hi");
                assert_eq!(payload.cwd, Some("/tmp".to_string()));
                assert_eq!(payload.program, Some("powershell".to_string()));
            }
            _ => panic!("expected TerminalInput variant"),
        }
    }

    #[test]
    fn test_deserialize_terminal_input_no_program() {
        let json = r#"{"type":"terminal_input","payload":{"session_id":"s1","data":"hello","cwd":null}}"#;
        let msg: ServerMessage = serde_json::from_str(json).unwrap();
        match msg {
            ServerMessage::TerminalInput { payload } => {
                assert_eq!(payload.session_id, "s1");
                assert_eq!(payload.data, "hello");
                assert_eq!(payload.cwd, None);
                assert_eq!(payload.program, None);
            }
            _ => panic!("expected TerminalInput variant"),
        }
    }

    #[test]
    fn test_deserialize_ping() {
        let json = r#"{"type":"ping"}"#;
        let msg: ServerMessage = serde_json::from_str(json).unwrap();
        assert!(matches!(msg, ServerMessage::Ping));
    }

    #[test]
    fn test_deserialize_terminal_input() {
        let json = r#"{"type":"terminal_input","payload":{"session_id":"s1","data":"hello","cwd":"/tmp"}}"#;
        let msg: ServerMessage = serde_json::from_str(json).unwrap();
        match msg {
            ServerMessage::TerminalInput { payload } => {
                assert_eq!(payload.session_id, "s1");
                assert_eq!(payload.data, "hello");
                assert_eq!(payload.cwd, Some("/tmp".to_string()));
            }
            _ => panic!("expected TerminalInput variant"),
        }
    }

    #[test]
    fn test_deserialize_terminal_resize() {
        let json = r#"{"type":"terminal_resize","payload":{"session_id":"s1","cols":120,"rows":40}}"#;
        let msg: ServerMessage = serde_json::from_str(json).unwrap();
        match msg {
            ServerMessage::TerminalResize { payload } => {
                assert_eq!(payload.session_id, "s1");
                assert_eq!(payload.cols, 120);
                assert_eq!(payload.rows, 40);
            }
            _ => panic!("expected TerminalResize variant"),
        }
    }

    #[test]
    fn test_deserialize_session_closed() {
        let json = r#"{"type":"session_closed","payload":{"session_id":"s1"}}"#;
        let msg: ServerMessage = serde_json::from_str(json).unwrap();
        match msg {
            ServerMessage::SessionClosed { payload } => {
                assert_eq!(payload.session_id, "s1");
            }
            _ => panic!("expected SessionClosed variant"),
        }
    }

    #[test]
    fn test_directory_list_message() {
        let entries = vec![
            DirectoryEntry { name: "..".into(), is_dir: true, size: None },
            DirectoryEntry { name: "projects".into(), is_dir: true, size: None },
            DirectoryEntry { name: "file.txt".into(), is_dir: false, size: Some(1024) },
        ];
        let msg = ClientMessage::directory_list("req-1", "/home/user", &entries);
        let parsed: serde_json::Value = serde_json::from_str(&msg).unwrap();
        assert_eq!(parsed["type"], "directory_list");
        assert_eq!(parsed["payload"]["request_id"], "req-1");
        assert_eq!(parsed["payload"]["path"], "/home/user");
        assert_eq!(parsed["payload"]["entries"].as_array().unwrap().len(), 3);
    }

    #[test]
    fn test_deserialize_list_directory() {
        let json = r#"{"type":"list_directory","payload":{"request_id":"req-1","path":"/home/user"}}"#;
        let msg: ServerMessage = serde_json::from_str(json).unwrap();
        match msg {
            ServerMessage::ListDirectory { payload } => {
                assert_eq!(payload.request_id, "req-1");
                assert_eq!(payload.path, Some("/home/user".into()));
            }
            _ => panic!("expected ListDirectory variant"),
        }
    }

    #[test]
    fn test_deserialize_list_directory_empty_path() {
        let json = r#"{"type":"list_directory","payload":{"request_id":"req-2","path":null}}"#;
        let msg: ServerMessage = serde_json::from_str(json).unwrap();
        match msg {
            ServerMessage::ListDirectory { payload } => {
                assert_eq!(payload.request_id, "req-2");
                assert_eq!(payload.path, None);
            }
            _ => panic!("expected ListDirectory variant"),
        }
    }
}
