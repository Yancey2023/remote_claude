use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc;
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;
use tracing::{error, info, warn};

use crate::claude_runner;
use crate::config::Config;
use crate::protocol::{ClientMessage, ServerMessage};

/// Connect to the relay server and run the message loop.
/// Returns when the connection is closed (for reconnection).
pub async fn connect_and_run(config: &Config) -> Result<(), String> {
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

    // Main message loop
    loop {
        tokio::select! {
            // Handle incoming messages from server
            msg = ws_receiver.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        if let Err(e) = handle_server_message(
                            &text, &outbound_tx, &result_tx
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
) -> Result<(), String> {
    // Handle "__kick__" text message
    if text == "__kick__" {
        info!("received kick signal — connection replaced");
        return Err("kicked".into());
    }

    if let Ok(msg) = serde_json::from_str::<ServerMessage>(text) {
        match msg {
            ServerMessage::Command { payload } => {
                // Send status: busy
                let _ = outbound_tx.send(ClientMessage::status_update(true, true));

                // Run claude in background task
                let tx = result_tx.clone();
                let cmd = payload.command;
                let sid = payload.session_id;
                tokio::spawn(async move {
                    claude_runner::run_claude(&cmd, sid, tx).await;
                });
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

    #[tokio::test]
    async fn test_kick_message() {
        let (out_tx, _out_rx) = mpsc::unbounded_channel();
        let (res_tx, _res_rx) = mpsc::unbounded_channel();

        let result = handle_server_message("__kick__", &out_tx, &res_tx).await;
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "kicked");
    }

    #[tokio::test]
    async fn test_ping_message() {
        let (out_tx, mut out_rx) = mpsc::unbounded_channel();
        let (res_tx, _res_rx) = mpsc::unbounded_channel();

        let result = handle_server_message(r#"{"type":"ping","payload":{}}"#, &out_tx, &res_tx).await;
        assert!(result.is_ok());

        // Check pong was sent
        let sent = out_rx.try_recv().unwrap();
        assert!(sent.contains("pong"));
    }

    #[tokio::test]
    async fn test_command_message() {
        let (out_tx, mut out_rx) = mpsc::unbounded_channel();
        let (res_tx, _res_rx) = mpsc::unbounded_channel();

        let result = handle_server_message(
            r#"{"type":"command","payload":{"session_id":"s1","command":"test cmd"}}"#,
            &out_tx, &res_tx,
        )
        .await;
        assert!(result.is_ok());

        // Should send status_update(busy=true)
        let sent = out_rx.try_recv().unwrap();
        assert!(sent.contains("status_update"));
        assert!(sent.contains("true")); // busy
    }

    #[tokio::test]
    async fn test_unknown_message() {
        let (out_tx, _out_rx) = mpsc::unbounded_channel();
        let (res_tx, _res_rx) = mpsc::unbounded_channel();

        let result = handle_server_message(
            r#"{"type":"unknown","payload":{}}"#,
            &out_tx, &res_tx,
        )
        .await;
        assert!(result.is_ok()); // unknown types are ignored, not errors
    }

    #[tokio::test]
    async fn test_invalid_json() {
        let (out_tx, _out_rx) = mpsc::unbounded_channel();
        let (res_tx, _res_rx) = mpsc::unbounded_channel();

        let result = handle_server_message("not json", &out_tx, &res_tx).await;
        assert!(result.is_ok()); // invalid JSON is silently ignored
    }
}
