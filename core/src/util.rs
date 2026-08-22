//! Small shared helpers used by the real backend (kept out of the mock layer,
//! which has been removed).

use std::time::{SystemTime, UNIX_EPOCH};

use crate::wire::{Chain, NodeConfig, WatchtowerConfig, WatchtowerMode};

/// Current wall-clock in ms — stamps locally-created sidecar entries.
pub fn now_ms() -> u64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_millis() as u64)
    .unwrap_or(0)
}

/// Derive the watchtower mode from the persisted NodeConfig.
pub fn watchtower_from_config(config: &NodeConfig) -> WatchtowerConfig {
  let url = config.fiber.standalone_watchtower_rpc_url.trim();
  if !url.is_empty() {
    WatchtowerConfig {
      mode: WatchtowerMode::Standalone,
      endpoint: Some(url.to_string()),
    }
  } else if config.fiber.disable_built_in_watchtower {
    WatchtowerConfig {
      mode: WatchtowerMode::Disabled,
      endpoint: None,
    }
  } else {
    WatchtowerConfig {
      mode: WatchtowerMode::Builtin,
      endpoint: None,
    }
  }
}

pub fn parse_chain(s: &str) -> Chain {
  if s.eq_ignore_ascii_case("mainnet") {
    Chain::Mainnet
  } else {
    Chain::Testnet
  }
}

/// Map a Fiber `node_info.chain_hash` onto the wallet's Chain enum.
/// Unknown hashes fall back to testnet (the desktop default).
pub fn chain_from_hash(hash: &str) -> Chain {
  const MAINNET: &str = "92b197aa1fba0f63633922c61c92375c9c074a93e85963554f5499fe1450d0e5";
  let h = hash.trim_start_matches("0x").to_ascii_lowercase();
  if h == MAINNET {
    Chain::Mainnet
  } else {
    Chain::Testnet
  }
}
