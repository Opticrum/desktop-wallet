mod commands;
mod fnn_cli;
mod tray;

use std::sync::Arc;

use opticrum_wallet_core::backend::{BackendBundle, BackendConfig};
use opticrum_wallet_core::wire::Chain;
use tauri::{Manager, WindowEvent};

/// Tauri-managed shared state — the backend bundle the commands dispatch to.
pub struct AppState(pub Arc<BackendBundle>);

impl AppState {
  async fn new(cfg: BackendConfig) -> Self {
    // Real backend — the app serves live on-chain/fiber data (the runtime mock
    // layer was removed).
    let bundle = BackendBundle::real(cfg)
      .await
      .unwrap_or_else(|e| panic!("backend init failed: {e}"));
    AppState(Arc::new(bundle))
  }
}

fn env_or(key: &str, default: &str) -> String {
  std::env::var(key).unwrap_or_else(|_| default.to_string())
}

/// Resolve the backend config: data files live under the OS app-data dir,
/// chain endpoints come from env vars (with testnet defaults).
fn backend_config(app: &tauri::App) -> BackendConfig {
  let data_dir = app
    .path()
    .app_data_dir()
    .expect("app data dir must resolve");
  std::fs::create_dir_all(&data_dir).ok();

  let network = if env_or("OPTICRUM_NETWORK", "testnet") == "mainnet" {
    Chain::Mainnet
  } else {
    Chain::Testnet
  };

  BackendConfig {
    database_url: data_dir.join("opticrum.db").display().to_string(),
    keystore_path: data_dir.join("keystore.json").display().to_string(),
    node_config_path: data_dir.join("node-config.json").display().to_string(),
    ckb_rpc_url: env_or("OPTICRUM_CKB_RPC", "https://testnet.ckbapp.dev"),
    ckb_indexer_url: env_or("OPTICRUM_CKB_INDEXER", "https://testnet.ckb.dev/indexer"),
    fee_rate: 1000,
    network,
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      app.manage(tauri::async_runtime::block_on(AppState::new(
        backend_config(app),
      )));
      // System tray — created after the backend state so the status poller can
      // read the live node/watchtower runtime.
      tray::setup(app)?;
      Ok(())
    })
    // Closing the window hides it to the tray instead of quitting — the fiber
    // node keeps running in the background. Quitting goes through the tray's
    // 退出 item (risk prompt) → `app.exit`, which bypasses this handler.
    .on_window_event(|window, event| {
      if let WindowEvent::CloseRequested { api, .. } = event {
        if window.label() == "main" {
          api.prevent_close();
          let _ = window.hide();
        }
      }
    })
    .invoke_handler(tauri::generate_handler![
      // app
      commands::app_set_locale,
      commands::app_exit,
      // wallet
      commands::wallet_get_summary,
      commands::wallet_get_status,
      commands::wallet_get_addresses,
      commands::wallet_get_transactions,
      commands::wallet_unlock,
      commands::wallet_lock,
      commands::wallet_create_hd_wallet,
      commands::wallet_import_mnemonic,
      commands::wallet_import_private_key,
      commands::wallet_derive_addresses,
      commands::wallet_send_ckb,
      // node
      commands::node_get_runtime,
      commands::node_start,
      commands::node_stop,
      commands::node_get_logs,
      commands::node_get_config,
      commands::node_save_config,
      commands::node_fnn_cli_status,
      commands::node_fnn_cli_open,
      commands::node_open_url,
      // channels
      commands::channels_list,
      commands::channels_connect_peer,
      commands::channels_disconnect_peer,
      commands::channels_open_channel,
      commands::channels_close_channel,
      // liquidity
      commands::liquidity_get_dashboard,
      commands::liquidity_get_orders,
      commands::liquidity_refresh_orders,
      commands::liquidity_get_matches,
      commands::liquidity_get_matches_near_exhaustion,
      commands::liquidity_publish_order,
      commands::liquidity_cancel_order,
      commands::liquidity_inject_deposit,
      commands::liquidity_withdraw_deposit,
      commands::liquidity_extract_spent_match,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
