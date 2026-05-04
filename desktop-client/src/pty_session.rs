use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::{mpsc, Arc, Mutex};
use tokio::sync::mpsc::UnboundedSender;
use tracing::{info, warn};

#[derive(Debug, Clone, PartialEq, Eq)]
struct LaunchCommand {
    program: String,
    args: Vec<String>,
}

/// Remove embedded NULs and surrounding whitespace from process launch values.
/// Returns `None` when the cleaned value is empty.
fn sanitize_spawn_value(raw: &str) -> Option<String> {
    let cleaned = raw.replace('\0', "");
    let trimmed = cleaned.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn resolve_launch_command(name: &str) -> Result<LaunchCommand, String> {
    let cleaned = sanitize_spawn_value(name)
        .ok_or_else(|| "claude binary path is empty after sanitization".to_string())?;

    #[cfg(target_os = "windows")]
    {
        Ok(resolve_windows_launch_command(&cleaned))
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(LaunchCommand {
            program: cleaned,
            args: Vec::new(),
        })
    }
}

#[cfg(target_os = "windows")]
fn resolve_windows_launch_command(name: &str) -> LaunchCommand {
    let binary = resolve_binary(name);
    if is_cmd_script(&binary) || Path::new(&binary).extension().is_none() {
        LaunchCommand {
            program: "cmd.exe".to_string(),
            args: vec!["/D".to_string(), "/C".to_string(), binary],
        }
    } else {
        LaunchCommand {
            program: binary,
            args: Vec::new(),
        }
    }
}

#[cfg(target_os = "windows")]
fn is_cmd_script(path: &str) -> bool {
    Path::new(path)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("cmd") || ext.eq_ignore_ascii_case("bat"))
        .unwrap_or(false)
}

/// Resolve a binary for Windows spawn:
/// 1) direct path with extension
/// 2) add executable/script extension next to provided path
/// 3) if a bare command name, search PATH and prefer .exe/.cmd/.bat
/// 4) fallback to original value
#[cfg(target_os = "windows")]
fn resolve_binary(name: &str) -> String {
    let p = Path::new(name);
    if p.extension().is_some() {
        return name.to_string();
    }

    for ext in &["exe", "cmd", "bat"] {
        let candidate = p.with_extension(ext);
        if candidate.is_file() {
            return candidate.to_string_lossy().to_string();
        }
    }

    let looks_like_path = name.contains('\\') || name.contains('/') || name.contains(':');
    if !looks_like_path {
        if let Some(candidate) = resolve_from_path(name) {
            return candidate;
        }
    }

    name.to_string()
}

#[cfg(target_os = "windows")]
fn resolve_from_path(name: &str) -> Option<String> {
    let path_var = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path_var) {
        let base = dir.join(name);
        if base.is_file() {
            return Some(base.to_string_lossy().to_string());
        }
        for ext in &["exe", "cmd", "bat"] {
            let candidate = base.with_extension(ext);
            if candidate.is_file() {
                return Some(candidate.to_string_lossy().to_string());
            }
        }
    }
    None
}

#[cfg(not(target_os = "windows"))]
fn resolve_binary(name: &str) -> String {
    name.to_string()
}

pub struct PtySessionManager {
    sessions: Arc<Mutex<HashMap<String, PtyHandle>>>,
}

