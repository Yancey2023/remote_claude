use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::mpsc;
use tracing::{error, info};

/// Run a prompt through the local Claude CLI in `--print` mode.
/// `claude_binary` is the path/name of the Claude CLI executable.
pub async fn run_claude(
    prompt: &str,
    session_id: String,
    result_tx: mpsc::UnboundedSender<(String, String, bool)>,
    claude_binary: &str,
) {
    info!(session_id = %session_id, prompt_len = %prompt.len(), claude_binary = %claude_binary, "running claude command");

    let mut child = match Command::new(claude_binary)
        .args(["-p", prompt])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(e) => {
            error!(error = %e, binary = %claude_binary, "failed to spawn claude process");
            let _ = result_tx.send((session_id, format!("Error: cannot start {}: {}", claude_binary, e), true));
            return;
        }
    };

    let stdout = child.stdout.take().expect("stdout not captured");
    let stderr = child.stderr.take().expect("stderr not captured");

    let tx_stdout = result_tx.clone();
    let sid_out = session_id.clone();

    // Read stdout line by line
    let stdout_handle = tokio::spawn(async move {
        let mut count = 0u32;
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            count += 1;
            if tx_stdout.send((sid_out.clone(), line, false)).is_err() {
                break;
            }
        }
        count
    });

    // Read stderr and send as error notes
    let tx_stderr = result_tx.clone();
    let sid_err = session_id.clone();
    let stderr_handle = tokio::spawn(async move {
        let mut count = 0u32;
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            count += 1;
            if tx_stderr
                .send((sid_err.clone(), format!("[stderr] {}", line), false))
                .is_err()
            {
                break;
            }
        }
        count
    });

    // Wait for process and reader tasks
    let (stdout_result, stderr_result) = tokio::join!(stdout_handle, stderr_handle);

    let stdout_lines = stdout_result.unwrap_or(0);
    let stderr_lines = stderr_result.unwrap_or(0);

    let status = child.wait().await;
    match status {
        Ok(exit) => {
            info!(session_id = %session_id, exit_code = %exit, stdout_lines, stderr_lines, "claude process finished");
        }
        Err(e) => {
            error!(session_id = %session_id, error = %e, "failed to wait for claude");
        }
    }

    let _ = result_tx.send((session_id, String::new(), true));
}
