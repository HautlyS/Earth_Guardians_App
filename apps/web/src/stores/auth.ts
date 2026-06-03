/**
 * Authentication Store
 * Earth Guardians Platform
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface Profile {
  id: string
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  role: string
  status: string
  settings: Record<string, any>
  created_at: string
  updated_at: string
}

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const profile = ref<Profile | null>(null)
  const loading = ref(false)
  const initialized = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const isAuthenticated = computed(() => !!user.value)
  const userId = computed(() => user.value?.id || null)
  const userEmail = computed(() => user.value?.email || null)
  const displayName = computed(() => profile.value?.display_name || profile.value?.username || user.value?.email?.split('@')[0] || 'User')
  const avatarUrl = computed(() => profile.value?.avatar_url || null)
  const userRole = computed(() => profile.value?.role || 'crew_member')

  // Actions
  async function initialize() {
    if (initialized.value) return
    
    loading.value = true
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      session.value = currentSession
      user.value = currentSession?.user ?? null
      
      if (user.value) {
        await fetchProfile()
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (event, newSession) => {
        session.value = newSession
        user.value = newSession?.user ?? null
        
        if (user.value) {
          await fetchProfile()
        } else {
          profile.value = null
        }
      })

      initialized.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to initialize auth'
      console.error('Auth initialization failed:', e)
    } finally {
      loading.value = false
    }
  }

  async function fetchProfile() {
    if (!user.value) return
    
    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.value.id)
        .single()
      
      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Failed to fetch profile:', fetchError)
      } else {
        profile.value = data
      }
    } catch (e) {
      console.error('Profile fetch error:', e)
    }
  }

  async function signInWithEmail(email: string, redirectTo?: string) {
    loading.value = true
    error.value = null
    
    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo || `${window.location.origin}/auth/callback`
        }
      })
      
      if (signInError) {
        error.value = signInError.message
        return { success: false, error: signInError.message }
      }
      
      return { success: true }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Sign in failed'
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  async function signUp(email: string, password: string, metadata?: Record<string, any>) {
    loading.value = true
    error.value = null
    
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata
        }
      })
      
      if (signUpError) {
        error.value = signUpError.message
        return { success: false, error: signUpError.message }
      }
      
      return { success: true }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Sign up failed'
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  async function signOut() {
    loading.value = true
    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) {
        console.error('Sign out error:', signOutError)
      }
      user.value = null
      session.value = null
      profile.value = null
    } catch (e) {
      console.error('Sign out failed:', e)
    } finally {
      loading.value = false
    }
  }

  async function updateProfile(updates: Partial<Profile>) {
    if (!user.value) return { success: false, error: 'Not authenticated' }
    
    loading.value = true
    try {
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.value.id)
        .select()
        .single()
      
      if (updateError) {
        error.value = updateError.message
        return { success: false, error: updateError.message }
      }
      
      profile.value = data
      return { success: true, data }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Update failed'
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  async function refreshSession() {
    const { data, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError) {
      console.error('Session refresh failed:', refreshError)
    } else {
      session.value = data.session
      user.value = data.session?.user ?? null
    }
    return !refreshError
  }

  return {
    // State
    user,
    session,
    profile,
    loading,
    initialized,
    error,
    
    // Getters
    isAuthenticated,
    userId,
    userEmail,
    displayName,
    avatarUrl,
    userRole,
    
    // Actions
    initialize,
    fetchProfile,
    signInWithEmail,
    signUp,
    signOut,
    updateProfile,
    refreshSession
  }
})