//! Shared types used by the real backend.

/// Local sidecar entry — written by `publish_order`, joined by
/// `get_orders` / `get_matches`. Absent ⇒ order predates local tracking.
#[derive(Debug, Clone)]
pub struct SidecarEntry {
  pub rental_days: u32,
  pub created_at_ms: u64,
  pub deposit_ckb: f64,
}
