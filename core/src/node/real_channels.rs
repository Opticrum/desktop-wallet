//! RealChannelsBackend — channels domain over the fiber node JSON-RPC.
//!
//! Uses `fiber-json-types` (local fiber checkout) as the single source of truth
//! for the fiber node's response shapes; maps them to the wire `ChannelList`.
//! `FiberChannelApi` is a thin seam so the backend is testable offline.

use std::collections::HashSet;
use std::sync::Arc;

use async_trait::async_trait;
use fiber_json_types::channel::{
  Channel as FiberChannel, ChannelState, ListChannelsResult,
  OpenChannelResult as FiberOpenChannelResult,
};
use fiber_json_types::graph::{GraphNodesParams, GraphNodesResult};
use fiber_json_types::peer::{ListPeersResult, PeerInfo as FiberPeerInfo};
use std::collections::HashMap;
use molecule::prelude::Entity;
use opticrum_protocol::OutPoint as ProtocolOutPoint;

use crate::backend::traits::ChannelsBackend;
use crate::node::rpc_client::{FiberRpcExt, RpcClient};
use crate::wire::*;

// ---------------------------------------------------------------------------
// Fiber channel API seam
// ---------------------------------------------------------------------------

#[async_trait]
pub trait FiberChannelApi: Send + Sync {
  async fn list_channels(&self) -> Result<ListChannelsResult, CommandError>;
  async fn list_peers(&self) -> Result<ListPeersResult, CommandError>;
  async fn list_graph_nodes(&self) -> Result<GraphNodesResult, CommandError>;
  async fn connect_peer(&self, address: &str) -> Result<(), CommandError>;
  async fn disconnect_peer(&self, peer_id: &str) -> Result<(), CommandError>;
  async fn open_channel(
    &self,
    pubkey: &str,
    funding_amount_shannons: u64,
    address: Option<&str>,
  ) -> Result<String, CommandError>;
  async fn shutdown_channel(&self, channel_id: &str, force: bool) -> Result<(), CommandError>;
}

/// Real impl over the fiber JSON-RPC client.
pub struct RealFiberChannels {
  client: RpcClient,
}

impl RealFiberChannels {
  pub fn new(client: RpcClient) -> Self {
    Self { client }
  }
}

#[async_trait]
impl FiberChannelApi for RealFiberChannels {
  async fn list_channels(&self) -> Result<ListChannelsResult, CommandError> {
    let params = serde_json::json!({ "include_closed": true });
    self.client.call_fiber("list_channels", &params).await
  }

  async fn list_peers(&self) -> Result<ListPeersResult, CommandError> {
    self.client.call_fiber_no_params("list_peers").await
  }

  async fn list_graph_nodes(&self) -> Result<GraphNodesResult, CommandError> {
    let params = GraphNodesParams {
      limit: Some(500),
      after: None,
    };
    self.client.call_fiber("graph_nodes", &params).await
  }

  async fn connect_peer(&self, address: &str) -> Result<(), CommandError> {
    let params = serde_json::json!({ "address": address });
    let _: serde_json::Value = self.client.call_fiber("connect_peer", &params).await?;
    Ok(())
  }

  async fn disconnect_peer(&self, peer_id: &str) -> Result<(), CommandError> {
    // fiber's `disconnect_peer` takes the peer identity as `pubkey`
    // (fiber-json-types `DisconnectPeerParams`) — `peer_id` is rejected as
    // `invalid params`.
    let params = serde_json::json!({ "pubkey": peer_id });
    let _: serde_json::Value = self.client.call_fiber("disconnect_peer", &params).await?;
    Ok(())
  }

  async fn open_channel(
    &self,
    pubkey: &str,
    funding_amount_shannons: u64,
    address: Option<&str>,
  ) -> Result<String, CommandError> {
    let mut params = serde_json::json!({
      "pubkey": pubkey,
      "funding_amount": format!("0x{:x}", funding_amount_shannons),
    });
    if let Some(a) = address {
      params["address"] = serde_json::json!(a);
    }
    let result: FiberOpenChannelResult = self.client.call_fiber("open_channel", &params).await?;
    Ok(hex::encode(result.temporary_channel_id.as_bytes()))
  }

  async fn shutdown_channel(&self, channel_id: &str, force: bool) -> Result<(), CommandError> {
    let params = serde_json::json!({ "channel_id": channel_id, "force": force });
    let _: serde_json::Value = self.client.call_fiber("shutdown_channel", &params).await?;
    Ok(())
  }
}

