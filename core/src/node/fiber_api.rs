//! Fiber node API — the queries the desktop needs from the FNN JSON-RPC.
//!
//! `FiberNodeApi` is a thin seam so `RealNodeBackend` is testable offline with
//! `MockFiberApi`; the real impl drives the vendored JSON-RPC client.

use std::sync::Mutex;

use async_trait::async_trait;
use serde::{de::Deserializer, Deserialize};

use crate::wire::CommandError;

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

/// Real impl over the fiber JSON-RPC client.
pub struct FiberRpcApi {
  client: RpcClient,
}

impl FiberRpcApi {
  pub fn new(client: RpcClient) -> Self {
    Self { client }
  }
}

#[async_trait]
impl FiberNodeApi for FiberRpcApi {
  async fn node_info(&self) -> Result<Option<FiberNodeInfo>, CommandError> {
    match self
      .client
      .call_fiber_no_params::<FiberNodeInfo>("node_info")
      .await
    {
      Ok(info) => Ok(Some(info)),
      // Unreachable / malformed response → report as not-running (state-as-data).
      Err(_) => Ok(None),
    }
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
