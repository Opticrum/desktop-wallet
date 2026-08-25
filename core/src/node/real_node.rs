//! RealNodeBackend — the embedded fiber node, running in-process as a library.
//!
//! `node.start` builds an `fnn::Config` from the persisted `NodeConfig`,
//! provisions the node's CKB key from the wallet's first HD child, and starts
//! `EmbeddedNode` (the fiber actor system). `get_runtime` queries the node's
//! local JSON-RPC; `get_logs` reads the process-wide `tracing` ring buffer.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use async_trait::async_trait;

use crate::backend::traits::NodeBackend;
use crate::backend::SigningWallet;
use crate::util::{chain_from_hash, parse_chain, watchtower_from_config};
use crate::wire::*;

use super::default_config::default_config;

use super::embedded_node::EmbeddedNode;
use super::fiber_api::{probe_node_info, FiberNodeApi, FiberNodeInfo};
use super::fiber_client::{FiberClientHandle, BUILTIN_ID};
use super::rpc_client::RpcClient;
use super::targets::{new_external_id, StoredExternal, TargetsFile};

/// Append the `/p2p/<node_id>` identity to a fiber multiaddr if it isn't there
/// yet — a complete fiber address is `/ip4/<ip>/tcp/<port>/p2p/<pubkey>`.
fn with_p2p(addr: &str, pubkey: &str) -> String {
  if pubkey.is_empty() || addr.contains("/p2p/") {
    addr.to_string()
  } else {
    format!("{addr}/p2p/{pubkey}")
  }
}

pub(crate) fn load_config(path: &Path) -> NodeConfig {
  match std::fs::read_to_string(path) {
    Ok(s) => serde_json::from_str(&s).unwrap_or_else(|_| default_config()),
    Err(_) => default_config(),
  }
}

fn persist_config(path: &Path, config: &NodeConfig) -> Result<(), CommandError> {
  if let Some(parent) = path.parent() {
    if !parent.as_os_str().is_empty() {
      std::fs::create_dir_all(parent).map_err(|e| CommandError::io(e.to_string()))?;
    }
  }
  let s = serde_json::to_string_pretty(config).map_err(|e| CommandError::io(e.to_string()))?;
  std::fs::write(path, s).map_err(|e| CommandError::io(e.to_string()))
}

pub struct RealNodeBackend {
  fiber: Arc<dyn FiberNodeApi>,
  config_path: PathBuf,
  /// Live node config, shared with the wallet backend so `save_config` edits
  /// are visible to tx classification (fiber contract scripts) immediately.
  config: Arc<Mutex<NodeConfig>>,
  embedded: tokio::sync::Mutex<Option<EmbeddedNode>>,
  wallet: Arc<dyn SigningWallet>,
  base_dir: PathBuf,
  /// True while a start is in flight — the embedded boot takes a while and
  /// `EmbeddedNode::start` must never run twice (the root actor is a
  /// process-global singleton and a second start panics).
  starting: AtomicBool,
  /// The fiber node's peer id (`Qm…` libp2p PeerId) captured from fiber-lib on
  /// start — this is what goes in `/p2p/<node_id>`, NOT the secp256k1 pubkey.
  node_id: Mutex<Option<String>>,
  /// Built-in node's secp256k1 identity, captured on start. Survives stop and
  /// is restored onto `node_pubkey` when switching back from an external target.
  identity_pubkey: Mutex<Option<String>>,
  /// Currently-active Fiber identity (builtin or external). Shared with the
  /// liquidity backend so new orders are attributed to the selected node.
  node_pubkey: Arc<Mutex<Option<String>>>,
  /// When the embedded node was (last) started — the uptime anchor. Cleared on
  /// stop, so a stopped node reports `started_at_ms: None`, `uptime_hours: 0`.
  started_at: Mutex<Option<SystemTime>>,
  /// Hot-swappable Fiber JSON-RPC client shared with the channels backend.
  handle: FiberClientHandle,
  targets_path: PathBuf,
  targets: Mutex<TargetsFile>,
}

