//! opticrum-wallet-core — the local-first backend library for the Opticrum
//! desktop wallet.
//!
//! The Tauri shell (`src-tauri/`) stays a thin IPC adapter over the backend
//! traits defined here. All wallet/chain/persistence logic lives in this crate
//! so it is fully testable offline (no chain, node, or WebView required).

pub mod backend;
pub mod chain;
pub mod db;
pub mod mock_data;
pub mod node;
pub mod state;
pub mod wallet;
pub mod wire;
