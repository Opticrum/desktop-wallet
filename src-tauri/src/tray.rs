//! System tray — the app lives here when the window is closed.
//!
//! Closing the window hides it instead of quitting, so the embedded fiber node
//! and its watchtower keep running in the background and stay reachable on the
//! network (liquidity buy orders can still be fulfilled). The tray menu shows
//! the live node / watchtower status plus 显示 / 退出. This is host-level OS
//! integration, so it lives in the Tauri shell, not in `opticrum-wallet-core`.

use std::sync::Mutex;

use opticrum_wallet_core::wire::WatchtowerMode;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{App, AppHandle, Emitter, Manager};

use crate::AppState;

/// Current UI locale (`'zh'` | `'en'`) — the tray menu text is built from it.
/// The frontend syncs it via `app.set_locale`.
pub struct LocaleState(pub Mutex<String>);

/// Last-known node/watchtower state, refreshed by the background poller.
#[derive(Clone, Default)]
pub struct TrayStatus {
  pub node_running: bool,
  pub watchtower_running: bool,
}

pub struct TrayStatusState(pub Mutex<TrayStatus>);

const TRAY_ID: &str = "main";

/// Create the tray icon + menu, register its handlers, and start the poller
/// that keeps the status items fresh. Called from `lib.rs` setup.
pub fn setup(app: &mut App) -> tauri::Result<()> {
  app.manage(LocaleState(Mutex::new("zh".to_string())));
  app.manage(TrayStatusState(Mutex::new(TrayStatus::default())));

  // Tray icon — prefer the bundled 32px PNG (a known-valid RGBA image).
  // `default_window_icon()` can resolve to an empty image in dev, which would
  // make muda panic on a zero-width tray icon, so only fall back to it when it
  // actually has a non-zero size.
  let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/32x32.png"))
    .ok()
    .or_else(|| {
      let d = app.default_window_icon()?;
      (d.width() > 0 && d.height() > 0).then(|| d.clone())
    });

  let menu = build_menu(app.handle())?;

  // Left-click opens the menu (platform default), which carries the status
  // items + 显示/退出. The menu's 显示 item restores the window.
  let mut builder = TrayIconBuilder::with_id(TRAY_ID)
    .menu(&menu)
    .on_menu_event(|app, event| {
      eprintln!("TRAY-DEBUG: menu event id={:?}", event.id().as_ref());
      match event.id().as_ref() {
        "show" => show_main_window(app),
        "quit" => {
        // Bring the window up and let the frontend show the bilingual risk
        // prompt — the real exit happens only after the user confirms there.
        show_main_window(app);
        let _ = app.emit("tray-exit-requested", ());
      }
      _ => {}
    }
  });

  if let Some(icon) = icon {
    builder = builder.icon(icon);
  }
  builder.build(app)?;

  // Background poller — refresh the tray status items every 5s so the menu
  // reflects the node / watchtower even while the window is hidden.
  let handle = app.handle().clone();
  let backend = app.state::<AppState>().0.clone();
  tauri::async_runtime::spawn(async move {
    loop {
      if let Ok(rt) = backend.node.get_runtime().await {
        {
          let status_state = handle.state::<TrayStatusState>();
          let mut status = status_state.0.lock().unwrap();
          status.node_running = rt.running;
          status.watchtower_running = rt.watchtower.mode != WatchtowerMode::Disabled;
        }
        let _ = rebuild_menu(&handle);
      }
      tokio::time::sleep(std::time::Duration::from_secs(5)).await;
    }
  });

  Ok(())
}

/// Update the stored locale and rebuild the tray menu text.
pub fn set_locale(app: &AppHandle, locale: &str) {
  let loc = if locale == "en" { "en" } else { "zh" };
  *app.state::<LocaleState>().0.lock().unwrap() = loc.to_string();
  let _ = rebuild_menu(app);
}

/// Build the tray menu from the stored locale + node status. Item ids stay
/// stable so the menu-event handler keeps matching `show` / `quit`.
fn build_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
  let loc = app.state::<LocaleState>().0.lock().unwrap().clone();
  let status = app.state::<TrayStatusState>().0.lock().unwrap().clone();

  let node_item = MenuItem::with_id(
    app,
    "node_status",
    node_status_label(&loc, status.node_running),
    false,
    None::<&str>,
  )?;
  let watchtower_item = MenuItem::with_id(
    app,
    "watchtower_status",
    watchtower_status_label(&loc, status.watchtower_running),
    false,
    None::<&str>,
  )?;
  let separator = PredefinedMenuItem::separator(app)?;
  let (show_label, quit_label) = labels(&loc);
  let show_item = MenuItem::with_id(app, "show", show_label, true, None::<&str>)?;
  let quit_item = MenuItem::with_id(app, "quit", quit_label, true, None::<&str>)?;

  Menu::with_items(
    app,
    &[
      &node_item,
      &watchtower_item,
      &separator,
      &show_item,
      &quit_item,
    ],
  )
}

/// Rebuild the tray menu from the stored locale + node status and swap it in.
/// Item ids stay stable, so the menu-event handler keeps matching `show`/`quit`.
pub fn rebuild_menu(app: &AppHandle) -> tauri::Result<()> {
  eprintln!("TRAY-DEBUG: rebuild_menu");
  let menu = build_menu(app)?;
  if let Some(tray) = app.tray_by_id(TRAY_ID) {
    tray.set_menu(Some(menu))?;
  }
  Ok(())
}

/// Bring the main window to the front (used by the 显示 item and left-click).
fn show_main_window(app: &AppHandle) {
  eprintln!("TRAY-DEBUG: show_main_window");
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
  }
}

fn node_status_label(locale: &str, running: bool) -> String {
  match (locale, running) {
    ("en", true) => "Fiber node: running".into(),
    ("en", false) => "Fiber node: stopped".into(),
    (_, true) => "Fiber 节点：运行中".into(),
    (_, false) => "Fiber 节点：已停止".into(),
  }
}

fn watchtower_status_label(locale: &str, running: bool) -> String {
  match (locale, running) {
    ("en", true) => "Watchtower: running".into(),
    ("en", false) => "Watchtower: not running".into(),
    (_, true) => "瞭望塔：运行中".into(),
    (_, false) => "瞭望塔：未运行".into(),
  }
}

fn labels(locale: &str) -> (&'static str, &'static str) {
  if locale == "en" {
    ("Show", "Quit")
  } else {
    ("显示", "退出")
  }
}
