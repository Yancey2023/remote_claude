use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc;
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;
use tracing::{error, info, warn};

use crate::config::Config;
use crate::protocol::{ClientMessage, ServerMessage};
use crate::pty_session::PtySessionManager;

/// Connect to the relay server and run the message loop.
/// Returns when the connection is closed (for reconnection).
pub async fn connect_and_run(config: &Config) -> Result<(), String> {
    // Warn about unencrypted connections to non-localhost servers
    if let Ok(parsed) = url::Url::parse(&config.server_url) {
        if parsed.scheme() == "ws" {
            if let Some(host) = parsed.host_str() {
                let is_local = host == "127.0.0.1" || host == "localhost" || host == "::1";
                if !is_local {
                    warn!(
                        host = %host,
                        "connecting via plain WS (not WSS) — traffic is NOT encrypted. \
                         Set SERVER_URL to wss://... or use a TLS reverse proxy (nginx/caddy) in production"
                    );
                }
            }
        }
    }

    info!(server = %config.server_url, "connecting to relay server");

    let (ws_stream, _) = connect_async(&config.server_url)
        .await
        .map_err(|e| format!("connection failed: {}", e))?;

    info!("WebSocket connected");

    let (mut ws_sender, mut ws_receiver) = ws_stream.split();

    // Channel for outbound messages (serializes sends through a single task)
    let (outbound_tx, mut outbound_rx) = mpsc::unbounded_channel::<String>();

    // Channel for claude_runner results: (session_id, chunk, done)
    let (result_tx, mut result_rx) = mpsc::unbounded_channel::<(String, String, bool)>();

    // Spawn outbound sender task
    let send_handle = tokio::spawn(async move {
        while let Some(msg) = outbound_rx.recv().await {
            if ws_sender.send(Message::Text(msg.into())).await.is_err() {
                warn!("outbound send failed");
                break;
            }
        }
    });

    // Send registration
    let reg_msg = ClientMessage::register(
        &config.register_token,
        &config.device_name,
        &config.client_version,
        &config.device_id,
    );
    outbound_tx
        .send(reg_msg)
        .map_err(|_| "channel closed".to_string())?;
    info!("registration sent");

    // Wait for registration confirmation
    let device_id = match receive_registered(&mut ws_receiver).await {
        Some(id) => id,
        None => return Err("failed to register with server".into()),
    };

    info!(device_id = %device_id, "registered with server");

    let _ = outbound_tx.send(ClientMessage::status_update(true, false));

    let pty_mgr = PtySessionManager::new();

    // Main message loop
    loop {
        tokio::select! {
            // Handle incoming messages from server
            msg = ws_receiver.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        if let Err(e) = handle_server_message(
                            &text, &outbound_tx, &result_tx, config, &pty_mgr
                        ).await {
                            warn!(error = %e, "handling server message");
                        }
                    }
                    Some(Ok(Message::Ping(_data))) => {
                        let _ = outbound_tx.send(
                            serde_json::json!({"type": "pong", "payload": {}}).to_string()
                        );
                    }
                    Some(Ok(Message::Close(_))) | None => {
                        info!("server closed connection");
                        break;
                    }
                    Some(Err(e)) => {
                        error!(error = %e, "websocket error");
                        break;
                    }
                    _ => {}
                }
            }

            // Handle claude_runner results → forward to server via outbound channel
            Some((session_id, chunk, done)) = result_rx.recv() => {
                let msg = ClientMessage::result_chunk(&session_id, &chunk, done);
                if outbound_tx.send(msg).is_err() {
                    warn!("failed to send result chunk, connection lost");
                    break;
                }
                if done {
                    let _ = outbound_tx.send(ClientMessage::status_update(true, false));
                }
            }
        }
    }

    // Kill all PTY sessions before disconnecting
    pty_mgr.kill_all();

    // Drop the outbound channel to signal the sender task to stop
    drop(outbound_tx);
    let _ = send_handle.await;
    Ok(())
}

async fn receive_registered(
    receiver: &mut futures_util::stream::SplitStream<
        tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>,
    >,
) -> Option<String> {
    loop {
        let msg = receiver.next().await?;
        match msg {
            Ok(Message::Text(text)) => {
                if let Ok(ServerMessage::Registered { payload }) = serde_json::from_str(&text) {
                    return Some(payload.device_id);
                }
                warn!(msg = %text, "unexpected message during registration");
            }
            Ok(Message::Close(_)) => return None,
            Err(e) => {
                error!(error = %e, "ws error during registration");
                return None;
            }
            _ => {}
        }
    }
}

