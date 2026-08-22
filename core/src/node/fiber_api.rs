//! Fiber node API — the queries the desktop needs from the FNN JSON-RPC.
//!
//! `FiberNodeApi` is a thin seam so `RealNodeBackend` is testable offline with
//! `MockFiberApi`; the real impl drives the vendored JSON-RPC client.

use std::sync::Mutex;

use async_trait::async_trait;
use serde::{de::Deserializer, Deserialize};

use std::time::Duration;

use crate::wire::CommandError;

use super::fiber_client::FiberClientHandle;
use super::rpc_client::{FiberRpcExt, RpcClient};

/// Deserialize a `"0x…"` (or bare) hex string into a `u32` — the fiber node
/// serializes numeric fields as hex strings (`U32Hex`).
fn de_hex_u32<'de, D>(d: D) -> Result<u32, D::Error>
where
  D: Deserializer<'de>,
{
  let s = String::deserialize(d)?;
  let s = s.strip_prefix("0x").unwrap_or(&s);
  u32::from_str_radix(s, 16).map_err(serde::de::Error::custom)
}

/// Node info from the fiber `node_info` RPC — the subset the runtime needs.
#[derive(Debug, Clone, Deserialize)]
pub struct FiberNodeInfo {
  pub version: String,
  pub commit_hash: String,
  /// secp256k1 compressed pubkey, hex **without** `0x` prefix.
  pub pubkey: String,
  pub node_name: Option<String>,
  pub addresses: Vec<String>,
  pub chain_hash: String,
  #[serde(deserialize_with = "de_hex_u32")]
  pub channel_count: u32,
  #[serde(deserialize_with = "de_hex_u32")]
  pub pending_channel_count: u32,
  #[serde(deserialize_with = "de_hex_u32")]
  pub peers_count: u32,
}

/// The fiber node queries the desktop needs.
#[async_trait]
pub trait FiberNodeApi: Send + Sync {
  /// `node_info`. `Ok(None)` when the node is unreachable — state-as-data
  /// (`running=false`), not an error.
  async fn node_info(&self) -> Result<Option<FiberNodeInfo>, CommandError>;
}

/// Real impl over the (hot-swappable) fiber JSON-RPC client.
pub struct FiberRpcApi {
  handle: FiberClientHandle,
}

impl FiberRpcApi {
  pub fn new(handle: FiberClientHandle) -> Self {
    Self { handle }
  }
}

async fn node_info_on(client: &RpcClient) -> Result<Option<FiberNodeInfo>, CommandError> {
  match client
    .call_fiber_no_params::<FiberNodeInfo>("node_info")
    .await
  {
    Ok(info) => Ok(Some(info)),
    // Unreachable / malformed response → report as not-running (state-as-data).
    Err(_) => Ok(None),
  }
}

/// Probe a candidate RPC with a hard timeout — used before adding/updating an
/// external target so a hung host cannot stall the IPC command.
pub async fn probe_node_info(
  client: &RpcClient,
  timeout_secs: u64,
) -> Result<FiberNodeInfo, CommandError> {
  match tokio::time::timeout(Duration::from_secs(timeout_secs), node_info_on(client)).await {
    Ok(Ok(Some(info))) => Ok(info),
    Ok(Ok(None)) | Ok(Err(_)) => Err(CommandError::chain("Fiber RPC unreachable")),
    Err(_) => Err(CommandError::chain("Fiber RPC timed out")),
  }
}

#[async_trait]
impl FiberNodeApi for FiberRpcApi {
  async fn node_info(&self) -> Result<Option<FiberNodeInfo>, CommandError> {
    node_info_on(&self.handle.current()).await
  }
}

/// Test double — settable node info.
pub struct MockFiberApi {
  info: Mutex<Option<FiberNodeInfo>>,
}

impl MockFiberApi {
  pub fn new(info: Option<FiberNodeInfo>) -> Self {
    Self {
      info: Mutex::new(info),
    }
  }
}

#[async_trait]
impl FiberNodeApi for MockFiberApi {
  async fn node_info(&self) -> Result<Option<FiberNodeInfo>, CommandError> {
    Ok(self.info.lock().unwrap().clone())
  }
}