impl RealNodeBackend {
  #[allow(clippy::too_many_arguments)]
  pub fn new(
    fiber: Arc<dyn FiberNodeApi>,
    config_path: PathBuf,
    base_dir: PathBuf,
    wallet: Arc<dyn SigningWallet>,
    config: Arc<Mutex<NodeConfig>>,
    node_pubkey: Arc<Mutex<Option<String>>>,
    handle: FiberClientHandle,
    targets_path: PathBuf,
  ) -> Self {
    let targets = TargetsFile::load(&targets_path);
    Self {
      fiber,
      config_path,
      config,
      embedded: tokio::sync::Mutex::new(None),
      wallet,
      base_dir,
      starting: AtomicBool::new(false),
      node_id: Mutex::new(None),
      identity_pubkey: Mutex::new(None),
      node_pubkey,
      started_at: Mutex::new(None),
      handle,
      targets_path,
      targets: Mutex::new(targets),
    }
  }

  /// Point the shared Fiber client at the persisted `active_id` (startup).
  pub async fn restore_active(&self) {
    let id = self.targets.lock().unwrap().active_id.clone();
    if id == BUILTIN_ID {
      return;
    }
    if let Err(e) = self.apply_client(&id).await {
      log::warn!("restore external node {id}: {e}");
    }
  }

  fn make_client(url: &str, token: Option<String>) -> Result<RpcClient, CommandError> {
    RpcClient::new(url, false, token).map_err(|e| CommandError::invalid_input(e.to_string()))
  }

  fn builtin_rpc_url(&self) -> String {
    self.config.lock().unwrap().rpc.listening_addr.clone()
  }

  fn active_id(&self) -> String {
    self.targets.lock().unwrap().active_id.clone()
  }

  fn is_builtin(&self) -> bool {
    self.active_id() == BUILTIN_ID
  }

  fn require_builtin(&self) -> Result<(), CommandError> {
    if self.is_builtin() {
      Ok(())
    } else {
      Err(CommandError::invalid_input(
        "this action is only available on the built-in node",
      ))
    }
  }

  async fn apply_client(&self, id: &str) -> Result<(), CommandError> {
    if id == BUILTIN_ID {
      let url = self.builtin_rpc_url();
      self.handle.replace(Self::make_client(&url, None)?);
      let builtin = self.identity_pubkey.lock().unwrap().clone();
      *self.node_pubkey.lock().unwrap() = builtin;
      return Ok(());
    }
    let ext = self
      .targets
      .lock()
      .unwrap()
      .find(id)
      .cloned()
      .ok_or_else(|| CommandError::invalid_input(format!("unknown node target: {id}")))?;
    let client = Self::make_client(&ext.rpc_url, ext.auth_token.clone())?;
    self.handle.replace(client.clone());
    match probe_node_info(&client, 8).await {
      Ok(info) => *self.node_pubkey.lock().unwrap() = Some(info.pubkey),
      Err(_) => *self.node_pubkey.lock().unwrap() = None,
    }
    Ok(())
  }

  fn persist_targets(&self) -> Result<(), CommandError> {
    self.targets.lock().unwrap().persist(&self.targets_path)
  }

  fn snapshot_targets(&self, running: bool, starting: bool) -> NodeTargetList {
    let config = self.config.lock().unwrap();
    let watchtower = watchtower_from_config(&config);
    let alias = config.fiber.announced_node_name.clone();
    drop(config);
    let file = self.targets.lock().unwrap();
    NodeTargetList {
      active_id: file.active_id.clone(),
      builtin: BuiltinTarget {
        id: BUILTIN_ID.into(),
        alias,
        running,
        starting,
        watchtower,
      },
      externals: file.to_wire_externals(),
    }
  }

