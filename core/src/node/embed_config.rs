//! Map the wire `NodeConfig` to the embedded fiber node's `fnn::Config`.
//!
//! `fnn::FiberConfig` / `fnn::ckb::CkbConfig` keep their fields `pub(crate)`, so
//! the only external construction path is via their `ClapSerde::Opt` types: emit
//! the config.yml-shaped YAML section, parse it into `Opt`, then `FiberConfig::from`.
//! `fnn::rpc::config::RpcConfig` has all-public fields and is built directly.

use std::path::Path;

use clap_serde_derive::ClapSerde;
use serde::Serialize;

use crate::node::config_file;
use crate::wire::{CommandError, NodeConfig};

/// Build the full `fnn::Config` from the persisted wire `NodeConfig`.
pub fn fnn_config_from_wire(cfg: &NodeConfig, base_dir: &Path) -> Result<fnn::Config, CommandError> {
  let run_fiber = cfg.services.iter().any(|s| s == "fiber");
  let run_rpc = cfg.services.iter().any(|s| s == "rpc");
  let run_ckb = cfg.services.iter().any(|s| s == "ckb");
  if run_fiber && !run_ckb {
    return Err(CommandError::invalid_input(
      "fiber service requires the ckb service",
    ));
  }
  if !run_fiber {
    return Err(CommandError::invalid_input(
      "fiber service is required to run the node",
    ));
  }

  let fiber = if run_fiber {
    let yaml = serde_yaml::to_string(&fiber_section(cfg, base_dir))
      .map_err(|e| CommandError::invalid_input(format!("fiber config: {e}")))?;
    let opt: <fnn::FiberConfig as ClapSerde>::Opt = serde_yaml::from_str(&yaml)
      .map_err(|e| CommandError::invalid_input(format!("fiber config parse: {e}")))?;
    Some(fnn::FiberConfig::from(opt))
  } else {
    None
  };

  let ckb = if run_ckb {
    let yaml = serde_yaml::to_string(&ckb_section(cfg, base_dir))
      .map_err(|e| CommandError::invalid_input(format!("ckb config: {e}")))?;
    let opt: <fnn::ckb::CkbConfig as ClapSerde>::Opt = serde_yaml::from_str(&yaml)
      .map_err(|e| CommandError::invalid_input(format!("ckb config parse: {e}")))?;
    Some(fnn::ckb::CkbConfig::from(opt))
  } else {
    None
  };

  let rpc = if run_rpc {
    Some(fnn::rpc::config::RpcConfig {
      listening_addr: Some(cfg.rpc.listening_addr.clone()),
      biscuit_public_key: None,
      enabled_modules: cfg.rpc.enabled_modules.clone(),
      cors_enabled: false,
      cors_allowed_origins: Vec::new(),
    })
  } else {
    None
  };

  Ok(fnn::Config {
    fiber,
    disabled_fiber: None,
    cch: None,
    rpc,
    ckb,
    base_dir: base_dir.to_path_buf(),
    check_validate: false,
    restore: None,
  })
}

#[derive(Serialize)]
struct FiberSectionYaml<'a> {
  base_dir: String,
  chain: &'a str,
  listening_addr: &'a str,
  #[serde(skip_serializing_if = "Option::is_none")]
  announced_node_name: Option<&'a str>,
  announce_listening_addr: bool,
  #[serde(skip_serializing_if = "Vec::is_empty")]
  bootnode_addrs: Vec<String>,
  #[serde(skip_serializing_if = "Vec::is_empty")]
  announced_addrs: Vec<String>,
  #[serde(skip_serializing_if = "Vec::is_empty")]
  scripts: Vec<config_file::FiberScriptFile>,
  #[serde(skip_serializing_if = "Option::is_none")]
  standalone_watchtower_rpc_url: Option<&'a str>,
  disable_built_in_watchtower: bool,
  watchtower_check_interval_seconds: u64,
  open_channel_auto_accept_min_ckb_funding_amount: u64,
  auto_accept_channel_ckb_funding_amount: u64,
  tlc_expiry_delta: u64,
  tlc_fee_proportional_millionths: u64,
  funding_timeout_seconds: u64,
  max_inbound_peers: u64,
  min_outbound_peers: u64,
  sync_network_graph: bool,
  auto_announce_node: bool,
}

