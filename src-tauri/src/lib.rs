use serde_json::Value;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn format_json(input: &str) -> Result<String, String> {
    let parsed: Value = serde_json::from_str(input).map_err(|e| e.to_string())?;
    serde_json::to_string_pretty(&parsed).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, format_json])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