  async fn builtin_process_flags(&self) -> (bool, bool) {
    let running = self.embedded.lock().await.is_some();
    let starting = self.starting.load(Ordering::SeqCst);
    (running, starting)
  }

  fn runtime_from_info(
    &self,
    info: Option<&FiberNodeInfo>,
    running: bool,
    starting: bool,
  ) -> NodeRuntime {
    let config = self.config.lock().unwrap();
    let chain = parse_chain(&config.fiber.chain);
    let watchtower = watchtower_from_config(&config);
    // The fiber node's peer id (`Qm…`) — captured from fiber-lib on start.
    // This is what belongs in `/p2p/<node_id>`, and it is NOT the secp256k1
    // pubkey (which is the separate `fiber_pubkey` identity).
    let node_id = self.node_id.lock().unwrap().clone().unwrap_or_default();
    let fiber_pubkey = info
      .map(|i| i.pubkey.clone())
      .or_else(|| self.identity_pubkey.lock().unwrap().clone())
      .or_else(|| self.node_pubkey.lock().unwrap().clone())
      .unwrap_or_default();
    let (alias, fiber_pubkey, fiber_addr, addresses, version, commit, peers, channels, pending) =
      match info {
        Some(i) => {
          // A complete fiber address carries the peer id: `/ip4/<ip>/tcp/<port>/p2p/<node_id>`.
          let addrs: Vec<String> = if i.addresses.is_empty() {
            vec![with_p2p(&config.fiber.listening_addr, &node_id)]
          } else {
            i.addresses.iter().map(|a| with_p2p(a, &node_id)).collect()
          };
          let fiber_addr = if node_id.is_empty() {
            None
          } else {
            addrs.first().cloned()
          };
          let addresses = if node_id.is_empty() {
            Vec::new()
          } else {
            addrs
          };
          (
            i.node_name
              .clone()
              .or_else(|| Some(config.fiber.announced_node_name.clone())),
            fiber_pubkey.clone(),
            fiber_addr,
            addresses,
            Some(i.version.clone()),
            Some(i.commit_hash.clone()),
            i.peers_count,
            i.channel_count,
            i.pending_channel_count,
          )
        }
        None => {
          // Before the node has initialized (no peer id captured yet) there is
          // no real address to show — stay empty until the node brings one up.
          let addr = with_p2p(&config.fiber.listening_addr, &node_id);
          let fiber_addr = if node_id.is_empty() {
            None
          } else {
            Some(addr.clone())
          };
          let addresses = if node_id.is_empty() {
            Vec::new()
          } else {
            vec![addr]
          };
          (
            Some(config.fiber.announced_node_name.clone()),
            fiber_pubkey.clone(),
            fiber_addr,
            addresses,
            None,
            None,
            0,
            0,
            0,
          )
        }
      };
    // Uptime derives from when the embedded node started. Report the start
    // anchor and elapsed hours only while the node is up (or booting) — a
    // stopped node reads as 0 / None regardless of any stale anchor.
    let (started_at_ms, uptime_hours) = if running || starting {
      match *self.started_at.lock().unwrap() {
        Some(t) => {
          let started_ms = t.duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64;
          let elapsed_hours = SystemTime::now()
            .duration_since(t)
            .unwrap_or_default()
            .as_secs() as u32
            / 3600;
          (Some(started_ms), elapsed_hours)
        }
        None => (None, 0),
      }
    } else {
      (None, 0)
    };

    NodeRuntime {
      running,
      starting,
      alias,
      started_at_ms,
      uptime_hours,
      fiber_pubkey,
      fiber_addr,
      addresses,
      chain,
      version,
      commit_hash: commit,
      peers_count: peers,
      channel_count: channels,
      pending_channel_count: pending,
      watchtower,
      kind: NodeKind::Builtin,
      target_id: BUILTIN_ID.into(),
      rpc_url: String::new(),
    }
  }

