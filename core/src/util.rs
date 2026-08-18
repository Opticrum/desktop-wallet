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
