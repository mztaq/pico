#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // The desktop window always loads the live Pico website. No compiler,
    // simulator, project data, or frontend is bundled for offline use.
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("failed to start Pico");
}
