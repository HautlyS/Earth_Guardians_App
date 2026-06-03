<template>
  <div class="not-found-view container">
    <div class="not-found-content">
      <h1 class="text-5xl font-display">404</h1>
      <h2 class="text-2xl font-display mt-lg">PAGE NOT FOUND</h2>
      <p class="text-muted mt-md">The page you're looking for doesn't exist.</p>
      <router-link to="/" class="btn btn-primary mt-xl">Go Home</router-link>
    </div>
  </div>
</template>

<style scoped>
.not-found-view { min-height: 60vh; display: flex; align-items: center; justify-content: center; }
.not-found-content { text-align: center; }
.mt-lg { margin-top: var(--spacing-lg); }
.mt-md { margin-top: var(--spacing-md); }
.mt-xl { margin-top: var(--spacing-xl); }
</style>