  fn external_runtime(
    &self,
    info: Option<&FiberNodeInfo>,
    target_id: &str,
    alias: &str,
    rpc_url: &str,
  ) -> NodeRuntime {
    match info {
      Some(i) => NodeRuntime {
        running: true,
        starting: false,
        alias: i.node_name.clone().or_else(|| Some(alias.to_string())),
        started_at_ms: None,
        uptime_hours: 0,
        fiber_pubkey: i.pubkey.clone(),
        fiber_addr: i.addresses.first().cloned(),
        addresses: i.addresses.clone(),
        chain: chain_from_hash(&i.chain_hash),
        version: Some(i.version.clone()),
        commit_hash: Some(i.commit_hash.clone()),
        peers_count: i.peers_count,
        channel_count: i.channel_count,
        pending_channel_count: i.pending_channel_count,
        watchtower: WatchtowerConfig {
          mode: WatchtowerMode::Disabled,
          endpoint: None,
        },
        kind: NodeKind::External,
        target_id: target_id.into(),
        rpc_url: rpc_url.to_string(),
      },
      None => NodeRuntime {
        running: false,
        starting: false,
        alias: Some(alias.to_string()),
        started_at_ms: None,
        uptime_hours: 0,
        fiber_pubkey: self.node_pubkey.lock().unwrap().clone().unwrap_or_default(),
        fiber_addr: None,
        addresses: Vec::new(),
        chain: parse_chain(&self.config.lock().unwrap().fiber.chain),
        version: None,
        commit_hash: None,
        peers_count: 0,
        channel_count: 0,
        pending_channel_count: 0,
        watchtower: WatchtowerConfig {
          mode: WatchtowerMode::Disabled,
          endpoint: None,
        },
        kind: NodeKind::External,
        target_id: target_id.into(),
        rpc_url: rpc_url.to_string(),
      },
    }
  }

  /// Boot the embedded node — a private helper invoked only by the guarded
  /// `NodeBackend::start`.
  async fn start_inner(&self, config: Option<NodeConfig>) -> Result<NodeRuntime, CommandError> {
    if let Some(cfg) = config {
      persist_config(&self.config_path, &cfg)?;
      *self.config.lock().unwrap() = cfg;
    }
    let wire_cfg = self.config.lock().unwrap().clone();

    // Provision the node's CKB key from the wallet's first HD child.
    super::ckb_key::ensure_ckb_key(&self.base_dir.join("ckb"), self.wallet.as_ref())?;
    super::ckb_key::set_secret_key_password(&self.base_dir.join("ckb"))?;

    let fnn_cfg = super::embed_config::fnn_config_from_wire(&wire_cfg, &self.base_dir)?;
    // Capture the fiber node's identity from fiber-lib (reads/generates the
    // node's own `sk`): the `Qm…` peer id goes in `/p2p/<node_id>`, and the
    // secp256k1 pubkey is the separate identity field. Both are known even
    // before `node_info` answers and after the node is stopped.
    if let Some(fiber) = fnn_cfg.fiber.as_ref() {
      let pk = fiber.public_key();
      *self.node_id.lock().unwrap() = Some(pk.peer_id().to_string());
      let hex_pk = hex::encode(pk.inner_ref());
      *self.identity_pubkey.lock().unwrap() = Some(hex_pk.clone());
      *self.node_pubkey.lock().unwrap() = Some(hex_pk);
    }
    let node = EmbeddedNode::start(&fnn_cfg).await?;
    *self.embedded.lock().await = Some(node);
    // Anchor the uptime at the moment the embedded node came up.
    *self.started_at.lock().unwrap() = Some(SystemTime::now());

    // Poll the local fiber RPC until it warms up (~10s). The node itself is
    // already running by now, so a warm-up miss must not fail the start — the
    // runtime reports `running: true` from the embedded handle either way.
    let mut info = None;
    for _ in 0..50 {
      if let Ok(Some(i)) = self.fiber.node_info().await {
        info = Some(i);
        break;
      }
      tokio::time::sleep(std::time::Duration::from_millis(200)).await;
    }
    Ok(self.runtime_from_info(info.as_ref(), true, false))
  }
}

