/**
 * WASM Module Loader
 * Handles lazy loading and initialization of Rust WASM modules
 */

let wasmInitialized = false
let wasmModule: any = null

export interface WasmExports {
  Compressor: {
    new (): CompressorInstance
  }
  Hasher: {
    new (): HasherInstance
  }
  P2PUtils: {
    new (): P2PUtilsInstance
  }
}

export interface CompressorInstance {
  compress(data: Uint8Array): Uint8Array
  decompress(data: Uint8Array): Uint8Array
}

export interface HasherInstance {
  update(data: Uint8Array): void
  finish(): string
}

export interface P2PUtilsInstance {
  generate_peer_id(): string
}

/**
 * Initialize WASM module
 * Must be called before using any WASM functionality
 */
export async function initializeWasm(): Promise<void> {
  if (wasmInitialized) return

  try {
    // Dynamic import of WASM module
    const wasm = await import('@shared/wasm')
    await wasm.default()
    wasmModule = wasm
    wasmInitialized = true
    console.log('[WASM] Initialized successfully')
  } catch (error) {
    console.warn('[WASM] Failed to initialize, running in fallback mode:', error)
    wasmInitialized = false
  }
}

/**
 * Check if WASM is available
 */
export function isWasmAvailable(): boolean {
  return wasmInitialized && wasmModule !== null
}

/**
 * Get WASM module instance
 */
export function getWasm(): WasmExports | null {
  return wasmModule
}

/**
 * Test compressor functionality
 */
export function testCompressor(data: Uint8Array): Uint8Array {
  if (!isWasmAvailable()) {
    // Fallback: return data as-is
    return data
  }
  const compressor = new wasmModule.Compressor()
  return compressor.compress(data)
}

/**
 * Test hasher functionality
 */
export function testHasher(data: Uint8Array): string {
  if (!isWasmAvailable()) {
    // Fallback: simple hash
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash + data[i]) | 0
    }
    return Math.abs(hash).toString(16)
  }
  const hasher = new wasmModule.Hasher()
  hasher.update(data)
  return hasher.finish()
}

/**
 * Generate peer ID
 */
export function generatePeerId(): string {
  if (!isWasmAvailable()) {
    // Fallback: generate in JS
    return `peer_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 11)}`
  }
  const p2p = new wasmModule.P2PUtils()
  return p2p.generate_peer_id()
}

/**
 * Compress data using WASM
 */
export function compress(data: Uint8Array): Uint8Array {
  if (!isWasmAvailable()) {
    console.warn('[WASM] Not available, skipping compression')
    return data
  }
  const compressor = new wasmModule.Compressor()
  return compressor.compress(data)
}

/**
 * Decompress data using WASM
 */
export function decompress(data: Uint8Array): Uint8Array {
  if (!isWasmAvailable()) {
    console.warn('[WASM] Not available, skipping decompression')
    return data
  }
  const compressor = new wasmModule.Compressor()
  return compressor.decompress(data)
}

/**
 * Hash data using WASM
 */
export function hash(data: Uint8Array): string {
  if (!isWasmAvailable()) {
    // Fallback
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash + data[i]) | 0
    }
    return Math.abs(hash).toString(16)
  }
  const hasher = new wasmModule.Hasher()
  hasher.update(data)
  return hasher.finish()
}

// Re-export for convenience
export default {
  initializeWasm,
  isWasmAvailable,
  getWasm,
  compress,
  decompress,
  hash,
  generatePeerId,
  testCompressor,
  testHasher
}