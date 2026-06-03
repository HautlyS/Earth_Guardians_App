use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use getrandom::getrandom;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn _start() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub struct Compressor {}

impl Compressor {
    fn decompress_inner(data: &[u8]) -> Vec<u8> {
        let mut output: Vec<u8> = Vec::with_capacity(data.len() * 2);
        let mut i = 0;
        while i < data.len() {
            let byte = data[i];
            if byte < 0x80 {
                output.push(byte);
                i += 1;
            } else {
                let length = ((byte & 0x7F) + 4) as usize;
                i += 1;
                if i + 1 >= data.len() {
                    break;
                }
                let offset = ((data[i] as usize) << 8) | (data[i + 1] as usize);
                i += 2;
                if offset == 0 || offset > output.len() {
                    return output;
                }
                for _ in 0..length {
                    let start = output.len() - offset;
                    let byte = output[start];
                    output.push(byte);
                }
            }
        }
        output
    }
}

#[wasm_bindgen]
impl Compressor {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Compressor {
        Compressor {}
    }

    pub fn compress(&self, data: &[u8]) -> Vec<u8> {
        let mut output: Vec<u8> = Vec::with_capacity(data.len());
        let mut i: usize = 0;
        while i < data.len() {
            let window_start = if i >= 4096 { i - 4096 } else { 0 };
            let window = &data[window_start..i];
            let remaining = &data[i..std::cmp::min(i + 258, data.len())];
            let mut best_offset: usize = 0;
            let mut best_length: usize = 0;
            for (j, _) in window.iter().enumerate() {
                let mut length: usize = 0;
                while length < remaining.len()
                    && j + length < window.len()
                    && window[j + length] == remaining[length]
                {
                    length += 1;
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
        Compressor::decompress_inner(data)
    }
}

impl Default for Compressor {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
pub struct Hasher {
    state: u64,
}

#[wasm_bindgen]
impl Hasher {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Hasher {
        Hasher {
            state: 0xcbf29ce484222325,
        }
    }

    pub fn update(&mut self, data: &[u8]) {
        for byte in data {
            self.state ^= *byte as u64;
            self.state = self.state.wrapping_mul(0x100000001b3);
        }
    }

    pub fn finish(&self) -> String {
        format!("{:016x}", self.state)
    }
}

impl Default for Hasher {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
pub struct P2PUtils {}

#[wasm_bindgen]
impl P2PUtils {
    #[wasm_bindgen(constructor)]
    pub fn new() -> P2PUtils {
        P2PUtils {}
    }

    pub fn generate_peer_id(&self) -> String {
        let mut bytes = [0u8; 16];
        if getrandom(&mut bytes).is_err() {
            for b in bytes.iter_mut() {
                *b = (js_sys::Math::random() * 256.0) as u8;
            }
        }
        format!("peer_{}", URL_SAFE_NO_PAD.encode(bytes))
    }

    pub fn random_bytes(&self, len: usize) -> Vec<u8> {
        let mut bytes = vec![0u8; len];
        if getrandom(&mut bytes).is_err() {
            for b in bytes.iter_mut() {
                *b = (js_sys::Math::random() * 256.0) as u8;
            }
        }
        bytes
    }
}

impl Default for P2PUtils {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
pub fn hash_bytes(data: &[u8]) -> String {
    let mut h = Hasher::new();
    h.update(data);
    h.finish()
}

#[wasm_bindgen]
pub fn compress_bytes(data: &[u8]) -> Vec<u8> {
    Compressor::new().compress(data)
}

#[wasm_bindgen]
pub fn decompress_bytes(data: &[u8]) -> Vec<u8> {
    Compressor::decompress_inner(data)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_small() {
        let data: Vec<u8> = (0..32).collect();
        let c = Compressor::new();
        let compressed = c.compress(&data);
        let decompressed = c.decompress(&compressed);
        assert_eq!(data, decompressed);
    }

    #[test]
    fn roundtrip_repeating() {
        let data = vec![0xAB; 4096];
        let c = Compressor::new();
        let compressed = c.compress(&data);
        let decompressed = c.decompress(&compressed);
        assert_eq!(data, decompressed);
    }

    #[test]
    fn hash_deterministic() {
        let data = b"earth guardians";
        let mut h1 = Hasher::new();
        h1.update(data);
        let mut h2 = Hasher::new();
        h2.update(data);
        assert_eq!(h1.finish(), h2.finish());
    }
}
