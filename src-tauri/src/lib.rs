/// Brasa's native shell. The reader logic lives in the web layer; this side only
/// provides the window and the file dialog and file system plugins it relies on.
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running Brasa");
}
