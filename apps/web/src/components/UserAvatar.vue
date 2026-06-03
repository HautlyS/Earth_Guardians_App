<template>
  <div :class="['user-avatar', `size-${size}`]" :title="name">
    <img
      v-if="effectiveSrc"
      :src="effectiveSrc"
      :alt="name"
      class="avatar-img"
      @error="onImageError"
    />
    <span v-else class="avatar-initials" aria-hidden="true">{{ initials }}</span>
    <span
      v-if="showStatus"
      :class="['status-dot', statusClass]"
      :aria-label="online ? 'Online' : 'Offline'"
    ></span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    src?: string | null
    name: string
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    showStatus?: boolean
    online?: boolean
  }>(),
  {
    size: 'md',
    showStatus: false,
    online: false
  }
)

const imageError = ref(false)
const attemptedSrc = ref<string | null>(null)

watch(
  () => props.src,
  () => {
    if (props.src !== attemptedSrc.value) {
      imageError.value = false
      attemptedSrc.value = props.src ?? null
    }
  },
  { immediate: true }
)

const effectiveSrc = computed(() => {
  if (!props.src) return null
  if (imageError.value) return null
  return props.src
})

const initials = computed(() => {
  const cleaned = props.name.trim()
  if (!cleaned) return '?'
  const parts = cleaned.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return cleaned[0].toUpperCase()
})

const statusClass = computed(() => (props.online ? 'online' : 'offline'))

function onImageError() {
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
  flex-shrink: 0;
  overflow: hidden;
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
  user-select: none;
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
