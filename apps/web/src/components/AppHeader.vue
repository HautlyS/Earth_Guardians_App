<template>
  <header class="app-header">
    <nav class="nav container" aria-label="Primary">
      <router-link to="/" class="nav-brand">
        <span class="font-display nav-brand-title">EARTH GUARDIANS</span>
        <span class="version-badge" aria-label="Version">v{{ version }}</span>
      </router-link>

      <div class="nav-links" v-if="isAuthenticated">
        <router-link to="/" class="nav-item" exact-active-class="router-link-active">Feed</router-link>
        <router-link to="/projects" class="nav-item">Projects</router-link>
        <router-link to="/tasks" class="nav-item">Tasks</router-link>
        <router-link to="/docs" class="nav-item">Docs</router-link>
        <router-link to="/email" class="nav-item">Email</router-link>
        <router-link to="/p2p" class="nav-item">P2P</router-link>
      </div>

      <div class="nav-actions">
        <ThemeSwitcher />

        <button
          class="btn btn-icon"
          @click="openSearch"
          :aria-label="searchOpen ? 'Close search' : 'Open search'"
          :aria-expanded="searchOpen"
        >
          <span aria-hidden="true">🔍</span>
        </button>

        <NotificationBell v-if="isAuthenticated" />

        <div class="user-menu" v-if="isAuthenticated" ref="userMenuRef">
          <button
            class="user-avatar-btn"
            @click="toggleUserMenu"
            :aria-label="`Open user menu for ${displayName}`"
            :aria-expanded="userMenuOpen"
            aria-haspopup="menu"
          >
            <UserAvatar :src="avatarUrl" :name="displayName" size="sm" />
          </button>

          <div class="dropdown-menu" v-if="userMenuOpen" role="menu">
            <router-link to="/profile" class="dropdown-item" role="menuitem" @click="closeUserMenu">
              Profile
            </router-link>
            <router-link to="/settings" class="dropdown-item" role="menuitem" @click="closeUserMenu">
              Settings
            </router-link>
            <hr class="dropdown-divider" />
            <button class="dropdown-item" role="menuitem" @click="handleSignOut">Sign Out</button>
          </div>
        </div>

        <button
          v-if="!isAuthenticated"
          class="btn btn-primary"
          @click="openAuthModal"
        >
          Sign In
        </button>

        <button
          class="btn btn-icon mobile-menu-btn"
          v-if="isAuthenticated"
          @click="toggleMobileMenu"
          :aria-label="mobileMenuOpen ? 'Close menu' : 'Open menu'"
          :aria-expanded="mobileMenuOpen"
        >
          <span aria-hidden="true">{{ mobileMenuOpen ? '✕' : '☰' }}</span>
        </button>
      </div>
    </nav>

    <Transition name="drawer">
      <div v-if="isAuthenticated && mobileMenuOpen" class="mobile-drawer" role="navigation" aria-label="Mobile menu">
        <router-link to="/" class="nav-item" @click="closeMobileMenu">Feed</router-link>
        <router-link to="/projects" class="nav-item" @click="closeMobileMenu">Projects</router-link>
        <router-link to="/tasks" class="nav-item" @click="closeMobileMenu">Tasks</router-link>
        <router-link to="/docs" class="nav-item" @click="closeMobileMenu">Docs</router-link>
        <router-link to="/email" class="nav-item" @click="closeMobileMenu">Email</router-link>
        <router-link to="/p2p" class="nav-item" @click="closeMobileMenu">P2P</router-link>
        <router-link to="/settings" class="nav-item" @click="closeMobileMenu">Settings</router-link>
        <router-link to="/profile" class="nav-item" @click="closeMobileMenu">Profile</router-link>
      </div>
    </Transition>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useUIStore } from '../stores/ui'
import ThemeSwitcher from './ThemeSwitcher.vue'
import UserAvatar from './UserAvatar.vue'
import NotificationBell from './NotificationBell.vue'

const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUIStore()

const version = ref(__APP_VERSION__ || '1.0.0')
const userMenuOpen = ref(false)
const userMenuRef = ref<HTMLElement | null>(null)

const isAuthenticated = computed(() => authStore.isAuthenticated)
const displayName = computed(() => authStore.displayName)
const avatarUrl = computed(() => authStore.avatarUrl)
const searchOpen = computed(() => uiStore.searchModalOpen)
const mobileMenuOpen = computed(() => uiStore.mobileMenuOpen)

function openSearch() {
  if (uiStore.searchModalOpen) uiStore.closeSearchModal()
  else uiStore.openSearchModal()
}
function toggleMobileMenu() {
  uiStore.toggleMobileMenu()
}
function closeMobileMenu() {
  uiStore.mobileMenuOpen = false
}
function toggleUserMenu() {
  userMenuOpen.value = !userMenuOpen.value
}
function closeUserMenu() {
  userMenuOpen.value = false
}
function openAuthModal() {
  uiStore.openAuthModal()
}

async function handleSignOut() {
  closeUserMenu()
  await authStore.signOut()
  router.push('/').catch(() => {})
}

function onDocumentClick(e: MouseEvent) {
  if (!userMenuOpen.value) return
  const target = e.target as Node | null
  if (target && userMenuRef.value && !userMenuRef.value.contains(target)) {
    userMenuOpen.value = false
  }
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (userMenuOpen.value) userMenuOpen.value = false
    if (uiStore.mobileMenuOpen) uiStore.mobileMenuOpen = false
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})
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

.nav-brand-title {
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: 0.05em;
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
  line-height: 1;
}

.mobile-menu-btn {
  display: none;
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

.user-avatar-btn:hover,
.user-avatar-btn:focus-visible {
  border-color: var(--accent-color);
  outline: none;
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
  z-index: var(--z-dropdown);
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
  font-size: var(--text-base);
}

.dropdown-item:hover,
.dropdown-item:focus-visible {
  background: var(--bg-secondary);
  outline: none;
}

.dropdown-divider {
  margin: var(--spacing-xs) 0;
  border: none;
  border-top: 1px solid var(--border-color);
}

.mobile-drawer {
  display: none;
  flex-direction: column;
  background: var(--bg-secondary);
  border-top: 2px solid var(--border-color);
  padding: var(--spacing-md) 0;
  gap: var(--spacing-xs);
}

.mobile-drawer .nav-item {
  padding: var(--spacing-md) var(--spacing-lg);
}

.drawer-enter-active,
.drawer-leave-active {
  transition: max-height 0.25s ease, opacity 0.25s ease;
  overflow: hidden;
}
.drawer-enter-from,
.drawer-leave-to {
  max-height: 0;
  opacity: 0;
}
.drawer-enter-to,
.drawer-leave-from {
  max-height: 600px;
  opacity: 1;
}

@media (max-width: 768px) {
  .nav-links {
    display: none;
  }
  .mobile-menu-btn {
    display: inline-flex;
  }
  .mobile-drawer {
    display: flex;
  }
}

@media (max-width: 480px) {
  .nav-brand-title {
    font-size: 1rem;
  }
  .version-badge {
    display: none;
  }
}
</style>
