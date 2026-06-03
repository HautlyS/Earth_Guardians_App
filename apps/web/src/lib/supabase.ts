/**
 * Supabase Client Configuration
 * Earth Guardians Platform
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key'

if (!import.meta.env.VITE_SUPABASE_URL) {
  console.warn('Missing VITE_SUPABASE_URL - using placeholder values')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: {
      getItem: (key) => {
        try {
          return localStorage.getItem(key)
        } catch {
          return null
        }
      },
      setItem: (key, value) => {
        try {
          localStorage.setItem(key, value)
        } catch {
          console.error('Failed to save to localStorage')
        }
      },
      removeItem: (key) => {
        try {
          localStorage.removeItem(key)
        } catch {
          console.error('Failed to remove from localStorage')
        }
      }
    }
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

// Helper function to check if Supabase is configured
export const isConfigured = () => {
  return import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
}

export default supabase