#[async_trait]
impl NodeBackend for RealNodeBackend {
  async fn get_runtime(&self) -> Result<NodeRuntime, CommandError> {
    if !self.is_builtin() {
      let id = self.active_id();
      let (alias, rpc_url) = self
        .targets
        .lock()
        .unwrap()
        .find(&id)
        .map(|e| (e.alias.clone(), e.rpc_url.clone()))
        .unwrap_or_else(|| (id.clone(), String::new()));
      let info = self.fiber.node_info().await.unwrap_or(None);
      return Ok(self.external_runtime(info.as_ref(), &id, &alias, &rpc_url));
    }
    let running = self.embedded.lock().await.is_some();
    let starting = self.starting.load(Ordering::SeqCst);
    if running || starting {
      // Node is up or booting — the fiber RPC may not answer yet. Report the
      // state without erroring so the UI can show "running" / "preparing".
      let info = self.fiber.node_info().await.unwrap_or(None);
      return Ok(self.runtime_from_info(info.as_ref(), running, starting));
    }
    let info = self.fiber.node_info().await?;
    Ok(self.runtime_from_info(info.as_ref(), false, false))
  }

  async fn start(&self, config: Option<NodeConfig>) -> Result<NodeRuntime, CommandError> {
    self.require_builtin()?;
    // Never start twice — the fiber root actor is a process-global singleton
    // and a second `EmbeddedNode::start` panics with `ActorAlreadyRegistered`.
    if self.embedded.lock().await.is_some() {
      return self.get_runtime().await; // already running
    }
    if self.starting.swap(true, Ordering::SeqCst) {
      // A previous start is still booting (page switches don't interrupt it);
      // report the boot state instead of racing a second embedded boot.
      return Ok(self.runtime_from_info(None, false, true));
    }

    let result = self.start_inner(config).await;
    self.starting.store(false, Ordering::SeqCst);
    result
  }

  async fn stop(&self) -> Result<(), CommandError> {
    self.require_builtin()?;
    if let Some(node) = self.embedded.lock().await.take() {
      node.stop().await?;
    }
    // A stopped node has no uptime anchor — idempotent even if already stopped.
    *self.started_at.lock().unwrap() = None;
    Ok(())
  }

  async fn get_logs(
    &self,
    level: Option<LogLevel>,
    since_ts_ms: Option<u64>,
    limit: Option<u32>,
  ) -> Result<Vec<NodeLog>, CommandError> {
    self.require_builtin()?;
    let buf = super::node_logs::install_log_capture();
    Ok(buf.drain(level, since_ts_ms, limit))
  }

  async fn get_config(&self) -> Result<NodeConfig, CommandError> {
    Ok(self.config.lock().unwrap().clone())
  }

  async fn save_config(&self, config: NodeConfig) -> Result<SaveConfigResult, CommandError> {
    let chain = parse_chain(&config.fiber.chain);
    let watchtower = watchtower_from_config(&config);
    persist_config(&self.config_path, &config)?;
    *self.config.lock().unwrap() = config;
    if self.is_builtin() {
      let url = self.builtin_rpc_url();
      if let Ok(client) = Self::make_client(&url, None) {
        self.handle.replace(client);
      }
    }
    Ok(SaveConfigResult { chain, watchtower })
  }

  async fn list_targets(&self) -> Result<NodeTargetList, CommandError> {
    let (running, starting) = self.builtin_process_flags().await;
    Ok(self.snapshot_targets(running, starting))
  }

