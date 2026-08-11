mod commands;
mod mock_data;
mod state;
mod wire;

use state::AppState;

/// Current wall-clock in ms — used to stamp locally-created sidecar entries.
fn now_ms() -> u64 {
  std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|d| d.as_millis() as u64)
    .unwrap_or(0)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(AppState::new())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      // wallet
      commands::wallet_get_summary,
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
      // channels
      commands::channels_list,
      commands::channels_connect_peer,
      commands::channels_disconnect_peer,
      commands::channels_open_channel,
      commands::channels_close_channel,
      // liquidity
      commands::liquidity_get_dashboard,
      commands::liquidity_get_orders,
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
