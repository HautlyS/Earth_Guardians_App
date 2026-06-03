/**
 * WASM Module Loader
 *
 * Lazy-loads the @earth-guardians/shared WASM module on first use.
 * The shared package's pkg/ directory is built locally and gitignored,
 * so the import is wrapped in a try/catch — the app works in pure JS
 * mode when the WASM artifact is absent (fresh clone without build).
 */
import type { Compressor, Hasher, P2PUtils } from '@earth-guardians/shared'

let wasmInitialized = false
let wasmModule: {
  Compressor: typeof Compressor
  Hasher: typeof Hasher
  P2PUtils: typeof P2PUtils
} | null = null
let initPromise: Promise<void> | null = null

export interface WasmExports {
  Compressor: typeof Compressor
  Hasher: typeof Hasher
  P2PUtils: typeof P2PUtils
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

export async function initializeWasm(): Promise<void> {
  if (wasmInitialized) return
  if (initPromise) return initPromise

  initPromise = (async () => {
    try {
      const mod = await import('@earth-guardians/shared')
      const init = (mod as { default?: () => unknown }).default
      if (typeof init === 'function') {
        await (init as () => Promise<void> | void)()
      }
      wasmModule = {
        Compressor: (mod as { Compressor: typeof Compressor }).Compressor,
        Hasher: (mod as { Hasher: typeof Hasher }).Hasher,
        P2PUtils: (mod as { P2PUtils: typeof P2PUtils }).P2PUtils,
      }
      wasmInitialized = true
    } catch (err) {
      console.warn('[WASM] Falling back to JS implementation:', err)
      wasmInitialized = false
      wasmModule = null
    }
  })()

  return initPromise
}

export function isWasmAvailable(): boolean {
  return wasmInitialized && wasmModule !== null
}

export function getWasm(): WasmExports | null {
  return wasmModule
}

function fallbackHash(data: Uint8Array): string {
  let h1 = 0xdeadbeef ^ data.length
  let h2 = 0x41c6ce57 ^ data.length
  for (let i = 0; i < data.length; i++) {
    const c = data[i]
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')
}

function fallbackPeerId(): string {
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  let s = 'peer_'
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0')
  return s
}

export function compress(data: Uint8Array): Uint8Array {
  if (!isWasmAvailable() || !wasmModule) return data
  return new wasmModule.Compressor().compress(data)
}

export function decompress(data: Uint8Array): Uint8Array {
  if (!isWasmAvailable() || !wasmModule) {
    console.warn('[WASM] Not available, skipping decompression')
    return data
  }
  return new wasmModule.Compressor().decompress(data)
}

export function hash(data: Uint8Array): string {
  if (!isWasmAvailable() || !wasmModule) return fallbackHash(data)
  const hasher = new wasmModule.Hasher()
  hasher.update(data)
  return hasher.finish()
}

export function generatePeerId(): string {
  if (!isWasmAvailable() || !wasmModule) return fallbackPeerId()
  return new wasmModule.P2PUtils().generate_peer_id()
}

export default {
  initializeWasm,
  isWasmAvailable,
  getWasm,
  compress,
  decompress,
  hash,
  generatePeerId,
}
