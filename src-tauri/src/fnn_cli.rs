//! fnn-cli launcher — detect the CLI binary on PATH and open a terminal that
//! runs it against the node's RPC URL.
//!
//! This is OS integration owned by the desktop host (spawning terminal apps /
//! browsers), so it lives in the Tauri shell rather than the pure
//! `opticrum-wallet-core` library. The commands in `commands.rs` stay thin —
//! they just forward here.

use std::process::{Command, Stdio};

/// The CLI binary users run against a live node. Note the binary is `fnn-cli`
/// even though the install guide points at the `fiber-cli` crate folder.
pub const FNN_CLI_BIN: &str = "fnn-cli";

/// Install docs URL, shown when the binary isn't on PATH. User-provided link;
/// the upstream crate folder is still `crates/fiber-cli`.
pub const FNN_CLI_INSTALL_URL: &str =
  "https://github.com/nervosnetwork/fiber/tree/develop/crates/fiber-cli";

/// Wire-shaped status for `node.fnn_cli_status`.
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FnnCliStatus {
  pub installed: bool,
  /// Install docs URL — the frontend jumps here when `installed` is false.
  pub install_url: String,
}

/// Whether `fnn-cli` resolves on the user's PATH.
pub fn is_installed() -> bool {
  #[cfg(target_os = "windows")]
  {
    Command::new("cmd")
      .args(["/c", "where", FNN_CLI_BIN])
      .stdout(Stdio::null())
      .stderr(Stdio::null())
      .status()
      .map(|s| s.success())
      .unwrap_or(false)
  }
  #[cfg(not(target_os = "windows"))]
  {
    Command::new("sh")
      .arg("-c")
      .arg(format!("command -v {FNN_CLI_BIN}"))
      .stdout(Stdio::null())
      .stderr(Stdio::null())
      .status()
      .map(|s| s.success())
      .unwrap_or(false)
  }
}

/// Open a terminal window that runs `fnn-cli -u <url>` and keeps the session
/// alive so the user can drive the CLI interactively.
pub fn open_terminal(url: &str) -> Result<(), String> {
  let line = format!("{FNN_CLI_BIN} -u {url}");

  #[cfg(target_os = "macos")]
  {
    // AppleScript: focus Terminal.app and run the command in a fresh session
    // (the shell stays live after the CLI exits, so the user can keep typing).
    let script = format!(
      "tell application \"Terminal\"\n  activate\n  do script \"{}\"\nend tell",
      line.replace('\\', "\\\\").replace('"', "\\\"")
    );
    run("osascript", ["-e", &script])
  }

  #[cfg(target_os = "linux")]
  {
    // Best-effort: prefer a generic terminal emulator. The trailing `exec`
    // keeps the window open after the CLI exits.
    let run_line = format!("{line}; exec \"$SHELL\"");
    run("x-terminal-emulator", ["-e", "sh", "-c", &run_line])
  }

  #[cfg(target_os = "windows")]
  {
    // Best-effort: a new cmd window that stays open (`/k`).
    run("cmd", ["/c", "start", "fnn-cli", "cmd", "/k", &line])
  }
}

/// Open a URL in the platform's default browser.
pub fn open_url(url: &str) -> Result<(), String> {
  #[cfg(target_os = "macos")]
  {
    run("open", [url])
  }
  #[cfg(target_os = "linux")]
  {
    run("xdg-open", [url])
  }
  #[cfg(target_os = "windows")]
  {
    run("cmd", ["/c", "start", "", url])
  }
}

/// Run a command, mapping spawn/exit failures to a message string.
fn run<P: AsRef<std::ffi::OsStr>>(
  program: &str,
  args: impl IntoIterator<Item = P>,
) -> Result<(), String> {
  Command::new(program)
    .args(args)
    .status()
    .map_err(|e| format!("failed to run `{program}`: {e}"))
    .and_then(|s| {
      if s.success() {
        Ok(())
      } else {
        Err(format!("`{program}` exited with {s}"))
      }
    })
}