fn fiber_section<'a>(cfg: &'a NodeConfig, base_dir: &Path) -> FiberSectionYaml<'a> {
  let scripts = config_file::fiber_scripts(cfg);
  FiberSectionYaml {
    base_dir: base_dir.join("fiber").display().to_string(),
    chain: &cfg.fiber.chain,
    listening_addr: &cfg.fiber.listening_addr,
    announced_node_name: if cfg.fiber.announced_node_name.is_empty() {
      None
    } else {
      Some(&cfg.fiber.announced_node_name)
    },
    announce_listening_addr: cfg.fiber.announce_listening_addr,
    bootnode_addrs: cfg.fiber.bootnode_addrs.clone(),
    announced_addrs: cfg.fiber.announced_addrs.clone(),
    scripts,
    standalone_watchtower_rpc_url: if cfg.fiber.standalone_watchtower_rpc_url.is_empty() {
      None
    } else {
      Some(&cfg.fiber.standalone_watchtower_rpc_url)
    },
    disable_built_in_watchtower: cfg.fiber.disable_built_in_watchtower,
    watchtower_check_interval_seconds: cfg.fiber.watchtower_check_interval_seconds,
    open_channel_auto_accept_min_ckb_funding_amount: cfg
      .fiber
      .open_channel_auto_accept_min_ckb_funding_amount,
    auto_accept_channel_ckb_funding_amount: cfg.fiber.auto_accept_channel_ckb_funding_amount,
    tlc_expiry_delta: cfg.fiber.tlc_expiry_delta,
    tlc_fee_proportional_millionths: cfg.fiber.tlc_fee_proportional_millionths,
    funding_timeout_seconds: cfg.fiber.funding_timeout_seconds,
    max_inbound_peers: cfg.fiber.max_inbound_peers,
    min_outbound_peers: cfg.fiber.min_outbound_peers,
    sync_network_graph: cfg.fiber.sync_network_graph,
    auto_announce_node: cfg.fiber.auto_announce_node,
  }
}

#[derive(Serialize)]
struct CkbSectionYaml<'a> {
  base_dir: String,
  rpc_url: &'a str,
  #[serde(skip_serializing_if = "Vec::is_empty")]
  udt_whitelist: Vec<config_file::UdtWhitelistFile>,
  tx_tracing_polling_interval_ms: u64,
}

fn ckb_section<'a>(cfg: &'a NodeConfig, base_dir: &Path) -> CkbSectionYaml<'a> {
  let udt = config_file::udt_whitelist(cfg);
  CkbSectionYaml {
    base_dir: base_dir.join("ckb").display().to_string(),
    rpc_url: &cfg.ckb.rpc_url,
    udt_whitelist: udt,
    tx_tracing_polling_interval_ms: cfg.ckb.tx_tracing_polling_interval_ms,
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::mock_data;

  #[test]
  fn fnn_config_from_wire_sets_required_fields() {
    let cfg = mock_data::mock_config();
    let dir = tempfile::tempdir().unwrap();
    let base = dir.path();
    let fnn_cfg = fnn_config_from_wire(&cfg, base).unwrap();

    assert_eq!(fnn_cfg.base_dir, base);
    assert!(fnn_cfg.ckb.is_some());
    assert!(fnn_cfg.rpc.is_some());
    assert!(fnn_cfg.fiber.is_some());

    let fiber = fnn_cfg.fiber.as_ref().unwrap();
    assert_eq!(fiber.chain, "testnet");
    assert_eq!(fiber.base_dir(), &base.join("fiber"));
    assert_eq!(fiber.listening_addr(), cfg.fiber.listening_addr);

    let ckb = fnn_cfg.ckb.as_ref().unwrap();
    assert_eq!(ckb.base_dir.as_deref(), Some(base.join("ckb").as_path()));
    assert_eq!(ckb.rpc_url, cfg.ckb.rpc_url);

    let rpc = fnn_cfg.rpc.as_ref().unwrap();
    assert_eq!(rpc.listening_addr.as_deref(), Some(cfg.rpc.listening_addr.as_str()));
    assert_eq!(rpc.enabled_modules, cfg.rpc.enabled_modules);
  }

  #[test]
  fn scripts_map_into_fiber_config() {
    let cfg = mock_data::mock_config();
    let dir = tempfile::tempdir().unwrap();
    let fnn_cfg = fnn_config_from_wire(&cfg, dir.path()).unwrap();
    let fiber = fnn_cfg.fiber.as_ref().unwrap();
    assert!(!fiber.scripts.is_empty(), "scripts mapped");
    let funding = fiber
      .scripts
      .iter()
      .find(|s| matches!(s.name, fnn::ckb::contracts::Contract::FundingLock));
    assert!(funding.is_some(), "FundingLock script present");
  }

  #[test]
  fn udt_whitelist_maps_into_ckb_config() {
    let cfg = mock_data::mock_config();
    let dir = tempfile::tempdir().unwrap();
    let fnn_cfg = fnn_config_from_wire(&cfg, dir.path()).unwrap();
    let ckb = fnn_cfg.ckb.as_ref().unwrap();
    assert!(ckb.udt_whitelist.as_ref().is_some_and(|u| !u.0.is_empty()));
  }
}