  async fn add_external(
    &self,
    alias: String,
    rpc_url: String,
    auth_token: Option<String>,
  ) -> Result<NodeTargetList, CommandError> {
    let alias = alias.trim().to_string();
    let rpc_url = rpc_url.trim().to_string();
    if alias.is_empty() {
      return Err(CommandError::invalid_input("alias is required"));
    }
    if rpc_url.is_empty() {
      return Err(CommandError::invalid_input("rpc url is required"));
    }
    let token = auth_token
      .map(|t| t.trim().to_string())
      .filter(|t| !t.is_empty());
    let client = Self::make_client(&rpc_url, token.clone())?;
    probe_node_info(&client, 8).await?;
    let stored = StoredExternal {
      id: new_external_id(),
      alias,
      rpc_url,
      auth_token: token,
    };
    {
      let mut file = self.targets.lock().unwrap();
      file.externals.push(stored);
    }
    self.persist_targets()?;
    self.list_targets().await
  }

  async fn update_external(
    &self,
    id: String,
    alias: String,
    rpc_url: String,
    auth_token: Option<String>,
  ) -> Result<NodeTargetList, CommandError> {
    if id == BUILTIN_ID {
      return Err(CommandError::invalid_input("cannot edit the built-in node"));
    }
    let alias = alias.trim().to_string();
    let rpc_url = rpc_url.trim().to_string();
    if alias.is_empty() {
      return Err(CommandError::invalid_input("alias is required"));
    }
    if rpc_url.is_empty() {
      return Err(CommandError::invalid_input("rpc url is required"));
    }
    let token = auth_token
      .map(|t| t.trim().to_string())
      .filter(|t| !t.is_empty());
    let client = Self::make_client(&rpc_url, token.clone())?;
    probe_node_info(&client, 8).await?;
    {
      let mut file = self.targets.lock().unwrap();
      let ext = file
        .externals
        .iter_mut()
        .find(|e| e.id == id)
        .ok_or_else(|| CommandError::invalid_input(format!("unknown node target: {id}")))?;
      ext.alias = alias;
      ext.rpc_url = rpc_url;
      ext.auth_token = token;
    }
    self.persist_targets()?;
    if self.active_id() == id {
      self.apply_client(&id).await?;
    }
    self.list_targets().await
  }

  async fn remove_external(&self, id: String) -> Result<NodeTargetList, CommandError> {
    if id == BUILTIN_ID {
      return Err(CommandError::invalid_input(
        "cannot remove the built-in node",
      ));
    }
    let was_active = self.active_id() == id;
    {
      let mut file = self.targets.lock().unwrap();
      let before = file.externals.len();
      file.externals.retain(|e| e.id != id);
      if file.externals.len() == before {
        return Err(CommandError::invalid_input(format!(
          "unknown node target: {id}"
        )));
      }
      if was_active {
        file.active_id = BUILTIN_ID.into();
      }
    }
    self.persist_targets()?;
    if was_active {
      self.apply_client(BUILTIN_ID).await?;
    }
    self.list_targets().await
  }