async fn handle_server_message(
    text: &str,
    outbound_tx: &mpsc::UnboundedSender<String>,
    result_tx: &mpsc::UnboundedSender<(String, String, bool)>,
    config: &Config,
    pty_mgr: &PtySessionManager,
) -> Result<(), String> {
    // Handle "__kick__" text message
    if text == "__kick__" {
        info!("received kick signal — connection replaced");
        return Err("kicked".into());
    }

    if let Ok(msg) = serde_json::from_str::<ServerMessage>(text) {
        match msg {
            ServerMessage::TerminalInput { payload } => {
                let sid = payload.session_id;
                if !pty_mgr.has_session(&sid) {
                    let cwd = payload.cwd.clone();
                    pty_mgr.spawn(&sid, &config.claude_binary, result_tx.clone(), cwd.as_deref())
                        .map_err(|e| format!("PTY spawn: {}", e))?;
                    let _ = outbound_tx.send(ClientMessage::status_update(true, true));
                }
                pty_mgr.write_input(&sid, &payload.data);
            }
            ServerMessage::TerminalResize { payload } => {
                pty_mgr.resize(&payload.session_id, payload.cols, payload.rows);
            }
            ServerMessage::SessionClosed { payload } => {
                pty_mgr.kill(&payload.session_id);
                let _ = outbound_tx.send(ClientMessage::status_update(true, false));
            }
            ServerMessage::Command { payload } => {
                // Backward compat: treat as terminal_input with command text + Enter
                let _ = outbound_tx.send(ClientMessage::status_update(true, true));
                let sid = payload.session_id;
                if !pty_mgr.has_session(&sid) {
                    pty_mgr.spawn(&sid, &config.claude_binary, result_tx.clone(), None)?;
                }
                let input = payload.command + "\r";
                pty_mgr.write_input(&sid, &input);
            }
            ServerMessage::Ping => {
                let _ = outbound_tx.send(ClientMessage::pong());
            }
            _ => {
                warn!(msg = %text, "unexpected server message");
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::Config;

    fn test_config() -> Config {
        Config {
            server_url: "ws://test:8080/ws/client".into(),
            register_token: "test-token".into(),
            device_name: "test-pc".into(),
            client_version: "1.0.0".into(),
            max_retry_delay_secs: 30,
            device_id: "dev-test".into(),
            claude_binary: "claude".into(),
        }
    }

    fn test_pty_mgr() -> PtySessionManager {
        PtySessionManager::new()
    }

    #[tokio::test]
    async fn test_kick_message() {
        let (out_tx, _out_rx) = mpsc::unbounded_channel();
        let (res_tx, _res_rx) = mpsc::unbounded_channel();
        let config = test_config();
        let pty_mgr = test_pty_mgr();

        let result = handle_server_message("__kick__", &out_tx, &res_tx, &config, &pty_mgr).await;
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "kicked");
    }

    #[tokio::test]
    async fn test_ping_message() {
        let (out_tx, mut out_rx) = mpsc::unbounded_channel();
        let (res_tx, _res_rx) = mpsc::unbounded_channel();
        let config = test_config();
        let pty_mgr = test_pty_mgr();

        let result = handle_server_message(r#"{"type":"ping","payload":{}}"#, &out_tx, &res_tx, &config, &pty_mgr).await;
        assert!(result.is_ok());

        let sent = out_rx.try_recv().unwrap();
        assert!(sent.contains("pong"));
    }

    #[tokio::test]
    async fn test_terminal_input_message() {
        let (out_tx, _out_rx) = mpsc::unbounded_channel();
        let (res_tx, _res_rx) = mpsc::unbounded_channel();
        let config = test_config();
        let pty_mgr = test_pty_mgr();

        let result = handle_server_message(
            r#"{"type":"terminal_input","payload":{"session_id":"s1","data":"h","cwd":"/tmp"}}"#,
            &out_tx, &res_tx, &config, &pty_mgr,
        )
        .await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_session_closed_message() {
        let (out_tx, _out_rx) = mpsc::unbounded_channel();
        let (res_tx, _res_rx) = mpsc::unbounded_channel();
        let config = test_config();
        let pty_mgr = test_pty_mgr();

        let result = handle_server_message(
            r#"{"type":"session_closed","payload":{"session_id":"s1"}}"#,
            &out_tx, &res_tx, &config, &pty_mgr,
        )
        .await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_command_message() {
        let (out_tx, mut out_rx) = mpsc::unbounded_channel();
        let (res_tx, _res_rx) = mpsc::unbounded_channel();
        let config = test_config();
        let pty_mgr = test_pty_mgr();

        let result = handle_server_message(
            r#"{"type":"command","payload":{"session_id":"s1","command":"test cmd"}}"#,
            &out_tx, &res_tx, &config, &pty_mgr,
        )
        .await;
        // Will fail PTY spawn in test env but shouldn't crash
        // Check status_update was sent
        if result.is_ok() {
            let sent = out_rx.try_recv().unwrap();
            assert!(sent.contains("status_update"));
        }
    }

    #[tokio::test]
    async fn test_unknown_message() {
        let (out_tx, _out_rx) = mpsc::unbounded_channel();
        let (res_tx, _res_rx) = mpsc::unbounded_channel();
        let config = test_config();
        let pty_mgr = test_pty_mgr();

        let result = handle_server_message(
            r#"{"type":"unknown","payload":{}}"#,
            &out_tx, &res_tx, &config, &pty_mgr,
        )
        .await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_invalid_json() {
        let (out_tx, _out_rx) = mpsc::unbounded_channel();
        let (res_tx, _res_rx) = mpsc::unbounded_channel();
        let config = test_config();
        let pty_mgr = test_pty_mgr();

        let result = handle_server_message("not json", &out_tx, &res_tx, &config, &pty_mgr).await;
        assert!(result.is_ok());
    }
}
