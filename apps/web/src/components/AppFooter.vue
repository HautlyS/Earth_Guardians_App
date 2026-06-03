<template>
  <footer class="app-footer">
    <div class="container">
      <div class="footer-content">
        <p class="footer-brand">© {{ currentYear }} Earth Guardians NGO</p>
        <p class="footer-tagline">Built with ❤️ and Rust/WASM</p>
        <div class="footer-links">
          <a href="https://earthguardians.org" target="_blank" rel="noopener">Website</a>
          <span class="separator">•</span>
          <a href="https://github.com/earth-guardians/platform" target="_blank" rel="noopener">GitHub</a>
          <span class="separator">•</span>
          <router-link to="/docs">Documentation</router-link>
        </div>
      </div>
      <p class="footer-tech">Powered by P2P, WebAssembly, and decentralized technology</p>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const currentYear = computed(() => new Date().getFullYear())
</script>

<style scoped>
.app-footer {
  border-top: 3px solid var(--border-color);
  padding: var(--spacing-xl) 0;
  margin-top: auto;
  background: var(--bg-secondary);
}

.footer-content {
  text-align: center;
}

.footer-brand {
  font-weight: bold;
  font-size: var(--text-lg);
}

.footer-tagline {
  color: var(--text-muted);
  margin: var(--spacing-xs) 0;
}

.footer-links {
  display: flex;
  justify-content: center;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
}

.footer-links a {
  color: var(--accent-color);
  text-decoration: none;
}

.footer-links a:hover {
  text-decoration: underline;
}

.separator {
  color: var(--text-muted);
}

.footer-tech {
  text-align: center;
  color: var(--text-muted);
  font-size: var(--text-sm);
  margin-top: var(--spacing-lg);
}
</style>