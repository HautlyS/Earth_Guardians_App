<template>
  <div
    class="theme-switcher"
    role="radiogroup"
    aria-label="Color theme"
  >
    <button
      v-for="option in options"
      :key="option.value"
      @click="setTheme(option.value)"
      :class="{ active: theme === option.value }"
      :title="option.label"
      :aria-label="option.label"
      :aria-pressed="theme === option.value"
      role="radio"
      :aria-checked="theme === option.value"
      class="theme-btn"
      type="button"
    >
      <span aria-hidden="true">{{ option.icon }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useUIStore, type Theme } from '../stores/ui'

const uiStore = useUIStore()

const theme = computed(() => uiStore.theme)

const options: { value: Theme; label: string; icon: string }[] = [
  { value: 'light', label: 'Light mode', icon: '☀️' },
  { value: 'dark', label: 'Dark mode', icon: '🌙' },
  { value: 'high-contrast', label: 'High contrast mode', icon: '⚡' }
]

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
  line-height: 1;
  color: inherit;
}

.theme-btn:hover,
.theme-btn:focus-visible {
  background: var(--bg-secondary);
  outline: none;
}

.theme-btn.active {
  background: var(--accent-color);
  color: var(--bg-primary);
  border-color: var(--accent-color);
}
</style>
