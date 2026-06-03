<template>
  <div :class="['user-avatar', `size-${size}`]">
    <img 
      v-if="src" 
      :src="src" 
      :alt="name" 
      class="avatar-img"
      @error="handleImageError"
    />
    <span v-else class="avatar-initials">{{ initials }}</span>
    <span v-if="showStatus" :class="['status-dot', statusClass]"></span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(defineProps<{
  src?: string | null
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  showStatus?: boolean
  online?: boolean
}>(), {
  size: 'md',
  showStatus: false,
  online: false
})

const imageError = ref(false)

const initials = computed(() => {
  const parts = props.name.trim().split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return (props.name[0] || '?').toUpperCase()
})

const statusClass = computed(() => props.online ? 'online' : 'offline')

function handleImageError() {
  imageError.value = true
}
</script>

<style scoped>
.user-avatar {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--accent-color);
  color: var(--bg-primary);
  font-weight: bold;
  border: 2px solid var(--border-color);
}

.size-xs { width: 24px; height: 24px; font-size: 10px; }
.size-sm { width: 32px; height: 32px; font-size: 12px; }
.size-md { width: 40px; height: 40px; font-size: 14px; }
.size-lg { width: 48px; height: 48px; font-size: 16px; }
.size-xl { width: 64px; height: 64px; font-size: 20px; }

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.avatar-initials {
  text-transform: uppercase;
}

.status-dot {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 25%;
  height: 25%;
  border-radius: 50%;
  border: 2px solid var(--bg-primary);
}

.status-dot.online {
  background: var(--success-color);
}

.status-dot.offline {
  background: var(--text-muted);
}
</style>