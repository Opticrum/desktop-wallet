//! Shared, hot-swappable Fiber JSON-RPC client.
//!
//! Node + channels backends both read the current client so `node.set_active`
//! can retarget every Fiber RPC call without rebuilding the backends.

use std::sync::{Arc, Mutex};

use super::rpc_client::RpcClient;

/// Handle cloned into the node API and the channels API.
#[derive(Clone)]
pub struct FiberClientHandle {
  inner: Arc<Mutex<RpcClient>>,
}

impl FiberClientHandle {
  pub fn new(client: RpcClient) -> Self {
    Self {
      inner: Arc::new(Mutex::new(client)),
    }
  }

  pub fn current(&self) -> RpcClient {
    self.inner.lock().unwrap().clone()
  }

  pub fn replace(&self, client: RpcClient) {
    *self.inner.lock().unwrap() = client;
  }
}

pub const BUILTIN_ID: &str = "builtin";