/// Test double — settable channel/peer state.
pub struct MockFiberChannels {
  channels: std::sync::Mutex<Vec<FiberChannel>>,
  peers: std::sync::Mutex<Vec<FiberPeerInfo>>,
  opened: std::sync::Mutex<Vec<(String, u64)>>,
}

impl Default for MockFiberChannels {
  fn default() -> Self {
    Self::new()
  }
}

impl MockFiberChannels {
  pub fn new() -> Self {
    Self {
      channels: std::sync::Mutex::new(Vec::new()),
      peers: std::sync::Mutex::new(Vec::new()),
      opened: std::sync::Mutex::new(Vec::new()),
    }
  }
  pub fn set_channels(&self, channels: Vec<FiberChannel>) {
    *self.channels.lock().unwrap() = channels;
  }
  pub fn set_peers(&self, peers: Vec<FiberPeerInfo>) {
    *self.peers.lock().unwrap() = peers;
  }
  pub fn opened(&self) -> Vec<(String, u64)> {
    self.opened.lock().unwrap().clone()
  }
}

#[async_trait]
impl FiberChannelApi for MockFiberChannels {
  async fn list_channels(&self) -> Result<ListChannelsResult, CommandError> {
    Ok(ListChannelsResult {
      channels: self.channels.lock().unwrap().clone(),
    })
  }
  async fn list_peers(&self) -> Result<ListPeersResult, CommandError> {
    Ok(ListPeersResult {
      peers: self.peers.lock().unwrap().clone(),
    })
  }
  async fn list_graph_nodes(&self) -> Result<GraphNodesResult, CommandError> {
    Ok(GraphNodesResult {
      nodes: vec![],
      last_cursor: Default::default(),
    })
  }
  async fn connect_peer(&self, _address: &str) -> Result<(), CommandError> {
    Ok(())
  }
  async fn disconnect_peer(&self, _peer_id: &str) -> Result<(), CommandError> {
    Ok(())
  }
  async fn open_channel(
    &self,
    pubkey: &str,
    funding_amount_shannons: u64,
    _address: Option<&str>,
  ) -> Result<String, CommandError> {
    self
      .opened
      .lock()
      .unwrap()
      .push((pubkey.to_string(), funding_amount_shannons));
    Ok("temp-1".to_string())
  }
  async fn shutdown_channel(&self, _channel_id: &str, _force: bool) -> Result<(), CommandError> {
    Ok(())
  }
}

// ---------------------------------------------------------------------------
// Wire mapping (pure, unit-testable)
// ---------------------------------------------------------------------------

fn channel_state_name(state: &ChannelState) -> String {
  let name = match state {
    ChannelState::NegotiatingFunding(_) => "NegotiatingFunding",
    ChannelState::CollaboratingFundingTx(_) => "CollaboratingFundingTx",
    ChannelState::SigningCommitment(_) => "SigningCommitment",
    ChannelState::AwaitingTxSignatures(_) => "AwaitingTxSignatures",
    ChannelState::AwaitingChannelReady(_) => "AwaitingChannelReady",
    ChannelState::ChannelReady => "ChannelReady",
    ChannelState::ShuttingDown(_) => "ShuttingDown",
    ChannelState::Closed(_) => "Closed",
    ChannelState::Stale => "Stale",
  };
  name.to_string()
}

fn channel_close_flags(state: &ChannelState) -> Option<u32> {
  match state {
    ChannelState::ShuttingDown(f) => Some(f.0),
    ChannelState::Closed(f) => Some(f.0),
    _ => None,
  }
}

/// fiber `Channel` → wire `Channel`.
fn channel_to_wire(c: &FiberChannel) -> Channel {
  let (tx_hash, output_index) = c
    .channel_outpoint
    .as_ref()
    .and_then(|op| ProtocolOutPoint::from_slice(op.as_slice()).ok())
    .map(|op| (hex::encode(op.tx_hash), op.index))
    .unwrap_or_default();
  let capacity = (c.local_balance + c.remote_balance) as u64;
  Channel {
    channel_id: c
      .channel_id
      .to_string()
      .trim_start_matches("0x")
      .to_string(),
    tx_hash,
    output_index,
    capacity_ckb: capacity as f64 / 1e8,
    capacity_shannons: capacity,
    local_balance_ckb: c.local_balance as f64 / 1e8,
    local_balance_shannons: c.local_balance as u64,
    remote_balance_ckb: c.remote_balance as f64 / 1e8,
    remote_balance_shannons: c.remote_balance as u64,
    state: channel_state_name(&c.state),
    is_public: c.is_public,
    enabled: c.enabled,
    created_at_ms: c.created_at,
    close_flags: channel_close_flags(&c.state),
    // fee policy isn't exposed by list_channels; a later `get_channel_info` refinement.
    base_fee_mshannons: None,
    fee_rate_ppm: None,
  }
}

