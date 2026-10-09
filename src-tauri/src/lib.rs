// Langplay desktop shell.
//
// - Window mode (default): the app in its own window.
// - Browser mode: serves the same app on http://127.0.0.1:20136 and opens the default browser;
//   a tray icon offers Open / Quit.
// - Offline AI: downloads a pinned llama.cpp server and a model (checksums verified), then runs
//   it on 127.0.0.1:12081 as an OpenAI-compatible endpoint.
// - Repair: re-downloads and runs the installer of the installed version.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    process::{Child, Command},
    sync::Mutex,
    thread,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder,
};

const BROWSER_PORT: u16 = 20136;
const OFFLINE_PORT: u16 = 12081;
const RELEASES: &str = "https://github.com/DnD-World/langplay/releases/download";

// ---------- window or browser mode ----------

#[derive(Serialize, Deserialize, Clone)]
struct Prefs {
    mode: String,
}

impl Default for Prefs {
    fn default() -> Self {
        Prefs { mode: "window".into() }
    }
}

fn prefs_file(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("desktop.json"))
}

fn read_prefs(app: &AppHandle) -> Prefs {
    prefs_file(app)
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

#[tauri::command]
fn get_mode(app: AppHandle) -> String {
    read_prefs(&app).mode
}

#[tauri::command]
fn set_mode(app: AppHandle, mode: String) -> Result<(), String> {
    if mode != "window" && mode != "browser" {
        return Err("Unknown mode".into());
    }
    let file = prefs_file(&app).ok_or("No settings folder")?;
    if let Some(dir) = file.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let text = serde_json::to_string(&Prefs { mode }).map_err(|e| e.to_string())?;
    fs::write(file, text).map_err(|e| e.to_string())
}

fn open_window(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }
    let mut builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
        .title("Langplay")
        .inner_size(1360.0, 860.0)
        .min_inner_size(900.0, 600.0);
    // Testing aid: LANGPLAY_WEBVIEW_DEBUG_PORT=nnnnn exposes the window to automated browser tests.
    if let Ok(port) = std::env::var("LANGPLAY_WEBVIEW_DEBUG_PORT") {
        if let Ok(port) = port.parse::<u16>() {
            builder = builder.additional_browser_args(&format!(
                "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --remote-debugging-port={port}"
            ));
        }
    }
    builder.build()?;
    Ok(())
}

/// Serves the bundled app to the user's browser. Only listens on 127.0.0.1.
fn serve_browser(app: AppHandle) {
    let server = match tiny_http::Server::http(("127.0.0.1", BROWSER_PORT)) {
        Ok(server) => server,
        Err(error) => {
            eprintln!("Langplay could not open port {BROWSER_PORT}: {error}");
            return;
        }
    };
    for request in server.incoming_requests() {
        let url = request.url().to_string();
        let path = url.split(['?', '#']).next().unwrap_or("/").trim_start_matches('/');
        let wanted = if path.is_empty() { "index.html" } else { path };
        let resolver = app.asset_resolver();
        // Unknown paths fall back to the app shell (it is a single-page app).
        let asset = resolver
            .get(wanted.to_string())
            .or_else(|| resolver.get("index.html".to_string()));
        let response = match asset {
            Some(asset) => {
                let mut response = tiny_http::Response::from_data(asset.bytes().to_vec());
                if let Ok(header) =
                    tiny_http::Header::from_bytes("Content-Type", asset.mime_type().as_bytes())
                {
                    response = response.with_header(header);
                }
                response
            }
            None => tiny_http::Response::from_string("Not found").with_status_code(404),
        };
        let _ = request.respond(response);
    }
}

fn open_in_browser(app: &AppHandle) {
    use tauri_plugin_opener::OpenerExt;
    let _ = app
        .opener()
        .open_url(format!("http://127.0.0.1:{BROWSER_PORT}/"), None::<&str>);
}

fn start_browser_mode(app: &AppHandle) -> tauri::Result<()> {
    let handle = app.clone();
    thread::spawn(move || serve_browser(handle));
    let open = MenuItem::with_id(app, "open", "Open Langplay", true, None::<&str>)?;
    let window = MenuItem::with_id(app, "window", "Switch to window mode", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &window, &quit])?;
    let mut tray = TrayIconBuilder::new()
        .tooltip("Langplay (browser mode)")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => open_in_browser(app),
            "window" => {
                let _ = set_mode(app.clone(), "window".into());
                app.restart();
            }
            "quit" => app.exit(0),
            _ => {}
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    open_in_browser(app);
    Ok(())
}