  async fn set_active(&self, id: String) -> Result<NodeRuntime, CommandError> {
    if id != BUILTIN_ID && self.targets.lock().unwrap().find(&id).is_none() {
      return Err(CommandError::invalid_input(format!(
        "unknown node target: {id}"
      )));
    }
    self.targets.lock().unwrap().active_id = id.clone();
    self.persist_targets()?;
    self.apply_client(&id).await?;
    self.get_runtime().await
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::node::fiber_api::MockFiberApi;

  fn sample_info() -> FiberNodeInfo {
    FiberNodeInfo {
      version: "0.9.0".to_string(),
      commit_hash: "3c25bcf1".to_string(),
      pubkey: "02ab91f4c5d27b8e6a1f4d3c9a72e881f0c5b7d4e3a9f8b6c1d2e5f4a3b7c9d1".to_string(),
      node_name: Some("ckb-bot-sg".to_string()),
      addresses: vec!["/ip4/18.142.44.12/tcp/8115".to_string()],
      chain_hash: "0x10639e0895502b5688a6be8cf694ea60ddfa07bd751f8380e3759329bcd96880".to_string(),
      channel_count: 7,
      pending_channel_count: 1,
      peers_count: 48,
    }
  }

  struct TestWallet;
  impl SigningWallet for TestWallet {
    fn is_unlocked(&self) -> bool {
      true
    }
    fn signing_identity(
      &self,
    ) -> Option<(
      String,
      ckb_cinnabar_calculator::re_exports::secp256k1::SecretKey,
    )> {
      let sk =
        ckb_cinnabar_calculator::re_exports::secp256k1::SecretKey::from_slice(&[7u8; 32]).unwrap();
      let secp = ckb_cinnabar_calculator::re_exports::secp256k1::Secp256k1::new();
      let pk =
        ckb_cinnabar_calculator::re_exports::secp256k1::PublicKey::from_secret_key(&secp, &sk);
      Some((
        crate::wallet::address::ckb_address_from_pubkey(&pk, true),
        sk,
      ))
    }
  }

  fn dummy_handle() -> crate::node::fiber_client::FiberClientHandle {
    crate::node::fiber_client::FiberClientHandle::new(
      crate::node::rpc_client::RpcClient::new("127.0.0.1:8227", false, None).unwrap(),
    )
  }

  fn test_backend(fiber: Arc<dyn FiberNodeApi>) -> (RealNodeBackend, tempfile::TempDir) {
    let dir = tempfile::tempdir().unwrap();
    let config_path = dir.path().join("node-config.json");
    let config = Arc::new(Mutex::new(load_config(&config_path)));
    (
      RealNodeBackend::new(
        fiber,
        config_path,
        dir.path().join("fiber-node"),
        Arc::new(TestWallet),
        config,
        Arc::new(Mutex::new(None)),
        dummy_handle(),
        dir.path().join("node-targets.json"),
      ),
      dir,
    )
  }

  #[tokio::test]
  async fn get_runtime_maps_node_info() {
    let (backend, _dir) = test_backend(Arc::new(MockFiberApi::new(Some(sample_info()))));
    let r = backend.get_runtime().await.unwrap();
    // not started → not running, but config-derived fields present
    assert!(!r.running);
    assert_eq!(r.alias.as_deref(), Some("ckb-bot-sg"));
    // Not initialized → no peer id captured yet → the address stays empty until
    // the node brings it up. The pubkey field is the secp256k1 identity.
    assert_eq!(r.fiber_addr, None, "fiber address stays empty before init");
    assert!(r.addresses.is_empty());
    assert_eq!(
      r.fiber_pubkey,
      "02ab91f4c5d27b8e6a1f4d3c9a72e881f0c5b7d4e3a9f8b6c1d2e5f4a3b7c9d1"
    );
  }

  #[tokio::test]
  async fn runtime_address_carries_peer_id() {
    let (backend, _dir) = test_backend(Arc::new(MockFiberApi::new(None)));
    // Simulate the node having started — the `Qm…` peer id is captured from
    // fiber-lib and must appear in the `/p2p/` of the address.
    *backend.node_id.lock().unwrap() =
      Some("QmQQjPLhizrXjgcmX7mDqrrCzC5FeHwPxgJP1qRGBsZJJr".to_string());
    let r = backend.get_runtime().await.unwrap();
    assert_eq!(
      r.fiber_addr.as_deref(),
      Some("/ip4/0.0.0.0/tcp/8228/p2p/QmQQjPLhizrXjgcmX7mDqrrCzC5FeHwPxgJP1qRGBsZJJr")
    );
  }

  #[tokio::test]
  async fn save_config_persists_and_roundtrips() {
    let (backend, dir) = test_backend(Arc::new(MockFiberApi::new(Some(sample_info()))));
    let mut cfg = backend.get_config().await.unwrap();
    cfg.fiber.announced_node_name = "renamed".to_string();
    let result = backend.save_config(cfg.clone()).await.unwrap();
    assert_eq!(result.chain, Chain::Testnet);
    let reloaded = RealNodeBackend::new(
      Arc::new(MockFiberApi::new(Some(sample_info()))),
      dir.path().join("node-config.json"),
      dir.path().join("fiber-node"),
      Arc::new(TestWallet),
      Arc::new(Mutex::new(load_config(
        &dir.path().join("node-config.json"),
      ))),
      Arc::new(Mutex::new(None)),
      dummy_handle(),
      dir.path().join("node-targets.json"),
    );
    assert_eq!(
      reloaded
        .get_config()
        .await
        .unwrap()
        .fiber
        .announced_node_name,
      "renamed"
    );
  }

  #[tokio::test]
  async fn start_while_already_starting_does_not_reboot() {
    let (backend, _dir) = test_backend(Arc::new(MockFiberApi::new(None)));
    // Simulate a boot already in flight (e.g. the user navigated away mid-start
    // and the control panel re-issued `start`).
    backend.starting.store(true, Ordering::SeqCst);
    let r = backend.start(None).await.unwrap();
    assert!(r.starting, "reports the boot state, never reboots");
    assert!(!r.running);
    // The guard returned before `EmbeddedNode::start`, so no panic.
    backend.starting.store(false, Ordering::SeqCst);
  }

  #[tokio::test]
  async fn uptime_derives_from_start_anchor() {
    let (backend, _dir) = test_backend(Arc::new(MockFiberApi::new(Some(sample_info()))));
    // Simulate a node that started ~3700s ago — the runtime reports 1 full hour
    // of uptime plus the wall-clock start anchor the frontend ticks against.
    *backend.started_at.lock().unwrap() =
      Some(SystemTime::now() - std::time::Duration::from_secs(3700));
    let r = backend.runtime_from_info(Some(&sample_info()), true, false);
    assert_eq!(r.uptime_hours, 1);
    assert!(
      r.started_at_ms.is_some(),
      "start anchor reported while running"
    );
    // Stopped (anchor cleared) → no uptime and no start anchor.
    *backend.started_at.lock().unwrap() = None;
    let r = backend.runtime_from_info(Some(&sample_info()), false, false);
    assert_eq!(r.uptime_hours, 0);
    assert!(r.started_at_ms.is_none(), "no start anchor while stopped");
  }

  #[tokio::test]
  async fn list_targets_defaults_to_builtin() {
    let (backend, _dir) = test_backend(Arc::new(MockFiberApi::new(None)));
    let list = backend.list_targets().await.unwrap();
    assert_eq!(list.active_id, "builtin");
    assert!(list.externals.is_empty());
    assert!(!list.builtin.running);
  }

  #[tokio::test]
  async fn external_runtime_exposes_creation_rpc_url() {
    let (backend, _dir) = test_backend(Arc::new(MockFiberApi::new(None)));
    backend.targets.lock().unwrap().externals.push(StoredExternal {
      id: "ext1".into(),
      alias: "remote".into(),
      rpc_url: "10.0.0.2:8227".into(),
      auth_token: None,
    });
    backend.targets.lock().unwrap().active_id = "ext1".into();
    let r = backend.get_runtime().await.unwrap();
    assert_eq!(r.kind, NodeKind::External);
    assert_eq!(r.rpc_url, "10.0.0.2:8227");
  }

  #[tokio::test]
  async fn set_active_unknown_id_errors() {
    let (backend, _dir) = test_backend(Arc::new(MockFiberApi::new(None)));
    let err = backend.set_active("nope".into()).await.unwrap_err();
    assert!(err.to_string().contains("unknown node target"));
  }

  #[tokio::test]
  async fn start_rejected_when_external_is_active() {
    let (backend, _dir) = test_backend(Arc::new(MockFiberApi::new(None)));
    backend.targets.lock().unwrap().active_id = "ext1".into();
    let err = backend.start(None).await.unwrap_err();
    assert!(err.to_string().contains("built-in"));
  }
}
