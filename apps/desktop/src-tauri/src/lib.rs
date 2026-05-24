// Earth Guardians Desktop Library

use tauri::Manager;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

pub fn run() {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting Earth Guardians Desktop...");

    tauri::Builder::default()
        .setup(|app| {
            tracing::info!("Application setup complete");
            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_window("main") {
                    let _ = window.open_devtools();
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            get_system_info,
            generate_uuid,
            encode_base64,
            decode_base64,
            compress_data,
            decompress_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn get_app_info() -> serde_json::Value {
    serde_json::json!({
        "name": "Earth Guardians",
        "version": env!("CARGO_PKG_VERSION"),
        "description": "Earth Guardians NGO Platform",
        "features": { "p2p": true, "wasm": true, "encryption": true, "decentralized": true }
    })
}

#[tauri::command]
fn get_system_info() -> serde_json::Value {
    serde_json::json!({
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "family": std::env::consts::FAMILY,
    })
}

#[tauri::command]
fn generate_uuid() -> String {
    uuid::Uuid::new_v4().to_string()
}

#[tauri::command]
fn encode_base64(data: String) -> Result<String, String> {
    use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
    Ok(BASE64.encode(data.as_bytes()))
}

#[tauri::command]
fn decode_base64(data: String) -> Result<String, String> {
    use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
    let decoded = BASE64.decode(&data).map_err(|e| e.to_string())?;
    String::from_utf8(decoded).map_err(|e| e.to_string())
}

fn compress_lz77(data: &[u8]) -> Vec<u8> {
    let mut output = Vec::new();
    let mut i = 0;
    while i < data.len() {
        let window_start = if i >= 4096 { i - 4096 } else { 0 };
        let window = &data[window_start..i];
        let remaining = &data[i..std::cmp::min(i + 258, data.len())];
        let mut best_offset = 0;
        let mut best_length = 0;
        for (j, _) in window.iter().enumerate() {
            let mut length = 0;
            while length < remaining.len() && window[j + length] == remaining[length] {
                length += 1;
                if j + length >= window.len() { break; }
            }
            if length > best_length && length > 3 {
                best_offset = i - (window_start + j);
                best_length = length;
            }
        }
        if best_length > 3 {
            output.push(0x80 | (best_length - 4).min(127) as u8);
            output.push((best_offset >> 8) as u8);
            output.push((best_offset & 0xFF) as u8);
            i += best_length;
        } else {
            output.push(data[i]);
            i += 1;
        }
    }
    output
}

fn decompress_lz77(data: &[u8]) -> Vec<u8> {
    let mut output = Vec::new();
    let mut i = 0;
    while i < data.len() {
        let byte = data[i];
        if byte < 0x80 {
            output.push(byte);
            i += 1;
        } else {
            let length = ((byte & 0x7F) + 4) as usize;
            i += 1;
            if i + 1 >= data.len() { break; }
            let offset = ((data[i] as usize) << 8) | (data[i + 1] as usize);
            i += 2;
            for _ in 0..length {
                if let Some(&byte) = output.get(output.len() - offset) {
                    output.push(byte);
                }
            }
        }
    }
    output
}

#[tauri::command]
fn compress_data(data: String) -> Result<String, String> {
    use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
    let decoded = BASE64.decode(&data).map_err(|e| e.to_string())?;
    let compressed = compress_lz77(&decoded);
    Ok(BASE64.encode(&compressed))
}

#[tauri::command]
fn decompress_data(data: String) -> Result<String, String> {
    use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
    let decoded = BASE64.decode(&data).map_err(|e| e.to_string())?;
    let decompressed = decompress_lz77(&decoded);
    Ok(BASE64.encode(&decompressed))
}