/// Group fiber peers + channels into the wire `ChannelList`.
fn build_channel_list(
  peers: &[FiberPeerInfo],
  channels: &[FiberChannel],
  versions: &HashMap<String, String>,
) -> ChannelList {
  let mut nodes: Vec<ChannelNode> = Vec::new();
  let mut seen: HashSet<String> = HashSet::new();

  for p in peers {
    let peer_id = p.pubkey.to_string();
    seen.insert(peer_id.clone());
    let peer_channels = channels
      .iter()
      .filter(|c| c.pubkey.to_string() == peer_id)
      .map(channel_to_wire)
      .collect();
    nodes.push(ChannelNode {
      peer: PeerInfo {
        id: peer_id.clone(),
        alias: None,
        addr: Some(p.address.clone()),
        version: versions.get(&peer_id).cloned(),
      },
      channels: peer_channels,
    });
  }

  // Channels whose counterparty isn't in list_peers (e.g. disconnected).
  for c in channels {
    let pid = c.pubkey.to_string();
    if !seen.contains(&pid) {
      seen.insert(pid.clone());
      nodes.push(ChannelNode {
        peer: PeerInfo {
          id: pid.clone(),
          alias: None,
          addr: None,
          version: versions.get(&pid).cloned(),
        },
        channels: vec![channel_to_wire(c)],
      });
    }
  }

  ChannelList { nodes }
}

// ---------------------------------------------------------------------------
// Backend
// ---------------------------------------------------------------------------

pub struct RealChannelsBackend {
  fiber: Arc<dyn FiberChannelApi>,
}

impl RealChannelsBackend {
  pub fn new(fiber: Arc<dyn FiberChannelApi>) -> Self {
    Self { fiber }
  }
}

#[async_trait]
impl ChannelsBackend for RealChannelsBackend {
  async fn list(&self) -> Result<ChannelList, CommandError> {
    let channels = self.fiber.list_channels().await?;
    let peers = self.fiber.list_peers().await?;
    // Peer software versions come from the network graph (`graph_nodes`); the
    // graph may be unavailable (best-effort — cards just omit the version).
    let versions: HashMap<String, String> = match self.fiber.list_graph_nodes().await {
      Ok(g) => g
        .nodes
        .iter()
        .map(|n| (n.pubkey.to_string(), n.version.clone()))
        .collect(),
      Err(_) => HashMap::new(),
    };
    Ok(build_channel_list(&peers.peers, &channels.channels, &versions))
  }

  async fn connect_peer(
    &self,
    addr: String,
    pubkey: Option<String>,
    _alias: Option<String>,
  ) -> Result<ConnectPeerResult, CommandError> {
    // fiber connect_peer takes a single multiaddr; append /p2p/<pubkey> if a
    // separate pubkey was given and the addr doesn't already carry one.
    let address = match (pubkey, addr.contains("/p2p/")) {
      (Some(pk), false) => format!("{}/p2p/{}", addr.trim_end_matches('/'), pk),
      _ => addr.clone(),
    };
    self.fiber.connect_peer(&address).await?;
    let peer_id = address
      .split("/p2p/")
      .nth(1)
      .map(|s| s.to_string())
      .unwrap_or(addr);
    Ok(ConnectPeerResult { peer_id })
  }

  async fn disconnect_peer(&self, peer_id: String) -> Result<(), CommandError> {
    self.fiber.disconnect_peer(&peer_id).await
  }

  async fn open_channel(
    &self,
    peer_id: String,
    capacity_shannons: u64,
    base_fee_mshannons: Option<u64>,
    fee_rate_ppm: Option<u64>,
  ) -> Result<OpenChannelResult, CommandError> {
    let _ = (base_fee_mshannons, fee_rate_ppm); // fee-at-open is a later refinement
    let temp_id = self
      .fiber
      .open_channel(&peer_id, capacity_shannons, None)
      .await?;
    Ok(OpenChannelResult {
      temp_id,
      channel_id: None,
    })
  }