// ---------- offline AI ----------

struct Offline(Mutex<Option<Child>>);

fn offline_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("offline-ai");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn safe_name(name: &str) -> Result<(), String> {
    if name.is_empty() || name.contains("..") || name.contains('/') || name.contains('\\') {
        return Err("Bad file name".into());
    }
    Ok(())
}

fn find_server(dir: &Path) -> Option<PathBuf> {
    let entries = fs::read_dir(dir).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if let Some(found) = find_server(&path) {
                return Some(found);
            }
        } else if path.file_name().and_then(|n| n.to_str()) == Some("llama-server.exe") {
            return Some(path);
        }
    }
    None
}

#[derive(Serialize, Clone)]
struct Progress {
    id: String,
    done: u64,
    total: u64,
}

/// Downloads a file into the offline-AI folder and checks its SHA-256 before keeping it.
fn download_verified(
    app: &AppHandle,
    id: &str,
    url: &str,
    dest: &Path,
    sha256: Option<&str>,
) -> Result<(), String> {
    let mut response = ureq::get(url)
        .header("User-Agent", "Langplay")
        .call()
        .map_err(|e| format!("Download failed: {e}"))?;
    let total = response
        .headers()
        .get("content-length")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(0);
    let part = dest.with_extension("part");
    let mut file = fs::File::create(&part).map_err(|e| e.to_string())?;
    let mut reader = response.body_mut().as_reader();
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 1 << 20];
    let mut done: u64 = 0;
    let mut last_report: u64 = 0;
    loop {
        let read = reader.read(&mut buffer).map_err(|e| e.to_string())?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
        file.write_all(&buffer[..read]).map_err(|e| e.to_string())?;
        done += read as u64;
        if done - last_report >= 4 << 20 || done == total {
            last_report = done;
            let _ = app.emit("offline-progress", Progress { id: id.into(), done, total });
        }
    }
    drop(file);
    if let Some(expected) = sha256 {
        let actual = format!("{:x}", hasher.finalize());
        if !actual.eq_ignore_ascii_case(expected) {
            let _ = fs::remove_file(&part);
            return Err("The download did not match its checksum and was deleted.".into());
        }
    }
    fs::rename(&part, dest).map_err(|e| e.to_string())?;
    let _ = app.emit("offline-progress", Progress { id: id.into(), done, total: done });
    Ok(())
}

fn allowed_source(url: &str) -> bool {
    url.starts_with("https://github.com/ggml-org/llama.cpp/releases/download/")
        || url.starts_with("https://huggingface.co/")
}

#[tauri::command]
async fn offline_download(
    app: AppHandle,
    id: String,
    url: String,
    file: String,
    sha256: String,
) -> Result<(), String> {
    if !allowed_source(&url) {
        return Err("Download source not allowed".into());
    }
    safe_name(&file)?;
    let dir = offline_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let dest = dir.join(&file);
        download_verified(&app, &id, &url, &dest, Some(&sha256))?;
        // The engine comes as a zip: unpack it next to the models.
        if file.ends_with(".zip") {
            let engine = dir.join("engine");
            let _ = fs::remove_dir_all(&engine);
            let archive = fs::File::open(&dest).map_err(|e| e.to_string())?;
            let mut archive = zip::ZipArchive::new(archive).map_err(|e| e.to_string())?;
            for index in 0..archive.len() {
                let mut entry = archive.by_index(index).map_err(|e| e.to_string())?;
                let Some(name) = entry.enclosed_name() else { continue };
                let path = engine.join(name);
                if entry.is_dir() {
                    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
                } else {
                    if let Some(parent) = path.parent() {
                        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                    }
                    let mut out = fs::File::create(&path).map_err(|e| e.to_string())?;
                    std::io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
                }
            }
            let _ = fs::remove_file(&dest);
            if find_server(&engine).is_none() {
                return Err("The engine download did not contain llama-server.exe".into());
            }
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Serialize)]
struct OfflineStatus {
    engine: bool,
    models: Vec<String>,
    running: bool,
    port: u16,
    folder: String,
}

