//! Persistence for the node-target switcher (`data/node-targets.json`).
//!
//! Independent of fiber's `config.yml` / `node-config.json` — those belong to
//! the embedded node. This file is only the desktop's list of remote RPCs
//! plus which target is currently active.

use std::path::{Path, PathBuf};

use rand::RngCore;
use serde::{Deserialize, Serialize};

use super::fiber_client::BUILTIN_ID;
use crate::wire::{CommandError, ExternalTarget};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredExternal {
  pub id: String,
  pub alias: String,
  pub rpc_url: String,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub auth_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetsFile {
  #[serde(default = "default_active")]
  pub active_id: String,
  #[serde(default)]
  pub externals: Vec<StoredExternal>,
}

fn default_active() -> String {
  BUILTIN_ID.into()
}

impl Default for TargetsFile {
  fn default() -> Self {
    Self {
      active_id: BUILTIN_ID.into(),
      externals: Vec::new(),
    }
  }
}

impl TargetsFile {
  pub fn load(path: &Path) -> Self {
    match std::fs::read_to_string(path) {
      Ok(s) => serde_json::from_str(&s).unwrap_or_default(),
      Err(_) => Self::default(),
    }
  }

  pub fn persist(&self, path: &Path) -> Result<(), CommandError> {
    if let Some(parent) = path.parent() {
      if !parent.as_os_str().is_empty() {
        std::fs::create_dir_all(parent).map_err(|e| CommandError::io(e.to_string()))?;
      }
    }
    let s = serde_json::to_string_pretty(self).map_err(|e| CommandError::io(e.to_string()))?;
    std::fs::write(path, s).map_err(|e| CommandError::io(e.to_string()))
  }

  pub fn find(&self, id: &str) -> Option<&StoredExternal> {
    self.externals.iter().find(|e| e.id == id)
  }

  pub fn to_wire_externals(&self) -> Vec<ExternalTarget> {
    self
      .externals
      .iter()
      .map(|e| ExternalTarget {
        id: e.id.clone(),
        alias: e.alias.clone(),
        rpc_url: e.rpc_url.clone(),
        auth_token: e.auth_token.clone(),
      })
      .collect()
  }
}

pub fn new_external_id() -> String {
  let mut buf = [0u8; 8];
  rand::thread_rng().fill_bytes(&mut buf);
  hex::encode(buf)
}

pub fn targets_path_beside(node_config_path: &Path) -> PathBuf {
  node_config_path
    .parent()
    .unwrap_or(Path::new("data"))
    .join("node-targets.json")
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn load_missing_defaults_to_builtin() {
    let dir = tempfile::tempdir().unwrap();
    let f = TargetsFile::load(&dir.path().join("missing.json"));
    assert_eq!(f.active_id, BUILTIN_ID);
    assert!(f.externals.is_empty());
  }

  #[test]
  fn persist_roundtrips() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("node-targets.json");
    let file = TargetsFile {
      active_id: "abc".into(),
      externals: vec![StoredExternal {
        id: "abc".into(),
        alias: "vps".into(),
        rpc_url: "http://10.0.0.2:8227".into(),
        auth_token: Some("tok".into()),
      }],
    };
    file.persist(&path).unwrap();
    let loaded = TargetsFile::load(&path);
    assert_eq!(loaded.active_id, "abc");
    assert_eq!(loaded.externals[0].alias, "vps");
    assert_eq!(loaded.externals[0].auth_token.as_deref(), Some("tok"));
  }
}
