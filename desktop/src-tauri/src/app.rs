use crate::policy::{launcher_navigation, Navigation, NavigationPolicy};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{
    menu::{Menu, MenuItem, Submenu},
    webview::NewWindowResponse,
    Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_opener::OpenerExt;

const TITLE: &str = "MURK & METTLE";
const QUIT_MESSAGE: &str = "Before quitting, open Account in the game and use SAVE NOW. Check that it succeeded. Unsaved progress (normally up to 12 seconds) may be lost, especially offline. Quit now?";
static QUIT_PENDING: AtomicBool = AtomicBool::new(false);

// No URL, token or credentials can be supplied by the caller. ACL and label both restrict this command.
// WebView2 window creation must run outside synchronous IPC handlers to avoid a Windows deadlock.
#[tauri::command]
async fn start_game(window: tauri::WebviewWindow) -> Result<(), String> {
    if window.label() != "launcher" {
        return Err("Only the bundled launcher can open the game".into());
    }
    eprintln!("Desktop: launcher command accepted");
    let result = open_game(window.app_handle()).map_err(|e| e.to_string());
    eprintln!(
        "Desktop: game window creation completed: {}",
        result.is_ok()
    );
    result
}

fn open_game(app: &tauri::AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("field") {
        window.unminimize()?;
        window.show()?;
        window.set_focus()?;
        return Ok(());
    }
    let policy = app.state::<NavigationPolicy>().inner().clone();
    let popup_policy = policy.clone();
    let popup_app = app.clone();
    WebviewWindowBuilder::new(app, "field", WebviewUrl::External(policy.game_url()))
        .title(TITLE)
        .inner_size(1366.0, 768.0)
        .min_inner_size(640.0, 360.0)
        .prevent_overflow()
        .resizable(true)
        .center()
        .disable_drag_drop_handler()
        .devtools(cfg!(debug_assertions))
        .initialization_script(include_str!("network-status.js"))
        // Cross-origin redirects never turn the field window into another website.
        .on_navigation(move |url| policy.classify(url) == Navigation::Game)
        .on_new_window(move |url, _| {
            match popup_policy.classify(&url) {
                Navigation::Game => {
                    if let Some(field) = popup_app.get_webview_window("field") {
                        let _ = field.navigate(url);
                    }
                }
                Navigation::ExternalHttps => {
                    // Rust-side validation; no shell/file/custom protocol URLs and no JS opener capability.
                    let _ = popup_app.opener().open_url(url.as_str(), None::<&str>);
                }
                Navigation::Deny => {}
            }
            NewWindowResponse::Deny
        })
        .on_download(|_, _| false)
        .build()?;
    Ok(())
}

fn help(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("launcher") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn quit(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("field") {
        let _ = window.close(); // Uses the same confirmation as the window close button / Alt+F4.
    } else {
        app.exit(0);
    }
}

pub fn run() {
    let policy = NavigationPolicy::from_json(include_str!("../../deployment.json"))
        .expect("Invalid desktop deployment origin");
    tauri::Builder::default()
        .manage(policy)
        .plugin(tauri_plugin_opener::Builder::new().open_js_links_on_click(false).build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![start_game])
        .setup(|app| {
            let reload = MenuItem::with_id(app, "reload", "Reload field…", true, None::<&str>)?;
            let connection = MenuItem::with_id(app, "help", "Connection & help", true, None::<&str>)?;
            let exit = MenuItem::with_id(app, "quit", "Quit…", true, None::<&str>)?;
            let fullscreen = MenuItem::with_id(app, "fullscreen", "Toggle fullscreen", true, Some("F11"))?;
            let alternate = MenuItem::with_id(app, "fullscreen-alt", "Toggle fullscreen (Alt+Enter)", true, Some("Alt+Enter"))?;
            let game = Submenu::with_items(app, "Game", true, &[&reload, &connection, &exit])?;
            let view = Submenu::with_items(app, "View", true, &[&fullscreen, &alternate])?;
            app.set_menu(Menu::with_items(app, &[&game, &view])?)?;
            WebviewWindowBuilder::new(app, "launcher", WebviewUrl::App("index.html".into()))
                .title(format!("{TITLE} · Desktop launcher"))
                .inner_size(800.0, 680.0)
                .min_inner_size(480.0, 400.0)
                .prevent_overflow()
                .center()
                .resizable(true)
                .on_navigation(|url| launcher_navigation(url, cfg!(debug_assertions)))
                .on_new_window(|_, _| NewWindowResponse::Deny)
                .on_download(|_, _| false)
                .build()?;
            Ok(())
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            "fullscreen" | "fullscreen-alt" => {
                if let Some(window) = app.get_webview_window("field") {
                    if let Ok(fullscreen) = window.is_fullscreen() {
                        let _ = window.set_fullscreen(!fullscreen);
                    }
                }
            }
            "help" => help(app),
            "reload" => {
                if let Some(field) = app.get_webview_window("field") {
                    let origin = app.state::<NavigationPolicy>().game_url();
                    app.dialog().message("Reloading leaves the room and can lose unsaved progress. Use Account → SAVE NOW first if the connection is working. Reload the field?")
                        .title(TITLE)
                        .parent(&field)
                        .buttons(MessageDialogButtons::OkCancelCustom("Reload".into(), "Keep playing".into()))
                        .show(move |confirmed| { if confirmed { let _ = field.navigate(origin); } });
                }
            }
            "quit" => quit(app),
            _ => {}
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "field" {
                    api.prevent_close();
                    if QUIT_PENDING.swap(true, Ordering::SeqCst) { return; }
                    let app = window.app_handle().clone();
                    app.dialog().message(QUIT_MESSAGE).title(TITLE).parent(window)
                        .buttons(MessageDialogButtons::OkCancelCustom("Quit".into(), "Keep playing".into()))
                        .show(move |confirmed| {
                            QUIT_PENDING.store(false, Ordering::SeqCst);
                            if confirmed { app.exit(0); }
                        });
                } else if window.app_handle().get_webview_window("field").is_some() {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("MURK & METTLE desktop host failed to start");
}
