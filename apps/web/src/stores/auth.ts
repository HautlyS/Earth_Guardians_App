/**
 * Authentication Store
 * Earth Guardians Platform
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'
import type { User, Session, Subscription } from '@supabase/supabase-js'

export type UserRole =
  | 'staff'
  | 'regional_councilor'
  | 'crew_leader'
  | 'crew_member'
  | 'stakeholder'
  | 'partner'

export interface Profile {
  id: string
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  role: UserRole
  status: string
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export const EDITABLE_PROFILE_FIELDS = [
  'display_name',
  'bio',
  'avatar_url',
  'phone',
  'location',
  'website',
  'social_links',
  'skills',
  'languages',
  'timezone',
  'cover_image',
] as const

export type EditableProfileField = (typeof EDITABLE_PROFILE_FIELDS)[number]

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const profile = ref<Profile | null>(null)
  const loading = ref(false)
  const initialized = ref(false)
  const error = ref<string | null>(null)

  let authSub: Subscription | null = null

  const isAuthenticated = computed(() => !!user.value)
  const userId = computed(() => user.value?.id || null)
  const userEmail = computed(() => user.value?.email || null)
  const displayName = computed(
    () =>
      profile.value?.display_name ||
      profile.value?.username ||
      user.value?.email?.split('@')[0] ||
      'User'
  )
  const avatarUrl = computed(() => profile.value?.avatar_url || null)
  const userRole = computed(() => (profile.value?.role as UserRole) || 'crew_member')

  async function initialize(): Promise<void> {
    if (initialized.value) return
    loading.value = true
    try {
      const { data } = await supabase.auth.getSession()
      session.value = data.session
      user.value = data.session?.user ?? null
      if (user.value) await fetchProfile()

      const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
        session.value = newSession
        user.value = newSession?.user ?? null
        if (user.value) await fetchProfile()
        else profile.value = null
      })
      authSub = sub
      initialized.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to initialize auth'
      console.error('Auth initialization failed:', e)
    } finally {
      loading.value = false
    }
  }

  async function fetchProfile(): Promise<Profile | null> {
    if (!user.value) return null
    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.value.id)
        .maybeSingle()

      if (fetchError) {
        console.error('Failed to fetch profile:', fetchError)
        return null
      }
      if (data) {
        profile.value = data as Profile
        return data as Profile
      }

      // Profile missing — create one as a safety net (handle_new_user trigger may have failed)
      const username = (user.value.email?.split('@')[0] ?? 'user')
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 30) || `user_${Date.now().toString(36)}`
      const { data: created, error: createError } = await supabase
        .from('profiles')
        .insert({
          user_id: user.value.id,
          username,
          display_name: user.value.email?.split('@')[0] ?? 'User',
        })
        .select('*')
        .single()
      if (createError) {
        console.error('Failed to create profile fallback:', createError)
        return null
      }
      profile.value = created as Profile
      return created as Profile
    } catch (e) {
      console.error('Profile fetch error:', e)
      return null
    }
  }

  async function signInWithEmail(email: string, redirectTo?: string): Promise<{ success: boolean; error?: string }> {
    loading.value = true
    error.value = null
    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo || `${window.location.origin}/auth/callback` },
      })
      if (signInError) {
        error.value = signInError.message
        return { success: false, error: signInError.message }
      }
      return { success: true }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign in failed'
      error.value = msg
      return { success: false, error: msg }
    } finally {
      loading.value = false
    }
  }

  async function signUp(
    email: string,
    password: string,
    metadata?: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    loading.value = true
    error.value = null
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: metadata },
      })
      if (signUpError) {
        error.value = signUpError.message
        return { success: false, error: signUpError.message }
      }
      return { success: true }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign up failed'
      error.value = msg
      return { success: false, error: msg }
    } finally {
      loading.value = false
    }
  }

  async function signOut(): Promise<void> {
    loading.value = true
    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) console.error('Sign out error:', signOutError)
      user.value = null
      session.value = null
      profile.value = null
      if (authSub) {
        authSub.unsubscribe()
        authSub = null
      }
      initialized.value = false
    } catch (e) {
      console.error('Sign out failed:', e)
    } finally {
      loading.value = false
    }
  }

  async function updateProfile(
    updates: Partial<Record<EditableProfileField, unknown>>
  ): Promise<{ success: boolean; data?: Profile; error?: string }> {
    if (!user.value) return { success: false, error: 'Not authenticated' }
    const safe: Record<string, unknown> = {}
    for (const key of EDITABLE_PROFILE_FIELDS) {
      if (key in updates) safe[key] = updates[key as keyof typeof updates]
    }
    if (Object.keys(safe).length === 0) return { success: false, error: 'No editable fields provided' }
    safe.updated_at = new Date().toISOString()
    loading.value = true
    try {
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update(safe)
        .eq('user_id', user.value.id)
        .select('*')
        .single()
      if (updateError) {
        error.value = updateError.message
        return { success: false, error: updateError.message }
      }
      profile.value = data as Profile
      return { success: true, data: data as Profile }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Update failed'
      error.value = msg
      return { success: false, error: msg }
    } finally {
      loading.value = false
    }
  }

  async function refreshSession(): Promise<boolean> {
    const { data, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError) {
      console.error('Session refresh failed:', refreshError)
      return false
    }
    session.value = data.session
    user.value = data.session?.user ?? null
    return true
  }

  return {
    user,
    session,
    profile,
    loading,
    initialized,
    error,
    isAuthenticated,
    userId,
    userEmail,
    displayName,
    avatarUrl,
    userRole,
    initialize,
    fetchProfile,
    signInWithEmail,
    signUp,
    signOut,
    updateProfile,
    refreshSession,
  }
})
