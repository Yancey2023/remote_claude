use portable_pty::{CommandBuilder, PtySize, PtySystem, ChildKiller, native_pty_system};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex, mpsc};
use tokio::sync::mpsc::UnboundedSender;
use tracing::{error, info, warn};

pub struct PtySessionManager {
    sessions: Arc<Mutex<HashMap<String, PtyHandle>>>,
}

struct PtyHandle {
    input_tx: mpsc::Sender<String>,
    child_killer: Arc<Mutex<Option<Box<dyn ChildKiller + Send>>>>,
}

impl PtySessionManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn has_session(&self, session_id: &str) -> bool {
        self.sessions.lock().unwrap().contains_key(session_id)
    }

    /// Spawn interactive `claude` in a PTY for the given session.
    /// The handle (input channel) is stored synchronously before the thread starts,
    /// so `write_input` works immediately after this returns.
    pub fn spawn(
        &self,
        session_id: &str,
        claude_binary: &str,
        result_tx: UnboundedSender<(String, String, bool)>,
    ) -> Result<(), String> {
        let sid = session_id.to_string();
        let binary = claude_binary.to_string();

        let (input_tx, input_rx) = mpsc::channel::<String>();
        let child_killer: Arc<Mutex<Option<Box<dyn ChildKiller + Send>>>> = Arc::new(Mutex::new(None));

        // Store handle synchronously so write_input works immediately
        {
            let mut sessions = self.sessions.lock().unwrap();
            sessions.insert(
                sid.clone(),
                PtyHandle {
                    input_tx: input_tx.clone(),
                    child_killer: child_killer.clone(),
                },
            );
        }

        let sessions = self.sessions.clone();
        let sid_output = sid.clone();

        std::thread::spawn(move || {
            let pty_system = native_pty_system();
            let size = PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            };

            let pair = match pty_system.openpty(size) {
                Ok(p) => p,
                Err(e) => {
                    let _ = result_tx.send((
                        sid_output.clone(),
                        format!("\r\n\x1b[1;31mPTY open error: {}\x1b[0m\r\n", e),
                        true,
                    ));
                    sessions.lock().unwrap().remove(&sid_output);
                    return;
                }
            };

            let cmd = CommandBuilder::new(&binary);
            let mut child = match pair.slave.spawn_command(cmd) {
                Ok(c) => c,
                Err(e) => {
                    let _ = result_tx.send((
                        sid_output.clone(),
                        format!("\r\n\x1b[1;31mCannot start {}: {}\x1b[0m\r\n", binary, e),
                        true,
                    ));
                    sessions.lock().unwrap().remove(&sid_output);
                    return;
                }
            };

            let mut reader = match pair.master.try_clone_reader() {
                Ok(r) => r,
                Err(e) => {
                    let _ = result_tx.send((
                        sid_output.clone(),
                        format!("\r\n\x1b[1;31mPTY reader error: {}\x1b[0m\r\n", e),
                        true,
                    ));
                    sessions.lock().unwrap().remove(&sid_output);
                    return;
                }
            };

            let mut writer = match pair.master.take_writer() {
                Ok(w) => w,
                Err(e) => {
                    let _ = result_tx.send((
                        sid_output.clone(),
                        format!("\r\n\x1b[1;31mPTY writer error: {}\x1b[0m\r\n", e),
                        true,
                    ));
                    sessions.lock().unwrap().remove(&sid_output);
                    return;
                }
            };

            // Set the child_killer now that the process is running
            *child_killer.lock().unwrap() = Some(child.clone_killer());

            info!(session_id = %sid_output, "PTY session started");

            // Spawn stdout reader thread
            let sid_read = sid_output.clone();
            let tx_read = result_tx.clone();
            std::thread::spawn(move || {
                let mut buf = [0u8; 4096];
                loop {
                    match reader.read(&mut buf) {
                        Ok(0) => break,
                        Ok(n) => {
                            let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
                            if tx_read.send((sid_read.clone(), chunk, false)).is_err() {
                                break;
                            }
                        }
                        Err(e) => {
                            let _ = tx_read.send((
                                sid_read.clone(),
                                format!("\r\n\x1b[1;31m[PTY read error: {}]\x1b[0m\r\n", e),
                                false,
                            ));
                            break;
                        }
                    }
                }
            });

            // Main writer loop: stdin → PTY
            for data in input_rx {
                if writer.write_all(data.as_bytes()).is_err() {
                    break;
                }
                let _ = writer.flush();
            }

            // Cleanup
            info!(session_id = %sid_output, "PTY session writer loop ended");
            let _ = child.kill();
            let _ = child.wait();

            sessions.lock().unwrap().remove(&sid_output);
            let _ = result_tx.send((sid_output, String::new(), true));
        });

        Ok(())
    }

    /// Write raw data to the PTY stdin for an active session.
    pub fn write_input(&self, session_id: &str, data: &str) {
        let sessions = self.sessions.lock().unwrap();
        if let Some(handle) = sessions.get(session_id) {
            if handle.input_tx.send(data.to_string()).is_err() {
                warn!(session_id = %session_id, "PTY input channel closed");
            }
        }
    }

    #[allow(unused)]
    pub fn resize(&self, _session_id: &str, _cols: u16, _rows: u16) {}

    /// Kill a specific PTY session.
    pub fn kill(&self, session_id: &str) {
        let mut sessions = self.sessions.lock().unwrap();
        if let Some(handle) = sessions.remove(session_id) {
            info!(session_id = %session_id, "killing PTY session");
            if let Some(mut killer) = handle.child_killer.lock().unwrap().take() {
                let _ = killer.kill();
            }
        }
    }

    /// Kill all active PTY sessions (on WS disconnect).
    pub fn kill_all(&self) {
        let mut sessions = self.sessions.lock().unwrap();
        for (sid, handle) in sessions.drain() {
            info!(session_id = %sid, "killing PTY session");
            if let Some(mut killer) = handle.child_killer.lock().unwrap().take() {
                let _ = killer.kill();
            }
        }
    }
}
