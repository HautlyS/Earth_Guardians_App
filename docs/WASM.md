# WebAssembly (WASM) Development Guide

## Overview

The Earth Guardians platform uses WebAssembly for high-performance operations, built with Rust and compiled to WASM for use in both web and desktop applications.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Vue 3 App     │────►│   Vite + WASM   │────►│   WASM Module   │
│   (Frontend)    │     │   (Bundler)     │     │   (Rust/WASM)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                      │
                                                      ▼
                                              ┌─────────────────┐
                                              │   Browser       │
                                              │   WebAssembly   │
                                              │   Runtime       │
                                              └─────────────────┘
```

## Available WASM Modules

### Compressor
High-performance LZ77-based compression for data transfer optimization.

```typescript
import { Compressor } from '@earth-guardians/shared'

const compressor = new Compressor()
const compressed = compressor.compress(data)
const decompressed = compressor.decompress(compressed)
```

### Hasher
Custom hash functions for data integrity and deduplication.

```typescript
import { Hasher } from '@earth-guardians/shared'

const hasher = new Hasher()
hasher.update(data)
const hash = hasher.finish()
```

### P2P Utils
Cryptographic utilities for peer-to-peer networking.

```typescript
import { P2PUtils } from '@earth-guardians/shared'

const p2p = new P2PUtils()
const peerId = p2p.generate_peer_id()
```

## Building WASM

### Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add WASM target
rustup target add wasm32-unknown-unknown

# Install wasm-pack
cargo install wasm-pack
```

### Build Commands

```bash
# Build for web (ES modules)
pnpm build:wasm

# Build for Node.js (CommonJS)
pnpm build:wasm:node

# Build all targets
pnpm build:wasm:all

# Development watch mode
pnpm --filter @earth-guardians/shared watch

# Run tests
pnpm --filter @earth-guardians/shared test
```

## Development Workflow

### 1. Modify Rust Code

Edit files in `packages/shared/src/`:

```rust
// packages/shared/src/lib.rs
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct MyStruct {
    // ...
}

#[wasm_bindgen]
impl MyStruct {
    #[wasm_bindgen(constructor)]
    pub fn new() -> MyStruct { /* ... */ }
    
    pub fn process(&self, data: &[u8]) -> Vec<u8> {
        // Implementation
    }
}
```

### 2. Build and Test

```bash
# Build WASM
pnpm build:wasm

# Watch for changes (in another terminal)
pnpm --filter @earth-guardians/shared watch
```

### 3. Use in Web App

```typescript
// apps/web/src/utils/wasm.ts
export async function initializeWasm() {
  const wasm = await import('@earth-guardians/shared')
  await wasm.default()
  return wasm
}

export const compressor = new wasm.Compressor()
export const hasher = new wasm.Hasher()
export const p2pUtils = new wasm.P2PUtils()
```

## Rust Best Practices

### Memory Management
- Use `Vec<u8>` for byte arrays
- Avoid unnecessary allocations
- Use slices (`&[u8]`) when possible

### WASM Bindings
- Always mark public functions with `#[wasm_bindgen]`
- Use appropriate types (`Vec<u8>`, `String`, `&str`)
- Avoid exposing raw pointers

### Performance
- Enable LTO in `Cargo.toml`:
```toml
[profile.release]
opt-level = "s"
lto = true
```

- Use `wasm-opt` for additional optimization:
```bash
wasm-opt -O3 -o output.wasm input.wasm
```

## Debugging

### Browser DevTools
1. Open Chrome DevTools
2. Go to Sources > WebAssembly
3. Set breakpoints in WASM code

### Logging from WASM
```rust
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}
```

### Performance Profiling
```javascript
// In browser console
const start = performance.now()
compressor.compress(data)
console.log(`Compress took: ${performance.now() - start}ms`)
```

## Testing

### Unit Tests
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compress_decompress() {
        let data = vec![1u8, 2, 3, 4, 5];
        let compressed = Compressor::new().compress(&data);
        let decompressed = Compressor::new().decompress(&compressed);
        assert_eq!(data, decompressed);
    }
}
```

### Browser Tests
```bash
# Run in browser
pnpm test:firefox

# Run in Node.js
pnpm test
```

## Troubleshooting

### Common Issues

1. **WASM not loading**
   - Check browser console for errors
   - Verify MIME types are correct
   - Ensure CORS headers are set

2. **Build failures**
   - Check Rust toolchain is up to date
   - Verify wasm-pack is installed
   - Clean and rebuild: `cargo clean && pnpm build:wasm`

3. **Memory issues**
   - Monitor WASM memory usage
   - Use `wasm-gc` to remove unused functions
   - Check for memory leaks in Rust code

## Size Optimization

```bash
# Minify WASM
wasm-opt -Oz input.wasm -o output.wasm

# Check size
ls -lh input.wasm output.wasm

# Analyze
wasm-objdump -h input.wasm
```

## Performance Benchmarks

| Operation | Native | WASM | Overhead |
|-----------|--------|------|----------|
| Compress 1MB | 5ms | 8ms | 60% |
| Hash 1MB | 1ms | 2ms | 100% |

## Related Documentation

- [Architecture](ARCHITECTURE.md)
- [P2P Networking](P2P.md)
- [Contributing](../CONTRIBUTING.md)