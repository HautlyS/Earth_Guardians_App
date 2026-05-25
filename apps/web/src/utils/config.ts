/** 
 * @fileoverview Environment Configuration
 * @module config
 */

/**
 * Environment configuration for Earth Guardians Platform
 */
export const config = {
  // Application
  app: {
    name: 'Earth Guardians',
    version: import.meta.env.VITE_APP_VERSION || '1.0.0',
    environment: import.meta.env.MODE || 'development',
    debug: import.meta.env.VITE_ENABLE_DEBUG === 'true'
  },
  
  // Supabase
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL || 'http://localhost:8000',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    serviceKey: import.meta.env.VITE_SUPABASE_SERVICE_KEY || '',
    storageUrl: import.meta.env.VITE_SUPABASE_URL ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object` : ''
  },
  
  // API
  api: {
    baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:4000',
    timeout: 30000,
    retries: 3
  },
  
  // P2P
  p2p: {
    maxConnections: parseInt(import.meta.env.VITE_MAX_CONNECTIONS || '50'),
    chunkSize: parseInt(import.meta.env.VITE_WASM_CHUNK_SIZE || '65536'),
    relayEnabled: import.meta.env.VITE_RELAY_ENABLED !== 'false',
    stunServers: [
      { host: 'stun.l.google.com', port: 19302 },
      { host: 'stun1.l.google.com', port: 19302 },
      { host: 'stun2.l.google.com', port: 19302 }
    ]
  },
  
  // Features
  features: {
    realtime: import.meta.env.VITE_FEATURE_REALTIME !== 'false',
    offline: import.meta.env.VITE_FEATURE_OFFLINE !== 'false',
    p2p: import.meta.env.VITE_FEATURE_P2P !== 'false',
    analytics: import.meta.env.VITE_FEATURE_ANALYTICS === 'true'
  },
  
  // Logging
  logging: {
    level: import.meta.env.VITE_LOG_LEVEL || 'debug',
    console: import.meta.env.VITE_LOG_LEVEL !== 'silent',
    remote: false
  },
  
  // Security
  security: {
    cspEnabled: import.meta.env.VITE_CSP_ENABLED !== 'false',
    cspReportUri: import.meta.env.VITE_CSP_REPORT_URI || '/api/csp-report'
  }
} as const

export default config