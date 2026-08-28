//! Fiber node `config.yml` writer.
//!
//! The wire `NodeConfig` is frontend-shaped; the fiber `fnn` binary expects a
//! specific `config.yml` layout (nested `script:` maps, `type_id:`/`cell_dep:`
//! tags, `out_point:` nesting). This maps the wire shape to that layout and
//! writes it to `$base_dir/config.yml`, which `fnn --dir $base_dir` loads.

use std::path::Path;

use serde::Serialize;

use crate::wire::CommandError;
use crate::wire::{NodeConfig, ScriptCellDep};

#[derive(Serialize)]
pub(crate) struct FiberConfigFile {
  fiber: FiberSection,
  rpc: RpcSection,
  ckb: CkbSection,
  services: Vec<String>,
}

#[derive(Serialize)]
pub(crate) struct FiberSection {
  listening_addr: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  announced_node_name: Option<String>,
  #[serde(skip_serializing_if = "Vec::is_empty")]
  bootnode_addrs: Vec<String>,
  announce_listening_addr: bool,
  #[serde(skip_serializing_if = "Vec::is_empty")]
  announced_addrs: Vec<String>,
  chain: String,
  #[serde(skip_serializing_if = "Vec::is_empty")]
  scripts: Vec<FiberScriptFile>,
  #[serde(skip_serializing_if = "Option::is_none")]
  standalone_watchtower_rpc_url: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  standalone_watchtower_token: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  disable_built_in_watchtower: Option<bool>,
}

#[derive(Serialize)]
pub(crate) struct FiberScriptFile {
  name: String,
  script: ScriptFile,
  #[serde(skip_serializing_if = "Vec::is_empty")]
  cell_deps: Vec<ScriptCellDepFile>,
}

#[derive(Serialize)]
pub(crate) struct ScriptFile {
  code_hash: String,
  hash_type: String,
  args: String,
}

#[derive(Serialize)]
pub(crate) struct CellDepFile {
  out_point: OutPointFile,
  dep_type: String,
}

#[derive(Serialize)]
pub(crate) struct OutPointFile {
  tx_hash: String,
  index: String,
}

#[derive(Serialize)]
#[serde(untagged)]
enum ScriptCellDepFile {
  TypeId { type_id: ScriptFile },
  CellDep { cell_dep: CellDepFile },
}

#[derive(Serialize)]
pub(crate) struct RpcSection {
  listening_addr: String,
  #[serde(skip_serializing_if = "Vec::is_empty")]
  enabled_modules: Vec<String>,
}

#[derive(Serialize)]
pub(crate) struct CkbSection {
  rpc_url: String,
  #[serde(skip_serializing_if = "Vec::is_empty")]
  udt_whitelist: Vec<UdtWhitelistFile>,
}

#[derive(Serialize)]
pub(crate) struct UdtWhitelistFile {
  name: String,
  script: ScriptFile,
  #[serde(skip_serializing_if = "Vec::is_empty")]
  cell_deps: Vec<ScriptCellDepFile>,
  #[serde(skip_serializing_if = "Option::is_none")]
  auto_accept_amount: Option<u64>,
}

fn non_empty(s: String) -> Option<String> {
  if s.is_empty() {
    None
  } else {
    Some(s)
  }
}

fn script(code_hash: &str, hash_type: &str, args: &str) -> ScriptFile {
  ScriptFile {
    code_hash: code_hash.to_string(),
    hash_type: hash_type.to_string(),
    args: args.to_string(),
  }
}

fn wire_cell_dep(d: &ScriptCellDep) -> ScriptCellDepFile {
  match d {
    ScriptCellDep::TypeId {
      code_hash,
      hash_type,
      args,
    } => ScriptCellDepFile::TypeId {
      type_id: script(code_hash, hash_type, args),
    },
    ScriptCellDep::CellDep {
      tx_hash,
      index,
      dep_type,
    } => ScriptCellDepFile::CellDep {
      cell_dep: CellDepFile {
        out_point: OutPointFile {
          tx_hash: tx_hash.clone(),
          index: index.clone(),
        },
        dep_type: dep_type.clone(),
      },
    },
  }
}

/// The wire contract scripts in fiber config.yml shape (shared with the
/// embedded-node config mapping).
pub(crate) fn fiber_scripts(cfg: &NodeConfig) -> Vec<FiberScriptFile> {
  cfg
    .scripts
    .iter()
    .map(|s| FiberScriptFile {
      name: s.name.clone(),
      script: script(&s.code_hash, &s.hash_type, &s.args),
      cell_deps: s.cell_deps.iter().map(wire_cell_dep).collect(),
    })
    .collect()
}

