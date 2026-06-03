<template>
  <div class="theme-switcher">
    <button 
      @click="setTheme('light')" 
      :class="{ active: theme === 'light' }"
      title="Light Mode"
      class="theme-btn"
    >
      ☀️
    </button>
    <button 
      @click="setTheme('dark')" 
      :class="{ active: theme === 'dark' }"
      title="Dark Mode"
      class="theme-btn"
    >
      🌙
    </button>
    <button 
      @click="setTheme('high-contrast')" 
      :class="{ active: theme === 'high-contrast' }"
      title="High Contrast"
      class="theme-btn"
    >
      ⚡
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useUIStore, type Theme } from '../stores/ui'

const uiStore = useUIStore()

const theme = computed(() => uiStore.theme)

function setTheme(newTheme: Theme) {
  uiStore.setTheme(newTheme)
}
</script>

<style scoped>
.theme-switcher {
  display: flex;
  gap: var(--spacing-xs);
}

.theme-btn {
  padding: var(--spacing-sm);
  border: 2px solid var(--border-color);
  background: transparent;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 1rem;
}

.theme-btn:hover {
  background: var(--bg-secondary);
}

.theme-btn.active {
  background: var(--accent-color);
  color: var(--bg-primary);
  border-color: var(--accent-color);
}
</style>