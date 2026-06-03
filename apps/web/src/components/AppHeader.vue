<template>
  <header class="app-header">
    <nav class="nav container">
      <router-link to="/" class="nav-brand">
        <h1 class="font-display text-xl">EARTH GUARDIANS</h1>
        <span class="version-badge">v{{ version }}</span>
      </router-link>

      <div class="nav-links" v-if="isAuthenticated">
        <router-link to="/" class="nav-item">Feed</router-link>
        <router-link to="/projects" class="nav-item">Projects</router-link>
        <router-link to="/tasks" class="nav-item">Tasks</router-link>
        <router-link to="/docs" class="nav-item">Docs</router-link>
        <router-link to="/email" class="nav-item">Email</router-link>
        <router-link to="/p2p" class="nav-item">P2P</router-link>
      </div>

      <div class="nav-actions">
        <ThemeSwitcher />
        
        <button class="btn btn-icon" @click="toggleSearch" title="Search">
          🔍
        </button>

        <NotificationBell v-if="isAuthenticated" />

        <div class="user-menu" v-if="isAuthenticated">
          <button class="user-avatar-btn" @click="toggleUserMenu">
            <UserAvatar :src="avatarUrl" :name="displayName" size="sm" />
          </button>
          
          <div class="dropdown-menu" v-if="userMenuOpen">
            <router-link to="/profile" class="dropdown-item">Profile</router-link>
            <router-link to="/settings" class="dropdown-item">Settings</router-link>
            <hr class="dropdown-divider">
            <button class="dropdown-item" @click="handleSignOut">Sign Out</button>
          </div>
        </div>

        <button 
          v-if="!isAuthenticated" 
          class="btn btn-primary" 
          @click="openAuthModal"
        >
          Sign In
        </button>
      </div>
    </nav>

    <SearchModal v-if="searchOpen" @close="searchOpen = false" />
    <AuthModal v-if="authModalOpen" @close="authModalOpen = false" />
  </header>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useUIStore } from '../stores/ui'
import ThemeSwitcher from './ThemeSwitcher.vue'
import UserAvatar from './UserAvatar.vue'
import NotificationBell from './NotificationBell.vue'
import SearchModal from './SearchModal.vue'
import AuthModal from './AuthModal.vue'

const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUIStore()

const version = ref(__APP_VERSION__ || '1.0.0')
const searchOpen = ref(false)
const userMenuOpen = ref(false)

const isAuthenticated = computed(() => authStore.isAuthenticated)
const displayName = computed(() => authStore.displayName)
const avatarUrl = computed(() => authStore.avatarUrl)
const authModalOpen = computed(() => uiStore.authModalOpen)

function toggleSearch() {
  searchOpen.value = !searchOpen.value
}

function toggleUserMenu() {
  userMenuOpen.value = !userMenuOpen.value
}

function openAuthModal() {
  uiStore.openAuthModal()
}

async function handleSignOut() {
  await authStore.signOut()
  userMenuOpen.value = false
  router.push('/')
}
</script>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: var(--z-dropdown, 100);
  background: var(--bg-primary);
  border-bottom: 3px solid var(--border-color);
  padding: var(--spacing-md) 0;
}

.nav {
  display: flex;
  align-items: center;
  gap: var(--spacing-xl);
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  text-decoration: none;
  color: var(--text-color);
}

.version-badge {
  font-size: var(--text-xs);
  background: var(--accent-color);
  color: var(--bg-primary);
  padding: 2px 8px;
  border-radius: 4px;
}

.nav-links {
  display: flex;
  gap: var(--spacing-md);
  flex: 1;
}

.nav-item {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 2px solid transparent;
  text-decoration: none;
  color: var(--text-color);
  transition: all 0.2s;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.nav-item:hover {
  border-color: var(--accent-color);
}

.nav-item.router-link-active {
  background: var(--accent-color);
  color: var(--bg-primary);
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  padding: var(--spacing-xs);
}

.user-menu {
  position: relative;
}

.user-avatar-btn {
  background: none;
  border: 2px solid var(--border-color);
  cursor: pointer;
  border-radius: 50%;
  padding: 2px;
}

.user-avatar-btn:hover {
  border-color: var(--accent-color);
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background: var(--bg-primary);
  border: 2px solid var(--border-color);
  box-shadow: var(--shadow-lg);
  min-width: 180px;
  margin-top: var(--spacing-sm);
}

.dropdown-item {
  display: block;
  padding: var(--spacing-sm) var(--spacing-md);
  text-decoration: none;
  color: var(--text-color);
  border: none;
  background: none;
  width: 100%;
  text-align: left;
  cursor: pointer;
}

.dropdown-item:hover {
  background: var(--bg-secondary);
}

.dropdown-divider {
  margin: var(--spacing-xs) 0;
  border: none;
  border-top: 1px solid var(--border-color);
}

@media (max-width: 768px) {
  .nav-links {
    display: none;
  }
}
</style>