struct PtyHandle {
    input_tx: mpsc::Sender<String>,
    resize_tx: mpsc::Sender<PtySize>,
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
        cwd: Option<&str>,
    ) -> Result<(), String> {
        let sid = session_id.to_string();
        let launch = resolve_launch_command(claude_binary)?;
        let launch_label = sanitize_spawn_value(claude_binary)
            .unwrap_or_else(|| claude_binary.to_string());
        let cwd_owned = cwd.and_then(sanitize_spawn_value);

        let (input_tx, input_rx) = mpsc::channel::<String>();
        let (resize_tx, resize_rx) = mpsc::channel::<PtySize>();
        let child_killer: Arc<Mutex<Option<Box<dyn ChildKiller + Send>>>> = Arc::new(Mutex::new(None));

        // Store handle synchronously so write_input works immediately.
        // Clone input_tx for the handle, then drop the original so the channel
        // closes as soon as the session handle is removed (unblocking the writer).
        let handle_input_tx = input_tx.clone();
        {
            let mut sessions = self.sessions.lock().unwrap();
            sessions.insert(
                sid.clone(),
                PtyHandle {
                    input_tx: handle_input_tx,
                    resize_tx: resize_tx.clone(),
                    child_killer: child_killer.clone(),
                },
            );
        }
        drop(input_tx);

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

            let mut cmd = CommandBuilder::new(&launch.program);
            for arg in &launch.args {
                cmd.arg(arg);
            }
            if let Some(ref dir) = cwd_owned {
                cmd.cwd(dir);
            }
            let mut child = match pair.slave.spawn_command(cmd) {
                Ok(c) => c,
                Err(e) => {
                    let _ = result_tx.send((
                        sid_output.clone(),
                        format!("\r\n\x1b[1;31mCannot start {}: {}\x1b[0m\r\n", launch_label, e),
                        true,
                    ));
                    sessions.lock().unwrap().remove(&sid_output);
                    return;
                }
            };

            let master: Box<dyn MasterPty + Send> = pair.master;

            let mut reader = match master.try_clone_reader() {
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

            let mut writer = match master.take_writer() {
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

            // Resize worker: applies terminal size updates to PTY.
            let sid_resize = sid_output.clone();
            std::thread::spawn(move || {
                for new_size in resize_rx {
                    if let Err(e) = master.resize(new_size) {
                        warn!(
                            session_id = %sid_resize,
                            cols = new_size.cols,
                            rows = new_size.rows,
                            error = %e,
                            "PTY resize failed"
                        );
                    }
                }
            });

            // Set the child_killer now that the process is running
            *child_killer.lock().unwrap() = Some(child.clone_killer());

            info!(session_id = %sid_output, "PTY session started");

            // Spawn child-watcher thread that waits for the child to exit.
            // This is essential on Windows where ConPTY may never signal
            // EOF/error through the reader when the PTY child terminates.
            let sid_watch = sid_output.clone();
            let tx_watch = result_tx.clone();
            let sessions_watch = sessions.clone();
            std::thread::spawn(move || {
                if let Err(e) = child.wait() {
                    warn!(session_id = %sid_watch, error = %e, "waiting for PTY child failed");
                }
                info!(session_id = %sid_watch, "PTY child process exited via watcher");
                // Remove session handle (unblocks writer loop) and signal done.
                sessions_watch.lock().unwrap().remove(&sid_watch);
                let _ = tx_watch.send((sid_watch.clone(), String::new(), true));
            });

            // Spawn stdout reader thread
            let sid_read = sid_output.clone();
            let tx_read = result_tx.clone();
            let sessions_read = sessions.clone();
            std::thread::spawn(move || {
                let mut buf = [0u8; 4096];
                loop {
                    match reader.read(&mut buf) {
                        Ok(0) => {
                            // PTY child exited (e.g. /exit) — signal done and remove
                            // the session handle so the writer loop unblocks too.
                            let _ = tx_read.send((sid_read.clone(), String::new(), true));
                            sessions_read.lock().unwrap().remove(&sid_read);
                            break;
                        }
                        Ok(n) => {
                            let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
                            if tx_read.send((sid_read.clone(), chunk, false)).is_err() {
                                break;
                            }
                        }
                        Err(e) => {
                            // PTY child process likely exited (e.g. ConPTY returns
                            // ERROR_BROKEN_PIPE on Windows, not Ok(0)). Treat as done
                            // and remove the session handle to unblock the writer loop.
                            let _ = tx_read.send((
                                sid_read.clone(),
                                format!("\r\n\x1b[1;31m[PTY read error: {}]\x1b[0m\r\n", e),
                                true,
                            ));
                            sessions_read.lock().unwrap().remove(&sid_read);
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
            // Child already waited for by watcher thread.

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

    pub fn resize(&self, session_id: &str, cols: u16, rows: u16) {
        let resize_tx = {
            let sessions = self.sessions.lock().unwrap();
            sessions.get(session_id).map(|h| h.resize_tx.clone())
        };

        if let Some(tx) = resize_tx {
            let size = PtySize {
                cols: cols.max(1),
                rows: rows.max(1),
                pixel_width: 0,
                pixel_height: 0,
            };
            if tx.send(size).is_err() {
                warn!(session_id = %session_id, "PTY resize channel closed");
            }
        }
    }

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_spawn_value() {
        assert_eq!(sanitize_spawn_value("  claude  "), Some("claude".to_string()));
        assert_eq!(
            sanitize_spawn_value(" \0C:\\tools\\claude\0 "),
            Some("C:\\tools\\claude".to_string())
        );
        assert_eq!(sanitize_spawn_value(" \0 \t "), None);
    }

    #[test]
    fn test_resolve_launch_command_rejects_empty() {
        assert!(resolve_launch_command("").is_err());
        assert!(resolve_launch_command(" \0 ").is_err());
    }

    #[test]
    fn test_resolve_binary_keeps_extension() {
        assert_eq!(resolve_binary("claude.exe"), "claude.exe");
        assert_eq!(resolve_binary("claude.cmd"), "claude.cmd");
        assert_eq!(resolve_binary("/usr/bin/claude"), "/usr/bin/claude");
    }

    #[test]
    fn test_resolve_binary_fallback_when_not_found() {
        // A name with no matching file on disk returns as-is.
        // The binary will fail to launch later, but that's a user configuration issue.
        let resolved = resolve_binary("nonexistent-binary-name");
        assert_eq!(resolved, "nonexistent-binary-name");
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_windows_cmd_script_is_wrapped_with_cmd_exe() {
        let launch = resolve_windows_launch_command("claude.cmd");
        assert!(launch.program.eq_ignore_ascii_case("cmd.exe"));
        assert_eq!(launch.args, vec!["/D", "/C", "claude.cmd"]);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_windows_extensionless_is_wrapped_with_cmd_exe() {
        let launch = resolve_windows_launch_command("claude");
        assert!(launch.program.eq_ignore_ascii_case("cmd.exe"));
        assert_eq!(launch.args[0], "/D");
        assert_eq!(launch.args[1], "/C");
    }
}
