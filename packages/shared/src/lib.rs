use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Compressor {}

#[wasm_bindgen]
impl Compressor {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Compressor { Compressor {} }

    pub fn compress(&self, data: &[u8]) -> Vec<u8> {
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

    pub fn decompress(&self, data: &[u8]) -> Vec<u8> {
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
}

impl Default for Compressor { fn default() -> Self { Self::new() } }

#[wasm_bindgen]
pub struct Hasher { state: u64 }

#[wasm_bindgen]
impl Hasher {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Hasher { Hasher { state: 0x6a09e667f3bcc908 } }
    pub fn update(&mut self, data: &[u8]) {
        for byte in data { self.state = self.state.wrapping_mul(0x100000001b3).wrapping_add(*byte as u64); }
    }
    pub fn finish(&self) -> String { format!("{:016x}", self.state) }
}

impl Default for Hasher { fn default() -> Self { Self::new() } }

#[wasm_bindgen]
pub struct P2PUtils {}

#[wasm_bindgen]
impl P2PUtils {
    #[wasm_bindgen(constructor)]
    pub fn new() -> P2PUtils { P2PUtils {} }
    pub fn generate_peer_id(&self) -> String {
        use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
        let bytes: Vec<u8> = (0..16).map(|_| rand()).collect();
        format!("peer_{}", URL_SAFE_NO_PAD.encode(&bytes))
    }
    fn get_random_bytes(len: usize) -> Vec<u8> { (0..len).map(|_| rand()).collect() }
}

impl Default for P2PUtils { fn default() -> Self { Self::new() } }

fn rand() -> u8 { (js_sys::Math::random() * 256.0) as u8 }