  async fn close_channel(&self, channel_id: String, force: bool) -> Result<(), CommandError> {
    self.fiber.shutdown_channel(&channel_id, force).await
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use fiber_json_types::channel::{CloseFlags, ShuttingDownFlags};
  use fiber_json_types::{Hash256, Pubkey};

  fn sample_channel() -> FiberChannel {
    FiberChannel {
      channel_id: Hash256([0x11; 32]),
      is_public: true,
      is_acceptor: false,
      is_one_way: false,
      channel_outpoint: None,
      pubkey: Pubkey([0x02; 33]),
      funding_udt_type_script: None,
      state: ChannelState::ChannelReady,
      local_balance: 1_250_000_000_000, // 12,500 CKB
      offered_tlc_balance: 0,
      remote_balance: 750_000_000_000, // 7,500 CKB
      received_tlc_balance: 0,
      pending_tlcs: vec![],
      latest_commitment_transaction_hash: None,
      created_at: 1_700_000_000_000,
      enabled: true,
      tlc_expiry_delta: 0,
      tlc_fee_proportional_millionths: 0,
      shutdown_transaction_hash: None,
      failure_detail: None,
    }
  }

  #[test]
  fn channel_state_and_close_flags_map() {
    assert_eq!(
      channel_state_name(&ChannelState::ChannelReady),
      "ChannelReady"
    );
    assert_eq!(channel_close_flags(&ChannelState::ChannelReady), None);
    assert_eq!(
      channel_close_flags(&ChannelState::ShuttingDown(ShuttingDownFlags(3))),
      Some(3)
    );
    assert_eq!(
      channel_close_flags(&ChannelState::Closed(CloseFlags(7))),
      Some(7)
    );
  }

  #[test]
  fn channel_to_wire_maps_balances_and_state() {
    let w = channel_to_wire(&sample_channel());
    // capacity = local + remote = 20,000 CKB
    assert_eq!(w.capacity_ckb, 20_000.0);
    assert_eq!(w.local_balance_ckb, 12_500.0);
    assert_eq!(w.remote_balance_ckb, 7_500.0);
    assert_eq!(w.state, "ChannelReady");
    assert!(w.is_public);
    assert!(w.enabled);
    assert_eq!(w.created_at_ms, 1_700_000_000_000);
    assert_eq!(w.close_flags, None);
    assert_eq!(
      w.channel_id,
      "1111111111111111111111111111111111111111111111111111111111111111"
    );
  }

  #[test]
  fn build_channel_list_groups_by_peer() {
    let peer = fiber_json_types::peer::PeerInfo {
      pubkey: Pubkey([0x02; 33]),
      address: "/ip4/1.2.3.4/tcp/8115".to_string(),
    };
    let channels = vec![sample_channel()];
    let list = build_channel_list(&[peer], &channels, &HashMap::new());
    assert_eq!(list.nodes.len(), 1);
    // peer id = 66-char hex pubkey (no 0x)
    assert_eq!(list.nodes[0].peer.id.len(), 66);
    assert_eq!(list.nodes[0].channels.len(), 1);
  }

  #[tokio::test]
  async fn list_and_actions_flow_through_fiber_api() {
    let api = MockFiberChannels::new();
    api.set_peers(vec![fiber_json_types::peer::PeerInfo {
      pubkey: Pubkey([0x02; 33]),
      address: "/ip4/1.2.3.4/tcp/8115".to_string(),
    }]);
    let backend = RealChannelsBackend::new(Arc::new(api));

    let list = backend.list().await.unwrap();
    assert_eq!(list.nodes.len(), 1);

    let conn = backend
      .connect_peer("/ip4/9.9.9.9/tcp/8115".into(), None, None)
      .await
      .unwrap();
    assert_eq!(conn.peer_id, "/ip4/9.9.9.9/tcp/8115");
    assert!(backend.disconnect_peer("abc".into()).await.is_ok());
    assert!(backend.close_channel("ch".into(), false).await.is_ok());

    let opened = backend
      .open_channel("02ab".into(), 5_000_000_000_000, None, None)
      .await
      .unwrap();
    assert_eq!(opened.temp_id, "temp-1");
  }
}