#[tauri::command]
fn offline_status(app: AppHandle, state: tauri::State<Offline>) -> Result<OfflineStatus, String> {
    let dir = offline_dir(&app)?;
    let models = fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .flatten()
        .filter_map(|e| e.file_name().into_string().ok())
        .filter(|n| n.ends_with(".gguf"))
        .collect();
    let mut guard = state.0.lock().map_err(|_| "Busy")?;
    let running = match guard.as_mut() {
        Some(child) => matches!(child.try_wait(), Ok(None)),
        None => false,
    };
    Ok(OfflineStatus {
        engine: find_server(&dir.join("engine")).is_some(),
        models,
        running,
        port: OFFLINE_PORT,
        folder: dir.to_string_lossy().into_owned(),
    })
}

#[tauri::command]
fn offline_start(
    app: AppHandle,
    state: tauri::State<Offline>,
    model: String,
    threads: u32,
) -> Result<u16, String> {
    safe_name(&model)?;
    let dir = offline_dir(&app)?;
    let exe = find_server(&dir.join("engine")).ok_or("The offline engine is not installed")?;
    let model_path = dir.join(&model);
    if !model_path.exists() {
        return Err("That model is not downloaded".into());
    }
    let mut guard = state.0.lock().map_err(|_| "Busy")?;
    if let Some(mut old) = guard.take() {
        let _ = old.kill();
    }
    let mut command = Command::new(exe);
    command.args([
        "-m",
        &model_path.to_string_lossy(),
        "--host",
        "127.0.0.1",
        "--port",
        &OFFLINE_PORT.to_string(),
        "-t",
        &threads.clamp(1, 64).to_string(),
        "-c",
        "4096",
    ]);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000); // no console window
    }
    *guard = Some(command.spawn().map_err(|e| e.to_string())?);
    Ok(OFFLINE_PORT)
}

#[tauri::command]
fn offline_stop(state: tauri::State<Offline>) -> Result<(), String> {
    if let Some(mut child) = state.0.lock().map_err(|_| "Busy")?.take() {
        let _ = child.kill();
    }
    Ok(())
}

#[tauri::command]
fn offline_delete(app: AppHandle, state: tauri::State<Offline>, file: String) -> Result<(), String> {
    safe_name(&file)?;
    offline_stop(state)?;
    let dir = offline_dir(&app)?;
    if file == "engine" {
        fs::remove_dir_all(dir.join("engine")).map_err(|e| e.to_string())
    } else {
        fs::remove_file(dir.join(file)).map_err(|e| e.to_string())
    }
}

// ---------- repair ----------

/// Downloads the installer of the installed version from GitHub Releases and runs it.
/// Settings, recipes and downloaded models are kept (the installer only replaces program files).
#[tauri::command]
async fn repair(app: AppHandle) -> Result<(), String> {
    let version = app.package_info().version.to_string();
    let url = format!("{RELEASES}/v{version}/Langplay_{version}_x64-setup.exe");
    let dest = std::env::temp_dir().join(format!("Langplay_{version}_x64-setup.exe"));
    let handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        download_verified(&handle, "repair", &url, &dest, None)?;
        // /P = passive install: a progress bar only, no questions.
        Command::new(&dest).arg("/P").spawn().map_err(|e| e.to_string())?;
        Ok::<(), String>(())
    })
    .await
    .map_err(|e| e.to_string())??;
    app.exit(0);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(Offline(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            get_mode,
            set_mode,
            offline_download,
            offline_status,
            offline_start,
            offline_stop,
            offline_delete,
            repair
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            if read_prefs(&handle).mode == "browser" {
                start_browser_mode(&handle)?;
            } else {
                open_window(&handle)?;
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Langplay");

    app.run(|handle, event| match event {
        // In browser mode there is no window; keep running until Quit from the tray.
        RunEvent::ExitRequested { api, code, .. } => {
            if code.is_none() && read_prefs(handle).mode == "browser" {
                api.prevent_exit();
            }
        }
        RunEvent::Exit => {
            if let Some(state) = handle.try_state::<Offline>() {
                if let Ok(mut guard) = state.0.lock() {
                    if let Some(mut child) = guard.take() {
                        let _ = child.kill();
                    }
                }
            }
        }
        _ => {}
    });
}