/// The wire UDT whitelist in fiber config.yml shape (shared with the
/// embedded-node config mapping).
pub(crate) fn udt_whitelist(cfg: &NodeConfig) -> Vec<UdtWhitelistFile> {
  cfg
    .udt_whitelist
    .iter()
    .map(|u| UdtWhitelistFile {
      name: u.name.clone(),
      script: script(&u.code_hash, &u.hash_type, &u.args),
      cell_deps: u
        .cell_deps
        .clone()
        .unwrap_or_default()
        .iter()
        .map(wire_cell_dep)
        .collect(),
      auto_accept_amount: (u.auto_accept_amount != 0).then_some(u.auto_accept_amount),
    })
    .collect()
}

fn wire_to_config_file(cfg: &NodeConfig) -> FiberConfigFile {
  FiberConfigFile {
    fiber: FiberSection {
      listening_addr: cfg.fiber.listening_addr.clone(),
      announced_node_name: non_empty(cfg.fiber.announced_node_name.clone()),
      bootnode_addrs: cfg.fiber.bootnode_addrs.clone(),
      announce_listening_addr: cfg.fiber.announce_listening_addr,
      announced_addrs: cfg.fiber.announced_addrs.clone(),
      chain: cfg.fiber.chain.clone(),
      scripts: fiber_scripts(cfg),
      standalone_watchtower_rpc_url: non_empty(cfg.fiber.standalone_watchtower_rpc_url.clone()),
      standalone_watchtower_token: non_empty(cfg.fiber.standalone_watchtower_token.clone()),
      disable_built_in_watchtower: Some(cfg.fiber.disable_built_in_watchtower),
    },
    rpc: RpcSection {
      listening_addr: cfg.rpc.listening_addr.clone(),
      enabled_modules: cfg.rpc.enabled_modules.clone(),
    },
    ckb: CkbSection {
      rpc_url: cfg.ckb.rpc_url.clone(),
      udt_whitelist: udt_whitelist(cfg),
    },
    services: cfg.services.clone(),
  }
}

/// Write a fiber `config.yml` into `base_dir`; returns the file path.
pub fn write_fiber_config(
  cfg: &NodeConfig,
  base_dir: &Path,
) -> Result<std::path::PathBuf, CommandError> {
  std::fs::create_dir_all(base_dir).map_err(|e| CommandError::io(e.to_string()))?;
  let yaml = serde_yaml::to_string(&wire_to_config_file(cfg))
    .map_err(|e| CommandError::io(format!("serialize fiber config: {e}")))?;
  let path = base_dir.join("config.yml");
  std::fs::write(&path, yaml).map_err(|e| CommandError::io(e.to_string()))?;
  Ok(path)
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::node::default_config::default_config;

  #[test]
  fn writes_expected_yaml_layout() {
    let dir = tempfile::tempdir().unwrap();
    let cfg = default_config();
    let path = write_fiber_config(&cfg, dir.path()).unwrap();
    let yaml = std::fs::read_to_string(&path).unwrap();

    assert!(
      yaml.contains("listening_addr: /ip4/0.0.0.0/tcp/8228"),
      "{yaml}"
    );
    assert!(yaml.contains("chain: testnet"));
    // nested script maps for the contract scripts
    assert!(yaml.contains("name: FundingLock"));
    assert!(yaml.contains("script:"));
    assert!(yaml.contains("type_id:"));
    assert!(yaml.contains("cell_dep:"));
    assert!(yaml.contains("out_point:"));
    assert!(yaml.contains("services:"));
    // udt whitelist nested
    assert!(yaml.contains("udt_whitelist:"));
    assert!(yaml.contains("name: RUSD"));
  }

  #[test]
  fn writes_standalone_watchtower_token() {
    let dir = tempfile::tempdir().unwrap();
    let mut cfg = default_config();
    cfg.fiber.standalone_watchtower_token = "abc.biscuit".into();
    let path = write_fiber_config(&cfg, dir.path()).unwrap();
    let yaml = std::fs::read_to_string(&path).unwrap();
    assert!(
      yaml.contains("standalone_watchtower_token: abc.biscuit")
        || yaml.contains("standalone_watchtower_token: \"abc.biscuit\""),
      "{yaml}"
    );
  }
}
