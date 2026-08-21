//! System tray — the app lives here when the window is closed.
//!
//! Closing the window hides it instead of quitting, so the embedded fiber node
//! and its watchtower keep running in the background and stay reachable on the
//! network (liquidity buy orders can still be fulfilled). The tray menu shows
//! the live node / watchtower status plus 显示 / 退出. This is host-level OS
//! integration, so it lives in the Tauri shell, not in `opticrum-wallet-core`.
//!
//! The menu is built once at setup and its item *text* is updated in place.
//! Rebuilding/swapping the whole NSMenu via `set_menu` from a background
//! thread is what crashed the app on macOS: `set_menu` calls AppKit off the
//! main thread and races with the menu being tracked when the user clicks it,
//! so a Rust panic escapes `sendEvent:` and aborts the process.

use std::sync::Mutex;

use opticrum_wallet_core::wire::WatchtowerMode;
use tauri::menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem};
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

/// Handles to the tray menu's dynamic items. Their text is refreshed in place
/// (locale + node/watchtower status) rather than rebuilding the menu, which
/// keeps all AppKit mutation on the main thread via `MenuItem::set_text`.
pub struct TrayItems {
  pub node: MenuItem<tauri::Wry>,
  pub watchtower: MenuItem<tauri::Wry>,
  pub show: MenuItem<tauri::Wry>,
  pub quit: MenuItem<tauri::Wry>,
}

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

  let (menu, items) = build_menu(app.handle())?;
  app.manage(items);

  // Left-click opens the menu (platform default), which carries the status
  // items + 显示/退出. The menu's 显示 item restores the window. The handler
  // runs inside AppKit's menu-tracking `sendEvent:`; a Rust panic there cannot
  // unwind through the ObjC trampoline and would abort the whole app, so it is
  // contained and left to the panic hook to log.
  let mut builder = TrayIconBuilder::with_id(TRAY_ID)
    .menu(&menu)
    .on_menu_event(|app, event| {
      let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        handle_tray_menu_event(app, &event);
      }));
    });

  if let Some(icon) = icon {
    builder = builder.icon(icon);
  }
  builder.build(app)?;

  // Background poller — refresh the tray status items every 5s so the menu
  // reflects the node / watchtower even while the window is hidden. Only
  // updates the item text when the state actually changed; it never swaps the
  // whole menu.
  let handle = app.handle().clone();
  let backend = app.state::<AppState>().0.clone();
  tauri::async_runtime::spawn(async move {
    loop {
      if let Ok(rt) = backend.node.get_runtime().await {
        let changed = {
          let status_state = handle.state::<TrayStatusState>();
          let mut status = status_state.0.lock().unwrap();
          let watchtower_running = rt.watchtower.mode != WatchtowerMode::Disabled;
          let changed =
            status.node_running != rt.running || status.watchtower_running != watchtower_running;
          status.node_running = rt.running;
          status.watchtower_running = watchtower_running;
          changed
        };
        if changed {
          let _ = update_tray_menu(&handle);
        }
      }
      tokio::time::sleep(std::time::Duration::from_secs(5)).await;
    }
  });

  Ok(())
}

/// Route a tray menu click to its handler. Extracted from the `on_menu_event`
/// closure so the closure stays a thin `catch_unwind` guard.
fn handle_tray_menu_event(app: &AppHandle, event: &MenuEvent) {
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
}

/// Update the stored locale and refresh the tray menu text.
pub fn set_locale(app: &AppHandle, locale: &str) {
  let loc = if locale == "en" { "en" } else { "zh" };
  *app.state::<LocaleState>().0.lock().unwrap() = loc.to_string();
  let _ = update_tray_menu(app);
}

/// Build the tray menu from the stored locale + node status. Item ids stay
/// stable so the menu-event handler keeps matching `show` / `quit`. Returns
/// the menu plus handles to its dynamic items for in-place text updates.
fn build_menu(app: &AppHandle) -> tauri::Result<(Menu<tauri::Wry>, TrayItems)> {
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

  let menu = Menu::with_items(
    app,
    &[
      &node_item,
      &watchtower_item,
      &separator,
      &show_item,
      &quit_item,
    ],
  )?;

  Ok((
    menu,
    TrayItems {
      node: node_item,
      watchtower: watchtower_item,
      show: show_item,
      quit: quit_item,
    },
  ))
}

/// Refresh the tray menu text in place from the stored locale + node status.
/// `MenuItem::set_text` marshals to the main thread (`run_on_main_thread`), so
/// this is safe to call from the poller and never swaps the menu object.
pub fn update_tray_menu(app: &AppHandle) -> tauri::Result<()> {
  let loc = app.state::<LocaleState>().0.lock().unwrap().clone();
  let status = app.state::<TrayStatusState>().0.lock().unwrap().clone();
  let items = app.state::<TrayItems>();

  items
    .node
    .set_text(node_status_label(&loc, status.node_running))?;
  items
    .watchtower
    .set_text(watchtower_status_label(&loc, status.watchtower_running))?;
  let (show_label, quit_label) = labels(&loc);
  items.show.set_text(show_label)?;
  items.quit.set_text(quit_label)?;
  Ok(())
}

/// Bring the main window to the front (used by the 显示 item and left-click).
/// Deferred to the main event loop via `run_on_main_thread` so the window
/// ordering doesn't happen re-entrantly inside AppKit's menu-tracking
/// `sendEvent:` (which is what the 显示 click is processed in).
fn show_main_window(app: &AppHandle) {
  let handle = app.clone();
  let app = app.clone();
  let _ = handle.run_on_main_thread(move || {
    if let Some(window) = app.get_webview_window("main") {
      let _ = window.show();
      let _ = window.unminimize();
      let _ = window.set_focus();
    }
  });
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
